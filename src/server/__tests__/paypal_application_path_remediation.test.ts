import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServerApp } from '../index.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type {
  User,
  HumanApprovalRecord,
} from '../../types/domain.ts';

function createMockRemediationPayPalFetch(options?: {
  remoteOrderStatus?: string;
  remoteAuthStatus?: string;
  remoteCapStatus?: string;
  remoteOrderId?: string;
  remoteAuthId?: string;
  remoteCapId?: string;
  includeRemoteCaptureInAuth?: boolean;
  capturedPayloadCollector?: (body: any) => void;
}): typeof fetch {
  let seq = 1;
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_remediation_token_123', token_type: 'Bearer', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/v2/checkout/orders')) {
      const parsedBody = init?.body ? JSON.parse(String(init.body)) : {};
      options?.capturedPayloadCollector?.(parsedBody);
      const orderId = options?.remoteOrderId ?? `ORD-REMED-${seq++}`;
      return new Response(
        JSON.stringify({
          id: orderId,
          status: 'CREATED',
          intent: 'AUTHORIZE',
          purchase_units: parsedBody.purchase_units ?? [{ amount: { currency_code: 'USD', value: '2500.00' } }],
          application_context: parsedBody.application_context,
          links: [
            {
              rel: 'approve',
              href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
              method: 'GET',
            },
            {
              rel: 'self',
              href: `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}`,
              method: 'GET',
            },
          ],
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
      const authId = options?.remoteAuthId ?? `AUTH-REMED-${seq++}`;
      const expiresAt = new Date(Date.now() + 29 * 86_400_000).toISOString();
      return new Response(
        JSON.stringify({
          id: options?.remoteOrderId ?? 'ORD-REMED-1',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: authId,
                    status: options?.remoteAuthStatus ?? 'CREATED',
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
      const capId = options?.remoteCapId ?? `CAP-REMED-${seq++}`;
      return new Response(
        JSON.stringify({
          id: capId,
          status: options?.remoteCapStatus ?? 'COMPLETED',
          amount: { currency_code: 'USD', value: '2500.00' },
          final_capture: true,
          seller_receivable_breakdown: {
            gross_amount: { currency_code: 'USD', value: '2500.00' },
            paypal_fee: { currency_code: 'USD', value: '75.00' },
            net_amount: { currency_code: 'USD', value: '2425.00' },
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/payments/authorizations/') && !url.endsWith('/capture')) {
      const authId = options?.remoteAuthId ?? 'AUTH-REMED-1';
      const capPayments = options?.includeRemoteCaptureInAuth
        ? [{ id: options?.remoteCapId ?? 'CAP-REMED-1', status: 'COMPLETED', amount: { currency_code: 'USD', value: '2500.00' } }]
        : [];
      return new Response(
        JSON.stringify({
          id: authId,
          status: options?.remoteAuthStatus ?? 'CREATED',
          amount: { currency_code: 'USD', value: '2500.00' },
          payments: { captures: capPayments },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/payments/captures/')) {
      return new Response(
        JSON.stringify({
          id: options?.remoteCapId ?? 'CAP-REMED-1',
          status: options?.remoteCapStatus ?? 'COMPLETED',
          amount: { currency_code: 'USD', value: '2500.00' },
          seller_protection: { status: 'ELIGIBLE' },
          disbursement_mode: 'INSTANT',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/checkout/orders/') && !url.endsWith('/authorize')) {
      return new Response(
        JSON.stringify({
          id: options?.remoteOrderId ?? 'ORD-REMED-1',
          status: options?.remoteOrderStatus ?? 'APPROVED',
          intent: 'AUTHORIZE',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 });
  };
}

describe('TrustChain — PayPal Application-Path Remediation & Financial Controls', () => {
  it('1. configures TrustChain return URL & cancel URL in createOrder application_context', async () => {
    let capturedPayload: any = null;
    const mockFetch = createMockRemediationPayPalFetch({
      capturedPayloadCollector: (body) => {
        capturedPayload = body;
      },
    });

    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        clientId: 'LIVE_SBX_CLIENT_ID',
        clientSecret: 'LIVE_SBX_SECRET',
        appUrl: 'http://localhost:3000',
        fetchImpl: mockFetch,
      },
    });

    try {
      const client = container.userRepo.findById('client_01')!;
      const milestone = container.milestoneRepo.findById('ms_seed_01')!;

      const tx = await container.paypalService.createOrder(
        client,
        milestone.id,
        'req_order_remediation_001'
      );

      assert.equal(tx.status, 'ORDER_CREATED');
      assert.ok(tx.paypalOrderId.startsWith('ORD-REMED-'));

      // Verify application_context in captured payload
      assert.ok(capturedPayload, 'PayPal Orders payload must be captured');
      assert.equal(capturedPayload.intent, 'AUTHORIZE');
      assert.ok(capturedPayload.application_context, 'Must include application_context');
      assert.equal(
        capturedPayload.application_context.return_url,
        `http://localhost:3000/reviews?paypal_return=approved&milestone_id=${milestone.id}`
      );
      assert.equal(
        capturedPayload.application_context.cancel_url,
        `http://localhost:3000/reviews?paypal_return=cancelled&milestone_id=${milestone.id}`
      );

      // Verify order is persisted in payment_transactions table
      const persistedTx = container.paymentRepo.findByIdempotencyKey('req_order_remediation_001');
      assert.ok(persistedTx, 'Transaction record must exist in SQLite database');
      assert.equal(persistedTx?.paypalOrderId, tx.paypalOrderId);

      // Verify audit trail entry was created
      const auditLogs = container.auditService.listLogs();
      const orderAudit = auditLogs.find((l) => l.action === 'PAYPAL_ORDER_CREATED');
      assert.ok(orderAudit, 'Must record PAYPAL_ORDER_CREATED in hash-chained audit log');
      assert.equal(orderAudit?.entityId, tx.id);
    } finally {
      container.db.close();
    }
  });

  it('2. provides server-side order details retrieval via getOrderDetails', async () => {
    const mockFetch = createMockRemediationPayPalFetch({
      remoteOrderId: 'ORD-REMED-GET-TEST',
      remoteOrderStatus: 'APPROVED',
    });

    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        clientId: 'LIVE_SBX_CLIENT_ID',
        clientSecret: 'LIVE_SBX_SECRET',
        fetchImpl: mockFetch,
      },
    });

    try {
      const client = container.userRepo.findById('client_01')!;
      const milestone = container.milestoneRepo.findById('ms_seed_01')!;

      await container.paypalService.createOrder(
        client,
        milestone.id,
        'req_order_get_details_001'
      );

      const details = await container.paypalService.getOrderDetails(client, milestone.id);
      assert.equal(details.id, 'ORD-REMED-GET-TEST');
      assert.equal(details.status, 'APPROVED');

      // Strangers cannot inspect contract order details
      const stranger: User = {
        id: 'stranger_99',
        email: 'stranger@example.com',
        name: 'Stranger',
        role: 'CLIENT',
        createdAt: new Date().toISOString(),
      };
      await assert.rejects(
        () => container.paypalService.getOrderDetails(stranger, milestone.id),
        (err: unknown) => (err as AppError).code === 'FORBIDDEN_NOT_CONTRACT_PARTY'
      );
    } finally {
      container.db.close();
    }
  });

  it('3. blocks payment capture when human review approval is missing (Fiduciary Gate)', async () => {
    const mockFetch = createMockRemediationPayPalFetch();

    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        clientId: 'LIVE_SBX_CLIENT_ID',
        clientSecret: 'LIVE_SBX_SECRET',
        fetchImpl: mockFetch,
      },
    });

    try {
      const client = container.userRepo.findById('client_01')!;
      const milestone = container.milestoneRepo.findById('ms_seed_01')!;

      // 1. Create order
      await container.paypalService.createOrder(
        client,
        milestone.id,
        'req_auth_gate_order_001'
      );

      // 2. Authorize order
      const authTx = await container.paypalService.authorizeOrder(
        client,
        milestone.id,
        'req_auth_gate_auth_001'
      );
      assert.equal(authTx.status, 'AUTHORIZED');

      // Milestone is NOT APPROVED yet (status is PENDING_REVIEW)
      // Attempting to capture must be rejected with 409
      await assert.rejects(
        () =>
          container.paypalService.captureAuthorization(
            client,
            milestone.id,
            'req_auth_gate_cap_001'
          ),
        (err: unknown) =>
          (err as AppError).code === 'HUMAN_APPROVAL_REQUIRED_FOR_CAPTURE' &&
          (err as AppError).statusCode === 409
      );

      // Verify no capture was recorded in database
      const txs = container.paymentRepo.listByMilestoneId(milestone.id);
      const capTx = txs.find((t) => t.status === 'CAPTURED');
      assert.equal(capTx, undefined, 'No capture transaction must exist when gate is blocked');
    } finally {
      container.db.close();
    }
  });

  it('4. executes complete UI-to-backend-to-database lifecycle: Order -> Auth -> Human Review -> Capture', async () => {
    const mockFetch = createMockRemediationPayPalFetch({
      remoteOrderId: 'ORD-LIVE-APP-PATH-001',
      remoteAuthId: 'AUTH-LIVE-APP-PATH-001',
      remoteCapId: 'CAP-LIVE-APP-PATH-001',
    });

    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        clientId: 'LIVE_SBX_CLIENT_ID',
        clientSecret: 'LIVE_SBX_SECRET',
        fetchImpl: mockFetch,
      },
    });

    try {
      const client = container.userRepo.findById('client_01')!;
      const reviewer = container.userRepo.findById('reviewer_01')!;
      const milestone = container.milestoneRepo.findById('ms_seed_01')!;

      // 1. Create Order through backend
      const orderTx = await container.paypalService.createOrder(
        client,
        milestone.id,
        'req_app_path_order_001'
      );
      assert.equal(orderTx.status, 'ORDER_CREATED');
      assert.equal(orderTx.paypalOrderId, 'ORD-LIVE-APP-PATH-001');

      // 2. Authorize Hold through backend
      const authTx = await container.paypalService.authorizeOrder(
        client,
        milestone.id,
        'req_app_path_auth_001'
      );
      assert.equal(authTx.status, 'AUTHORIZED');
      assert.equal(authTx.paypalAuthorizationId, 'AUTH-LIVE-APP-PATH-001');

      // 3. Insert Evidence Submission, AI Evaluation and Human Approval
      const now = new Date().toISOString();
      container.evidenceRepo.insert({
        id: 'sub_seed_01',
        milestoneId: milestone.id,
        attemptNumber: 1,
        submittedBy: 'dev_01',
        repoUrl: 'https://github.com/example/repo',
        branch: 'main',
        commitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        prUrl: 'https://github.com/example/repo/pull/1',
        prStatus: 'MERGED',
        ciReport: {
          runUrl: 'https://github.com/example/repo/actions/runs/1',
          testSuiteName: 'unit-tests',
          totalTests: 64,
          passingTests: 64,
          failingTests: 0,
          statementCoveragePercent: 88,
          branchCoveragePercent: 82,
        },
        securityScan: {
          scannerName: 'npm-audit',
          scannedAt: now,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          vulnerabilities: [],
        },
        developerNotes: 'Completed OAuth2 integration',
        submittedAt: now,
        payloadSha256: '0'.repeat(64),
        payloadHashAlgorithm: 'SHA-256',
        canonicalizationVersion: 'v1',
        payloadHashedAt: now,
        provenanceStatus: 'VERIFIED',
        canonicalReferences: [],
      });

      const evalRun = {
        id: `eval_test_${Date.now()}`,
        milestoneId: milestone.id,
        submissionId: 'sub_seed_01',
        status: 'COMPLETED' as const,
        evidenceAnalysis: {
          verdict: 'VERIFIED' as const,
          confidence: 0.95,
          summary: 'Verified CI tests and OAuth2 endpoints',
          requirementMatches: [],
        },
        riskAnalysis: {
          verdict: 'SAFE' as const,
          confidence: 0.95,
          overallRisk: 'LOW' as const,
          vulnerabilities: [],
          remediationAdvice: [],
        },
        arbitratorRecommendation: {
          recommendedDecision: 'APPROVE' as const,
          confidenceScore: 0.95,
          reasons: ['Requirements met'],
          advisoryNotes: [],
          divergenceFlags: [],
        },
        policyCalculation: {
          agreedAmountCents: milestone.agreedAmountCents,
          latePenaltyCents: 0,
          qualityDeductionCents: 0,
          securityDeductionCents: 0,
          permittedAmountCents: milestone.agreedAmountCents,
          formulaExplanation: 'Full amount permitted',
        },
        evaluatedAt: now,
      };
      container.evaluationRepo.insert(evalRun as any);

      const approvalRecord: HumanApprovalRecord = {
        id: `appr_test_${Date.now()}`,
        milestoneId: milestone.id,
        evaluationId: evalRun.id,
        reviewerId: reviewer.id,
        decision: 'APPROVE',
        approvedAmountCents: milestone.agreedAmountCents,
        isOverride: false,
        justification: 'Fiduciary sign-off on Milestone 1 delivery evidence.',
        decidedAt: now,
      };
      container.approvalRepo.insert(approvalRecord);
      container.milestoneRepo.updateStatus(milestone.id, 'APPROVED', now);

      // 4. Capture Settlement through backend
      const capTx = await container.paypalService.captureAuthorization(
        reviewer,
        milestone.id,
        'req_app_path_cap_001'
      );
      assert.equal(capTx.status, 'CAPTURED');
      assert.equal(capTx.paypalCaptureId, 'CAP-LIVE-APP-PATH-001');
      assert.equal(capTx.capturedAmountCents, milestone.agreedAmountCents);

      // 5. Verify local SQLite milestone state updated to SETTLED
      const updatedMilestone = container.milestoneRepo.findById(milestone.id);
      assert.equal(updatedMilestone?.status, 'SETTLED');
      assert.equal(updatedMilestone?.paymentStatus, 'CAPTURED');

      // 6. Verify full transaction history in payment_transactions table
      const history = container.paymentRepo.listByMilestoneId(milestone.id);
      assert.equal(history.length, 3, 'Must have ORDER_CREATED, AUTHORIZED, and CAPTURED rows');

      // 7. Verify hash-chained audit log continuity
      const auditChainVerification = container.auditService.verifyChain();
      assert.equal(auditChainVerification.valid, true, 'Audit log hash chain must remain cryptographically valid');
      assert.ok(auditChainVerification.verifiedCount >= 3, 'Must have verified at least 3 payment audit records');

      const allAudits = container.auditService.listLogs();
      const actions = allAudits.map((a) => a.action);
      assert.ok(actions.includes('PAYPAL_ORDER_CREATED'));
      assert.ok(actions.includes('PAYPAL_ORDER_AUTHORIZED'));
      assert.ok(actions.includes('PAYPAL_AUTHORIZATION_CAPTURED'));
    } finally {
      container.db.close();
    }
  });

  it('5. contains unauthorized remote captures safely: flags MANUAL_INTERVENTION_REQUIRED without settling', async () => {
    // Scenario: PayPal Sandbox has an order and auth, but remote status mismatch or missing approval
    const mockFetch = createMockRemediationPayPalFetch({
      remoteOrderId: 'ORD-OUT-OF-BAND',
      remoteAuthId: 'AUTH-OUT-OF-BAND',
      remoteCapId: 'CAP-OUT-OF-BAND',
      remoteCapStatus: 'COMPLETED',
    });

    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        clientId: 'LIVE_SBX_CLIENT_ID',
        clientSecret: 'LIVE_SBX_SECRET',
        fetchImpl: mockFetch,
      },
    });

    try {
      const client = container.userRepo.findById('client_01')!;
      const reviewer = container.userRepo.findById('reviewer_01')!;
      const milestone = container.milestoneRepo.findById('ms_seed_01')!;

      // Setup an order and auth
      await container.paypalService.createOrder(client, milestone.id, 'req_unauth_ord_001');
      await container.paypalService.authorizeOrder(client, milestone.id, 'req_unauth_auth_001');

      // Reconcile when remote has unapproved state
      const report = await container.paypalService.reconcilePayment(reviewer, milestone.id);

      assert.equal(report.outcome, 'MANUAL_INTERVENTION_REQUIRED');
      assert.ok(
        report.actionTaken === 'FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE' ||
        report.actionTaken === 'FLAGGED_IDENTIFIER_MISMATCH' ||
        report.actionTaken === 'FLAGGED_MANUAL_REVIEW',
        'Must flag manual intervention'
      );

      // The milestone MUST NOT be transitioned to SETTLED
      const msAfterReconcile = container.milestoneRepo.findById(milestone.id);
      assert.notEqual(msAfterReconcile?.status, 'SETTLED');
    } finally {
      container.db.close();
    }
  });

  it('6. protects against duplicate requests using PayPal-Request-Id idempotency', async () => {
    const mockFetch = createMockRemediationPayPalFetch();

    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        clientId: 'LIVE_SBX_CLIENT_ID',
        clientSecret: 'LIVE_SBX_SECRET',
        fetchImpl: mockFetch,
      },
    });

    try {
      const client = container.userRepo.findById('client_01')!;
      const milestone = container.milestoneRepo.findById('ms_seed_01')!;

      const idempKey = 'req_idemp_test_constant_key_123';
      const tx1 = await container.paypalService.createOrder(client, milestone.id, idempKey);
      const tx2 = await container.paypalService.createOrder(client, milestone.id, idempKey);

      // Must return identical transaction record without creating a second order in PayPal
      assert.equal(tx1.id, tx2.id);
      assert.equal(tx1.paypalOrderId, tx2.paypalOrderId);

      const allTxs = container.paymentRepo.listByMilestoneId(milestone.id);
      assert.equal(allTxs.length, 1, 'Only one transaction record must be created');
    } finally {
      container.db.close();
    }
  });
});
