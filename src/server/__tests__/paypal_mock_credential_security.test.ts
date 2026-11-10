import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServerApp } from '../index.ts';

const mockWebhookHeaders = {
  'paypal-transmission-id': 'sec-tx-001',
  'paypal-transmission-time': new Date().toISOString(),
  'paypal-transmission-sig': 'sig_valid_dummy_signature',
  'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-360',
  'paypal-auth-algo': 'SHA256withRSA',
};

const sampleWebhookBody = JSON.stringify({
  id: 'WH-EVT-SEC-001',
  event_type: 'CHECKOUT.ORDER.APPROVED',
  resource: { id: 'ORD-SEC-001', status: 'APPROVED' },
});

describe('PayPal Mock Credential Security & Environment Isolation Suite', () => {
  const originalEnv = { ...process.env };

  function restoreEnv() {
    process.env = { ...originalEnv };
  }

  // Scenario 1: No real credentials, no explicit test mode -> Fail closed
  it('Scenario 1: No real credentials, no explicit test mode -> Fail closed with 503 WEBHOOK_VERIFICATION_UNAVAILABLE', async () => {
    try {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_ACCESS_TOKEN;
      process.env.PAYPAL_WEBHOOK_ID = 'WH-TEST-001';

      const container = createServerApp({
        dbPath: ':memory:',
        paypalOptions: {
          webhookId: 'WH-TEST-001',
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), false);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), false);

      await assert.rejects(
        async () => container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody),
        (err: any) => {
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, 'WEBHOOK_VERIFICATION_UNAVAILABLE');
          return true;
        }
      );

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 2: Custom fetch injected, no real credentials -> Fail closed
  it('Scenario 2: Custom fetch injected without explicit test authorization -> Fail closed and zero network egress', async () => {
    try {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_ACCESS_TOKEN;

      let fetchCallCount = 0;
      const isolatedFetch: typeof fetch = async () => {
        fetchCallCount++;
        throw new Error('NETWORK_EGRESS_BLOCKED: Should not be called when unconfigured');
      };

      const container = createServerApp({
        dbPath: ':memory:',
        paypalOptions: {
          fetchImpl: isolatedFetch,
          webhookId: 'WH-TEST-002',
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), false);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), false);

      await assert.rejects(
        async () => container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody),
        (err: any) => {
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, 'WEBHOOK_VERIFICATION_UNAVAILABLE');
          return true;
        }
      );

      // Verify that no network dispatch was attempted because the service failed closed immediately
      assert.equal(fetchCallCount, 0, 'Fetch was erroneously invoked without valid credentials');

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 3: Explicit test-only setup (allowSyntheticTestCredentials: true) in automated tests -> Succeeds with mock credentials
  it('Scenario 3: Explicit test-only setup (allowSyntheticTestCredentials: true) activates mock credentials in test mode', async () => {
    try {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_ACCESS_TOKEN;
      process.env.NODE_ENV = 'test';

      let capturedAuthHeader = '';
      let fetchCallCount = 0;

      const mockFetch: typeof fetch = async (url, init) => {
        fetchCallCount++;
        const urlStr = String(url);
        if (urlStr.includes('/v1/oauth2/token')) {
          capturedAuthHeader = String((init?.headers as any)?.Authorization || '');
          return new Response(JSON.stringify({ access_token: 'mock_test_token_xyz', token_type: 'Bearer', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/v1/notifications/verify-webhook-signature')) {
          return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ status: 'OK' }), { status: 200 });
      };

      const container = createServerApp({
        dbPath: ':memory:',
        paypalOptions: {
          fetchImpl: mockFetch,
          webhookId: 'WH-TEST-003',
          allowSyntheticTestCredentials: true,
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), true);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), true);

      const res = await container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody);
      assert.equal(res.verified, true);
      assert.equal(res.eventId, 'WH-EVT-SEC-001');

      // Verify synthetic credentials were used for OAuth basic auth
      const expectedBasic = Buffer.from('mock_client_id_for_test:mock_client_secret_for_test').toString('base64');
      assert.equal(capturedAuthHeader, `Basic ${expectedBasic}`);
      assert.ok(fetchCallCount >= 1);

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 4: Development environment (NODE_ENV=development) with custom fetch alone -> Fail closed
  it('Scenario 4: Development environment with custom fetch alone -> Fail closed with 503 WEBHOOK_VERIFICATION_UNAVAILABLE', async () => {
    try {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_ACCESS_TOKEN;
      process.env.NODE_ENV = 'development';

      let fetchCallCount = 0;
      const isolatedFetch: typeof fetch = async () => {
        fetchCallCount++;
        throw new Error('NETWORK_EGRESS_BLOCKED');
      };

      const container = createServerApp({
        dbPath: ':memory:',
        paypalOptions: {
          fetchImpl: isolatedFetch,
          webhookId: 'WH-DEV-001',
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), false);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), false);

      await assert.rejects(
        async () => container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody),
        (err: any) => err.statusCode === 503 && err.code === 'WEBHOOK_VERIFICATION_UNAVAILABLE'
      );
      assert.equal(fetchCallCount, 0);

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 5: Staging environment (NODE_ENV=staging) with custom fetch alone -> Fail closed
  it('Scenario 5: Staging environment with custom fetch alone -> Fail closed with 503 WEBHOOK_VERIFICATION_UNAVAILABLE', async () => {
    try {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_ACCESS_TOKEN;
      process.env.NODE_ENV = 'staging';

      let fetchCallCount = 0;
      const isolatedFetch: typeof fetch = async () => {
        fetchCallCount++;
        throw new Error('NETWORK_EGRESS_BLOCKED');
      };

      const container = createServerApp({
        dbPath: ':memory:',
        paypalOptions: {
          fetchImpl: isolatedFetch,
          webhookId: 'WH-STAGING-001',
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), false);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), false);

      await assert.rejects(
        async () => container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody),
        (err: any) => err.statusCode === 503 && err.code === 'WEBHOOK_VERIFICATION_UNAVAILABLE'
      );
      assert.equal(fetchCallCount, 0);

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 6: Production (NODE_ENV=production) with custom fetch -> Fail closed
  it('Scenario 6: Production with custom fetch alone -> Fail closed with 503 WEBHOOK_VERIFICATION_UNAVAILABLE', async () => {
    try {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_ACCESS_TOKEN;
      process.env.NODE_ENV = 'production';

      let fetchCallCount = 0;
      const isolatedFetch: typeof fetch = async () => {
        fetchCallCount++;
        throw new Error('NETWORK_EGRESS_BLOCKED');
      };

      const container = createServerApp({
        dbPath: ':memory:',
        authOptions: { secret: 'production_super_secret_key_at_least_32_chars_long' },
        paypalOptions: {
          fetchImpl: isolatedFetch,
          webhookId: 'WH-PROD-001',
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), false);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), false);

      await assert.rejects(
        async () => container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody),
        (err: any) => err.statusCode === 503 && err.code === 'WEBHOOK_VERIFICATION_UNAVAILABLE'
      );
      assert.equal(fetchCallCount, 0);

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 7: Production (NODE_ENV=production) with allowSyntheticTestCredentials: true attempted -> Strictly rejected / fails closed
  it('Scenario 7: Production with allowSyntheticTestCredentials attempted -> Strictly rejected and fails closed', async () => {
    try {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_ACCESS_TOKEN;
      process.env.NODE_ENV = 'production';

      let fetchCallCount = 0;
      const isolatedFetch: typeof fetch = async () => {
        fetchCallCount++;
        throw new Error('NETWORK_EGRESS_BLOCKED');
      };

      const container = createServerApp({
        dbPath: ':memory:',
        authOptions: { secret: 'production_super_secret_key_at_least_32_chars_long' },
        paypalOptions: {
          fetchImpl: isolatedFetch,
          webhookId: 'WH-PROD-ATTACK-001',
          allowSyntheticTestCredentials: true, // Malicious or mistaken attempt in production
        },
      });

      // Strict rejection: In production, synthetic credentials must NEVER be accepted
      assert.equal(container.paypalService.isLivePayPalConfigured(), false);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), false);

      await assert.rejects(
        async () => container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody),
        (err: any) => err.statusCode === 503 && err.code === 'WEBHOOK_VERIFICATION_UNAVAILABLE'
      );
      assert.equal(fetchCallCount, 0, 'No network requests may be dispatched with synthetic credentials in production');

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 8: Real Sandbox credentials configured -> Uses configured credentials
  it('Scenario 8: Real Sandbox credentials configured -> Correctly uses configured credentials without synthetic fallback', async () => {
    try {
      process.env.NODE_ENV = 'development';
      const realSbxClientId = 'sbx_real_client_id_abc123';
      const realSbxClientSecret = 'sbx_real_client_secret_xyz789';
      let capturedBasicAuth = '';

      const isolatedFetch: typeof fetch = async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes('/v1/oauth2/token')) {
          capturedBasicAuth = String((init?.headers as any)?.Authorization || '');
          return new Response(JSON.stringify({ access_token: 'sbx_token_live', token_type: 'Bearer', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/v1/notifications/verify-webhook-signature')) {
          return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ status: 'OK' }), { status: 200 });
      };

      const container = createServerApp({
        dbPath: ':memory:',
        paypalOptions: {
          fetchImpl: isolatedFetch,
          clientId: realSbxClientId,
          clientSecret: realSbxClientSecret,
          webhookId: 'WH-REAL-SBX-001',
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), true);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), true);

      const res = await container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody);
      assert.equal(res.verified, true);

      const expectedBasic = `Basic ${Buffer.from(`${realSbxClientId}:${realSbxClientSecret}`).toString('base64')}`;
      assert.equal(capturedBasicAuth, expectedBasic);

      container.db.close();
    } finally {
      restoreEnv();
    }
  });

  // Scenario 9: Real Live credentials configured -> Uses configured credentials
  it('Scenario 9: Real Live credentials configured -> Uses configured environment credentials and succeeds in production', async () => {
    try {
      process.env.NODE_ENV = 'production';
      process.env.PAYPAL_CLIENT_ID = 'prod_real_client_id_live_999';
      process.env.PAYPAL_CLIENT_SECRET = 'prod_real_client_secret_live_888';
      process.env.PAYPAL_WEBHOOK_ID = 'WH-REAL-PROD-001';

      let capturedBasicAuth = '';
      const isolatedFetch: typeof fetch = async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes('/v1/oauth2/token')) {
          capturedBasicAuth = String((init?.headers as any)?.Authorization || '');
          return new Response(JSON.stringify({ access_token: 'prod_token_live', token_type: 'Bearer', expires_in: 3600 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/v1/notifications/verify-webhook-signature')) {
          return new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ status: 'OK' }), { status: 200 });
      };

      const container = createServerApp({
        dbPath: ':memory:',
        authOptions: { secret: 'production_super_secret_key_at_least_32_chars_long' },
        paypalOptions: {
          fetchImpl: isolatedFetch,
          webhookId: 'WH-REAL-PROD-001',
        },
      });

      assert.equal(container.paypalService.isLivePayPalConfigured(), true);
      assert.equal(container.paypalService.isWebhookVerificationConfigured(), true);

      const res = await container.paypalService.handleWebhook(mockWebhookHeaders, sampleWebhookBody);
      assert.equal(res.verified, true);

      const expectedBasic = `Basic ${Buffer.from('prod_real_client_id_live_999:prod_real_client_secret_live_888').toString('base64')}`;
      assert.equal(capturedBasicAuth, expectedBasic);

      container.db.close();
    } finally {
      restoreEnv();
    }
  });
});
