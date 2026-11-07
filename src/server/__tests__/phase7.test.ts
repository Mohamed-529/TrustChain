import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServerApp } from '../index.ts';
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
});
