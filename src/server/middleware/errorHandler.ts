import type { SessionTokenClaims, User } from '../../types/domain.ts';

export interface ApiRequest {
  method: string;
  url: string;
  originalUrl: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: unknown;
  rawBody?: string;
  actor?: User;
  tokenClaims?: SessionTokenClaims;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(payload: unknown): void;
  sendText?(body: string, contentType?: string): void;
  sendFile?(filePath: string): void;
  headersSent?: boolean;
}

export type NextFunction = (err?: unknown) => void;
export type RequestHandler = (
  req: ApiRequest,
  res: ApiResponse,
  next: NextFunction
) => void | Promise<void>;

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler(
  err: unknown,
  _req: ApiRequest,
  res: ApiResponse,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
      details: {},
      timestamp: new Date().toISOString(),
    },
  });
}
