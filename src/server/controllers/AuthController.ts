import type { AuthService } from '../services/AuthService.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
} from '../middleware/errorHandler.ts';

export class AuthController {
  private readonly authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  public login = async (req: ApiRequest, res: ApiResponse, next: NextFunction): Promise<void> => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await this.authService.login(body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public demoSwitch = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = this.authService.demoSwitch(body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public me = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor || !req.tokenClaims) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Not authenticated.');
      }
      res.status(200).json({
        user: req.actor,
        session: {
          jti: req.tokenClaims.jti,
          issuedAt: req.tokenClaims.iat,
          expiresAt: req.tokenClaims.exp,
          issuer: req.tokenClaims.iss,
          audience: req.tokenClaims.aud,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  public logout = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor || !req.tokenClaims) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Not authenticated.');
      }
      this.authService.logout(req.tokenClaims.jti, req.actor);
      res.status(200).json({
        status: 'revoked',
        jti: req.tokenClaims.jti,
      });
    } catch (err) {
      next(err);
    }
  };
}
