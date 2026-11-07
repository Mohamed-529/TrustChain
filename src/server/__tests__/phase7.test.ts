import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServerApp } from '../index.ts';
import {
  canonicalizeJsonValue,
  computeEvidencePayloadSha256,
  EVIDENCE_CANONICALIZATION_VERSION,
  EVIDENCE_HASH_ALGORITHM,
} from '../repositories/DomainRepositories.ts';
import {
  MilestoneProofApiError,
  MilestoneProofClient,
} from '../../sdk/MilestoneProofClient.ts';

async function startTestServer(options?: Parameters<typeof createServerApp>[0]) {
  const container = createServerApp({
    dbPath: ':memory:',
    authOptions: {
      enableDemoImpersonation: true,
    },
    ...options,
  });

  const server = http.createServer(container.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  const close = async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
    container.db.close();
  };

  return { container, baseUrl, close };
}

function signGitHubWebhook(secret: string, rawBody: string): string {
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${hmac}`;
}

describe('Phase 7 — Evidence Provenance & Independent GitHub Verification', () => {
  it('1. Independent GitHub REST API Provenance Verification & Financial Boundary: verifies repo, commit, PR, and workflow run via GitHub API, never leaks token, and never auto-approves or releases payment', async () => {
    const githubApiCalls: Array<{ url: string; authHeader: string | null }> = [];
    const secretGitHubToken = 'test-only-fake-github-api-token-provenance-do-not-leak';

    const mockGitHubFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = new Headers(init?.headers);
      githubApiCalls.push({
        url,
        authHeader: headers.get('authorization'),
      });

      if (url === 'https://api.github.com/repos/cloudbuilders/acme-oauth-gateway') {
        return new Response(
          JSON.stringify({
            id: 1001,
            full_name: 'cloudbuilders/acme-oauth-gateway',
            private: false,
            default_branch: 'main',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (
        url ===
        'https://api.github.com/repos/cloudbuilders/acme-oauth-gateway/commits/a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f'
      ) {
        return new Response(
          JSON.stringify({
            sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            html_url:
              'https://github.com/cloudbuilders/acme-oauth-gateway/commit/a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            commit: {
              author: {
                name: 'Marcus Vance',
                date: '2026-04-02T10:15:00.000Z',
              },
              message: 'feat(oauth): implement OAuth2 token exchange and session store',
            },
            files: [
              { filename: 'src/oauth/tokenExchange.ts' },
              { filename: 'src/oauth/sessionStore.ts' },
              { filename: 'src/__tests__/oauth.spec.ts' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (
        url ===
        'https://api.github.com/repos/cloudbuilders/acme-oauth-gateway/pulls/42'
      ) {
        return new Response(
          JSON.stringify({
            number: 42,
            state: 'closed',
            merged: true,
            title: 'PR #42: Complete Milestone 1 OAuth2 Gateway',
            head: {
              ref: 'release/milestone-1-oauth2',
              sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            },
            base: {
              ref: 'main',
            },
            merge_commit_sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (
        url ===
        'https://api.github.com/repos/cloudbuilders/acme-oauth-gateway/actions/runs/9041'
      ) {
        return new Response(
          JSON.stringify({
            id: 9041,
            name: 'MilestoneProof CI Pipeline',
            status: 'completed',
            conclusion: 'success',
            head_sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            head_branch: 'release/milestone-1-oauth2',
            html_url:
              'https://github.com/cloudbuilders/acme-oauth-gateway/actions/runs/9041',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ message: `Unmocked URL: ${url}` }), {
        status: 404,
      });
    };

    const { container, baseUrl, close } = await startTestServer({
      githubOptions: {
        githubToken: secretGitHubToken,
        fetchImpl: mockGitHubFetch,
      },
    });

    try {
      const devSdk = new MilestoneProofClient({ baseUrl });
      const reviewerSdk = new MilestoneProofClient({ baseUrl });

      await devSdk.switchDemoPersona({ userId: 'dev_01' });
      await reviewerSdk.switchDemoPersona({ userId: 'reviewer_01' });

      // 1. Developer submits Milestone 1 evidence
      const { submission } = await devSdk.submitMilestoneEvidence('ms_seed_01', {
        demoFixtureKey: 'SUCCESSFUL_SUBMISSION',
      } as unknown as Parameters<typeof devSdk.submitMilestoneEvidence>[1]);

      assert.ok(
        submission.payloadSha256 && /^[0-9a-f]{64}$/.test(submission.payloadSha256),
        'Submission must persist a 64-char SHA-256 payload digest'
      );
      assert.equal(submission.provenanceStatus, 'UNVERIFIED_UNAVAILABLE');

      // 2. Trigger independent GitHub provenance verification via API
      const { provenance } = await reviewerSdk.verifyMilestoneEvidenceProvenance(
        'ms_seed_01',
        submission.id
      );

      assert.equal(provenance.verificationMode, 'GITHUB_REST_API');
      assert.equal(provenance.overallStatus, 'VERIFIED');
      assert.equal(provenance.eligibleForBoundaryReview, true);
      assert.equal(provenance.integrity.payloadHashMatches, true);
      assert.equal(provenance.repository.status, 'VERIFIED');
      assert.equal(
        provenance.repository.canonicalFullName,
        'cloudbuilders/acme-oauth-gateway'
      );
      assert.equal(provenance.commit.status, 'VERIFIED');
      assert.equal(provenance.commit.belongsToRepository, true);
      assert.equal(provenance.pullRequest.status, 'VERIFIED');
      assert.equal(provenance.pullRequest.referencesSubmittedCommit, true);
      assert.equal(provenance.pullRequest.statusMatchesSubmitted, true);
      assert.equal(provenance.workflowRun.status, 'VERIFIED');
      assert.equal(provenance.workflowRun.matchesSubmittedCommit, true);
      assert.equal(provenance.workflowRun.statusMatchesSubmittedCi, true);
      assert.equal(provenance.discrepancies.length, 0);

      // Verify all 4 official GitHub REST API endpoints were called with Bearer token
      assert.equal(githubApiCalls.length, 4);
      assert.ok(
        githubApiCalls.every((c) => c.authHeader === `Bearer ${secretGitHubToken}`)
      );

      // Verify secret GitHub token is NEVER leaked in API response or audit logs
      const serializedProvenance = JSON.stringify(provenance);
      assert.ok(
        !serializedProvenance.includes(secretGitHubToken),
        'Secret GitHub token must never appear in provenance response'
      );

      // 3. CRITICAL FINANCIAL BOUNDARY: GitHub verification must NEVER auto-approve milestone or release payment
      const milestoneAfterVerify = container.milestoneRepo.findById('ms_seed_01');
      assert.equal(
        milestoneAfterVerify?.status,
        'SUBMITTED',
        'GitHub provenance verification must NEVER transition milestone to APPROVED or SETTLED'
      );
      assert.equal(milestoneAfterVerify?.paymentStatus, 'NOT_READY');
      assert.equal(
        container.approvalRepo.listByMilestoneId('ms_seed_01').length,
        0,
        'GitHub provenance verification must NEVER create a human approval record'
      );

      // 4. Verify GET /milestones/:id/evidence/provenance returns the persisted record
      const { latestProvenance, provenanceHistory } =
        await reviewerSdk.getMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(latestProvenance?.id, provenance.id);
      assert.equal(provenanceHistory.length, 1);
    } finally {
      await close();
    }
  });

  it('2. Provenance Mismatch Detection: detects fake repo (404), fake commit (404), unmerged/mismatched PR, and failed workflow run, blocking policy calculation and human approval', async () => {
    let scenario: 'FAKE_REPO' | 'FAKE_COMMIT' | 'MISMATCHED_PR_AND_FAILED_WORKFLOW' =
      'FAKE_REPO';

    const mockGitHubFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (scenario === 'FAKE_REPO') {
        return new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url === 'https://api.github.com/repos/cloudbuilders/acme-oauth-gateway') {
        return new Response(
          JSON.stringify({
            id: 1001,
            full_name: 'cloudbuilders/acme-oauth-gateway',
            private: false,
            default_branch: 'main',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (scenario === 'FAKE_COMMIT') {
        return new Response(JSON.stringify({ message: 'No commit found for SHA' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }

      // scenario === 'MISMATCHED_PR_AND_FAILED_WORKFLOW'
      if (url.includes('/commits/')) {
        return new Response(
          JSON.stringify({
            sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            commit: {
              author: { name: 'Marcus Vance', date: '2026-04-02T10:15:00.000Z' },
              message: 'feat(oauth): implement OAuth2 token exchange',
            },
            files: [
              { filename: 'src/oauth/tokenExchange.ts' },
              { filename: 'src/oauth/sessionStore.ts' },
              { filename: 'src/__tests__/oauth.spec.ts' },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/pulls/42')) {
        // Developer claimed MERGED for commit a8f4c219..., but GitHub says PR #42 is OPEN and points to a different commit!
        return new Response(
          JSON.stringify({
            number: 42,
            state: 'open',
            merged: false,
            title: 'WIP Draft PR',
            head: {
              ref: 'feat/wrong-branch',
              sha: 'ffffffffffffffffffffffffffffffffffffffff',
            },
            base: { ref: 'main' },
            merge_commit_sha: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/actions/runs/9041')) {
        // Developer claimed CI status SUCCESS, but GitHub Actions says conclusion='failure'!
        return new Response(
          JSON.stringify({
            id: 9041,
            name: 'MilestoneProof CI Pipeline',
            status: 'completed',
            conclusion: 'failure',
            head_sha: 'ffffffffffffffffffffffffffffffffffffffff',
            head_branch: 'feat/wrong-branch',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    };

    const { baseUrl, close } = await startTestServer({
      githubOptions: {
        githubToken: 'test-only-fake-github-api-token-mismatch',
        fetchImpl: mockGitHubFetch,
      },
    });

    try {
      const devSdk = new MilestoneProofClient({ baseUrl });
      const reviewerSdk = new MilestoneProofClient({ baseUrl });

      await devSdk.switchDemoPersona({ userId: 'dev_01' });
      await reviewerSdk.switchDemoPersona({ userId: 'reviewer_01' });

      await devSdk.submitMilestoneEvidence('ms_seed_01', {
        demoFixtureKey: 'SUCCESSFUL_SUBMISSION',
      } as unknown as Parameters<typeof devSdk.submitMilestoneEvidence>[1]);

      // Case A: Fake Repository (404)
      scenario = 'FAKE_REPO';
      const { provenance: fakeRepoProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(fakeRepoProv.overallStatus, 'MISMATCH_DETECTED');
      assert.equal(fakeRepoProv.eligibleForBoundaryReview, false);
      assert.equal(fakeRepoProv.repository.status, 'NOT_FOUND');
      assert.equal(fakeRepoProv.repository.canonicalFullName, null);

      // Case B: Fake Commit (404)
      scenario = 'FAKE_COMMIT';
      const { provenance: fakeCommitProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(fakeCommitProv.overallStatus, 'MISMATCH_DETECTED');
      assert.equal(fakeCommitProv.repository.status, 'VERIFIED');
      assert.equal(fakeCommitProv.commit.status, 'NOT_FOUND');
      assert.equal(fakeCommitProv.commit.belongsToRepository, false);

      // Case C: Mismatched PR state/commit + Failed GitHub Actions workflow run
      scenario = 'MISMATCHED_PR_AND_FAILED_WORKFLOW';
      const { provenance: mismatchPrWfProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(mismatchPrWfProv.overallStatus, 'MISMATCH_DETECTED');
      assert.equal(mismatchPrWfProv.commit.status, 'VERIFIED');
      assert.equal(mismatchPrWfProv.pullRequest.status, 'MISMATCH');
      assert.equal(mismatchPrWfProv.pullRequest.referencesSubmittedCommit, false);
      assert.equal(mismatchPrWfProv.pullRequest.statusMatchesSubmitted, false);
      assert.equal(mismatchPrWfProv.workflowRun.status, 'MISMATCH');
      assert.equal(mismatchPrWfProv.workflowRun.matchesSubmittedCommit, false);
      assert.equal(mismatchPrWfProv.workflowRun.statusMatchesSubmittedCi, false);

      // Evaluate Milestone 1 while provenance is MISMATCH_DETECTED -> must force 0 verified criteria, CRITICAL risk, FAIL outcome, and 0 permitted cents
      const { evaluation } = await reviewerSdk.evaluateMilestoneEvidence('ms_seed_01');
      assert.equal(evaluation.evidenceAnalysis.verifiedCount, 0);
      assert.equal(evaluation.riskAnalysis.overallRiskSeverity, 'CRITICAL');
      assert.equal(evaluation.arbitratorRecommendation.recommendedOutcome, 'FAIL');
      assert.equal(evaluation.policyCalculation.gateBlocked, true);
      assert.equal(evaluation.policyCalculation.permittedAmountCents, 0);
      assert.ok(
        evaluation.policyCalculation.gatesTripped.some((g) =>
          g.includes('EVIDENCE_PROVENANCE_GATE')
        )
      );

      // Attempting human approval when provenance is MISMATCH_DETECTED must fail with 409 EVIDENCE_PROVENANCE_MISMATCH_BLOCKS_APPROVAL
      await assert.rejects(
        async () => {
          await reviewerSdk.submitHumanReview('ms_seed_01', {
            decision: 'APPROVE',
            approvedAmountCents: 250000,
            justification: 'Attempting to approve despite GitHub provenance mismatch',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'EVIDENCE_PROVENANCE_MISMATCH_BLOCKS_APPROVAL');
          return true;
        }
      );
    } finally {
      await close();
    }
  });

  it('3. Unavailable Verification vs. Genuine Verification & Post-Submission Payload Tamper Detection: distinguishes UNVERIFIED_UNAVAILABLE from VERIFIED and blocks tampered SQLite evidence payloads (TAMPERED_PAYLOAD)', async () => {
    // Start server WITHOUT GitHub token or mock fetch -> UNCONFIGURED_UNAVAILABLE
    const { container, baseUrl, close } = await startTestServer();

    try {
      const devSdk = new MilestoneProofClient({ baseUrl });
      const reviewerSdk = new MilestoneProofClient({ baseUrl });

      await devSdk.switchDemoPersona({ userId: 'dev_01' });
      await reviewerSdk.switchDemoPersona({ userId: 'reviewer_01' });

      const { submission } = await devSdk.submitMilestoneEvidence('ms_seed_01', {
        demoFixtureKey: 'SUCCESSFUL_SUBMISSION',
      } as unknown as Parameters<typeof devSdk.submitMilestoneEvidence>[1]);

      // 1. When GitHub API is unconfigured, provenance verification explicitly reports UNVERIFIED_UNAVAILABLE (never falsely VERIFIED)
      const { provenance: unverifiedProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(unverifiedProv.verificationMode, 'UNCONFIGURED_UNAVAILABLE');
      assert.equal(unverifiedProv.overallStatus, 'UNVERIFIED_UNAVAILABLE');
      assert.equal(unverifiedProv.repository.status, 'UNAVAILABLE');
      assert.equal(unverifiedProv.commit.status, 'UNAVAILABLE');
      assert.equal(unverifiedProv.integrity.payloadHashMatches, true);

      // 2. Evaluate Milestone 1 before tampering
      await reviewerSdk.evaluateMilestoneEvidence('ms_seed_01');

      // 3. Simulate post-submission tampering in SQLite (altering commit_sha after submission)
      container.db.raw
        .prepare(`UPDATE evidence_submissions SET commit_sha = ? WHERE id = ?`)
        .run('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', submission.id);

      // 4. GET provenance immediately detects TAMPERED_PAYLOAD dynamically on read
      const { latestProvenance: tamperedRead } =
        await reviewerSdk.getMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(tamperedRead?.overallStatus, 'TAMPERED_PAYLOAD');
      assert.equal(tamperedRead?.integrity.payloadHashMatches, false);

      // 5. Re-running verifyProvenance persists TAMPERED_PAYLOAD
      const { provenance: tamperedVerified } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(tamperedVerified.overallStatus, 'TAMPERED_PAYLOAD');
      assert.equal(tamperedVerified.eligibleForBoundaryReview, false);
      assert.equal(tamperedVerified.integrity.payloadHashMatches, false);

      // 6. HumanReviewService blocks approval of tampered evidence with 409 EVIDENCE_PROVENANCE_MISMATCH_BLOCKS_APPROVAL
      const reviewDetails = container.humanReviewService.getMilestoneReviewDetails('ms_seed_01');
      assert.equal(reviewDetails.allowedActions.canApprove, false);
      assert.equal(reviewDetails.allowedActions.maxPermittedAmountCents, 0);
      assert.ok(
        reviewDetails.allowedActions.blockingReasons.some((r) =>
          r.includes('EVIDENCE_PROVENANCE_GATE')
        )
      );

      await assert.rejects(
        async () => {
          await reviewerSdk.submitHumanReview('ms_seed_01', {
            decision: 'APPROVE',
            approvedAmountCents: 250000,
            justification: 'Attempting to approve tampered evidence submission',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'EVIDENCE_PROVENANCE_MISMATCH_BLOCKS_APPROVAL');
          return true;
        }
      );
    } finally {
      await close();
    }
  });

  it('4. GitHub Webhook Authenticity (X-Hub-Signature-256), Idempotency (X-GitHub-Delivery), Concurrency & Retry Recovery', async () => {
    const webhookSecret = 'test-only-github-webhook-hmac-key-provenance-not-a-secret';

    // Part A: Fail-closed when GITHUB_WEBHOOK_SECRET is missing
    const unconfiguredServer = await startTestServer({
      githubOptions: {
        githubWebhookSecret: '',
      },
    });
    try {
      const sdk = new MilestoneProofClient({ baseUrl: unconfiguredServer.baseUrl });
      const payload = { action: 'completed', repository: { full_name: 'org/repo' } };
      await assert.rejects(
        async () => {
          await sdk.handleGitHubWebhook(
            {
              'X-GitHub-Delivery': 'deliv_unconfigured_01',
              'X-GitHub-Event': 'workflow_run',
              'X-Hub-Signature-256': signGitHubWebhook('any', JSON.stringify(payload)),
            },
            payload
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, 'GITHUB_WEBHOOK_VERIFICATION_UNAVAILABLE');
          return true;
        }
      );
    } finally {
      await unconfiguredServer.close();
    }

    // Part B: Configured webhook secret — test invalid signature rejection, valid webhook reconciliation, idempotency, concurrency, and retry after failure
    const { container, baseUrl, close } = await startTestServer({
      githubOptions: {
        githubWebhookSecret: webhookSecret,
      },
    });

    try {
      const devSdk = new MilestoneProofClient({ baseUrl });
      const reviewerSdk = new MilestoneProofClient({ baseUrl });

      await devSdk.switchDemoPersona({ userId: 'dev_01' });
      await reviewerSdk.switchDemoPersona({ userId: 'reviewer_01' });

      // Submit & evaluate Milestone 1 (developer claims CI status = SUCCESS)
      const { submission } = await devSdk.submitMilestoneEvidence('ms_seed_01', {
        demoFixtureKey: 'SUCCESSFUL_SUBMISSION',
      } as unknown as Parameters<typeof devSdk.submitMilestoneEvidence>[1]);
      await reviewerSdk.evaluateMilestoneEvidence('ms_seed_01');

      const webhookPayload = {
        action: 'completed',
        repository: {
          full_name: 'cloudbuilders/acme-oauth-gateway',
        },
        workflow_run: {
          id: 9041,
          status: 'completed',
          conclusion: 'failure',
          head_sha: submission.commitSha,
        },
      };
      const rawBody = JSON.stringify(webhookPayload);

      // 1. Reject invalid HMAC-SHA256 signature (401 INVALID_GITHUB_WEBHOOK_SIGNATURE)
      await assert.rejects(
        async () => {
          await reviewerSdk.handleGitHubWebhook(
            {
              'X-GitHub-Delivery': 'deliv_bad_sig_01',
              'X-GitHub-Event': 'workflow_run',
              'X-Hub-Signature-256': signGitHubWebhook('wrong_secret', rawBody),
            },
            webhookPayload
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 401);
          assert.equal(err.code, 'INVALID_GITHUB_WEBHOOK_SIGNATURE');
          return true;
        }
      );

      // Ensure rejected webhook did NOT mutate submission provenance status
      assert.equal(
        container.evidenceRepo.findById(submission.id)?.provenanceStatus,
        'UNVERIFIED_UNAVAILABLE'
      );

      // 2. Simulate transient DB error during webhook processing -> rolls back and marks FAILED, then succeeds on retry!
      const origUpdateProvenance = container.evidenceRepo.updateProvenanceStatus.bind(
        container.evidenceRepo
      );
      let failOnce = true;
      container.evidenceRepo.updateProvenanceStatus = (id, status) => {
        if (failOnce) {
          failOnce = false;
          throw new Error('SIMULATED_SQLITE_WEBHOOK_TRANSIENT_FAILURE');
        }
        return origUpdateProvenance(id, status);
      };

      const validSignature = signGitHubWebhook(webhookSecret, rawBody);

      await assert.rejects(
        async () => {
          await reviewerSdk.handleGitHubWebhook(
            {
              'X-GitHub-Delivery': 'deliv_valid_01',
              'X-GitHub-Event': 'workflow_run',
              'X-Hub-Signature-256': validSignature,
            },
            webhookPayload
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 500);
          return true;
        }
      );

      const failedEventRecord =
        container.githubWebhookRepo.findByDeliveryId('deliv_valid_01');
      assert.equal(failedEventRecord?.processingStatus, 'FAILED');

      // 3. Retry the failed delivery ID 'deliv_valid_01' -> succeeds and reconciles provenance to MISMATCH_DETECTED!
      const retryAck = await reviewerSdk.handleGitHubWebhook(
        {
          'X-GitHub-Delivery': 'deliv_valid_01',
          'X-GitHub-Event': 'workflow_run',
          'X-Hub-Signature-256': validSignature,
        },
        webhookPayload
      );
      assert.equal(retryAck.verified, true);
      assert.equal(retryAck.duplicate, false);
      assert.equal(retryAck.status, 'RECONCILED_PROVENANCE_MISMATCH');
      assert.equal(retryAck.matchedSubmissionId, submission.id);

      // Submission provenance status is now MISMATCH_DETECTED because webhook proved workflow_run 9041 failed!
      assert.equal(
        container.evidenceRepo.findById(submission.id)?.provenanceStatus,
        'MISMATCH_DETECTED'
      );

      // 4. Duplicate and concurrent duplicate webhook deliveries are idempotently ignored
      const [dupAck1, dupAck2] = await Promise.all([
        reviewerSdk.handleGitHubWebhook(
          {
            'X-GitHub-Delivery': 'deliv_valid_01',
            'X-GitHub-Event': 'workflow_run',
            'X-Hub-Signature-256': validSignature,
          },
          webhookPayload
        ),
        reviewerSdk.handleGitHubWebhook(
          {
            'X-GitHub-Delivery': 'deliv_valid_01',
            'X-GitHub-Event': 'workflow_run',
            'X-Hub-Signature-256': validSignature,
          },
          webhookPayload
        ),
      ]);
      assert.equal(dupAck1.duplicate, true);
      assert.equal(dupAck1.status, 'DUPLICATE_IGNORED');
      assert.equal(dupAck2.duplicate, true);
      assert.equal(dupAck2.status, 'DUPLICATE_IGNORED');

      // 5. Reviewer approval is now blocked because the authentic GitHub webhook exposed the failed workflow run!
      await assert.rejects(
        async () => {
          await reviewerSdk.submitHumanReview('ms_seed_01', {
            decision: 'APPROVE',
            approvedAmountCents: 250000,
            justification: 'Attempting to approve after GitHub webhook exposed failed CI run',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'EVIDENCE_PROVENANCE_MISMATCH_BLOCKS_APPROVAL');
          return true;
        }
      );

      // 6. Verify entire SHA-256 hash-chained audit log integrity across all Phase 7 events
      const chainVerification = await reviewerSdk.verifyAuditHashChain();
      assert.equal(chainVerification.valid, true);
      assert.ok(chainVerification.verifiedCount >= 8);
    } finally {
      await close();
    }
  });

  it('5. Comprehensive GitHub Artifact Edge Cases: API timeout, HTTP 429 rate-limit, closed-unmerged PR, wrong-repo PR, still-running workflow (PENDING), and workflow API 503', async () => {
    let mode:
      | 'API_TIMEOUT'
      | 'RATE_LIMIT_429'
      | 'CLOSED_UNMERGED_PR'
      | 'STILL_RUNNING_WORKFLOW'
      | 'WORKFLOW_API_503'
      | 'COMMIT_DIFFERENT_REPO_FILES' = 'API_TIMEOUT';

    const mockGitHubFetch: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (mode === 'API_TIMEOUT') {
        const abortErr = new Error('The operation was aborted due to timeout');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      if (mode === 'RATE_LIMIT_429') {
        return new Response(
          JSON.stringify({ message: 'API rate limit exceeded' }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'x-ratelimit-remaining': '0',
            },
          }
        );
      }

      if (url === 'https://api.github.com/repos/cloudbuilders/acme-oauth-gateway') {
        return new Response(
          JSON.stringify({
            id: 1001,
            full_name: 'cloudbuilders/acme-oauth-gateway',
            private: false,
            default_branch: 'main',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/commits/')) {
        return new Response(
          JSON.stringify({
            sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            commit: {
              committer: { name: 'Marcus Vance', date: '2026-04-02T10:15:00.000Z' },
              message: 'feat(oauth): implement OAuth2 token exchange',
            },
            files:
              mode === 'COMMIT_DIFFERENT_REPO_FILES'
                ? [{ filename: 'unrelated/foreignFile.ts' }]
                : [
                    { filename: 'src/oauth/tokenExchange.ts' },
                    { filename: 'src/oauth/sessionStore.ts' },
                    { filename: 'src/__tests__/oauth.spec.ts' },
                  ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/pulls/42')) {
        if (mode === 'CLOSED_UNMERGED_PR') {
          // Closed PR where merged=false must NOT be treated as MERGED!
          return new Response(
            JSON.stringify({
              number: 42,
              state: 'closed',
              merged: false,
              merged_at: null,
              head: {
                ref: 'release/milestone-1-oauth2',
                sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
              },
              base: { ref: 'main' },
              merge_commit_sha: null,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            number: 42,
            state: 'closed',
            merged: true,
            merged_at: '2026-04-02T11:00:00.000Z',
            head: {
              ref: 'release/milestone-1-oauth2',
              sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            },
            base: { ref: 'main' },
            merge_commit_sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      if (url.includes('/actions/runs/9041')) {
        if (mode === 'WORKFLOW_API_503') {
          return new Response(JSON.stringify({ message: 'Service Unavailable' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (mode === 'STILL_RUNNING_WORKFLOW') {
          return new Response(
            JSON.stringify({
              id: 9041,
              name: 'MilestoneProof CI Pipeline',
              status: 'in_progress',
              conclusion: null,
              head_sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
              head_branch: 'release/milestone-1-oauth2',
              event: 'pull_request',
              created_at: '2026-04-02T10:16:00.000Z',
              updated_at: '2026-04-02T10:19:00.000Z',
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            id: 9041,
            name: 'MilestoneProof CI Pipeline',
            status: 'completed',
            conclusion: 'success',
            head_sha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
            head_branch: 'release/milestone-1-oauth2',
            event: 'pull_request',
            created_at: '2026-04-02T10:16:00.000Z',
            updated_at: '2026-04-02T10:20:00.000Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    };

    const { baseUrl, close } = await startTestServer({
      githubOptions: {
        githubToken: 'test-only-fake-github-api-token-edge-cases',
        fetchImpl: mockGitHubFetch,
      },
    });

    try {
      const devSdk = new MilestoneProofClient({ baseUrl });
      const reviewerSdk = new MilestoneProofClient({ baseUrl });
      await devSdk.switchDemoPersona({ userId: 'dev_01' });
      await reviewerSdk.switchDemoPersona({ userId: 'reviewer_01' });

      await devSdk.submitMilestoneEvidence('ms_seed_01', {
        demoFixtureKey: 'SUCCESSFUL_SUBMISSION',
      } as unknown as Parameters<typeof devSdk.submitMilestoneEvidence>[1]);

      // Scenario 6: GitHub API timeout -> UNAVAILABLE (never fabricated VERIFIED)
      mode = 'API_TIMEOUT';
      const { provenance: timeoutProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(timeoutProv.overallStatus, 'UNVERIFIED_UNAVAILABLE');
      assert.equal(timeoutProv.verificationStatus, 'UNAVAILABLE');
      assert.equal(timeoutProv.repository.status, 'UNAVAILABLE');

      // Scenario 7: GitHub API rate limit (429) -> UNAVAILABLE
      mode = 'RATE_LIMIT_429';
      const { provenance: rateLimitProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(rateLimitProv.overallStatus, 'UNVERIFIED_UNAVAILABLE');
      assert.equal(rateLimitProv.verificationStatus, 'UNAVAILABLE');
      assert.equal(rateLimitProv.repository.status, 'UNAVAILABLE');

      // Scenario 29: Unavailable GitHub verification cannot produce automatic PASS -> downgrades to NEEDS_HUMAN_REVIEW
      const { evaluation: unavailEval } =
        await reviewerSdk.evaluateMilestoneEvidence('ms_seed_01');
      assert.equal(
        unavailEval.arbitratorRecommendation.recommendedOutcome,
        'NEEDS_HUMAN_REVIEW',
        'Unavailable GitHub verification must prevent automatic PASS and require human review'
      );
      assert.equal(
        unavailEval.arbitratorRecommendation.recommendation,
        'RECOMMEND_HOLD'
      );

      // Scenario 5: Commit changed files mismatch
      mode = 'COMMIT_DIFFERENT_REPO_FILES';
      const { provenance: diffFilesProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(diffFilesProv.commit.status, 'MISMATCH');
      assert.equal(diffFilesProv.commit.changedFilesMatchSubmitted, false);
      assert.equal(diffFilesProv.overallStatus, 'MISMATCH_DETECTED');
      assert.equal(diffFilesProv.verificationStatus, 'FAILED');

      // Scenario 11: Closed but unmerged PR is detected as CLOSED (MISMATCH against claimed MERGED)
      mode = 'CLOSED_UNMERGED_PR';
      const { provenance: closedUnmergedProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(closedUnmergedProv.pullRequest.actualPrStatus, 'CLOSED');
      assert.equal(closedUnmergedProv.pullRequest.merged, false);
      assert.equal(closedUnmergedProv.pullRequest.status, 'MISMATCH');
      assert.equal(closedUnmergedProv.overallStatus, 'MISMATCH_DETECTED');
      assert.equal(closedUnmergedProv.verificationStatus, 'FAILED');

      // Scenario 15: Still-running workflow (`in_progress`) -> PENDING and blocks premature approval
      mode = 'STILL_RUNNING_WORKFLOW';
      const { provenance: pendingWfProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(pendingWfProv.workflowRun.status, 'PENDING');
      assert.equal(pendingWfProv.workflowRun.runStatus, 'in_progress');
      assert.equal(pendingWfProv.overallStatus, 'PENDING');
      assert.equal(pendingWfProv.verificationStatus, 'PENDING');
      assert.equal(pendingWfProv.eligibleForBoundaryReview, false);

      const { evaluation: pendingEval } =
        await reviewerSdk.evaluateMilestoneEvidence('ms_seed_01');
      assert.equal(
        pendingEval.arbitratorRecommendation.recommendedOutcome,
        'NEEDS_HUMAN_REVIEW'
      );
      assert.equal(pendingEval.policyCalculation.gateBlocked, true);
      assert.equal(pendingEval.policyCalculation.permittedAmountCents, 0);

      await assert.rejects(
        async () => {
          await reviewerSdk.submitHumanReview('ms_seed_01', {
            decision: 'APPROVE',
            approvedAmountCents: 250000,
            justification: 'Attempting to approve while workflow run is still PENDING',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'EVIDENCE_PROVENANCE_MISMATCH_BLOCKS_APPROVAL');
          return true;
        }
      );

      // Scenario 16: Workflow API unavailable (503) -> PARTIALLY_VERIFIED / UNAVAILABLE
      mode = 'WORKFLOW_API_503';
      const { provenance: wf503Prov } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(wf503Prov.repository.status, 'VERIFIED');
      assert.equal(wf503Prov.commit.status, 'VERIFIED');
      assert.equal(wf503Prov.pullRequest.status, 'VERIFIED');
      assert.equal(wf503Prov.workflowRun.status, 'UNAVAILABLE');
      assert.equal(wf503Prov.verificationStatus, 'UNAVAILABLE');

      // Scenario 20: Historical verification attempts are preserved in provenanceHistory
      const { provenanceHistory } =
        await reviewerSdk.getMilestoneEvidenceProvenance('ms_seed_01');
      assert.equal(provenanceHistory.length, 6);
      assert.ok(
        provenanceHistory.every((rec) => Array.isArray(rec.results) && rec.results.length === 5)
      );

      // Scenario 9: PR from wrong repository is rejected with MISMATCH
      await devSdk.submitMilestoneEvidence('ms_seed_03', {
        demoFixtureKey: 'SUSPICIOUS_CONTRADICTORY_SUBMISSION',
      } as unknown as Parameters<typeof devSdk.submitMilestoneEvidence>[1]);
      const { provenance: wrongRepoPrProv } =
        await reviewerSdk.verifyMilestoneEvidenceProvenance('ms_seed_03');
      assert.equal(wrongRepoPrProv.pullRequest.belongsToRepository, false);
      assert.equal(wrongRepoPrProv.pullRequest.status, 'MISMATCH');
      assert.equal(wrongRepoPrProv.overallStatus, 'MISMATCH_DETECTED');
      assert.equal(wrongRepoPrProv.verificationStatus, 'FAILED');
    } finally {
      await close();
    }
  });

  it('6. Canonical SHA-256 Evidence Hashing, Raw Body Webhook Tamper Protection & Out-of-Order Event Guard', async () => {
    // Scenarios 17 & 18: Canonical SHA-256 deterministic equivalence and collision sensitivity
    const basePayload = {
      milestoneId: 'ms_seed_01',
      attemptNumber: 1,
      submittedBy: 'dev_01',
      repoUrl: '  https://github.com/cloudbuilders/acme-oauth-gateway  ',
      branch: ' main ',
      commitSha: 'A8F4C219E03D7B6451298CE7F0039A1B2C4D5E6F',
      prUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway/pull/42',
      prStatus: 'MERGED' as const,
      ciReport: {
        provider: 'GITHUB_ACTIONS' as const,
        runId: '9041',
        runUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway/actions/runs/9041',
        status: 'SUCCESS' as const,
        totalTests: 48,
        passedTests: 48,
        failedTests: 0,
        coveragePct: 91.5,
        durationMs: 42100,
        changedFiles: ['src/oauth/tokenExchange.ts', 'src/oauth/sessionStore.ts'],
        logSummary: 'All 48 tests passed',
      },
      securityScan: {
        scanner: 'Snyk',
        scannerVersion: '1.1290.0',
        status: 'COMPLETED' as const,
        findings: [],
        scannedAt: '2026-04-02T10:18:00.000Z',
      },
      developerNotes: '  Implemented OAuth2 token exchange  ',
    };

    // Reordered keys, lowercase SHA, already-trimmed strings, and explicit undefined fields
    const equivalentReorderedPayload = {
      developerNotes: 'Implemented OAuth2 token exchange',
      securityScan: {
        scannedAt: '2026-04-02T10:18:00.000Z',
        findings: [],
        status: 'COMPLETED' as const,
        scannerVersion: '1.1290.0',
        scanner: 'Snyk',
      },
      ciReport: {
        logSummary: 'All 48 tests passed',
        changedFiles: ['src/oauth/tokenExchange.ts', 'src/oauth/sessionStore.ts'],
        durationMs: 42100,
        coveragePct: 91.5,
        failedTests: 0,
        passedTests: 48,
        totalTests: 48,
        status: 'SUCCESS' as const,
        runUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway/actions/runs/9041',
        runId: '9041',
        provider: 'GITHUB_ACTIONS' as const,
      },
      prStatus: 'MERGED' as const,
      prUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway/pull/42',
      commitSha: 'a8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
      branch: 'main',
      repoUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway',
      submittedBy: 'dev_01',
      attemptNumber: 1,
      milestoneId: 'ms_seed_01',
    };

    const hashA = computeEvidencePayloadSha256(basePayload);
    const hashB = computeEvidencePayloadSha256(equivalentReorderedPayload);
    assert.equal(
      hashA,
      hashB,
      'Equivalent canonical evidence payloads with reordered keys and normalized strings/SHAs must produce the exact same SHA-256 digest'
    );
    assert.equal(EVIDENCE_HASH_ALGORITHM, 'SHA-256');
    assert.equal(EVIDENCE_CANONICALIZATION_VERSION, 'mpai-evidence-canon-v1');
    assert.equal(
      JSON.stringify(canonicalizeJsonValue({ b: 1, a: 2, c: undefined })),
      JSON.stringify({ a: 2, b: 1 })
    );

    const modifiedPayload = {
      ...equivalentReorderedPayload,
      commitSha: 'b8f4c219e03d7b6451298ce7f0039a1b2c4d5e6f',
    };
    const hashC = computeEvidencePayloadSha256(modifiedPayload);
    assert.notEqual(
      hashA,
      hashC,
      'Different evidence payloads must produce distinct SHA-256 digests'
    );

    // Scenarios 22, 24 & 27: Missing signature (401), modified raw body with old signature (401), and out-of-order stale event protection
    const webhookSecret = 'test-only-github-webhook-hmac-key-rawbody-not-a-secret';
    const { container, baseUrl, close } = await startTestServer({
      githubOptions: {
        githubWebhookSecret: webhookSecret,
      },
    });

    try {
      const devSdk = new MilestoneProofClient({ baseUrl });
      await devSdk.switchDemoPersona({ userId: 'dev_01' });

      const { submission } = await devSdk.submitMilestoneEvidence('ms_seed_01', {
        demoFixtureKey: 'SUCCESSFUL_SUBMISSION',
      } as unknown as Parameters<typeof devSdk.submitMilestoneEvidence>[1]);

      assert.equal(submission.payloadHashAlgorithm, 'SHA-256');
      assert.equal(submission.canonicalizationVersion, 'mpai-evidence-canon-v1');
      assert.ok(submission.payloadHashedAt);

      // Scenario 22: Missing X-Hub-Signature-256 header -> 401 MISSING_GITHUB_WEBHOOK_SIGNATURE
      const missingSigRes = await fetch(`${baseUrl}/webhooks/github`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-GitHub-Delivery': 'deliv_missing_sig_01',
          'X-GitHub-Event': 'workflow_run',
        },
        body: JSON.stringify({ action: 'completed' }),
      });
      assert.equal(missingSigRes.status, 401);
      const missingSigBody = (await missingSigRes.json()) as { error: { code: string } };
      assert.equal(missingSigBody.error.code, 'MISSING_GITHUB_WEBHOOK_SIGNATURE');

      // Scenario 24: Modified raw body with old signature -> 401 INVALID_GITHUB_WEBHOOK_SIGNATURE
      const originalRawJson = JSON.stringify({
        action: 'completed',
        workflow_run: {
          id: 9041,
          status: 'completed',
          conclusion: 'success',
          head_sha: submission.commitSha,
          updated_at: '2026-04-02T12:00:00.000Z',
        },
      });
      const oldSignature = signGitHubWebhook(webhookSecret, originalRawJson);
      const tamperedRawJson = JSON.stringify({
        action: 'completed',
        workflow_run: {
          id: 9041,
          status: 'completed',
          conclusion: 'failure',
          head_sha: submission.commitSha,
          updated_at: '2026-04-02T12:00:00.000Z',
        },
      });

      const tamperedSigRes = await fetch(`${baseUrl}/webhooks/github`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-GitHub-Delivery': 'deliv_tampered_raw_01',
          'X-GitHub-Event': 'workflow_run',
          'X-Hub-Signature-256': oldSignature,
        },
        body: tamperedRawJson,
      });
      assert.equal(tamperedSigRes.status, 401);
      const tamperedSigBody = (await tamperedSigRes.json()) as { error: { code: string } };
      assert.equal(tamperedSigBody.error.code, 'INVALID_GITHUB_WEBHOOK_SIGNATURE');

      // Scenario 27: Out-of-order webhook event protection — newer event (12:00Z, failure) arrives BEFORE older event (11:55Z, in_progress)
      const newerEventBody = JSON.stringify({
        action: 'completed',
        repository: { full_name: 'cloudbuilders/acme-oauth-gateway' },
        workflow_run: {
          id: 9041,
          status: 'completed',
          conclusion: 'failure',
          head_sha: submission.commitSha,
          updated_at: '2026-04-02T12:00:00.000Z',
        },
      });
      const newerRes = await fetch(`${baseUrl}/webhooks/github`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-GitHub-Delivery': 'deliv_newer_1200',
          'X-GitHub-Event': 'workflow_run',
          'X-Hub-Signature-256': signGitHubWebhook(webhookSecret, newerEventBody),
        },
        body: newerEventBody,
      });
      assert.equal(newerRes.status, 200);
      assert.equal(
        container.evidenceRepo.findById(submission.id)?.provenanceStatus,
        'MISMATCH_DETECTED'
      );

      // Now deliver an older out-of-order event (11:55Z, status='completed', conclusion='success') for the same submission
      const olderStaleEventBody = JSON.stringify({
        action: 'completed',
        repository: { full_name: 'cloudbuilders/acme-oauth-gateway' },
        workflow_run: {
          id: 9040,
          status: 'completed',
          conclusion: 'success',
          head_sha: submission.commitSha,
          updated_at: '2026-04-02T11:55:00.000Z',
        },
      });
      const olderRes = await fetch(`${baseUrl}/webhooks/github`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-GitHub-Delivery': 'deliv_older_1155',
          'X-GitHub-Event': 'workflow_run',
          'X-Hub-Signature-256': signGitHubWebhook(webhookSecret, olderStaleEventBody),
        },
        body: olderStaleEventBody,
      });
      assert.equal(olderRes.status, 200);
      const olderJson = (await olderRes.json()) as { status: string };
      assert.equal(
        olderJson.status,
        'IGNORED_OUT_OF_ORDER_STALE_EVENT',
        'Out-of-order older webhook event must be ignored and must not overwrite newer verified state'
      );
      assert.equal(
        container.evidenceRepo.findById(submission.id)?.provenanceStatus,
        'MISMATCH_DETECTED'
      );

      // Scenarios 31 & 32: GitHub webhook and provenance verification NEVER approve milestones or capture PayPal payments
      const ms = container.milestoneRepo.findById('ms_seed_01');
      assert.equal(ms?.status, 'SUBMITTED');
      assert.equal(ms?.paymentStatus, 'NOT_READY');
      assert.equal(container.paymentRepo.listByMilestoneId('ms_seed_01').length, 0);
    } finally {
      await close();
    }
  });
});
