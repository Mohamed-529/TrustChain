import type { PayPalService } from '../services/PayPalService.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
} from '../middleware/errorHandler.ts';

export class PaymentController {
  private readonly paypalService: PayPalService;

  constructor(paypalService: PayPalService) {
    this.paypalService = paypalService;
  }

  private getPayPalRequestId(req: ApiRequest): string | undefined {
    const raw =
      req.headers['paypal-request-id'] ??
      req.headers['PayPal-Request-Id'] ??
      req.headers['idempotency-key'];
    return Array.isArray(raw) ? raw[0] : raw;
  }

  public createOrder = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const transaction = await this.paypalService.createOrder(
        req.actor,
        req.params.id,
        this.getPayPalRequestId(req)
      );
      res.status(201).json({ transaction });
    } catch (err) {
      next(err);
    }
  };

  public authorizeOrder = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as { paypalOrderId?: string })
          : undefined;
      const transaction = await this.paypalService.authorizeOrder(
        req.actor,
        req.params.id,
        this.getPayPalRequestId(req),
        body
      );
      res.status(200).json({ transaction });
    } catch (err) {
      next(err);
    }
  };

  public captureAuthorization = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const transaction = await this.paypalService.captureAuthorization(
        req.actor,
        req.params.id,
        this.getPayPalRequestId(req)
      );
      res.status(200).json({ transaction });
    } catch (err) {
      next(err);
    }
  };

  public listTransactions = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      const transactions = this.paypalService.listTransactionsByMilestone(
        req.params.id
      );
      res.status(200).json({ transactions });
    } catch (err) {
      next(err);
    }
  };

  public handleWebhook = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      const transmissionId = req.headers['paypal-transmission-id'];
      console.log(`[PayPal Webhook Inbound] Received POST /api/v1/webhooks/paypal (transmission-id: ${transmissionId})`);
      const payload = req.rawBody ?? req.body;
      const result = await this.paypalService.handleWebhook(req.headers, payload);
      console.log(`[PayPal Webhook Result] Event ${result.eventId} processed: status=${result.status}, verified=${result.verified}`);
      res.status(200).json(result);
    } catch (err) {
      console.error(`[PayPal Webhook Error]`, err instanceof Error ? err.message : String(err));
      next(err);
    }
  };

  public reconcilePayment = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const report = await this.paypalService.reconcilePayment(
        req.actor,
        req.params.id
      );
      res.status(200).json({ reconciliation: report });
    } catch (err) {
      next(err);
    }
  };

  public getOrderDetails = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const orderDetails = await this.paypalService.getOrderDetails(
        req.actor,
        req.params.id
      );
      res.status(200).json({ orderDetails });
    } catch (err) {
      next(err);
    }
  };
}
