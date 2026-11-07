import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServerApp, type HttpApp } from '../index.ts';
import type {
  EvaluationRun,
  FinancialLedgerRow,
  HumanApprovalRecord,
  MilestoneReviewDetails,
  PolicyCalculationResult,
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

describe('Phase 4 — Settlement Policy Engine, Human Review Workflow & Financial Decision Ledger', () => {
  it('1. calculates deterministic integer-cent policy caps, late penalties, deductions, and blocking reasons without AI influence', () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const policySvc = container.settlementPolicyService;

      // 1a. On-time 100% verified delivery -> 100% permitted ($2,500.00 = 250000c)
      const fullCalc: PolicyCalculationResult = policySvc.calculatePolicy({
        agreedAmountCents: 250000,
        deadlineIso: '2026-11-10T23:59:59.000Z',
        submittedAtIso: '2026-11-08T12:00:00.000Z',
        policyRules: {
          requirePassingCi: true,
          requireSecurityScan: true,
          maxAllowedCriticalVulns: 0,
          maxAllowedHighVulns: 0,
          allowPartialPayout: true,
          latePenaltyDailyBps: 100, // 1% per late day
        },
        verifiedCriteriaCount: 2,
        totalCriteriaCount: 2,
        ciBuildPassed: true,
        criticalVulnCount: 0,
        highVulnCount: 0,
        scannerStatus: 'AVAILABLE',
      });
      assert.equal(fullCalc.gateBlocked, false);
      assert.equal(fullCalc.grossEligibleCents, 250000);
      assert.equal(fullCalc.lateDays, 0);
      assert.equal(fullCalc.latePenaltyCents, 0);
      assert.equal(fullCalc.permittedAmountCents, 250000);

      // 1b. Partial delivery (1/2 criteria) + 3 days late @ 100 bps/day (3% of 250000 = 7500c)
      // Gross = 125000c, Late penalty = 7500c -> Permitted = 117500c
      const partialLateCalc = policySvc.calculatePolicy({
        agreedAmountCents: 250000,
        deadlineIso: '2026-11-10T00:00:00.000Z',
        submittedAtIso: '2026-11-13T00:00:00.000Z',
        policyRules: {
          requirePassingCi: true,
          requireSecurityScan: true,
          maxAllowedCriticalVulns: 0,
          maxAllowedHighVulns: 0,
          allowPartialPayout: true,
          latePenaltyDailyBps: 100,
        },
        verifiedCriteriaCount: 1,
        totalCriteriaCount: 2,
        ciBuildPassed: true,
        criticalVulnCount: 0,
        highVulnCount: 0,
        scannerStatus: 'AVAILABLE',
      });
      assert.equal(partialLateCalc.gateBlocked, false);
      assert.equal(partialLateCalc.grossEligibleCents, 125000);
      assert.equal(partialLateCalc.lateDays, 3);
      assert.equal(partialLateCalc.latePenaltyCents, 7500);
      assert.equal(partialLateCalc.permittedAmountCents, 117500);
      assert.equal(partialLateCalc.deductionCents, 132500);

      // 1c. Partial delivery when allowPartialPayout=false blocks payout ($0.00)
      const blockedPartial = policySvc.calculatePolicy({
        agreedAmountCents: 250000,
        deadlineIso: '2026-11-10T00:00:00.000Z',
        submittedAtIso: '2026-11-09T00:00:00.000Z',
        policyRules: {
          requirePassingCi: true,
          requireSecurityScan: true,
          maxAllowedCriticalVulns: 0,
          maxAllowedHighVulns: 0,
          allowPartialPayout: false,
          latePenaltyDailyBps: 100,
        },
        verifiedCriteriaCount: 1,
        totalCriteriaCount: 2,
        missingEvidenceCount: 1,
        ciBuildPassed: true,
        criticalVulnCount: 0,
        highVulnCount: 0,
        scannerStatus: 'AVAILABLE',
      });
      assert.equal(blockedPartial.gateBlocked, true);
      assert.equal(blockedPartial.permittedAmountCents, 0);
      assert.ok(
        blockedPartial.blockingReasons?.some((r) =>
          r.includes('GATE_PARTIAL_DELIVERY_DISALLOWED')
        )
      );

      // 1d. Rejects non-integer cent amounts and amounts exceeding milestone budget or permitted cap
      const ms1 = container.milestoneRepo.findById('ms_seed_01')!;
      assert.throws(
        () =>
          policySvc.validateApprovedAmount({
            milestone: ms1,
            policyCalculation: partialLateCalc,
            approvedAmountCents: 100.5,
          }),
        (err: unknown) => (err as { code?: string }).code === 'NON_INTEGER_AMOUNT_CENTS'
      );

      assert.throws(
        () =>
          policySvc.validateApprovedAmount({
            milestone: ms1,
            policyCalculation: partialLateCalc,
            approvedAmountCents: 300000, // Exceeds 250000 milestone budget
          }),
        (err: unknown) => (err as { code?: string }).code === 'AMOUNT_EXCEEDS_MILESTONE_BUDGET'
      );

      assert.throws(
        () =>
          policySvc.validateApprovedAmount({
            milestone: ms1,
            policyCalculation: partialLateCalc,
            approvedAmountCents: 120000, // Exceeds 117500 permitted cap
          }),
        (err: unknown) => (err as { code?: string }).code === 'AMOUNT_EXCEEDS_PERMITTED_CAP'
      );
    } finally {
      container.db.close();
    }
  });

  it('2. blocks developer self-approval, unauthorized reviewers, approval without evaluation, and policy bypass', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const devToken = container.authService.demoSwitch({ userId: 'dev_01' }).token;
      const reviewerToken = container.authService.demoSwitch({ userId: 'reviewer_01' }).token;

      // 2a. Approval attempt before evidence/evaluation is rejected (409 EVALUATION_REQUIRED_BEFORE_REVIEW)
      const prematureApprove = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/review/approve',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: {
          approvedAmountCents: 250000,
          justification: 'Attempting premature approval before evaluation.',
        },
      });
      assert.equal(prematureApprove.status, 409);
      assert.equal(prematureApprove.body.error.code, 'EVALUATION_REQUIRED_BEFORE_REVIEW');

      // Submit evidence on ms_seed_01, but do NOT evaluate yet -> still blocked
      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: { demoFixtureKey: 'SUCCESSFUL_SUBMISSION' },
      });

      const subOnlyApprove = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/review/approve',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: {
          approvedAmountCents: 250000,
          justification: 'Attempting approval after submission but before AI evaluation.',
        },
      });
      assert.equal(subOnlyApprove.status, 409);
      assert.equal(subOnlyApprove.body.error.code, 'EVALUATION_REQUIRED_BEFORE_REVIEW');

      // Run evaluation on ms_seed_01 -> transitions to PENDING_REVIEW
      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/evaluate',
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });

      // 2b. Developer attempting self-approval is rejected (403 SELF_APPROVAL_FORBIDDEN)
      const selfApproveRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/review/approve',
        headers: { Authorization: `Bearer ${devToken}` },
        body: {
          approvedAmountCents: 250000,
          justification: 'Developer trying to approve own milestone.',
        },
      });
      assert.equal(selfApproveRes.status, 403);
      assert.equal(selfApproveRes.body.error.code, 'SELF_APPROVAL_FORBIDDEN');

      // 2c. Unassigned third-party reviewer user cannot review someone else's contract
      container.db.raw
        .prepare(
          `INSERT INTO users (id, name, email, password_hash, role, is_active, is_demo_account, created_at)
           VALUES ('reviewer_outsider', 'Outsider Reviewer', 'outsider@example.com', 'none:none', 'REVIEWER', 1, 1, ?)`
        )
        .run(new Date().toISOString());
      const outsiderToken = container.authService.demoSwitch({
        userId: 'reviewer_outsider',
      }).token;

      const outsiderRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/review/approve',
        headers: { Authorization: `Bearer ${outsiderToken}` },
        body: {
          approvedAmountCents: 250000,
          justification: 'Outsider reviewer attempting unauthorized review.',
        },
      });
      assert.equal(outsiderRes.status, 403);
      assert.equal(outsiderRes.body.error.code, 'FORBIDDEN_NOT_AUTHORIZED_REVIEWER');

      // 2d. Amount above permitted amount rejected (400 AMOUNT_EXCEEDS_MILESTONE_BUDGET / AMOUNT_EXCEEDS_PERMITTED_CAP)
      const excessiveRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/review/approve',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: {
          approvedAmountCents: 260000,
          justification: 'Attempting to approve more than permitted cap.',
        },
      });
      assert.equal(excessiveRes.status, 400);
      assert.equal(excessiveRes.body.error.code, 'AMOUNT_EXCEEDS_MILESTONE_BUDGET');

      // 2e. Reviewer cannot bypass contractual policy when gates are blocked (ms_seed_02 incomplete evidence)
      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_02/evidence',
        headers: { Authorization: `Bearer ${devToken}` },
        body: { demoFixtureKey: 'INCOMPLETE_SUBMISSION' },
      });
      await sendRequest(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_02/evaluate',
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });

      const bypassPolicyRes = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_02/review/approve',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: {
          approvedAmountCents: 100000,
          justification: 'Reviewer trying to bypass blocked security scan policy gate.',
        },
      });
      assert.equal(bypassPolicyRes.status, 422);
      assert.equal(bypassPolicyRes.body.error.code, 'POLICY_GATE_BLOCKED');
    } finally {
      container.db.close();
    }
  });

  it('3. enforces state machine transitions (SUBMITTED -> PENDING_REVIEW -> NEEDS_CHANGES / APPROVED / REJECTED), blocks duplicate approval & approval after rejection, and requires rejection reason', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const devToken = container.authService.demoSwitch({ userId: 'dev_01' }).token;
      const reviewerToken = container.authService.demoSwitch({ userId: 'reviewer_01' }).token;
      const clientToken = container.authService.demoSwitch({ userId: 'client_01' }).token;

      // Submit & evaluate ms_seed_01, ms_seed_02, ms_seed_03
      for (const [msId, key] of [
        ['ms_seed_01', 'SUCCESSFUL_SUBMISSION'],
        ['ms_seed_02', 'INCOMPLETE_SUBMISSION'],
        ['ms_seed_03', 'SUSPICIOUS_CONTRADICTORY_SUBMISSION'],
      ] as const) {
        await sendRequest(container.app, {
          method: 'POST',
          path: `/api/v1/milestones/${msId}/evidence`,
          headers: { Authorization: `Bearer ${devToken}` },
          body: { demoFixtureKey: key },
        });
        await sendRequest(container.app, {
          method: 'POST',
          path: `/api/v1/milestones/${msId}/evaluate`,
          headers: { Authorization: `Bearer ${reviewerToken}` },
        });
      }

      // 3a. GET review details returns full context for ms_seed_01
      const detailsRes = await sendRequest<MilestoneReviewDetails>(container.app, {
        method: 'GET',
        path: '/api/v1/milestones/ms_seed_01/review',
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });
      assert.equal(detailsRes.status, 200);
      assert.equal(detailsRes.body.stateMachineStatus, 'PENDING_REVIEW');
      assert.equal(detailsRes.body.allowedActions.canApprove, true);
      assert.equal(detailsRes.body.allowedActions.maxPermittedAmountCents, 250000);

      // 3b. Rejection without reason is blocked (400 REVIEW_REASON_REQUIRED)
      const noReasonReject = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_03/review/reject',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: { justification: '' },
      });
      assert.equal(noReasonReject.status, 400);
      assert.equal(noReasonReject.body.error.code, 'REVIEW_REASON_REQUIRED');

      // 3c. Valid rejection on ms_seed_03 transitions to REJECTED
      const rejectRes = await sendRequest<{
        approval: HumanApprovalRecord;
        milestoneStatus: string;
        stateMachineStatus: string;
      }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_03/review/reject',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: {
          justification:
            'Rejected due to closed mismatched PR #99, 18 failing CI tests, and critical CVE-2026-9901.',
        },
      });
      assert.equal(rejectRes.status, 200);
      assert.equal(rejectRes.body.approval.decision, 'REJECT');
      assert.equal(rejectRes.body.approval.approvedAmountCents, 0);
      assert.equal(rejectRes.body.milestoneStatus, 'REJECTED');

      // 3d. Approval after rejection is strictly blocked (409 REVIEW_LOCKED_AFTER_REJECTION)
      const approveAfterReject = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_03/review/approve',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: {
          approvedAmountCents: 100000,
          justification: 'Trying to approve after milestone was rejected.',
        },
      });
      assert.equal(approveAfterReject.status, 409);
      assert.equal(approveAfterReject.body.error.code, 'REVIEW_LOCKED_AFTER_REJECTION');

      // 3e. Request changes on ms_seed_02 transitions to REVISION_REQUESTED (NEEDS_CHANGES)
      const changesRes = await sendRequest<{
        approval: HumanApprovalRecord;
        milestoneStatus: string;
        stateMachineStatus: string;
      }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_02/review/request-changes',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: {
          justification:
            'Please merge PR #57 and upload the completed osv-scanner security report.',
        },
      });
      assert.equal(changesRes.status, 200);
      assert.equal(changesRes.body.approval.decision, 'REQUEST_REVISIONS');
      assert.equal(changesRes.body.milestoneStatus, 'REVISION_REQUESTED');
      assert.equal(changesRes.body.stateMachineStatus, 'NEEDS_CHANGES');

      // 3f. Valid approval on ms_seed_01 transitions to APPROVED
      const approveRes = await sendRequest<{
        approval: HumanApprovalRecord;
        milestoneStatus: string;
        stateMachineStatus: string;
      }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/review/approve',
        headers: { Authorization: `Bearer ${reviewerToken}` },
        body: {
          approvedAmountCents: 250000,
          justification:
            'Verified all OAuth2 endpoints, merged PR #42, 91.5% test coverage, and zero CVEs.',
        },
      });
      assert.equal(approveRes.status, 200);
      assert.equal(approveRes.body.approval.decision, 'APPROVE');
      assert.equal(approveRes.body.approval.approvedAmountCents, 250000);
      assert.equal(approveRes.body.approval.reviewerId, 'reviewer_01');
      assert.equal(approveRes.body.milestoneStatus, 'APPROVED');

      // 3g. Duplicate approval attempt on ms_seed_01 is blocked (409 DUPLICATE_APPROVAL_FORBIDDEN)
      const duplicateApprove = await sendRequest<{ error: { code: string } }>(container.app, {
        method: 'POST',
        path: '/api/v1/milestones/ms_seed_01/review/approve',
        headers: { Authorization: `Bearer ${clientToken}` },
        body: {
          approvedAmountCents: 250000,
          justification: 'Second duplicate approval attempt.',
        },
      });
      assert.equal(duplicateApprove.status, 409);
      assert.equal(duplicateApprove.body.error.code, 'DUPLICATE_APPROVAL_FORBIDDEN');
    } finally {
      container.db.close();
    }
  });

  it('4. handles concurrent reviews, atomic transaction rollback, and serves audit-traceable Financial Decision Ledger', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    try {
      const devUser = container.userRepo.findById('dev_01')!;
      const reviewerUser = container.userRepo.findById('reviewer_01')!;
      const clientUser = container.userRepo.findById('client_01')!;
      const reviewerToken = container.authService.demoSwitch({ userId: 'reviewer_01' }).token;

      container.evidenceService.submitDemoFixture(devUser, 'ms_seed_01', 'SUCCESSFUL_SUBMISSION');
      const eval1: EvaluationRun = await container.evaluationService.evaluateMilestone(
        reviewerUser,
        'ms_seed_01'
      );

      // 4a. Simulate mid-transaction failure during approval -> verify atomic rollback of human_approvals & milestone status
      assert.throws(() => {
        container.db.withTransaction(() => {
          container.approvalRepo.insert({
            id: 'rev_rollback_test',
            milestoneId: 'ms_seed_01',
            evaluationId: eval1.id,
            reviewerId: 'reviewer_01',
            decision: 'APPROVE',
            approvedAmountCents: 250000,
            isOverride: false,
            justification: 'Should roll back on error.',
            decidedAt: new Date().toISOString(),
          });
          container.milestoneRepo.updateStatus(
            'ms_seed_01',
            'APPROVED',
            new Date().toISOString()
          );
          throw new Error('SIMULATED_APPROVAL_TX_ERROR');
        });
      }, /SIMULATED_APPROVAL_TX_ERROR/);

      assert.equal(container.milestoneRepo.findById('ms_seed_01')?.status, 'PENDING_REVIEW');
      assert.equal(container.approvalRepo.listByMilestoneId('ms_seed_01').length, 0);

      // 4b. Concurrent review attempts on ms_seed_01: exactly 1 succeeds and 1 fails with 409
      const concurrentResults = await Promise.allSettled([
        Promise.resolve().then(() =>
          container.humanReviewService.submitReview(reviewerUser, 'ms_seed_01', {
            decision: 'APPROVE',
            approvedAmountCents: 250000,
            justification: 'Concurrent review attempt #1 by Reviewer.',
          })
        ),
        Promise.resolve().then(() =>
          container.humanReviewService.submitReview(clientUser, 'ms_seed_01', {
            decision: 'APPROVE',
            approvedAmountCents: 250000,
            justification: 'Concurrent review attempt #2 by Client.',
          })
        ),
      ]);

      const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled');
      const rejected = concurrentResults.filter((r) => r.status === 'rejected');
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assert.equal(container.approvalRepo.listByMilestoneId('ms_seed_01').length, 1);

      // 4c. Query Financial Decision Ledger (/api/v1/ledger) and verify audit traceability
      const ledgerRes = await sendRequest<{ rows: FinancialLedgerRow[] }>(container.app, {
        method: 'GET',
        path: '/api/v1/ledger',
        headers: { Authorization: `Bearer ${reviewerToken}` },
      });
      assert.equal(ledgerRes.status, 200);
      assert.equal(ledgerRes.body.rows.length, 3);

      const row1 = ledgerRes.body.rows.find((r) => r.milestoneId === 'ms_seed_01')!;
      assert.equal(row1.milestoneStatus, 'APPROVED');
      assert.equal(row1.stateMachineStatus, 'APPROVED');
      assert.ok(row1.submissionId);
      assert.equal(row1.evaluationId, eval1.id);
      assert.equal(row1.agreedAmountCents, 250000);
      assert.equal(row1.permittedAmountCents, 250000);
      assert.equal(row1.approvedAmountCents, 250000);
      assert.equal(row1.reviewerDecision, 'APPROVE');
      assert.equal(row1.paymentEligible, true);
      assert.ok(row1.auditEventCount >= 4);
      assert.ok(row1.auditTrailIds.length >= 4);
      assert.equal(row1.latestAuditEntryHash?.length, 64);

      // 4d. Verify full audit hash chain integrity across all Phase 1–4 operations
      const chainVerify = container.auditService.verifyChain();
      assert.equal(chainVerify.valid, true);
    } finally {
      container.db.close();
    }
  });
});
