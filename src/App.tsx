/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  FinancialLedgerRow,
  MilestoneReviewDetails,
  User,
} from './types/domain';

function formatUsdCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function App() {
  const [token, setToken] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('ms_seed_01');
  const [reviewDetails, setReviewDetails] = useState<MilestoneReviewDetails | null>(null);
  const [ledgerRows, setLedgerRows] = useState<FinancialLedgerRow[]>([]);
  const [approvedAmountCentsInput, setApprovedAmountCentsInput] = useState<number>(0);
  const [justification, setJustification] = useState<string>('');
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const switchPersona = useCallback(async (userId: string) => {
    try {
      const res = await fetch('/api/v1/auth/demo-switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to switch persona');
      }
      setToken(data.token);
      setCurrentUser(data.user);
      setStatusBanner({
        type: 'info',
        message: `Authenticated as ${data.user.name} (${data.user.role})`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Authentication error',
      });
    }
  }, []);

  const refreshMilestoneAndLedger = useCallback(
    async (activeToken: string, milestoneId: string) => {
      if (!activeToken) return;
      setLoading(true);
      try {
        const [revRes, ledgerRes] = await Promise.all([
          fetch(`/api/v1/milestones/${milestoneId}/review`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch('/api/v1/ledger', {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
        ]);

        if (revRes.ok) {
          const revData = (await revRes.json()) as MilestoneReviewDetails;
          setReviewDetails(revData);
          setApprovedAmountCentsInput(
            revData.policyCalculation?.permittedAmountCents ?? 0
          );
        }
        if (ledgerRes.ok) {
          const ledgerData = (await ledgerRes.json()) as { rows: FinancialLedgerRow[] };
          setLedgerRows(ledgerData.rows);
        }
      } catch (err) {
        setStatusBanner({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load review details',
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void switchPersona('reviewer_01');
  }, [switchPersona]);

  useEffect(() => {
    if (token) {
      void refreshMilestoneAndLedger(token, selectedMilestoneId);
    }
  }, [token, selectedMilestoneId, refreshMilestoneAndLedger]);

  const handleLoadDemoEvidence = async (fixtureKey: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evidence`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ demoFixtureKey: fixtureKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Evidence submission failed');
      }
      setStatusBanner({
        type: 'success',
        message: `Submitted demo evidence attempt #${data.submission.attemptNumber} (${fixtureKey}).`,
      });
      await refreshMilestoneAndLedger(token, selectedMilestoneId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Evidence submission error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evaluate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'AI evaluation failed');
      }
      setStatusBanner({
        type: 'success',
        message: `Multi-Agent evaluation completed: ${data.evaluation.arbitratorRecommendation.recommendedOutcome} (Permitted cap: ${formatUsdCents(data.evaluation.policyCalculation.permittedAmountCents)}).`,
      });
      await refreshMilestoneAndLedger(token, selectedMilestoneId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Evaluation error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (
    actionEndpoint: 'approve' | 'reject' | 'request-changes'
  ) => {
    if (!token) return;
    setLoading(true);
    setShowApproveConfirmModal(false);
    try {
      const res = await fetch(
        `/api/v1/milestones/${selectedMilestoneId}/review/${actionEndpoint}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            evaluationId: reviewDetails?.latestEvaluation?.id,
            approvedAmountCents:
              actionEndpoint === 'approve' ? approvedAmountCentsInput : 0,
            justification,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Review submission failed');
      }
      setStatusBanner({
        type: 'success',
        message: `Recorded human review decision: ${data.approval.decision} (Milestone state: ${data.stateMachineStatus}).`,
      });
      setJustification('');
      await refreshMilestoneAndLedger(token, selectedMilestoneId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Review error',
      });
    } finally {
      setLoading(false);
    }
  };

  const latestSub = reviewDetails?.latestSubmission;
  const latestEval = reviewDetails?.latestEvaluation;
  const policy = reviewDetails?.policyCalculation;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Persona Switcher */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              MilestoneProof AI — Evidence & Fiduciary Review Workbench
            </h1>
            <p className="text-sm text-slate-400">
              Advisory Multi-Agent Evidence Intelligence + Deterministic Integer-Cent Policy Engine
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 mr-2">
              Active Persona:
            </span>
            {[
              { id: 'client_01', label: 'Client (Elena)' },
              { id: 'dev_01', label: 'Developer (Marcus)' },
              { id: 'reviewer_01', label: 'Reviewer (Sophia)' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => void switchPersona(p.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
                  currentUser?.id === p.id
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {statusBanner && (
          <div
            className={`p-3 rounded border text-sm ${
              statusBanner.type === 'error'
                ? 'bg-rose-950/60 border-rose-700 text-rose-200'
                : statusBanner.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                  : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            {statusBanner.message}
          </div>
        )}

        {/* Milestone Selector */}
        <div className="flex flex-wrap gap-3">
          {['ms_seed_01', 'ms_seed_02', 'ms_seed_03'].map((msId, idx) => (
            <button
              key={msId}
              onClick={() => setSelectedMilestoneId(msId)}
              className={`px-4 py-2 rounded border text-sm font-medium ${
                selectedMilestoneId === msId
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Milestone {idx + 1} ({msId})
            </button>
          ))}
        </div>

        {/* Main Review Grid */}
        {reviewDetails && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Milestone & Evidence Summary */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  1. Evidence Summary
                </h2>
                <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-slate-800 text-indigo-300 border border-slate-700">
                  {reviewDetails.stateMachineStatus}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium">
                {reviewDetails.milestone.title}
              </p>
              <p className="text-xs text-slate-400">
                Agreed Budget:{' '}
                <span className="font-mono text-white">
                  {formatUsdCents(reviewDetails.milestone.agreedAmountCents)}
                </span>
              </p>

              {latestSub ? (
                <div className="text-xs space-y-2 bg-slate-950 p-3 rounded border border-slate-800 font-mono">
                  <div>Attempt #{latestSub.attemptNumber}</div>
                  <div className="truncate">Repo: {latestSub.repoUrl}</div>
                  <div>Commit: {latestSub.commitSha.slice(0, 12)}</div>
                  <div>
                    PR Status: <span className="text-amber-300">{latestSub.prStatus}</span>
                  </div>
                  <div>
                    CI: {latestSub.ciReport.status} ({latestSub.ciReport.passedTests}/
                    {latestSub.ciReport.totalTests} passed, {latestSub.ciReport.coveragePct}%)
                  </div>
                  <div>
                    Security Scan: {latestSub.securityScan.scanner} (
                    {latestSub.securityScan.status}, {latestSub.securityScan.findings.length}{' '}
                    findings)
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No delivery evidence submitted yet.
                </p>
              )}

              <div className="pt-2 space-y-2">
                <div className="text-xs text-slate-400">
                  Demo Actions (Developer Persona Required for Evidence):
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={loading}
                    onClick={() =>
                      void handleLoadDemoEvidence(
                        selectedMilestoneId === 'ms_seed_01'
                          ? 'SUCCESSFUL_SUBMISSION'
                          : selectedMilestoneId === 'ms_seed_02'
                            ? 'INCOMPLETE_SUBMISSION'
                            : 'SUSPICIOUS_CONTRADICTORY_SUBMISSION'
                      )
                    }
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded border border-slate-700"
                  >
                    Submit Demo Evidence Fixture
                  </button>
                  <button
                    disabled={loading || !latestSub}
                    onClick={() => void handleRunEvaluation()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs rounded font-medium"
                  >
                    Run Multi-Agent Evaluation
                  </button>
                </div>
              </div>
            </section>

            {/* Column 2: AI Findings & Risk Flags (Advisory Only) */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  2. AI Findings & Risk Flags
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-700">
                  ADVISORY ONLY
                </span>
              </div>

              {latestEval ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="font-semibold text-slate-200">
                      Review Synthesizer Outcome:{' '}
                      <span className="font-mono text-amber-300">
                        {latestEval.arbitratorRecommendation.recommendedOutcome}
                      </span>
                    </div>
                    <p className="text-slate-400">
                      {latestEval.arbitratorRecommendation.rationale}
                    </p>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="font-semibold text-slate-200">
                      Evidence Analyst ({latestEval.evidenceAnalysis.verifiedCount}/
                      {latestEval.evidenceAnalysis.totalCount} Criteria Verified)
                    </div>
                    {latestEval.evidenceAnalysis.missingEvidence.length > 0 && (
                      <ul className="list-disc list-inside text-amber-300 space-y-0.5">
                        {latestEval.evidenceAnalysis.missingEvidence.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="font-semibold text-slate-200">
                      Risk Analyst Severity:{' '}
                      <span className="font-mono text-rose-300">
                        {latestEval.riskAnalysis.overallRiskSeverity}
                      </span>
                    </div>
                    {latestEval.riskAnalysis.contradictions.map((c, i) => (
                      <div key={i} className="text-rose-300">
                        • {c}
                      </div>
                    ))}
                    {latestEval.riskAnalysis.suspiciousSignals.map((s, i) => (
                      <div key={i} className="text-amber-300">
                        • {s}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Run Multi-Agent Evaluation to view Evidence, Risk, and Synthesizer findings.
                </p>
              )}
            </section>

            {/* Column 3: Deterministic Policy & Human Review Actions */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <h2 className="text-lg font-semibold text-white">
                3. Policy Cap & Human Review
              </h2>

              {policy ? (
                <div className="p-3 rounded bg-slate-950 border border-slate-800 text-xs font-mono space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Milestone Budget:</span>
                    <span>{formatUsdCents(policy.agreedAmountCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gross Eligible:</span>
                    <span>{formatUsdCents(policy.grossEligibleCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Late Penalty ({policy.lateDays}d):</span>
                    <span>-{formatUsdCents(policy.latePenaltyCents)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-emerald-400">
                    <span>Permitted Policy Cap:</span>
                    <span>{formatUsdCents(policy.permittedAmountCents)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 font-sans">
                    {policy.formulaExplanation}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Policy calculation pending evaluation.
                </p>
              )}

              {reviewDetails.allowedActions.blockingReasons.length > 0 && (
                <div className="p-3 rounded bg-rose-950/40 border border-rose-800 text-xs text-rose-200 space-y-1">
                  <div className="font-semibold">Blocking Reasons:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {reviewDetails.allowedActions.blockingReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reviewer Inputs */}
              <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Approved Amount (Integer Cents, max{' '}
                    {reviewDetails.allowedActions.maxPermittedAmountCents}c):
                  </label>
                  <input
                    type="number"
                    value={approvedAmountCentsInput}
                    onChange={(e) => setApprovedAmountCentsInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">
                    Reviewer Justification / Reason (required, min 5 chars):
                  </label>
                  <textarea
                    rows={2}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Document reason for approval, revision request, or rejection..."
                    className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    disabled={
                      loading ||
                      !reviewDetails.allowedActions.canApprove ||
                      justification.trim().length < 5
                    }
                    onClick={() => setShowApproveConfirmModal(true)}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-semibold text-white"
                  >
                    Approve Milestone
                  </button>
                  <button
                    disabled={
                      loading ||
                      !reviewDetails.allowedActions.canRequestChanges ||
                      justification.trim().length < 5
                    }
                    onClick={() => void handleReviewAction('request-changes')}
                    className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 font-semibold text-white"
                  >
                    Request Changes
                  </button>
                  <button
                    disabled={
                      loading ||
                      !reviewDetails.allowedActions.canReject ||
                      justification.trim().length < 5
                    }
                    onClick={() => void handleReviewAction('reject')}
                    className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 font-semibold text-white"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Confirmation Modal Before Approval */}
        {showApproveConfirmModal && reviewDetails && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-white">
                Confirm Fiduciary Milestone Approval
              </h3>
              <p className="text-xs text-slate-300">
                You are about to record an authoritative human approval for{' '}
                <span className="font-semibold text-white">
                  {reviewDetails.milestone.title}
                </span>
                .
              </p>
              <div className="p-3 bg-slate-950 rounded border border-slate-800 text-xs font-mono space-y-1">
                <div>
                  Permitted Policy Cap:{' '}
                  {formatUsdCents(reviewDetails.allowedActions.maxPermittedAmountCents)}
                </div>
                <div className="text-emerald-400 font-bold">
                  Approved Payout: {formatUsdCents(approvedAmountCentsInput)} (
                  {approvedAmountCentsInput} cents)
                </div>
                <div>Reason: {justification}</div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowApproveConfirmModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleReviewAction('approve')}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                >
                  Confirm & Sign Approval
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Read-Only Financial Decision Ledger */}
        <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">
            4. Financial Decision Intelligence Ledger (Audit-Traceable)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Milestone</th>
                  <th className="py-2 px-3">State</th>
                  <th className="py-2 px-3">Evidence / Eval</th>
                  <th className="py-2 px-3">AI Advisory</th>
                  <th className="py-2 px-3">Budget</th>
                  <th className="py-2 px-3">Permitted Cap</th>
                  <th className="py-2 px-3">Approved</th>
                  <th className="py-2 px-3">Eligible</th>
                  <th className="py-2 pl-3">Audit Events</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {ledgerRows.map((row) => (
                  <tr key={row.milestoneId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 pr-3 font-sans font-medium text-white">
                      {row.milestoneTitle}
                    </td>
                    <td className="py-2.5 px-3">{row.stateMachineStatus}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {row.submissionId ?? '—'} / {row.evaluationId ?? '—'}
                    </td>
                    <td className="py-2.5 px-3">{row.aiRecommendation}</td>
                    <td className="py-2.5 px-3">{formatUsdCents(row.agreedAmountCents)}</td>
                    <td className="py-2.5 px-3">
                      {formatUsdCents(row.permittedAmountCents)}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      {formatUsdCents(row.approvedAmountCents)}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.paymentEligible ? 'ELIGIBLE' : 'BLOCKED'}
                    </td>
                    <td className="py-2.5 pl-3 text-slate-400">
                      {row.auditEventCount} events (
                      {row.latestAuditEntryHash?.slice(0, 10) ?? '—'}…)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
