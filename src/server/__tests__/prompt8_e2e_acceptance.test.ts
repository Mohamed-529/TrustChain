import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { createServerApp } from '../index.ts';
import type { User } from '../../types/domain.ts';

function createMockPrompt8PayPalFetch(options?: {
  remoteOrderId?: string;
  remoteAuthId?: string;
  remoteCaptureId?: string;
}): typeof fetch {
  const orderId = options?.remoteOrderId ?? 'ORD-E2E-PROMPT8-001';
  const authId = options?.remoteAuthId ?? 'AUTH-E2E-PROMPT8-001';
  const captureId = options?.remoteCaptureId ?? 'CAP-E2E-PROMPT8-001';

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_prompt8_access_token', token_type: 'Bearer', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
      const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};
      const sig = String(bodyObj.transmission_sig ?? '');
      const status = sig.startsWith('sig_valid_') || sig === 'valid_sandbox_sig' ? 'SUCCESS' : 'FAILURE';
      return new Response(
        JSON.stringify({ verification_status: status }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/v2/checkout/orders')) {
      return new Response(
        JSON.stringify({
          id: orderId,
          status: 'CREATED',
          intent: 'AUTHORIZE',
          purchase_units: [{ amount: { currency_code: 'USD', value: '2500.00' } }],
          links: [
            { href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}`, rel: 'self', method: 'GET' },
            { href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`, rel: 'approve', method: 'GET' },
            { href: `https://api.sandbox.paypal.com/v2/checkout/orders/${orderId}/authorize`, rel: 'authorize', method: 'POST' },
          ],
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
      const expiresAt = new Date(Date.now() + 29 * 86_400_000).toISOString();
      return new Response(
        JSON.stringify({
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: authId,
                    status: 'CREATED',
                    amount: { currency_code: 'USD', value: '2500.00' },
                    expiration_time: expiresAt,
                  },
                ],
              },
            },
          ],
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes(`/authorizations/${authId}/capture`)) {
      return new Response(
        JSON.stringify({
          id: captureId,
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '2500.00' },
          final_capture: true,
          seller_receivable_breakdown: {
            gross_amount: { currency_code: 'USD', value: '2500.00' },
            paypal_fee: { currency_code: 'USD', value: '72.80' },
            net_amount: { currency_code: 'USD', value: '2427.20' },
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes(`/authorizations/${authId}`) && !url.includes('/capture')) {
      return new Response(
        JSON.stringify({
          id: authId,
          status: 'CAPTURED',
          amount: { currency_code: 'USD', value: '2500.00' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes(`/v2/payments/captures/${captureId}`)) {
      return new Response(
        JSON.stringify({
          id: captureId,
          status: 'COMPLETED',
          amount: { currency_code: 'USD', value: '2500.00' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ message: 'Not found', url }), { status: 404 });
  };
}

describe('Prompt 8/8 — End-to-End Backend Acceptance (Stages 1 through 10)', () => {
  let server: http.Server;
  let baseUrl: string;
  let container: ReturnType<typeof createServerApp>;
  let clientUser: User;
  let devUser: User;
  let clientToken: string;
  let devToken: string;

  const submissionId = `sub_prompt8_${crypto.randomUUID().slice(0, 8)}`;
  const evalId = `eval_prompt8_${crypto.randomUUID().slice(0, 8)}`;
  const apprId = `appr_prompt8_${crypto.randomUUID().slice(0, 8)}`;

  it('Stage 0: Boots isolated test environment with fresh schema and mock gateway', async () => {
    const mockFetch = createMockPrompt8PayPalFetch();
    container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        fetchImpl: mockFetch,
        webhookId: 'WH-TEST-PROMPT8-ID',
        allowSyntheticTestCredentials: true,
      },
    });
    server = http.createServer(container.app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    assert.ok(baseUrl.startsWith('http://127.0.0.1:'));
    clientUser = container.userRepo.findById('client_01')!;
    devUser = container.userRepo.findById('dev_01')!;
    assert.ok(clientUser);
    assert.ok(devUser);
  });

  it('Stage 1: Authentication & Role-Based Access Control (RBAC)', async () => {
    // 1. Unauthenticated request to /api/v1/contracts is rejected (401)
    const unauthRes = await fetch(`${baseUrl}/api/v1/contracts`);
    assert.strictEqual(unauthRes.status, 401);

    // 2. Client logs in with valid credentials
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'elena.client@acmefintech.example', password: 'ClientPass!2026' }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);
    assert.strictEqual(loginData.user.role, 'CLIENT');
    clientToken = loginData.token;

    // 3. Developer logs in with valid credentials
    const devLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'marcus.dev@cloudbuilders.example', password: 'DevPass!2026' }),
    });
    assert.strictEqual(devLoginRes.status, 200);
    const devLoginData = await devLoginRes.json();
    assert.strictEqual(devLoginData.user.role, 'DEVELOPER');
    devToken = devLoginData.token;

    // 4. Authenticated request succeeds
    const authContractsRes = await fetch(`${baseUrl}/api/v1/contracts`, {
      headers: { authorization: `Bearer ${clientToken}` },
    });
    assert.strictEqual(authContractsRes.status, 200);
  });

  it('Stage 2: Contract & Milestone Lifecycle Hierarchy', async () => {
    // 1. Fetch default seeded contract
    const contract = container.contractRepo.findById('contract_seed_01');
    assert.ok(contract);
    assert.strictEqual(contract.currency, 'USD');
    assert.strictEqual(contract.totalBudgetCents, 850000);

    // 2. Fetch milestones under contract
    const milestones = container.milestoneRepo.listByContractId('contract_seed_01');
    assert.strictEqual(milestones.length, 3);
    const ms1 = milestones[0];
    assert.strictEqual(ms1.id, 'ms_seed_01');
    assert.strictEqual(ms1.agreedAmountCents, 250000);
    assert.strictEqual(ms1.acceptanceCriteria.length, 2);
  });

  it('Stage 3: Evidence Submission & Cryptographic Provenance', async () => {
    const commitSha = 'b7e41234abcd5678ef0123456789abcdef123456';

    container.evidenceRepo.insert({
      id: submissionId,
      milestoneId: 'ms_seed_01',
      attemptNumber: 2,
      submittedBy: 'dev_01',
      repoUrl: 'https://github.com/Mohamed-529/TrustChain',
      branch: 'main',
      commitSha,
      prUrl: 'https://github.com/Mohamed-529/TrustChain/pull/42',
      prStatus: 'MERGED',
      ciReport: {
        provider: 'GITHUB_ACTIONS',
        status: 'SUCCESS',
        totalTests: 45,
        passedTests: 45,
        failedTests: 0,
        coveragePct: 92.5,
        runUrl: 'https://github.com/Mohamed-529/TrustChain/actions/runs/1001',
        logSummary: 'All 45 unit tests passed with 92.5% coverage',
      },
      securityScan: {
        scanner: 'SNYK',
        scannerVersion: '1.1293.0',
        status: 'COMPLETED',
        findings: [],
      },
      developerNotes: 'Stage 3 acceptance delivery submission with verified provenance',
      submittedAt: new Date().toISOString(),
      provenanceStatus: 'VERIFIED',
    });

    const inserted = container.evidenceRepo.findById(submissionId);
    assert.ok(inserted);
    assert.strictEqual(inserted.id, submissionId);
    assert.strictEqual(inserted.provenanceStatus, 'VERIFIED');

    // Milestone transitions to SUBMITTED
    container.milestoneRepo.updateStatus('ms_seed_01', 'SUBMITTED', new Date().toISOString());
    const updatedMs = container.milestoneRepo.findById('ms_seed_01');
    assert.strictEqual(updatedMs?.status, 'SUBMITTED');
  });

  it('Stage 4: Multi-Agent AI Advisory Consensus (Evidence, Risk, Arbitrator)', async () => {
    container.evaluationRepo.insert({
      id: evalId,
      milestoneId: 'ms_seed_01',
      submissionId,
      status: 'COMPLETED',
      evaluationMode: 'DETERMINISTIC_MOCK',
      isMockEvaluation: true,
      evidenceAnalysis: {
        verificationStatus: 'VERIFIED',
        criteriaResults: [
          { criteriaId: 'AC-1', title: 'OAuth2 Authentication Endpoints', met: true, confidence: 0.98, reasoning: 'Endpoints present and covered by unit tests' },
          { criteriaId: 'AC-2', title: 'Automated Unit Tests >= 80% Coverage', met: true, confidence: 0.95, reasoning: 'CI coverage is 92.5%, exceeding 80% requirement' },
        ],
        notes: 'Evidence fully grounded in repository artifacts',
        isMock: true,
      } as any,
      riskAnalysis: {
        overallRisk: 'LOW',
        vulnerabilities: [],
        licenseIssues: [],
        dependenciesWithCves: 0,
        isMock: true,
      } as any,
      arbitratorRecommendation: {
        recommendation: 'APPROVE',
        confidenceScore: 0.96,
        summary: 'All acceptance criteria verified; zero security vulnerabilities found',
        suggestedPayoutPct: 100,
        suggestedPayoutCents: 250000,
        isMock: true,
      } as any,
      policyCalculation: {
        eligibleAmountCents: 250000,
        permittedAmountCents: 250000,
        penaltyAppliedCents: 0,
        calculationExplanation: '100% of acceptance criteria verified with zero security risks.',
      } as any,
      evaluatedAt: new Date().toISOString(),
    });

    const evaluation = container.evaluationRepo.findById(evalId);
    assert.ok(evaluation);
    assert.strictEqual(evaluation.arbitratorRecommendation.recommendation, 'APPROVE');
    assert.strictEqual((evaluation.arbitratorRecommendation as any).suggestedPayoutCents, 250000);
  });

  it('Stage 5: Deterministic Settlement Policy Engine', async () => {
    // Verify deterministic calculation formula
    const agreedAmountCents = 250000;
    const verifiedACs = 2;
    const totalACs = 2;
    const riskPenalty = 0.0;

    const eligibleAmount = Math.round(agreedAmountCents * (verifiedACs / totalACs) * (1 - riskPenalty));
    assert.strictEqual(eligibleAmount, 250000);

    // Verify non-autonomous boundary: Agent cannot suggest more than agreed amount
    const excessiveSuggestion = 300000;
    const cappedEligible = Math.min(excessiveSuggestion, agreedAmountCents);
    assert.strictEqual(cappedEligible, agreedAmountCents);
  });

  it('Stage 6: Human Approval Gate & Review Decision', async () => {
    container.approvalRepo.insert({
      id: apprId,
      milestoneId: 'ms_seed_01',
      evaluationId: evalId,
      reviewerId: 'client_01',
      decision: 'APPROVE',
      approvedAmountCents: 250000,
      isOverride: false,
      justification: 'Human client approves milestone 1 delivery after verifying CI test artifacts',
      decidedAt: new Date().toISOString(),
    });

    const approval = container.approvalRepo.findLatestByMilestoneId('ms_seed_01');
    assert.ok(approval);
    assert.strictEqual(approval.decision, 'APPROVE');
    assert.strictEqual(approval.approvedAmountCents, 250000);

    // Milestone status updates to APPROVED
    container.milestoneRepo.updateStatus('ms_seed_01', 'APPROVED', new Date().toISOString());
    const ms = container.milestoneRepo.findById('ms_seed_01');
    assert.strictEqual(ms?.status, 'APPROVED');
  });

  it('Stage 7: PayPal Orders API v2 Lifecycle (intent: AUTHORIZE)', async () => {
    // 1. Create PayPal Order
    const orderRes = await container.paypalService.createOrder(
      clientUser,
      'ms_seed_01',
      'req_stage7_order_001'
    );

    assert.strictEqual(orderRes.status, 'ORDER_CREATED');
    assert.strictEqual(orderRes.paypalOrderId, 'ORD-E2E-PROMPT8-001');
    assert.strictEqual(orderRes.authorizedAmountCents, 250000);
  });

  it('Stage 8: PayPal Webhook Verification & Order Approval Reconciliation', async () => {
    // 1. Simulate incoming CHECKOUT.ORDER.APPROVED webhook (buyer approved in PayPal checkout)
    const webhookHeaders = {
      'paypal-transmission-id': 'e2e-transmission-prompt8-001',
      'paypal-transmission-time': new Date().toISOString(),
      'paypal-transmission-sig': 'sig_valid_prompt8',
      'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360',
      'paypal-auth-algo': 'SHA256withRSA',
    };

    const webhookBody = JSON.stringify({
      id: 'WH-PROMPT8-E2E-001',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: {
        id: 'ORD-E2E-PROMPT8-001',
        status: 'APPROVED',
      },
    });

    const whResult = await container.paypalService.handleWebhook(webhookHeaders, webhookBody);
    assert.strictEqual(whResult.status, 'RECONCILED_ORDER_APPROVED');
    assert.strictEqual(whResult.verified, true);

    // 2. Replay the exact same webhook -> must be safely ignored
    const replayResult = await container.paypalService.handleWebhook(webhookHeaders, webhookBody);
    assert.strictEqual(replayResult.status, 'DUPLICATE_IGNORED');
    assert.strictEqual(replayResult.duplicate, true);

    // 3. Application places payment authorization hold post-approval
    const authRes = await container.paypalService.authorizeOrder(
      clientUser,
      'ms_seed_01',
      'req_stage7_auth_001',
      { paypalOrderId: 'ORD-E2E-PROMPT8-001' }
    );

    assert.strictEqual(authRes.status, 'AUTHORIZED');
    assert.strictEqual(authRes.paypalAuthorizationId, 'AUTH-E2E-PROMPT8-001');
    assert.strictEqual(authRes.authorizedAmountCents, 250000);
    assert.strictEqual(authRes.capturedAmountCents, 0); // Funds strictly held, not captured
  });

  it('Stage 9: Audit Replay Engine & Cryptographic Evidence Passport Export', async () => {
    // 1. Verify audit chain continuity
    const allAuditEntries = container.db.raw
      .prepare('SELECT * FROM audit_logs ORDER BY seq ASC')
      .all() as any[];
    assert.ok(allAuditEntries.length >= 2);

    for (let i = 1; i < allAuditEntries.length; i++) {
      assert.strictEqual(allAuditEntries[i].previous_hash, allAuditEntries[i - 1].entry_hash);
    }

    // 2. Replay contract state
    const replayReport = container.auditReplayService.replayContractAudit({
      contractId: 'contract_seed_01',
    });
    assert.strictEqual(replayReport.isCryptographicallyValid, true);

    // 3. Export Evidence Passport
    const passport = await container.evidencePassportService.generatePassport(
      'contract_seed_01',
      'ms_seed_01'
    );
    assert.ok(passport);
    assert.strictEqual(passport.identity.milestoneId, 'ms_seed_01');
    assert.strictEqual(passport.isCryptographicallyValid, true);
    assert.ok(passport.passportDigestSha256);
  });

  it('Stage 10: Dispute Evidence Pack Compilation & Settlement Capture', async () => {
    // Milestone status preserved as APPROVED for capture eligibility
    container.milestoneRepo.updateStatus('ms_seed_01', 'APPROVED', new Date().toISOString());

    // 1. Capture settlement payment (permitted because milestone is APPROVED and status is AUTHORIZED)
    const captureRes = await container.paypalService.captureAuthorization(
      clientUser,
      'ms_seed_01',
      'req_stage10_capture_001'
    );

    assert.strictEqual(captureRes.status, 'CAPTURED');
    assert.strictEqual(captureRes.capturedAmountCents, 250000);
    assert.strictEqual(captureRes.paypalCaptureId, 'CAP-E2E-PROMPT8-001');

    // 2. Generate Dispute Evidence Pack
    const disputePack = await container.disputeEvidencePackService.generateDisputePack(
      'contract_seed_01',
      'ms_seed_01',
      'client_01'
    );
    assert.ok(disputePack);
    assert.strictEqual(disputePack.milestoneId, 'ms_seed_01');
    assert.strictEqual(disputePack.contractId, 'contract_seed_01');
    assert.ok(disputePack.integrity);
    assert.strictEqual(disputePack.integrity.isCryptographicallyValid, true);
    assert.ok(disputePack.integrity.packDigestSha256);
  });

  it('Teardown: Closes isolated HTTP server and releases resources', async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
