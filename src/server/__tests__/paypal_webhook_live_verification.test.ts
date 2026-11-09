import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createServerApp } from '../index.ts';

const PAYPAL_NON_ESCROW_DISCLOSURE =
  'PayPal Orders API v2 intent: AUTHORIZE places a temporary payment hold (29-day maximum validity window) and is NOT custodial escrow.';

function createMockPayPalFetch(options?: {
  verifyStatus?: 'SUCCESS' | 'FAILURE';
  verifyShouldTimeout?: boolean;
}): typeof fetch {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url.endsWith('/v1/oauth2/token')) {
      return new Response(
        JSON.stringify({ access_token: 'mock_sbx_access_token_secure', token_type: 'Bearer', expires_in: 3600 }),
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

    return new Response(JSON.stringify({ message: 'Endpoint not mapped' }), { status: 404 });
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
      policyCalculation: { permittedAmountCents: approvedAmountCents, passingCriteriaRatio: 1.0, riskPenaltyRatio: 0, formulaApplied: '250000', riskLevel: 'LOW' } as any,
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

const validHeaders: Record<string, string> = {
  'paypal-transmission-id': 'txid-wh-live-001',
  'paypal-transmission-time': '2026-11-09T07:00:00Z',
  'paypal-transmission-sig': 'sig_valid_live_verification_123',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-123',
  'paypal-auth-algo': 'SHA256withRSA',
};

describe('PayPal Webhook Live & Security Verification Suite', () => {
  it('1. accepts raw JSON string payload, parses it, and completes verification', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-001',
      },
    });

    try {
      const rawStringEvent = JSON.stringify({
        id: 'WH-EVT-RAW-001',
        event_type: 'CHECKOUT.ORDER.APPROVED',
        resource: { id: 'ORD-RAW-001' },
      });

      const res = await container.paypalService.handleWebhook(validHeaders, rawStringEvent);
      assert.equal(res.verified, true);
      assert.equal(res.eventId, 'WH-EVT-RAW-001');
      assert.equal(res.status, 'VERIFIED_UNMATCHED_RESOURCE_NOOP');

      const saved = container.webhookEventRepo.findByEventId('WH-EVT-RAW-001');
      assert.ok(saved);
      assert.equal(saved.processingStatus, 'PROCESSED');
      assert.equal(saved.verificationStatus, 'SUCCESS');
    } finally {
      container.db.close();
    }
  });

  it('2. rejects missing mandatory transmission headers and records REJECTED in database', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-002',
      },
    });

    try {
      const incompleteHeaders = { ...validHeaders };
      delete (incompleteHeaders as Record<string, string | undefined>)['paypal-transmission-sig'];

      await assert.rejects(
        async () => {
          await container.paypalService.handleWebhook(incompleteHeaders, {
            id: 'WH-EVT-MISSING-HDR',
            event_type: 'PAYMENT.AUTHORIZATION.CREATED',
            resource: { id: 'AUTH-HDR-001' },
          });
        },
        { name: 'AppError', statusCode: 401, code: 'MISSING_PAYPAL_WEBHOOK_HEADERS' }
      );

      const saved = container.webhookEventRepo.findByEventId('WH-EVT-MISSING-HDR');
      assert.ok(saved);
      assert.equal(saved.processingStatus, 'REJECTED');
      assert.equal(saved.processingResult, 'MISSING_PAYPAL_WEBHOOK_HEADERS');
    } finally {
      container.db.close();
    }
  });

  it('3. rejects untrusted paypal-cert-url to prevent SSRF and cert spoofing', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-003',
      },
    });

    try {
      const spoofedHeaders = {
        ...validHeaders,
        'paypal-cert-url': 'https://evil-attacker.example.com/fake-paypal-cert.pem',
      };

      await assert.rejects(
        async () => {
          await container.paypalService.handleWebhook(spoofedHeaders, {
            id: 'WH-EVT-SSRF-CERT',
            event_type: 'PAYMENT.AUTHORIZATION.CREATED',
            resource: { id: 'AUTH-SSRF-001' },
          });
        },
        { name: 'AppError', statusCode: 401, code: 'UNTRUSTED_PAYPAL_CERT_URL' }
      );

      const saved = container.webhookEventRepo.findByEventId('WH-EVT-SSRF-CERT');
      assert.ok(saved);
      assert.equal(saved.processingStatus, 'REJECTED');
      assert.equal(saved.processingResult, 'UNTRUSTED_PAYPAL_CERT_URL');
    } finally {
      container.db.close();
    }
  });

  it('4. rejects invalid signature from PayPal verify-webhook-signature API', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'FAILURE' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-004',
      },
    });

    try {
      const forgedSigHeaders = {
        ...validHeaders,
        'paypal-transmission-sig': 'sig_forged_invalid_signature_xyz',
      };

      await assert.rejects(
        async () => {
          await container.paypalService.handleWebhook(forgedSigHeaders, {
            id: 'WH-EVT-FORGED-SIG',
            event_type: 'PAYMENT.AUTHORIZATION.CREATED',
            resource: { id: 'AUTH-FORGED-001' },
          });
        },
        { name: 'AppError', statusCode: 401, code: 'INVALID_PAYPAL_WEBHOOK_SIGNATURE' }
      );

      const saved = container.webhookEventRepo.findByEventId('WH-EVT-FORGED-SIG');
      assert.ok(saved);
      assert.equal(saved.processingStatus, 'REJECTED');
      assert.equal(saved.processingResult, 'INVALID_PAYPAL_WEBHOOK_SIGNATURE');
    } finally {
      container.db.close();
    }
  });

  it('5. fails closed (503) when server-side PAYPAL_WEBHOOK_ID is unconfigured', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch(),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: undefined, // unconfigured
      },
    });

    try {
      await assert.rejects(
        async () => {
          await container.paypalService.handleWebhook(validHeaders, {
            id: 'WH-EVT-NO-CONFIG',
            event_type: 'PAYMENT.AUTHORIZATION.CREATED',
            resource: { id: 'AUTH-NO-CONFIG-001' },
          });
        },
        { name: 'AppError', statusCode: 503, code: 'WEBHOOK_VERIFICATION_UNAVAILABLE' }
      );
    } finally {
      container.db.close();
    }
  });

  it('6. handles duplicate sequential webhook delivery safely with DUPLICATE_IGNORED and zero extra mutations', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-006',
      },
    });

    try {
      const eventPayload = {
        id: 'WH-EVT-DUP-001',
        event_type: 'PAYMENT.AUTHORIZATION.CREATED',
        resource: { id: 'AUTH-DUP-001' },
      };

      const first = await container.paypalService.handleWebhook(validHeaders, eventPayload);
      assert.equal(first.verified, true);
      assert.equal(first.duplicate, false);

      const second = await container.paypalService.handleWebhook(validHeaders, eventPayload);
      assert.equal(second.verified, true);
      assert.equal(second.duplicate, true);
      assert.equal(second.status, 'DUPLICATE_IGNORED');

      const logs = container.auditService.listLogs({ entityId: 'WH-EVT-DUP-001' });
      const dupLogs = logs.filter((l) => l.action === 'PAYPAL_WEBHOOK_DUPLICATE_IGNORED');
      assert.equal(dupLogs.length, 1);
    } finally {
      container.db.close();
    }
  });

  it('7. out-of-order delivery preserves terminal CAPTURED state and forbids reversal to VOIDED', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-007',
      },
    });

    try {
      const nowIso = new Date().toISOString();
      const milestoneId = 'ms_seed_01';

      // Insert transaction already in terminal CAPTURED state
      container.paymentRepo.insert({
        id: 'ptx_term_007',
        milestoneId,
        approvalId: null,
        paypalOrderId: 'ORD-TERM-007',
        paypalAuthorizationId: 'AUTH-TERM-007',
        paypalCaptureId: 'CAP-TERM-007',
        idempotencyKey: 'idem-term-007',
        authorizedAmountCents: 250000,
        capturedAmountCents: 250000,
        currency: 'USD',
        status: 'CAPTURED',
        executionMode: 'PAYPAL_SANDBOX',
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        authExpiresAt: null,
        rawPaypalResponse: {},
        updatedAt: nowIso,
      });

      container.milestoneRepo.updatePaymentStatus(milestoneId, 'CAPTURED', 'SETTLED', nowIso);

      // Now out-of-order VOIDED event arrives
      const voidEvent = {
        id: 'WH-EVT-OUT-OF-ORDER-001',
        event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
        resource: { id: 'AUTH-TERM-007' },
      };

      const res = await container.paypalService.handleWebhook(validHeaders, voidEvent);
      assert.equal(res.verified, true);
      assert.equal(res.status, 'TERMINAL_STATE_PRESERVED');

      // Milestone MUST STILL BE SETTLED
      const ms = container.milestoneRepo.findById(milestoneId)!;
      assert.equal(ms.status, 'SETTLED');
      assert.equal(ms.paymentStatus, 'CAPTURED');
    } finally {
      container.db.close();
    }
  });

  it('8. prevents financial gate bypass: PAYMENT.CAPTURE.COMPLETED without human APPROVE is rejected', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-008',
      },
    });

    try {
      const nowIso = new Date().toISOString();
      const milestoneId = 'ms_seed_02';

      // Authorization hold exists and is in CAPTURE_PENDING
      container.paymentRepo.insert({
        id: 'ptx_pending_008',
        milestoneId,
        approvalId: null,
        paypalOrderId: 'ORD-PEND-008',
        paypalAuthorizationId: 'AUTH-PEND-008',
        paypalCaptureId: null,
        idempotencyKey: 'idem-pending-008',
        authorizedAmountCents: 350000,
        capturedAmountCents: 0,
        currency: 'USD',
        status: 'CAPTURE_PENDING',
        executionMode: 'PAYPAL_SANDBOX',
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        authExpiresAt: null,
        rawPaypalResponse: {},
        updatedAt: nowIso,
      });

      // Notice: NO human review has been submitted for ms_seed_02
      const capCompletedEvent = {
        id: 'WH-EVT-NO-APPROVAL-001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'AUTH-PEND-008',
          amount: { currency_code: 'USD', value: '3500.00' },
        },
      };

      const res = await container.paypalService.handleWebhook(validHeaders, capCompletedEvent);
      assert.equal(res.verified, true);
      assert.equal(res.status, 'REJECTED_MISSING_HUMAN_APPROVAL');

      // Milestone MUST NOT BE SETTLED
      const ms = container.milestoneRepo.findById(milestoneId)!;
      assert.notEqual(ms.status, 'SETTLED');
      assert.notEqual(ms.status, 'PAID');
    } finally {
      container.db.close();
    }
  });

  it('9. prevents financial gate bypass: amount mismatch between webhook and human approval is rejected', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-009',
      },
    });

    try {
      const nowIso = new Date().toISOString();
      const milestoneId = 'ms_seed_03';

      container.paymentRepo.insert({
        id: 'ptx_mismatch_009',
        milestoneId,
        approvalId: null,
        paypalOrderId: 'ORD-MISMATCH-009',
        paypalAuthorizationId: 'AUTH-MISMATCH-009',
        paypalCaptureId: null,
        idempotencyKey: 'idem-mismatch-009',
        authorizedAmountCents: 250000,
        capturedAmountCents: 0,
        currency: 'USD',
        status: 'CAPTURE_PENDING',
        executionMode: 'PAYPAL_SANDBOX',
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        authExpiresAt: null,
        rawPaypalResponse: {},
        updatedAt: nowIso,
      });

      // Human review approved $2,000.00 (200000 cents), but webhook attempts to claim full $2,500.00
      insertApprovedEvaluation(container, milestoneId, 200000);

      const mismatchEvent = {
        id: 'WH-EVT-AMOUNT-MISMATCH-001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'AUTH-MISMATCH-009',
          amount: { currency_code: 'USD', value: '2500.00' }, // $2,500 instead of $2,000!
        },
      };

      const res = await container.paypalService.handleWebhook(validHeaders, mismatchEvent);
      assert.equal(res.verified, true);
      assert.equal(res.status, 'REJECTED_AMOUNT_MISMATCH');

      // Milestone MUST NOT BE SETTLED
      const ms = container.milestoneRepo.findById(milestoneId)!;
      assert.notEqual(ms.status, 'SETTLED');
    } finally {
      container.db.close();
    }
  });

  it('10. unsolicited external capture on active hold quarantines as UNSOLICITED_REMOTE_CAPTURE_FLAGGED', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-010',
      },
    });

    try {
      const nowIso = new Date().toISOString();
      const milestoneId = 'ms_seed_01';

      // Payment is in AUTHORIZED status (hold created, no capture initiated by TrustChain)
      container.paymentRepo.insert({
        id: 'ptx_unsol_010',
        milestoneId,
        approvalId: null,
        paypalOrderId: 'ORD-UNSOL-010',
        paypalAuthorizationId: 'AUTH-UNSOL-010',
        paypalCaptureId: null,
        idempotencyKey: 'idem-unsol-010',
        authorizedAmountCents: 250000,
        capturedAmountCents: 0,
        currency: 'USD',
        status: 'AUTHORIZED',
        executionMode: 'PAYPAL_SANDBOX',
        nonEscrowDisclosure: PAYPAL_NON_ESCROW_DISCLOSURE,
        authExpiresAt: null,
        rawPaypalResponse: {},
        updatedAt: nowIso,
      });

      insertApprovedEvaluation(container, milestoneId, 250000);

      const unsolicitedEvent = {
        id: 'WH-EVT-UNSOLICITED-001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'AUTH-UNSOL-010',
          amount: { currency_code: 'USD', value: '2500.00' },
        },
      };

      const res = await container.paypalService.handleWebhook(validHeaders, unsolicitedEvent);
      assert.equal(res.verified, true);
      assert.equal(res.status, 'UNSOLICITED_REMOTE_CAPTURE_FLAGGED');

      // Milestone MUST NOT BE AUTOMATICALLY SETTLED
      const ms = container.milestoneRepo.findById(milestoneId)!;
      assert.notEqual(ms.status, 'SETTLED');

      // Payment transaction marked for reconciliation
      const tx = container.paymentRepo.findByIdempotencyKey('idem-unsol-010')!;
      assert.equal(tx.status, 'REQUIRES_RECONCILIATION');
    } finally {
      container.db.close();
    }
  });

  it('11. unsupported/unknown events are safely acknowledged with VERIFIED_UNKNOWN_EVENT_NOOP without crashing', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        fetchImpl: createMockPayPalFetch({ verifyStatus: 'SUCCESS' }),
        clientId: 'mock_client_id_live',
        clientSecret: 'mock_client_secret_live',
        webhookId: 'WH-LIVE-VERIFY-011',
      },
    });

    try {
      const unknownEvent = {
        id: 'WH-EVT-UNKNOWN-TYPE-001',
        event_type: 'BILLING.SUBSCRIPTION.SUSPENDED',
        resource: { id: 'SUB-999' },
      };

      const res = await container.paypalService.handleWebhook(validHeaders, unknownEvent);
      assert.equal(res.verified, true);
      assert.equal(res.status, 'VERIFIED_UNMATCHED_RESOURCE_NOOP');
      assert.equal(res.duplicate, false);
    } finally {
      container.db.close();
    }
  });
});
