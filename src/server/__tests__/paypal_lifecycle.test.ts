import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createServerApp } from '../index.ts';
import {
  MilestoneProofApiError,
  MilestoneProofClient,
} from '../../sdk/MilestoneProofClient.ts';
import { PAYPAL_NON_ESCROW_DISCLOSURE } from '../services/PayPalService.ts';
import type {
  PayPalTransactionRecord,
  PayPalReconciliationReport,
  User,
  EvaluationRun,
  HumanApprovalRecord,
} from '../../types/domain.ts';

function createMockPayPalFetch(options?: {
  orderCreateShouldTimeout?: boolean;
  authShouldTimeout?: boolean;
  authShouldReturn502?: boolean;
  captureShouldTimeout?: boolean;
  captureShouldReturn504?: boolean;
  remoteOrderStatus?: string;
  remoteAuthStatus?: string;
  remoteCapStatus?: string;
  remoteOrderId?: string;
  remoteAuthId?: string;
  remoteCurrency?: string;
  remoteAmountValue?: string;
  remoteQueryShouldTimeout?: boolean;
  webhookVerifyShouldTimeout?: boolean;
}): typeof fetch {
  let seq = 1;
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_sbx_access_token_secure', token_type: 'Bearer', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/v2/checkout/orders')) {
      if (options?.orderCreateShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to PayPal orders API timed out');
      }
      const orderId = `ORD-SBX-${seq++}`;
      return new Response(
        JSON.stringify({
          id: orderId,
          status: 'CREATED',
          intent: 'AUTHORIZE',
          purchase_units: [{ amount: { currency_code: 'USD', value: '2500.00' } }],
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
      if (options?.authShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to PayPal authorize API timed out');
      }
      if (options?.authShouldReturn502) {
        return new Response(
          JSON.stringify({ name: 'BAD_GATEWAY', message: 'PayPal upstream gateway error' }),
          { status: 502, headers: { 'content-type': 'application/json' } }
        );
      }
      const authId = `AUTH-SBX-${seq++}`;
      const expiresAt = new Date(Date.now() + 29 * 86_400_000).toISOString();
      return new Response(
        JSON.stringify({
          id: 'ORD-SBX-AUTHORIZED',
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

    if (url.includes('/v2/payments/authorizations/') && url.endsWith('/capture')) {
      if (options?.captureShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to api-m.sandbox.paypal.com timed out');
      }
      if (options?.captureShouldReturn504) {
        return new Response(
          JSON.stringify({ name: 'GATEWAY_TIMEOUT', message: 'Downstream gateway timeout' }),
          { status: 504, headers: { 'content-type': 'application/json' } }
        );
      }
      const capId = `CAP-SBX-${seq++}`;
      return new Response(
        JSON.stringify({
          id: capId,
          status: 'COMPLETED',
          final_capture: true,
          amount: { currency_code: 'USD', value: '2500.00' },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    // Remote queries for reconciliation
    if (url.includes('/v2/payments/captures/')) {
      if (options?.remoteQueryShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to PayPal capture query timed out');
      }
      if (options?.remoteCapStatus === 'NOT_FOUND') {
        return new Response(JSON.stringify({ name: 'RESOURCE_NOT_FOUND' }), { status: 404 });
      }
      const capMatch = url.match(/\/captures\/([^/?]+)/);
      const parsedCapId = capMatch ? decodeURIComponent(capMatch[1]) : 'CAP-SBX-RECONCILE';
      const capAmount = options?.remoteAmountValue ?? '2500.00';
      const capCurrency = options?.remoteCurrency ?? 'USD';
      return new Response(
        JSON.stringify({
          id: parsedCapId,
          status: options?.remoteCapStatus ?? 'COMPLETED',
          amount: { currency_code: capCurrency, value: capAmount },
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/payments/authorizations/')) {
      if (options?.remoteQueryShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to PayPal auth query timed out');
      }
      if (options?.remoteAuthStatus === 'NOT_FOUND') {
        return new Response(JSON.stringify({ name: 'RESOURCE_NOT_FOUND' }), { status: 404 });
      }
      const authMatch = url.match(/\/authorizations\/([^/?]+)/);
      const parsedAuthId = options?.remoteAuthId ?? (authMatch ? decodeURIComponent(authMatch[1]) : 'AUTH-SBX-RECONCILE');
      return new Response(
        JSON.stringify({
          id: parsedAuthId,
          status: options?.remoteAuthStatus ?? 'CREATED',
          amount: { currency_code: 'USD', value: '2500.00' },
          expiration_time: new Date(Date.now() + 29 * 86_400_000).toISOString(),
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/checkout/orders/')) {
      if (options?.remoteQueryShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to PayPal orders query timed out');
      }
      if (options?.remoteOrderStatus === 'NOT_FOUND') {
        return new Response(JSON.stringify({ name: 'RESOURCE_NOT_FOUND' }), { status: 404 });
      }
      const orderMatch = url.match(/\/orders\/([^/?]+)/);
      const parsedOrderId = options?.remoteOrderId ?? (orderMatch ? decodeURIComponent(orderMatch[1]) : 'ORD-SBX-RECONCILE');
      const orderPayload: Record<string, unknown> = {
        id: parsedOrderId,
        status: options?.remoteOrderStatus ?? 'CREATED',
        intent: 'AUTHORIZE',
      };
      if (options?.remoteAuthStatus) {
        orderPayload.purchase_units = [
          {
            payments: {
              authorizations: [
                {
                  id: 'AUTH-SBX-ORDER-RECOVERED',
                  status: options.remoteAuthStatus,
                  amount: { currency_code: 'USD', value: '2500.00' },
                },
              ],
            },
          },
        ];
      }
      return new Response(JSON.stringify(orderPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
      if (options?.webhookVerifyShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to PayPal webhook verification endpoint timed out');
      }
      const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};
      const sig = String(bodyObj.transmission_sig ?? '');
      const status = sig.startsWith('sig_valid_') ? 'SUCCESS' : 'FAILURE';
      return new Response(
        JSON.stringify({ verification_status: status }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ message: 'Mock endpoint not mapped' }), { status: 404 });
  };
}

function insertApprovedEvaluation(
  container: ReturnType<typeof createServerApp>,
  milestoneId: string,
  approvedAmountCents: number = 250000,
  reviewerId: string = 'reviewer_01'
) {
  const subId = `sub_${crypto.randomUUID().slice(0, 8)}`;
  const evalId = `eval_${crypto.randomUUID().slice(0, 8)}`;
  const apprId = `appr_${crypto.randomUUID().slice(0, 8)}`;
  container.db.withTransaction(() => {
    container.evidenceRepo.insert({
      id: subId,
      milestoneId,
      attemptNumber: 1,
      submittedBy: 'dev_01',
      repoUrl: 'https://github.com/Mohamed-529/TrustChain',
      branch: 'main',
      commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
      prUrl: 'https://github.com/Mohamed-529/TrustChain/pull/1',
      prStatus: 'MERGED',
      ciReport: {
        provider: 'GITHUB_ACTIONS',
        status: 'SUCCESS',
        totalTests: 10,
        passedTests: 10,
        failedTests: 0,
        coveragePct: 95,
        runUrl: 'https://github.com/Mohamed-529/TrustChain/actions/runs/1',
        logSummary: 'All 10 tests passed',
      },
      securityScan: {
        scanner: 'SNYK',
        scannerVersion: '1.0.0',
        status: 'COMPLETED',
        findings: [],
      },
      developerNotes: 'Delivery evidence',
      submittedAt: new Date().toISOString(),
      provenanceStatus: 'VERIFIED',
    });
    container.evaluationRepo.insert({
      id: evalId,
      milestoneId,
      submissionId: subId,
      status: 'COMPLETED',
      evidenceAnalysis: { verificationStatus: 'VERIFIED', criteriaResults: [], notes: 'Pass', isMock: false } as any,
      riskAnalysis: { overallRisk: 'LOW', vulnerabilities: [], isMock: false } as any,
      arbitratorRecommendation: { recommendedAction: 'APPROVED', suggestedAmountCents: approvedAmountCents, rationale: 'Pass', isMock: false } as any,
      policyCalculation: { permittedAmountCents: 250000, passingCriteriaRatio: 1.0, riskPenaltyRatio: 0, formulaApplied: '250000', riskLevel: 'LOW' } as any,
      evaluatedAt: new Date().toISOString(),
      evaluationMode: 'DETERMINISTIC_MOCK',
      isMockEvaluation: false,
    });
    container.approvalRepo.insert({
      id: apprId,
      milestoneId,
      evaluationId: evalId,
      reviewerId,
      decision: 'APPROVE',
      approvedAmountCents,
      isOverride: false,
      justification: 'Approved for settlement',
      decidedAt: new Date().toISOString(),
    });
    container.milestoneRepo.updateStatus(milestoneId, 'APPROVED', new Date().toISOString());
  });
  return { subId, evalId, apprId };
}

describe('Prompt 5/8 — TrustChain PayPal Lifecycle Management & Authoritative Reconciliation', () => {

  it('1. verifies valid order creation with intent: AUTHORIZE, non-escrow notice, and integer cents', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    const milestoneId = 'ms_seed_01';
    const reqId = `ppreq_create_${Date.now()}`;

    const tx = await container.paypalService.createOrder(clientUser, milestoneId, reqId);

    assert.ok(tx.id.startsWith('ptx_'));
    assert.equal(tx.milestoneId, milestoneId);
    assert.ok(tx.paypalOrderId?.startsWith('ORD-SBX-'));
    assert.equal(tx.status, 'ORDER_CREATED');
    assert.equal(tx.currency, 'USD');
    assert.equal(tx.authorizedAmountCents, 250000); // 2,500.00 USD
    assert.equal(tx.nonEscrowDisclosure, PAYPAL_NON_ESCROW_DISCLOSURE);

    // Verify milestone updated
    const milestone = container.milestoneRepo.findById(milestoneId)!;
    assert.equal(milestone.paymentStatus, 'ORDER_CREATED');

    // Verify audit entry
    const audits = container.auditService.listLogs({ contractId: milestone.contractId });
    const orderAudit = audits.find((a) => a.action === 'PAYPAL_ORDER_CREATED');
    assert.ok(orderAudit, 'Expected PAYPAL_ORDER_CREATED audit log entry');
    assert.equal(orderAudit.actorId, clientUser.id);
  });

  it('2. enforces strict role boundaries: developer cannot create orders, authorize, capture, or reconcile', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const devUser = container.userRepo.findById('dev_01')!;
    const milestoneId = 'ms_seed_01';

    // 1. Developer cannot create order
    await assert.rejects(
      async () => {
        await container.paypalService.createOrder(devUser, milestoneId, 'ppreq_dev_01');
      },
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN_NOT_CONTRACT_CLIENT');
        return true;
      }
    );

    // 2. Developer cannot capture
    await assert.rejects(
      async () => {
        await container.paypalService.captureAuthorization(devUser, milestoneId, 'ppreq_dev_02');
      },
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'CAPTURE_FORBIDDEN_FOR_DEVELOPER');
        return true;
      }
    );

    // 3. Developer cannot reconcile
    await assert.rejects(
      async () => {
        await container.paypalService.reconcilePayment(devUser, milestoneId);
      },
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN_NOT_CONTRACT_FIDUCIARY');
        return true;
      }
    );
  });

  it('3. enforces 29-day authorization hold recording and prevents capture without human approval', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    const reviewerUser = container.userRepo.findById('reviewer_01')!;
    const milestoneId = 'ms_seed_01';

    // 1. Create order
    const orderTx = await container.paypalService.createOrder(clientUser, milestoneId, 'ppreq_ord_03');

    // 2. Authorize order
    const authTx = await container.paypalService.authorizeOrder(clientUser, milestoneId, 'ppreq_auth_03');
    assert.equal(authTx.status, 'AUTHORIZED');
    assert.ok(authTx.paypalAuthorizationId?.startsWith('AUTH-SBX-'));
    assert.ok(authTx.authExpiresAt);

    // Verify ~29 day validity window
    const now = Date.now();
    const expiry = new Date(authTx.authExpiresAt).getTime();
    const daysUntilExpiry = (expiry - now) / 86_400_000;
    assert.ok(daysUntilExpiry >= 28 && daysUntilExpiry <= 30);

    // 3. Attempt capture BEFORE human approval -> Must throw 409 HUMAN_APPROVAL_REQUIRED_FOR_CAPTURE
    await assert.rejects(
      async () => {
        await container.paypalService.captureAuthorization(reviewerUser, milestoneId, 'ppreq_cap_03');
      },
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'HUMAN_APPROVAL_REQUIRED_FOR_CAPTURE');
        return true;
      }
    );
  });

  it('4. verifies deterministic settlement policy cap and prevents over-capture', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    const reviewerUser = container.userRepo.findById('reviewer_01')!;
    const milestoneId = 'ms_seed_01';

    await container.paypalService.createOrder(clientUser, milestoneId, 'ppreq_ord_04');
    await container.paypalService.authorizeOrder(clientUser, milestoneId, 'ppreq_auth_04');

    // Setup an evidence submission, evaluation, and an over-budget human approval record
    const subId = `sub_${crypto.randomUUID().slice(0, 8)}`;
    const evalId = `eval_${crypto.randomUUID().slice(0, 8)}`;
    container.db.withTransaction(() => {
      container.evidenceRepo.insert({
        id: subId,
        milestoneId,
        attemptNumber: 1,
        submittedBy: 'dev_01',
        repoUrl: 'https://github.com/Mohamed-529/TrustChain',
        branch: 'main',
        commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
        prUrl: 'https://github.com/Mohamed-529/TrustChain/pull/1',
        prStatus: 'MERGED',
        ciReport: {
          provider: 'GITHUB_ACTIONS',
          status: 'SUCCESS',
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          coveragePct: 95,
          runUrl: 'https://github.com/Mohamed-529/TrustChain/actions/runs/1',
          logSummary: 'All 10 tests passed',
        },
        securityScan: {
          scanner: 'SNYK',
          scannerVersion: '1.0.0',
          status: 'COMPLETED',
          findings: [],
        },
        developerNotes: 'Delivery evidence',
        submittedAt: new Date().toISOString(),
        provenanceStatus: 'VERIFIED',
      });
      container.evaluationRepo.insert({
        id: evalId,
        milestoneId,
        submissionId: subId,
        status: 'COMPLETED',
        evidenceAnalysis: {
          verificationStatus: 'VERIFIED',
          criteriaResults: [],
          notes: 'Test eval',
          isMock: false,
        } as any,
        riskAnalysis: {
          overallRisk: 'LOW',
          vulnerabilities: [],
          isMock: false,
        } as any,
        arbitratorRecommendation: {
          recommendedAction: 'APPROVED',
          suggestedAmountCents: 100000,
          rationale: 'Partial pass',
          isMock: false,
        } as any,
        policyCalculation: {
          permittedAmountCents: 100000, // Policy permitted $1000.00
          passingCriteriaRatio: 0.4,
          riskPenaltyRatio: 0,
          formulaApplied: '250000 * 0.4',
          riskLevel: 'LOW',
        } as any,
        evaluatedAt: new Date().toISOString(),
        evaluationMode: 'DETERMINISTIC_MOCK',
        isMockEvaluation: false,
      });

      // Human approval attempted to approve $3000.00 (exceeding permitted $1000.00 and agreed $2500.00)
      container.approvalRepo.insert({
        id: `appr_${crypto.randomUUID().slice(0, 8)}`,
        milestoneId,
        evaluationId: evalId,
        reviewerId: reviewerUser.id,
        decision: 'APPROVE',
        approvedAmountCents: 300000,
        isOverride: false,
        justification: 'Attempted over-approval',
        decidedAt: new Date().toISOString(),
      });

      // Set milestone status to APPROVED so it reaches the policy cap check
      container.milestoneRepo.updateStatus(milestoneId, 'APPROVED', new Date().toISOString());
    });

    // Attempt capture: must reject over-capture bounds
    await assert.rejects(
      async () => {
        await container.paypalService.captureAuthorization(reviewerUser, milestoneId, 'ppreq_cap_04');
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_CAPTURE_AMOUNT_BOUNDS');
        return true;
      }
    );
  });

  it('5. enforces PayPal-Request-Id idempotency and prevents reuse across milestones', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    const milestoneId1 = 'ms_seed_01';
    const milestoneId2 = 'ms_seed_02';
    const sharedIdempotencyKey = 'ppreq_idempotent_test_001';

    // 1. Initial createOrder succeeds
    const tx1 = await container.paypalService.createOrder(clientUser, milestoneId1, sharedIdempotencyKey);
    assert.equal(tx1.milestoneId, milestoneId1);

    // 2. Replaying with identical key on same milestone returns exact same record (idempotency)
    const txReplay = await container.paypalService.createOrder(clientUser, milestoneId1, sharedIdempotencyKey);
    assert.equal(txReplay.id, tx1.id);
    assert.equal(txReplay.paypalOrderId, tx1.paypalOrderId);

    // 3. Attempting to reuse same key for a different milestone must fail with 409 conflict
    await assert.rejects(
      async () => {
        await container.paypalService.createOrder(clientUser, milestoneId2, sharedIdempotencyKey);
      },
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'IDEMPOTENCY_KEY_REUSE_CONFLICT');
        return true;
      }
    );
  });

  it('6. handles capture network timeout by recording REQUIRES_RECONCILIATION and emits audit log', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ captureShouldTimeout: true }),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    const reviewerUser = container.userRepo.findById('reviewer_01')!;
    const milestoneId = 'ms_seed_01';

    await container.paypalService.createOrder(clientUser, milestoneId, 'ppreq_ord_06');
    await container.paypalService.authorizeOrder(clientUser, milestoneId, 'ppreq_auth_06');

    // Setup valid evaluation and approval
    const subId = `sub_${crypto.randomUUID().slice(0, 8)}`;
    const evalId = `eval_${crypto.randomUUID().slice(0, 8)}`;
    container.db.withTransaction(() => {
      container.evidenceRepo.insert({
        id: subId,
        milestoneId,
        attemptNumber: 1,
        submittedBy: 'dev_01',
        repoUrl: 'https://github.com/Mohamed-529/TrustChain',
        branch: 'main',
        commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
        prUrl: 'https://github.com/Mohamed-529/TrustChain/pull/1',
        prStatus: 'MERGED',
        ciReport: {
          provider: 'GITHUB_ACTIONS',
          status: 'SUCCESS',
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          coveragePct: 95,
          runUrl: 'https://github.com/Mohamed-529/TrustChain/actions/runs/1',
          logSummary: 'All 10 tests passed',
        },
        securityScan: {
          scanner: 'SNYK',
          scannerVersion: '1.0.0',
          status: 'COMPLETED',
          findings: [],
        },
        developerNotes: 'Delivery evidence',
        submittedAt: new Date().toISOString(),
        provenanceStatus: 'VERIFIED',
      });
      container.evaluationRepo.insert({
        id: evalId,
        milestoneId,
        submissionId: subId,
        status: 'COMPLETED',
        evidenceAnalysis: {
          verificationStatus: 'VERIFIED',
          criteriaResults: [],
          notes: 'Test eval',
          isMock: false,
        } as any,
        riskAnalysis: {
          overallRisk: 'LOW',
          vulnerabilities: [],
          isMock: false,
        } as any,
        arbitratorRecommendation: {
          recommendedAction: 'APPROVED',
          suggestedAmountCents: 250000,
          rationale: 'Pass',
          isMock: false,
        } as any,
        policyCalculation: {
          permittedAmountCents: 250000,
          passingCriteriaRatio: 1.0,
          riskPenaltyRatio: 0,
          formulaApplied: '250000 * 1.0',
          riskLevel: 'LOW',
        } as any,
        evaluatedAt: new Date().toISOString(),
        evaluationMode: 'DETERMINISTIC_MOCK',
        isMockEvaluation: false,
      });
      container.approvalRepo.insert({
        id: `appr_${crypto.randomUUID().slice(0, 8)}`,
        milestoneId,
        evaluationId: evalId,
        reviewerId: reviewerUser.id,
        decision: 'APPROVE',
        approvedAmountCents: 250000,
        isOverride: false,
        justification: 'Full approval',
        decidedAt: new Date().toISOString(),
      });
      container.milestoneRepo.updateStatus(milestoneId, 'APPROVED', new Date().toISOString());
    });

    // Capture attempt encounters simulated network timeout
    await assert.rejects(
      async () => {
        await container.paypalService.captureAuthorization(reviewerUser, milestoneId, 'ppreq_cap_06');
      },
      (err: any) => {
        assert.equal(err.statusCode, 504);
        assert.equal(err.code, 'PAYPAL_CAPTURE_TIMEOUT_REQUIRES_RECONCILIATION');
        return true;
      }
    );

    // Verify record in REQUIRES_RECONCILIATION state
    const latestTx = container.paymentRepo.findLatestByMilestoneId(milestoneId)!;
    assert.equal(latestTx.status, 'REQUIRES_RECONCILIATION');

    // Verify audit log
    const milestone = container.milestoneRepo.findById(milestoneId)!;
    const audits = container.auditService.listLogs({ contractId: milestone.contractId });
    const timeoutAudit = audits.find((a) => a.action === 'PAYPAL_CAPTURE_AMBIGUOUS_TIMEOUT');
    assert.ok(timeoutAudit, 'Expected PAYPAL_CAPTURE_AMBIGUOUS_TIMEOUT audit record');
  });

  it('7. authoritative reconciliation resolves ambiguous REQUIRES_RECONCILIATION state to CAPTURED when remote PayPal succeeded', async () => {
    // Mock fetch where capture times out initially, but remote record shows capture completed
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ captureShouldTimeout: true, remoteCapStatus: 'COMPLETED' }),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    const reviewerUser = container.userRepo.findById('reviewer_01')!;
    const milestoneId = 'ms_seed_01';

    await container.paypalService.createOrder(clientUser, milestoneId, 'ppreq_ord_07');
    await container.paypalService.authorizeOrder(clientUser, milestoneId, 'ppreq_auth_07');

    const subId = `sub_${crypto.randomUUID().slice(0, 8)}`;
    const evalId = `eval_${crypto.randomUUID().slice(0, 8)}`;
    container.db.withTransaction(() => {
      container.evidenceRepo.insert({
        id: subId,
        milestoneId,
        attemptNumber: 1,
        submittedBy: 'dev_01',
        repoUrl: 'https://github.com/Mohamed-529/TrustChain',
        branch: 'main',
        commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
        prUrl: 'https://github.com/Mohamed-529/TrustChain/pull/1',
        prStatus: 'MERGED',
        ciReport: {
          provider: 'GITHUB_ACTIONS',
          status: 'SUCCESS',
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          coveragePct: 95,
          runUrl: 'https://github.com/Mohamed-529/TrustChain/actions/runs/1',
          logSummary: 'All 10 tests passed',
        },
        securityScan: {
          scanner: 'SNYK',
          scannerVersion: '1.0.0',
          status: 'COMPLETED',
          findings: [],
        },
        developerNotes: 'Delivery evidence',
        submittedAt: new Date().toISOString(),
        provenanceStatus: 'VERIFIED',
      });
      container.evaluationRepo.insert({
        id: evalId,
        milestoneId,
        submissionId: subId,
        status: 'COMPLETED',
        evidenceAnalysis: {
          verificationStatus: 'VERIFIED',
          criteriaResults: [],
          notes: 'Test eval',
          isMock: false,
        } as any,
        riskAnalysis: {
          overallRisk: 'LOW',
          vulnerabilities: [],
          isMock: false,
        } as any,
        arbitratorRecommendation: {
          recommendedAction: 'APPROVED',
          suggestedAmountCents: 250000,
          rationale: 'Pass',
          isMock: false,
        } as any,
        policyCalculation: {
          permittedAmountCents: 250000,
          passingCriteriaRatio: 1.0,
          riskPenaltyRatio: 0,
          formulaApplied: '250000 * 1.0',
          riskLevel: 'LOW',
        } as any,
        evaluatedAt: new Date().toISOString(),
        evaluationMode: 'DETERMINISTIC_MOCK',
        isMockEvaluation: false,
      });
      container.approvalRepo.insert({
        id: `appr_${crypto.randomUUID().slice(0, 8)}`,
        milestoneId,
        evaluationId: evalId,
        reviewerId: reviewerUser.id,
        decision: 'APPROVE',
        approvedAmountCents: 250000,
        isOverride: false,
        justification: 'Full approval',
        decidedAt: new Date().toISOString(),
      });
      container.milestoneRepo.updateStatus(milestoneId, 'APPROVED', new Date().toISOString());
    });

    // Step 1: Capture times out, sets REQUIRES_RECONCILIATION
    try {
      await container.paypalService.captureAuthorization(reviewerUser, milestoneId, 'ppreq_cap_07');
    } catch {
      // expected 504
    }

    const txBefore = container.paymentRepo.findLatestByMilestoneId(milestoneId)!;
    assert.equal(txBefore.status, 'REQUIRES_RECONCILIATION');

    // Step 2: Set paypalCaptureId on the transaction record so remote check inspects capture
    container.db.withTransaction(() => {
      container.paymentRepo.update({
        ...txBefore,
        paypalCaptureId: 'CAP-SBX-RECONCILE',
      });
    });

    const report: PayPalReconciliationReport = await container.paypalService.reconcilePayment(clientUser, milestoneId);

    assert.equal(report.outcome, 'RECONCILED_LOCAL_UPDATED');
    assert.equal(report.actionTaken, 'UPDATED_LOCAL_TO_CAPTURED_AND_SETTLED');
    assert.ok(report.discrepancies.length > 0);

    // Verify local status updated to CAPTURED and milestone to SETTLED
    const txAfter = container.paymentRepo.findLatestByMilestoneId(milestoneId)!;
    assert.equal(txAfter.status, 'CAPTURED');

    const mAfter = container.milestoneRepo.findById(milestoneId)!;
    assert.equal(mAfter.status, 'SETTLED');
    assert.equal(mAfter.paymentStatus, 'CAPTURED');

    // Verify reconciliation audit log
    const audits = container.auditService.listLogs({ contractId: mAfter.contractId });
    const reconAudit = audits.find((a) => a.action === 'PAYPAL_PAYMENT_RECONCILED');
    assert.ok(reconAudit, 'Expected PAYPAL_PAYMENT_RECONCILED audit log entry');
    assert.equal(reconAudit.actorId, clientUser.id);
  });

  it('8. rejects untrusted webhook cert URL and verifies webhook signature', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
        webhookId: 'WH-MOCK-001',
      },
    });

    const validPayload = {
      id: 'WH-EVT-001',
      event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
      resource: { id: 'AUTH-SBX-01' },
    };

    // 1. Untrusted Cert URL -> must reject with 401
    await assert.rejects(
      async () => {
        await container.paypalService.handleWebhook(
          {
            'paypal-transmission-id': 'trans_01',
            'paypal-transmission-time': new Date().toISOString(),
            'paypal-transmission-sig': 'sig_valid_01',
            'paypal-cert-url': 'https://evil-hacker.com/cert.pem', // Untrusted domain
            'paypal-auth-algo': 'SHA256withRSA',
          },
          validPayload
        );
      },
      (err: any) => {
        assert.equal(err.statusCode, 401);
        assert.equal(err.code, 'UNTRUSTED_PAYPAL_CERT_URL');
        return true;
      }
    );

    // 2. Invalid Signature -> rejected
    await assert.rejects(
      async () => {
        await container.paypalService.handleWebhook(
          {
            'paypal-transmission-id': 'trans_02',
            'paypal-transmission-time': new Date().toISOString(),
            'paypal-transmission-sig': 'sig_invalid_forged',
            'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123',
            'paypal-auth-algo': 'SHA256withRSA',
          },
          validPayload
        );
      },
      (err: any) => {
        assert.equal(err.statusCode, 401);
        return true;
      }
    );
  });

  it('9. ensures zero tokens or secrets are leaked into audit logs or response payloads', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_supersecret',
        clientSecret: 'mock_client_secret_verysecret',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    const milestoneId = 'ms_seed_01';

    const tx = await container.paypalService.createOrder(clientUser, milestoneId, 'ppreq_secret_check');

    // Check tx response string
    const txJson = JSON.stringify(tx);
    assert.ok(!txJson.includes('mock_client_secret_verysecret'));
    assert.ok(!txJson.includes('mock_sbx_access_token_secure'));

    // Check audit logs
    const milestone = container.milestoneRepo.findById(milestoneId)!;
    const audits = container.auditService.listLogs({ contractId: milestone.contractId });
    for (const log of audits) {
      const logStr = JSON.stringify(log);
      assert.ok(!logStr.includes('mock_client_secret_verysecret'), 'Secret leaked in audit log!');
      assert.ok(!logStr.includes('mock_sbx_access_token_secure'), 'Token leaked in audit log!');
    }
  });

  it('10. verifies REST endpoint GET & POST /api/v1/milestones/:id/paypal/reconcile with HTTP server', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      server.close();
      container.db.close();
      throw new Error('Failed to bind ephemeral port');
    }

    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
    const sdk = new MilestoneProofClient({ baseUrl });

    try {
      // 1. Switch to Client persona
      const session = await sdk.switchDemoPersona({ userId: 'client_01' });
      assert.equal(session.user.role, 'CLIENT');

      // 2. Call reconcile via fetch
      const res = await fetch(`${baseUrl}/milestones/ms_seed_01/paypal/reconcile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'Content-Type': 'application/json',
        },
      });

      assert.equal(res.status, 200);
      const data = (await res.json()) as { reconciliation: PayPalReconciliationReport };
      assert.ok(data.reconciliation);
      assert.equal(data.reconciliation.milestoneId, 'ms_seed_01');
      assert.ok(['IN_SYNC', 'RECONCILED_LOCAL_UPDATED', 'REMOTE_RECORD_NOT_FOUND'].includes(data.reconciliation.outcome));

      // 3. Switch to Developer persona -> Must receive 403 Forbidden
      const devSession = await sdk.switchDemoPersona({ userId: 'dev_01' });
      const devRes = await fetch(`${baseUrl}/milestones/ms_seed_01/paypal/reconcile`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${devSession.token}`,
          'Content-Type': 'application/json',
        },
      });
      assert.equal(devRes.status, 403);
    } finally {
      server.close();
      container.db.close();
    }
  });

  it('12. verifies webhook security and idempotency across 10 distinct security & protocol test cases', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
        webhookId: 'WH-MOCK-ID-SECURE',
      },
    });

    try {
      const milestoneId = 'ms_seed_01';
      const clientUser = container.userRepo.findById('client_01')!;
      const reviewerUser = container.userRepo.findById('reviewer_01')!;

      // Setup milestone with approved amount $2500.00
      await container.paypalService.createOrder(clientUser, milestoneId, 'ppreq_wh_ord_12');
      const authTx = await container.paypalService.authorizeOrder(clientUser, milestoneId, 'ppreq_wh_auth_12');

      const validHeaders: Record<string, string> = {
        'paypal-transmission-id': 'txid-wh-12-001',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-transmission-sig': 'sig_valid_signature_hash',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1234',
        'paypal-auth-algo': 'SHA256withRSA',
      };

      // Case 1: Valid signature -> verified: true, status: VERIFIED_LOGGED
      const case1 = await container.paypalService.handleWebhook(validHeaders, {
        id: 'WH-EVT-12-01',
        event_type: 'PAYMENT.AUTHORIZATION.CREATED',
        resource: { id: authTx.paypalAuthorizationId },
      });
      assert.equal(case1.verified, true);
      assert.equal(case1.status, 'VERIFIED_LOGGED');
      assert.equal(case1.duplicate, false);

      // Case 2: Invalid signature -> throws 401 PAYPAL_WEBHOOK_VERIFICATION_FAILED
      const invalidSigHeaders = {
        ...validHeaders,
        'paypal-transmission-id': 'txid-wh-12-002',
        'paypal-transmission-sig': 'sig_invalid_bad_signature',
      };
      await assert.rejects(
        async () => {
          await container.paypalService.handleWebhook(invalidSigHeaders, {
            id: 'WH-EVT-12-02',
            event_type: 'PAYMENT.AUTHORIZATION.CREATED',
            resource: { id: authTx.paypalAuthorizationId },
          });
        },
        { name: 'AppError', statusCode: 401, code: 'INVALID_PAYPAL_WEBHOOK_SIGNATURE' }
      );

      // Case 3: Missing mandatory headers -> throws 401 MISSING_PAYPAL_WEBHOOK_HEADERS
      await assert.rejects(
        async () => {
          await container.paypalService.handleWebhook({}, {
            id: 'WH-EVT-12-03',
            event_type: 'PAYMENT.AUTHORIZATION.CREATED',
            resource: { id: authTx.paypalAuthorizationId },
          });
        },
        { name: 'AppError', statusCode: 401, code: 'MISSING_PAYPAL_WEBHOOK_HEADERS' }
      );

      // Case 4: Duplicate delivery -> returns duplicate: true, status: DUPLICATE_IGNORED
      const case4 = await container.paypalService.handleWebhook(validHeaders, {
        id: 'WH-EVT-12-01', // Repeated event ID from Case 1
        event_type: 'PAYMENT.AUTHORIZATION.CREATED',
        resource: { id: authTx.paypalAuthorizationId },
      });
      assert.equal(case4.verified, true);
      assert.equal(case4.duplicate, true);
      assert.equal(case4.status, 'DUPLICATE_IGNORED');

      // Case 5: Unknown event types on active transaction -> logged as VERIFIED_UNKNOWN_EVENT_NOOP
      const case5 = await container.paypalService.handleWebhook(
        { ...validHeaders, 'paypal-transmission-id': 'txid-wh-12-005' },
        {
          id: 'WH-EVT-12-05',
          event_type: 'UNKNOWN.UNRECOGNIZED.EVENT',
          resource: { id: authTx.paypalAuthorizationId },
        }
      );
      assert.equal(case5.verified, true);
      assert.equal(case5.status, 'VERIFIED_UNKNOWN_EVENT_NOOP');

      // Case 6: Unrelated resource ID -> VERIFIED_UNMATCHED_RESOURCE_NOOP
      const case6 = await container.paypalService.handleWebhook(
        { ...validHeaders, 'paypal-transmission-id': 'txid-wh-12-006' },
        {
          id: 'WH-EVT-12-06',
          event_type: 'PAYMENT.ORDER.CREATED',
          resource: { id: 'ORD-UNRELATED-99999' },
        }
      );
      assert.equal(case6.verified, true);
      assert.equal(case6.status, 'VERIFIED_UNMATCHED_RESOURCE_NOOP');

      // Case 7: Amount mismatch on capture webhook -> REJECTED_AMOUNT_MISMATCH
      insertApprovedEvaluation(container, milestoneId, 250000, reviewerUser.id);
      container.db.withTransaction(() => {
        container.paymentRepo.update({
          ...authTx,
          status: 'CAPTURE_PENDING',
          paypalCaptureId: 'CAP-WH-MISMATCH-12',
        });
      });

      const case7 = await container.paypalService.handleWebhook(
        { ...validHeaders, 'paypal-transmission-id': 'txid-wh-12-007' },
        {
          id: 'WH-EVT-12-07',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'CAP-WH-MISMATCH-12',
            amount: { currency_code: 'USD', value: '10.00' }, // Mismatch: $10.00 vs $2500.00
          },
        }
      );
      assert.equal(case7.verified, true);
      assert.equal(case7.status, 'REJECTED_AMOUNT_MISMATCH');

      // Case 8: Replay attempts -> duplicate: true, DUPLICATE_IGNORED
      const case8 = await container.paypalService.handleWebhook(
        { ...validHeaders, 'paypal-transmission-id': 'txid-wh-12-007' },
        {
          id: 'WH-EVT-12-07',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: 'CAP-WH-MISMATCH-12' },
        }
      );
      assert.equal(case8.duplicate, true);
      assert.equal(case8.status, 'DUPLICATE_IGNORED');

      // Case 9: Out-of-order delivery -> VOIDED arriving after CAPTURED preserves TERMINAL_STATE_PRESERVED
      // Transition to captured & settled
      container.db.withTransaction(() => {
        container.paymentRepo.update({
          ...authTx,
          status: 'CAPTURED',
          paypalCaptureId: 'CAP-SBX-ORDER-12',
          capturedAmountCents: 250000,
        });
        container.milestoneRepo.updatePaymentStatus(milestoneId, 'CAPTURED', 'SETTLED', new Date().toISOString());
      });

      const case9 = await container.paypalService.handleWebhook(
        { ...validHeaders, 'paypal-transmission-id': 'txid-wh-12-009' },
        {
          id: 'WH-EVT-12-09',
          event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
          resource: { id: authTx.paypalAuthorizationId },
        }
      );
      assert.equal(case9.verified, true);
      assert.equal(case9.status, 'TERMINAL_STATE_PRESERVED');
      // Verify milestone is STILL SETTLED
      const msAfterOutOrder = container.milestoneRepo.findById(milestoneId)!;
      assert.equal(msAfterOutOrder.status, 'SETTLED');
      assert.equal(msAfterOutOrder.paymentStatus, 'CAPTURED');

      // Case 10: Verification endpoint timeout / 503 -> fails closed
      const containerTimeout = createServerApp({
        dbPath: ':memory:',
        authOptions: { enableDemoImpersonation: true },
        paypalOptions: {
          fetchImpl: createMockPayPalFetch({ webhookVerifyShouldTimeout: true }),
          clientId: 'mock_client_id_test',
          clientSecret: 'mock_client_secret_test',
          webhookId: 'WH-MOCK-ID-SECURE',
        },
      });
      try {
        await assert.rejects(
          async () => {
            await containerTimeout.paypalService.handleWebhook(validHeaders, {
              id: 'WH-EVT-12-10',
              event_type: 'PAYMENT.AUTHORIZATION.CREATED',
              resource: { id: 'AUTH-TIMEOUT-12' },
            });
          },
          { name: 'AppError', statusCode: 503, code: 'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE' }
        );
      } finally {
        containerTimeout.db.close();
      }
    } finally {
      container.db.close();
    }
  });

  it('13. verifies complete failure and recovery lifecycle with authoritative reconciliation', async () => {
    // 13.1 Order create network timeout -> throws 504 PAYPAL_ORDER_CREATE_TIMEOUT
    const containerTimeoutOrder = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ orderCreateShouldTimeout: true }),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    try {
      const clientUser = containerTimeoutOrder.userRepo.findById('client_01')!;
      await assert.rejects(
        async () => {
          await containerTimeoutOrder.paypalService.createOrder(clientUser, 'ms_seed_01', 'idemp_timeout_ord');
        },
        { name: 'AppError', statusCode: 504, code: 'PAYPAL_ORDER_CREATE_TIMEOUT' }
      );
    } finally {
      containerTimeoutOrder.db.close();
    }

    // 13.2 Authorize network timeout -> records REQUIRES_RECONCILIATION, recovered via reconcile to AUTHORIZED
    const containerTimeoutAuth = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ authShouldTimeout: true }),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    try {
      const clientUser = containerTimeoutAuth.userRepo.findById('client_01')!;
      await containerTimeoutAuth.paypalService.createOrder(clientUser, 'ms_seed_01', 'idemp_auth_ord');

      await assert.rejects(
        async () => {
          await containerTimeoutAuth.paypalService.authorizeOrder(clientUser, 'ms_seed_01', 'idemp_auth_timeout');
        },
        { name: 'AppError', statusCode: 504, code: 'PAYPAL_AUTHORIZE_TIMEOUT_REQUIRES_RECONCILIATION' }
      );

      const txAuthTimeout = containerTimeoutAuth.paymentRepo.findLatestByMilestoneId('ms_seed_01')!;
      assert.equal(txAuthTimeout.status, 'REQUIRES_RECONCILIATION');

      // Now switch fetch to working mode and reconcile -> state recovers to AUTHORIZED
      containerTimeoutAuth.paypalService.setFetchImpl(createMockPayPalFetch({ remoteAuthStatus: 'CREATED' }));
      const recReport = await containerTimeoutAuth.paypalService.reconcilePayment(clientUser, 'ms_seed_01');
      assert.equal(recReport.outcome, 'RECONCILED_LOCAL_UPDATED');
      assert.equal(recReport.actionTaken, 'UPDATED_LOCAL_TO_AUTHORIZED');

      const txAuthRecovered = containerTimeoutAuth.paymentRepo.findLatestByMilestoneId('ms_seed_01')!;
      assert.equal(txAuthRecovered.status, 'AUTHORIZED');
    } finally {
      containerTimeoutAuth.db.close();
    }

    // 13.3 Capture network timeout -> records REQUIRES_RECONCILIATION, recovered via reconcile to CAPTURED/SETTLED
    const containerTimeoutCap = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ captureShouldTimeout: true }),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    try {
      const clientUser = containerTimeoutCap.userRepo.findById('client_01')!;
      const reviewerUser = containerTimeoutCap.userRepo.findById('reviewer_01')!;

      await containerTimeoutCap.paypalService.createOrder(clientUser, 'ms_seed_01', 'idemp_cap_ord');
      await containerTimeoutCap.paypalService.authorizeOrder(clientUser, 'ms_seed_01', 'idemp_cap_auth');

      // Insert evidence, evaluation, and human approval
      insertApprovedEvaluation(containerTimeoutCap, 'ms_seed_01', 250000, reviewerUser.id);

      await assert.rejects(
        async () => {
          await containerTimeoutCap.paypalService.captureAuthorization(reviewerUser, 'ms_seed_01', 'idemp_cap_timeout');
        },
        { name: 'AppError', statusCode: 504, code: 'PAYPAL_CAPTURE_TIMEOUT_REQUIRES_RECONCILIATION' }
      );

      const txCapTimeout = containerTimeoutCap.paymentRepo.findLatestByMilestoneId('ms_seed_01')!;
      assert.equal(txCapTimeout.status, 'REQUIRES_RECONCILIATION');

      // Reconcile with remote capture confirmed COMPLETED
      containerTimeoutCap.paypalService.setFetchImpl(
        createMockPayPalFetch({ remoteCapStatus: 'COMPLETED' })
      );
      containerTimeoutCap.db.withTransaction(() => {
        containerTimeoutCap.paymentRepo.update({
          ...txCapTimeout,
          paypalCaptureId: 'CAP-SBX-RECOVERED-13',
        });
      });

      const recCapReport = await containerTimeoutCap.paypalService.reconcilePayment(clientUser, 'ms_seed_01');
      assert.equal(recCapReport.outcome, 'RECONCILED_LOCAL_UPDATED');
      assert.equal(recCapReport.actionTaken, 'UPDATED_LOCAL_TO_CAPTURED_AND_SETTLED');

      const msFinal = containerTimeoutCap.milestoneRepo.findById('ms_seed_01')!;
      assert.equal(msFinal.status, 'SETTLED');
      assert.equal(msFinal.paymentStatus, 'CAPTURED');

      // 13.5 Repeated reconciliation on already SETTLED milestone -> returns NO_OP_ALREADY_SETTLED
      const repeatedReport = await containerTimeoutCap.paypalService.reconcilePayment(clientUser, 'ms_seed_01');
      assert.equal(repeatedReport.outcome, 'IN_SYNC');
      assert.equal(repeatedReport.actionTaken, 'NO_OP_ALREADY_SETTLED');

      // 13.6 Concurrent reconciliation requests rejection (HTTP 409 RECONCILIATION_IN_PROGRESS)
      // Simulate lock by adding to activeReconciliationLocks via private access
      (containerTimeoutCap.paypalService as any).activeReconciliationLocks.add('ms_seed_01');
      try {
        await assert.rejects(
          async () => {
            await containerTimeoutCap.paypalService.reconcilePayment(clientUser, 'ms_seed_01');
          },
          { name: 'AppError', statusCode: 409, code: 'RECONCILIATION_IN_PROGRESS' }
        );
      } finally {
        (containerTimeoutCap.paypalService as any).activeReconciliationLocks.delete('ms_seed_01');
      }
    } finally {
      containerTimeoutCap.db.close();
    }

    // 13.7 Remote identifier mismatch flags MANUAL_INTERVENTION_REQUIRED
    const containerMismatch = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ remoteOrderStatus: 'CREATED' }),
        clientId: 'mock_client_id_test',
        clientSecret: 'mock_client_secret_test',
      },
    });

    try {
      const clientUser = containerMismatch.userRepo.findById('client_01')!;
      await containerMismatch.paypalService.createOrder(clientUser, 'ms_seed_01', 'idemp_mis_ord');
      await containerMismatch.paypalService.authorizeOrder(clientUser, 'ms_seed_01', 'idemp_mis_auth');

      // Configure remote fetch to return a mismatched order ID
      containerMismatch.paypalService.setFetchImpl(
        createMockPayPalFetch({ remoteOrderId: 'ORD-MISMATCHED-REMOTE-ID' })
      );
      const txToMismat = containerMismatch.paymentRepo.findLatestByMilestoneId('ms_seed_01')!;
      containerMismatch.db.withTransaction(() => {
        containerMismatch.paymentRepo.update({
          ...txToMismat,
          status: 'REQUIRES_RECONCILIATION',
        });
      });

      const mismatchReport = await containerMismatch.paypalService.reconcilePayment(clientUser, 'ms_seed_01');
      assert.equal(mismatchReport.outcome, 'MANUAL_INTERVENTION_REQUIRED');
      assert.equal(mismatchReport.actionTaken, 'FLAGGED_IDENTIFIER_MISMATCH');

      // 13.8 Remote currency mismatch flags FLAGGED_CURRENCY_MISMATCH without settling
      const containerCurr = createServerApp({
        dbPath: ':memory:',
        authOptions: { enableDemoImpersonation: true },
        paypalOptions: {
          fetchImpl: createMockPayPalFetch({ remoteCapStatus: 'COMPLETED', remoteCurrency: 'EUR' }),
          clientId: 'mock_client_id_test',
          clientSecret: 'mock_client_secret_test',
        },
      });

      try {
        const clientU = containerCurr.userRepo.findById('client_01')!;
        const reviewerU = containerCurr.userRepo.findById('reviewer_01')!;
        await containerCurr.paypalService.createOrder(clientU, 'ms_seed_01', 'idemp_curr_ord');
        const currAuth = await containerCurr.paypalService.authorizeOrder(clientU, 'ms_seed_01', 'idemp_curr_auth');

        insertApprovedEvaluation(containerCurr, 'ms_seed_01', 250000, reviewerU.id);
        containerCurr.db.withTransaction(() => {
          containerCurr.paymentRepo.update({
            ...currAuth,
            status: 'CAPTURE_PENDING',
            paypalCaptureId: 'CAP-EUR-1234',
            updatedAt: new Date(Date.now() + 1000).toISOString(),
          });
        });

        const currReport = await containerCurr.paypalService.reconcilePayment(clientU, 'ms_seed_01');
        assert.equal(currReport.outcome, 'MANUAL_INTERVENTION_REQUIRED');
        assert.equal(currReport.actionTaken, 'FLAGGED_CURRENCY_MISMATCH');
        // Milestone must NOT be settled
        assert.notEqual(containerCurr.milestoneRepo.findById('ms_seed_01')!.status, 'SETTLED');
      } finally {
        containerCurr.db.close();
      }

      // 13.9 Double-credit attempt: remote capture ID already in DB for another transaction
      const containerDouble = createServerApp({
        dbPath: ':memory:',
        authOptions: { enableDemoImpersonation: true },
        paypalOptions: {
          fetchImpl: createMockPayPalFetch({ remoteCapStatus: 'COMPLETED' }),
          clientId: 'mock_client_id_test',
          clientSecret: 'mock_client_secret_test',
        },
      });

      try {
        const clientU = containerDouble.userRepo.findById('client_01')!;
        const reviewerU = containerDouble.userRepo.findById('reviewer_01')!;
        await containerDouble.paypalService.createOrder(clientU, 'ms_seed_01', 'idemp_dbl_ord');
        const dblAuth = await containerDouble.paypalService.authorizeOrder(clientU, 'ms_seed_01', 'idemp_dbl_auth');

        insertApprovedEvaluation(containerDouble, 'ms_seed_01', 250000, reviewerU.id);
        containerDouble.db.withTransaction(() => {
          containerDouble.paymentRepo.insert({
            id: 'ptx_prior_credited',
            milestoneId: 'ms_seed_02',
            approvalId: null,
            paypalOrderId: 'ORD-PRIOR',
            paypalAuthorizationId: 'AUTH-PRIOR',
            paypalCaptureId: 'CAP-DUPLICATE-CREDIT',
            idempotencyKey: 'idemp_prior',
            authorizedAmountCents: 250000,
            capturedAmountCents: 250000,
            currency: 'USD',
            status: 'CAPTURED',
            executionMode: 'PAYPAL_SANDBOX',
            nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
            authExpiresAt: null,
            rawPaypalResponse: {},
            updatedAt: new Date().toISOString(),
          });

          containerDouble.paymentRepo.update({
            ...dblAuth,
            status: 'CAPTURE_PENDING',
            paypalCaptureId: 'CAP-DUPLICATE-CREDIT',
            updatedAt: new Date(Date.now() + 1000).toISOString(),
          });
        });

        const dblReport = await containerDouble.paypalService.reconcilePayment(clientU, 'ms_seed_01');
        assert.equal(dblReport.outcome, 'MANUAL_INTERVENTION_REQUIRED');
        assert.equal(dblReport.actionTaken, 'FLAGGED_DOUBLE_CREDIT_ATTEMPT');
        assert.notEqual(containerDouble.milestoneRepo.findById('ms_seed_01')!.status, 'SETTLED');
      } finally {
        containerDouble.db.close();
      }

      // 13.10 Missing human approval during remote capture reconciliation -> FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE
      const containerNoAppr = createServerApp({
        dbPath: ':memory:',
        authOptions: { enableDemoImpersonation: true },
        paypalOptions: {
          fetchImpl: createMockPayPalFetch({ remoteCapStatus: 'COMPLETED' }),
          clientId: 'mock_client_id_test',
          clientSecret: 'mock_client_secret_test',
        },
      });

      try {
        const clientU = containerNoAppr.userRepo.findById('client_01')!;
        await containerNoAppr.paypalService.createOrder(clientU, 'ms_seed_01', 'idemp_noappr_ord');
        const authRec = await containerNoAppr.paypalService.authorizeOrder(clientU, 'ms_seed_01', 'idemp_noappr_auth');

        // DO NOT add human approval
        containerNoAppr.db.withTransaction(() => {
          containerNoAppr.paymentRepo.update({
            ...authRec,
            status: 'CAPTURE_PENDING',
            paypalCaptureId: 'CAP-UNAUTHORIZED-123',
            updatedAt: new Date(Date.now() + 1000).toISOString(),
          });
        });

        const noApprReport = await containerNoAppr.paypalService.reconcilePayment(clientU, 'ms_seed_01');
        assert.equal(noApprReport.outcome, 'MANUAL_INTERVENTION_REQUIRED');
        assert.equal(noApprReport.actionTaken, 'FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE');
        assert.notEqual(containerNoAppr.milestoneRepo.findById('ms_seed_01')!.status, 'SETTLED');
      } finally {
        containerNoAppr.db.close();
      }

      // 13.11 Audit rollback: transaction rolls back when audit logging throws during payment operation
      const containerAuditFail = createServerApp({
        dbPath: ':memory:',
        authOptions: { enableDemoImpersonation: true },
        paypalOptions: {
          fetchImpl: createMockPayPalFetch(),
          clientId: 'mock_client_id_test',
          clientSecret: 'mock_client_secret_test',
        },
      });

      try {
        const clientU = containerAuditFail.userRepo.findById('client_01')!;
        // Make auditService.appendWithinTx throw an error
        (containerAuditFail.auditService as any).appendWithinTx = () => {
          throw new Error('Simulated SQLite disk write failure in auditService');
        };

        await assert.rejects(
          async () => {
            await containerAuditFail.paypalService.createOrder(clientU, 'ms_seed_01', 'idemp_audit_rollback');
          },
          /Simulated SQLite disk write failure/
        );

        // Verify no order transaction record was persisted in the payment repo
        const txList = containerAuditFail.paymentRepo.listByMilestoneId('ms_seed_01');
        assert.equal(txList.length, 0);
      } finally {
        containerAuditFail.db.close();
      }
    } finally {
      containerMismatch.db.close();
    }
  });

});
