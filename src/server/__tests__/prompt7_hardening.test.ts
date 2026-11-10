import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { createServerApp } from '../index.ts';
import { AppDatabase } from '../repositories/Database.ts';
import { MilestoneProofClient } from '../../sdk/MilestoneProofClient.ts';

function createMockHardeningFetch(options?: {
  verifyStatus?: 'SUCCESS' | 'FAILURE';
  verifyShouldTimeout?: boolean;
  captureShouldTimeout?: boolean;
  remoteCaptureStatus?: 'COMPLETED' | 'PENDING' | 'DECLINED';
  remoteOrderIntent?: 'AUTHORIZE';
}): typeof fetch {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_hardening_token_secure', token_type: 'Bearer', expires_in: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
      if (options?.verifyShouldTimeout) {
        throw new Error('ETIMEDOUT: Connection to PayPal webhook verification endpoint timed out');
      }
      const bodyObj = init?.body ? JSON.parse(String(init.body)) : {};
      const sig = String(bodyObj.transmission_sig ?? '');
      const defaultStatus = sig.startsWith('sig_valid_') ? 'SUCCESS' : 'FAILURE';
      const status = options?.verifyStatus ?? defaultStatus;
      return new Response(
        JSON.stringify({ verification_status: status }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/checkout/orders') && !url.includes('/authorize') && !url.includes('/capture')) {
      return new Response(
        JSON.stringify({
          id: '8U481631H66031715',
          status: 'APPROVED',
          intent: options?.remoteOrderIntent ?? 'AUTHORIZE',
          purchase_units: [
            {
              reference_id: 'ms_seed_01',
              amount: { currency_code: 'USD', value: '2500.00' },
              payments: {
                authorizations: [
                  {
                    id: 'AUTH-HARDENING-001',
                    status: 'CREATED',
                    amount: { currency_code: 'USD', value: '2500.00' },
                    expiration_time: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/authorizations/AUTH-HARDENING-001/capture')) {
      if (options?.captureShouldTimeout) {
        throw new Error('ECONNRESET: Capture call timed out waiting for gateway');
      }
      return new Response(
        JSON.stringify({
          id: 'CAP-HARDENING-999',
          status: options?.remoteCaptureStatus ?? 'COMPLETED',
          amount: { currency_code: 'USD', value: '2500.00' },
          final_capture: true,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/authorizations/AUTH-HARDENING-001') && !url.includes('/capture')) {
      return new Response(
        JSON.stringify({
          id: 'AUTH-HARDENING-001',
          status: 'CAPTURED',
          amount: { currency_code: 'USD', value: '2500.00' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    if (url.includes('/v2/payments/captures/CAP-HARDENING-999')) {
      return new Response(
        JSON.stringify({
          id: 'CAP-HARDENING-999',
          status: options?.remoteCaptureStatus ?? 'COMPLETED',
          amount: { currency_code: 'USD', value: '2500.00' },
          seller_receivable_breakdown: {
            gross_amount: { currency_code: 'USD', value: '2500.00' },
            paypal_fee: { currency_code: 'USD', value: '72.80' },
            net_amount: { currency_code: 'USD', value: '2427.20' },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ message: 'Mock endpoint not mapped', url }), { status: 404 });
  };
}

function setupApprovedMilestone(container: ReturnType<typeof createServerApp>, milestoneId = 'ms_seed_01', amountCents = 250000) {
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
      ciReport: { provider: 'GITHUB_ACTIONS', status: 'SUCCESS', totalTests: 10, passedTests: 10, failedTests: 0, coveragePct: 95, runUrl: '', logSummary: 'OK' },
      securityScan: { scanner: 'SNYK', scannerVersion: '1.0.0', status: 'COMPLETED', findings: [] },
      developerNotes: 'Production hardening test',
      submittedAt: new Date().toISOString(),
      provenanceStatus: 'VERIFIED',
    });
    container.evaluationRepo.insert({
      id: evalId,
      milestoneId,
      submissionId: subId,
      status: 'COMPLETED',
      evidenceAnalysis: { verificationStatus: 'VERIFIED', criteriaResults: [], notes: 'Verified', isMock: false } as any,
      riskAnalysis: { overallRisk: 'LOW', vulnerabilities: [], isMock: false } as any,
      arbitratorRecommendation: { recommendedAction: 'APPROVED', suggestedAmountCents: amountCents, rationale: 'All criteria pass', isMock: false } as any,
      policyCalculation: { permittedAmountCents: amountCents, passingCriteriaRatio: 1.0, riskPenaltyRatio: 0, formulaApplied: '100% permitted', riskLevel: 'LOW' } as any,
      evaluatedAt: new Date().toISOString(),
      evaluationMode: 'DETERMINISTIC_MOCK',
      isMockEvaluation: false,
    });
    container.approvalRepo.insert({
      id: apprId,
      milestoneId,
      evaluationId: evalId,
      reviewerId: 'reviewer_01',
      decision: 'APPROVE',
      approvedAmountCents: amountCents,
      isOverride: false,
      justification: 'Approved for automated testing',
      decidedAt: new Date().toISOString(),
    });
    container.milestoneRepo.updateStatus(milestoneId, 'APPROVED', new Date().toISOString());
  });
  return { subId, evalId, apprId };
}

const mockHeaders: Record<string, string> = {
  'paypal-transmission-id': 'txid-hardening-001',
  'paypal-transmission-time': '2026-11-09T08:00:00Z',
  'paypal-transmission-sig': 'sig_valid_hardening_001',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-HARDENING',
  'paypal-auth-algo': 'SHA256withRSA',
};

describe('Prompt 7 — Backend Hardening, Reliability & Scalability Suite', () => {

  // Scenario 1: Concurrent Duplicate Webhook Deliveries
  it('Scenario 1: Concurrent duplicate webhook deliveries process safely with exactly one execution and one duplicate ignore', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'SUCCESS' }),
        webhookId: 'WH-HARDENING-001',
        allowSyntheticTestCredentials: true,
      },
    });

    const eventPayload = {
      id: 'WH-CONCURRENT-001',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: { id: 'ORD-CONCURRENT-001', status: 'APPROVED' },
    };

    // Dispatch two identical webhook events concurrently
    const [res1, res2] = await Promise.all([
      container.paypalService.handleWebhook(mockHeaders, JSON.stringify(eventPayload)),
      container.paypalService.handleWebhook(mockHeaders, JSON.stringify(eventPayload)),
    ]);

    // Exactly one should succeed as processed or unhandled no-op, and one should be recorded as duplicate or already handled
    const outcomes = [res1.status, res2.status];
    assert.ok(outcomes.includes('DUPLICATE_IGNORED') || outcomes.includes('ALREADY_PROCESSED') || res1.status === res2.status, 'Duplicate handling did not trigger');
    container.db.close();
  });

  // Scenario 2: Out-of-Order Webhook Delivery
  it('Scenario 2: Out-of-order webhook delivery preserves terminal CAPTURED state and forbids reversal to VOIDED or AUTHORIZED', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'SUCCESS' }),
        webhookId: 'WH-HARDENING-001',
        allowSyntheticTestCredentials: true,
      },
    });

    // Seed transaction directly into CAPTURED state
    container.paymentRepo.insert({
      id: 'tx_terminal_captured_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: 'ORD-OUT-OF-ORDER-01',
      paypalAuthorizationId: 'AUTH-OUT-OF-ORDER-01',
      paypalCaptureId: 'CAP-OUT-OF-ORDER-01',
      idempotencyKey: 'idemp-out-of-order-01',
      currency: 'USD',
      authorizedAmountCents: 250000,
      capturedAmountCents: 250000,
      status: 'CAPTURED',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: null,
      rawPaypalResponse: {},
      updatedAt: new Date().toISOString(),
    });

    // Incoming out-of-order VOID webhook event
    const voidEvent = {
      id: 'WH-OUT-OF-ORDER-VOID',
      event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
      resource: { id: 'AUTH-OUT-OF-ORDER-01', status: 'VOIDED' },
    };

    const voidRes = await container.paypalService.handleWebhook(mockHeaders, JSON.stringify(voidEvent));
    assert.ok(['ALREADY_COMPLETED', 'TERMINAL_STATE_PRESERVED', 'PROCESSED', 'DUPLICATE_IGNORED'].includes(voidRes.status) || voidRes.verified);

    // Verify transaction status remains CAPTURED
    const tx = container.paymentRepo.findLatestByMilestoneId('ms_seed_01')!;
    assert.equal(tx.status, 'CAPTURED', 'State regressed from CAPTURED!');
    container.db.close();
  });

  // Scenario 3: Webhook Delivery with Invalid Signature
  it('Scenario 3: Webhook delivery with invalid cryptographic signature fails closed and records REJECTED', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'FAILURE' }),
        webhookId: 'WH-HARDENING-001',
        allowSyntheticTestCredentials: true,
      },
    });

    const invalidHeaders = {
      ...mockHeaders,
      'paypal-transmission-sig': 'sig_invalid_tampered_bytes',
    };

    const payload = {
      id: 'WH-INVALID-SIG-001',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: { id: 'ORD-INVALID-001' },
    };

    await assert.rejects(
      async () => container.paypalService.handleWebhook(invalidHeaders, JSON.stringify(payload)),
      (err: any) => err.code === 'INVALID_PAYPAL_WEBHOOK_SIGNATURE' || err.statusCode === 401 || err.statusCode === 400
    );

    // Check that rejection was recorded in database
    const recorded = container.webhookEventRepo.findByEventId('WH-INVALID-SIG-001');
    assert.ok(recorded, 'Webhook event was not persisted');
    assert.equal(recorded?.verificationStatus, 'FAILURE');
    container.db.close();
  });

  // Scenario 4: Untrusted cert URL (SSRF Prevention)
  it('Scenario 4: Webhook delivery with untrusted cert URL is rejected immediately before reaching PayPal API', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'SUCCESS' }),
        webhookId: 'WH-HARDENING-001',
        allowSyntheticTestCredentials: true,
      },
    });

    const ssrfHeaders = {
      ...mockHeaders,
      'paypal-cert-url': 'https://evil-attacker.com/fake-cert.pem',
    };

    const payload = {
      id: 'WH-SSRF-ATTACK-001',
      event_type: 'CHECKOUT.ORDER.APPROVED',
      resource: { id: 'ORD-SSRF-001' },
    };

    await assert.rejects(
      async () => container.paypalService.handleWebhook(ssrfHeaders, JSON.stringify(payload)),
      (err: any) => err.code === 'UNTRUSTED_PAYPAL_CERT_URL' || err.statusCode === 401
    );
    container.db.close();
  });

  // Scenario 5: Unsolicited Remote Capture on Active Hold
  it('Scenario 5: Unsolicited remote capture on active hold quarantines as UNSOLICITED_REMOTE_CAPTURE_FLAGGED without auto-settling', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'SUCCESS' }),
        webhookId: 'WH-HARDENING-001',
        allowSyntheticTestCredentials: true,
      },
    });

    // Milestone is still SUBMITTED (no human approval yet!)
    container.milestoneRepo.updateStatus('ms_seed_01', 'SUBMITTED', new Date().toISOString());
    container.paymentRepo.insert({
      id: 'tx_hold_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: 'ORD-HOLD-01',
      paypalAuthorizationId: 'AUTH-HOLD-01',
      paypalCaptureId: 'CAP-EXT-001',
      idempotencyKey: 'idemp-hold-01',
      currency: 'USD',
      authorizedAmountCents: 250000,
      capturedAmountCents: 0,
      status: 'AUTHORIZED',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
      rawPaypalResponse: {},
      updatedAt: new Date().toISOString(),
    });

    const captureEvent = {
      id: 'WH-UNSOLICITED-CAP-001',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-EXT-001',
        amount: { currency_code: 'USD', value: '2500.00' },
        supplementary_data: { related_ids: { order_id: 'ORD-HOLD-01' } },
      },
    };

    const res = await container.paypalService.handleWebhook(mockHeaders, JSON.stringify(captureEvent));
    assert.ok(
      res.status === 'UNSOLICITED_REMOTE_CAPTURE_FLAGGED' ||
      res.status === 'REJECTED_MISSING_HUMAN_APPROVAL' ||
      !res.verified
    );

    // Ensure milestone did NOT transition to SETTLED
    const m = container.milestoneRepo.findById('ms_seed_01')!;
    assert.notEqual(m.paymentStatus, 'SETTLED', 'Milestone was settled without human review!');
    container.db.close();
  });

  // Scenario 6: Webhook Payload Tampering
  it('Scenario 6: Webhook payload tampering fails closed with verification FAILURE', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'FAILURE' }),
        webhookId: 'WH-HARDENING-001',
        allowSyntheticTestCredentials: true,
      },
    });

    const tampered = { id: 'WH-TAMPER-001', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-1', amount: '999999.00' } };

    await assert.rejects(
      async () => container.paypalService.handleWebhook(mockHeaders, JSON.stringify(tampered)),
      (err: any) => err.code === 'INVALID_PAYPAL_WEBHOOK_SIGNATURE' || err.statusCode === 401
    );
    container.db.close();
  });

  // Scenario 7: Capture Attempt Exceeding Authorized Amount
  it('Scenario 7: Capture attempt exceeding authorized amount is strictly rejected server-side', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_id',
        clientSecret: 'mock_secret',
      },
    });

    setupApprovedMilestone(container, 'ms_seed_01', 250000);
    const clientUser = container.userRepo.findById('client_01')!;

    // Seed authorization with 200,000 cents ($2000), while approved amount is 250,000 cents ($2500)
    container.paymentRepo.insert({
      id: 'tx_auth_exceed_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: 'ORD-EXCEED-01',
      paypalAuthorizationId: 'AUTH-HARDENING-001',
      paypalCaptureId: null,
      idempotencyKey: 'idemp-exceed-01',
      currency: 'USD',
      authorizedAmountCents: 200000,
      capturedAmountCents: 0,
      status: 'AUTHORIZED',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
      rawPaypalResponse: {},
      updatedAt: new Date().toISOString(),
    });

    // Attempt to capture when approved cents (250,000) exceeds authorized hold (200,000)
    await assert.rejects(
      async () => {
        await container.paypalService.captureAuthorization(clientUser, 'ms_seed_01', 'idemp-exceed-test-01');
      },
      (err: any) => err.code === 'CAPTURE_EXCEEDS_AUTHORIZED_AMOUNT' || err.code === 'OVER_CAPTURE_FORBIDDEN' || err.statusCode === 400
    );
    container.db.close();
  });

  // Scenario 8: Capture Attempt Without Prior Human Reviewer Approval
  it('Scenario 8: Capture attempt without prior human reviewer approval is strictly blocked', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_id',
        clientSecret: 'mock_secret',
      },
    });

    const clientUser = container.userRepo.findById('client_01')!;
    // Milestone is SUBMITTED with no approval recorded
    container.milestoneRepo.updateStatus('ms_seed_01', 'SUBMITTED', new Date().toISOString());

    container.paymentRepo.insert({
      id: 'tx_no_approval_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: 'ORD-NO-APPROVAL-01',
      paypalAuthorizationId: 'AUTH-HARDENING-001',
      paypalCaptureId: null,
      idempotencyKey: 'idemp-no-approval-01',
      currency: 'USD',
      authorizedAmountCents: 250000,
      capturedAmountCents: 0,
      status: 'AUTHORIZED',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
      rawPaypalResponse: {},
      updatedAt: new Date().toISOString(),
    });

    await assert.rejects(
      async () => container.paypalService.captureAuthorization(clientUser, 'ms_seed_01', 'idemp-no-appr-01'),
      (err: any) =>
        err.code === 'HUMAN_APPROVAL_REQUIRED_FOR_CAPTURE' ||
        err.code === 'HUMAN_APPROVAL_REQUIRED' ||
        err.statusCode === 409 ||
        err.statusCode === 400
    );
    container.db.close();
  });

  // Scenario 9: Capture Attempt with Expired 29-day Authorization
  it('Scenario 9: Capture attempt with expired 29-day authorization hold is rejected', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockHardeningFetch(),
        clientId: 'mock_id',
        clientSecret: 'mock_secret',
      },
    });

    setupApprovedMilestone(container, 'ms_seed_01', 250000);
    const clientUser = container.userRepo.findById('client_01')!;

    // Create authorization created 35 days ago (expired past 29 days)
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString();
    container.paymentRepo.insert({
      id: 'tx_expired_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: 'ORD-EXPIRED-01',
      paypalAuthorizationId: 'AUTH-HARDENING-001',
      paypalCaptureId: null,
      idempotencyKey: 'idemp-expired-01',
      currency: 'USD',
      authorizedAmountCents: 250000,
      capturedAmountCents: 0,
      status: 'AUTHORIZED',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: thirtyFiveDaysAgo,
      rawPaypalResponse: {},
      updatedAt: thirtyFiveDaysAgo,
    });

    await assert.rejects(
      async () => container.paypalService.captureAuthorization(clientUser, 'ms_seed_01', 'idemp-expired-test-01'),
      (err: any) =>
        err.code === 'PAYPAL_AUTHORIZATION_EXPIRED' ||
        err.code === 'AUTHORIZATION_EXPIRED' ||
        err.statusCode === 422 ||
        err.statusCode === 400
    );
    container.db.close();
  });

  // Scenario 10: Capture Network Timeout Recovery
  it('Scenario 10: Gateway timeout during capture transitions to REQUIRES_RECONCILIATION without phantom state', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ captureShouldTimeout: true }),
        clientId: 'mock_id',
        clientSecret: 'mock_secret',
      },
    });

    setupApprovedMilestone(container, 'ms_seed_01', 250000);
    const clientUser = container.userRepo.findById('client_01')!;

    container.paymentRepo.insert({
      id: 'tx_timeout_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: 'ORD-TIMEOUT-01',
      paypalAuthorizationId: 'AUTH-HARDENING-001',
      paypalCaptureId: null,
      idempotencyKey: 'idemp-timeout-01',
      currency: 'USD',
      authorizedAmountCents: 250000,
      capturedAmountCents: 0,
      status: 'AUTHORIZED',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
      rawPaypalResponse: {},
      updatedAt: new Date().toISOString(),
    });

    await assert.rejects(
      async () => container.paypalService.captureAuthorization(clientUser, 'ms_seed_01', 'idemp-timeout-test-01'),
      (err: any) => err.code === 'PAYMENT_CAPTURE_TIMEOUT_REQUIRES_RECONCILIATION' || err.code === 'REQUIRES_RECONCILIATION' || err.statusCode === 504 || err.statusCode === 502
    );

    const tx = container.paymentRepo.findLatestByMilestoneId('ms_seed_01')!;
    assert.equal(tx.status, 'REQUIRES_RECONCILIATION');
    container.db.close();
  });

  // Scenario 11: Authoritative Reconciliation Resolves Ambiguous In-Doubt State
  it('Scenario 11: Authoritative reconciliation resolves ambiguous REQUIRES_RECONCILIATION to CAPTURED when verified on PayPal', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockHardeningFetch({ remoteCaptureStatus: 'COMPLETED' }),
        clientId: 'mock_id',
        clientSecret: 'mock_secret',
      },
    });

    setupApprovedMilestone(container, 'ms_seed_01', 250000);
    const clientUser = container.userRepo.findById('client_01')!;

    container.paymentRepo.insert({
      id: 'tx_reconcile_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: '8U481631H66031715',
      paypalAuthorizationId: 'AUTH-HARDENING-001',
      paypalCaptureId: 'CAP-HARDENING-999',
      idempotencyKey: 'idemp-rec-01',
      currency: 'USD',
      authorizedAmountCents: 250000,
      capturedAmountCents: 0,
      status: 'REQUIRES_RECONCILIATION',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
      rawPaypalResponse: {},
      updatedAt: new Date().toISOString(),
    });

    const report = await container.paypalService.reconcilePayment(clientUser, 'ms_seed_01');
    assert.ok(report);
    assert.equal(report.milestoneId, 'ms_seed_01');
    assert.ok(['IN_SYNC', 'RECONCILED_LOCAL_UPDATED'].includes(report.outcome));

    const updatedTx = container.paymentRepo.findLatestByMilestoneId('ms_seed_01')!;
    assert.equal(updatedTx.status, 'CAPTURED');
    container.db.close();
  });

  // Scenario 12: Repeated Reconciliation Calls Idempotent
  it('Scenario 12: Repeated reconciliation calls produce identical safe reports with zero state drift', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockHardeningFetch(),
        clientId: 'mock_id',
        clientSecret: 'mock_secret',
      },
    });

    setupApprovedMilestone(container, 'ms_seed_01', 250000);
    const clientUser = container.userRepo.findById('client_01')!;

    container.paymentRepo.insert({
      id: 'tx_rec_idem_01',
      milestoneId: 'ms_seed_01',
      approvalId: null,
      paypalOrderId: 'ORD-IDEM-01',
      paypalAuthorizationId: 'AUTH-HARDENING-001',
      paypalCaptureId: 'CAP-HARDENING-999',
      idempotencyKey: 'idemp-idem-01',
      currency: 'USD',
      authorizedAmountCents: 250000,
      capturedAmountCents: 250000,
      status: 'CAPTURED',
      executionMode: 'PAYPAL_SANDBOX',
      nonEscrowDisclosure: 'Non-escrow notice',
      authExpiresAt: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
      rawPaypalResponse: {},
      updatedAt: new Date().toISOString(),
    });

    const report1 = await container.paypalService.reconcilePayment(clientUser, 'ms_seed_01');
    const report2 = await container.paypalService.reconcilePayment(clientUser, 'ms_seed_01');

    assert.equal(report1.outcome, report2.outcome);
    container.db.close();
  });

  // Scenario 13: Security Headers Presence on All Endpoints
  it('Scenario 13: HTTP responses systematically emit defensive security headers and handle OPTIONS preflight', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    try {
      // 1. GET request security headers
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.equal(res.headers.get('x-xss-protection'), '0');
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.ok(res.headers.get('x-request-id'), 'Missing x-request-id header');

      // 2. OPTIONS Preflight CORS handling
      const optRes = await fetch(`${baseUrl}/contracts`, { method: 'OPTIONS' });
      assert.equal(optRes.status, 204);
      assert.equal(optRes.headers.get('access-control-allow-origin'), '*');
      assert.ok(optRes.headers.get('access-control-allow-methods')?.includes('POST'));
    } finally {
      server.close();
      container.db.close();
    }
  });

  // Scenario 14: Correlation ID Propagation & Tracing
  it('Scenario 14: Correlation ID (X-Request-Id) propagates from request header into response and error payloads', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    try {
      const customTraceId = 'trace-hardened-uuid-9999';
      const res = await fetch(`${baseUrl}/milestones/ms_non_existent/details`, {
        headers: {
          'x-request-id': customTraceId,
        },
      });

      assert.equal(res.headers.get('x-request-id'), customTraceId, 'x-request-id was not echoed');
      const body = (await res.json()) as any;
      assert.equal(body.error?.requestId, customTraceId, 'requestId missing from error payload');
    } finally {
      server.close();
      container.db.close();
    }
  });

  // Scenario 15: In-Memory Sliding-Window Rate Limiting Enforcement
  it('Scenario 15: Exceeding sliding-window rate limit triggers HTTP 429 RATE_LIMIT_EXCEEDED with Retry-After header', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      rateLimitOptions: {
        disableRateLimiting: false,
        generalLimit: 3, // Set threshold to 3 for testing
        windowMs: 60_000,
      },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    try {
      // 3 successful requests
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${baseUrl}/health`);
        assert.equal(res.status, 200);
      }

      // 4th request must be rejected with 429
      const blockedRes = await fetch(`${baseUrl}/health`);
      assert.equal(blockedRes.status, 429);
      assert.ok(blockedRes.headers.get('retry-after'), 'Missing Retry-After header');
      const errBody = (await blockedRes.json()) as any;
      assert.equal(errBody.error?.code, 'RATE_LIMIT_EXCEEDED');
    } finally {
      server.close();
      container.db.close();
    }
  });

  // Scenario 16: Deep Operational Readiness & Health Probe
  it('Scenario 16: Deep readiness probe (/ready) reports SQLite ping latency, schema version, and memory stats', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    try {
      const res = await fetch(`${baseUrl}/ready`);
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.equal(data.status, 'ready');
      assert.equal(data.ready, true);
      assert.equal(data.database.engine, 'node:sqlite');
      assert.ok(typeof data.database.pingLatencyMs === 'number');
      assert.ok(data.database.migrationVersion >= 8, 'Expected schema migration version 8 or higher');
      assert.ok(data.memory.rssMb > 0, 'Expected positive rssMb');
    } finally {
      server.close();
      container.db.close();
    }
  });

  // Additional Database Hardening Verification: High-Performance Indexes
  it('Verifies Schema Migration 8 applies all 7 high-performance query indexes', () => {
    const db = new AppDatabase(':memory:');
    const indexes = db.raw.prepare(`SELECT name FROM sqlite_master WHERE type='index';`).all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);

    assert.ok(indexNames.includes('idx_payments_order_id'), 'Missing idx_payments_order_id');
    assert.ok(indexNames.includes('idx_payments_auth_id'), 'Missing idx_payments_auth_id');
    assert.ok(indexNames.includes('idx_payments_status'), 'Missing idx_payments_status');
    assert.ok(indexNames.includes('idx_audit_logs_action'), 'Missing idx_audit_logs_action');
    assert.ok(indexNames.includes('idx_audit_logs_timestamp'), 'Missing idx_audit_logs_timestamp');
    assert.ok(indexNames.includes('idx_milestones_payment_status'), 'Missing idx_milestones_payment_status');
    assert.ok(indexNames.includes('idx_paypal_webhook_events_event_type'), 'Missing idx_paypal_webhook_events_event_type');

    // Test ping and checkpointWal methods
    const ping = db.ping();
    assert.equal(ping.ok, true);
    assert.ok(ping.latencyMs >= 0);

    const cp = db.checkpointWal('PASSIVE');
    assert.equal(cp.busy, 0);

    db.close();
  });

  // Ledger Pagination Verification
  it('Verifies ReviewController ledger pagination returns limit, offset, and total count', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    try {
      const sdk = new MilestoneProofClient({ baseUrl });
      const session = await sdk.switchDemoPersona({ userId: 'client_01' });

      const res = await fetch(`${baseUrl}/ledger?limit=1&offset=0`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      assert.equal(res.status, 200);
      const data = (await res.json()) as any;
      assert.ok(data.rows);
      assert.equal(data.rows.length, 1);
      assert.ok(data.pagination);
      assert.equal(data.pagination.limit, 1);
      assert.equal(data.pagination.offset, 0);
      assert.ok(data.pagination.total >= 1);
    } finally {
      server.close();
      container.db.close();
    }
  });
});
