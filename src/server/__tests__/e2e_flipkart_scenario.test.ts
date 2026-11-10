import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServerApp } from '../index.ts';
import type { User } from '../../types/domain.ts';

function createMockFlipkartPayPalFetch(): typeof fetch {
  const orderId = 'ORD-FLIPKART-SBX-001';
  const authId = 'AUTH-FLIPKART-SBX-001';
  const captureId = 'CAP-FLIPKART-SBX-001';

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_flipkart_access_token', token_type: 'Bearer', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
      return new Response(
        JSON.stringify({ verification_status: 'SUCCESS' }),
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

    return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 });
  };
}

describe('End-to-End Scenario: Flipkart Warehouse Management System', () => {
  let container: ReturnType<typeof createServerApp>;
  let server: http.Server;
  let baseUrl: string;

  let clientToken: string;
  let devToken: string;
  let reviewerToken: string;

  let contractId = '';
  let milestone1Id = '';
  let milestone2Id = '';
  let evalId = '';

  async function apiRequest(path: string, options?: RequestInit & { token?: string }): Promise<{ res: Response; json: any }> {
    const headers = new Headers(options?.headers || {});
    if (options?.token) {
      headers.set('Authorization', `Bearer ${options.token}`);
    }
    if (options?.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { rawText: text };
    }
    return { res, json };
  }

  it('Setup: Boots server container with isolated database and mock PayPal gateway', async () => {
    container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockFlipkartPayPalFetch(),
        allowSyntheticTestCredentials: true,
        webhookId: 'WH-FLIPKART-TEST-001',
      },
    });

    server = http.createServer(container.app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });

    // Obtain tokens for Client, Developer, and Reviewer via demo impersonation
    const clientAuth = await apiRequest('/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ userId: 'client_01' }),
    });
    assert.equal(clientAuth.res.status, 200);
    clientToken = clientAuth.json.token;

    const devAuth = await apiRequest('/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ userId: 'dev_01' }),
    });
    assert.equal(devAuth.res.status, 200);
    devToken = devAuth.json.token;

    const reviewerAuth = await apiRequest('/auth/demo-switch', {
      method: 'POST',
      body: JSON.stringify({ userId: 'reviewer_01' }),
    });
    assert.equal(reviewerAuth.res.status, 200);
    reviewerToken = reviewerAuth.json.token;
  });

  // Workflow A: Client Journey — Contract & 4 Milestones Creation
  it('Workflow A: Client creates the Flipkart Warehouse Management System contract with 4 milestones', async () => {
    const deadline1 = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const deadline2 = new Date(Date.now() + 28 * 86_400_000).toISOString();
    const deadline3 = new Date(Date.now() + 42 * 86_400_000).toISOString();
    const deadline4 = new Date(Date.now() + 60 * 86_400_000).toISOString();

    const createPayload = {
      id: contractId,
      title: 'Flipkart Warehouse Management System',
      description: 'Multi-tier automated warehouse inventory, order dispatch, and fulfillment platform.',
      totalBudgetCents: 1000000, // 10,00,000 cents (₹10,000 / $10,000)
      currency: 'USD',
      developerId: 'dev_01',
      reviewerId: 'reviewer_01',
      policyRules: {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 2,
        allowPartialPayout: true,
        latePenaltyDailyBps: 50,
      },
      milestones: [
        {
          id: milestone1Id,
          sequenceOrder: 1,
          title: 'User authentication and role management',
          description: 'OAuth2 authentication and role-based access control for warehouse supervisors and workers.',
          agreedAmountCents: 250000,
          deadlineIso: deadline1,
          dependencyMilestoneIds: [],
          acceptanceCriteria: [
            {
              id: 'crit_auth_01',
              title: 'OAuth2 & RBAC JWT Token Implementation',
              description: 'Robust authentication with supervisor and picker role validation.',
              requiredProofType: 'CODE_COMMIT',
            },
            {
              id: 'crit_auth_02',
              title: 'Passing Authentication Test Suite',
              description: '100% passing automated test suite for authentication endpoints.',
              requiredProofType: 'CI_TESTS',
            },
          ],
        },
        {
          sequenceOrder: 2,
          title: 'Warehouse inventory management',
          description: 'Real-time stock level synchronization and barcode scanner integration.',
          agreedAmountCents: 250000,
          deadlineIso: deadline2,
          dependencyMilestoneIds: [],
          acceptanceCriteria: [
            {
              id: 'crit_inv_01',
              title: 'Real-time SKU Stock Sync',
              description: 'Inventory updates propagate to dashboard within 500ms.',
              requiredProofType: 'CODE_COMMIT',
            },
            {
              id: 'crit_inv_02',
              title: 'Dependency Security Scan Report',
              description: 'Zero critical vulnerabilities in package dependencies.',
              requiredProofType: 'SECURITY_SCAN',
            },
          ],
        },
        {
          sequenceOrder: 3,
          title: 'Order processing and tracking',
          description: 'Automated picking route optimization and carrier shipping label generation.',
          agreedAmountCents: 250000,
          deadlineIso: deadline3,
          dependencyMilestoneIds: [],
          acceptanceCriteria: [
            {
              id: 'crit_ord_01',
              title: 'Automated Carrier Dispatch Webhook',
              description: 'Webhook delivery on order stage transition.',
              requiredProofType: 'CODE_COMMIT',
            },
            {
              id: 'crit_ord_02',
              title: 'PR Merged into Main with Review',
              description: 'Peer-reviewed pull request merged into main.',
              requiredProofType: 'PULL_REQUEST',
            },
          ],
        },
        {
          sequenceOrder: 4,
          title: 'Integration and final testing',
          description: 'End-to-end integration and load testing with APIMatic OpenAPI verification.',
          agreedAmountCents: 250000,
          deadlineIso: deadline4,
          dependencyMilestoneIds: [],
          acceptanceCriteria: [
            {
              id: 'crit_int_01',
              title: 'End-to-End System Integration Suite',
              description: 'All system workflows pass CI tests.',
              requiredProofType: 'CI_TESTS',
            },
            {
              id: 'crit_int_02',
              title: 'OpenAPI 3.0 Documentation Coverage',
              description: 'Valid schema with complete documentation.',
              requiredProofType: 'API_DOCS',
            },
          ],
        },
      ],
    };

    // Client creates contract
    const createRes = await apiRequest('/contracts', {
      method: 'POST',
      token: clientToken,
      body: JSON.stringify(createPayload),
    });
    assert.equal(createRes.res.status, 201);
    contractId = createRes.json.contract.id;
    milestone1Id = createRes.json.contract.milestones[0].id;
    milestone2Id = createRes.json.contract.milestones[1].id;
    assert.ok(contractId.startsWith('contract_'));
    assert.equal(createRes.json.contract.status, 'DRAFT');
    assert.equal(createRes.json.contract.milestones.length, 4);

    // Client activates contract
    const activateRes = await apiRequest(`/contracts/${contractId}/activate`, {
      method: 'POST',
      token: clientToken,
    });
    assert.equal(activateRes.res.status, 200);
    assert.equal(activateRes.json.contract.status, 'ACTIVE');
  });

  // Workflow B: Developer Journey — Submit Delivery Evidence
  it('Workflow B: Developer submits delivery evidence for Milestone 1', async () => {
    const evidencePayload = {
      repoUrl: 'https://github.com/Mohamed-529/TrustChain',
      branch: 'main',
      commitSha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      prUrl: 'https://github.com/Mohamed-529/TrustChain/pull/42',
      prStatus: 'MERGED',
      ciReport: {
        provider: 'github-actions',
        runUrl: 'https://github.com/Mohamed-529/TrustChain/actions/runs/123456',
        status: 'SUCCESS',
        totalTests: 50,
        passedTests: 50,
        failedTests: 0,
        coveragePct: 92.5,
        changedFiles: ['src/auth/jwt.ts', 'src/auth/rbac.test.ts'],
        logSummary: 'All 50 authentication test suites passed with 92.5% coverage.',
      },
      securityScan: {
        scanner: 'Trivy',
        scannerVersion: '0.52.0',
        status: 'COMPLETED',
        findings: [],
      },
      developerNotes: 'Implemented JWT RBAC authentication, passing all 50 test cases with zero critical vulnerabilities.',
    };

    const submitRes = await apiRequest(`/milestones/${milestone1Id}/evidence`, {
      method: 'POST',
      token: devToken,
      body: JSON.stringify(evidencePayload),
    });

    assert.equal(submitRes.res.status, 201);
    assert.equal(submitRes.json.submission.milestoneId, milestone1Id);
    assert.ok(submitRes.json.submission.payloadSha256, 'Payload SHA-256 missing');

    // Verify milestone state transitioned to SUBMITTED
    const reviewRes = await apiRequest(`/milestones/${milestone1Id}/review`, {
      token: reviewerToken,
    });
    assert.equal(reviewRes.res.status, 200);
    assert.equal(reviewRes.json.milestone.status, 'SUBMITTED');
  });

  // Workflow C & D: AI Multi-Agent Evaluation & Provenance Verification
  it('Workflow C & D: Evaluates delivery evidence using AI pipeline & verifies provenance', async () => {
    // 1. Verify GitHub provenance
    const verifyRes = await apiRequest(`/milestones/${milestone1Id}/evidence/verify`, {
      method: 'POST',
      token: devToken,
    });
    assert.equal(verifyRes.res.status, 200);

    // 2. Trigger multi-agent AI evaluation
    const evalRes = await apiRequest(`/milestones/${milestone1Id}/evaluate`, {
      method: 'POST',
      token: reviewerToken,
    });
    assert.equal(evalRes.res.status, 200);
    assert.equal(evalRes.json.evaluation.status, 'COMPLETED');
    evalId = evalRes.json.evaluation.id;
    assert.ok(evalId);
    assert.ok(evalRes.json.evaluation.evidenceAnalysis.criteriaResults.length >= 1);
    assert.equal(evalRes.json.evaluation.evidenceAnalysis.criteriaResults.every((c: any) => c.status === 'VERIFIED'), true);
  });

  // Workflow E: Deterministic Settlement Calculation
  it('Workflow E: Deterministic settlement engine calculates permitted amount in integer cents', async () => {
    const reviewRes = await apiRequest(`/milestones/${milestone1Id}/review`, {
      token: reviewerToken,
    });
    assert.equal(reviewRes.res.status, 200);
    const policy = reviewRes.json.policyCalculation;
    assert.ok(policy, 'Policy calculation missing');
    assert.equal(policy.gateBlocked, false);
    assert.equal(policy.verifiedCriteriaRatio, 1);
    assert.equal(policy.permittedAmountCents, 250000);
    assert.equal(policy.latePenaltyCents, 0);
  });

  // Workflow F: Human Reviewer Approval
  it('Workflow F: Reviewer approves Milestone 1 with mandatory justification', async () => {
    const approveRes = await apiRequest(`/milestones/${milestone1Id}/review/approve`, {
      method: 'POST',
      token: reviewerToken,
      body: JSON.stringify({
        evaluationId: evalId,
        approvedAmountCents: 250000,
        justification: 'Verified complete OAuth2 and RBAC test suite execution in CI with 0 security findings.',
      }),
    });
    assert.equal(approveRes.res.status, 200);
    assert.equal(approveRes.json.approval.decision, 'APPROVE');
    assert.equal(approveRes.json.approval.approvedAmountCents, 250000);
    assert.equal(approveRes.json.stateMachineStatus, 'APPROVED');
  });

  // Workflow G: PayPal Payment Lifecycle (AUTHORIZE -> CAPTURE)
  it('Workflow G: Executes PayPal Orders API v2 settlement (order -> authorize hold -> capture)', async () => {
    // 1. Create order
    const orderRes = await apiRequest(`/milestones/${milestone1Id}/paypal/order`, {
      method: 'POST',
      token: clientToken,
      headers: { 'PayPal-Request-Id': 'ppreq_flipkart_order_001' },
      body: JSON.stringify({}),
    });
    assert.equal(orderRes.res.status, 201);
    assert.equal(orderRes.json.transaction.paypalOrderId, 'ORD-FLIPKART-SBX-001');

    // 2. Authorize hold
    const authRes = await apiRequest(`/milestones/${milestone1Id}/paypal/authorize`, {
      method: 'POST',
      token: clientToken,
      headers: { 'PayPal-Request-Id': 'ppreq_flipkart_auth_001' },
      body: JSON.stringify({}),
    });
    assert.equal(authRes.res.status, 200);
    assert.equal(authRes.json.transaction.status, 'AUTHORIZED');
    assert.equal(authRes.json.transaction.paypalAuthorizationId, 'AUTH-FLIPKART-SBX-001');

    // 3. Capture authorization
    const capRes = await apiRequest(`/milestones/${milestone1Id}/paypal/capture`, {
      method: 'POST',
      token: clientToken,
      headers: { 'PayPal-Request-Id': 'ppreq_flipkart_cap_001' },
      body: JSON.stringify({}),
    });
    assert.equal(capRes.res.status, 200);
    assert.equal(capRes.json.transaction.status, 'CAPTURED');
    assert.equal(capRes.json.transaction.capturedAmountCents, 250000);

    // Verify milestone reached SETTLED
    const settledCheck = await apiRequest(`/milestones/${milestone1Id}/review`, {
      token: clientToken,
    });
    assert.equal(settledCheck.json.milestone.status, 'SETTLED');
  });

  // Workflow H: Audit Trail Verification & Replay
  it('Workflow H: Verifies tamper-evident audit hash-chain and replays contract history', async () => {
    // Verify hash chain
    const verifyChain = await apiRequest('/audit/verify', { token: clientToken });
    assert.equal(verifyChain.res.status, 200);
    assert.equal(verifyChain.json.valid, true);

    // Replay audit trail
    const replayRes = await apiRequest(`/contracts/${contractId}/audit/replay`, {
      token: clientToken,
    });
    assert.equal(replayRes.res.status, 200);
    assert.equal(replayRes.json.isCryptographicallyValid, true);
    assert.ok(replayRes.json.totalEventsProcessed >= 6);
  });

  // Workflow I: Evidence Passport & Dispute Pack Generation
  it('Workflow I: Generates Evidence Passport and Dispute Pack with SHA-256 digest validation', async () => {
    // Evidence Passport
    const passportRes = await apiRequest(`/contracts/${contractId}/milestones/${milestone1Id}/evidence-passport?forceRefresh=true`, {
      token: clientToken,
    });
    assert.equal(passportRes.res.status, 200);
    assert.ok(passportRes.json.passport);
    assert.equal(passportRes.json.passport.identity.milestoneId, milestone1Id);

    // Dispute Pack Generation
    const disputeGen = await apiRequest(`/contracts/${contractId}/milestones/${milestone1Id}/dispute-pack`, {
      method: 'POST',
      token: clientToken,
    });
    assert.equal(disputeGen.res.status, 201);
    const packId = disputeGen.json.disputePack.id;

    // Dispute Pack Verification
    const disputeVer = await apiRequest(`/contracts/${contractId}/dispute-packs/${packId}/verify`, {
      token: clientToken,
    });
    assert.equal(disputeVer.res.status, 200);
    assert.equal(disputeVer.json.verification.isDigestValid, true);
    assert.equal(disputeVer.json.verification.isAuditAnchored, true);
  });

  // Part 3: Negative Security Scenarios on Flipkart WMS
  it('Part 3: Cross-Role & Security Negative Scenarios fail closed', async () => {
    // 1. Developer attempts reviewer approval (Separation of Duties violation)
    const devApprove = await apiRequest(`/milestones/${milestone1Id}/review/approve`, {
      method: 'POST',
      token: devToken,
      body: JSON.stringify({ approvedAmountCents: 250000, justification: 'Developer approving own code' }),
    });
    assert.ok(devApprove.res.status === 403, 'Developer was allowed to review/approve');

    // 2. Client attempts to submit developer evidence
    const clientEvidence = await apiRequest(`/milestones/${milestone2Id}/evidence`, {
      method: 'POST',
      token: clientToken,
      body: JSON.stringify({ repoUrl: 'https://github.com/Mohamed-529/TrustChain', commitSha: 'abc' }),
    });
    assert.equal(clientEvidence.res.status, 403, 'Client was allowed to submit developer evidence');

    // 3. Payment capture attempted on unapproved milestone
    const unapprovedCap = await apiRequest(`/milestones/${milestone2Id}/paypal/capture`, {
      method: 'POST',
      token: clientToken,
      headers: { 'PayPal-Request-Id': 'ppreq_unapproved_cap' },
      body: JSON.stringify({}),
    });
    assert.ok(unapprovedCap.res.status === 400 || unapprovedCap.res.status === 409, 'Capture succeeded on unapproved milestone');

    // 4. Missing justification on review action
    const noJustification = await apiRequest(`/milestones/${milestone2Id}/review/reject`, {
      method: 'POST',
      token: reviewerToken,
      body: JSON.stringify({ justification: 'hi' }), // < 5 chars
    });
    assert.equal(noJustification.res.status, 400, 'Review succeeded without mandatory justification');
  });

  it('Teardown: Closes HTTP server and database', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    container.db.close();
  });
});
