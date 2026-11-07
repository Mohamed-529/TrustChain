/**
 * ============================================================================
 * MilestoneProof AI — Strongly-Typed TypeScript Client SDK
 * Generated & Aligned with OpenAPI 3.0.3 (`openapi.yaml`) and `APIMATIC-META.json`
 * ============================================================================
 *
 * Controller Groups (matching OpenAPI tags):
 * 1. SystemController (`getSystemHealth`, `getOpenApiJson`, `getOpenApiYaml`)
 * 2. AuthController (`loginUser`, `switchDemoPersona`, `getCurrentSession`, `logoutSession`)
 * 3. UsersController (`listUsers`)
 * 4. ContractsController (`listContracts`, `createContract`, `getContractById`, `activateContract`,
 *    `getContractSchedule`, `analyzeContractScheduleRisk`, `reviewScheduleProposal`)
 * 5. EvidenceController (`submitMilestoneEvidence`, `listMilestoneEvidence`)
 * 6. EvaluationsController (`evaluateMilestoneEvidence`, `listMilestoneEvaluations`)
 * 7. SettlementPolicyController (`previewSettlementPolicy`, `getFinancialDecisionLedger`)
 * 8. ApprovalsController (`submitHumanReview`)
 * 9. PaymentsController (`createPayPalOrder`, `authorizePayPalOrder`, `capturePayPalAuthorization`, `handlePayPalWebhook`)
 * 10. AuditController (`listAuditLogs`, `verifyAuditHashChain`)
 */

import type {
  AuditChainVerificationResult,
  AuditLogEntry,
  Contract,
  ContractScheduleResponse,
  CreateContractInput,
  EvaluationRun,
  EvidenceSubmission,
  FinancialLedgerRow,
  HumanApprovalRecord,
  MilestoneStatus,
  PayPalTransactionRecord,
  PolicyCalculationResult,
  ScheduleRecoveryProposal,
  SubmitEvidenceInput,
  SubmitReviewInput,
  User,
} from '../types/domain.ts';

export interface MilestoneProofSdkConfig {
  baseUrl?: string;
  bearerToken?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

export class MilestoneProofApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'MilestoneProofApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class MilestoneProofClient {
  private readonly baseUrl: string;
  private bearerToken: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(config?: MilestoneProofSdkConfig) {
    this.baseUrl = (config?.baseUrl ?? 'http://localhost:3000/api/v1').replace(/\/$/, '');
    this.bearerToken = config?.bearerToken;
    this.fetchImpl = config?.fetchImpl ?? fetch;
    this.maxRetries = config?.maxRetries ?? 2;
  }

  public setBearerToken(token: string | undefined): void {
    this.bearerToken = token;
  }

  private async request<T>(params: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    requiresAuth?: boolean;
  }): Promise<T> {
    const url = `${this.baseUrl}${params.path}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(params.headers ?? {}),
    };

    if (params.requiresAuth !== false && this.bearerToken) {
      headers.Authorization = `Bearer ${this.bearerToken}`;
    }

    if (params.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let attempt = 0;
    const retryableStatuses = new Set([408, 429, 502, 503, 504]);

    while (true) {
      const response = await this.fetchImpl(url, {
        method: params.method,
        headers,
        body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
      });

      if (!response.ok) {
        if (retryableStatuses.has(response.status) && attempt < this.maxRetries) {
          attempt++;
          continue;
        }

        let errCode = `HTTP_${response.status}`;
        let errMessage = `API request failed with HTTP ${response.status}`;
        let errDetails: Record<string, unknown> = {};

        try {
          const errJson = (await response.json()) as {
            error?: { code?: string; message?: string; details?: Record<string, unknown> };
          };
          if (errJson.error) {
            errCode = errJson.error.code ?? errCode;
            errMessage = errJson.error.message ?? errMessage;
            errDetails = errJson.error.details ?? {};
          }
        } catch {
          // Ignore non-JSON error body
        }

        throw new MilestoneProofApiError(response.status, errCode, errMessage, errDetails);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/yaml') || contentType.includes('text/plain')) {
        return (await response.text()) as unknown as T;
      }

      return (await response.json()) as T;
    }
  }

  // ==========================================================================
  // 1. SystemController
  // ==========================================================================
  public async getSystemHealth(): Promise<{
    status: 'ok';
    service: string;
    version: string;
    runtime: string;
    capabilities: Record<string, boolean>;
  }> {
    return this.request({ method: 'GET', path: '/health', requiresAuth: false });
  }

  public async getOpenApiJson(): Promise<Record<string, unknown>> {
    return this.request({ method: 'GET', path: '/openapi.json', requiresAuth: false });
  }

  public async getOpenApiYaml(): Promise<string> {
    return this.request({ method: 'GET', path: '/openapi.yaml', requiresAuth: false });
  }

  // ==========================================================================
  // 2. AuthController
  // ==========================================================================
  public async loginUser(input: { email: string; password: string }): Promise<{
    token: string;
    user: User;
    expiresAt: number;
    jti: string;
  }> {
    const res = await this.request<{
      token: string;
      user: User;
      expiresAt: number;
      jti: string;
    }>({
      method: 'POST',
      path: '/auth/login',
      body: input,
      requiresAuth: false,
    });
    this.bearerToken = res.token;
    return res;
  }

  public async switchDemoPersona(input: { userId: string }): Promise<{
    token: string;
    user: User;
    expiresAt: number;
    jti: string;
  }> {
    const res = await this.request<{
      token: string;
      user: User;
      expiresAt: number;
      jti: string;
    }>({
      method: 'POST',
      path: '/auth/demo-switch',
      body: input,
      requiresAuth: false,
    });
    this.bearerToken = res.token;
    return res;
  }

  public async getCurrentSession(): Promise<{
    user: User;
    session: { jti: string; issuedAt: number; expiresAt: number; issuer: string; audience: string };
  }> {
    return this.request({ method: 'GET', path: '/auth/me' });
  }

  public async logoutSession(): Promise<{ status: 'revoked'; jti: string }> {
    return this.request({ method: 'POST', path: '/auth/logout' });
  }

  // ==========================================================================
  // 3. UsersController
  // ==========================================================================
  public async listUsers(): Promise<{ users: User[] }> {
    return this.request({ method: 'GET', path: '/users' });
  }

  // ==========================================================================
  // 4. ContractsController & Bryntum Schedule Control Tower
  // ==========================================================================
  public async listContracts(): Promise<{ contracts: Contract[] }> {
    return this.request({ method: 'GET', path: '/contracts' });
  }

  public async getContractById(contractId: string): Promise<{ contract: Contract }> {
    return this.request({ method: 'GET', path: `/contracts/${encodeURIComponent(contractId)}` });
  }

  public async createContract(
    input: CreateContractInput,
    idempotencyKey?: string
  ): Promise<{ contract: Contract }> {
    return this.request({
      method: 'POST',
      path: '/contracts',
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  public async activateContract(contractId: string): Promise<{ contract: Contract }> {
    return this.request({
      method: 'POST',
      path: `/contracts/${encodeURIComponent(contractId)}/activate`,
    });
  }

  public async getContractSchedule(contractId: string): Promise<ContractScheduleResponse> {
    return this.request({
      method: 'GET',
      path: `/contracts/${encodeURIComponent(contractId)}/schedule`,
    });
  }

  public async analyzeContractScheduleRisk(
    contractId: string,
    input?: { milestoneId?: string; recoveryDays?: number; referenceTimeIso?: string }
  ): Promise<{
    schedule: ContractScheduleResponse;
    createdProposals: ScheduleRecoveryProposal[];
  }> {
    return this.request({
      method: 'POST',
      path: `/contracts/${encodeURIComponent(contractId)}/schedule/analyze-risk`,
      body: input ?? {},
    });
  }

  public async reviewScheduleProposal(
    contractId: string,
    proposalId: string,
    input: { decision: 'APPROVE' | 'REJECT'; reason: string; referenceTimeIso?: string }
  ): Promise<{
    proposal: ScheduleRecoveryProposal;
    schedule: ContractScheduleResponse;
  }> {
    return this.request({
      method: 'POST',
      path: `/contracts/${encodeURIComponent(contractId)}/schedule/proposals/${encodeURIComponent(proposalId)}/review`,
      body: input,
    });
  }

  public async loadContractScheduleDemoScenario(contractId: string): Promise<{
    schedule: ContractScheduleResponse;
    createdProposals: ScheduleRecoveryProposal[];
  }> {
    return this.request({
      method: 'POST',
      path: `/contracts/${encodeURIComponent(contractId)}/schedule/demo-scenario`,
    });
  }

  // ==========================================================================
  // 5. EvidenceController
  // ==========================================================================
  public async submitMilestoneEvidence(
    milestoneId: string,
    input: SubmitEvidenceInput,
    idempotencyKey?: string
  ): Promise<{ submission: EvidenceSubmission }> {
    return this.request({
      method: 'POST',
      path: `/milestones/${encodeURIComponent(milestoneId)}/evidence`,
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  public async listMilestoneEvidence(
    milestoneId: string
  ): Promise<{ submissions: EvidenceSubmission[] }> {
    return this.request({
      method: 'GET',
      path: `/milestones/${encodeURIComponent(milestoneId)}/evidence`,
    });
  }

  // ==========================================================================
  // 6. EvaluationsController
  // ==========================================================================
  public async evaluateMilestoneEvidence(
    milestoneId: string,
    idempotencyKey?: string
  ): Promise<{ evaluation: EvaluationRun }> {
    return this.request({
      method: 'POST',
      path: `/milestones/${encodeURIComponent(milestoneId)}/evaluate`,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  public async listMilestoneEvaluations(
    milestoneId: string
  ): Promise<{ evaluations: EvaluationRun[] }> {
    return this.request({
      method: 'GET',
      path: `/milestones/${encodeURIComponent(milestoneId)}/evaluations`,
    });
  }

  // ==========================================================================
  // 7. SettlementPolicyController
  // ==========================================================================
  public async previewSettlementPolicy(
    milestoneId: string,
    input: {
      verifiedCriteriaCount: number;
      totalCriteriaCount: number;
      ciBuildPassed: boolean;
      criticalVulnCount: number;
      highVulnCount: number;
      scannerStatus: 'AVAILABLE' | 'UNAVAILABLE';
      submittedAtIso?: string;
    }
  ): Promise<{ policyCalculation: PolicyCalculationResult }> {
    return this.request({
      method: 'POST',
      path: `/milestones/${encodeURIComponent(milestoneId)}/policy-preview`,
      body: input,
    });
  }

  public async getFinancialDecisionLedger(): Promise<{ rows: FinancialLedgerRow[] }> {
    return this.request({ method: 'GET', path: '/ledger' });
  }

  // ==========================================================================
  // 8. ApprovalsController
  // ==========================================================================
  public async submitHumanReview(
    milestoneId: string,
    input: SubmitReviewInput,
    idempotencyKey?: string
  ): Promise<{ approval: HumanApprovalRecord; milestoneStatus: MilestoneStatus }> {
    return this.request({
      method: 'POST',
      path: `/milestones/${encodeURIComponent(milestoneId)}/review`,
      body: input,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  // ==========================================================================
  // 9. PaymentsController (PayPal Orders API v2)
  // ==========================================================================
  public async createPayPalOrder(
    milestoneId: string,
    paypalRequestId: string
  ): Promise<{ transaction: PayPalTransactionRecord }> {
    return this.request({
      method: 'POST',
      path: `/milestones/${encodeURIComponent(milestoneId)}/paypal/order`,
      headers: { 'PayPal-Request-Id': paypalRequestId },
    });
  }

  public async authorizePayPalOrder(
    milestoneId: string,
    paypalRequestId: string,
    body?: { paypalOrderId?: string }
  ): Promise<{ transaction: PayPalTransactionRecord }> {
    return this.request({
      method: 'POST',
      path: `/milestones/${encodeURIComponent(milestoneId)}/paypal/authorize`,
      headers: { 'PayPal-Request-Id': paypalRequestId },
      body: body ?? {},
    });
  }

  public async capturePayPalAuthorization(
    milestoneId: string,
    paypalRequestId: string
  ): Promise<{ transaction: PayPalTransactionRecord }> {
    return this.request({
      method: 'POST',
      path: `/milestones/${encodeURIComponent(milestoneId)}/paypal/capture`,
      headers: { 'PayPal-Request-Id': paypalRequestId },
    });
  }

  public async listPayPalTransactions(
    milestoneId: string
  ): Promise<{ transactions: PayPalTransactionRecord[] }> {
    return this.request({
      method: 'GET',
      path: `/milestones/${encodeURIComponent(milestoneId)}/paypal/transactions`,
    });
  }

  public async handlePayPalWebhook(
    headers: {
      'PAYPAL-TRANSMISSION-ID': string;
      'PAYPAL-TRANSMISSION-TIME': string;
      'PAYPAL-TRANSMISSION-SIG': string;
      'PAYPAL-CERT-URL': string;
      'PAYPAL-AUTH-ALGO': string;
    },
    event: { id: string; event_type: string; resource: Record<string, unknown> }
  ): Promise<{ verified: boolean; eventId: string; status: string }> {
    return this.request({
      method: 'POST',
      path: '/webhooks/paypal',
      headers,
      body: event,
      requiresAuth: false,
    });
  }

  // ==========================================================================
  // 10. AuditController
  // ==========================================================================
  public async listAuditLogs(filter?: {
    contractId?: string;
    milestoneId?: string;
    entityId?: string;
  }): Promise<{ logs: AuditLogEntry[] }> {
    const params = new URLSearchParams();
    if (filter?.contractId) params.set('contractId', filter.contractId);
    if (filter?.milestoneId) params.set('milestoneId', filter.milestoneId);
    if (filter?.entityId) params.set('entityId', filter.entityId);
    const qs = params.toString();
    return this.request({
      method: 'GET',
      path: `/audit${qs ? `?${qs}` : ''}`,
    });
  }

  public async verifyAuditHashChain(): Promise<AuditChainVerificationResult> {
    return this.request({ method: 'GET', path: '/audit/verify' });
  }
}
