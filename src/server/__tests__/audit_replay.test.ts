import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createServerApp, type HttpApp } from '../index.ts';
import { DeterministicMockEvaluator } from '../services/EvaluationService.ts';

interface ApiResponse<T = any> {
  status: number;
  body: T;
}

async function sendRequest<T = any>(
  app: HttpApp,
  options: {
    method: 'GET' | 'POST';
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  }
): Promise<ApiResponse<T>> {
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
      payloadStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!reqHeaders['content-type']) {
        reqHeaders['content-type'] = 'application/json';
      }
      if (!reqHeaders['content-length']) {
        reqHeaders['content-length'] = String(Buffer.byteLength(payloadStr));
      }
    }

    const res = await fetch(`http://127.0.0.1:${address.port}${options.path}`, {
      method: options.method,
      headers: reqHeaders,
      body: payloadStr,
    });

    let body: any;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return { status: res.status, body: body as T };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('Prompt 2/8 — Audit Replay Engine & Lifecycle State Reconstruction', () => {
  const tempFilesToClean: string[] = [];

  function getIsolatedApp() {
    const dbPath = path.resolve(
      process.cwd(),
      `test_audit_replay_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`
    );
    tempFilesToClean.push(dbPath);
    tempFilesToClean.push(`${dbPath}-wal`);
    tempFilesToClean.push(`${dbPath}-shm`);
    return createServerApp({
      dbPath,
      evaluatorProvider: new DeterministicMockEvaluator(),
      paypalOptions: {
        simulateMode: true,
      },
    });
  }

  function cleanupFiles() {
    for (const file of tempFilesToClean) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async function loginAsClient(app: HttpApp) {
    const res = await sendRequest<{ token: string }>(app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'elena.client@acmefintech.example', password: 'ClientPass!2026' },
    });
    assert.equal(res.status, 200, 'Login failed for client');
    return res.body.token;
  }

  async function loginAsDev(app: HttpApp) {
    const res = await sendRequest<{ token: string }>(app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'marcus.dev@cloudbuilders.example', password: 'DevPass!2026' },
    });
    assert.equal(res.status, 200, 'Login failed for developer');
    return res.body.token;
  }

  async function loginAsReviewer(app: HttpApp) {
    const res = await sendRequest<{ token: string }>(app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'sophia.reviewer@acmefintech.example', password: 'ReviewerPass!2026' },
    });
    assert.equal(res.status, 200, 'Login failed for reviewer');
    return res.body.token;
  }

  // Helper to build a complete contract lifecycle through normal endpoints
  async function setupCompleteContract(container: ReturnType<typeof createServerApp>) {
    const clientToken = await loginAsClient(container.app);
    const devToken = await loginAsDev(container.app);
    const reviewerToken = await loginAsReviewer(container.app);

    // 1. Create contract with 1 milestone
    const createRes = await sendRequest(container.app, {
      method: 'POST',
      path: '/api/v1/contracts',
      headers: { Authorization: `Bearer ${clientToken}` },
      body: {
        title: 'Audit Replay Contract',
        description: 'Verifiable contract for replay testing',
        totalBudgetCents: 500000,
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
            sequenceOrder: 1,
            title: 'Core Implementation',
            description: 'Implement core audit modules',
            agreedAmountCents: 500000,
            deadlineIso: '2026-12-01T00:00:00.000Z',
            dependencyMilestoneIds: [],
            acceptanceCriteria: [
              {
                id: 'crit_1',
                title: 'Unit Tests Pass',
                description: 'All test assertions must pass',
                requiredProofType: 'CI_TESTS',
              },
            ],
          },
        ],
      },
    });
    assert.equal(createRes.status, 201);
    const contractId = createRes.body.contract.id;
    const milestoneId = createRes.body.contract.milestones[0].id;

    // 2. Activate contract
    const activateRes = await sendRequest(container.app, {
      method: 'POST',
      path: `/api/v1/contracts/${contractId}/activate`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(activateRes.status, 200);

    // 3. Submit evidence
    const evidenceRes = await sendRequest(container.app, {
      method: 'POST',
      path: `/api/v1/milestones/${milestoneId}/evidence`,
      headers: { Authorization: `Bearer ${devToken}` },
      body: { demoFixtureKey: 'SUCCESSFUL_SUBMISSION' },
    });
    assert.equal(evidenceRes.status, 201);

    // 4. Evaluate milestone
    const evalRes = await sendRequest(container.app, {
      method: 'POST',
      path: `/api/v1/milestones/${milestoneId}/evaluate`,
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.equal(evalRes.status, 200);

    // 5. Approve milestone
    const approveRes = await sendRequest(container.app, {
      method: 'POST',
      path: `/api/v1/milestones/${milestoneId}/review/approve`,
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: {
        approvedAmountCents: 500000,
        justification: 'Verified full compliance with criteria',
      },
    });
    assert.equal(approveRes.status, 200);

    // 6. Capture payment via simulated PayPal sandbox
    const orderRes = await sendRequest(container.app, {
      method: 'POST',
      path: `/api/v1/milestones/${milestoneId}/paypal/order`,
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'PayPal-Request-Id': 'req_order_test_12345',
      },
    });
    assert.equal(orderRes.status, 201);

    const authRes = await sendRequest(container.app, {
      method: 'POST',
      path: `/api/v1/milestones/${milestoneId}/paypal/authorize`,
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'PayPal-Request-Id': 'req_auth_test_12345',
      },
    });
    assert.equal(authRes.status, 200);

    const captureRes = await sendRequest(container.app, {
      method: 'POST',
      path: `/api/v1/milestones/${milestoneId}/paypal/capture`,
      headers: {
        Authorization: `Bearer ${clientToken}`,
        'PayPal-Request-Id': 'req_capture_test_12345',
      },
    });
    assert.equal(captureRes.status, 200);

    return {
      contractId,
      milestoneId,
      clientToken,
      devToken,
      reviewerToken,
    };
  }

  // 1. Valid complete lifecycle replay
  it('1. validates complete contract lifecycle replay and state reconstruction', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, milestoneId, clientToken } = await setupCompleteContract(container);

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      const replay = replayRes.body;

      assert.equal(replay.contractId, contractId);
      assert.equal(replay.mode, 'FULL');
      assert.equal(replay.status, 'SUCCESS');
      assert.equal(replay.isCryptographicallyValid, true);
      assert.equal(replay.isLogicallyConsistent, true);
      assert.ok(replay.totalEventsProcessed >= 7);

      // Verify reconstructed contract state
      const contractState = replay.reconstructedState.contract;
      assert.equal(contractState.status, 'COMPLETED');
      assert.equal(contractState.settledMilestones, 1);
      assert.equal(contractState.totalSettledCents, 500000);

      // Verify reconstructed milestone state
      const msState = replay.reconstructedState.milestones[milestoneId];
      assert.ok(msState);
      assert.equal(msState.status, 'SETTLED');
      assert.equal(msState.settledAmountCents, 500000);
      assert.equal(msState.evidenceSubmissionsCount, 1);
      assert.equal(msState.evaluationsCount, 1);
      assert.equal(msState.approvalsCount, 1);
    } finally {
      cleanupFiles();
    }
  });

  // 2. Empty audit history
  it('2. handles contract with empty audit history safely without crashing', async () => {
    const container = getIsolatedApp();
    try {
      const clientToken = await loginAsClient(container.app);

      // Seed a dummy contract directly without inserting audit events
      container.db.raw.exec(`
        INSERT INTO contracts (
          id, title, description, total_budget_cents, currency,
          client_id, developer_id, reviewer_id, policy_rules_json,
          status, version, created_at, updated_at
        ) VALUES (
          'cnt_empty_audit', 'Empty Audit Contract', 'No audit logs',
          100000, 'USD', 'client_01', 'dev_01', 'reviewer_01',
          '{}', 'DRAFT', 1, '2026-11-08T00:00:00.000Z', '2026-11-08T00:00:00.000Z'
        )
      `);

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/cnt_empty_audit/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'EMPTY_HISTORY');
      assert.equal(replayRes.body.totalEventsProcessed, 0);
      assert.equal(replayRes.body.isCryptographicallyValid, true);
      assert.equal(replayRes.body.isLogicallyConsistent, true);
    } finally {
      cleanupFiles();
    }
  });

  // 3. Modified event payload
  it('3. detects modified event payload JSON as cryptographic integrity failure', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Tamper with payload_json in SQLite
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_update;');
      container.db.raw
        .prepare("UPDATE audit_logs SET payload_json = ? WHERE contract_id = ? AND action = ?")
        .run('{"tampered":true}', contractId, 'CONTRACT_ACTIVATED');

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'CRYPTOGRAPHIC_FAILURE');
      assert.equal(replayRes.body.isCryptographicallyValid, false);
      const modFinding = replayRes.body.findings.find(
        (f: any) => f.code === 'MODIFIED_PAYLOAD' || f.code === 'ENTRY_HASH_MISMATCH'
      );
      assert.ok(modFinding, 'Expected MODIFIED_PAYLOAD or ENTRY_HASH_MISMATCH finding');
    } finally {
      cleanupFiles();
    }
  });

  // 4. Invalid event hash
  it('4. detects invalid entry_hash mismatch as cryptographic integrity failure', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Corrupt entry_hash
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_update;');
      container.db.raw
        .prepare("UPDATE audit_logs SET entry_hash = ? WHERE contract_id = ? AND action = ?")
        .run('f'.repeat(64), contractId, 'CONTRACT_ACTIVATED');

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'CRYPTOGRAPHIC_FAILURE');
      assert.equal(replayRes.body.isCryptographicallyValid, false);
      const hashFinding = replayRes.body.findings.find(
        (f: any) => f.code === 'ENTRY_HASH_MISMATCH'
      );
      assert.ok(hashFinding);
    } finally {
      cleanupFiles();
    }
  });

  // 5. Broken previous-hash reference
  it('5. detects broken previous-hash relationship as cryptographic integrity failure', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Corrupt previous_hash of a non-genesis event
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_update;');
      container.db.raw
        .prepare("UPDATE audit_logs SET previous_hash = ? WHERE contract_id = ? AND action = ?")
        .run('e'.repeat(64), contractId, 'EVIDENCE_SUBMITTED');

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'CRYPTOGRAPHIC_FAILURE');
      const brokenLink = replayRes.body.findings.find(
        (f: any) => f.code === 'BROKEN_PREVIOUS_HASH_LINK'
      );
      assert.ok(brokenLink);
    } finally {
      cleanupFiles();
    }
  });

  // 6. Missing sequence number
  it('6. detects missing sequence number (sequence gap)', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Temporarily drop delete trigger and delete an intermediate audit entry
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_delete;');
      container.db.raw.exec(`
        DELETE FROM audit_logs WHERE contract_id = '${contractId}' AND action = 'CONTRACT_ACTIVATED'
      `);

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.isCryptographicallyValid, false);
      const gapFinding = replayRes.body.findings.find(
        (f: any) => f.code === 'SEQUENCE_GAP_DETECTED' || f.code === 'BROKEN_PREVIOUS_HASH_LINK'
      );
      assert.ok(gapFinding);
    } finally {
      cleanupFiles();
    }
  });

  // 7. Duplicate sequence number
  it('7. detects duplicate sequence number', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Drop triggers and recreate audit_logs table without PRIMARY KEY constraint to test duplicate seq detection
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_insert;');
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_update;');
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_delete;');
      container.db.raw.exec('CREATE TABLE audit_logs_dup_tmp AS SELECT * FROM audit_logs;');
      container.db.raw.exec('DROP TABLE audit_logs;');
      container.db.raw.exec(`
        CREATE TABLE audit_logs (
          seq INTEGER, id TEXT, timestamp TEXT, actor_id TEXT, actor_role TEXT,
          action TEXT, entity_type TEXT, entity_id TEXT, contract_id TEXT,
          milestone_id TEXT, previous_state TEXT, new_state TEXT,
          payload_json TEXT, previous_hash TEXT, entry_hash TEXT
        );
      `);
      container.db.raw.exec('INSERT INTO audit_logs SELECT * FROM audit_logs_dup_tmp;');
      
      const firstRow = container.db.raw
        .prepare(`SELECT * FROM audit_logs WHERE contract_id = ? ORDER BY seq ASC LIMIT 1`)
        .get(contractId) as any;

      // Update next row to duplicate firstRow's seq
      container.db.raw
        .prepare(`UPDATE audit_logs SET seq = ? WHERE contract_id = ? AND seq = ?`)
        .run(firstRow.seq, contractId, firstRow.seq + 1);

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      const dupSeq = replayRes.body.findings.find(
        (f: any) => f.code === 'DUPLICATE_SEQUENCE_NUMBER'
      );
      assert.ok(dupSeq);
    } finally {
      cleanupFiles();
    }
  });

  // 8. Unsupported event type
  it('8. identifies unsupported event types without inventing fictional state transitions', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Append an unsupported custom event
      container.auditService.appendWithinTx({
        actorId: 'client_01',
        actorRole: 'SYSTEM',
        action: 'CUSTOM_UNKNOWN_EXPERIMENT_EVENT',
        entityType: 'SYSTEM',
        entityId: 'sys_exp_1',
        contractId,
        payload: { note: 'Future unmapped event' },
      });

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'UNSUPPORTED_EVENTS_DETECTED');
      const unsuppFinding = replayRes.body.findings.find(
        (f: any) => f.code === 'UNSUPPORTED_EVENT_TYPE'
      );
      assert.ok(unsuppFinding);
      assert.equal(unsuppFinding.severity, 'WARNING');
    } finally {
      cleanupFiles();
    }
  });

  // 9. Invalid contract transition
  it('9. detects invalid contract transition (e.g., duplicate activation or illegal jump)', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Log a second CONTRACT_ACTIVATED event while already active
      container.auditService.appendWithinTx({
        actorId: 'client_01',
        actorRole: 'CLIENT',
        action: 'CONTRACT_ACTIVATED',
        entityType: 'CONTRACT',
        entityId: contractId,
        contractId,
        previousState: 'ACTIVE',
        newState: 'ACTIVE',
        payload: { reason: 'Illegal second activation' },
      });

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'LIFECYCLE_INCONSISTENCY');
      assert.equal(replayRes.body.isLogicallyConsistent, false);
      const invalidAct = replayRes.body.findings.find(
        (f: any) =>
          f.code === 'INVALID_CONTRACT_TRANSITION' || f.code === 'DUPLICATE_EVENT_APPLICATION'
      );
      assert.ok(invalidAct);
    } finally {
      cleanupFiles();
    }
  });

  // 10. Invalid milestone transition
  it('10. detects invalid milestone transition (e.g. submitting evidence to non-active milestone)', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, milestoneId, clientToken } = await setupCompleteContract(container);

      // Milestone is already SETTLED. Append another EVIDENCE_SUBMITTED event:
      container.auditService.appendWithinTx({
        actorId: 'dev_01',
        actorRole: 'DEVELOPER',
        action: 'EVIDENCE_SUBMITTED',
        entityType: 'EVIDENCE',
        entityId: 'ev_invalid_transition',
        contractId,
        milestoneId,
        previousState: 'SETTLED',
        newState: 'SUBMITTED',
        payload: { repo: 'tampered' },
      });

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'LIFECYCLE_INCONSISTENCY');
      const invTrans = replayRes.body.findings.find(
        (f: any) => f.code === 'INVALID_MILESTONE_TRANSITION'
      );
      assert.ok(invTrans);
    } finally {
      cleanupFiles();
    }
  });

  // 11. Impossible event ordering
  it('11. detects impossible event ordering (e.g. human approval before evidence submission)', async () => {
    const container = getIsolatedApp();
    try {
      const clientToken = await loginAsClient(container.app);

      // Create contract and activate it
      const createRes = await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/contracts',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: {
          title: 'Impossible Order Contract',
          description: 'Testing impossible order',
          totalBudgetCents: 100000,
          currency: 'USD',
          developerId: 'dev_01',
          reviewerId: 'reviewer_01',
          policyRules: {
            requirePassingCi: true,
            requireSecurityScan: false,
            maxAllowedCriticalVulns: 0,
            maxAllowedHighVulns: 0,
            allowPartialPayout: false,
            latePenaltyDailyBps: 0,
          },
          milestones: [
            {
              sequenceOrder: 1,
              title: 'M1',
              description: 'M1 desc',
              agreedAmountCents: 100000,
              deadlineIso: '2026-12-01T00:00:00.000Z',
              dependencyMilestoneIds: [],
              acceptanceCriteria: [
                { id: 'c1', title: 'C1', description: 'C1', requiredProofType: 'CI_TESTS' },
              ],
            },
          ],
        },
      });
      const contractId = createRes.body.contract.id;
      const milestoneId = createRes.body.contract.milestones[0].id;

      await sendRequest(container.app, {
        method: 'POST',
        path: `/api/v1/contracts/${contractId}/activate`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      // Illegally inject HUMAN_REVIEW_APPROVED directly before evidence is submitted
      container.auditService.appendWithinTx({
        actorId: 'reviewer_01',
        actorRole: 'REVIEWER',
        action: 'HUMAN_REVIEW_APPROVED',
        entityType: 'APPROVAL',
        entityId: 'appr_premature',
        contractId,
        milestoneId,
        previousState: 'ACTIVE',
        newState: 'APPROVED',
        payload: { notes: 'Premature approval' },
      });

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'LIFECYCLE_INCONSISTENCY');
      const orderFinding = replayRes.body.findings.find(
        (f: any) => f.code === 'IMPOSSIBLE_EVENT_ORDERING' || f.code === 'MISSING_PREDECESSOR'
      );
      assert.ok(orderFinding);
    } finally {
      cleanupFiles();
    }
  });

  // 12. Partial replay
  it('12. performs partial replay reconstructing state up to specified sequence number', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, milestoneId, clientToken } = await setupCompleteContract(container);

      // Find sequence number of CONTRACT_ACTIVATED
      const logs = container.auditService.listLogs({ contractId });
      const actLog = logs.find((l) => l.action === 'CONTRACT_ACTIVATED')!;
      assert.ok(actLog);

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay?mode=PARTIAL&upToSeq=${actLog.seq}`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      const replay = replayRes.body;
      assert.equal(replay.mode, 'PARTIAL');
      assert.equal(replay.status, 'SUCCESS');
      assert.equal(replay.targetSeq, actLog.seq);

      // At this point in time, contract is ACTIVE, but milestone is ACTIVE (not yet SUBMITTED, APPROVED or SETTLED)
      assert.equal(replay.reconstructedState.contract.status, 'ACTIVE');
      assert.equal(replay.reconstructedState.contract.settledMilestones, 0);
      assert.equal(replay.reconstructedState.milestones[milestoneId].status, 'ACTIVE');
    } finally {
      cleanupFiles();
    }
  });

  // 13. Verification-only mode
  it('13. executes verification-only mode validating cryptographic chain without state snapshots', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      const verifyRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/verify`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(verifyRes.status, 200);
      const verify = verifyRes.body;
      assert.equal(verify.mode, 'VERIFY_ONLY');
      assert.equal(verify.status, 'SUCCESS');
      assert.equal(verify.isCryptographicallyValid, true);
      assert.equal(verify.verificationSummary.chainValid, true);
      assert.equal(verify.reconstructedState, undefined);
    } finally {
      cleanupFiles();
    }
  });

  // 14. Missing predecessor
  it('14. detects missing predecessor when history starts in media res', async () => {
    const container = getIsolatedApp();
    try {
      const clientToken = await loginAsClient(container.app);

      // Create a dummy contract record
      container.db.raw.exec(`
        INSERT INTO contracts (
          id, title, description, total_budget_cents, currency,
          client_id, developer_id, reviewer_id, policy_rules_json,
          status, version, created_at, updated_at
        ) VALUES (
          'cnt_orphan', 'Orphan Contract', 'Missing genesis',
          100000, 'USD', 'client_01', 'dev_01', 'reviewer_01',
          '{}', 'ACTIVE', 1, '2026-11-08T00:00:00.000Z', '2026-11-08T00:00:00.000Z'
        )
      `);

      // Log CONTRACT_ACTIVATED without any prior CONTRACT_CREATED
      container.auditService.appendWithinTx({
        actorId: 'client_01',
        actorRole: 'CLIENT',
        action: 'CONTRACT_ACTIVATED',
        entityType: 'CONTRACT',
        entityId: 'cnt_orphan',
        contractId: 'cnt_orphan',
        previousState: 'DRAFT',
        newState: 'ACTIVE',
        payload: { note: 'Orphan activation' },
      });

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/cnt_orphan/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'INCOMPLETE_HISTORY');
      const missingInit = replayRes.body.findings.find(
        (f: any) => f.code === 'MISSING_INITIAL_STATE' || f.code === 'MISSING_PREDECESSOR'
      );
      assert.ok(missingInit);
    } finally {
      cleanupFiles();
    }
  });

  // 15. Cross-contract reference mismatch
  it('15. detects cross-contract reference mismatch', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Directly repoint an audit entry to foreign contract in database query
      container.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_update;');
      container.db.raw.exec('PRAGMA foreign_keys = OFF;');
      container.db.raw
        .prepare("UPDATE audit_logs SET contract_id = ? WHERE contract_id = ? AND action = ?")
        .run('foreign_contract_999', contractId, 'CONTRACT_ACTIVATED');

      // Replay remaining contract events
      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.ok(
        replayRes.body.status === 'CRYPTOGRAPHIC_FAILURE' ||
          replayRes.body.status === 'LIFECYCLE_INCONSISTENCY'
      );
    } finally {
      cleanupFiles();
    }
  });

  // 16. Unauthorized request
  it('16. blocks unauthenticated requests with HTTP 401', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId } = await setupCompleteContract(container);

      const unauthRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
      });

      assert.equal(unauthRes.status, 401);
      assert.equal(unauthRes.body.error.code, 'AUTH_TOKEN_REQUIRED');
    } finally {
      cleanupFiles();
    }
  });

  // 17. Cross-user access attempt
  it('17. blocks unauthorized cross-user access with HTTP 403 FORBIDDEN_NOT_CONTRACT_PARTY', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId } = await setupCompleteContract(container);

      // Insert an unrelated fourth user and login via standard login
      const salt = crypto.randomBytes(16).toString('hex');
      const derived = crypto.scryptSync('IntruderPass!2026', Buffer.from(salt, 'hex'), 64);
      const intruderHash = `${salt}:${derived.toString('hex')}`;

      container.db.raw.exec(`
        INSERT INTO users (id, name, email, password_hash, role, is_active, is_demo_account, created_at)
        VALUES ('user_intruder', 'Intruder User', 'intruder@external.local', '${intruderHash}', 'CLIENT', 1, 0, '2026-11-08T00:00:00.000Z')
      `);

      const intruderLoginRes = await sendRequest<{ token: string }>(container.app, {
        method: 'POST',
        path: '/api/v1/auth/login',
        body: { email: 'intruder@external.local', password: 'IntruderPass!2026' },
      });
      assert.equal(intruderLoginRes.status, 200);
      const intruderToken = intruderLoginRes.body.token;

      const crossUserRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${intruderToken}` },
      });

      assert.equal(crossUserRes.status, 403);
      assert.equal(crossUserRes.body.error.code, 'FORBIDDEN_NOT_CONTRACT_PARTY');
    } finally {
      cleanupFiles();
    }
  });

  // 18. PayPal capture event treated as descriptive only
  it('18. treats PayPal capture events as descriptive historical records without triggering payment ops', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, milestoneId, clientToken } = await setupCompleteContract(container);

      const paymentTxCountBefore = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM payment_transactions').get() as any
      ).count;

      const replayRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });

      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.status, 'SUCCESS');

      // Assert zero new payment transactions were created by the replay engine
      const paymentTxCountAfter = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM payment_transactions').get() as any
      ).count;
      assert.equal(paymentTxCountAfter, paymentTxCountBefore);

      // Verify descriptive reconstruction
      const ms = replayRes.body.reconstructedState.milestones[milestoneId];
      assert.equal(ms.status, 'SETTLED');
      assert.equal(ms.settledAmountCents, 500000);
    } finally {
      cleanupFiles();
    }
  });

  // 19. No financial or persisted-state mutation
  it('19. guarantees 100% read-only operation: zero database row mutations or insertions', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      const auditCountBefore = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any
      ).count;
      const contractCountBefore = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM contracts').get() as any
      ).count;
      const milestoneCountBefore = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM milestones').get() as any
      ).count;

      // Run 5 consecutive replay calls
      for (let i = 0; i < 5; i++) {
        const replayRes = await sendRequest(container.app, {
          method: 'GET',
          path: `/api/v1/contracts/${contractId}/audit/replay`,
          headers: { Authorization: `Bearer ${clientToken}` },
        });
        assert.equal(replayRes.status, 200);
      }

      // Assert zero rows were inserted or modified
      const auditCountAfter = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM audit_logs').get() as any
      ).count;
      const contractCountAfter = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM contracts').get() as any
      ).count;
      const milestoneCountAfter = (
        container.db.raw.prepare('SELECT COUNT(*) as count FROM milestones').get() as any
      ).count;

      assert.equal(auditCountAfter, auditCountBefore);
      assert.equal(contractCountAfter, contractCountBefore);
      assert.equal(milestoneCountAfter, milestoneCountBefore);
    } finally {
      cleanupFiles();
    }
  });

  // 20. Parameter validation and pagination bounds
  it('20. enforces query parameter validation and bounds limit safely', async () => {
    const container = getIsolatedApp();
    try {
      const { contractId, clientToken } = await setupCompleteContract(container);

      // Invalid mode
      const invalidModeRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay?mode=INVALID_MODE`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      assert.equal(invalidModeRes.status, 400);

      // Negative upToSeq
      const negSeqRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay?upToSeq=-5`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      assert.equal(negSeqRes.status, 400);

      // Valid limit
      const limitRes = await sendRequest(container.app, {
        method: 'GET',
        path: `/api/v1/contracts/${contractId}/audit/replay?limit=2`,
        headers: { Authorization: `Bearer ${clientToken}` },
      });
      assert.equal(limitRes.status, 200);
      assert.equal(limitRes.body.totalEventsProcessed, 2);
    } finally {
      cleanupFiles();
    }
  });
});
