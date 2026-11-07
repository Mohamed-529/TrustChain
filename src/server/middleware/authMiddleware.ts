import type { AuthService } from '../services/AuthService.ts';
import type { UserRole } from '../../types/domain.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
  type RequestHandler,
} from './errorHandler.ts';

export function createAuthMiddleware(authService: AuthService): RequestHandler {
  return function authenticateRequest(req: ApiRequest, _res: ApiResponse, next: NextFunction): void {
    try {
      const rawAuth = req.headers.authorization;
      const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (req.headers['x-actor-id']) {
          throw new AppError(
            401,
            'AUTH_TOKEN_REQUIRED',
            'Unsigned X-Actor-Id header authentication is forbidden. Provide a signed Bearer token.'
          );
        }
        throw new AppError(
          401,
          'AUTH_TOKEN_REQUIRED',
          'Missing or invalid Authorization Bearer header.'
        );
      }

      const token = authHeader.slice('Bearer '.length).trim();
      if (!token) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Bearer token is empty.');
      }

      const { user, claims } = authService.verifyTokenAndResolveActor(token);
      req.actor = user;
      req.tokenClaims = claims;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(allowedRoles: UserRole[]): RequestHandler {
  return function roleGuard(req: ApiRequest, _res: ApiResponse, next: NextFunction): void {
    if (!req.actor) {
      next(new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.'));
      return;
    }

    if (!allowedRoles.includes(req.actor.role)) {
      next(
        new AppError(
          403,
          'FORBIDDEN_ROLE',
          `Actor role '${req.actor.role}' is not authorized for this operation. Allowed roles: ${allowedRoles.join(', ')}.`,
          { actorId: req.actor.id, actorRole: req.actor.role, allowedRoles }
        )
      );
      return;
    }

    next();
  };
}
