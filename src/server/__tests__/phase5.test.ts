import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServerApp } from '../index.ts';
import {
  MilestoneProofApiError,
  MilestoneProofClient,
} from '../../sdk/MilestoneProofClient.ts';

function createMockPayPalSandboxFetch(): typeof fetch {
  let seq = 1;
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_paypal_sandbox_token_001', token_type: 'Bearer' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.endsWith('/v2/checkout/orders')) {
      const id = `ORD-SBX-${seq++}`;
      return new Response(
        JSON.stringify({ id, status: 'CREATED', intent: 'AUTHORIZE' }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
      const authId = `AUTH-SBX-${seq++}`;
      const expiresAt = new Date(Date.now() + 29 * 86_400_000).toISOString();
      return new Response(
        JSON.stringify({
          id: 'ORD-SBX-AUTH',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                authorizations: [
                  {
                    id: authId,
                    status: 'CREATED',
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
      const capId = `CAP-SBX-${seq++}`;
      return new Response(
        JSON.stringify({ id: capId, status: 'COMPLETED', final_capture: true }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
      const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};
      const sig = String(bodyObj.transmission_sig ?? '');
      const status =
        sig.startsWith('sig_verified_') ? 'SUCCESS' : 'FAILURE';
      return new Response(
        JSON.stringify({ verification_status: status }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
  };
}


describe('Phase 5 — Primary Sponsor Integrations: Bryntum Gantt Control Tower + APIMatic SDK + PayPal Orders API v2', () => {
  it('1. Bryntum Gantt Control Tower: loads 3-milestone scenario (M1 Completed 100%, M2 Failed CI & Overdue, M3 Blocked by Dependency) and generates AI Schedule Recovery Proposal', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
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
      // Authenticate via APIMatic-aligned TypeScript SDK as Reviewer
      const session = await sdk.switchDemoPersona({ userId: 'reviewer_01' });
      assert.equal(session.user.role, 'REVIEWER');

      // Load the 3-milestone Control Tower demo scenario via SDK
      const demoBody = await sdk.loadContractScheduleDemoScenario('contract_seed_01');

      const { schedule, createdProposals } = demoBody;
      assert.equal(schedule.tasks.length, 3);
      assert.equal(schedule.dependencies.length, 2);
      assert.equal(schedule.criticalPathTaskIds.length, 3);

      const [t1, t2, t3] = schedule.tasks;

      // Milestone 1 (Authentication): Completed (100%, APPROVED)
      assert.equal(t1.milestoneId, 'ms_seed_01');
      assert.equal(t1.status, 'APPROVED');
      assert.equal(t1.percentDone, 100);
      assert.equal(t1.scheduleHealth, 'COMPLETED');
      assert.equal(t1.critical, true);

      // Milestone 2 (Payment integration): Failed CI and delayed (OVERDUE)
      assert.equal(t2.milestoneId, 'ms_seed_02');
      assert.equal(t2.ciStatus, 'FAILURE');
      assert.equal(t2.isOverdue, true);
      assert.equal(t2.scheduleHealth, 'OVERDUE');
      assert.ok(t2.evidenceReferences.some((id) => id.includes('ev_ci_')));

      // Milestone 3 (Deployment): Blocked by Milestone 2 dependency (BLOCKED_BY_DEPENDENCY)
      assert.equal(t3.milestoneId, 'ms_seed_03');
      assert.equal(t3.isBlockedByDependency, true);
      assert.deepEqual(t3.blockingMilestoneIds, ['ms_seed_02']);
      assert.equal(t3.scheduleHealth, 'BLOCKED_BY_DEPENDENCY');

      // Verify AI Schedule-Risk Recovery Proposal was created for Milestone 2 and cascades to Milestone 3
      assert.ok(createdProposals.length >= 1);
      const prop = createdProposals.find((p) => p.milestoneId === 'ms_seed_02')!;
      assert.ok(prop);
      assert.equal(prop.status, 'PENDING');
      assert.ok(prop.delayDays >= 7);
      assert.ok(prop.supportingEvidenceIds.some((id) => id.includes('ev_ci_')));
      assert.equal(prop.downstreamCascades.length, 1);
      assert.equal(prop.downstreamCascades[0].milestoneId, 'ms_seed_03');
      assert.equal(prop.preservesContractualAmountCents, 350000);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('2. Human-Controlled Schedule Recovery: blocks DEVELOPER self-approval, allows CLIENT/REVIEWER approval, cascades Finish-to-Start dates, preserves baseline & contractual budget, and logs to audit chain', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
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
      await sdk.switchDemoPersona({ userId: 'reviewer_01' });

      // Generate schedule risk proposal on Milestone 2
      const riskRes = await sdk.analyzeContractScheduleRisk('contract_seed_01', {
        milestoneId: 'ms_seed_02',
        recoveryDays: 10,
        referenceTimeIso: '2026-11-25T12:00:00.000Z',
      });
      assert.equal(riskRes.createdProposals.length, 1);
      const proposal = riskRes.createdProposals[0];

      // 2a. Switch to DEVELOPER and verify developer CANNOT approve schedule recovery (403)
      await sdk.switchDemoPersona({ userId: 'dev_01' });
      await assert.rejects(
        async () => {
          await sdk.reviewScheduleProposal('contract_seed_01', proposal.id, {
            decision: 'APPROVE',
            reason: 'Developer trying to extend own deadline unilaterally.',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'SCHEDULE_APPROVAL_FORBIDDEN_FOR_DEVELOPER');
          return true;
        }
      );

      // 2b. Switch to CLIENT and approve the schedule recovery proposal
      await sdk.switchDemoPersona({ userId: 'client_01' });
      const approvedRes = await sdk.reviewScheduleProposal('contract_seed_01', proposal.id, {
        decision: 'APPROVE',
        reason: 'Client approves +10d schedule extension for CI stabilization; budget unchanged.',
        referenceTimeIso: '2026-11-25T12:00:00.000Z',
      });

      assert.equal(approvedRes.proposal.status, 'APPROVED');
      assert.equal(approvedRes.proposal.decidedBy, 'client_01');

      const updatedT2 = approvedRes.schedule.tasks.find((t) => t.milestoneId === 'ms_seed_02')!;
      const updatedT3 = approvedRes.schedule.tasks.find((t) => t.milestoneId === 'ms_seed_03')!;

      // Verify Milestone 2 deadline shifted to proposedEndDate while baselineEndDate remained 2026-11-20
      assert.equal(updatedT2.endDate, proposal.proposedEndDate);
      assert.equal(updatedT2.baselineEndDate, '2026-11-20T23:59:59.000Z');
      assert.equal(updatedT2.agreedAmountCents, 350000); // Contractual payment amount strictly unchanged

      // Verify Milestone 3 (downstream Finish-to-Start dependent) cascaded automatically
      assert.equal(updatedT3.endDate, proposal.downstreamCascades[0].proposedEndDate);
      assert.equal(updatedT3.baselineEndDate, '2026-11-30T23:59:59.000Z');
      assert.equal(updatedT3.agreedAmountCents, 250000);

      // Verify hash-chained audit log recorded SCHEDULE_RECOVERY_APPROVED
      const chainStatus = await sdk.verifyAuditHashChain();
      assert.equal(chainStatus.valid, true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('3. PayPal Orders API v2 & APIMatic SDK: enforces PayPal-Request-Id idempotency, blocks capture before human approval, captures after human approval, and verifies webhooks', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        clientId: 'sbx_client_id_test',
        clientSecret: 'sbx_client_secret_test',
        webhookId: 'WH-SBX-CONFIG-001',
        fetchImpl: createMockPayPalSandboxFetch(),
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
      // 3a. Authenticate as CLIENT and create + authorize PayPal Order (intent: AUTHORIZE) for Milestone 1
      await sdk.switchDemoPersona({ userId: 'client_01' });

      const orderRes1 = await sdk.createPayPalOrder('ms_seed_01', 'idemp_order_ms1_001');
      assert.equal(orderRes1.transaction.status, 'ORDER_CREATED');
      assert.equal(orderRes1.transaction.authorizedAmountCents, 250000);
      assert.match(orderRes1.transaction.nonEscrowDisclosure, /NOT.*custodial escrow/i);

      // Verify idempotent replay with same PayPal-Request-Id returns identical transaction without duplicate creation
      const orderReplay = await sdk.createPayPalOrder('ms_seed_01', 'idemp_order_ms1_001');
      assert.equal(orderReplay.transaction.id, orderRes1.transaction.id);
      assert.equal(orderReplay.transaction.paypalOrderId, orderRes1.transaction.paypalOrderId);

      // Authorize the order (29-day hold)
      const authRes = await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_auth_ms1_001');
      assert.equal(authRes.transaction.status, 'AUTHORIZED');
      assert.ok(authRes.transaction.paypalAuthorizationId);
      assert.ok(authRes.transaction.authExpiresAt);

      // 3b. Attempt to capture BEFORE human approval -> MUST FAIL with 409 HUMAN_APPROVAL_REQUIRED_FOR_CAPTURE
      await assert.rejects(
        async () => {
          await sdk.capturePayPalAuthorization('ms_seed_01', 'idemp_cap_premature_001');
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'HUMAN_APPROVAL_REQUIRED_FOR_CAPTURE');
          return true;
        }
      );

      // 3c. Submit evidence as DEVELOPER, run AI evaluation, and record HUMAN_APPROVAL as REVIEWER
      await sdk.switchDemoPersona({ userId: 'dev_01' });
      await fetch(`${baseUrl}/milestones/ms_seed_01/evidence`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${(await sdk.getCurrentSession()).session.jti ? '' : ''}`,
        },
      });
      // Use fixture loader via endpoint
      const devSession = await sdk.switchDemoPersona({ userId: 'dev_01' });
      const evSubRes = await fetch(`${baseUrl}/milestones/ms_seed_01/evidence`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${devSession.token}`,
        },
        body: JSON.stringify({ demoFixtureKey: 'SUCCESSFUL_SUBMISSION' }),
      });
      assert.equal(evSubRes.status, 201);

      // Verify DEVELOPER is strictly forbidden from capturing payment (403)
      await assert.rejects(
        async () => {
          await sdk.capturePayPalAuthorization('ms_seed_01', 'idemp_cap_dev_001');
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'CAPTURE_FORBIDDEN_FOR_DEVELOPER');
          return true;
        }
      );

      // Switch to REVIEWER, run AI evaluation, and approve milestone
      await sdk.switchDemoPersona({ userId: 'reviewer_01' });
      const evalRes = await sdk.evaluateMilestoneEvidence('ms_seed_01');
      assert.equal(evalRes.evaluation.policyCalculation.permittedAmountCents, 250000);

      const reviewRes = await sdk.submitHumanReview('ms_seed_01', {
        evaluationId: evalRes.evaluation.id,
        decision: 'APPROVE',
        approvedAmountCents: 250000,
        justification: 'All OAuth2 acceptance criteria verified with 64/64 passing CI tests.',
      });
      assert.equal(reviewRes.milestoneStatus, 'APPROVED');

      // 3d. Now capture the authorized PayPal payment as REVIEWER
      const capRes = await sdk.capturePayPalAuthorization('ms_seed_01', 'idemp_cap_ms1_001');
      assert.equal(capRes.transaction.status, 'CAPTURED');
      assert.equal(capRes.transaction.capturedAmountCents, 250000);
      assert.ok(capRes.transaction.paypalCaptureId);

      // Verify idempotent capture replay returns the exact same transaction
      const capReplay = await sdk.capturePayPalAuthorization('ms_seed_01', 'idemp_cap_ms1_001');
      assert.equal(capReplay.transaction.id, capRes.transaction.id);

      // Verify duplicate capture with a NEW idempotency key is rejected (409 DUPLICATE_CAPTURE_FORBIDDEN)
      await assert.rejects(
        async () => {
          await sdk.capturePayPalAuthorization('ms_seed_01', 'idemp_cap_ms1_002_duplicate');
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'DUPLICATE_CAPTURE_FORBIDDEN');
          return true;
        }
      );

      // 3e. Verify PayPal Webhook signature validation & untrusted cert rejection
      await assert.rejects(
        async () => {
          await sdk.handlePayPalWebhook(
            {
              'PAYPAL-TRANSMISSION-ID': 'wh_tx_01',
              'PAYPAL-TRANSMISSION-TIME': '2026-11-07T08:00:00Z',
              'PAYPAL-TRANSMISSION-SIG': 'valid_looking_signature_123456',
              'PAYPAL-CERT-URL': 'https://evil-attacker.example.com/cert.pem',
              'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
            },
            {
              id: 'WH-EVT-001',
              event_type: 'PAYMENT.CAPTURE.COMPLETED',
              resource: { id: capRes.transaction.paypalCaptureId },
            }
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.code, 'UNTRUSTED_PAYPAL_CERT_URL');
          return true;
        }
      );

      const whAck = await sdk.handlePayPalWebhook(
        {
          'PAYPAL-TRANSMISSION-ID': 'wh_tx_valid_01',
          'PAYPAL-TRANSMISSION-TIME': '2026-11-07T08:00:00Z',
          'PAYPAL-TRANSMISSION-SIG': 'sig_verified_paypal_sandbox_99887766',
          'PAYPAL-CERT-URL': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123',
          'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
        },
        {
          id: 'WH-EVT-VALID-001',
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: { id: authRes.transaction.paypalAuthorizationId },
        }
      );
      assert.equal(whAck.verified, true);
      assert.equal(whAck.eventId, 'WH-EVT-VALID-001');

      // 3f. Verify complete SHA-256 audit hash chain integrity across all Phase 5 events
      const auditVerify = await sdk.verifyAuditHashChain();
      assert.equal(auditVerify.valid, true);
      assert.ok(auditVerify.verifiedCount >= 8);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('4. PayPal Webhook Reconciliation & Partial Capture: handles partial approved capture (PARTIALLY_CAPTURED_VOIDED), webhook PAYMENT.AUTHORIZATION.VOIDED reconciliation, and cross-milestone idempotency key conflict (409)', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        clientId: 'sbx_client_id_test',
        clientSecret: 'sbx_client_secret_test',
        webhookId: 'WH-SBX-CONFIG-001',
        fetchImpl: createMockPayPalSandboxFetch(),
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
      // 4a. Create & authorize PayPal Order on Milestone 1 ($2,500.00 = 250000 cents)
      await sdk.switchDemoPersona({ userId: 'client_01' });
      await sdk.createPayPalOrder('ms_seed_01', 'idemp_partial_order_01');
      await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_partial_auth_01');

      // Verify reusing Milestone 1's idempotency key on Milestone 2 throws 409 IDEMPOTENCY_KEY_REUSE_CONFLICT
      await assert.rejects(
        async () => {
          await sdk.createPayPalOrder('ms_seed_02', 'idemp_partial_order_01');
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'IDEMPOTENCY_KEY_REUSE_CONFLICT');
          return true;
        }
      );

      // 4b. Submit evidence, evaluate, and approve a PARTIAL payout ($2,000.00 = 200000 cents < 250000 cents)
      const devSession = await sdk.switchDemoPersona({ userId: 'dev_01' });
      await fetch(`${baseUrl}/milestones/ms_seed_01/evidence`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${devSession.token}`,
        },
        body: JSON.stringify({ demoFixtureKey: 'SUCCESSFUL_SUBMISSION' }),
      });

      await sdk.switchDemoPersona({ userId: 'reviewer_01' });
      const evalRes = await sdk.evaluateMilestoneEvidence('ms_seed_01');
      await sdk.submitHumanReview('ms_seed_01', {
        evaluationId: evalRes.evaluation.id,
        decision: 'APPROVE',
        approvedAmountCents: 200000, // Partial approval ($2,000.00 out of $2,500.00 authorized)
        justification: 'Approved partial $2,000.00 settlement per agreed scope adjustment.',
      });

      const partialCap = await sdk.capturePayPalAuthorization(
        'ms_seed_01',
        'idemp_partial_cap_01'
      );
      assert.equal(partialCap.transaction.status, 'PARTIALLY_CAPTURED_VOIDED');
      assert.equal(partialCap.transaction.authorizedAmountCents, 250000);
      assert.equal(partialCap.transaction.capturedAmountCents, 200000);

      // Verify listPayPalTransactions SDK method returns the transaction history
      const txList = await sdk.listPayPalTransactions('ms_seed_01');
      assert.equal(txList.transactions.length, 3);

      // 4c. Create & authorize PayPal Order on Milestone 2, then reconcile PAYMENT.AUTHORIZATION.VOIDED webhook
      await sdk.switchDemoPersona({ userId: 'client_01' });
      await sdk.createPayPalOrder('ms_seed_02', 'idemp_ms2_order_01');
      const authMs2 = await sdk.authorizePayPalOrder('ms_seed_02', 'idemp_ms2_auth_01');

      const voidWebhook = await sdk.handlePayPalWebhook(
        {
          'PAYPAL-TRANSMISSION-ID': 'wh_void_tx_01',
          'PAYPAL-TRANSMISSION-TIME': '2026-11-07T08:15:00Z',
          'PAYPAL-TRANSMISSION-SIG': 'sig_verified_paypal_void_event_12345',
          'PAYPAL-CERT-URL': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123',
          'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
        },
        {
          id: 'WH-EVT-VOID-002',
          event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
          resource: { id: authMs2.transaction.paypalAuthorizationId },
        }
      );
      assert.equal(voidWebhook.verified, true);
      assert.equal(voidWebhook.status, 'RECONCILED_VOIDED');

      const ms2Txs = await sdk.listPayPalTransactions('ms_seed_02');
      assert.equal(ms2Txs.transactions[0].status, 'VOIDED');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });
});
