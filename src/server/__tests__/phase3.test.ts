import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServerApp, type HttpApp } from '../index.ts';
import { DEMO_EVIDENCE_FIXTURES } from '../services/DemoEvidenceFixtures.ts';
import {
  GeminiHttpEvaluator,
  type MultiAgentEvaluatorProvider,
} from '../services/EvaluationService.ts';
import type {
  EvaluationRun,
  EvidenceSubmission,
  Milestone,
} from '../../types/domain.ts';

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

describe('Phase 3 — Evidence Intelligence Engine, Multi-Agent AI Evaluation & Financial Safety Boundary', () => {
  it('1. validates GitHub evidence ingestion, enforces DEVELOPER RBAC, rejects invalid URLs/SHAs, and tracks attempt history', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const clientToken = container.authService.demoSwitch({ userId: 'client_01' }).token;
      const devToken = container.authService.demoSwitch({ userId: 'dev_01' }).token;

      // 1a. CLIENT role is blocked from submitting evidence (403 FORBIDDEN_ROLE)
      const clientSubmitRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: DEMO_EVIDENCE_FIXTURES.SUCCESSFUL_SUBMISSION.payload,
      });
      assert.equal(clientSubmitRes.status, 403);
      assert.equal(clientSubmitRes.body.error.code, 'FORBIDDEN_ROLE');

      // 1b. Invalid GitHub repo URL rejected
      const badRepoRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: {
          ...DEMO_EVIDENCE_FIXTURES.SUCCESSFUL_SUBMISSION.payload,
          repoUrl: 'http://gitlab.com/not-github/repo',
        },
      });
      assert.equal(badRepoRes.status, 400);
      assert.equal(badRepoRes.body.error.code, 'INVALID_GITHUB_REPO_URL');

      // 1c. Invalid commit SHA rejected
      const badShaRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: {
          ...DEMO_EVIDENCE_FIXTURES.SUCCESSFUL_SUBMISSION.payload,
          commitSha: 'not-a-valid-hex-sha!',
        },
      });
      assert.equal(badShaRes.status, 400);
      assert.equal(badShaRes.body.error.code, 'INVALID_COMMIT_SHA');

      // 1d. Invalid PR URL rejected
      const badPrRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: {
          ...DEMO_EVIDENCE_FIXTURES.SUCCESSFUL_SUBMISSION.payload,
          prUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway/issues/42',
        },
      });
      assert.equal(badPrRes.status, 400);
      assert.equal(badPrRes.body.error.code, 'INVALID_PULL_REQUEST_URL');

      // 1e. Valid evidence submission #1 succeeds and transitions milestone to SUBMITTED
      const validSub1 = await sendRequest<{ submission: EvidenceSubmission }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: DEMO_EVIDENCE_FIXTURES.SUCCESSFUL_SUBMISSION.payload,
      });
      assert.equal(validSub1.status, 201);
      assert.equal(validSub1.body.submission.attemptNumber, 1);
      assert.equal(validSub1.body.submission.canonicalReferences?.length, 4);

      const msAfterSub1 = container.milestoneRepo.findById('ms_seed_01')!;
      assert.equal(msAfterSub1.status, 'SUBMITTED');

      // 1f. Second submission increments attemptNumber to 2 and preserves submission history
      const validSub2 = await sendRequest<{ submission: EvidenceSubmission }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: { demoFixtureKey: 'SUCCESSFUL_SUBMISSION' },
      });
      assert.equal(validSub2.status, 201);
      assert.equal(validSub2.body.submission.attemptNumber, 2);

      const historyRes = await sendRequest<{ submissions: EvidenceSubmission[] }>(
        container.app,
        {
          method: 'GET',
          path: '/api/v1/milestones/ms_seed_01/evidence',
          headers: { Authorization: `Bearer ${clientToken}` },
        }
      );
      assert.equal(historyRes.status, 200);
      assert.equal(historyRes.body.submissions.length, 2);
      assert.equal(historyRes.body.submissions[0].attemptNumber, 1);
      assert.equal(historyRes.body.submissions[1].attemptNumber, 2);
    } finally {
      container.db.close();
    }
  });

  it('2. executes reproducible 3-milestone demo scenario: PASS (complete), NEEDS_HUMAN_REVIEW (missing evidence), and FAIL (suspicious/contradictory)', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const devToken = container.authService.demoSwitch({ userId: 'dev_01' }).token;
      const reviewerToken = container.authService.demoSwitch({ userId: 'reviewer_01' }).token;

      // Verify seeded contract has 3 milestones totaling $8,500.00 (850000 cents)
      const seededContract = container.contractService.getContractById('contract_seed_01');
      assert.equal(seededContract.totalBudgetCents, 850000);
      assert.equal(seededContract.milestones?.length, 3);

      // --- MILESTONE 1 (ms_seed_01): Complete & Valid Evidence -> PASS ---
      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: { demoFixtureKey: 'SUCCESSFUL_SUBMISSION' },
      });

      const eval1Res = await sendRequest<{ evaluation: EvaluationRun }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evaluate',
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });
      assert.equal(eval1Res.status, 200);
      const eval1 = eval1Res.body.evaluation;
      assert.equal(eval1.isMockEvaluation, true);
      assert.equal(eval1.evaluationMode, 'DETERMINISTIC_MOCK');
      assert.equal(eval1.evidenceAnalysis.verifiedCount, 2);
      assert.equal(eval1.evidenceAnalysis.totalCount, 2);
      assert.equal(eval1.evidenceAnalysis.missingEvidence.length, 0);
      assert.equal(eval1.riskAnalysis.overallRiskSeverity, 'NONE');
      assert.equal(eval1.arbitratorRecommendation.recommendedOutcome, 'PASS');
      assert.equal(eval1.arbitratorRecommendation.recommendation, 'RECOMMEND_APPROVAL');
      assert.equal(eval1.arbitratorRecommendation.isAdvisoryOnly, true);
      assert.equal(eval1.policyCalculation.permittedAmountCents, 250000);
      assert.equal(eval1.policyCalculation.gateBlocked, false);

      // Strict financial boundary check on Milestone 1: AI PASS must NOT set status to APPROVED or SETTLED
      const ms1AfterEval: Milestone = container.milestoneRepo.findById('ms_seed_01')!;
      assert.equal(ms1AfterEval.status, 'PENDING_REVIEW');
      assert.equal(ms1AfterEval.paymentStatus, 'NOT_READY');

      // --- MILESTONE 2 (ms_seed_02): Incomplete Evidence (Unmerged PR + Missing Security Scan) -> NEEDS_HUMAN_REVIEW ---
      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_02/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: { demoFixtureKey: 'INCOMPLETE_SUBMISSION' },
      });

      const eval2Res = await sendRequest<{ evaluation: EvaluationRun }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_02/evaluate',
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });
      assert.equal(eval2Res.status, 200);
      const eval2 = eval2Res.body.evaluation;
      assert.equal(eval2.evidenceAnalysis.verifiedCount, 1);
      assert.equal(eval2.evidenceAnalysis.totalCount, 2);
      assert.ok(eval2.evidenceAnalysis.missingEvidence.length >= 1);
      assert.equal(eval2.riskAnalysis.scannerStatus, 'UNAVAILABLE');
      assert.equal(eval2.riskAnalysis.overallRiskSeverity, 'MEDIUM');
      assert.equal(eval2.arbitratorRecommendation.recommendedOutcome, 'NEEDS_HUMAN_REVIEW');
      assert.equal(eval2.arbitratorRecommendation.recommendation, 'RECOMMEND_HOLD');
      assert.ok(eval2.arbitratorRecommendation.disagreements.length >= 1);
      // Policy engine blocks payout because requireSecurityScan=true and scannerStatus=UNAVAILABLE
      assert.equal(eval2.policyCalculation.gateBlocked, true);
      assert.equal(eval2.policyCalculation.permittedAmountCents, 0);

      // --- MILESTONE 3 (ms_seed_03): Suspicious & Contradictory Evidence -> FAIL ---
      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_03/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: { demoFixtureKey: 'SUSPICIOUS_CONTRADICTORY_SUBMISSION' },
      });

      const eval3Res = await sendRequest<{ evaluation: EvaluationRun }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_03/evaluate',
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });
      assert.equal(eval3Res.status, 200);
      const eval3 = eval3Res.body.evaluation;
      assert.equal(eval3.evidenceAnalysis.verifiedCount, 0);
      assert.equal(eval3.riskAnalysis.overallRiskSeverity, 'CRITICAL');
      assert.equal(eval3.riskAnalysis.criticalVulnCount, 1);
      assert.equal(eval3.riskAnalysis.ciBuildPassed, false);
      assert.ok(eval3.riskAnalysis.contradictions.length >= 2);
      assert.equal(eval3.arbitratorRecommendation.recommendedOutcome, 'FAIL');
      assert.equal(eval3.arbitratorRecommendation.recommendation, 'RECOMMEND_REJECTION');
      assert.equal(eval3.policyCalculation.gateBlocked, true);
      assert.equal(eval3.policyCalculation.permittedAmountCents, 0);
    } finally {
      container.db.close();
    }
  });

  it('3. detects and neutralizes adversarial prompt-injection attempts in repository evidence', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const devToken = container.authService.demoSwitch({ userId: 'dev_01' }).token;

      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_03/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: DEMO_EVIDENCE_FIXTURES.PROMPT_INJECTION_SUBMISSION.payload,
      });

      const evalRes = await sendRequest<{ evaluation: EvaluationRun }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_03/evaluate',
        headers: { Authorization: `Bearer ${devToken}` },
      });

      assert.equal(evalRes.status, 200);
      const evaluation = evalRes.body.evaluation;
      assert.equal(evaluation.riskAnalysis.promptInjectionDetected, true);
      assert.ok(
        evaluation.riskAnalysis.promptInjectionIndicators.includes(
          'INSTRUCTION_OVERRIDE_ATTEMPT'
        )
      );
      assert.ok(
        evaluation.riskAnalysis.promptInjectionIndicators.includes(
          'XML_TAG_BREAKOUT_ATTEMPT'
        )
      );
      assert.ok(
        evaluation.riskAnalysis.promptInjectionIndicators.includes(
          'UNAUTHORIZED_PAYMENT_COMMAND'
        )
      );
      assert.equal(evaluation.riskAnalysis.overallRiskSeverity, 'CRITICAL');
      assert.equal(evaluation.arbitratorRecommendation.recommendedOutcome, 'FAIL');
      assert.equal(evaluation.arbitratorRecommendation.recommendation, 'RECOMMEND_REJECTION');
      assert.equal(evaluation.policyCalculation.permittedAmountCents, 0);

      // Confirm milestone was NOT approved and payment status remains NOT_READY
      const ms = container.milestoneRepo.findById('ms_seed_03')!;
      assert.equal(ms.status, 'PENDING_REVIEW');
      assert.equal(ms.paymentStatus, 'NOT_READY');
    } finally {
      container.db.close();
    }
  });

  it('4. enforces financial safety boundary, strips untrusted AI evidence IDs, and handles malformed output & unavailable Gemini safely', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const devUser = container.userRepo.findById('dev_01')!;
      container.evidenceService.submitDemoFixture(devUser, 'ms_seed_01', 'SUCCESSFUL_SUBMISSION');

      // 4a. Compromised/malicious AI output attempting to set approvedAmountCents or milestoneStatus is blocked
      const boundaryViolatingProvider: MultiAgentEvaluatorProvider = {
        mode: 'LIVE_GEMINI',
        modelName: 'gemini-2.5-flash-compromised-test',
        async runEvidenceAnalyst() {
          return {
            agentName: 'EvidenceAgent',
            model: 'gemini-2.5-flash',
            criteriaResults: [
              {
                criterionId: 'AC-1',
                status: 'VERIFIED',
                confidence: 0.99,
                evidenceCitations: ['ev_hallucinated_999'],
                explanation: 'Verified',
              },
            ],
            verifiedCount: 1,
            totalCount: 2,
          };
        },
        async runRiskAnalyst() {
          return {
            agentName: 'RiskAgent',
            model: 'gemini-2.5-flash',
            overallRiskSeverity: 'NONE',
            criticalVulnCount: 0,
            highVulnCount: 0,
            ciBuildPassed: true,
          };
        },
        async runReviewSynthesizer() {
          return {
            agentName: 'ArbitratorAgent',
            model: 'gemini-2.5-flash',
            recommendedOutcome: 'PASS',
            approvedAmountCents: 250000, // PROHIBITED AUTHORITY FIELD
            milestoneStatus: 'APPROVED', // PROHIBITED AUTHORITY FIELD
          };
        },
      };

      container.evaluationService.setEvaluatorProvider(boundaryViolatingProvider);

      await assert.rejects(
        () => container.evaluationService.evaluateMilestone(devUser, 'ms_seed_01'),
        (err: unknown) => (err as { code?: string }).code === 'AI_FINANCIAL_BOUNDARY_VIOLATION'
      );

      // Milestone status must roll back to SUBMITTED after failed evaluation
      assert.equal(container.milestoneRepo.findById('ms_seed_01')?.status, 'SUBMITTED');

      // 4b. Malformed AI output schema is rejected with 422 INVALID_AI_OUTPUT_SCHEMA
      const malformedProvider: MultiAgentEvaluatorProvider = {
        mode: 'LIVE_GEMINI',
        modelName: 'gemini-2.5-flash',
        async runEvidenceAnalyst() {
          return 'NOT_AN_OBJECT_JSON';
        },
        async runRiskAnalyst() {
          return {};
        },
        async runReviewSynthesizer() {
          return {};
        },
      };
      container.evaluationService.setEvaluatorProvider(malformedProvider);

      await assert.rejects(
        () => container.evaluationService.evaluateMilestone(devUser, 'ms_seed_01'),
        (err: unknown) => (err as { code?: string }).code === 'INVALID_AI_OUTPUT_SCHEMA'
      );

      // 4c. Unavailable Gemini credentials handled safely with 503 GEMINI_UNAVAILABLE and recorded in audit trail
      const unavailableGemini = new GeminiHttpEvaluator({ apiKey: '' });
      container.evaluationService.setEvaluatorProvider(unavailableGemini);

      await assert.rejects(
        () => container.evaluationService.evaluateMilestone(devUser, 'ms_seed_01'),
        (err: unknown) => (err as { code?: string }).code === 'GEMINI_UNAVAILABLE'
      );

      // 4d. Hallucinated evidence IDs in AI response are stripped out, preserving only canonical IDs
      const hallucinatingCitationProvider: MultiAgentEvaluatorProvider = {
        mode: 'LIVE_GEMINI',
        modelName: 'gemini-2.5-flash',
        async runEvidenceAnalyst({ submission }) {
          return {
            agentName: 'EvidenceAgent',
            model: 'gemini-2.5-flash',
            criteriaResults: [
              {
                criterionId: 'AC-1',
                status: 'VERIFIED',
                confidence: 0.95,
                evidenceCitations: [
                  `ev_commit_${submission.id}`,
                  'ev_fake_ai_invented_id_999',
                  'https://evil.example/fake-proof',
                ],
                explanation: 'Verified commit.',
              },
              {
                criterionId: 'AC-2',
                status: 'VERIFIED',
                confidence: 0.95,
                evidenceCitations: [`ev_ci_${submission.id}`],
                explanation: 'Verified CI.',
              },
            ],
            verifiedCount: 2,
            totalCount: 2,
            missingEvidence: [],
            factualObservations: ['Observed valid commit and CI'],
          };
        },
        async runRiskAnalyst() {
          return {
            agentName: 'RiskAgent',
            model: 'gemini-2.5-flash',
            overallRiskSeverity: 'NONE',
            criticalVulnCount: 0,
            highVulnCount: 0,
            ciBuildPassed: true,
            suspiciousSignals: [],
            contradictions: [],
            missingTestSignals: [],
            summary: 'Clean scan.',
          };
        },
        async runReviewSynthesizer() {
          return {
            agentName: 'ArbitratorAgent',
            model: 'gemini-2.5-flash',
            recommendedOutcome: 'PASS',
            disagreements: [],
            rationale: 'All criteria verified.',
          };
        },
      };

      container.evaluationService.setEvaluatorProvider(hallucinatingCitationProvider);
      const cleanEval = await container.evaluationService.evaluateMilestone(
        devUser,
        'ms_seed_01'
      );
      assert.deepEqual(cleanEval.evidenceAnalysis.criteriaResults[0].evidenceCitations, [
        `ev_commit_${cleanEval.submissionId}`,
      ]);

      // 4e. Verify audit trail integrity across all EVIDENCE_SUBMITTED, EVALUATION_STARTED, EVALUATION_FAILED, and EVALUATION_COMPLETED events
      const auditLogs = container.auditService.listLogs({ milestoneId: 'ms_seed_01' });
      const actions = auditLogs.map((l) => l.action);
      assert.ok(actions.includes('EVIDENCE_SUBMITTED'));
      assert.ok(actions.includes('EVALUATION_STARTED'));
      assert.ok(actions.includes('EVALUATION_FAILED'));
      assert.ok(actions.includes('EVALUATION_COMPLETED'));

      const chainVerification = container.auditService.verifyChain();
      assert.equal(chainVerification.valid, true);
    } finally {
      container.db.close();
    }
  });
});
