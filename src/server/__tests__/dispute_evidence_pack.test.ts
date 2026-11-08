import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createServerApp, type HttpApp } from '../index.ts';
import type {
  DisputeEvidencePack,
  DisputePackVerificationResult,
} from '../../types/domain.ts';

interface ApiTestResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
  headers: http.IncomingHttpHeaders;
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
    throw new Error('Server address resolution failed');
  }

  const port = address.port;
  const payload = options.body !== undefined ? JSON.stringify(options.body) : undefined;
  const headers: Record<string, string> = {
    host: `127.0.0.1:${port}`,
    ...(options.headers ?? {}),
  };

  if (payload !== undefined) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(payload).toString();
  }

  return new Promise<ApiTestResponse<T>>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: options.path,
        method: options.method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          server.close();
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed: unknown = {};
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { rawText: raw };
          }
          resolve({
            status: res.statusCode ?? 500,
            body: parsed as T,
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', (err) => {
      server.close();
      reject(err);
    });

    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

describe('Prompt 4/8 — TrustChain Dispute Evidence Pack', () => {
  const tempDir = path.resolve(process.cwd(), '.tmp_test_dispute_pack');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const dbPath = path.join(tempDir, `dispute_pack_test_${Date.now()}.db`);
  const appContainer = createServerApp({ dbPath });

  let clientToken = '';
  let developerToken = '';
  let reviewerToken = '';
  let generatedPackId = '';

  it('pre-flight setup: authenticates client, developer, and reviewer personas', async () => {
    const clientLogin = await sendRequest<{ token: string }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'elena.client@acmefintech.example', password: 'ClientPass!2026' },
    });
    assert.equal(clientLogin.status, 200);
    clientToken = clientLogin.body.token;

    const devLogin = await sendRequest<{ token: string }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'marcus.dev@cloudbuilders.example', password: 'DevPass!2026' },
    });
    assert.equal(devLogin.status, 200);
    developerToken = devLogin.body.token;

    const revLogin = await sendRequest<{ token: string }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { email: 'sophia.reviewer@acmefintech.example', password: 'ReviewerPass!2026' },
    });
    assert.equal(revLogin.status, 200);
    reviewerToken = revLogin.body.token;
  });

  it('1. successfully generates a Dispute Evidence Pack with two-stage non-circular SHA-256 digest and audit anchor', async () => {
    // 1. Submit evidence
    const subRes = await sendRequest(appContainer.app, {
      method: 'POST',
      path: '/api/v1/milestones/ms_seed_01/evidence',
      headers: { Authorization: `Bearer ${developerToken}` },
      body: { demoFixtureKey: 'SUCCESSFUL_SUBMISSION' },
    });
    assert.equal(subRes.status, 201);

    // 2. Evaluate milestone
    const evalRes = await sendRequest(appContainer.app, {
      method: 'POST',
      path: '/api/v1/milestones/ms_seed_01/evaluate',
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(evalRes.status, 200);

    // 3. Generate an Evidence Passport
    const passRes = await sendRequest(appContainer.app, {
      method: 'GET',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/evidence-passport?forceRefresh=true',
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.equal(passRes.status, 200);

    // 4. Generate dispute pack
    const res = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
      headers: { Authorization: `Bearer ${clientToken}` },
      body: { reason: 'Milestone scope clarification dispute request' },
    });

    assert.equal(res.status, 201, 'Should return HTTP 201 Created');
    const pack = res.body.disputePack;
    assert.ok(pack, 'Dispute pack must be returned');
    assert.equal(pack.schemaVersion, 'mpai-dispute-pack-v1');
    assert.equal(pack.contractId, 'contract_seed_01');
    assert.equal(pack.milestoneId, 'ms_seed_01');
    assert.equal(pack.disputeStatus, 'COMPLETE');

    // Verify non-circular two-stage hashing
    assert.ok(pack.integrity.packContentDigestSha256, 'Stage 1 digest must exist');
    assert.equal(pack.integrity.packContentDigestSha256.length, 64);
    assert.ok(pack.integrity.packDigestSha256, 'Stage 2 final digest must exist');
    assert.equal(pack.integrity.packDigestSha256.length, 64);
    assert.notEqual(
      pack.integrity.packContentDigestSha256,
      pack.integrity.packDigestSha256,
      'Pre-audit content digest and post-audit final digest must differ'
    );
    assert.equal(pack.integrity.isCryptographicallyValid, true);

    // Verify audit anchoring
    assert.ok(
      pack.integrity.auditEventReferences.length > 0,
      'Audit log reference must be anchored'
    );
    const anchorHash = pack.integrity.auditEventReferences[0];
    const auditLogs = appContainer.auditService.listLogs({ milestoneId: 'ms_seed_01' });
    const match = auditLogs.find((l) => l.entryHash === anchorHash);
    assert.ok(match, 'Anchored audit entry must exist in immutable audit log');
    assert.equal(match.action, 'DISPUTE_PACK_GENERATED');

    generatedPackId = pack.id;
  });

  it('2. handles milestone with zero evidence submissions as INCOMPLETE_EVIDENCE without generating fake data', async () => {
    // Create an unsubmitted draft milestone
    const newMsId = 'ms_draft_empty_01';
    appContainer.milestoneRepo.insert({
      id: newMsId,
      contractId: 'contract_seed_01',
      sequenceOrder: 99,
      title: 'Draft Milestone with No Evidence',
      description: 'Zero submissions on file',
      agreedAmountCents: 50000,
      deadlineIso: new Date(Date.now() + 864000000).toISOString(),
      dependencyMilestoneIds: [],
      acceptanceCriteria: [
        {
          id: 'crit_empty_1',
          title: 'Unsubmitted Spec',
          description: 'No proof provided',
          requiredProofType: 'CODE_COMMIT',
        },
      ],
      status: 'DRAFT',
      paymentStatus: 'NOT_READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'POST',
      path: `/api/v1/contracts/contract_seed_01/milestones/${newMsId}/dispute-pack`,
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });

    assert.equal(res.status, 201);
    const pack = res.body.disputePack;
    assert.equal(pack.disputeStatus, 'INCOMPLETE_EVIDENCE');
    assert.equal(pack.evidenceSubmissions.totalSubmissions, 0);
    assert.equal(pack.evidenceSubmissions.latestSubmission, null);
    assert.equal(pack.passportSummary.available, false);
  });

  it('3. handles milestone with missing Evidence Passport as INCOMPLETE_EVIDENCE and available=false', async () => {
    // Milestone ms_draft_empty_01 has no passport
    const res = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_draft_empty_01/dispute-pack',
      headers: { Authorization: `Bearer ${developerToken}` },
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.disputePack.passportSummary.available, false);
    assert.equal(res.body.disputePack.disputeStatus, 'INCOMPLETE_EVIDENCE');
  });

  it('4. detects tampered Evidence Passport digest and marks disputeStatus as CORRUPTED_INTEGRITY', async () => {
    // Tamper with passport record in SQLite for milestone ms_seed_01
    const storedPassportRow = appContainer.db.raw
      .prepare('SELECT passport_data_json FROM evidence_passports WHERE milestone_id = ?')
      .get('ms_seed_01') as { passport_data_json: string } | undefined;

    assert.ok(storedPassportRow, 'Passport row should exist');
    const parsed = JSON.parse(storedPassportRow.passport_data_json) as Record<string, unknown>;
    (parsed.identity as Record<string, unknown>).agreedAmountCents = 99999999; // Maliciously tamper amount

    appContainer.db.raw
      .prepare('UPDATE evidence_passports SET passport_data_json = ? WHERE milestone_id = ?')
      .run(JSON.stringify(parsed), 'ms_seed_01');

    const res = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    assert.equal(res.status, 201);
    const pack = res.body.disputePack;
    assert.equal(pack.disputeStatus, 'CORRUPTED_INTEGRITY');
    assert.equal(pack.passportSummary.isCryptographicallyValid, false);
  });

  it('5. detects corrupted Audit Replay hash-chain and marks disputeStatus as CORRUPTED_INTEGRITY', async () => {
    // Restore passport valid state first
    await sendRequest(appContainer.app, {
      method: 'GET',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/evidence-passport?forceRefresh=true',
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });

    const origEntry = appContainer.db.raw
      .prepare('SELECT entry_hash FROM audit_logs WHERE seq = 1')
      .get() as { entry_hash: string };

    // Disable immutable triggers temporarily to simulate attacker SQLite corruption
    appContainer.db.raw.exec('DROP TRIGGER IF EXISTS trg_audit_logs_immutable_update');
    appContainer.db.raw
      .prepare("UPDATE audit_logs SET entry_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' WHERE seq = 1")
      .run();

    const res = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });

    assert.equal(res.status, 201);
    const pack = res.body.disputePack;
    assert.equal(pack.disputeStatus, 'CORRUPTED_INTEGRITY');
    assert.equal(pack.auditReplaySummary.isCryptographicallyValid, false);

    // Clean up: restore valid entry_hash
    appContainer.db.raw
      .prepare('UPDATE audit_logs SET entry_hash = ? WHERE seq = 1')
      .run(origEntry.entry_hash);
  });

  it('6. handles missing human approval record safely (recorded: false, empty decisions)', async () => {
    const res = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_draft_empty_01/dispute-pack',
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    assert.equal(res.status, 201);
    const pack = res.body.disputePack;
    assert.equal(pack.humanApprovalHistory.recorded, false);
    assert.equal(pack.humanApprovalHistory.allDecisions.length, 0);
  });

  it('7. enforces AI Advisory Assessment invariants (isAdvisory: true, disclaimer present, isolated from settlement math)', async () => {
    const res = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'GET',
      path: `/api/v1/contracts/contract_seed_01/dispute-packs/${generatedPackId}`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    assert.equal(res.status, 200);
    const pack = res.body.disputePack;

    // AI is strictly advisory
    assert.equal(pack.aiAdvisoryAssessment.isAdvisory, true);
    assert.ok(
      pack.aiAdvisoryAssessment.advisoryDisclaimer.includes('strictly advisory'),
      'Advisory disclaimer must explicitly warn that AI cannot approve or authorize'
    );

    // Settlement outcome remains rule-based and separate
    assert.ok(pack.settlementOutcome.evaluated, 'Settlement must be evaluated');
    assert.equal(typeof pack.settlementOutcome.permittedAmountCents, 'number');
    assert.equal(typeof pack.settlementOutcome.gateBlocked, 'boolean');
  });

  it('8. reconstructs deterministic chronological timeline with sequence number tie-breaking on identical timestamps', async () => {
    const timeline = appContainer.disputeEvidencePackService.buildTimeline({
      milestoneId: 'ms_tie_breaker_test',
      auditLogs: [
        {
          seq: 5,
          id: 'evt_seq_5',
          timestamp: '2026-11-08T12:00:00.000Z',
          actorId: 'client_01',
          actorRole: 'CLIENT',
          action: 'EVIDENCE_PASSPORT_GENERATED',
          entityType: 'MILESTONE',
          entityId: 'ms_tie_breaker_test',
          contractId: 'contract_seed_01',
          milestoneId: 'ms_tie_breaker_test',
          previousState: null,
          newState: 'VERIFIED',
          payload: {},
          previousHash: '0'.repeat(64),
          entryHash: '1'.repeat(64),
        },
        {
          seq: 2,
          id: 'evt_seq_2',
          timestamp: '2026-11-08T12:00:00.000Z', // Identical timestamp
          actorId: 'dev_01',
          actorRole: 'DEVELOPER',
          action: 'EVIDENCE_SUBMITTED',
          entityType: 'MILESTONE',
          entityId: 'ms_tie_breaker_test',
          contractId: 'contract_seed_01',
          milestoneId: 'ms_tie_breaker_test',
          previousState: null,
          newState: 'SUBMITTED',
          payload: {},
          previousHash: '0'.repeat(64),
          entryHash: '2'.repeat(64),
        },
        {
          seq: 1,
          id: 'evt_seq_1',
          timestamp: '2026-11-08T11:00:00.000Z', // Earlier timestamp
          actorId: 'client_01',
          actorRole: 'CLIENT',
          action: 'CONTRACT_ACTIVATED',
          entityType: 'CONTRACT',
          entityId: 'ms_tie_breaker_test',
          contractId: 'contract_seed_01',
          milestoneId: 'ms_tie_breaker_test',
          previousState: 'DRAFT',
          newState: 'ACTIVE',
          payload: {},
          previousHash: '0'.repeat(64),
          entryHash: '3'.repeat(64),
        },
      ],
      submissions: [],
      approvals: [],
      payments: [],
    });

    assert.equal(timeline.length, 3);
    assert.equal(timeline[0].seq, 1, 'Earliest timestamp must be first');
    assert.equal(timeline[1].seq, 2, 'Tie-break must order seq 2 before seq 5');
    assert.equal(timeline[2].seq, 5, 'Tie-break must order seq 5 after seq 2');
  });

  it('9. blocks unauthenticated requests with HTTP 401 AUTH_TOKEN_REQUIRED', async () => {
    const res = await sendRequest(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
      body: { reason: 'Unauthorized attempt' },
    });
    assert.equal(res.status, 401);
  });

  it('10. blocks outsider users with HTTP 403 FORBIDDEN_NOT_CONTRACT_PARTY', async () => {
    // Create an outsider user not involved in contract_seed_01
    const outsiderId = 'user_outsider_99';
    appContainer.db.raw
      .prepare(
        'INSERT INTO users (id, name, email, password_hash, role, is_active, is_demo_account, created_at) VALUES (?, ?, ?, ?, ?, 1, 0, ?)'
      )
      .run(
        outsiderId,
        'Outsider Bob',
        'outsider@test.com',
        'some_hash',
        'DEVELOPER',
        new Date().toISOString()
      );

    const outsiderSession = {
      jti: 'jti_outsider_99',
      userId: outsiderId,
      role: 'DEVELOPER' as const,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    };
    appContainer.sessionRepo.createSession(outsiderSession);
    const outsiderToken = appContainer.authService.signClaims({
      jti: outsiderSession.jti,
      sub: outsiderId,
      role: 'DEVELOPER',
      iss: 'milestoneproof-ai-server',
      aud: 'milestoneproof-ai-api',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const res = await sendRequest(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
      headers: { Authorization: `Bearer ${outsiderToken}` },
      body: { reason: 'Intruder request' },
    });

    assert.equal(res.status, 403);
    assert.equal((res.body as { error: { code: string } }).error.code, 'FORBIDDEN_NOT_CONTRACT_PARTY');
  });

  it('11. enforces cross-contract and cross-milestone isolation (HTTP 404 MILESTONE_NOT_FOUND / DISPUTE_PACK_NOT_FOUND)', async () => {
    // Non-existent contract
    const res1 = await sendRequest(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/non_existent_contract/milestones/ms_seed_01/dispute-pack',
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(res1.status, 404);

    // Non-existent milestone in valid contract
    const res2 = await sendRequest(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/non_existent_milestone/dispute-pack',
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(res2.status, 404);

    // Non-existent pack
    const res3 = await sendRequest(appContainer.app, {
      method: 'GET',
      path: '/api/v1/contracts/contract_seed_01/dispute-packs/non_existent_pack',
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    assert.equal(res3.status, 404);
  });

  it('12. detects direct SQLite row tampering on stored dispute pack data upon retrieval and verification', async () => {
    // Generate a fresh pack to tamper with
    const genRes = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
      headers: { Authorization: `Bearer ${reviewerToken}` },
      body: { reason: 'Tamper test' },
    });
    assert.equal(genRes.status, 201);
    const freshPackId = genRes.body.disputePack.id;

    // Verify it is initially valid
    const initialVerify = await sendRequest<{ verification: DisputePackVerificationResult }>(
      appContainer.app,
      {
        method: 'GET',
        path: `/api/v1/contracts/contract_seed_01/dispute-packs/${freshPackId}/verify`,
        headers: { Authorization: `Bearer ${reviewerToken}` },
      }
    );
    assert.equal(initialVerify.body.verification.isDigestValid, true);

    // Tamper with the pack JSON in SQLite directly
    const row = appContainer.db.raw
      .prepare('SELECT pack_data_json FROM dispute_evidence_packs WHERE id = ?')
      .get(freshPackId) as { pack_data_json: string };
    const parsed = JSON.parse(row.pack_data_json) as Record<string, unknown>;
    (parsed.milestoneSummary as Record<string, unknown>).agreedAmountCents = 1; // Unauthorized modification

    appContainer.db.raw
      .prepare('UPDATE dispute_evidence_packs SET pack_data_json = ? WHERE id = ?')
      .run(JSON.stringify(parsed), freshPackId);

    // Verify endpoint now detects tampering
    const tamperedVerify = await sendRequest<{ verification: DisputePackVerificationResult }>(
      appContainer.app,
      {
        method: 'GET',
        path: `/api/v1/contracts/contract_seed_01/dispute-packs/${freshPackId}/verify`,
        headers: { Authorization: `Bearer ${reviewerToken}` },
      }
    );
    assert.equal(tamperedVerify.status, 200);
    assert.equal(tamperedVerify.body.verification.isDigestValid, false);
    assert.notEqual(
      tamperedVerify.body.verification.storedDigest,
      tamperedVerify.body.verification.computedDigest
    );

    // Get endpoint marks isCryptographicallyValid as false
    const getRes = await sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
      method: 'GET',
      path: `/api/v1/contracts/contract_seed_01/dispute-packs/${freshPackId}`,
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.disputePack.integrity.isCryptographicallyValid, false);
  });

  it('13. exports portable sanitized JSON pack excluding credentials/tokens and includes exportSha256', async () => {
    const res = await sendRequest<{
      export: {
        pack: DisputeEvidencePack;
        exportedAt: string;
        exportSha256: string;
        sanitized: boolean;
      };
    }>(appContainer.app, {
      method: 'GET',
      path: `/api/v1/contracts/contract_seed_01/dispute-packs/${generatedPackId}/export`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    assert.equal(res.status, 200);
    const exportData = res.body.export;
    assert.ok(exportData, 'Export payload must exist');
    assert.ok(exportData.exportSha256, 'Export checksum must exist');
    assert.equal(exportData.exportSha256.length, 64);
    assert.equal(exportData.sanitized, true);

    // Inspect exported JSON string to verify zero token/credential presence
    const exportedJson = JSON.stringify(exportData.pack);
    assert.ok(!exportedJson.includes('access_token'));
    assert.ok(!exportedJson.includes('client_secret'));
    assert.ok(!exportedJson.includes('password_hash'));
    assert.ok(!exportedJson.includes('authorization_header'));
  });

  it('14. guarantees atomic transaction rollback when audit logging throws an error during pack generation', async () => {
    const beforeCount = (
      appContainer.db.raw
        .prepare('SELECT COUNT(*) as count FROM dispute_evidence_packs')
        .get() as { count: number }
    ).count;

    // Simulate an unexpected audit append failure inside transaction by providing an invalid actor that throws
    const faultyAuditService = {
      listLogs: () => [],
      appendWithinTx: () => {
        throw new Error('SIMULATED_AUDIT_TRANSACTION_FAILURE');
      },
    };

    const faultyDisputeService = Object.assign(
      Object.create(Object.getPrototypeOf(appContainer.disputeEvidencePackService)),
      appContainer.disputeEvidencePackService,
      { auditService: faultyAuditService }
    );

    await assert.rejects(
      async () => {
        await faultyDisputeService.generateDisputePack(
          'contract_seed_01',
          'ms_seed_01',
          'reviewer_01'
        );
      },
      /SIMULATED_AUDIT_TRANSACTION_FAILURE/
    );

    const afterCount = (
      appContainer.db.raw
        .prepare('SELECT COUNT(*) as count FROM dispute_evidence_packs')
        .get() as { count: number }
    ).count;

    assert.equal(afterCount, beforeCount, 'Rollback must prevent saving partial pack rows');
  });

  it('15. handles concurrent dispute pack generations safely without hash collisions', async () => {
    const [resA, resB] = await Promise.all([
      sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
        method: 'POST',
        path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: { reason: 'Concurrent request A' },
      }),
      sendRequest<{ disputePack: DisputeEvidencePack }>(appContainer.app, {
        method: 'POST',
        path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: { reason: 'Concurrent request B' },
      }),
    ]);

    assert.equal(resA.status, 201);
    assert.equal(resB.status, 201);
    assert.ok(resA.body.disputePack.id);
    assert.ok(resB.body.disputePack.id);
    assert.equal(resA.body.disputePack.integrity.isCryptographicallyValid, true);
    assert.equal(resB.body.disputePack.integrity.isCryptographicallyValid, true);
  });

  it('16. strictly enforces read-only financial invariants: zero payment operations, zero status changes, zero balance mutations', async () => {
    const msBefore = appContainer.milestoneRepo.findById('ms_seed_01');
    const paymentsBefore = appContainer.paymentRepo.listByMilestoneId('ms_seed_01');

    // Perform pack generation, verify, and export
    await sendRequest(appContainer.app, {
      method: 'POST',
      path: '/api/v1/contracts/contract_seed_01/milestones/ms_seed_01/dispute-pack',
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    await sendRequest(appContainer.app, {
      method: 'GET',
      path: `/api/v1/contracts/contract_seed_01/dispute-packs/${generatedPackId}/verify`,
      headers: { Authorization: `Bearer ${reviewerToken}` },
    });
    await sendRequest(appContainer.app, {
      method: 'GET',
      path: `/api/v1/contracts/contract_seed_01/dispute-packs/${generatedPackId}/export`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    const msAfter = appContainer.milestoneRepo.findById('ms_seed_01');
    const paymentsAfter = appContainer.paymentRepo.listByMilestoneId('ms_seed_01');

    assert.equal(msAfter?.status, msBefore?.status, 'Milestone status must not change');
    assert.equal(
      msAfter?.paymentStatus,
      msBefore?.paymentStatus,
      'Milestone paymentStatus must not change'
    );
    assert.equal(
      msAfter?.agreedAmountCents,
      msBefore?.agreedAmountCents,
      'Milestone agreedAmountCents must not change'
    );
    assert.equal(
      paymentsAfter.length,
      paymentsBefore.length,
      'Zero payment transactions must be recorded during dispute operations'
    );
  });
});
