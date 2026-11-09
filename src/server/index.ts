import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AppDatabase } from './repositories/Database.ts';
import {
  ContractRepository,
  DisputeEvidencePackRepository,
  EvaluationRepository,
  EvidenceProvenanceRepository,
  EvidencePassportRepository,
  EvidenceRepository,
  GitHubWebhookEventRepository,
  HumanApprovalRepository,
  MilestoneRepository,
  PaymentTransactionRepository,
  ScheduleProposalRepository,
  SessionRepository,
  UserRepository,
  WebhookEventRepository,
} from './repositories/DomainRepositories.ts';
import { AuditService } from './services/AuditService.ts';
import { AuditReplayService } from './services/AuditReplayService.ts';
import {
  EvidencePassportService,
  type EvidencePassportServiceOptions,
} from './services/EvidencePassportService.ts';
import { AuthService, type AuthServiceOptions } from './services/AuthService.ts';
import { ContractService } from './services/ContractService.ts';
import { EvidenceService } from './services/EvidenceService.ts';
import {
  EvaluationService,
  type MultiAgentEvaluatorProvider,
} from './services/EvaluationService.ts';
import {
  GitHubVerificationService,
  type GitHubVerificationServiceOptions,
} from './services/GitHubVerificationService.ts';
import { SettlementPolicyService } from './services/SettlementPolicyService.ts';
import { HumanReviewService } from './services/HumanReviewService.ts';
import { ScheduleControlTowerService } from './services/ScheduleControlTowerService.ts';
import { PayPalService, type PayPalServiceOptions } from './services/PayPalService.ts';
import { AuthController } from './controllers/AuthController.ts';
import { ContractController } from './controllers/ContractController.ts';
import { EvidenceController } from './controllers/EvidenceController.ts';
import { ReviewController } from './controllers/ReviewController.ts';
import { ScheduleController } from './controllers/ScheduleController.ts';
import { PaymentController } from './controllers/PaymentController.ts';
import { DisputeController } from './controllers/DisputeController.ts';
import { DisputeEvidencePackService } from './services/DisputeEvidencePackService.ts';
import { createApiRouter, type RouteDefinition } from './routes/apiRoutes.ts';
import {
  AppError,
  errorHandler,
  type ApiRequest,
  type ApiResponse,
} from './middleware/errorHandler.ts';
import {
  InMemoryRateLimiter,
  type RateLimiterOptions,
} from './middleware/rateLimiter.ts';

// Load .env file using Node.js v24 native process.loadEnvFile if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
} catch {
  // Ignore .env load error if not present
}

export type HttpAppListener = (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => void;

export interface HttpApp extends HttpAppListener {
  useFallback(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): void;
}

function matchRoutePattern(
  routePattern: string,
  actualPath: string
): Record<string, string> | null {
  const routeParts = routePattern.split('/').filter(Boolean);
  const pathParts = actualPath.split('/').filter(Boolean);
  if (routeParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    const rPart = routeParts[i];
    const pPart = pathParts[i];
    if (rPart.startsWith(':')) {
      params[rPart.slice(1)] = decodeURIComponent(pPart);
    } else if (rPart !== pPart) {
      return null;
    }
  }
  return params;
}

async function readJsonBody(
  req: http.IncomingMessage
): Promise<{ parsed: unknown; rawText: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const maxBytes = 512 * 1024; // 512 KB

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds 512KB limit.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({ parsed: {}, rawText: '' });
        return;
      }
      const rawBufferText = Buffer.concat(chunks).toString('utf8');
      const trimmed = rawBufferText.trim();
      if (!trimmed) {
        resolve({ parsed: {}, rawText: rawBufferText });
        return;
      }
      try {
        resolve({ parsed: JSON.parse(trimmed), rawText: rawBufferText });
      } catch {
        reject(new AppError(400, 'INVALID_JSON_BODY', 'Request body is not valid JSON.'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

export interface RateLimitingConfig {
  disableRateLimiting?: boolean;
  generalLimit?: number;
  sensitiveLimit?: number;
  windowMs?: number;
}

export interface MountedHttpAppOptions {
  rateLimiter?: {
    general?: InMemoryRateLimiter;
    sensitive?: InMemoryRateLimiter;
    disabled?: boolean;
  };
}

function createMountedHttpApp(
  prefix: string,
  routes: RouteDefinition[],
  mountOptions?: MountedHttpAppOptions
): HttpApp {
  let fallbackHandler: ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null =
    null;

  const rateLimiterConfig = mountOptions?.rateLimiter;

  const listener = async (
    rawReq: http.IncomingMessage,
    rawRes: http.ServerResponse
  ): Promise<void> => {
    const method = (rawReq.method ?? 'GET').toUpperCase();
    const originalUrl = rawReq.url ?? '/';
    const parsedUrl = new URL(originalUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    // Standard HTTP Security Headers & CORS Preflight
    const responseHeaders: Record<string, string> = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '0',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'access-control-allow-origin': '*',
    };

    if (method === 'OPTIONS') {
      rawRes.writeHead(204, {
        ...responseHeaders,
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers':
          'Content-Type, Authorization, X-Request-Id, X-Forwarded-For, X-Real-IP',
        'access-control-max-age': '86400',
      });
      rawRes.end();
      return;
    }

    if (!pathname.startsWith(prefix)) {
      if (fallbackHandler) {
        fallbackHandler(rawReq, rawRes);
        return;
      }
      rawRes.writeHead(404, {
        ...responseHeaders,
        'content-type': 'application/json; charset=utf-8',
      });
      rawRes.end(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: `Resource '${pathname}' not found.`,
            details: {},
            timestamp: new Date().toISOString(),
          },
        })
      );
      return;
    }

    const subPath = pathname.slice(prefix.length) || '/';
    const query: Record<string, string | undefined> = {};
    for (const [k, v] of parsedUrl.searchParams.entries()) {
      query[k] = v;
    }

    // Correlation ID tracing (DEF-04)
    const incomingReqId = rawReq.headers['x-request-id'];
    const requestId =
      typeof incomingReqId === 'string' && incomingReqId.trim().length > 0
        ? incomingReqId.trim()
        : crypto.randomUUID();
    responseHeaders['x-request-id'] = requestId;

    // Client IP extraction
    const forwarded = rawReq.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ??
      (typeof rawReq.headers['x-real-ip'] === 'string'
        ? rawReq.headers['x-real-ip']
        : undefined) ??
      rawReq.socket?.remoteAddress ??
      '127.0.0.1';

    let statusCode = 200;
    const apiRes: ApiResponse = {
      headersSent: false,
      status(code: number) {
        statusCode = code;
        return apiRes;
      },
      setHeader(name: string, value: string) {
        responseHeaders[name.toLowerCase()] = value;
        return apiRes;
      },
      json(payload: unknown) {
        if (apiRes.headersSent || rawRes.writableEnded) {
          return;
        }
        apiRes.headersSent = true;
        const bodyStr = JSON.stringify(payload);
        rawRes.writeHead(statusCode, {
          ...responseHeaders,
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(bodyStr),
        });
        rawRes.end(bodyStr);
      },
      sendText(body: string, contentType = 'text/plain; charset=utf-8') {
        if (apiRes.headersSent || rawRes.writableEnded) {
          return;
        }
        apiRes.headersSent = true;
        rawRes.writeHead(statusCode, {
          ...responseHeaders,
          'content-type': contentType,
          'content-length': Buffer.byteLength(body),
        });
        rawRes.end(body);
      },
    };

    const apiReq: ApiRequest = {
      method,
      url: originalUrl,
      originalUrl,
      path: pathname,
      headers: rawReq.headers as Record<string, string | string[] | undefined>,
      params: {},
      query,
      body: {},
      requestId,
      clientIp,
    };

    // Abuse Resistance & Sliding-Window Rate Limiting (DEF-01)
    if (!rateLimiterConfig?.disabled) {
      if (rateLimiterConfig?.general) {
        const checkResult = rateLimiterConfig.general.check(clientIp);
        apiRes.setHeader?.('x-ratelimit-remaining', String(checkResult.remaining));
        apiRes.setHeader?.('x-ratelimit-reset', String(checkResult.resetAfterSeconds));

        if (!checkResult.allowed) {
          apiRes.setHeader?.('retry-after', String(checkResult.resetAfterSeconds));
          errorHandler(
            new AppError(
              429,
              'RATE_LIMIT_EXCEEDED',
              `API rate limit exceeded. Please wait ${checkResult.resetAfterSeconds} seconds before retrying.`,
              { retryAfterSeconds: checkResult.resetAfterSeconds }
            ),
            apiReq,
            apiRes,
            () => {}
          );
          return;
        }
      }

      // Stricter rate limits for sensitive authentication, payment, and webhook endpoints
      const isSensitivePath =
        subPath.startsWith('/auth/') ||
        subPath.includes('/paypal/') ||
        subPath.startsWith('/webhooks/');
      if (isSensitivePath && rateLimiterConfig?.sensitive) {
        const checkResult = rateLimiterConfig.sensitive.check(clientIp);
        if (!checkResult.allowed) {
          apiRes.setHeader?.('retry-after', String(checkResult.resetAfterSeconds));
          errorHandler(
            new AppError(
              429,
              'RATE_LIMIT_EXCEEDED',
              `Sensitive endpoint rate limit exceeded. Please wait ${checkResult.resetAfterSeconds} seconds before retrying.`,
              { retryAfterSeconds: checkResult.resetAfterSeconds }
            ),
            apiReq,
            apiRes,
            () => {}
          );
          return;
        }
      }
    }

    // Match route
    let matchedRoute: RouteDefinition | null = null;
    let matchedParams: Record<string, string> = {};
    for (const route of routes) {
      if (route.method === method) {
        const params = matchRoutePattern(route.pattern, subPath);
        if (params !== null) {
          matchedRoute = route;
          matchedParams = params;
          break;
        }
      }
    }

    if (!matchedRoute) {
      apiRes.status(404).json({
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: `API endpoint '${method} ${originalUrl}' does not exist.`,
          details: {},
          timestamp: new Date().toISOString(),
          requestId,
        },
      });
      return;
    }

    apiReq.params = matchedParams;

    try {
      if (method === 'POST' || method === 'PUT') {
        const { parsed, rawText } = await readJsonBody(rawReq);
        apiReq.body = parsed;
        apiReq.rawBody = rawText;
      }

      const handlers = matchedRoute.handlers;
      let idx = 0;

      const next = (err?: unknown): void => {
        if (err !== undefined) {
          errorHandler(err, apiReq, apiRes, () => {});
          return;
        }
        if (idx >= handlers.length || apiRes.headersSent) {
          return;
        }
        const currentHandler = handlers[idx++];
        try {
          const maybePromise = currentHandler(apiReq, apiRes, next);
          if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
            (maybePromise as Promise<void>).catch((asyncErr) => {
              errorHandler(asyncErr, apiReq, apiRes, () => {});
            });
          }
        } catch (syncErr) {
          errorHandler(syncErr, apiReq, apiRes, () => {});
        }
      };

      next();
    } catch (err) {
      errorHandler(err, apiReq, apiRes, () => {});
    }
  };

  const app = ((req: http.IncomingMessage, res: http.ServerResponse) => {
    void listener(req, res);
  }) as HttpApp;

  app.useFallback = (handler) => {
    fallbackHandler = handler;
  };

  return app;
}

export interface ServerContainer {
  app: HttpApp;
  db: AppDatabase;
  userRepo: UserRepository;
  sessionRepo: SessionRepository;
  contractRepo: ContractRepository;
  milestoneRepo: MilestoneRepository;
  evidenceRepo: EvidenceRepository;
  provenanceRepo: EvidenceProvenanceRepository;
  evaluationRepo: EvaluationRepository;
  approvalRepo: HumanApprovalRepository;
  proposalRepo: ScheduleProposalRepository;
  paymentRepo: PaymentTransactionRepository;
  webhookEventRepo: WebhookEventRepository;
  githubWebhookRepo: GitHubWebhookEventRepository;
  auditService: AuditService;
  auditReplayService: AuditReplayService;
  authService: AuthService;
  contractService: ContractService;
  evidenceService: EvidenceService;
  githubVerificationService: GitHubVerificationService;
  evaluationService: EvaluationService;
  settlementPolicyService: SettlementPolicyService;
  humanReviewService: HumanReviewService;
  scheduleControlTowerService: ScheduleControlTowerService;
  paypalService: PayPalService;
  passportRepo: EvidencePassportRepository;
  evidencePassportService: EvidencePassportService;
  disputePackRepo: DisputeEvidencePackRepository;
  disputeEvidencePackService: DisputeEvidencePackService;
  disputeController: DisputeController;
  rateLimiter: {
    general: InMemoryRateLimiter;
    sensitive: InMemoryRateLimiter;
  };
}

export function createServerApp(options?: {
  dbPath?: string;
  authOptions?: AuthServiceOptions;
  evaluatorProvider?: MultiAgentEvaluatorProvider;
  paypalOptions?: PayPalServiceOptions;
  githubOptions?: GitHubVerificationServiceOptions;
  passportOptions?: EvidencePassportServiceOptions;
  rateLimitOptions?: RateLimitingConfig;
}): ServerContainer {
  const db = new AppDatabase(options?.dbPath);
  const userRepo = new UserRepository(db.raw);
  const sessionRepo = new SessionRepository(db.raw);
  const milestoneRepo = new MilestoneRepository(db.raw);
  const contractRepo = new ContractRepository(db.raw, milestoneRepo);
  const evidenceRepo = new EvidenceRepository(db.raw);
  const provenanceRepo = new EvidenceProvenanceRepository(db.raw);
  const evaluationRepo = new EvaluationRepository(db.raw);
  const approvalRepo = new HumanApprovalRepository(db.raw);
  const proposalRepo = new ScheduleProposalRepository(db.raw, milestoneRepo);
  const paymentRepo = new PaymentTransactionRepository(db.raw);
  const webhookEventRepo = new WebhookEventRepository(db.raw);
  const githubWebhookRepo = new GitHubWebhookEventRepository(db.raw);
  const passportRepo = new EvidencePassportRepository(db.raw);
  const disputePackRepo = new DisputeEvidencePackRepository(db.raw);
  const auditService = new AuditService(db.raw);

  // In-memory sliding-window rate limiters (Ponytail Rung 6 — zero external Redis)
  const generalRateLimiter = new InMemoryRateLimiter({
    windowMs: options?.rateLimitOptions?.windowMs ?? 60_000,
    maxRequests: options?.rateLimitOptions?.generalLimit ?? 120,
    keyPrefix: 'rl_gen',
  });

  const sensitiveRateLimiter = new InMemoryRateLimiter({
    windowMs: options?.rateLimitOptions?.windowMs ?? 60_000,
    maxRequests: options?.rateLimitOptions?.sensitiveLimit ?? 30,
    keyPrefix: 'rl_sens',
  });

  const authService = new AuthService(
    db,
    userRepo,
    sessionRepo,
    auditService,
    options?.authOptions
  );

  const contractService = new ContractService(
    db,
    userRepo,
    contractRepo,
    milestoneRepo,
    auditService
  );

  const evidenceService = new EvidenceService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    auditService
  );

  const githubVerificationService = new GitHubVerificationService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    provenanceRepo,
    githubWebhookRepo,
    auditService,
    options?.githubOptions
  );

  const evaluationService = new EvaluationService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    evaluationRepo,
    auditService,
    options?.evaluatorProvider,
    githubVerificationService
  );

  const settlementPolicyService = new SettlementPolicyService(
    contractRepo,
    milestoneRepo
  );

  const humanReviewService = new HumanReviewService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    evaluationRepo,
    approvalRepo,
    settlementPolicyService,
    auditService,
    paymentRepo,
    provenanceRepo
  );

  const scheduleControlTowerService = new ScheduleControlTowerService(
    db,
    userRepo,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    evaluationRepo,
    approvalRepo,
    proposalRepo,
    auditService
  );

  const paypalService = new PayPalService(
    db,
    contractRepo,
    milestoneRepo,
    evaluationRepo,
    approvalRepo,
    paymentRepo,
    settlementPolicyService,
    auditService,
    {
      webhookEventRepo,
      ...options?.paypalOptions,
    }
  );

  const authController = new AuthController(authService);
  const auditReplayService = new AuditReplayService(
    db.raw,
    contractRepo,
    milestoneRepo
  );

  const contractController = new ContractController(
    contractService,
    userRepo,
    auditService,
    auditReplayService
  );
  const evidencePassportService = new EvidencePassportService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    provenanceRepo,
    evaluationRepo,
    approvalRepo,
    passportRepo,
    auditService,
    githubVerificationService,
    options?.passportOptions
  );

  const evidenceController = new EvidenceController(
    evidenceService,
    evaluationService,
    githubVerificationService,
    evidencePassportService,
    contractRepo,
    milestoneRepo
  );
  const reviewController = new ReviewController(humanReviewService);
  const scheduleController = new ScheduleController(
    scheduleControlTowerService,
    evidenceService,
    evaluationService,
    humanReviewService
  );
  const paymentController = new PaymentController(paypalService);

  const disputeEvidencePackService = new DisputeEvidencePackService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    provenanceRepo,
    evidencePassportService,
    passportRepo,
    evaluationRepo,
    approvalRepo,
    paymentRepo,
    auditService,
    auditReplayService,
    disputePackRepo
  );
  const disputeController = new DisputeController(
    disputeEvidencePackService,
    contractRepo,
    milestoneRepo
  );

  const apiRouter = createApiRouter({
    authService,
    authController,
    contractController,
    evidenceController,
    reviewController,
    scheduleController,
    paymentController,
    disputeController,
    db,
  });

  const app = createMountedHttpApp('/api/v1', apiRouter.routes, {
    rateLimiter: {
      general: generalRateLimiter,
      sensitive: sensitiveRateLimiter,
      disabled: options?.rateLimitOptions?.disableRateLimiting,
    },
  });

  return {
    app,
    db,
    userRepo,
    sessionRepo,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    provenanceRepo,
    evaluationRepo,
    approvalRepo,
    proposalRepo,
    paymentRepo,
    webhookEventRepo,
    githubWebhookRepo,
    auditService,
    auditReplayService,
    authService,
    contractService,
    evidenceService,
    githubVerificationService,
    evaluationService,
    settlementPolicyService,
    humanReviewService,
    scheduleControlTowerService,
    paypalService,
    passportRepo,
    evidencePassportService,
    disputePackRepo,
    disputeEvidencePackService,
    disputeController,
    rateLimiter: {
      general: generalRateLimiter,
      sensitive: sensitiveRateLimiter,
    },
  };
}

export function createProductionStaticFallback(distPath: string) {
  const resolvedDistPath = path.resolve(distPath);
  return (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(parsedUrl.pathname);
    } catch {
      decodedPath = parsedUrl.pathname;
    }
    const normalizedPath = path.normalize(decodedPath);
    const safeRelativePath = normalizedPath.replace(/^([./\\])+/, '');
    const targetFilePath = path.resolve(resolvedDistPath, safeRelativePath);

    // Prevent directory traversal outside distPath
    const isContained =
      targetFilePath === resolvedDistPath ||
      targetFilePath.startsWith(resolvedDistPath + path.sep);
    if (!isContained) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Access denied.' } }));
      return;
    }

    if (fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).isFile()) {
      const ext = path.extname(targetFilePath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
      };
      const contentType = contentTypes[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': contentType });
      fs.createReadStream(targetFilePath).pipe(res);
      return;
    }

    // Missing assets under /assets/ or any path requesting a file with an extension must return 404
    const hasExtension = Boolean(path.extname(safeRelativePath));
    const isAssetPath =
      parsedUrl.pathname.startsWith('/assets/') || parsedUrl.pathname === '/assets';
    if (isAssetPath || hasExtension) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          error: {
            code: 'STATIC_ASSET_NOT_FOUND',
            message: `Static asset not found: ${req.url}`,
          },
        })
      );
      return;
    }

    // Unknown client-side application SPA route fallback
    const indexHtmlPath = path.join(resolvedDistPath, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      const html = fs.readFileSync(indexHtmlPath, 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: `Not found: ${req.url}` } }));
  };
}

async function startDevOrProdServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';
  const { app, db } = createServerApp({
    authOptions: {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      enableDemoImpersonation:
        process.env.ENABLE_DEMO_IMPERSONATION !== undefined
          ? process.env.ENABLE_DEMO_IMPERSONATION === 'true'
          : !isProd,
    },
  });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(__dirname, '../..');

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.useFallback((req, res) => {
        vite.middlewares(req, res);
      });
    } catch {
      // When node_modules/vite is not yet installed, serve index.html on root requests
      app.useFallback((req, res) => {
        const indexHtmlPath = path.join(rootDir, 'index.html');
        if ((req.url === '/' || req.url === '/index.html') && fs.existsSync(indexHtmlPath)) {
          const html = fs.readFileSync(indexHtmlPath, 'utf8');
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: {
              code: 'FRONTEND_ASSET_NOT_BUILT',
              message: `Vite middleware unavailable (node_modules not installed) for path '${req.url}'.`,
            },
          })
        );
      });
    }
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.useFallback(createProductionStaticFallback(distPath));
  }

  const server = http.createServer(app);
  server.listen(port, '0.0.0.0', () => {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
    const isWebhookConfigured = Boolean(
      webhookId && webhookId !== 'YOUR_PAYPAL_WEBHOOK_ID'
    );
    console.log(`MilestoneProof AI server listening on http://localhost:${port}`);
    console.log(
      `PayPal Webhook verification: ${
        isWebhookConfigured
          ? `CONFIGURED (Webhook ID: ${webhookId!.slice(0, 4)}***)`
          : 'UNCONFIGURED (missing PAYPAL_WEBHOOK_ID)'
      }`
    );
  });

  // Graceful Process Termination (DEF-06)
  const shutdown = (signal: string): void => {
    console.log(`Received ${signal}. Gracefully stopping MilestoneProof AI server...`);
    server.close(() => {
      console.log('HTTP connection pool closed.');
      try {
        db.checkpointWal('TRUNCATE');
        console.log('SQLite WAL successfully checkpointed (TRUNCATE).');
        db.close();
        console.log('SQLite database connection cleanly closed.');
      } catch (err) {
        console.error('Error during database shutdown checkpoint:', err);
      }
      process.exit(0);
    });

    // Forced termination fallback if active connections stall
    setTimeout(() => {
      console.error('Forced termination triggered after 10s shutdown timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  startDevOrProdServer().catch((err) => {
    console.error('Failed to start MilestoneProof AI server:', err);
    process.exit(1);
  });
}
