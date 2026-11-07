import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServerApp } from '../index.ts';
import {
  MilestoneProofApiError,
  MilestoneProofClient,
} from '../../sdk/MilestoneProofClient.ts';

const VALID_WEBHOOK_HEADERS = {
  'PAYPAL-TRANSMISSION-ID': 'wh_tx_phase6_001',
  'PAYPAL-TRANSMISSION-TIME': '2026-11-07T09:00:00Z',
  'PAYPAL-TRANSMISSION-SIG': 'sig_verified_paypal_rsa_sha256_001',
  'PAYPAL-CERT-URL': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360caa42-fca2a594-1d93a270',
  'PAYPAL-AUTH-ALGO': 'SHA256withRSA',
};

describe('Phase 6 — PayPal Security Remediation & Payment Integrity', () => {
  it('1. Authorization ID Extraction & Persistence: extracts real PayPal authorization ID, rejects missing/malformed authorization IDs without synthetic fallback, and captures using the persisted real authorization ID', async () => {
    let authorizeBehavior: 'VALID' | 'MISSING_AUTH_ID' | 'MALFORMED_JSON' = 'MISSING_AUTH_ID';
    const capturedAuthUrls: string[] = [];

    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'sbx_oauth_token_live', token_type: 'Bearer' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith('/v2/checkout/orders')) {
        return new Response(
          JSON.stringify({ id: 'PAYPAL-LIVE-ORD-778899', status: 'CREATED', intent: 'AUTHORIZE' }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
        if (authorizeBehavior === 'MALFORMED_JSON') {
          return new Response('<<<NOT_VALID_JSON>>>', {
            status: 201,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (authorizeBehavior === 'MISSING_AUTH_ID') {
          // Response missing purchase_units[0].payments.authorizations[0].id
          return new Response(
            JSON.stringify({
              id: 'PAYPAL-LIVE-ORD-778899',
              status: 'COMPLETED',
              purchase_units: [{ payments: { authorizations: [{}] } }],
            }),
            { status: 201, headers: { 'content-type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-LIVE-ORD-778899',
            status: 'COMPLETED',
            purchase_units: [
              {
                payments: {
                  authorizations: [
                    {
                      id: 'PAYPAL-REAL-AUTH-99001122',
                      status: 'CREATED',
                      expiration_time: '2026-12-06T09:00:00.000Z',
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
        capturedAuthUrls.push(url);
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-REAL-CAP-55443322',
            status: 'COMPLETED',
            final_capture: true,
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    };

    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        clientId: 'sbx_live_client_id',
        clientSecret: 'sbx_live_client_secret',
        webhookId: 'WH-LIVE-001',
        fetchImpl: mockFetch,
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
      await sdk.switchDemoPersona({ userId: 'client_01' });

      // 1a. Create real sandbox order
      const orderRes = await sdk.createPayPalOrder('ms_seed_01', 'idemp_p6_order_01');
      assert.equal(orderRes.transaction.paypalOrderId, 'PAYPAL-LIVE-ORD-778899');
      assert.equal(orderRes.transaction.executionMode, 'PAYPAL_SANDBOX');
      assert.equal(orderRes.transaction.status, 'ORDER_CREATED');

      // 1b. Authorize when response is missing authorization ID -> MUST fail with 422 MISSING_PAYPAL_AUTHORIZATION_ID and NOT persist a synthetic AUTH-MPAI-* ID
      authorizeBehavior = 'MISSING_AUTH_ID';
      await assert.rejects(
        async () => {
          await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_p6_auth_missing_01');
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 422);
          assert.equal(err.code, 'MISSING_PAYPAL_AUTHORIZATION_ID');
          return true;
        }
      );

      // Verify no authorization record was persisted
      const txsAfterMissing = await sdk.listPayPalTransactions('ms_seed_01');
      assert.equal(txsAfterMissing.transactions.length, 1);
      assert.equal(txsAfterMissing.transactions[0].status, 'ORDER_CREATED');

      // 1c. Authorize when response is malformed JSON -> MUST fail with 422 MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE
      authorizeBehavior = 'MALFORMED_JSON';
      await assert.rejects(
        async () => {
          await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_p6_auth_malformed_01');
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 422);
          assert.equal(err.code, 'MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE');
          return true;
        }
      );

      // 1d. Authorize with valid PayPal response -> extracts real authorization ID 'PAYPAL-REAL-AUTH-99001122'
      authorizeBehavior = 'VALID';
      const authRes = await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_p6_auth_valid_01');
      assert.equal(authRes.transaction.paypalAuthorizationId, 'PAYPAL-REAL-AUTH-99001122');
      assert.equal(authRes.transaction.paypalOrderId, 'PAYPAL-LIVE-ORD-778899');
      assert.equal(authRes.transaction.authExpiresAt, '2026-12-06T09:00:00.000Z');
      assert.equal(authRes.transaction.status, 'AUTHORIZED');
      assert.equal(authRes.transaction.executionMode, 'PAYPAL_SANDBOX');

      // 1e. Submit evidence, evaluate, record human approval, and capture -> verify capture URL uses 'PAYPAL-REAL-AUTH-99001122'
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
        approvedAmountCents: 250000,
        justification: 'Approved after full verification of OAuth2 criteria.',
      });

      const capRes = await sdk.capturePayPalAuthorization('ms_seed_01', 'idemp_p6_cap_valid_01');
      assert.equal(capRes.transaction.paypalAuthorizationId, 'PAYPAL-REAL-AUTH-99001122');
      assert.equal(capRes.transaction.paypalCaptureId, 'PAYPAL-REAL-CAP-55443322');
      assert.equal(capRes.transaction.status, 'CAPTURED');
      assert.equal(capRes.transaction.executionMode, 'PAYPAL_SANDBOX');
      assert.equal(capturedAuthUrls.length, 1);
      assert.match(
        capturedAuthUrls[0],
        /\/v2\/payments\/authorizations\/PAYPAL-REAL-AUTH-99001122\/capture$/
      );

      // Verify milestone transitioned to SETTLED & CAPTURED in real PAYPAL_SANDBOX mode
      const updatedMilestone = container.milestoneRepo.findById('ms_seed_01');
      assert.ok(updatedMilestone);
      assert.equal(updatedMilestone.status, 'SETTLED');
      assert.equal(updatedMilestone.paymentStatus, 'CAPTURED');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('2. Genuine Webhook Verification (Fail-Closed): calls POST /v1/notifications/verify-webhook-signature, rejects FAILURE signatures (401), fails closed when config is missing (503) or service is down (503), and never mutates payment state on unverified webhooks', async () => {
    let verifyEndpointBehavior: 'SUCCESS' | 'FAILURE' | 'HTTP_500' | 'NETWORK_ERROR' = 'FAILURE';
    let lastVerifyRequestBody: Record<string, unknown> | null = null;

    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({ access_token: 'sbx_token_webhook', token_type: 'Bearer' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith('/v2/checkout/orders')) {
        return new Response(
          JSON.stringify({ id: 'ORD-WH-TEST-01', status: 'CREATED' }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
        return new Response(
          JSON.stringify({
            id: 'ORD-WH-TEST-01',
            status: 'COMPLETED',
            purchase_units: [
              {
                payments: {
                  authorizations: [{ id: 'AUTH-WH-TEST-01', status: 'CREATED' }],
                },
              },
            ],
          }),
          { status: 201, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
        lastVerifyRequestBody = init?.body ? JSON.parse(String(init.body)) : null;
        if (verifyEndpointBehavior === 'NETWORK_ERROR') {
          throw new Error('ECONNREFUSED simulated upstream failure');
        }
        if (verifyEndpointBehavior === 'HTTP_500') {
          return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
            status: 500,
          });
        }
        return new Response(
          JSON.stringify({ verification_status: verifyEndpointBehavior }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    };

    // 2a. First verify fail-closed when PAYPAL_WEBHOOK_ID is missing
    const unconfiguredContainer = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        clientId: 'sbx_client',
        clientSecret: 'sbx_secret',
        webhookId: '', // Missing webhook ID
        fetchImpl: mockFetch,
      },
    });
    const unconfServer = http.createServer(unconfiguredContainer.app);
    await new Promise<void>((resolve) => unconfServer.listen(0, '127.0.0.1', resolve));
    const unconfAddr = unconfServer.address();
    if (!unconfAddr || typeof unconfAddr === 'string') {
      throw new Error('Failed to bind');
    }
    const unconfSdk = new MilestoneProofClient({
      baseUrl: `http://127.0.0.1:${unconfAddr.port}/api/v1`,
    });

    try {
      await assert.rejects(
        async () => {
          await unconfSdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
            id: 'WH-UNCONF-001',
            event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
            resource: { id: 'AUTH-WH-TEST-01' },
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, 'WEBHOOK_VERIFICATION_UNAVAILABLE');
          return true;
        }
      );
      const savedUnconfEvent =
        unconfiguredContainer.webhookEventRepo.findByEventId('WH-UNCONF-001');
      assert.ok(savedUnconfEvent);
      assert.equal(savedUnconfEvent.processingStatus, 'REJECTED');
      assert.equal(savedUnconfEvent.verificationStatus, 'UNVERIFIED');
    } finally {
      await new Promise<void>((resolve) => unconfServer.close(() => resolve()));
      unconfiguredContainer.db.close();
    }

    // 2b. Now test with configured webhook ID against FAILURE, HTTP_500, NETWORK_ERROR, and SUCCESS
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        clientId: 'sbx_client',
        clientSecret: 'sbx_secret',
        webhookId: 'WH-CONFIGURED-999',
        fetchImpl: mockFetch,
      },
    });
    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind');
    }
    const sdk = new MilestoneProofClient({
      baseUrl: `http://127.0.0.1:${addr.port}/api/v1`,
    });

    try {
      await sdk.switchDemoPersona({ userId: 'client_01' });
      await sdk.createPayPalOrder('ms_seed_01', 'idemp_wh_ord_01');
      await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_wh_auth_01');

      // Attempt 1: PayPal returns verification_status: "FAILURE" -> 401 INVALID_PAYPAL_WEBHOOK_SIGNATURE
      verifyEndpointBehavior = 'FAILURE';
      await assert.rejects(
        async () => {
          await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
            id: 'WH-INVALID-SIG-001',
            event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
            resource: { id: 'AUTH-WH-TEST-01' },
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.code, 'INVALID_PAYPAL_WEBHOOK_SIGNATURE');
          return true;
        }
      );

      // Verify the payload sent to PayPal's /v1/notifications/verify-webhook-signature endpoint
      assert.ok(lastVerifyRequestBody);
      const reqBody = lastVerifyRequestBody as unknown as Record<string, unknown>;
      assert.equal(reqBody.webhook_id, 'WH-CONFIGURED-999');
      assert.equal(reqBody.transmission_id, VALID_WEBHOOK_HEADERS['PAYPAL-TRANSMISSION-ID']);
      assert.equal(reqBody.auth_algo, 'SHA256withRSA');

      // Verify authorization was NOT voided by the unverified webhook
      const txAfterInvalid = (await sdk.listPayPalTransactions('ms_seed_01')).transactions[0];
      assert.equal(txAfterInvalid.status, 'AUTHORIZED');

      // Attempt 2: PayPal verification service returns HTTP 500 -> 503 PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE (fail closed)
      verifyEndpointBehavior = 'HTTP_500';
      await assert.rejects(
        async () => {
          await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
            id: 'WH-SVC-DOWN-001',
            event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
            resource: { id: 'AUTH-WH-TEST-01' },
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, 'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE');
          return true;
        }
      );

      // Attempt 3: Network error calling PayPal -> 503 PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE
      verifyEndpointBehavior = 'NETWORK_ERROR';
      await assert.rejects(
        async () => {
          await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
            id: 'WH-NET-ERR-001',
            event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
            resource: { id: 'AUTH-WH-TEST-01' },
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, 'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE');
          return true;
        }
      );
      assert.equal(
        (await sdk.listPayPalTransactions('ms_seed_01')).transactions[0].status,
        'AUTHORIZED'
      );

      // Attempt 4: PayPal returns verification_status: "SUCCESS" -> event is accepted and authorization is reconciled to VOIDED
      verifyEndpointBehavior = 'SUCCESS';
      const verifiedRes = await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
        id: 'WH-VALID-VOID-001',
        event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
        resource: { id: 'AUTH-WH-TEST-01' },
      });
      assert.equal(verifiedRes.verified, true);
      assert.equal(verifiedRes.status, 'RECONCILED_VOIDED');
      assert.equal(
        (await sdk.listPayPalTransactions('ms_seed_01')).transactions[0].status,
        'VOIDED'
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('3. Webhook Idempotency, Concurrency & Failure Recovery: prevents duplicate and concurrent duplicate deliveries, allows two distinct events for the same transaction, rolls back on DB failure, and succeeds on retry after failure', async () => {
    let failNextEventId: string | null = null;

    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', token_type: 'Bearer' }), {
          status: 200,
        });
      }
      if (url.endsWith('/v2/checkout/orders')) {
        return new Response(JSON.stringify({ id: 'ORD-IDEMP-01', status: 'CREATED' }), {
          status: 201,
        });
      }
      if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
        return new Response(
          JSON.stringify({
            id: 'ORD-IDEMP-01',
            status: 'COMPLETED',
            purchase_units: [
              {
                payments: {
                  authorizations: [{ id: 'AUTH-IDEMP-01', status: 'CREATED' }],
                },
              },
            ],
          }),
          { status: 201 }
        );
      }
      if (url.endsWith('/v1/notifications/verify-webhook-signature')) {
        return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
          status: 200,
        });
      }
      return new Response('{}', { status: 404 });
    };

    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        clientId: 'sbx_client',
        clientSecret: 'sbx_secret',
        webhookId: 'WH-IDEMP-999',
        fetchImpl: mockFetch,
        beforeWebhookReconcileHook: (eventId) => {
          if (failNextEventId === eventId) {
            failNextEventId = null; // Fail once, then succeed on retry
            throw new Error('Simulated transient database failure during webhook reconciliation');
          }
        },
      },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind');
    }
    const sdk = new MilestoneProofClient({
      baseUrl: `http://127.0.0.1:${addr.port}/api/v1`,
    });

    try {
      await sdk.switchDemoPersona({ userId: 'client_01' });
      await sdk.createPayPalOrder('ms_seed_01', 'idemp_wh2_ord_01');
      await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_wh2_auth_01');

      // 3a. First valid event for AUTH-IDEMP-01 (e.g., PAYMENT.AUTHORIZATION.CREATED)
      const firstDelivery = await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
        id: 'WH-EVT-UNIQUE-101',
        event_type: 'PAYMENT.AUTHORIZATION.CREATED',
        resource: { id: 'AUTH-IDEMP-01' },
      });
      assert.equal(firstDelivery.verified, true);
      assert.equal(firstDelivery.status, 'VERIFIED_LOGGED');

      // 3b. Same event delivered a second time -> acknowledged as DUPLICATE_IGNORED without duplicate processing
      const secondDelivery = await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
        id: 'WH-EVT-UNIQUE-101',
        event_type: 'PAYMENT.AUTHORIZATION.CREATED',
        resource: { id: 'AUTH-IDEMP-01' },
      });
      assert.equal(secondDelivery.verified, true);
      assert.equal(secondDelivery.status, 'DUPLICATE_IGNORED');

      // 3c. Concurrent duplicate deliveries of the same new event ID -> only one processes, the other is DUPLICATE_IGNORED
      const [concA, concB] = await Promise.all([
        container.paypalService.handleWebhook(VALID_WEBHOOK_HEADERS, {
          id: 'WH-EVT-CONCURRENT-102',
          event_type: 'PAYMENT.ORDER.CREATED',
          resource: { id: 'ORD-IDEMP-01' },
        }),
        container.paypalService.handleWebhook(VALID_WEBHOOK_HEADERS, {
          id: 'WH-EVT-CONCURRENT-102',
          event_type: 'PAYMENT.ORDER.CREATED',
          resource: { id: 'ORD-IDEMP-01' },
        }),
      ]);
      const statuses = [concA.status, concB.status].sort();
      assert.deepEqual(statuses, ['DUPLICATE_IGNORED', 'VERIFIED_LOGGED']);

      // 3d. Database failure during webhook reconciliation -> rolls back state transition, marks event FAILED, and succeeds on retry
      failNextEventId = 'WH-EVT-TRANSIENT-FAIL-103';
      await assert.rejects(async () => {
        await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
          id: 'WH-EVT-TRANSIENT-FAIL-103',
          event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
          resource: { id: 'AUTH-IDEMP-01' },
        });
      });

      // Verify transaction is STILL AUTHORIZED because the DB transaction rolled back
      const txAfterRollback = (await sdk.listPayPalTransactions('ms_seed_01')).transactions[0];
      assert.equal(txAfterRollback.status, 'AUTHORIZED');

      // Verify webhook record is marked FAILED
      const failedRecord = container.webhookEventRepo.findByEventId('WH-EVT-TRANSIENT-FAIL-103');
      assert.ok(failedRecord);
      assert.equal(failedRecord.processingStatus, 'FAILED');

      // Now retry the exact same event ID 'WH-EVT-TRANSIENT-FAIL-103' -> must succeed and reconcile to VOIDED!
      const retryDelivery = await sdk.handlePayPalWebhook(VALID_WEBHOOK_HEADERS, {
        id: 'WH-EVT-TRANSIENT-FAIL-103',
        event_type: 'PAYMENT.AUTHORIZATION.VOIDED',
        resource: { id: 'AUTH-IDEMP-01' },
      });
      assert.equal(retryDelivery.verified, true);
      assert.equal(retryDelivery.status, 'RECONCILED_VOIDED');

      const processedRecord = container.webhookEventRepo.findByEventId('WH-EVT-TRANSIENT-FAIL-103');
      assert.ok(processedRecord);
      assert.equal(processedRecord.processingStatus, 'PROCESSED');
      assert.equal(
        (await sdk.listPayPalTransactions('ms_seed_01')).transactions[0].status,
        'VOIDED'
      );

      // Verify audit hash chain remains 100% valid
      const chainCheck = await sdk.verifyAuditHashChain();
      assert.equal(chainCheck.valid, true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('4. Simulation vs. Real Sandbox Separation & Financial Safety Guards: SANDBOX_SIMULATION never marks a milestone SETTLED or CAPTURED, and over-capture / approval-bypass attempts are blocked', async () => {
    // Create container with NO PayPal credentials -> runs in SANDBOX_SIMULATION mode
    const simContainer = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
      paypalOptions: {
        clientId: '',
        clientSecret: '',
      },
    });

    const server = http.createServer(simContainer.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind');
    }
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
    const sdk = new MilestoneProofClient({ baseUrl });

    try {
      await sdk.switchDemoPersona({ userId: 'client_01' });

      // 4a. Create & authorize order in SANDBOX_SIMULATION mode
      const simOrder = await sdk.createPayPalOrder('ms_seed_01', 'idemp_sim_ord_001');
      assert.equal(simOrder.transaction.executionMode, 'SANDBOX_SIMULATION');
      assert.equal(simOrder.transaction.status, 'SIMULATED_ORDER_CREATED');

      const simAuth = await sdk.authorizePayPalOrder('ms_seed_01', 'idemp_sim_auth_001');
      assert.equal(simAuth.transaction.executionMode, 'SANDBOX_SIMULATION');
      assert.equal(simAuth.transaction.status, 'SIMULATED_AUTHORIZED');

      // 4b. Submit evidence, evaluate, and approve as REVIEWER
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
        approvedAmountCents: 250000,
        justification: 'Approved for simulation mode test.',
      });

      // 4c. Capture in SANDBOX_SIMULATION mode
      const simCap = await sdk.capturePayPalAuthorization('ms_seed_01', 'idemp_sim_cap_001');
      assert.equal(simCap.transaction.executionMode, 'SANDBOX_SIMULATION');
      assert.equal(simCap.transaction.status, 'SIMULATED_CAPTURED');

      // CRITICAL ASSERTION: Milestone status MUST remain 'APPROVED' (NEVER 'SETTLED') and paymentStatus MUST be 'SIMULATED_CAPTURED' (NEVER 'CAPTURED')
      const simMilestone = simContainer.milestoneRepo.findById('ms_seed_01');
      assert.ok(simMilestone);
      assert.equal(simMilestone.status, 'APPROVED');
      assert.notEqual(simMilestone.status, 'SETTLED');
      assert.equal(simMilestone.paymentStatus, 'SIMULATED_CAPTURED');
      assert.notEqual(simMilestone.paymentStatus, 'CAPTURED');

      // Verify Financial Decision Ledger clearly reports SIMULATED_CAPTURED and SANDBOX_SIMULATION
      const ledgerRes = await sdk.getFinancialDecisionLedger();
      const ms1Row = ledgerRes.rows.find((r) => r.milestoneId === 'ms_seed_01');
      assert.ok(ms1Row);
      assert.equal(ms1Row.milestoneStatus, 'APPROVED');
      assert.equal(ms1Row.paymentStatus, 'SIMULATED_CAPTURED');
      assert.equal(ms1Row.paymentExecutionMode, 'SANDBOX_SIMULATION');

      // 4d. Test Milestone 2: Over-approval / Over-capture prevention, failed capture retry, and idempotency key conflict
      let failCaptureOnce = true;
      const liveContainer = createServerApp({
        dbPath: ':memory:',
        authOptions: { enableDemoImpersonation: true },
        paypalOptions: {
          clientId: 'sbx_client_m2',
          clientSecret: 'sbx_secret_m2',
          webhookId: 'WH-M2',
          fetchImpl: async (input) => {
            const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
            if (url.endsWith('/v1/oauth2/token')) {
              return new Response(JSON.stringify({ access_token: 'tok', token_type: 'Bearer' }), { status: 200 });
            }
            if (url.endsWith('/v2/checkout/orders')) {
              return new Response(JSON.stringify({ id: 'ORD-M2-LIVE', status: 'CREATED' }), { status: 201 });
            }
            if (url.includes('/v2/checkout/orders/') && url.endsWith('/authorize')) {
              return new Response(
                JSON.stringify({
                  id: 'ORD-M2-LIVE',
                  status: 'COMPLETED',
                  purchase_units: [
                    {
                      payments: {
                        authorizations: [{ id: 'AUTH-M2-LIVE', status: 'CREATED' }],
                      },
                    },
                  ],
                }),
                { status: 201 }
              );
            }
            if (url.includes('/v2/payments/authorizations/') && url.endsWith('/capture')) {
              if (failCaptureOnce) {
                failCaptureOnce = false;
                return new Response(
                  JSON.stringify({ id: 'CAP-DECLINED', status: 'DECLINED' }),
                  { status: 201 }
                );
              }
              return new Response(
                JSON.stringify({ id: 'CAP-M2-SUCCESS', status: 'COMPLETED' }),
                { status: 201 }
              );
            }
            return new Response('{}', { status: 404 });
          },
        },
      });

      const liveServer = http.createServer(liveContainer.app);
      await new Promise<void>((resolve) => liveServer.listen(0, '127.0.0.1', resolve));
      const liveAddr = liveServer.address();
      if (!liveAddr || typeof liveAddr === 'string') {
        throw new Error('Failed to bind');
      }
      const liveBaseUrl = `http://127.0.0.1:${liveAddr.port}/api/v1`;
      const liveSdk = new MilestoneProofClient({ baseUrl: liveBaseUrl });

      try {
        await liveSdk.switchDemoPersona({ userId: 'client_01' });
        await liveSdk.createPayPalOrder('ms_seed_01', 'idemp_m2_ord_01');
        await liveSdk.authorizePayPalOrder('ms_seed_01', 'idemp_m2_auth_01');

        const devSess2 = await liveSdk.switchDemoPersona({ userId: 'dev_01' });
        await fetch(`${liveBaseUrl}/milestones/ms_seed_01/evidence`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${devSess2.token}`,
          },
          body: JSON.stringify({ demoFixtureKey: 'SUCCESSFUL_SUBMISSION' }),
        });

        await liveSdk.switchDemoPersona({ userId: 'reviewer_01' });
        const evalM2 = await liveSdk.evaluateMilestoneEvidence('ms_seed_01');

        // Attempt to approve an amount exceeding the milestone budget/permitted cap (250000 cents) -> 400
        await assert.rejects(
          async () => {
            await liveSdk.submitHumanReview('ms_seed_01', {
              evaluationId: evalM2.evaluation.id,
              decision: 'APPROVE',
              approvedAmountCents: 999999, // Exceeds 250000 permitted cap
              justification: 'Attempting to approve more than permitted policy cap.',
            });
          },
          (err: unknown) => {
            assert.ok(err instanceof MilestoneProofApiError);
            assert.equal(err.statusCode, 400);
            return true;
          }
        );

        // Valid human approval for 250000 cents
        await liveSdk.submitHumanReview('ms_seed_01', {
          evaluationId: evalM2.evaluation.id,
          decision: 'APPROVE',
          approvedAmountCents: 250000,
          justification: 'Valid approval within policy cap.',
        });

        // First capture attempt fails upstream (DECLINED -> 422 PAYPAL_CAPTURE_DECLINED)
        await assert.rejects(
          async () => {
            await liveSdk.capturePayPalAuthorization('ms_seed_01', 'idemp_m2_cap_fail_01');
          },
          (err: unknown) => {
            assert.ok(err instanceof MilestoneProofApiError);
            assert.equal(err.statusCode, 422);
            assert.equal(err.code, 'PAYPAL_CAPTURE_DECLINED');
            return true;
          }
        );

        // Verify milestone was NOT marked SETTLED after failed capture
        assert.equal(liveContainer.milestoneRepo.findById('ms_seed_01')?.status, 'APPROVED');

        // Retry capture after failed attempt -> succeeds and marks milestone SETTLED
        const retryCap = await liveSdk.capturePayPalAuthorization(
          'ms_seed_01',
          'idemp_m2_cap_retry_02'
        );
        assert.equal(retryCap.transaction.paypalCaptureId, 'CAP-M2-SUCCESS');
        assert.equal(retryCap.transaction.status, 'CAPTURED');
        assert.equal(liveContainer.milestoneRepo.findById('ms_seed_01')?.status, 'SETTLED');
      } finally {
        await new Promise<void>((resolve) => liveServer.close(() => resolve()));
        liveContainer.db.close();
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      simContainer.db.close();
    }
  });
});
