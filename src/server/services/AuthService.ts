import crypto from 'node:crypto';
import type { AppDatabase } from '../repositories/Database.ts';
import type { SessionRepository, UserRepository } from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import type { SessionTokenClaims, User, UserRole } from '../../types/domain.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const TOKEN_ISSUER = 'milestoneproof-ai-server';
export const TOKEN_AUDIENCE = 'milestoneproof-ai-api';
export const DEFAULT_TOKEN_TTL_SECONDS = 3600; // 1 hour

/**
 * Non-blocking asynchronous scrypt key derivation wrapper.
 * Never blocks the Node.js event loop during login authentication.
 */
export function scryptAsync(password: string, salt: Buffer, keylen = 64): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });
}

export async function verifyPasswordAsync(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [saltHex, derivedHex] = parts;
  const saltBuf = Buffer.from(saltHex, 'hex');
  const expectedBuf = Buffer.from(derivedHex, 'hex');
  if (saltBuf.length === 0 || expectedBuf.length === 0) {
    return false;
  }
  const actualBuf = await scryptAsync(password, saltBuf, expectedBuf.length);
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecodeToString(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export interface AuthServiceOptions {
  secret?: string;
  nodeEnv?: string;
  enableDemoImpersonation?: boolean;
  defaultTtlSeconds?: number;
}

export class AuthService {
  private readonly db: AppDatabase;
  private readonly userRepo: UserRepository;
  private readonly sessionRepo: SessionRepository;
  private readonly auditSvc: AuditService;
  private readonly secret: string;
  private readonly nodeEnv: string;
  private readonly enableDemoImpersonation: boolean;
  private readonly defaultTtlSeconds: number;

  constructor(
    db: AppDatabase,
    userRepo: UserRepository,
    sessionRepo: SessionRepository,
    auditSvc: AuditService,
    options?: AuthServiceOptions
  ) {
    this.db = db;
    this.userRepo = userRepo;
    this.sessionRepo = sessionRepo;
    this.auditSvc = auditSvc;
    this.nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV ?? 'development';
    this.enableDemoImpersonation =
      options?.enableDemoImpersonation ??
      process.env.ENABLE_DEMO_IMPERSONATION === 'true';
    this.defaultTtlSeconds = options?.defaultTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;

    const configuredSecret =
      options && 'secret' in options ? options.secret : process.env.AUTH_TOKEN_SECRET;

    if (this.nodeEnv === 'production') {
      if (!configuredSecret || configuredSecret.trim().length < 32) {
        throw new AppError(
          500,
          'FATAL_INSECURE_AUTH_SECRET',
          'Production requires a stable AUTH_TOKEN_SECRET of at least 32 characters.'
        );
      }
      this.secret = configuredSecret;
    } else {
      if (configuredSecret && configuredSecret.trim().length >= 32) {
        this.secret = configuredSecret;
      } else {
        // Ephemeral per-process random secret for local dev/test when AUTH_TOKEN_SECRET is unset.
        // Note: Tokens signed with an ephemeral secret become invalid after a server restart.
        this.secret = crypto.randomBytes(32).toString('hex');
      }
    }
  }

  public isDemoModeAllowed(): boolean {
    return this.nodeEnv !== 'production' && this.enableDemoImpersonation;
  }

  public signClaims(claims: SessionTokenClaims): string {
    const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'MPAI-JWT' }));
    const payloadB64 = base64UrlEncode(JSON.stringify(claims));
    const signingInput = `${headerB64}.${payloadB64}`;
    const signatureB64 = crypto
      .createHmac('sha256', this.secret)
      .update(signingInput, 'utf8')
      .digest('base64url');
    return `${signingInput}.${signatureB64}`;
  }

  private issueSessionWithinTx(
    user: User,
    action: 'AUTH_LOGIN' | 'AUTH_DEMO_SWITCH',
    ttlSeconds = this.defaultTtlSeconds,
    customNowSec?: number
  ): { token: string; user: User; expiresAt: number; jti: string } {
    const nowSec = customNowSec ?? Math.floor(Date.now() / 1000);
    const expiresAt = nowSec + ttlSeconds;
    const jti = crypto.randomUUID();

    const claims: SessionTokenClaims = {
      jti,
      sub: user.id,
      role: user.role, // Always authoritative role from SQLite database
      iss: TOKEN_ISSUER,
      aud: TOKEN_AUDIENCE,
      iat: nowSec,
      exp: expiresAt,
    };

    const token = this.signClaims(claims);

    this.db.withTransaction(() => {
      this.sessionRepo.createSession({
        jti,
        userId: user.id,
        role: user.role,
        issuedAt: nowSec,
        expiresAt,
      });

      this.auditSvc.appendWithinTx({
        actorId: user.id,
        actorRole: user.role,
        action,
        entityType: 'AUTH_SESSION',
        entityId: jti,
        previousState: null,
        newState: 'ACTIVE',
        payload: {
          jti,
          userId: user.id,
          role: user.role,
          issuedAt: nowSec,
          expiresAt,
        },
      });
    });

    return { token, user, expiresAt, jti };
  }

  /**
   * Authenticates a user via email + password using non-blocking async scrypt,
   * resolves the user's authoritative role from SQLite, and issues a signed session token.
   * Never accepts a client-supplied role.
   */
  public async login(input: {
    email?: unknown;
    password?: unknown;
    role?: unknown;
  }): Promise<{ token: string; user: User; expiresAt: number; jti: string }> {
    if (input.role !== undefined) {
      throw new AppError(
        400,
        'ROLE_SELECTION_FORBIDDEN',
        'Clients cannot request or specify a role during authentication; roles are resolved server-side.'
      );
    }

    if (typeof input.email !== 'string' || typeof input.password !== 'string') {
      throw new AppError(400, 'INVALID_LOGIN_PAYLOAD', 'Both email and password are required.');
    }

    const email = input.email.trim();
    const password = input.password;
    if (!email || !password) {
      throw new AppError(400, 'INVALID_LOGIN_PAYLOAD', 'Both email and password are required.');
    }

    const userWithPwd = this.userRepo.findByEmailWithPassword(email);
    if (!userWithPwd || !userWithPwd.isActive) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const passwordValid = await verifyPasswordAsync(password, userWithPwd.passwordHash);
    if (!passwordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const { passwordHash: _omitted, ...safeUser } = userWithPwd;
    return this.issueSessionWithinTx(safeUser, 'AUTH_LOGIN');
  }

  /**
   * Issues a demo persona session token ONLY when NODE_ENV !== 'production'
   * AND ENABLE_DEMO_IMPERSONATION === 'true'.
   * Rejects any client-supplied role and verifies is_demo_account === 1 in SQLite.
   */
  public demoSwitch(input: {
    userId?: unknown;
    role?: unknown;
  }): { token: string; user: User; expiresAt: number; jti: string } {
    if (!this.isDemoModeAllowed()) {
      throw new AppError(
        403,
        'DEMO_MODE_DISABLED',
        'Demo persona switching is disabled in production or when ENABLE_DEMO_IMPERSONATION is not enabled.'
      );
    }

    if (input.role !== undefined) {
      throw new AppError(
        400,
        'ROLE_SELECTION_FORBIDDEN',
        'Demo persona switch cannot specify a custom role; role is resolved from the database.'
      );
    }

    if (typeof input.userId !== 'string' || !input.userId.trim()) {
      throw new AppError(400, 'INVALID_DEMO_SWITCH_PAYLOAD', 'A valid demo userId is required.');
    }

    const user = this.userRepo.findById(input.userId.trim());
    if (!user || !user.isActive || !user.isDemoAccount) {
      throw new AppError(404, 'DEMO_USER_NOT_FOUND', 'Requested demo persona does not exist.');
    }

    return this.issueSessionWithinTx(user, 'AUTH_DEMO_SWITCH');
  }

  /**
   * Verifies a Bearer token's HMAC-SHA256 signature, issuer, audience, expiration,
   * active session jti in SQLite (not revoked), and returns the live User record from SQLite.
   */
  public verifyTokenAndResolveActor(
    token: string,
    nowSec = Math.floor(Date.now() / 1000)
  ): { user: User; claims: SessionTokenClaims } {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new AppError(401, 'MALFORMED_AUTH_TOKEN', 'Authentication token format is invalid.');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSigBuf = crypto
      .createHmac('sha256', this.secret)
      .update(signingInput, 'utf8')
      .digest();

    let providedSigBuf: Buffer;
    try {
      providedSigBuf = Buffer.from(signatureB64, 'base64url');
    } catch {
      throw new AppError(401, 'INVALID_TOKEN_SIGNATURE', 'Token signature encoding is invalid.');
    }

    if (
      providedSigBuf.length !== expectedSigBuf.length ||
      !crypto.timingSafeEqual(providedSigBuf, expectedSigBuf)
    ) {
      throw new AppError(
        401,
        'INVALID_TOKEN_SIGNATURE',
        'Token signature verification failed (tampered token or invalidated server secret).'
      );
    }

    let header: { alg?: string; typ?: string };
    let claims: SessionTokenClaims;
    try {
      header = JSON.parse(base64UrlDecodeToString(headerB64));
      claims = JSON.parse(base64UrlDecodeToString(payloadB64));
    } catch {
      throw new AppError(401, 'MALFORMED_AUTH_TOKEN', 'Token header or payload is not valid JSON.');
    }

    if (header.alg !== 'HS256' || header.typ !== 'MPAI-JWT') {
      throw new AppError(401, 'INVALID_TOKEN_HEADER', 'Unsupported token algorithm or type.');
    }

    if (claims.iss !== TOKEN_ISSUER || claims.aud !== TOKEN_AUDIENCE) {
      throw new AppError(
        401,
        'INVALID_TOKEN_CLAIMS',
        'Token issuer (iss) or audience (aud) validation failed.'
      );
    }

    if (typeof claims.exp !== 'number' || typeof claims.iat !== 'number' || !claims.jti || !claims.sub) {
      throw new AppError(401, 'INVALID_TOKEN_CLAIMS', 'Token is missing mandatory claims.');
    }

    if (nowSec >= claims.exp) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired.');
    }

    const session = this.sessionRepo.findByJti(claims.jti);
    if (!session) {
      throw new AppError(401, 'SESSION_NOT_FOUND', 'Token session is not registered on the server.');
    }

    if (session.revokedAt !== null) {
      throw new AppError(401, 'TOKEN_REVOKED', 'Authentication token has been revoked.');
    }

    const liveUser = this.userRepo.findById(claims.sub);
    if (!liveUser || !liveUser.isActive) {
      throw new AppError(401, 'ACTOR_INACTIVE_OR_MISSING', 'Authenticated user is no longer active.');
    }

    // Enforce live database role as single source of truth
    const resolvedRole: UserRole = liveUser.role;
    return {
      user: { ...liveUser, role: resolvedRole },
      claims: { ...claims, role: resolvedRole },
    };
  }

  public logout(jti: string, actor: User): void {
    const nowIso = new Date().toISOString();
    this.db.withTransaction(() => {
      const revoked = this.sessionRepo.revokeByJti(jti, 'USER_LOGOUT', nowIso);
      if (revoked) {
        this.auditSvc.appendWithinTx({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'AUTH_LOGOUT',
          entityType: 'AUTH_SESSION',
          entityId: jti,
          previousState: 'ACTIVE',
          newState: 'REVOKED',
          payload: { jti, userId: actor.id, reason: 'USER_LOGOUT' },
          timestamp: nowIso,
        });
      }
    });
  }
}
