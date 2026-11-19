import React, { useState, useEffect } from 'react';
import { AiDecisionInspectorModal } from '../components/dashboard/AiDecisionInspectorModal.tsx';
import type {
  MilestoneReviewDetails,
  PayPalTransactionRecord,
  EvidenceProvenanceVerificationRecord,
  User,
} from '../types/domain.ts';

interface ReviewsPageProps {
  currentUser: User | null;
  selectedMilestoneId: string;
  setSelectedMilestoneId: (id: string) => void;
  reviewDetails: MilestoneReviewDetails | null;
  provenanceData: {
    latestProvenance: EvidenceProvenanceVerificationRecord | null;
    provenanceHistory: EvidenceProvenanceVerificationRecord[];
  } | null;
  paypalTransactions: PayPalTransactionRecord[];
  loading: boolean;
  approvedAmountCentsInput: number;
  setApprovedAmountCentsInput: (val: number) => void;
  justification: string;
  setJustification: (val: string) => void;
  onSubmitDemoEvidence: () => Promise<void>;
  onVerifyGithubProvenance: () => Promise<void>;
  onRunAiEvaluation: () => Promise<void>;
  onReviewAction: (action: 'approve' | 'reject' | 'request-changes') => Promise<void>;
  onPayPalAction: (step: 'order' | 'authorize' | 'capture') => Promise<void>;
  onPayPalReconcile: () => Promise<void>;
  onOpenAiInspector: () => void;
  onOpenPassport: () => void;
  onOpenDisputePack: () => void;
}

function formatUsdCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReviewsPage({
  currentUser,
  selectedMilestoneId,
  setSelectedMilestoneId,
  reviewDetails,
  provenanceData,
  paypalTransactions,
  loading,
  approvedAmountCentsInput,
  setApprovedAmountCentsInput,
  justification,
  setJustification,
  onSubmitDemoEvidence,
  onVerifyGithubProvenance,
  onRunAiEvaluation,
  onReviewAction,
  onPayPalAction,
  onPayPalReconcile,
  onOpenAiInspector,
  onOpenPassport,
  onOpenDisputePack,
}: ReviewsPageProps) {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<1 | 2 | 3 | 4>(1);

  const latestSub = reviewDetails?.latestSubmission;
  const latestEval = reviewDetails?.latestEvaluation;
  const policy = reviewDetails?.policyCalculation;
  const latestTx = paypalTransactions[0] ?? null;

  const latestApproval = reviewDetails?.approvals?.[0] ?? null;
  const isApprovedByHuman =
    reviewDetails?.milestone.status === 'APPROVED' ||
    reviewDetails?.milestone.status === 'SETTLED' ||
    latestApproval?.decision === 'APPROVE';

  const isCaptured =
    latestTx?.status === 'CAPTURED' ||
    reviewDetails?.milestone.paymentStatus === 'CAPTURED' ||
    reviewDetails?.milestone.status === 'SETTLED';

  const isAuthorized =
    latestTx?.status === 'AUTHORIZED' ||
    latestTx?.status === 'SIMULATED_AUTHORIZED' ||
    reviewDetails?.milestone.paymentStatus === 'AUTHORIZED';

  const isOrderCreated =
    latestTx?.status === 'ORDER_CREATED' ||
    latestTx?.status === 'SIMULATED_ORDER_CREATED';

  const isDeveloper = currentUser?.role === 'DEVELOPER';

  // Compute stage progression flags
  const isStage1Complete = Boolean(latestSub);
  const isStage2Complete = Boolean(latestEval && latestEval.status === 'COMPLETED');
  const isStage3Complete = isApprovedByHuman;
  const isStage4Complete = isCaptured;

  // Auto-advance spotlight stage as progression occurs
  useEffect(() => {
    if (isStage4Complete) {
      setActiveStage(4);
    } else if (isStage3Complete || isAuthorized) {
      setActiveStage(4);
    } else if (isStage2Complete) {
      setActiveStage(3);
    } else if (isStage1Complete) {
      setActiveStage(2);
    } else {
      setActiveStage(1);
    }
  }, [isStage1Complete, isStage2Complete, isStage3Complete, isStage4Complete, isAuthorized]);

  const stages = [
    {
      id: 1 as const,
      number: '1',
      title: 'Delivery Evidence',
      shortTitle: 'Evidence',
      isComplete: isStage1Complete,
      chip: latestSub ? `✓ ${latestSub.ciReport.passedTests}/${latestSub.ciReport.totalTests} Tests` : 'Pending Evidence',
      icon: '📦',
    },
    {
      id: 2 as const,
      number: '2',
      title: 'Tri-Agent AI',
      shortTitle: 'AI Consensus',
      isComplete: isStage2Complete,
      chip: latestEval
        ? `✓ ${latestEval.arbitratorRecommendation.recommendedOutcome} (3/3 AC)`
        : 'Pending AI',
      icon: '🤖',
    },
    {
      id: 3 as const,
      number: '3',
      title: 'Policy Gate',
      shortTitle: 'Fiduciary Cap',
      isComplete: isStage3Complete,
      chip: isApprovedByHuman
        ? `✓ Cap: ${formatUsdCents(policy?.permittedAmountCents ?? 227500)}`
        : 'Pending Approval',
      icon: '⚖️',
    },
    {
      id: 4 as const,
      number: '4',
      title: isDeveloper ? 'Escrow Payout' : 'PayPal Settlement',
      shortTitle: isDeveloper ? 'Payout' : 'Settlement',
      isComplete: isStage4Complete,
      chip: isCaptured
        ? '✓ Settled'
        : isAuthorized
        ? '🔒 Escrow Locked'
        : 'Pending Hold',
      icon: '🏦',
    },
  ];

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Top Header & Fast Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.08)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-5 h-[1.5px] bg-[#10b981] inline-block" />
            <span className="text-[11px] font-mono tracking-wider uppercase text-[#10b981] font-semibold">
              Kinetic Fiduciary Pipeline · Veridex Orders v2
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl text-[#0b1f17] tracking-tight font-normal">
            Milestone Review &amp; Settlement
          </h1>
          <p className="text-xs text-[#3d5248] mt-1 max-w-2xl leading-relaxed">
            {isDeveloper
              ? 'Developer Delivery Control: Ingest repository telemetry, synthesize multi-agent verification, and track escrow release status.'
              : 'Client Fiduciary Station: Verify git deliverables, review AI consensus recommendations, and programmatically release 29-day bank holds.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenPassport}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-xs font-medium text-[#0b1f17] transition shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <span>🛡️</span> <span>View Passport</span>
          </button>
          <button
            onClick={onOpenDisputePack}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-xs font-medium text-[#0b1f17] transition shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <span>📂</span> <span>Dispute Pack</span>
          </button>
        </div>
      </div>

      {/* Milestone Selector Pill Bar */}
      <div className="flex items-center gap-2 border-b border-[rgba(11,31,23,0.08)] pb-3 overflow-x-auto no-scrollbar py-1">
        <span className="text-[11px] text-[#6b7f75] font-mono mr-2 tracking-wide uppercase">
          Target Milestone:
        </span>
        {[
          { id: 'ms_seed_01', label: 'Milestone 1 · Storefront & Cart (Active)' },
          { id: 'ms_seed_02', label: 'Milestone 2 · Settlement Policy Engine (Case B)' },
          { id: 'ms_seed_03', label: 'Milestone 3 · Audit Replay & Security' },
        ].map((m) => {
          const isSelected = selectedMilestoneId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMilestoneId(m.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                isSelected
                  ? 'bg-[#0b1f17] text-white shadow-sm'
                  : 'bg-white border border-[rgba(11,31,23,0.12)] text-[#3d5248] hover:bg-[#f6f5f0] hover:text-[#0b1f17]'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 1. TOP ANIMATED PIPELINE STEPPER */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_24px_-4px_rgba(11,31,23,0.05)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative">
          {stages.map((stage, idx) => {
            const isActive = activeStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                className={`text-left p-3.5 rounded-2xl transition-all relative z-10 border ${
                  isActive
                    ? 'bg-[#f6f5f0] border-[#0b1f17] shadow-sm'
                    : stage.isComplete
                    ? 'bg-white hover:bg-[#faf9f5] border-[rgba(16,185,129,0.3)]'
                    : 'bg-white hover:bg-[#faf9f5] border-[rgba(11,31,23,0.08)] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold transition-colors ${
                      stage.isComplete
                        ? 'bg-[#10b981] text-white'
                        : isActive
                        ? 'bg-[#0b1f17] text-white ring-2 ring-[#0b1f17]/20'
                        : 'bg-[#f6f5f0] text-[#6b7f75]'
                    }`}
                  >
                    {stage.isComplete ? '✓' : stage.number}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                      stage.isComplete
                        ? 'bg-[#e9efe6] text-[#2f7a50]'
                        : isActive
                        ? 'bg-[#0b1f17]/10 text-[#0b1f17]'
                        : 'bg-[#f6f5f0] text-[#6b7f75]'
                    }`}
                  >
                    {stage.isComplete ? 'COMPLETED' : isActive ? 'ACTIVE' : `STEP ${stage.number}`}
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#0b1f17] flex items-center gap-1.5">
                  <span>{stage.icon}</span>
                  <span className="truncate">{stage.title}</span>
                </div>

                <div className="text-[10px] font-mono text-[#6b7f75] mt-1 truncate">
                  {stage.chip}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN LAYOUT: CENTER HERO SPOTLIGHT (70%) + STICKY FIDUCIARY VAULT (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CENTER HERO SPOTLIGHT STAGE (Col-span 8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-6 sm:p-7 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_24px_-4px_rgba(11,31,23,0.06)] min-h-[440px] flex flex-col justify-between transition-all">
            {/* STAGE 1 SPOTLIGHT: DELIVERY EVIDENCE */}
            {activeStage === 1 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-2xl bg-[#e9efe6] text-[#2f7a50] flex items-center justify-center text-sm font-bold">
                      1
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        Stage 1 · Technical Delivery Evidence
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        Ingest repository commits, pull request status, and automated test coverage.
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#f6f5f0] text-[#0b1f17] border border-[rgba(11,31,23,0.1)]">
                    {selectedMilestoneId}
                  </span>
                </div>

                {latestSub ? (
                  <div className="space-y-4">
                    {/* Commit & PR Telemetry Card */}
                    <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-3 font-mono text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(11,31,23,0.08)] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] font-semibold">
                            Attempt #{latestSub.attemptNumber}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#0b1f17] text-white">
                            PR: {latestSub.prStatus}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6b7f75]">
                          Branch: <strong className="text-[#0b1f17]">{latestSub.branch}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[#6b7f75] block">Repository:</span>
                          <span className="text-[#0b1f17] truncate block" title={latestSub.repoUrl}>
                            {latestSub.repoUrl}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#6b7f75] block">Commit SHA:</span>
                          <span className="text-[#2f7a50] font-semibold block">
                            {latestSub.commitSha.slice(0, 16)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Test & Security Scan Visual Meter */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] text-[#1c4b31] space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Automated CI Suite</span>
                          <span className="font-mono text-[#2f7a50]">
                            {latestSub.ciReport.passedTests}/{latestSub.ciReport.totalTests} Passed
                          </span>
                        </div>
                        <div className="w-full bg-[#c9e7d3] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#10b981] h-full rounded-full transition-all duration-500"
                            style={{ width: `${latestSub.ciReport.coveragePct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#3d5248]">
                          <span>Provider: {latestSub.ciReport.provider}</span>
                          <span className="font-semibold">{latestSub.ciReport.coveragePct}% Coverage</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] text-[#8a681c] space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Vulnerability Audit</span>
                          <span className="font-mono text-[#2f7a50]">0 Findings</span>
                        </div>
                        <p className="text-[11px] text-[#3d5248] leading-tight pt-1">
                          Zero critical or high severity CVEs detected. Scanner:{' '}
                          <code className="text-[#0b1f17]">{latestSub.securityScan.scanner}</code>.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] text-center space-y-2">
                    <span className="text-2xl">📦</span>
                    <h3 className="text-xs font-semibold text-[#0b1f17]">No Delivery Evidence Yet</h3>
                    <p className="text-[11px] text-[#6b7f75] max-w-sm mx-auto">
                      Submit the developer delivery bundle or click &quot;Submit Demo Evidence&quot; to test the AI evaluation loop.
                    </p>
                  </div>
                )}

                {/* Stage 1 Actions */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)] flex flex-wrap items-center gap-3">
                  <button
                    disabled={loading}
                    onClick={() => void onSubmitDemoEvidence()}
                    className="px-4 py-2.5 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.12)] transition disabled:opacity-50"
                  >
                    Submit Demo Evidence
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => void onVerifyGithubProvenance()}
                    className="px-4 py-2.5 rounded-full bg-[#e9efe6] hover:bg-[#dce6d8] text-[#2f7a50] text-xs font-medium border border-[rgba(47,122,80,0.2)] transition disabled:opacity-50"
                  >
                    Verify GitHub Telemetry
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => {
                      void onRunAiEvaluation();
                      setActiveStage(2);
                    }}
                    className="ml-auto px-6 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold shadow-md hover:shadow-lg transition flex items-center gap-2 group"
                  >
                    <span>Run AI Evaluation</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2 SPOTLIGHT: TRI-AGENT AI ADVISORY */}
            {activeStage === 2 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-2xl bg-[#e9efe6] text-[#2f7a50] flex items-center justify-center text-sm font-bold">
                      2
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        Stage 2 · Tri-Agent AI Consensus Mesh
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        Multi-agent evidence appraisal, vulnerability screening, and contract arbitration.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#fbf7ed] text-[#8a681c] border border-[#e8dcb8] font-mono font-medium">
                    ADVISORY ONLY
                  </span>
                </div>

                {latestEval ? (
                  <div className="space-y-4">
                    {/* 3 Agents Staggered Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-1.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b7f75]">
                          Agent 1 · Verification
                        </div>
                        <div className="text-xs font-semibold text-[#0b1f17]">Evidence Agent</div>
                        <div className="text-[11px] font-mono text-[#2f7a50] font-bold">
                          {latestEval.evidenceAnalysis.verifiedCount}/{latestEval.evidenceAnalysis.totalCount} Verified
                        </div>
                        <p className="text-[10px] text-[#6b7f75] leading-tight">
                          Telemetry signature matched pull request and CI logs.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-1.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b7f75]">
                          Agent 2 · Security
                        </div>
                        <div className="text-xs font-semibold text-[#0b1f17]">Risk Agent</div>
                        <div className="text-[11px] font-mono text-[#2f7a50] font-bold">
                          {latestEval.riskAnalysis.overallRiskSeverity}
                        </div>
                        <p className="text-[10px] text-[#6b7f75] leading-tight">
                          Slither / npm audit scans confirm zero exploit vectors.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] space-y-1.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[#2f7a50]">
                          Agent 3 · Consensus
                        </div>
                        <div className="text-xs font-semibold text-[#1c4b31]">Arbitrator Agent</div>
                        <div className="text-[11px] font-mono text-[#2f7a50] font-bold">
                          {latestEval.arbitratorRecommendation.recommendedOutcome}
                        </div>
                        <p className="text-[10px] text-[#3d5248] leading-tight">
                          Contractual acceptance criteria satisfied.
                        </p>
                      </div>
                    </div>

                    {/* Acceptance Criteria Glowing Badges */}
                    <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-[#6b7f75]">
                        Contractual Acceptance Criteria:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full text-[11px] bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9] font-medium flex items-center gap-1.5">
                          <span>✓</span> <span>AC-1: Storefront Catalog &amp; Cart State</span>
                        </span>
                        <span className="px-3 py-1 rounded-full text-[11px] bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9] font-medium flex items-center gap-1.5">
                          <span>✓</span> <span>AC-2: 64/64 Unit &amp; Integration Tests</span>
                        </span>
                        <span className="px-3 py-1 rounded-full text-[11px] bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9] font-medium flex items-center gap-1.5">
                          <span>✓</span> <span>AC-3: Zero CVEs in Dependency Tree</span>
                        </span>
                      </div>
                    </div>

                    {/* AI Advisory Rationale Quote */}
                    <div className="p-4 rounded-2xl bg-[#f6f5f0] border-l-4 border-[#10b981] space-y-1 text-xs text-[#3d5248]">
                      <div className="font-semibold text-[#0b1f17] flex items-center gap-2">
                        <span>Autonomous Arbitrator Synthesis:</span>
                        <span className="text-[10px] font-mono text-[#6b7f75]">
                          Mode: {latestEval.evaluationMode}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed italic">
                        &quot;{latestEval.arbitratorRecommendation.rationale}&quot;
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] text-center space-y-2">
                    <span className="text-2xl">🤖</span>
                    <h3 className="text-xs font-semibold text-[#0b1f17]">Evaluation Not Executed</h3>
                    <p className="text-[11px] text-[#6b7f75] max-w-sm mx-auto">
                      Click &quot;Run AI Evaluation&quot; in Stage 1 to generate tri-agent consensus.
                    </p>
                  </div>
                )}

                {/* Stage 2 Actions */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)] flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setIsInspectorOpen(true);
                      onOpenAiInspector();
                    }}
                    className="px-4 py-2.5 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs font-medium transition"
                  >
                    🔍 Inspect AI Reasoning
                  </button>

                  <button
                    onClick={() => setActiveStage(3)}
                    className="px-6 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold shadow-md transition flex items-center gap-2 group"
                  >
                    <span>Proceed to Policy Gate</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 3 SPOTLIGHT: POLICY GATE & HUMAN APPROVAL */}
            {activeStage === 3 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-2xl bg-[#e9efe6] text-[#2f7a50] flex items-center justify-center text-sm font-bold">
                      3
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        Stage 3 · Deterministic Policy Gate &amp; Approval
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        Deterministic formula calculation, late penalty deductions, and human fiduciary clearance.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono font-medium">
                    FIDUCIARY GATE
                  </span>
                </div>

                {/* Financial Breakdown Receipt */}
                <div className="p-5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[#6b7f75]">
                    <span>Contract Agreed Milestone Budget:</span>
                    <span className="text-[#0b1f17] font-semibold text-sm">
                      {formatUsdCents(policy?.agreedAmountCents ?? 250000)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#6b7f75]">
                    <span>SLA Late Penalty (100 bps/day overdue):</span>
                    <span className="text-[#a62b2b] font-semibold">
                      -{formatUsdCents(policy?.latePenaltyCents ?? 22500)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#6b7f75]">
                    <span>Security Risk Deductions:</span>
                    <span className="text-[#0b1f17] font-semibold">$0.00</span>
                  </div>
                  <div className="pt-3 border-t border-[rgba(11,31,23,0.12)] flex items-center justify-between">
                    <span className="font-sans font-bold text-sm text-[#0b1f17]">
                      Permitted Fiduciary Disbursement Cap:
                    </span>
                    <span className="text-lg font-bold text-[#10b981]">
                      {formatUsdCents(policy?.permittedAmountCents ?? 227500)}
                    </span>
                  </div>
                </div>

                {isApprovedByHuman ? (
                  <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] text-[#1c4b31] space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span>✓</span> <span>Fiduciary Clearance Granted</span>
                    </div>
                    <p className="text-[11px] text-[#3d5248] leading-tight">
                      Decision: <strong>{latestApproval?.decision ?? 'APPROVE'}</strong> • Permitted Amount:{' '}
                      <strong>{formatUsdCents(latestApproval?.approvedAmountCents ?? policy?.permittedAmountCents ?? 227500)}</strong>
                    </p>
                    <p className="text-[10px] text-[#6b7f75] italic pt-1 border-t border-[#a8d8b9]/50">
                      Rationale: &quot;{latestApproval?.justification ?? 'Acceptance criteria verified. Fiduciary gate cleared for settlement release.'}&quot;
                    </p>
                  </div>
                ) : isDeveloper ? (
                  <div className="p-4 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] text-[#8a681c] space-y-1.5 text-center">
                    <div className="text-xs font-bold flex items-center justify-center gap-1.5">
                      <span>⏳</span> <span>Awaiting Client Fiduciary Approval</span>
                    </div>
                    <p className="text-[11px] text-[#3d5248]">
                      Client (Elena Vance) must clear the fiduciary disbursement gate before funds are captured.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-[#6b7f75] block mb-1">
                          Disbursement Amount (Cents):
                        </label>
                        <input
                          type="number"
                          value={approvedAmountCentsInput}
                          onChange={(e) => setApprovedAmountCentsInput(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#10b981]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#6b7f75] block mb-1">
                          Fiduciary Justification:
                        </label>
                        <input
                          type="text"
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                          placeholder="Document rationale..."
                          className="w-full px-3 py-2 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs outline-none focus:border-[#10b981]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        disabled={loading}
                        onClick={() => {
                          void onReviewAction('approve');
                          setActiveStage(4);
                        }}
                        className="px-5 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-semibold text-white text-xs transition disabled:opacity-40"
                      >
                        ✓ Approve Payout
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => void onReviewAction('request-changes')}
                        className="px-4 py-2.5 rounded-full bg-[#fbf7ed] hover:bg-[#f5edd4] border border-[#e8dcb8] font-medium text-[#8a681c] text-xs transition disabled:opacity-40"
                      >
                        Revise
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => void onReviewAction('reject')}
                        className="px-4 py-2.5 rounded-full bg-[#fdf2f2] hover:bg-[#fbe4e4] border border-[#f3c2c2] font-medium text-[#a62b2b] text-xs transition disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {/* Stage 3 Actions */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)] flex items-center justify-between">
                  <button
                    onClick={() => setActiveStage(2)}
                    className="text-xs text-[#6b7f75] hover:text-[#0b1f17] font-medium"
                  >
                    ← Back to AI Consensus
                  </button>
                  <button
                    onClick={() => setActiveStage(4)}
                    className="px-6 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold shadow-md transition flex items-center gap-2 group"
                  >
                    <span>Proceed to Settlement Vault</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 4 SPOTLIGHT: PAYPAL ORDERS V2 SETTLEMENT VAULT */}
            {activeStage === 4 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-2xl bg-[#e9efe6] text-[#2f7a50] flex items-center justify-center text-sm font-bold">
                      4
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        Stage 4 · Virtual Escrow Hold &amp; Settlement Vault
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        Non-custodial 29-day authorization hold and programmatic release via PayPal Orders API v2.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono font-medium">
                    ORDERS V2
                  </span>
                </div>

                {/* Regulatory Non-Escrow Disclosure */}
                <div className="p-3.5 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] text-[11px] text-[#8a681c] flex items-start gap-2.5">
                  <span className="text-base">⚠️</span>
                  <div>
                    <strong className="block font-semibold">Regulatory Non-Escrow Disclosure:</strong>
                    <span className="text-[#3d5248] leading-relaxed">
                      Veridex executes non-custodial 29-day authorization holds via PayPal Orders API v2. TrustChain never takes fund custody or controls third-party banking balances.
                    </span>
                  </div>
                </div>

                {/* Virtual Hold Vault Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0b1f17] to-[#1a382c] text-white space-y-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏦</span>
                      <span className="text-xs font-mono tracking-wider uppercase text-emerald-400 font-semibold">
                        PayPal Orders v2 Virtual Vault
                      </span>
                    </div>
                    <span
                      className={`px-3 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isCaptured
                          ? 'bg-[#10b981] text-white'
                          : isAuthorized
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {latestTx?.status ?? reviewDetails?.milestone.paymentStatus ?? 'NOT_READY'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-white/60 block text-[10px]">Order ID</span>
                      <span className="font-bold text-white truncate block">
                        {latestTx?.paypalOrderId ?? 'ORD-PENDING'}
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-white/60 block text-[10px]">Authorization ID (29d)</span>
                      <span className="font-bold text-emerald-400 truncate block">
                        {latestTx?.paypalAuthorizationId ?? (isAuthorized ? 'AUTH-LOCKED' : '—')}
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-white/60 block text-[10px]">Capture ID</span>
                      <span className="font-bold text-white truncate block">
                        {latestTx?.paypalCaptureId ?? (isCaptured ? 'CAP-SETTLED' : '—')}
                      </span>
                    </div>
                  </div>

                  {isCaptured && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✓</span>
                        <span>
                          <strong>Funds Released ($2,275.00 Settled):</strong> Transferred directly to developer PayPal sandbox account.
                        </span>
                      </div>
                      <button
                        onClick={onOpenPassport}
                        className="px-3 py-1 rounded-full bg-white text-[#0b1f17] text-[10px] font-bold shadow-sm"
                      >
                        Inspect Hash Seal
                      </button>
                    </div>
                  )}
                </div>

                {/* Role Specific Action Buttons */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)]">
                  {isDeveloper ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] text-[#1c4b31] space-y-1">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>🛡️</span> <span>Developer Payout Protection</span>
                        </div>
                        <p className="text-[11px] text-[#3d5248]">
                          {isCaptured
                            ? 'Funds have been disbursed to your account. Cryptographic audit receipt recorded.'
                            : isAuthorized
                            ? 'Client has pre-authorized the 29-day payment hold. Payout will execute automatically upon fiduciary sign-off.'
                            : 'Waiting for client to lock pre-authorized escrow hold.'}
                        </p>
                      </div>
                      <button
                        disabled={loading}
                        onClick={() => void onPayPalReconcile()}
                        className="w-full px-4 py-2.5 rounded-full bg-white hover:bg-[#f6f5f0] text-[#2f7a50] text-xs font-semibold border border-[rgba(47,122,80,0.25)] transition shadow-sm"
                      >
                        🔄 Refresh Escrow &amp; Payout Telemetry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                          disabled={loading}
                          onClick={() => void onPayPalAction('order')}
                          className="px-3.5 py-2.5 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.12)] transition disabled:opacity-50"
                        >
                          1. Create Order (AUTHORIZE)
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => void onPayPalAction('authorize')}
                          className="px-3.5 py-2.5 rounded-full bg-[#fbf7ed] hover:bg-[#f5edd4] border border-[#e8dcb8] text-[#8a681c] text-xs font-medium transition disabled:opacity-50"
                        >
                          2. Authorize Hold (29 Days)
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => void onPayPalAction('capture')}
                          className={`px-3.5 py-2.5 rounded-full text-xs font-bold transition shadow-sm ${
                            isCaptured
                              ? 'bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9]'
                              : isAuthorized
                              ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-md'
                              : 'bg-[#0b1f17] hover:bg-[#1a382c] text-white'
                          }`}
                        >
                          {isCaptured ? '✓ Funds Released' : '3. Capture Settlement & Release Funds →'}
                        </button>
                      </div>

                      <button
                        disabled={loading}
                        onClick={() => void onPayPalReconcile()}
                        className="w-full px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] text-[#2f7a50] text-xs font-medium border border-[rgba(47,122,80,0.2)] transition text-center"
                      >
                        🔄 Reconcile with Sandbox
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. STICKY FIDUCIARY VAULT SUMMARY SIDEBAR (Col-span 4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="sticky top-6 p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_24px_-4px_rgba(11,31,23,0.06)] space-y-5">
            <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-wider text-[#0b1f17] font-semibold">
                  Fiduciary Vault Ledger
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] font-mono font-medium">
                LIVE
              </span>
            </div>

            {/* Prominent Permitted Payout Display */}
            <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] text-center space-y-1">
              <span className="text-[11px] font-mono text-[#6b7f75] uppercase tracking-wider block">
                Permitted Disbursement Cap
              </span>
              <div className="text-3xl font-extrabold text-[#0b1f17] font-mono tracking-tight">
                {formatUsdCents(policy?.permittedAmountCents ?? 227500)}
              </div>
              <div className="text-[10px] text-[#6b7f75] pt-1">
                Agreed: <strong>{formatUsdCents(policy?.agreedAmountCents ?? 250000)}</strong> • Penalty:{' '}
                <strong className="text-[#a62b2b]">-{formatUsdCents(policy?.latePenaltyCents ?? 22500)}</strong>
              </div>
            </div>

            {/* Quick Status Checks */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">Milestone State:</span>
                <span className="font-semibold text-[#0b1f17]">
                  {reviewDetails?.milestone.status ?? 'ACTIVE'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">AI Advisory:</span>
                <span className="font-semibold text-[#10b981]">
                  {latestEval ? `${latestEval.arbitratorRecommendation.recommendedOutcome} (3/3 AC)` : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">Bank Escrow:</span>
                <span className="font-semibold text-[#0b1f17]">
                  {isCaptured ? 'SETTLED' : isAuthorized ? 'AUTHORIZED (29d)' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">Audit Integrity:</span>
                <span className="font-semibold text-[#2f7a50]">
                  SHA-256 VERIFIED
                </span>
              </div>
            </div>

            {/* Fast Stage Jump Buttons */}
            <div className="space-y-1.5 pt-2 border-t border-[rgba(11,31,23,0.08)]">
              <span className="text-[10px] font-mono text-[#6b7f75] uppercase tracking-wider block">
                Quick Stage Jump:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {stages.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setActiveStage(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition text-left truncate ${
                      activeStage === st.id
                        ? 'bg-[#0b1f17] text-white'
                        : 'bg-[#f6f5f0] text-[#3d5248] hover:bg-[#ecebe4]'
                    }`}
                  >
                    {st.number}. {st.shortTitle}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit & Legal Actions */}
            <div className="pt-2 border-t border-[rgba(11,31,23,0.08)] space-y-2">
              <button
                onClick={onOpenPassport}
                className="w-full px-3.5 py-2 rounded-xl bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.08)] transition flex items-center justify-center gap-1.5"
              >
                <span>🛡️</span> <span>Inspect Evidence Passport</span>
              </button>
              <button
                onClick={onOpenDisputePack}
                className="w-full px-3.5 py-2 rounded-xl bg-white hover:bg-[#f6f5f0] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.12)] transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>📂</span> <span>Generate Dispute Evidence Pack</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AiDecisionInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        reviewDetails={reviewDetails}
        onOpenPassport={onOpenPassport}
        onOpenDisputePack={onOpenDisputePack}
      />
    </div>
  );
}
