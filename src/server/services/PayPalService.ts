import crypto from 'node:crypto';
import type {
  PayPalReconciliationOutcome,
  PayPalReconciliationReport,
  PayPalTransactionRecord,
  PayPalWebhookEventRecord,
  PayPalWebhookProcessingStatus,
  PayPalWebhookVerificationStatus,
  User,
} from '../../types/domain.ts';
import type { AppDatabase } from '../repositories/Database.ts';
import type {
  ContractRepository,
  EvaluationRepository,
  HumanApprovalRepository,
  MilestoneRepository,
  PaymentTransactionRepository,
  WebhookEventRepository,
} from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import type { SettlementPolicyService } from './SettlementPolicyService.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const PAYPAL_NON_ESCROW_DISCLOSURE =
  'PayPal Orders API v2 (intent: AUTHORIZE) places a temporary payment authorization hold (3-day honor period, up to 29-day validity window) and is NOT a regulated custodial escrow service.';

export interface PayPalServiceOptions {
  fetchImpl?: typeof fetch;
  clientId?: string;
  clientSecret?: string;
  webhookId?: string;
  apiBaseUrl?: string;
  webhookEventRepo?: WebhookEventRepository;
  beforeWebhookReconcileHook?: (eventId: string, eventType: string) => void;
}

/**
 * Primary Sponsor Integration B — APIMatic & PayPal Orders API v2 Settlement Engine.
 *
 * Grounded in the official PayPal Server SDK (`@paypal/paypal-server-sdk`) / APIMatic
 * Orders v2 & Payments v2 models:
 * - `POST /v2/checkout/orders` (`intent: "AUTHORIZE"`)
 * - `POST /v2/checkout/orders/{id}/authorize`
 * - `POST /v2/payments/authorizations/{authorization_id}/capture`
 * - `POST /v1/notifications/verify-webhook-signature`
 *
 * Financial Safety Rules Enforced:
 * 1. AI agents NEVER invoke this service or determine payable amounts.
 * 2. Every mutation requires a deterministic `PayPal-Request-Id` idempotency header.
 * 3. `captureAuthorization` strictly requires a persisted `HUMAN_APPROVAL` record with
 *    `decision === 'APPROVE'` and re-verifies `0 < approvedAmountCents <= permittedAmountCents <= authorizedAmountCents`.
 * 4. Supports live PayPal Developer Sandbox REST calls when `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`
 *    are configured, and falls back to a clearly labeled deterministic Sandbox Simulation (`SANDBOX_SIMULATION`)
 *    when credentials are absent.
 */
export class PayPalService {
  private readonly db: AppDatabase;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly evaluationRepo: EvaluationRepository;
  private readonly approvalRepo: HumanApprovalRepository;
  private readonly paymentRepo: PaymentTransactionRepository;
  private readonly settlementPolicyService: SettlementPolicyService;
  private readonly auditService: AuditService;
  private readonly options?: PayPalServiceOptions;
  private readonly activeWebhookLocks = new Set<string>();

  constructor(
    db: AppDatabase,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    evaluationRepo: EvaluationRepository,
    approvalRepo: HumanApprovalRepository,
    paymentRepo: PaymentTransactionRepository,
    settlementPolicyService: SettlementPolicyService,
    auditService: AuditService,
    options?: PayPalServiceOptions
  ) {
    this.db = db;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.evaluationRepo = evaluationRepo;
    this.approvalRepo = approvalRepo;
    this.paymentRepo = paymentRepo;
    this.settlementPolicyService = settlementPolicyService;
    this.auditService = auditService;
    this.options = options;
  }

  private getFetch(): typeof fetch {
    return this.options?.fetchImpl ?? fetch;
  }

  private getClientId(): string | undefined {
    return this.options?.clientId ?? process.env.PAYPAL_CLIENT_ID;
  }

  private getClientSecret(): string | undefined {
    return this.options?.clientSecret ?? process.env.PAYPAL_CLIENT_SECRET;
  }

  private getWebhookId(): string | undefined {
    return this.options?.webhookId ?? process.env.PAYPAL_WEBHOOK_ID;
  }

  private getApiBaseUrl(): string {
    return (
      this.options?.apiBaseUrl ??
      process.env.PAYPAL_API_BASE_URL ??
      'https://api-m.sandbox.paypal.com'
    ).replace(/\/$/, '');
  }

  public isLivePayPalConfigured(): boolean {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    return Boolean(
      clientId &&
        clientSecret &&
        clientId !== 'YOUR_PAYPAL_SANDBOX_CLIENT_ID'
    );
  }

  public isWebhookVerificationConfigured(): boolean {
    const webhookId = this.getWebhookId();
    return Boolean(
      this.isLivePayPalConfigured() &&
        webhookId &&
        webhookId.trim().length > 0 &&
        webhookId !== 'YOUR_PAYPAL_WEBHOOK_ID'
    );
  }

  private validateIdempotencyKey(rawKey: string | undefined): string {
    const key = String(rawKey ?? '').trim();
    if (key.length < 8 || key.length > 128) {
      throw new AppError(
        400,
        'MISSING_PAYPAL_REQUEST_ID',
        'A valid PayPal-Request-Id header (8-128 characters) is mandatory for idempotent payment operations.'
      );
    }
    return key;
  }

  private centsToUsdString(cents: number): string {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new AppError(400, 'INVALID_MONETARY_CENTS', 'Monetary amount must be non-negative integer cents.');
    }
    return (cents / 100).toFixed(2);
  }

  private async getLivePayPalAccessToken(): Promise<string> {
    const clientId = this.getClientId()!;
    const secret = this.getClientSecret()!;
    const baseUrl = this.getApiBaseUrl();
    const basicAuth = Buffer.from(`${clientId}:${secret}`).toString('base64');

    let res: Response;
    try {
      res = await this.getFetch()(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch {
      throw new AppError(
        503,
        'PAYPAL_SERVICE_UNAVAILABLE',
        'PayPal Sandbox OAuth2 endpoint is unreachable.'
      );
    }

    if (!res.ok) {
      throw new AppError(
        422,
        'PAYPAL_OAUTH_FAILED',
        `PayPal Sandbox OAuth2 token exchange failed with HTTP ${res.status}.`
      );
    }

    let data: { access_token?: string };
    try {
      data = (await res.json()) as { access_token?: string };
    } catch {
      throw new AppError(
        422,
        'MALFORMED_PAYPAL_OAUTH_RESPONSE',
        'PayPal Sandbox OAuth2 response was not valid JSON.'
      );
    }
    if (!data?.access_token || typeof data.access_token !== 'string') {
      throw new AppError(
        422,
        'MALFORMED_PAYPAL_OAUTH_RESPONSE',
        'PayPal Sandbox OAuth2 response is missing access_token.'
      );
    }
    return data.access_token;
  }

  /**
   * Parses and validates the authoritative authorization ID (`purchase_units[0].payments.authorizations[0].id`)
   * and optional expiration time from a live PayPal Orders API v2 `/authorize` response.
   * Never falls back to a synthetic authorization ID.
   */
  public extractLiveAuthorizationFromOrderResponse(rawAuthResponse: unknown): {
    paypalOrderId?: string;
    paypalAuthorizationId: string;
    expirationTimeIso?: string;
  } {
    if (!rawAuthResponse || typeof rawAuthResponse !== 'object' || Array.isArray(rawAuthResponse)) {
      throw new AppError(
        422,
        'MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE',
        'PayPal Order authorize response is not a valid JSON object.'
      );
    }

    const respObj = rawAuthResponse as Record<string, unknown>;
    const purchaseUnits = respObj.purchase_units;
    if (!Array.isArray(purchaseUnits) || purchaseUnits.length === 0) {
      throw new AppError(
        422,
        'MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE',
        'PayPal Order authorize response is missing purchase_units[].'
      );
    }

    const firstUnit = purchaseUnits[0] as Record<string, unknown> | undefined;
    const payments =
      firstUnit && typeof firstUnit.payments === 'object' && firstUnit.payments !== null
        ? (firstUnit.payments as Record<string, unknown>)
        : null;
    const authorizations = payments && Array.isArray(payments.authorizations)
      ? payments.authorizations
      : null;

    if (!authorizations || authorizations.length === 0) {
      throw new AppError(
        422,
        'MISSING_PAYPAL_AUTHORIZATION_ID',
        'PayPal Order authorize response does not contain purchase_units[0].payments.authorizations[0].'
      );
    }

    const firstAuth = authorizations[0] as Record<string, unknown> | undefined;
    const authId = typeof firstAuth?.id === 'string' ? firstAuth.id.trim() : '';
    if (!authId) {
      throw new AppError(
        422,
        'MISSING_PAYPAL_AUTHORIZATION_ID',
        'PayPal Order authorize response returned an empty or missing authorization id.'
      );
    }

    const authStatus = typeof firstAuth?.status === 'string' ? firstAuth.status.toUpperCase() : '';
    if (authStatus === 'DENIED' || authStatus === 'VOIDED' || authStatus === 'EXPIRED') {
      throw new AppError(
        422,
        'PAYPAL_AUTHORIZATION_NOT_ACTIVE',
        `PayPal Authorization '${authId}' was returned in non-active status '${authStatus}'.`
      );
    }

    const expirationTimeIso =
      typeof firstAuth?.expiration_time === 'string' && firstAuth.expiration_time.trim().length > 0
        ? firstAuth.expiration_time.trim()
        : undefined;

    const paypalOrderId =
      typeof respObj.id === 'string' && respObj.id.trim().length > 0
        ? respObj.id.trim()
        : undefined;

    return {
      paypalOrderId,
      paypalAuthorizationId: authId,
      expirationTimeIso,
    };
  }

  /**
   * Step 1: Create a PayPal Order (`intent: "AUTHORIZE"`) for a contract milestone (`CLIENT` only).
   */
  public async createOrder(
    actor: User,
    milestoneId: string,
    paypalRequestIdHeader: string | undefined
  ): Promise<PayPalTransactionRecord> {
    const idempotencyKey = this.validateIdempotencyKey(paypalRequestIdHeader);

    // Idempotent replay check
    const existingByKey = this.paymentRepo.findByIdempotencyKey(idempotencyKey);
    if (existingByKey) {
      if (existingByKey.milestoneId !== milestoneId) {
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSE_CONFLICT',
          `PayPal-Request-Id '${idempotencyKey}' was already used for a different milestone.`
        );
      }
      return existingByKey;
    }

    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }

    const contract = this.contractRepo.findById(milestone.contractId);
    if (!contract) {
      throw new AppError(
        404,
        'CONTRACT_NOT_FOUND',
        `Contract '${milestone.contractId}' was not found.`
      );
    }

    if (actor.role !== 'CLIENT' || actor.id !== contract.clientId) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_CONTRACT_CLIENT',
        'Only the designated contract CLIENT may create a PayPal Order.'
      );
    }

    if (
      milestone.paymentStatus === 'CAPTURED' ||
      milestone.paymentStatus === 'SIMULATED_CAPTURED' ||
      milestone.paymentStatus === 'SIMULATED_PARTIALLY_CAPTURED' ||
      milestone.status === 'SETTLED'
    ) {
      throw new AppError(
        409,
        'MILESTONE_ALREADY_SETTLED',
        `Milestone '${milestoneId}' has already been settled.`
      );
    }

    const amountUsd = this.centsToUsdString(milestone.agreedAmountCents);
    const nowIso = new Date().toISOString();
    const isLive = this.isLivePayPalConfigured();

    let paypalOrderId = `ORD-MPAI-${crypto.createHash('sha256').update(`${milestoneId}:${idempotencyKey}`).digest('hex').slice(0, 12).toUpperCase()}`;
    let rawPaypalResponse: Record<string, unknown> = {
      id: paypalOrderId,
      intent: 'AUTHORIZE',
      status: 'CREATED',
      purchase_units: [
        {
          reference_id: milestone.id,
          custom_id: contract.id,
          description: `${contract.title} — ${milestone.title}`,
          amount: {
            currency_code: 'USD',
            value: amountUsd,
          },
        },
      ],
      create_time: nowIso,
      nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
    };

    if (isLive) {
      const token = await this.getLivePayPalAccessToken();
      const baseUrl = this.getApiBaseUrl();
      const orderRes = await this.getFetch()(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': idempotencyKey,
        },
        body: JSON.stringify({
          intent: 'AUTHORIZE',
          purchase_units: [
            {
              reference_id: milestone.id,
              custom_id: contract.id,
              description: `${contract.title} — ${milestone.title}`.slice(0, 127),
              amount: {
                currency_code: 'USD',
                value: amountUsd,
              },
            },
          ],
        }),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new AppError(
          422,
          'PAYPAL_ORDER_CREATE_FAILED',
          `PayPal Orders API v2 returned HTTP ${orderRes.status}: ${errText}`
        );
      }
      let orderJson: Record<string, unknown>;
      try {
        orderJson = (await orderRes.json()) as Record<string, unknown>;
      } catch {
        throw new AppError(
          422,
          'MALFORMED_PAYPAL_ORDER_RESPONSE',
          'PayPal Orders API v2 createOrder response was not valid JSON.'
        );
      }
      const liveOrderId = typeof orderJson?.id === 'string' ? orderJson.id.trim() : '';
      if (!liveOrderId) {
        throw new AppError(
          422,
          'MISSING_PAYPAL_ORDER_ID',
          'PayPal Orders API v2 response is missing a valid order id.'
        );
      }
      paypalOrderId = liveOrderId;
      rawPaypalResponse = orderJson;
    }

    const orderStatus = isLive ? 'ORDER_CREATED' : 'SIMULATED_ORDER_CREATED';

    return this.db.withTransaction(() => {
      const txRecord: PayPalTransactionRecord = {
        id: `ptx_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
        milestoneId: milestone.id,
        approvalId: null,
        paypalOrderId,
        paypalAuthorizationId: null,
        paypalCaptureId: null,
        idempotencyKey,
        authorizedAmountCents: milestone.agreedAmountCents,
        capturedAmountCents: 0,
        currency: 'USD',
        status: orderStatus,
        executionMode: isLive ? 'PAYPAL_SANDBOX' : 'SANDBOX_SIMULATION',
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        authExpiresAt: null,
        rawPaypalResponse,
        updatedAt: nowIso,
      };

      this.paymentRepo.insert(txRecord);
      this.milestoneRepo.updatePaymentStatus(milestone.id, orderStatus, null, nowIso);

      this.auditService.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: isLive ? 'PAYPAL_ORDER_CREATED' : 'PAYPAL_SIMULATED_ORDER_CREATED',
        entityType: 'PAYMENT',
        entityId: txRecord.id,
        contractId: contract.id,
        milestoneId: milestone.id,
        previousState: milestone.paymentStatus,
        newState: orderStatus,
        payload: {
          paypalOrderId,
          intent: 'AUTHORIZE',
          authorizedAmountCents: milestone.agreedAmountCents,
          idempotencyKey,
          executionMode: txRecord.executionMode,
          nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        },
        timestamp: nowIso,
      });

      return txRecord;
    });
  }

  /**
   * Step 2: Authorize the PayPal Order (`POST /v2/checkout/orders/{id}/authorize`, `CLIENT` only).
   * Records `paypalAuthorizationId` and the 29-day authorization validity expiry (`authExpiresAt`).
   */
  public async authorizeOrder(
    actor: User,
    milestoneId: string,
    paypalRequestIdHeader: string | undefined,
    body?: { paypalOrderId?: string }
  ): Promise<PayPalTransactionRecord> {
    const idempotencyKey = this.validateIdempotencyKey(paypalRequestIdHeader);

    const existingByKey = this.paymentRepo.findByIdempotencyKey(idempotencyKey);
    if (existingByKey) {
      if (existingByKey.milestoneId !== milestoneId) {
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSE_CONFLICT',
          `PayPal-Request-Id '${idempotencyKey}' was already used for a different milestone.`
        );
      }
      return existingByKey;
    }

    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }

    const contract = this.contractRepo.findById(milestone.contractId);
    if (!contract) {
      throw new AppError(
        404,
        'CONTRACT_NOT_FOUND',
        `Contract '${milestone.contractId}' was not found.`
      );
    }

    if (actor.role !== 'CLIENT' || actor.id !== contract.clientId) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_CONTRACT_CLIENT',
        'Only the designated contract CLIENT may authorize a PayPal Order.'
      );
    }

    const latestTx = this.paymentRepo.findLatestByMilestoneId(milestoneId);
    const targetOrderId = body?.paypalOrderId?.trim() || latestTx?.paypalOrderId;
    if (!targetOrderId) {
      throw new AppError(
        400,
        'PAYPAL_ORDER_REQUIRED_BEFORE_AUTHORIZE',
        `No PayPal Order exists for milestone '${milestoneId}'. Create an order first.`
      );
    }

    if (
      latestTx &&
      (latestTx.status === 'CAPTURED' ||
        latestTx.status === 'PARTIALLY_CAPTURED_VOIDED' ||
        latestTx.status === 'SIMULATED_CAPTURED' ||
        latestTx.status === 'SIMULATED_PARTIALLY_CAPTURED')
    ) {
      throw new AppError(
        409,
        'PAYPAL_ORDER_ALREADY_CAPTURED',
        `Milestone '${milestoneId}' payment is already captured.`
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    // PayPal authorization validity window is 29 days
    let expiresAtIso = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000).toISOString();
    const isLive = this.isLivePayPalConfigured();

    let persistedOrderId = targetOrderId;
    let paypalAuthorizationId: string;
    let rawAuthResponse: Record<string, unknown>;

    if (isLive) {
      const token = await this.getLivePayPalAccessToken();
      const baseUrl = this.getApiBaseUrl();
      const authRes = await this.getFetch()(
        `${baseUrl}/v2/checkout/orders/${encodeURIComponent(targetOrderId)}/authorize`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': idempotencyKey,
          },
          body: JSON.stringify({}),
        }
      );

      if (!authRes.ok) {
        const errText = await authRes.text();
        throw new AppError(
          422,
          'PAYPAL_ORDER_AUTHORIZE_FAILED',
          `PayPal Order authorize returned HTTP ${authRes.status}: ${errText}`
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = await authRes.json();
      } catch {
        throw new AppError(
          422,
          'MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE',
          'PayPal Order authorize response was not valid JSON.'
        );
      }

      const extracted = this.extractLiveAuthorizationFromOrderResponse(parsedJson);
      paypalAuthorizationId = extracted.paypalAuthorizationId;
      if (extracted.paypalOrderId) {
        persistedOrderId = extracted.paypalOrderId;
      }
      if (extracted.expirationTimeIso) {
        expiresAtIso = extracted.expirationTimeIso;
      }
      rawAuthResponse = parsedJson as Record<string, unknown>;
    } else {
      paypalAuthorizationId = `AUTH-MPAI-${crypto
        .createHash('sha256')
        .update(`${targetOrderId}:${idempotencyKey}`)
        .digest('hex')
        .slice(0, 12)
        .toUpperCase()}`;
      rawAuthResponse = {
        id: targetOrderId,
        status: 'COMPLETED',
        purchase_units: [
          {
            reference_id: milestone.id,
            payments: {
              authorizations: [
                {
                  id: paypalAuthorizationId,
                  status: 'CREATED',
                  amount: {
                    currency_code: 'USD',
                    value: this.centsToUsdString(milestone.agreedAmountCents),
                  },
                  expiration_time: expiresAtIso,
                  create_time: nowIso,
                },
              ],
            },
          },
        ],
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
      };
    }

    const authStatus = isLive ? 'AUTHORIZED' : 'SIMULATED_AUTHORIZED';

    return this.db.withTransaction(() => {
      const txRecord: PayPalTransactionRecord = {
        id: `ptx_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
        milestoneId: milestone.id,
        approvalId: null,
        paypalOrderId: persistedOrderId,
        paypalAuthorizationId,
        paypalCaptureId: null,
        idempotencyKey,
        authorizedAmountCents: milestone.agreedAmountCents,
        capturedAmountCents: 0,
        currency: 'USD',
        status: authStatus,
        executionMode: isLive ? 'PAYPAL_SANDBOX' : 'SANDBOX_SIMULATION',
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        authExpiresAt: expiresAtIso,
        rawPaypalResponse: rawAuthResponse,
        updatedAt: nowIso,
      };

      this.paymentRepo.insert(txRecord);
      this.milestoneRepo.updatePaymentStatus(milestone.id, authStatus, null, nowIso);

      this.auditService.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: isLive ? 'PAYPAL_ORDER_AUTHORIZED' : 'PAYPAL_SIMULATED_ORDER_AUTHORIZED',
        entityType: 'PAYMENT',
        entityId: txRecord.id,
        contractId: contract.id,
        milestoneId: milestone.id,
        previousState: milestone.paymentStatus,
        newState: authStatus,
        payload: {
          paypalOrderId: persistedOrderId,
          paypalAuthorizationId,
          authorizedAmountCents: milestone.agreedAmountCents,
          authExpiresAt: expiresAtIso,
          idempotencyKey,
          executionMode: txRecord.executionMode,
        },
        timestamp: nowIso,
      });

      return txRecord;
    });
  }

  /**
   * Step 3: Capture a human-approved settlement against a PayPal Authorization
   * (`POST /v2/payments/authorizations/{authorization_id}/capture`).
   *
   * Strict Financial Guards:
   * - Only `REVIEWER` or `CLIENT` (`actor.id !== contract.developerId`) can capture.
   * - Requires a persisted `HUMAN_APPROVAL` record with `decision === 'APPROVE'`.
   * - Re-calculates deterministic policy cap and verifies:
   *   `0 < approvedAmountCents <= permittedAmountCents <= authorizedAmountCents`.
   * - Verifies authorization has not expired (`authExpiresAt > now`).
   * - Enforces idempotency via `PayPal-Request-Id`.
   */
  public async captureAuthorization(
    actor: User,
    milestoneId: string,
    paypalRequestIdHeader: string | undefined
  ): Promise<PayPalTransactionRecord> {
    const idempotencyKey = this.validateIdempotencyKey(paypalRequestIdHeader);

    // 1. Idempotent replay check
    const existingByKey = this.paymentRepo.findByIdempotencyKey(idempotencyKey);
    if (existingByKey) {
      if (existingByKey.milestoneId !== milestoneId) {
        throw new AppError(
          409,
          'IDEMPOTENCY_KEY_REUSE_CONFLICT',
          `PayPal-Request-Id '${idempotencyKey}' was already used for a different milestone.`
        );
      }
      return existingByKey;
    }

    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }

    const contract = this.contractRepo.findById(milestone.contractId);
    if (!contract) {
      throw new AppError(
        404,
        'CONTRACT_NOT_FOUND',
        `Contract '${milestone.contractId}' was not found.`
      );
    }

    // 2. Role & Separation-of-Duties Enforcement
    if (actor.role === 'DEVELOPER' || actor.id === contract.developerId) {
      throw new AppError(
        403,
        'CAPTURE_FORBIDDEN_FOR_DEVELOPER',
        `Separation-of-duties violation: Developer '${actor.id}' can never capture milestone payments.`
      );
    }

    if (actor.role !== 'REVIEWER' && actor.role !== 'CLIENT') {
      throw new AppError(
        403,
        'FORBIDDEN_ROLE',
        'Only authorized REVIEWER or CLIENT roles may capture milestone payments.'
      );
    }

    if (actor.id !== contract.reviewerId && actor.id !== contract.clientId) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_CONTRACT_FIDUCIARY',
        `Actor '${actor.id}' is not authorized to capture payments for contract '${contract.id}'.`
      );
    }

    // 3. Prevent duplicate capture
    if (
      milestone.status === 'SETTLED' ||
      milestone.paymentStatus === 'CAPTURED' ||
      milestone.paymentStatus === 'SIMULATED_CAPTURED' ||
      milestone.paymentStatus === 'SIMULATED_PARTIALLY_CAPTURED'
    ) {
      throw new AppError(
        409,
        'DUPLICATE_CAPTURE_FORBIDDEN',
        `Milestone '${milestoneId}' has already been captured and settled.`
      );
    }

    // 4. Mandatory Human Approval Gate
    const latestApproval = this.approvalRepo.findLatestByMilestoneId(milestoneId);
    if (
      milestone.status !== 'APPROVED' ||
      !latestApproval ||
      latestApproval.decision !== 'APPROVE'
    ) {
      throw new AppError(
        409,
        'HUMAN_APPROVAL_REQUIRED_FOR_CAPTURE',
        `Payment capture blocked: Milestone '${milestoneId}' (status: '${milestone.status}') does not have a persisted human approval decision ('APPROVE'). AI recommendations alone can never trigger payment capture.`
      );
    }

    // 5. Re-verify deterministic policy cap against approved amount
    const latestEval = this.evaluationRepo.findById(latestApproval.evaluationId);
    if (!latestEval || latestEval.status !== 'COMPLETED') {
      throw new AppError(
        409,
        'VALID_EVALUATION_REQUIRED_FOR_CAPTURE',
        `Payment capture blocked: Associated evaluation '${latestApproval.evaluationId}' is missing or incomplete.`
      );
    }

    const permittedCents = latestEval.policyCalculation.permittedAmountCents;
    const captureCents = latestApproval.approvedAmountCents;

    if (
      !Number.isInteger(captureCents) ||
      captureCents <= 0 ||
      captureCents > permittedCents ||
      captureCents > milestone.agreedAmountCents
    ) {
      throw new AppError(
        400,
        'INVALID_CAPTURE_AMOUNT_BOUNDS',
        `Capture amount (${captureCents} cents) violates deterministic policy bounds (permitted: ${permittedCents} cents, agreed: ${milestone.agreedAmountCents} cents).`
      );
    }

    // 6. Verify active PayPal Authorization exists and has not expired
    const latestTx = this.paymentRepo.findLatestByMilestoneId(milestoneId);
    if (
      !latestTx ||
      !latestTx.paypalAuthorizationId ||
      (latestTx.status !== 'AUTHORIZED' && latestTx.status !== 'SIMULATED_AUTHORIZED')
    ) {
      throw new AppError(
        409,
        'PAYPAL_AUTHORIZATION_REQUIRED_BEFORE_CAPTURE',
        `Milestone '${milestoneId}' does not have an active PayPal Authorization ('AUTHORIZED' state required before capture).`
      );
    }

    if (captureCents > latestTx.authorizedAmountCents) {
      throw new AppError(
        400,
        'CAPTURE_EXCEEDS_AUTHORIZED_AMOUNT',
        `Capture amount (${captureCents} cents) exceeds PayPal authorized hold (${latestTx.authorizedAmountCents} cents).`
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    if (latestTx.authExpiresAt && new Date(latestTx.authExpiresAt).getTime() <= now.getTime()) {
      this.milestoneRepo.updatePaymentStatus(milestone.id, 'EXPIRED', null, nowIso);
      throw new AppError(
        422,
        'PAYPAL_AUTHORIZATION_EXPIRED',
        `PayPal Authorization '${latestTx.paypalAuthorizationId}' expired at ${latestTx.authExpiresAt}. Re-authorization is required.`
      );
    }

    const isLive = this.isLivePayPalConfigured();
    const captureUsd = this.centsToUsdString(captureCents);
    let paypalCaptureId: string;

    const isPartialCapture = captureCents < latestTx.authorizedAmountCents;
    const txStatus = isLive
      ? isPartialCapture
        ? 'PARTIALLY_CAPTURED_VOIDED'
        : 'CAPTURED'
      : isPartialCapture
        ? 'SIMULATED_PARTIALLY_CAPTURED'
        : 'SIMULATED_CAPTURED';

    let rawCaptureResponse: Record<string, unknown>;

    if (isLive) {
      const token = await this.getLivePayPalAccessToken();
      const baseUrl = this.getApiBaseUrl();
      let capRes: Response;
      try {
        capRes = await this.getFetch()(
          `${baseUrl}/v2/payments/authorizations/${encodeURIComponent(latestTx.paypalAuthorizationId)}/capture`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'PayPal-Request-Id': idempotencyKey,
            },
            body: JSON.stringify({
              amount: {
                currency_code: 'USD',
                value: captureUsd,
              },
              invoice_id: `${contract.id}_${milestone.id}`.slice(0, 127),
              final_capture: true,
              note_to_payer: `MilestoneProof AI Verified Settlement: ${milestone.title}`.slice(0, 255),
            }),
          }
        );
      } catch (fetchErr: any) {
        this.db.withTransaction(() => {
          const timeoutRec: PayPalTransactionRecord = {
            id: `ptx_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
            milestoneId: milestone.id,
            approvalId: latestApproval.id,
            paypalOrderId: latestTx.paypalOrderId,
            paypalAuthorizationId: latestTx.paypalAuthorizationId,
            paypalCaptureId: null,
            idempotencyKey,
            authorizedAmountCents: latestTx.authorizedAmountCents,
            capturedAmountCents: 0,
            currency: 'USD',
            status: 'REQUIRES_RECONCILIATION',
            executionMode: 'PAYPAL_SANDBOX',
            nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
            authExpiresAt: latestTx.authExpiresAt,
            rawPaypalResponse: { error: fetchErr?.message ?? 'Network error during capture' },
            updatedAt: nowIso,
          };
          this.paymentRepo.insert(timeoutRec);
          this.auditService.appendWithinTx({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'PAYPAL_CAPTURE_AMBIGUOUS_TIMEOUT',
            entityType: 'PAYMENT',
            entityId: timeoutRec.id,
            contractId: contract.id,
            milestoneId: milestone.id,
            previousState: latestTx.status,
            newState: 'REQUIRES_RECONCILIATION',
            payload: {
              error: fetchErr?.message ?? 'Network error during capture',
              idempotencyKey,
            },
            timestamp: nowIso,
          });
        });
        throw new AppError(
          504,
          'PAYPAL_CAPTURE_TIMEOUT_REQUIRES_RECONCILIATION',
          'Network error or timeout occurred while communicating with PayPal. State recorded as REQUIRES_RECONCILIATION.'
        );
      }

      if (!capRes.ok) {
        if (capRes.status >= 500) {
          const errText = await capRes.text();
          this.db.withTransaction(() => {
            const timeoutRec: PayPalTransactionRecord = {
              id: `ptx_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
              milestoneId: milestone.id,
              approvalId: latestApproval.id,
              paypalOrderId: latestTx.paypalOrderId,
              paypalAuthorizationId: latestTx.paypalAuthorizationId,
              paypalCaptureId: null,
              idempotencyKey,
              authorizedAmountCents: latestTx.authorizedAmountCents,
              capturedAmountCents: 0,
              currency: 'USD',
              status: 'REQUIRES_RECONCILIATION',
              executionMode: 'PAYPAL_SANDBOX',
              nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
              authExpiresAt: latestTx.authExpiresAt,
              rawPaypalResponse: { httpStatus: capRes.status, error: errText },
              updatedAt: nowIso,
            };
            this.paymentRepo.insert(timeoutRec);
            this.auditService.appendWithinTx({
              actorId: actor.id,
              actorRole: actor.role,
              action: 'PAYPAL_CAPTURE_AMBIGUOUS_GATEWAY_ERROR',
              entityType: 'PAYMENT',
              entityId: timeoutRec.id,
              contractId: contract.id,
              milestoneId: milestone.id,
              previousState: latestTx.status,
              newState: 'REQUIRES_RECONCILIATION',
              payload: {
                httpStatus: capRes.status,
                error: errText,
                idempotencyKey,
              },
              timestamp: nowIso,
            });
          });
          throw new AppError(
            502,
            'PAYPAL_GATEWAY_ERROR_REQUIRES_RECONCILIATION',
            `PayPal returned HTTP ${capRes.status}. State recorded as REQUIRES_RECONCILIATION.`
          );
        }
        const errText = await capRes.text();
        throw new AppError(
          422,
          'PAYPAL_CAPTURE_FAILED',
          `PayPal Authorizations Capture API v2 returned HTTP ${capRes.status}: ${errText}`
        );
      }

      let parsedCap: Record<string, unknown>;
      try {
        parsedCap = (await capRes.json()) as Record<string, unknown>;
      } catch {
        throw new AppError(
          422,
          'MALFORMED_PAYPAL_CAPTURE_RESPONSE',
          'PayPal Authorizations Capture API v2 response was not valid JSON.'
        );
      }
      const liveCaptureId = typeof parsedCap?.id === 'string' ? parsedCap.id.trim() : '';
      if (!liveCaptureId) {
        throw new AppError(
          422,
          'MISSING_PAYPAL_CAPTURE_ID',
          'PayPal Authorizations Capture API v2 response is missing capture id.'
        );
      }
      const capStatus = typeof parsedCap?.status === 'string' ? parsedCap.status.toUpperCase() : '';
      if (capStatus === 'DECLINED' || capStatus === 'FAILED') {
        throw new AppError(
          422,
          'PAYPAL_CAPTURE_DECLINED',
          `PayPal Capture '${liveCaptureId}' failed with status '${capStatus}'.`
        );
      }

      rawCaptureResponse = parsedCap;
      paypalCaptureId = liveCaptureId;
    } else {
      paypalCaptureId = `CAP-MPAI-${crypto
        .createHash('sha256')
        .update(`${latestTx.paypalAuthorizationId}:${idempotencyKey}`)
        .digest('hex')
        .slice(0, 12)
        .toUpperCase()}`;
      rawCaptureResponse = {
        id: paypalCaptureId,
        status: 'COMPLETED',
        final_capture: true,
        amount: {
          currency_code: 'USD',
          value: captureUsd,
        },
        invoice_id: `${contract.id}_${milestone.id}`,
        custom_id: latestApproval.id,
        create_time: nowIso,
        update_time: nowIso,
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
      };
    }

    return this.db.withTransaction(() => {
      const capturedRecord: PayPalTransactionRecord = {
        id: `ptx_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`,
        milestoneId: milestone.id,
        approvalId: latestApproval.id,
        paypalOrderId: latestTx.paypalOrderId,
        paypalAuthorizationId: latestTx.paypalAuthorizationId,
        paypalCaptureId,
        idempotencyKey,
        authorizedAmountCents: latestTx.authorizedAmountCents,
        capturedAmountCents: captureCents,
        currency: 'USD',
        status: txStatus,
        executionMode: isLive ? 'PAYPAL_SANDBOX' : 'SANDBOX_SIMULATION',
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        authExpiresAt: latestTx.authExpiresAt,
        rawPaypalResponse: rawCaptureResponse,
        updatedAt: nowIso,
      };

      this.paymentRepo.insert(capturedRecord);

      if (isLive) {
        // Real verified PayPal Sandbox settlement transitions milestone to SETTLED & CAPTURED
        this.milestoneRepo.updatePaymentStatus(milestone.id, 'CAPTURED', 'SETTLED', nowIso);
      } else {
        // Simulation mode NEVER transitions milestone.status to SETTLED or paymentStatus to CAPTURED
        this.milestoneRepo.updatePaymentStatus(
          milestone.id,
          isPartialCapture ? 'SIMULATED_PARTIALLY_CAPTURED' : 'SIMULATED_CAPTURED',
          null,
          nowIso
        );
      }

      this.auditService.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: isLive ? 'PAYPAL_AUTHORIZATION_CAPTURED' : 'PAYPAL_SIMULATED_CAPTURE_RECORDED',
        entityType: 'PAYMENT',
        entityId: capturedRecord.id,
        contractId: contract.id,
        milestoneId: milestone.id,
        previousState: 'APPROVED',
        newState: isLive ? 'SETTLED' : txStatus,
        payload: {
          approvalId: latestApproval.id,
          paypalOrderId: latestTx.paypalOrderId,
          paypalAuthorizationId: latestTx.paypalAuthorizationId,
          paypalCaptureId,
          authorizedAmountCents: latestTx.authorizedAmountCents,
          capturedAmountCents: captureCents,
          permittedAmountCents: permittedCents,
          finalCapture: true,
          idempotencyKey,
          executionMode: capturedRecord.executionMode,
          simulatedOnly: !isLive,
        },
        timestamp: nowIso,
      });

      return capturedRecord;
    });
  }

  /**
   * Step 4: Verify and process asynchronous PayPal Sandbox Webhook Notifications
   * (`POST /api/v1/webhooks/paypal`).
   *
   * Uses PayPal's official webhook signature verification endpoint
   * (`POST /v1/notifications/verify-webhook-signature`) with server-side credentials
   * and configured `PAYPAL_WEBHOOK_ID`.
   *
   * Security Rules Enforced:
   * - Accepts an event ONLY when PayPal returns `verification_status === "SUCCESS"`.
   * - Fails closed (503) when webhook configuration (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
   *   or `PAYPAL_WEBHOOK_ID`) is missing or when PayPal's verification service is unavailable.
   * - Never processes state-changing events for unverified webhooks.
   * - Logs rejected and unverified webhook attempts in the audit trail.
   */
  public async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown
  ): Promise<{
    verified: boolean;
    eventId: string;
    eventType: string;
    status: string;
    duplicate?: boolean;
    reconciledTransactionId: string | null;
  }> {
    const getHeader = (name: string): string => {
      const lower = name.toLowerCase();
      const val =
        headers[lower] ??
        headers[name] ??
        headers[name.toUpperCase()];
      return Array.isArray(val) ? String(val[0] ?? '') : String(val ?? '');
    };

    const transmissionId = getHeader('paypal-transmission-id').trim();
    const transmissionTime = getHeader('paypal-transmission-time').trim();
    const transmissionSig = getHeader('paypal-transmission-sig').trim();
    const certUrl = getHeader('paypal-cert-url').trim();
    const authAlgo = getHeader('paypal-auth-algo').trim();

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw new AppError(400, 'INVALID_WEBHOOK_PAYLOAD', 'Webhook body must be a JSON object.');
    }

    const bodyObj = rawBody as Record<string, unknown>;
    const eventId = String(bodyObj.id ?? '').trim();
    const eventType = String(bodyObj.event_type ?? '').trim();
    const resource =
      bodyObj.resource && typeof bodyObj.resource === 'object'
        ? (bodyObj.resource as Record<string, unknown>)
        : null;

    if (!eventId || !eventType || !resource) {
      throw new AppError(
        400,
        'MALFORMED_PAYPAL_WEBHOOK_EVENT',
        'PayPal webhook event must include id, event_type, and resource.'
      );
    }

    const recordRejectedAttempt = (
      verificationStatus: PayPalWebhookVerificationStatus,
      reasonCode: string,
      errorMessage: string
    ): void => {
      const nowIso = new Date().toISOString();
      this.db.withTransaction(() => {
        const webhookRepo = this.options?.webhookEventRepo;
        if (webhookRepo) {
          const existing = webhookRepo.findByEventId(eventId);
          if (!existing) {
            webhookRepo.create({
              eventId,
              eventType,
              transmissionId: transmissionId || null,
              verificationStatus,
              processingStatus: 'REJECTED',
              processingResult: reasonCode,
              reconciledTransactionId: null,
              errorMessage,
              receivedAt: nowIso,
              updatedAt: nowIso,
            });
          } else if (existing.processingStatus !== 'PROCESSED') {
            webhookRepo.update({
              ...existing,
              transmissionId: transmissionId || existing.transmissionId,
              verificationStatus,
              processingStatus: 'REJECTED',
              processingResult: reasonCode,
              errorMessage,
              updatedAt: nowIso,
            });
          }
        }

        this.auditService.appendWithinTx({
          actorId: 'client_01',
          actorRole: 'SYSTEM',
          action: 'PAYPAL_WEBHOOK_REJECTED',
          entityType: 'PAYMENT',
          entityId: eventId,
          contractId: null,
          milestoneId: null,
          previousState: null,
          newState: reasonCode,
          payload: {
            eventId,
            eventType,
            transmissionId: transmissionId || null,
            verificationStatus,
            reasonCode,
            errorMessage,
          },
          timestamp: nowIso,
        });
      });
    };

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
      recordRejectedAttempt(
        'UNVERIFIED',
        'MISSING_PAYPAL_WEBHOOK_HEADERS',
        'Missing mandatory PayPal webhook signature headers.'
      );
      throw new AppError(
        401,
        'MISSING_PAYPAL_WEBHOOK_HEADERS',
        'Missing mandatory PayPal webhook signature headers (PAYPAL-TRANSMISSION-ID, PAYPAL-TRANSMISSION-TIME, PAYPAL-TRANSMISSION-SIG, PAYPAL-CERT-URL, PAYPAL-AUTH-ALGO).'
      );
    }

    // Validate Cert URL is an HTTPS PayPal domain to prevent SSRF / forged cert injection
    if (!/^https:\/\/api(\.sandbox)?\.paypal\.com\//i.test(certUrl)) {
      recordRejectedAttempt(
        'FAILURE',
        'UNTRUSTED_PAYPAL_CERT_URL',
        `Untrusted PAYPAL-CERT-URL '${certUrl}'.`
      );
      throw new AppError(
        401,
        'UNTRUSTED_PAYPAL_CERT_URL',
        `Untrusted PAYPAL-CERT-URL '${certUrl}'. Certificate URL must belong to https://api.paypal.com or https://api.sandbox.paypal.com.`
      );
    }

    // Fail closed if server-side PayPal credentials or PAYPAL_WEBHOOK_ID are missing
    if (!this.isWebhookVerificationConfigured()) {
      recordRejectedAttempt(
        'UNVERIFIED',
        'WEBHOOK_VERIFICATION_UNAVAILABLE',
        'PayPal webhook verification configuration (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID) is missing. Failing closed.'
      );
      throw new AppError(
        503,
        'WEBHOOK_VERIFICATION_UNAVAILABLE',
        'PayPal webhook signature verification is unavailable because PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, or PAYPAL_WEBHOOK_ID is not configured. Failing closed.'
      );
    }

    // Call official PayPal POST /v1/notifications/verify-webhook-signature endpoint
    const verificationStatus = await this.verifyWebhookSignatureWithPayPal({
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
      webhookId: this.getWebhookId()!,
      webhookEvent: bodyObj,
      onServiceUnavailable: (errMsg) => {
        recordRejectedAttempt(
          'UNVERIFIED',
          'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE',
          errMsg
        );
      },
    });

    if (verificationStatus !== 'SUCCESS') {
      recordRejectedAttempt(
        'FAILURE',
        'INVALID_PAYPAL_WEBHOOK_SIGNATURE',
        `PayPal verify-webhook-signature returned verification_status='${verificationStatus}'.`
      );
      throw new AppError(
        401,
        'INVALID_PAYPAL_WEBHOOK_SIGNATURE',
        `PayPal webhook signature verification failed (verification_status: '${verificationStatus}').`
      );
    }

    const webhookRepo = this.options?.webhookEventRepo;

    // Prevent concurrent duplicate deliveries of the exact same event_id
    if (this.activeWebhookLocks.has(eventId)) {
      const nowIso = new Date().toISOString();
      this.db.withTransaction(() => {
        this.auditService.appendWithinTx({
          actorId: 'client_01',
          actorRole: 'SYSTEM',
          action: 'PAYPAL_WEBHOOK_DUPLICATE_IGNORED',
          entityType: 'PAYMENT',
          entityId: eventId,
          contractId: null,
          milestoneId: null,
          previousState: 'PROCESSING',
          newState: 'DUPLICATE_CONCURRENT_IGNORED',
          payload: {
            eventId,
            eventType,
            transmissionId,
            reason: 'Concurrent duplicate delivery detected while event is in-flight.',
          },
          timestamp: nowIso,
        });
      });
      return {
        verified: true,
        eventId,
        eventType,
        status: 'DUPLICATE_IGNORED',
        duplicate: true,
        reconciledTransactionId: null,
      };
    }

    this.activeWebhookLocks.add(eventId);
    try {
      // Check persistent webhook event table for already-processed or in-progress events
      if (webhookRepo) {
        const existingEvent = webhookRepo.findByEventId(eventId);
        if (existingEvent && existingEvent.processingStatus === 'PROCESSED') {
          const nowIso = new Date().toISOString();
          this.db.withTransaction(() => {
            this.auditService.appendWithinTx({
              actorId: 'client_01',
              actorRole: 'SYSTEM',
              action: 'PAYPAL_WEBHOOK_DUPLICATE_IGNORED',
              entityType: 'PAYMENT',
              entityId: existingEvent.reconciledTransactionId ?? eventId,
              contractId: null,
              milestoneId: null,
              previousState: existingEvent.processingResult,
              newState: 'DUPLICATE_IGNORED',
              payload: {
                eventId,
                eventType,
                transmissionId,
                originalReceivedAt: existingEvent.receivedAt,
                reconciledTransactionId: existingEvent.reconciledTransactionId,
              },
              timestamp: nowIso,
            });
          });
          return {
            verified: true,
            eventId,
            eventType,
            status: 'DUPLICATE_IGNORED',
            duplicate: true,
            reconciledTransactionId: existingEvent.reconciledTransactionId,
          };
        }

        // Mark event as PROCESSING before running reconciliation
        const markIso = new Date().toISOString();
        this.db.withTransaction(() => {
          if (!existingEvent) {
            webhookRepo.create({
              eventId,
              eventType,
              transmissionId,
              verificationStatus: 'SUCCESS',
              processingStatus: 'PROCESSING',
              processingResult: null,
              reconciledTransactionId: null,
              errorMessage: null,
              receivedAt: markIso,
              updatedAt: markIso,
            });
          } else {
            // Retry of a previously FAILED or REJECTED event
            webhookRepo.update({
              ...existingEvent,
              eventType,
              transmissionId,
              verificationStatus: 'SUCCESS',
              processingStatus: 'PROCESSING',
              errorMessage: null,
              updatedAt: markIso,
            });
          }
        });
      }

      try {
        return this.db.withTransaction(() => {
          const nowIso = new Date().toISOString();
          const resourceId = String(resource.id ?? '');

          if (this.options?.beforeWebhookReconcileHook) {
            this.options.beforeWebhookReconcileHook(eventId, eventType);
          }

          let matchedTx =
            this.paymentRepo.findByPaypalAuthorizationId(resourceId) ??
            this.paymentRepo.findByPaypalOrderId(resourceId);

          let reconciledStatus = 'VERIFIED_LOGGED';

          if (matchedTx) {
            if (
              eventType === 'PAYMENT.AUTHORIZATION.VOIDED' &&
              (matchedTx.status === 'AUTHORIZED' || matchedTx.status === 'SIMULATED_AUTHORIZED')
            ) {
              matchedTx = {
                ...matchedTx,
                status: 'VOIDED',
                updatedAt: nowIso,
              };
              this.paymentRepo.update(matchedTx);
              this.milestoneRepo.updatePaymentStatus(matchedTx.milestoneId, 'VOIDED', null, nowIso);
              reconciledStatus = 'RECONCILED_VOIDED';
            } else if (
              eventType === 'PAYMENT.CAPTURE.DENIED' ||
              eventType === 'PAYMENT.AUTHORIZATION.EXPIRED'
            ) {
              const newPayStatus =
                eventType === 'PAYMENT.AUTHORIZATION.EXPIRED' ? 'EXPIRED' : 'FAILED';
              matchedTx = {
                ...matchedTx,
                status: newPayStatus,
                updatedAt: nowIso,
              };
              this.paymentRepo.update(matchedTx);
              this.milestoneRepo.updatePaymentStatus(
                matchedTx.milestoneId,
                newPayStatus,
                newPayStatus === 'FAILED' ? 'PAY_FAILED' : null,
                nowIso
              );
              reconciledStatus = `RECONCILED_${newPayStatus}`;
            }
          }

          if (webhookRepo) {
            const currentRec = webhookRepo.findByEventId(eventId);
            if (currentRec) {
              webhookRepo.update({
                ...currentRec,
                verificationStatus: 'SUCCESS',
                processingStatus: 'PROCESSED',
                processingResult: reconciledStatus,
                reconciledTransactionId: matchedTx?.id ?? null,
                errorMessage: null,
                updatedAt: nowIso,
              });
            }
          }

          const milestone = matchedTx ? this.milestoneRepo.findById(matchedTx.milestoneId) : null;

          this.auditService.appendWithinTx({
            actorId: 'client_01',
            actorRole: 'SYSTEM',
            action: 'PAYPAL_WEBHOOK_VERIFIED',
            entityType: 'PAYMENT',
            entityId: matchedTx?.id ?? eventId,
            contractId: milestone?.contractId ?? null,
            milestoneId: matchedTx?.milestoneId ?? null,
            previousState: null,
            newState: reconciledStatus,
            payload: {
              eventId,
              eventType,
              transmissionId,
              authAlgo,
              resourceId,
              verificationStatus: 'SUCCESS',
              reconciledTransactionId: matchedTx?.id ?? null,
            },
            timestamp: nowIso,
          });

          return {
            verified: true,
            eventId,
            eventType,
            status: reconciledStatus,
            duplicate: false,
            reconciledTransactionId: matchedTx?.id ?? null,
          };
        });
      } catch (processingErr) {
        // Record FAILED processing state so the webhook event can be safely retried
        const failIso = new Date().toISOString();
        const errMsg =
          processingErr instanceof Error ? processingErr.message : String(processingErr);
        if (webhookRepo) {
          this.db.withTransaction(() => {
            const currentRec = webhookRepo.findByEventId(eventId);
            if (currentRec) {
              webhookRepo.update({
                ...currentRec,
                processingStatus: 'FAILED',
                errorMessage: errMsg,
                updatedAt: failIso,
              });
            }
            this.auditService.appendWithinTx({
              actorId: 'client_01',
              actorRole: 'SYSTEM',
              action: 'PAYPAL_WEBHOOK_PROCESSING_FAILED',
              entityType: 'PAYMENT',
              entityId: eventId,
              contractId: null,
              milestoneId: null,
              previousState: 'PROCESSING',
              newState: 'FAILED',
              payload: {
                eventId,
                eventType,
                transmissionId,
                errorMessage: errMsg,
              },
              timestamp: failIso,
            });
          });
        }
        throw processingErr;
      }
    } finally {
      this.activeWebhookLocks.delete(eventId);
    }
  }

  private async verifyWebhookSignatureWithPayPal(params: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
    webhookId: string;
    webhookEvent: Record<string, unknown>;
    onServiceUnavailable: (errorMessage: string) => void;
  }): Promise<string> {
    let token: string;
    try {
      token = await this.getLivePayPalAccessToken();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      params.onServiceUnavailable(`Failed to obtain PayPal OAuth2 token for webhook verification: ${msg}`);
      throw new AppError(
        503,
        'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE',
        `PayPal webhook verification service is unavailable (OAuth2 failure). Failing closed.`
      );
    }

    const baseUrl = this.getApiBaseUrl();
    let verifyRes: Response;
    try {
      verifyRes = await this.getFetch()(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transmission_id: params.transmissionId,
          transmission_time: params.transmissionTime,
          cert_url: params.certUrl,
          auth_algo: params.authAlgo,
          transmission_sig: params.transmissionSig,
          webhook_id: params.webhookId,
          webhook_event: params.webhookEvent,
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      params.onServiceUnavailable(`Network error calling PayPal verify-webhook-signature: ${msg}`);
      throw new AppError(
        503,
        'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE',
        `Network failure contacting PayPal verify-webhook-signature endpoint: ${msg}. Failing closed.`
      );
    }

    if (!verifyRes.ok) {
      const errText = await verifyRes.text();
      params.onServiceUnavailable(
        `PayPal verify-webhook-signature returned HTTP ${verifyRes.status}: ${errText}`
      );
      throw new AppError(
        503,
        'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE',
        `PayPal verify-webhook-signature returned HTTP ${verifyRes.status}. Failing closed.`
      );
    }

    let parsed: Record<string, unknown>;
    try {
      const json = await verifyRes.json();
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        throw new Error('Response is not a JSON object');
      }
      parsed = json as Record<string, unknown>;
    } catch {
      params.onServiceUnavailable('PayPal verify-webhook-signature returned malformed JSON.');
      throw new AppError(
        503,
        'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE',
        'PayPal verify-webhook-signature returned malformed JSON. Failing closed.'
      );
    }

    return String(parsed.verification_status ?? 'FAILURE').trim();
  }

  public listTransactionsByMilestone(milestoneId: string): PayPalTransactionRecord[] {
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }
    return this.paymentRepo.listByMilestoneId(milestoneId);
  }

  public async getRemotePayPalOrder(orderId: string): Promise<Record<string, unknown> | null> {
    if (!this.isLivePayPalConfigured()) return null;
    const token = await this.getLivePayPalAccessToken();
    const baseUrl = this.getApiBaseUrl();
    const res = await this.getFetch()(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new AppError(res.status, 'PAYPAL_REMOTE_QUERY_ERROR', `Failed to query PayPal order: ${res.statusText}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  public async getRemotePayPalAuthorization(authId: string): Promise<Record<string, unknown> | null> {
    if (!this.isLivePayPalConfigured()) return null;
    const token = await this.getLivePayPalAccessToken();
    const baseUrl = this.getApiBaseUrl();
    const res = await this.getFetch()(`${baseUrl}/v2/payments/authorizations/${encodeURIComponent(authId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new AppError(res.status, 'PAYPAL_REMOTE_QUERY_ERROR', `Failed to query PayPal authorization: ${res.statusText}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  public async getRemotePayPalCapture(captureId: string): Promise<Record<string, unknown> | null> {
    if (!this.isLivePayPalConfigured()) return null;
    const token = await this.getLivePayPalAccessToken();
    const baseUrl = this.getApiBaseUrl();
    const res = await this.getFetch()(`${baseUrl}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new AppError(res.status, 'PAYPAL_REMOTE_QUERY_ERROR', `Failed to query PayPal capture: ${res.statusText}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * Authoritative Payment Reconciliation Engine:
   * Reconciles local payment records with the authoritative remote PayPal state.
   */
  public async reconcilePayment(
    actor: User,
    milestoneId: string
  ): Promise<PayPalReconciliationReport> {
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }

    const contract = this.contractRepo.findById(milestone.contractId);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${milestone.contractId}' was not found.`);
    }

    // Separation-of-Duties: Developer cannot trigger payment reconciliation
    if (actor.role === 'DEVELOPER' || actor.id === contract.developerId) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_CONTRACT_FIDUCIARY',
        `Developer '${actor.id}' cannot trigger payment reconciliation for milestone '${milestoneId}'.`
      );
    }

    if (actor.id !== contract.clientId && actor.id !== contract.reviewerId) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_CONTRACT_FIDUCIARY',
        `Actor '${actor.id}' is not authorized to reconcile payments for contract '${contract.id}'.`
      );
    }

    const latestTx = this.paymentRepo.findLatestByMilestoneId(milestoneId);
    const nowIso = new Date().toISOString();

    if (!latestTx) {
      const emptyReport: PayPalReconciliationReport = {
        milestoneId,
        contractId: contract.id,
        localTransaction: null,
        remotePayPalRecord: null,
        outcome: 'REMOTE_RECORD_NOT_FOUND',
        discrepancies: ['No payment transactions found in local database for milestone.'],
        actionTaken: 'NO_OP',
        reconciledAt: nowIso,
        reconciledBy: {
          id: actor.id,
          role: actor.role,
        },
      };

      this.db.withTransaction(() => {
        this.auditService.appendWithinTx({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'PAYPAL_PAYMENT_RECONCILED',
          entityType: 'PAYMENT',
          entityId: milestoneId,
          contractId: contract.id,
          milestoneId,
          previousState: null,
          newState: 'REMOTE_RECORD_NOT_FOUND',
          payload: {
            outcome: 'REMOTE_RECORD_NOT_FOUND',
            discrepancies: emptyReport.discrepancies,
            actionTaken: emptyReport.actionTaken,
          },
          timestamp: nowIso,
        });
      });

      return emptyReport;
    }

    const isLive = this.isLivePayPalConfigured() && latestTx.executionMode === 'PAYPAL_SANDBOX';
    const discrepancies: string[] = [];
    let remoteRecord: {
      orderId: string | null;
      authorizationId: string | null;
      captureId: string | null;
      status: string | null;
      authorizedAmountCents: number | null;
      capturedAmountCents: number | null;
      createTime: string | null;
      updateTime: string | null;
    } | null = null;

    let outcome: PayPalReconciliationOutcome = 'IN_SYNC';
    let actionTaken = 'NO_OP_LOCAL_ALIGNED';

    if (isLive) {
      let remoteOrder: Record<string, unknown> | null = null;
      let remoteAuth: Record<string, unknown> | null = null;
      let remoteCap: Record<string, unknown> | null = null;

      if (latestTx.paypalCaptureId) {
        remoteCap = await this.getRemotePayPalCapture(latestTx.paypalCaptureId);
      }
      if (latestTx.paypalAuthorizationId) {
        remoteAuth = await this.getRemotePayPalAuthorization(latestTx.paypalAuthorizationId);
      }
      if (latestTx.paypalOrderId) {
        remoteOrder = await this.getRemotePayPalOrder(latestTx.paypalOrderId);
      }

      if (!remoteOrder && !remoteAuth && !remoteCap) {
        outcome = 'REMOTE_RECORD_NOT_FOUND';
        discrepancies.push('No matching order, authorization, or capture found in PayPal sandbox.');
        actionTaken = 'FLAGGED_REMOTE_NOT_FOUND';
      } else {
        const rawStatus = (remoteCap?.status ?? remoteAuth?.status ?? remoteOrder?.status ?? 'UNKNOWN') as string;
        const capAmountObj = remoteCap?.amount as { value?: string } | undefined;
        const authAmountObj = remoteAuth?.amount as { value?: string } | undefined;
        const remoteCapCents = capAmountObj?.value ? Math.round(parseFloat(capAmountObj.value) * 100) : null;
        const remoteAuthCents = authAmountObj?.value ? Math.round(parseFloat(authAmountObj.value) * 100) : null;

        remoteRecord = {
          orderId: (remoteOrder?.id as string) ?? latestTx.paypalOrderId,
          authorizationId: (remoteAuth?.id as string) ?? latestTx.paypalAuthorizationId,
          captureId: (remoteCap?.id as string) ?? latestTx.paypalCaptureId,
          status: rawStatus.toUpperCase(),
          authorizedAmountCents: remoteAuthCents,
          capturedAmountCents: remoteCapCents,
          createTime: (remoteCap?.create_time ?? remoteAuth?.create_time ?? remoteOrder?.create_time ?? null) as string | null,
          updateTime: (remoteCap?.update_time ?? remoteAuth?.update_time ?? remoteOrder?.update_time ?? null) as string | null,
        };

        if (latestTx.status === 'REQUIRES_RECONCILIATION' || latestTx.status === 'CAPTURE_PENDING') {
          if (remoteRecord.status === 'COMPLETED') {
            outcome = 'RECONCILED_LOCAL_UPDATED';
            actionTaken = 'UPDATED_LOCAL_TO_CAPTURED_AND_SETTLED';
            discrepancies.push('Local state was ambiguous; remote PayPal capture confirmed COMPLETED.');
            this.db.withTransaction(() => {
              const updatedTx: PayPalTransactionRecord = {
                ...latestTx,
                status: 'CAPTURED',
                capturedAmountCents: remoteCapCents ?? latestTx.authorizedAmountCents,
                paypalCaptureId: remoteRecord?.captureId ?? latestTx.paypalCaptureId,
                updatedAt: nowIso,
              };
              this.paymentRepo.update(updatedTx);
              this.milestoneRepo.updatePaymentStatus(milestone.id, 'CAPTURED', 'SETTLED', nowIso);
            });
          } else if (remoteRecord.status === 'VOIDED' || remoteRecord.status === 'DENIED') {
            outcome = 'RECONCILED_LOCAL_UPDATED';
            actionTaken = 'UPDATED_LOCAL_TO_FAILED';
            discrepancies.push(`Remote PayPal status is ${remoteRecord.status}.`);
            this.db.withTransaction(() => {
              const updatedTx: PayPalTransactionRecord = {
                ...latestTx,
                status: remoteRecord?.status === 'VOIDED' ? 'VOIDED' : 'CAPTURE_FAILED',
                updatedAt: nowIso,
              };
              this.paymentRepo.update(updatedTx);
              this.milestoneRepo.updatePaymentStatus(milestone.id, updatedTx.status === 'VOIDED' ? 'VOIDED' : 'FAILED', null, nowIso);
            });
          } else {
            outcome = 'MANUAL_INTERVENTION_REQUIRED';
            discrepancies.push(`Remote status is ${remoteRecord.status}; cannot automatically resolve.`);
            actionTaken = 'FLAGGED_MANUAL_REVIEW';
          }
        } else if (latestTx.status === 'AUTHORIZED') {
          if (remoteRecord.status === 'VOIDED') {
            outcome = 'RECONCILED_LOCAL_UPDATED';
            actionTaken = 'UPDATED_LOCAL_TO_VOIDED';
            discrepancies.push('Remote authorization was voided out-of-band on PayPal.');
            this.db.withTransaction(() => {
              const updatedTx: PayPalTransactionRecord = {
                ...latestTx,
                status: 'VOIDED',
                updatedAt: nowIso,
              };
              this.paymentRepo.update(updatedTx);
              this.milestoneRepo.updatePaymentStatus(milestone.id, 'VOIDED', null, nowIso);
            });
          } else if (remoteRecord.status === 'CAPTURED' || remoteRecord.status === 'COMPLETED') {
            outcome = 'MANUAL_INTERVENTION_REQUIRED';
            discrepancies.push('Remote shows captured out-of-band without TrustChain human approval gate.');
            actionTaken = 'FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE';
          }
        }
      }
    } else {
      const isSettled = latestTx.status === 'SIMULATED_CAPTURED' || latestTx.status === 'SIMULATED_PARTIALLY_CAPTURED';
      remoteRecord = {
        orderId: latestTx.paypalOrderId,
        authorizationId: latestTx.paypalAuthorizationId,
        captureId: latestTx.paypalCaptureId,
        status: isSettled ? 'COMPLETED' : latestTx.status === 'SIMULATED_AUTHORIZED' ? 'AUTHORIZED' : 'CREATED',
        authorizedAmountCents: latestTx.authorizedAmountCents,
        capturedAmountCents: latestTx.capturedAmountCents,
        createTime: latestTx.updatedAt,
        updateTime: latestTx.updatedAt,
      };

      if (latestTx.status === 'REQUIRES_RECONCILIATION') {
        outcome = 'RECONCILED_LOCAL_UPDATED';
        actionTaken = 'SIMULATION_RECONCILED_TO_AUTHORIZED';
        discrepancies.push('Resolved simulated ambiguous state to SIMULATED_AUTHORIZED.');
        this.db.withTransaction(() => {
          const updatedTx: PayPalTransactionRecord = {
            ...latestTx,
            status: 'SIMULATED_AUTHORIZED',
            updatedAt: nowIso,
          };
          this.paymentRepo.update(updatedTx);
        });
      } else {
        outcome = 'IN_SYNC';
        actionTaken = 'NO_OP_SIMULATION_IN_SYNC';
      }
    }

    const report: PayPalReconciliationReport = {
      milestoneId,
      contractId: contract.id,
      localTransaction: {
        id: latestTx.id,
        status: latestTx.status,
        authorizedAmountCents: latestTx.authorizedAmountCents,
        capturedAmountCents: latestTx.capturedAmountCents,
        paypalOrderId: latestTx.paypalOrderId,
        paypalAuthorizationId: latestTx.paypalAuthorizationId,
        paypalCaptureId: latestTx.paypalCaptureId,
        updatedAt: latestTx.updatedAt,
      },
      remotePayPalRecord: remoteRecord,
      outcome,
      discrepancies,
      actionTaken,
      reconciledAt: nowIso,
      reconciledBy: {
        id: actor.id,
        role: actor.role,
      },
    };

    this.db.withTransaction(() => {
      this.auditService.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'PAYPAL_PAYMENT_RECONCILED',
        entityType: 'PAYMENT',
        entityId: latestTx.id,
        contractId: contract.id,
        milestoneId,
        previousState: latestTx.status,
        newState: outcome,
        payload: {
          outcome,
          discrepancies,
          actionTaken,
        remoteRecord,
        },
        timestamp: nowIso,
      });
    });

    return report;
  }
}
