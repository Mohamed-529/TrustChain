import { AppError, type RequestHandler } from './errorHandler.ts';

interface ClientWindow {
  count: number;
  windowStartMs: number;
}

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  skip?: (req: import('./errorHandler.ts').ApiRequest) => boolean;
}

/**
 * In-memory sliding-window rate limiter (Ponytail Rung 6 — pure native JS, zero Redis dependencies).
 * Protects endpoints against denial-of-service, credential stuffing, and brute force attempts.
 */
export class InMemoryRateLimiter {
  private readonly clients = new Map<string, ClientWindow>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly keyPrefix: string;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000; // 60 seconds default
    this.maxRequests = options.maxRequests ?? 120; // 120 req/min default
    this.keyPrefix = options.keyPrefix ?? 'rl';

    // Periodically prune expired windows to prevent memory leakage
    this.cleanupInterval = setInterval(() => this.cleanup(), Math.max(30_000, this.windowMs));
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public check(ip: string): { allowed: boolean; remaining: number; resetAfterSeconds: number } {
    const now = Date.now();
    const key = `${this.keyPrefix}:${ip}`;
    const window = this.clients.get(key);

    if (!window || now - window.windowStartMs >= this.windowMs) {
      this.clients.set(key, { count: 1, windowStartMs: now });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAfterSeconds: Math.ceil(this.windowMs / 1000),
      };
    }

    if (window.count >= this.maxRequests) {
      const resetAfterSeconds = Math.max(1, Math.ceil((window.windowStartMs + this.windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        resetAfterSeconds,
      };
    }

    window.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - window.count,
      resetAfterSeconds: Math.ceil((window.windowStartMs + this.windowMs - now) / 1000),
    };
  }

  public reset(): void {
    this.clients.clear();
  }

  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clients.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.clients.entries()) {
      if (now - window.windowStartMs >= this.windowMs) {
        this.clients.delete(key);
      }
    }
  }
}

/**
 * Creates an Express/ApiRequest handler enforcing rate limits.
 */
export function createRateLimiterMiddleware(limiter: InMemoryRateLimiter): RequestHandler {
  return (req, res, next) => {
    // Extract IP safely from headers or default to loopback
    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ??
      (req.headers['x-real-ip'] as string) ??
      '127.0.0.1';

    const result = limiter.check(ip);
    if (res.setHeader) {
      res.setHeader('X-RateLimit-Limit', String(limiter['maxRequests']));
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.resetAfterSeconds));
    }

    if (!result.allowed) {
      if (res.setHeader) {
        res.setHeader('Retry-After', String(result.resetAfterSeconds));
      }
      return next(
        new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          `Too many requests. Please wait ${result.resetAfterSeconds} seconds before retrying.`,
          { retryAfterSeconds: result.resetAfterSeconds }
        )
      );
    }

    next();
  };
}
