/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  ContractScheduleResponse,
  EvidencePassport,
  EvidenceProvenanceVerificationRecord,
  FinancialLedgerRow,
  MilestoneReviewDetails,
  PayPalTransactionRecord,
  ScheduleRecoveryProposal,
  User,
} from './types/domain';
import { BryntumGanttViewer } from './components/BryntumGanttViewer';
import { EvidencePassportViewer } from './components/EvidencePassportViewer';

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
  const [selectedContractId] = useState<string>('contract_seed_01');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('ms_seed_01');
  const [scheduleData, setScheduleData] = useState<ContractScheduleResponse | null>(null);
  const [reviewDetails, setReviewDetails] = useState<MilestoneReviewDetails | null>(null);
  const [provenanceData, setProvenanceData] = useState<{
    latestProvenance: EvidenceProvenanceVerificationRecord | null;
    provenanceHistory: EvidenceProvenanceVerificationRecord[];
  } | null>(null);
  const [passport, setPassport] = useState<EvidencePassport | null>(null);
  const [paypalTransactions, setPaypalTransactions] = useState<PayPalTransactionRecord[]>([]);
  const [ledgerRows, setLedgerRows] = useState<FinancialLedgerRow[]>([]);
  const [approvedAmountCentsInput, setApprovedAmountCentsInput] = useState<number>(0);
  const [justification, setJustification] = useState<string>('');
  const [scheduleDecisionReason, setScheduleDecisionReason] = useState<string>(
    'Approved +7d recovery window for CI stabilization; contractual budget and acceptance criteria unchanged.'
  );
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

  const refreshAllData = useCallback(
    async (activeToken: string, milestoneId: string, contractId: string) => {
      if (!activeToken) return;
      setLoading(true);
      try {
        const [schedRes, revRes, provRes, ppRes, ledgerRes, passRes] = await Promise.all([
          fetch(`/api/v1/contracts/${contractId}/schedule`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/milestones/${milestoneId}/review`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/milestones/${milestoneId}/evidence/provenance`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/milestones/${milestoneId}/paypal/transactions`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch('/api/v1/ledger', {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
          fetch(`/api/v1/contracts/${contractId}/milestones/${milestoneId}/evidence-passport`, {
            headers: { Authorization: `Bearer ${activeToken}` },
          }),
        ]);

        if (schedRes.ok) {
          const schedJson = (await schedRes.json()) as ContractScheduleResponse;
          setScheduleData(schedJson);
        }
        if (revRes.ok) {
          const revData = (await revRes.json()) as MilestoneReviewDetails;
          setReviewDetails(revData);
          setApprovedAmountCentsInput(revData.policyCalculation?.permittedAmountCents ?? 0);
        }
        if (provRes.ok) {
          const provJson = (await provRes.json()) as {
            latestProvenance: EvidenceProvenanceVerificationRecord | null;
            provenanceHistory: EvidenceProvenanceVerificationRecord[];
          };
          setProvenanceData(provJson);
        }
        if (ppRes.ok) {
          const ppData = (await ppRes.json()) as { transactions: PayPalTransactionRecord[] };
          setPaypalTransactions(ppData.transactions);
        }
        if (ledgerRes.ok) {
          const ledgerData = (await ledgerRes.json()) as { rows: FinancialLedgerRow[] };
          setLedgerRows(ledgerData.rows);
        }
        if (passRes.ok) {
          const passData = (await passRes.json()) as { passport: EvidencePassport };
          setPassport(passData.passport);
        }
      } catch (err) {
        setStatusBanner({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load workbench data',
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
      void refreshAllData(token, selectedMilestoneId, selectedContractId);
    }
  }, [token, selectedMilestoneId, selectedContractId, refreshAllData]);

  const handleLoadControlTowerDemoScenario = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/contracts/${selectedContractId}/schedule/demo-scenario`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to load Control Tower demo scenario');
      }
      setScheduleData(data.schedule);
      setStatusBanner({
        type: 'success',
        message:
          'Loaded Bryntum Control Tower 3-Milestone Demo: M1 Completed (100%), M2 Failed CI & Overdue, M3 Blocked by Dependency + AI Schedule Recovery Proposal generated.',
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to load demo scenario',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeScheduleRisk = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/contracts/${selectedContractId}/schedule/analyze-risk`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          referenceTimeIso: '2026-11-23T12:00:00.000Z',
          recoveryDays: 7,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to analyze schedule risk');
      }
      setScheduleData(data.schedule);
      setStatusBanner({
        type: 'success',
        message: `AI Schedule-Risk Analysis complete: ${data.createdProposals.length} recovery proposal(s) ready for fiduciary review.`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Schedule risk analysis failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReviewScheduleProposal = async (
    proposal: ScheduleRecoveryProposal,
    decision: 'APPROVE' | 'REJECT'
  ) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/contracts/${selectedContractId}/schedule/proposals/${proposal.id}/review`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            reason: scheduleDecisionReason,
            referenceTimeIso: '2026-11-23T12:00:00.000Z',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Schedule proposal review failed');
      }
      setScheduleData(data.schedule);
      setStatusBanner({
        type: 'success',
        message: `Schedule proposal ${proposal.id} ${decision}D. Downstream Finish-to-Start dependencies recalculated; contractual budget (${formatUsdCents(proposal.preservesContractualAmountCents)}) unchanged.`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Schedule proposal review error',
      });
    } finally {
      setLoading(false);
    }
  };

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
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
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
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Evaluation error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGitHubProvenance = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/evidence/verify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'GitHub provenance verification failed');
      }
      const prov = data.provenance as EvidenceProvenanceVerificationRecord;
      setStatusBanner({
        type:
          prov.verificationStatus === 'VERIFIED'
            ? 'success'
            : prov.verificationStatus === 'FAILED'
              ? 'error'
              : 'info',
        message: `Independent GitHub Provenance Verification: status=${prov.verificationStatus ?? prov.overallStatus} (mode=${prov.verificationMode}, SHA-256 integrity=${prov.integrity.payloadHashMatches ? 'MATCH' : 'TAMPERED'}).`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'GitHub provenance verification error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValidateRuntime = async (previewUrl: string, healthEndpoint?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/contracts/${selectedContractId}/milestones/${selectedMilestoneId}/evidence-passport/runtime-validate`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ previewUrl, healthEndpoint }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Runtime smoke validation failed');
      }
      setStatusBanner({
        type: data.runtimeValidation.overallStatus === 'PASSED' ? 'success' : 'error',
        message: `Runtime Validation (${data.runtimeValidation.overallStatus}): ${data.runtimeValidation.details}`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Runtime validation error',
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
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Review error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalAction = async (step: 'order' | 'authorize' | 'capture') => {
    if (!token) return;
    setLoading(true);
    try {
      const requestId = `ppreq_${selectedMilestoneId}_${step}_${Date.now()}`;
      const res = await fetch(`/api/v1/milestones/${selectedMilestoneId}/paypal/${step}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
          'PayPal-Request-Id': requestId,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message ?? `PayPal ${step} failed`);
      }
      setStatusBanner({
        type: 'success',
        message: `PayPal Orders API v2 (${step.toUpperCase()}) succeeded: status=${data.transaction.status} [PayPal-Request-Id: ${requestId}]`,
      });
      await refreshAllData(token, selectedMilestoneId, selectedContractId);
    } catch (err) {
      setStatusBanner({
        type: 'error',
        message: err instanceof Error ? err.message : `PayPal ${step} error`,
      });
    } finally {
      setLoading(false);
    }
  };

  const latestSub = reviewDetails?.latestSubmission;
  const latestEval = reviewDetails?.latestEvaluation;
  const policy = reviewDetails?.policyCalculation;
  const latestTx = paypalTransactions[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Persona Switcher */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              MilestoneProof AI — Evidence-to-Settlement Control Tower
            </h1>
            <p className="text-sm text-slate-400">
              Primary Sponsor Integrations: Bryntum Gantt Delivery Control Tower • APIMatic Validated OpenAPI & SDK • PayPal Orders API v2
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

        {/* PRIMARY SPONSOR INTEGRATION A: BRYNTUM GANTT SOFTWARE DELIVERY CONTROL TOWER */}
        <section className="bg-slate-900 border border-indigo-900/80 rounded-lg p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
                  SPONSOR INTEGRATION A • BRYNTUM GANTT
                </span>
                <h2 className="text-lg font-bold text-white">
                  Evidence-Aware Software Delivery Control Tower
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Synchronized with backend milestones, Finish-to-Start dependencies (type=2), Baseline vs. Actual variance, Critical Path, and Human-Controlled Schedule Recovery.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={loading}
                onClick={() => void handleLoadControlTowerDemoScenario()}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                Load 3-Milestone Risk & Recovery Demo
              </button>
              <button
                disabled={loading}
                onClick={() => void handleAnalyzeScheduleRisk()}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200"
              >
                Run AI Schedule-Risk Advisor
              </button>
            </div>
          </div>

          {scheduleData && (
            <>
              {/* Control Tower KPI Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Tasks</div>
                  <div className="text-base font-bold text-white">
                    {scheduleData.summary.totalMilestones}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Completed</div>
                  <div className="text-base font-bold text-emerald-400">
                    {scheduleData.summary.completedCount}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Overdue / CI Fail</div>
                  <div className="text-base font-bold text-rose-400">
                    {scheduleData.summary.overdueCount}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Blocked by Dep</div>
                  <div className="text-base font-bold text-amber-400">
                    {scheduleData.summary.blockedByDependencyCount}
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Critical Path</div>
                  <div className="text-base font-bold text-indigo-400">
                    {scheduleData.summary.criticalPathCount} tasks
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Pending Proposals</div>
                  <div className="text-base font-bold text-amber-300">
                    {scheduleData.summary.pendingProposalsCount}
                  </div>
                </div>
              </div>

              {/* Genuine Bryntum Gantt Delivery Control Tower */}
              <div className="pt-2">
                <BryntumGanttViewer
                  schedule={scheduleData}
                  tasks={scheduleData.tasks}
                  dependencies={scheduleData.dependencies}
                  readOnly={true}
                  height="440px"
                />
              </div>

              {/* Human-Controlled Schedule Recovery Proposals */}
              {scheduleData.proposals.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-semibold text-amber-300">
                    AI Schedule-Risk Recovery Proposals (Human Fiduciary Approval Required)
                  </h3>
                  {scheduleData.proposals.map((prop) => (
                    <div
                      key={prop.id}
                      className="p-4 rounded bg-slate-950 border border-amber-800/70 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-white">
                          Proposal {prop.id} — {prop.milestoneTitle} (+{prop.delayDays}d recovery shift)
                        </div>
                        <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-amber-950 text-amber-300 border border-amber-700">
                          {prop.status}
                        </span>
                      </div>
                      <p className="text-slate-300">{prop.aiRationale}</p>
                      <div className="text-[11px] font-mono text-slate-400">
                        Supporting Evidence IDs:{' '}
                        {prop.supportingEvidenceIds.join(', ') || 'None uploaded'} | Downstream
                        Cascades:{' '}
                        {prop.downstreamCascades
                          .map(
                            (c) =>
                              `${c.milestoneId} (${c.previousEndDate.slice(0, 10)} → ${c.proposedEndDate.slice(0, 10)})`
                          )
                          .join(', ') || 'None'}
                      </div>

                      {prop.status === 'PENDING' && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                          <input
                            type="text"
                            value={scheduleDecisionReason}
                            onChange={(e) => setScheduleDecisionReason(e.target.value)}
                            className="flex-1 min-w-[260px] px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                            placeholder="Fiduciary reason for approving/rejecting schedule recovery..."
                          />
                          <button
                            disabled={loading}
                            onClick={() => void handleReviewScheduleProposal(prop, 'APPROVE')}
                            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white"
                          >
                            Approve Schedule Recovery (Client/Reviewer)
                          </button>
                          <button
                            disabled={loading}
                            onClick={() => void handleReviewScheduleProposal(prop, 'REJECT')}
                            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 font-semibold text-white"
                          >
                            Reject Proposal
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

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

        {/* Main Review & PayPal Settlement Grid */}
        {reviewDetails && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Column 1: Milestone & Evidence Summary */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">1. Evidence Summary</h2>
                <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-slate-800 text-indigo-300 border border-slate-700">
                  {reviewDetails.stateMachineStatus}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium">{reviewDetails.milestone.title}</p>
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
                <p className="text-xs text-slate-500 italic">No delivery evidence submitted yet.</p>
              )}

              <div className="pt-2 space-y-2">
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
                    Submit Demo Evidence
                  </button>
                  <button
                    disabled={loading || !latestSub}
                    onClick={() => void handleVerifyGitHubProvenance()}
                    className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-xs rounded font-medium text-white"
                  >
                    Verify GitHub Provenance
                  </button>
                  <button
                    disabled={loading || !latestSub}
                    onClick={() => void handleRunEvaluation()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs rounded font-medium"
                  >
                    Run AI Evaluation
                  </button>
                </div>
              </div>
            </section>

            {/* Column 2: AI Findings & Risk Flags (Advisory Only) */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">2. AI Findings</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-700">
                  ADVISORY ONLY
                </span>
              </div>

              {latestEval ? (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <div className="font-semibold text-slate-200">
                      Outcome:{' '}
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
                      Evidence ({latestEval.evidenceAnalysis.verifiedCount}/
                      {latestEval.evidenceAnalysis.totalCount} Verified)
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
                      Risk Severity:{' '}
                      <span className="font-mono text-rose-300">
                        {latestEval.riskAnalysis.overallRiskSeverity}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Run Multi-Agent Evaluation to view findings.
                </p>
              )}
            </section>

            {/* Column 3: Deterministic Policy & Human Review Actions */}
            <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
              <h2 className="text-base font-semibold text-white">3. Policy & Human Review</h2>

              {policy ? (
                <div className="p-3 rounded bg-slate-950 border border-slate-800 text-xs font-mono space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Milestone Budget:</span>
                    <span>{formatUsdCents(policy.agreedAmountCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Late Penalty ({policy.lateDays}d):</span>
                    <span>-{formatUsdCents(policy.latePenaltyCents)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold text-emerald-400">
                    <span>Permitted Cap:</span>
                    <span>{formatUsdCents(policy.permittedAmountCents)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Policy calculation pending evaluation.
                </p>
              )}

              <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Approved Amount (Cents, max{' '}
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
                    Justification (min 5 chars):
                  </label>
                  <textarea
                    rows={2}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Document reason for review decision..."
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
                    Approve
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

            {/* Column 4: Primary Sponsor Integration B — PayPal Orders API v2 & APIMatic */}
            <section className="bg-slate-900 border border-emerald-900/80 rounded-lg p-5 space-y-4">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                  SPONSOR B • APIMATIC & PAYPAL v2
                </span>
                <h2 className="text-base font-semibold text-white mt-1">
                  4. PayPal Orders API v2 Settlement
                </h2>
                <p className="text-[11px] text-slate-400">
                  intent: AUTHORIZE (Non-Escrow Hold) → Human Approval Gate → Idempotent Capture
                </p>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                <div>Payment State: {reviewDetails.milestone.paymentStatus}</div>
                {latestTx && (
                  <>
                    <div>Order ID: {latestTx.paypalOrderId ?? '—'}</div>
                    <div>Auth ID: {latestTx.paypalAuthorizationId ?? '—'}</div>
                    <div>Capture ID: {latestTx.paypalCaptureId ?? '—'}</div>
                    <div className="text-emerald-400">
                      Captured: {formatUsdCents(latestTx.capturedAmountCents)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Mode: {latestTx.executionMode}
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <button
                  disabled={loading}
                  onClick={() => void handlePayPalAction('order')}
                  className="w-full px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium text-white"
                >
                  1. Create PayPal Order (CLIENT • AUTHORIZE)
                </button>
                <button
                  disabled={loading}
                  onClick={() => void handlePayPalAction('authorize')}
                  className="w-full px-3 py-1.5 rounded bg-indigo-700 hover:bg-indigo-600 font-medium text-white"
                >
                  2. Authorize PayPal Order (CLIENT • 29d Hold)
                </button>
                <button
                  disabled={loading || reviewDetails.milestone.status !== 'APPROVED'}
                  onClick={() => void handlePayPalAction('capture')}
                  className="w-full px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-semibold text-white"
                >
                  3. Capture Approved Settlement (Requires APPROVE)
                </button>
              </div>

              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                APIMatic Contract:{' '}
                <a
                  href="/api/v1/openapi.yaml"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  /api/v1/openapi.yaml
                </a>{' '}
                • SDK: <code className="text-slate-300">src/sdk/MilestoneProofClient.ts</code>
              </div>
            </section>
          </div>
        )}

        {/* PROMPT 2/8: Evidence Passport — Traceable Engineering Evidence Record */}
        {reviewDetails && (
          <EvidencePassportViewer
            passport={passport}
            loading={loading}
            onRefresh={() => void refreshAllData(token, selectedMilestoneId, selectedContractId)}
            onValidateRuntime={handleValidateRuntime}
          />
        )}

        {/* Phase 7: Evidence Provenance & Independent GitHub Verification Panel */}
        {reviewDetails && (
          <section className="bg-slate-900 border border-sky-900/80 rounded-lg p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-950 text-sky-300 border border-sky-700">
                    PHASE 7 • GITHUB API & SHA-256 PROVENANCE
                  </span>
                  <h2 className="text-base font-bold text-white">
                    Independent Evidence Provenance & Canonical Integrity Verification
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifies Repository, Commit SHA, Pull Request merge state, and GitHub Actions workflow run against GitHub REST API + deterministic SHA-256 payload digest (mpai-evidence-canon-v1).
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const prov = provenanceData?.latestProvenance ?? reviewDetails.latestProvenance;
                  const statusLabel =
                    prov?.verificationStatus ??
                    prov?.overallStatus ??
                    latestSub?.provenanceStatus ??
                    'UNAVAILABLE';
                  const badgeStyle =
                    statusLabel === 'VERIFIED'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : statusLabel === 'FAILED' ||
                          statusLabel === 'MISMATCH_DETECTED' ||
                          statusLabel === 'TAMPERED_PAYLOAD'
                        ? 'bg-rose-950 text-rose-300 border-rose-700'
                        : statusLabel === 'PENDING'
                          ? 'bg-amber-950 text-amber-300 border-amber-700'
                          : 'bg-slate-800 text-slate-300 border-slate-700';
                  return (
                    <span className={`px-2.5 py-1 rounded text-xs font-mono border ${badgeStyle}`}>
                      Status: {statusLabel}
                    </span>
                  );
                })()}
                <button
                  disabled={loading || !latestSub}
                  onClick={() => void handleVerifyGitHubProvenance()}
                  className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-xs font-semibold text-white"
                >
                  Re-Verify via GitHub API
                </button>
              </div>
            </div>

            {(() => {
              const prov = provenanceData?.latestProvenance ?? reviewDetails.latestProvenance;
              if (!latestSub) {
                return (
                  <p className="text-xs text-slate-500 italic">
                    Submit delivery evidence on this milestone to inspect canonical SHA-256 integrity and GitHub API provenance.
                  </p>
                );
              }
              return (
                <div className="space-y-3 text-xs">
                  {/* Canonical SHA-256 Integrity Bar */}
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 font-mono flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-slate-300">
                        Canonical SHA-256 Digest ({latestSub.canonicalizationVersion ?? 'mpai-evidence-canon-v1'}):{' '}
                        <span className="text-sky-300">{latestSub.payloadSha256 ?? '—'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Hashed At: {latestSub.payloadHashedAt ?? latestSub.submittedAt} • Verification Attempts:{' '}
                        {provenanceData?.provenanceHistory.length ?? (prov ? 1 : 0)}
                        {prov ? ` • Last Verified: ${prov.verifiedAt} (${prov.verificationMode})` : ''}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] border ${
                        prov
                          ? prov.integrity.payloadHashMatches
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : 'bg-rose-950 text-rose-300 border-rose-700'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      {prov
                        ? prov.integrity.payloadHashMatches
                          ? 'SHA-256 INTEGRITY VERIFIED'
                          : 'TAMPER DETECTED'
                        : 'HASH RECORDED'}
                    </span>
                  </div>

                  {/* 4 Artifact Provenance Cards */}
                  {prov && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-semibold text-white">Repository</span>
                          <span className="text-[11px] text-sky-300">{prov.repository.status}</span>
                        </div>
                        <div className="truncate text-slate-300">
                          {prov.repository.canonicalFullName ??
                            `${prov.repository.owner}/${prov.repository.repo}`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          {prov.repository.details}
                        </div>
                      </div>

                      <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-semibold text-white">Commit</span>
                          <span className="text-[11px] text-sky-300">{prov.commit.status}</span>
                        </div>
                        <div className="truncate text-slate-300">
                          SHA: {(prov.commit.canonicalSha ?? prov.commit.submittedSha).slice(0, 12)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          {prov.commit.details}
                        </div>
                      </div>

                      <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-semibold text-white">Pull Request</span>
                          <span className="text-[11px] text-sky-300">{prov.pullRequest.status}</span>
                        </div>
                        <div className="truncate text-slate-300">
                          PR #{prov.pullRequest.prNumber ?? '—'} ({prov.pullRequest.actualPrStatus ?? '—'})
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          {prov.pullRequest.details}
                        </div>
                      </div>

                      <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-sans font-semibold text-white">GitHub Actions</span>
                          <span className="text-[11px] text-sky-300">{prov.workflowRun.status}</span>
                        </div>
                        <div className="truncate text-slate-300">
                          Run #{prov.workflowRun.runId ?? '—'} ({prov.workflowRun.conclusion ?? prov.workflowRun.runStatus ?? '—'})
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          {prov.workflowRun.details}
                        </div>
                      </div>
                    </div>
                  )}

                  {prov && prov.blockingReasons.length > 0 && (
                    <div className="p-3 rounded bg-rose-950/50 border border-rose-800 text-rose-200 space-y-1">
                      <div className="font-semibold">Provenance Blocking Reasons:</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {prov.blockingReasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
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
                <span className="font-semibold text-white">{reviewDetails.milestone.title}</span>.
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
            5. Financial Decision Intelligence Ledger (Audit-Traceable)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3">Milestone</th>
                  <th className="py-2 px-3">State</th>
                  <th className="py-2 px-3">Payment Status</th>
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
                    <td className="py-2.5 px-3 text-indigo-300">
                      {row.paymentStatus}
                      {row.paymentExecutionMode && row.paymentExecutionMode !== 'NONE' && (
                        <span className="ml-1.5 text-[10px] text-slate-400">
                          [{row.paymentExecutionMode}]
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">{row.aiRecommendation}</td>
                    <td className="py-2.5 px-3">{formatUsdCents(row.agreedAmountCents)}</td>
                    <td className="py-2.5 px-3">{formatUsdCents(row.permittedAmountCents)}</td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      {formatUsdCents(row.approvedAmountCents)}
                    </td>
                    <td className="py-2.5 px-3">
                      {row.paymentEligible ? 'ELIGIBLE' : 'BLOCKED'}
                    </td>
                    <td className="py-2.5 pl-3 text-slate-400">
                      {row.auditEventCount} events ({row.latestAuditEntryHash?.slice(0, 10) ?? '—'}
                      …)
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
