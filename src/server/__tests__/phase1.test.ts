import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServerApp, type HttpApp } from '../index.ts';
import { AUDIT_GENESIS_HASH } from '../services/AuditService.ts';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from '../services/AuthService.ts';

interface ApiTestResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
}

async function sendRequest<T = Record<string, unknown>>(
  app: HttpApp,
  options: {
    method: 'GET' | 'POST';
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<ApiTestResponse<T>> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind ephemeral test port');
  }

  try {
    const reqHeaders: Record<string, string> = {
      ...(options.headers ?? {}),
    };
    let payloadStr: string | undefined;
    if (options.body !== undefined) {
      payloadStr = JSON.stringify(options.body);
      reqHeaders['content-type'] = 'application/json';
      reqHeaders['content-length'] = String(Buffer.byteLength(payloadStr));
    }

    const res = await fetch(`http://127.0.0.1:${address.port}${options.path}`, {
      method: options.method,
      headers: reqHeaders,
      body: payloadStr,
    });

    const json = (await res.json()) as T;
    return { status: res.status, body: json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const SAMPLE_VALID_CONTRACT_PAYLOAD = {
  title: 'Zero-Trust Webhook & Ledger Settlement Engine',
  description: 'Deliver authenticated webhook receiver and integer-cent reconciliation module.',
  totalBudgetCents: 400000,
  currency: 'USD',
  developerId: 'dev_01',
  reviewerId: 'reviewer_01',
  policyRules: {
    requirePassingCi: true,
    requireSecurityScan: true,
    maxAllowedCriticalVulns: 0,
    maxAllowedHighVulns: 0,
    allowPartialPayout: false,
    latePenaltyDailyBps: 150,
  },
  milestones: [
    {
      sequenceOrder: 1,
      title: 'Milestone 1: Webhook Signature Verifier',
      description: 'Implement HMAC and asymmetric signature verification.',
      agreedAmountCents: 150000,
      deadlineIso: '2026-12-01T23:59:59.000Z',
      dependencyMilestoneIds: [],
      acceptanceCriteria: [
        {
          id: 'AC-1',
          title: 'Signature Validation Endpoint',
          description: 'Reject invalid webhook signatures with HTTP 401.',
          requiredProofType: 'CODE_COMMIT',
        },
      ],
    },
    {
      sequenceOrder: 2,
      title: 'Milestone 2: Settlement Reconciliation Suite',
      description: 'Full unit and integration test suite with zero critical CVEs.',
      agreedAmountCents: 250000,
      deadlineIso: '2026-12-15T23:59:59.000Z',
      dependencyMilestoneIds: [],
      acceptanceCriteria: [
        {
          id: 'AC-1',
          title: 'CI Test Coverage >= 85%',
          description: 'All reconciliation tests passing in CI.',
          requiredProofType: 'CI_TESTS',
        },
      ],
    },
  ],
};

describe('Phase 1 — Backend Foundation, Auth/RBAC, SQLite ACID Persistence & Hash-Chained Audit', () => {
  const tempFilesToClean: string[] = [];

  after(() => {
    for (const file of tempFilesToClean) {
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          if (fs.existsSync(file + suffix)) {
            fs.unlinkSync(file + suffix);
          }
        } catch {
          // Ignore cleanup errors on locked temp files
        }
      }
    }
  });

  it('1. serves /api/v1/health with verified runtime capabilities', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const res = await sendRequest<{
        status: string;
        capabilities: Record<string, boolean>;
      }>(container.app, {
        method: 'GET',
        path: '/api/v1/health',
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.capabilities.sqlitePersistence, true);
      assert.equal(res.body.capabilities.hmacSessionAuth, true);
      assert.equal(res.body.capabilities.hashChainedAudit, true);

      // Verify Vite/SPA fallback middleware and /api/v1/* routing coexist cleanly
      container.app.useFallback((_req, rawRes) => {
        rawRes.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        rawRes.end(JSON.stringify({ fallbackServed: true, source: 'vite-middleware-mock' }));
      });

      const spaRes = await sendRequest<{ fallbackServed: boolean; source: string }>(
        container.app,
        {
          method: 'GET',
          path: '/dashboard',
        }
      );
      assert.equal(spaRes.status, 200);
      assert.equal(spaRes.body.fallbackServed, true);
      assert.equal(spaRes.body.source, 'vite-middleware-mock');
    } finally {
      container.db.close();
    }
  });

  it('2. authenticates via async scrypt login, resolves role from DB, and blocks client role selection', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: false },
    });

    try {
      // Valid Client login
      const loginRes = await sendRequest<{
        token: string;
        user: { id: string; role: string };
      }>(container.app, {
        method: 'POST',
        path: '/api/v1/auth/login',
        body: {
          email: 'elena.client@acmefintech.example',
          password: 'ClientPass!2026',
        },
      });

      assert.equal(loginRes.status, 200);
      assert.ok(loginRes.body.token);
      assert.equal(loginRes.body.user.id, 'client_01');
      assert.equal(loginRes.body.user.role, 'CLIENT');

      // Wrong password rejected
      const badPwdRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/auth/login',
        body: {
          email: 'elena.client@acmefintech.example',
          password: 'WrongPassword!',
        },
      });
      assert.equal(badPwdRes.status, 401);
      assert.equal(badPwdRes.body.error.code, 'INVALID_CREDENTIALS');

      // Client attempting to request REVIEWER role during Developer login is blocked
      const roleEscalationLogin = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/auth/login',
        body: {
          email: 'marcus.dev@cloudbuilders.example',
          password: 'DevPass!2026',
          role: 'REVIEWER',
        },
      });
      assert.equal(roleEscalationLogin.status, 400);
      assert.equal(roleEscalationLogin.body.error.code, 'ROLE_SELECTION_FORBIDDEN');
    } finally {
      container.db.close();
    }
  });

  it('3. blocks X-Actor-Id spoofing, tampered signatures, expired tokens, wrong iss/aud, and revoked tokens', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: {
        secret: 'test-secret-with-at-least-32-bytes-of-entropy-12345',
        enableDemoImpersonation: true,
      },
    });

    try {
      // 3a. Raw X-Actor-Id spoofing attempt without Bearer token
      const spoofRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'GET',
        path: '/api/v1/contracts',
        headers: { 'X-Actor-Id': 'reviewer_01' },
      });
      assert.equal(spoofRes.status, 401);
      assert.equal(spoofRes.body.error.code, 'AUTH_TOKEN_REQUIRED');

      // 3b. Issue valid Developer token, then tamper payload role to REVIEWER
      const devSwitch = await sendRequest<{ token: string }>(container.app, {
        method: 'POST',
        path: '/api/v1/auth/demo-switch',
        body: { userId: 'dev_01' },
      });
      assert.equal(devSwitch.status, 200);
      const [headerB64, payloadB64, sigB64] = devSwitch.body.token.split('.');
      const decodedPayload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString('utf8')
      ) as Record<string, unknown>;
      decodedPayload.role = 'REVIEWER';
      const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
      const tamperedToken = `${headerB64}.${tamperedPayloadB64}.${sigB64}`;

      const tamperedRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'GET',
        path: '/api/v1/auth/me',
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });
      assert.equal(tamperedRes.status, 401);
      assert.equal(tamperedRes.body.error.code, 'INVALID_TOKEN_SIGNATURE');

      // 3c. Expired token rejected
      const nowSec = Math.floor(Date.now() / 1000);
      const expiredToken = container.authService.signClaims({
        jti: 'expired-jti-001',
        sub: 'client_01',
        role: 'CLIENT',
        iss: TOKEN_ISSUER,
        aud: TOKEN_AUDIENCE,
        iat: nowSec - 7200,
        exp: nowSec - 3600,
      });
      const expiredRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'GET',
        path: '/api/v1/auth/me',
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.equal(expiredRes.status, 401);
      assert.equal(expiredRes.body.error.code, 'TOKEN_EXPIRED');

      // 3d. Wrong issuer / audience rejected
      const badIssuerToken = container.authService.signClaims({
        jti: 'bad-iss-jti-001',
        sub: 'client_01',
        role: 'CLIENT',
        iss: 'evil-issuer',
        aud: TOKEN_AUDIENCE,
        iat: nowSec,
        exp: nowSec + 3600,
      });
      const badIssuerRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'GET',
        path: '/api/v1/auth/me',
        headers: { Authorization: `Bearer ${badIssuerToken}` },
      });
      assert.equal(badIssuerRes.status, 401);
      assert.equal(badIssuerRes.body.error.code, 'INVALID_TOKEN_CLAIMS');

      // 3e. Logout revokes token jti immediately
      const meBeforeLogout = await sendRequest(container.app, {
        method: 'GET',
        path: '/api/v1/auth/me',
        headers: { Authorization: `Bearer ${devSwitch.body.token}` },
      });
      assert.equal(meBeforeLogout.status, 200);

      const logoutRes = await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/auth/logout',
        headers: { Authorization: `Bearer ${devSwitch.body.token}` },
      });
      assert.equal(logoutRes.status, 200);

      const meAfterLogout = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'GET',
        path: '/api/v1/auth/me',
        headers: { Authorization: `Bearer ${devSwitch.body.token}` },
      });
      assert.equal(meAfterLogout.status, 401);
      assert.equal(meAfterLogout.body.error.code, 'TOKEN_REVOKED');
    } finally {
      container.db.close();
    }
  });

  it('4. disables demo impersonation in production and enforces production AUTH_TOKEN_SECRET & local ephemeral restart behavior', async () => {
    // 4a. Production without AUTH_TOKEN_SECRET must fail fast
    assert.throws(
      () => {
        createServerApp({
          dbPath: ':memory:',
          authOptions: {
            nodeEnv: 'production',
            secret: '',
          },
        });
      },
      (err: unknown) => (err as { code?: string }).code === 'FATAL_INSECURE_AUTH_SECRET'
    );

    // 4b. Production with valid secret blocks /api/v1/auth/demo-switch even if enableDemoImpersonation=true
    const prodContainer = createServerApp({
      dbPath: ':memory:',
      authOptions: {
        nodeEnv: 'production',
        secret: 'production-grade-secret-key-with-over-32-characters-entropy',
        enableDemoImpersonation: true,
      },
    });

    try {
      const demoRes = await sendRequest<{ error: { code: string } }>(prodContainer.app, {
        method: 'POST',
        path: '/api/v1/auth/demo-switch',
        body: { userId: 'client_01' },
      });
      assert.equal(demoRes.status, 403);
      assert.equal(demoRes.body.error.code, 'DEMO_MODE_DISABLED');
    } finally {
      prodContainer.db.close();
    }

    // 4c. Local ephemeral secret invalidates old tokens across server restart on the same SQLite DB
    const tempDbFile = path.join(os.tmpdir(), `mpai_ephemeral_${Date.now()}.sqlite`);
    tempFilesToClean.push(tempDbFile);

    const boot1 = createServerApp({
      dbPath: tempDbFile,
      authOptions: { nodeEnv: 'development', secret: undefined, enableDemoImpersonation: true },
    });
    const tokenBoot1 = boot1.authService.demoSwitch({ userId: 'client_01' }).token;
    boot1.db.close();

    const boot2 = createServerApp({
      dbPath: tempDbFile,
      authOptions: { nodeEnv: 'development', secret: undefined, enableDemoImpersonation: true },
    });
    try {
      assert.throws(
        () => boot2.authService.verifyTokenAndResolveActor(tokenBoot1),
        (err: unknown) => (err as { code?: string }).code === 'INVALID_TOKEN_SIGNATURE'
      );
    } finally {
      boot2.db.close();
    }
  });

  it('5. enforces RBAC, budget allocation math, separation of duties, and contract activation immutability', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const clientToken = container.authService.demoSwitch({ userId: 'client_01' }).token;
      const devToken = container.authService.demoSwitch({ userId: 'dev_01' }).token;
      const reviewerToken = container.authService.demoSwitch({ userId: 'reviewer_01' }).token;

      // 5a. Developer blocked from creating a contract
      const devCreateRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/contracts',
        headers: { Authorization: `Bearer ${devToken}` },
        body: SAMPLE_VALID_CONTRACT_PAYLOAD,
      });
      assert.equal(devCreateRes.status, 403);
      assert.equal(devCreateRes.body.error.code, 'FORBIDDEN_ROLE');

      // 5b. Reviewer blocked from creating a contract
      const revCreateRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/contracts',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: SAMPLE_VALID_CONTRACT_PAYLOAD,
      });
      assert.equal(revCreateRes.status, 403);
      assert.equal(revCreateRes.body.error.code, 'FORBIDDEN_ROLE');

      // 5c. Budget mismatch rejected
      const mismatchRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/contracts',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: {
          ...SAMPLE_VALID_CONTRACT_PAYLOAD,
          totalBudgetCents: 999999,
        },
      });
      assert.equal(mismatchRes.status, 400);
      assert.equal(mismatchRes.body.error.code, 'BUDGET_MISMATCH');

      // 5d. Separation of duties violation (Developer == Reviewer) rejected
      const selfReviewRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/contracts',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: {
          ...SAMPLE_VALID_CONTRACT_PAYLOAD,
          developerId: 'dev_01',
          reviewerId: 'dev_01',
        },
      });
      assert.equal(selfReviewRes.status, 400);
      assert.equal(selfReviewRes.body.error.code, 'SEPARATION_OF_DUTIES_VIOLATION');

      // 5e. Valid contract creation by Client succeeds
      const createRes = await sendRequest<{
        contract: { id: string; status: string; version: number; milestones: unknown[] };
      }>(container.app, {
        method: 'POST',
        path: '/api/v1/contracts',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: SAMPLE_VALID_CONTRACT_PAYLOAD,
      });
      assert.equal(createRes.status, 201);
      assert.equal(createRes.body.contract.status, 'DRAFT');
      assert.equal(createRes.body.contract.version, 1);
      assert.equal(createRes.body.contract.milestones.length, 2);

      const contractId = createRes.body.contract.id;

      // 5f. Developer cannot activate contract
      const devActivate = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: `/api/v1/contracts/${contractId}/activate`,
        headers: { Authorization: `Bearer ${devToken}` },
      });
      assert.equal(devActivate.status, 403);
      assert.equal(devActivate.body.error.code, 'FORBIDDEN_ROLE');

      // 5g. Client activates contract -> transitions DRAFT -> ACTIVE and increments version
      const activateRes = await sendRequest<{
        contract: { id: string; status: string; version: number; milestones: { status: string }[] };
      }>(container.app, {
        method: 'POST',
        path: `/api/v1/contracts/${contractId}/activate`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      assert.equal(activateRes.status, 200);
      assert.equal(activateRes.body.contract.status, 'ACTIVE');
      assert.equal(activateRes.body.contract.version, 2);
      assert.ok(activateRes.body.contract.milestones.every((m) => m.status === 'ACTIVE'));

      // 5h. Second activation call is rejected with 409 CONTRACT_ALREADY_ACTIVE
      const secondActivate = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: `/api/v1/contracts/${contractId}/activate`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      assert.equal(secondActivate.status, 409);
      assert.equal(secondActivate.body.error.code, 'CONTRACT_ALREADY_ACTIVE');
    } finally {
      container.db.close();
    }
  });

  it('6. enforces SQLite WAL + synchronous=FULL, atomic transaction rollback, and restart durability', () => {
    const tempDbFile = path.join(os.tmpdir(), `mpai_durability_${Date.now()}.sqlite`);
    tempFilesToClean.push(tempDbFile);

    const container = createServerApp({
      dbPath: tempDbFile,
      authOptions: {
        secret: 'persistent-secret-key-for-restart-durability-test-01234',
        enableDemoImpersonation: true,
      },
    });

    // Verify PRAGMAs on disk-backed SQLite database
    const journalMode = container.db.raw.prepare('PRAGMA journal_mode').get() as {
      journal_mode: string;
    };
    const syncMode = container.db.raw.prepare('PRAGMA synchronous').get() as {
      synchronous: number;
    };
    const fkMode = container.db.raw.prepare('PRAGMA foreign_keys').get() as {
      foreign_keys: number;
    };

    assert.equal(journalMode.journal_mode.toLowerCase(), 'wal');
    assert.equal(Number(syncMode.synchronous), 2); // 2 = FULL in SQLite
    assert.equal(Number(fkMode.foreign_keys), 1);

    const contractsBefore = container.contractService.listContracts().length;
    const auditsBefore = container.auditService.listLogs().length;

    // Simulate a transaction failure midway after inserting a contract and audit entry
    assert.throws(() => {
      container.db.withTransaction(() => {
        container.contractRepo.insert({
          id: 'contract_rollback_test',
          title: 'Should Roll Back',
          description: 'Rollback test',
          totalBudgetCents: 10000,
          currency: 'USD',
          clientId: 'client_01',
          developerId: 'dev_01',
          reviewerId: 'reviewer_01',
          policyRules: SAMPLE_VALID_CONTRACT_PAYLOAD.policyRules,
          status: 'DRAFT',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        container.auditService.appendWithinTx({
          actorId: 'client_01',
          actorRole: 'CLIENT',
          action: 'ROLLBACK_TEST_ACTION',
          entityType: 'CONTRACT',
          entityId: 'contract_rollback_test',
        });

        throw new Error('SIMULATED_MID_TRANSACTION_FAILURE');
      });
    }, /SIMULATED_MID_TRANSACTION_FAILURE/);

    // Confirm 0 orphaned rows in contracts or audit_logs
    assert.equal(container.contractService.listContracts().length, contractsBefore);
    assert.equal(container.auditService.listLogs().length, auditsBefore);
    assert.equal(container.contractRepo.findById('contract_rollback_test'), null);

    // Create a valid contract and close the database connection
    const clientUser = container.userRepo.findById('client_01')!;
    const created = container.contractService.createContract(
      clientUser,
      SAMPLE_VALID_CONTRACT_PAYLOAD
    );

    // Execute burst of 5 concurrent/serialized contract writes and verify contiguous sequence numbers
    for (let i = 0; i < 5; i++) {
      container.contractService.createContract(clientUser, {
        ...SAMPLE_VALID_CONTRACT_PAYLOAD,
        title: `Concurrent Serialization Test Contract #${i + 1}`,
      });
    }
    assert.equal(container.auditService.verifyChain().valid, true);

    container.db.close();

    // Reopen a brand new server container on the same SQLite file and verify persistence
    const reopened = createServerApp({
      dbPath: tempDbFile,
      authOptions: {
        secret: 'persistent-secret-key-for-restart-durability-test-01234',
        enableDemoImpersonation: true,
      },
    });
    try {
      const persistedContract = reopened.contractService.getContractById(created.id);
      assert.equal(persistedContract.title, SAMPLE_VALID_CONTRACT_PAYLOAD.title);
      assert.equal(persistedContract.milestones?.length, 2);

      const chainCheck = reopened.auditService.verifyChain();
      assert.equal(chainCheck.valid, true);
    } finally {
      reopened.db.close();
    }
  });

  it('7. verifies intact audit hash chain and detects altered, deleted, reordered, and missing genesis entries', () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const clientUser = container.userRepo.findById('client_01')!;
      const c1 = container.contractService.createContract(
        clientUser,
        SAMPLE_VALID_CONTRACT_PAYLOAD
      );
      container.contractService.activateContract(clientUser, c1.id);

      // 7a. Intact chain passes verification
      const intact = container.auditService.verifyChain();
      assert.equal(intact.valid, true);
      assert.equal(intact.genesisHash, AUDIT_GENESIS_HASH);
      assert.ok(intact.verifiedCount >= 3);

      // 7b. Database-level append-only triggers block normal UPDATE and DELETE on audit_logs
      assert.throws(
        () => {
          container.db.raw
            .prepare('UPDATE audit_logs SET payload_json = ? WHERE seq = 2')
            .run('{"tampered":true}');
        },
        /AUDIT_LOG_IMMUTABLE: UPDATE operations on audit_logs are prohibited/
      );

      assert.throws(
        () => {
          container.db.raw.prepare('DELETE FROM audit_logs WHERE seq = 2').run();
        },
        /AUDIT_LOG_IMMUTABLE: DELETE operations on audit_logs are prohibited/
      );

      // Confirm legitimate appends and chain verification still work with triggers active
      const postTriggerCheck = container.auditService.verifyChain();
      assert.equal(postTriggerCheck.valid, true);

      // Simulate privileged attacker who drops triggers to tamper directly with underlying rows,
      // and verify that AuditService.verifyChain() detects every form of tampering:
      container.db.raw.exec('DROP TRIGGER trg_audit_logs_immutable_update;');
      container.db.raw.exec('DROP TRIGGER trg_audit_logs_immutable_delete;');

      // 7c. Altered payload detection
      const originalRow2 = container.db.raw
        .prepare('SELECT payload_json FROM audit_logs WHERE seq = 2')
        .get() as { payload_json: string };

      container.db.raw
        .prepare('UPDATE audit_logs SET payload_json = ? WHERE seq = 2')
        .run('{"tampered":true}');

      const alteredCheck = container.auditService.verifyChain();
      assert.equal(alteredCheck.valid, false);
      assert.equal(alteredCheck.reason, 'ENTRY_HASH_MISMATCH');
      assert.equal(alteredCheck.failedSeq, 2);

      // Restore row 2 payload
      container.db.raw
        .prepare('UPDATE audit_logs SET payload_json = ? WHERE seq = 2')
        .run(originalRow2.payload_json);
      assert.equal(container.auditService.verifyChain().valid, true);

      // 7c. Reordered / broken previous_hash link detection
      const originalPrevHash3 = container.db.raw
        .prepare('SELECT previous_hash FROM audit_logs WHERE seq = 3')
        .get() as { previous_hash: string };

      container.db.raw
        .prepare('UPDATE audit_logs SET previous_hash = ? WHERE seq = 3')
        .run('0'.repeat(64));

      const reorderedCheck = container.auditService.verifyChain();
      assert.equal(reorderedCheck.valid, false);
      assert.equal(reorderedCheck.reason, 'BROKEN_PREVIOUS_HASH_LINK');
      assert.equal(reorderedCheck.failedSeq, 3);

      // Restore row 3 previous_hash
      container.db.raw
        .prepare('UPDATE audit_logs SET previous_hash = ? WHERE seq = 3')
        .run(originalPrevHash3.previous_hash);
      assert.equal(container.auditService.verifyChain().valid, true);

      // 7d. Deleted middle row (sequence gap) detection
      container.db.raw.prepare('DELETE FROM audit_logs WHERE seq = 2').run();
      const gapCheck = container.auditService.verifyChain();
      assert.equal(gapCheck.valid, false);
      assert.equal(gapCheck.reason, 'SEQUENCE_GAP_DETECTED');
      assert.equal(gapCheck.failedSeq, 3);

      // 7e. Missing genesis row (seq = 1 deleted) detection
      container.db.raw.prepare('DELETE FROM audit_logs WHERE seq = 1').run();
      const missingGenesisCheck = container.auditService.verifyChain();
      assert.equal(missingGenesisCheck.valid, false);
      assert.equal(missingGenesisCheck.reason, 'MISSING_GENESIS_ENTRY');
    } finally {
      container.db.close();
    }
  });
});
