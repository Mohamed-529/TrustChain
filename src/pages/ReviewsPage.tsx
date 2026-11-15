import React from 'react';
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
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);
  const latestSub = reviewDetails?.latestSubmission;
  const latestEval = reviewDetails?.latestEvaluation;
  const policy = reviewDetails?.policyCalculation;
  const latestTx = paypalTransactions[0] ?? null;

  const latestApproval = reviewDetails?.approvals?.[0] ?? null;
  const isApprovedByHuman =
    reviewDetails?.milestone.status === 'APPROVED' &&
    latestApproval?.decision === 'APPROVE';

  const isReviewer = currentUser?.role === 'REVIEWER';

  const rawLinks = Array.isArray(latestTx?.rawPaypalResponse?.links)
    ? (latestTx?.rawPaypalResponse?.links as Array<{ rel: string; href: string }>)
    : null;
  const approveLink = rawLinks?.find((l) => l.rel === 'approve' || l.rel === 'payer-action')?.href;

  return (
    <div className="space-y-6 font-sans">
      {/* Cascrow Editorial Kicker & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.08)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-5 h-[1.5px] bg-[#2f7a50] inline-block" />
            <span className="text-[11px] font-mono tracking-wider uppercase text-[#2f7a50] font-semibold">
              Fiduciary Review Workbench
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl text-[#0b1f17] tracking-tight font-normal">
            Milestone Review & Settlement
          </h1>
          <p className="text-xs text-[#3d5248] mt-1 max-w-2xl leading-relaxed">
            Four-stage fiduciary workflow: Evidence Ingestion → AI Advisory Synthesis → Deterministic Settlement Cap → Human Review & PayPal Settlement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPassport}
            className="px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-xs font-medium text-[#0b1f17] transition shadow-sm flex items-center gap-1.5"
          >
            <span>🛡️</span> <span>View Passport</span>
          </button>
          <button
            onClick={onOpenDisputePack}
            className="px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-xs font-medium text-[#0b1f17] transition shadow-sm flex items-center gap-1.5"
          >
            <span>📂</span> <span>Dispute Pack</span>
          </button>
        </div>
      </div>

      {/* Cascrow Milestone Selector Pill Tabs */}
      <div className="flex items-center gap-2 border-b border-[rgba(11,31,23,0.08)] pb-3.5 overflow-x-auto">
        <span className="text-[11px] text-[#6b7f75] font-mono mr-2 tracking-wide uppercase">
          Milestone:
        </span>
        {[
          { id: 'ms_seed_01', label: 'Milestone 1 · OAuth2 Microservice (Complete)' },
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

      {/* 4-Column Operational Workbench in Cascrow Warm Editorial Containers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Column 1: Submitted Evidence Details */}
        <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] space-y-4 text-xs flex flex-col justify-between shadow-[0_4px_20px_-2px_rgba(11,31,23,0.05)]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-2.5">
              <span className="font-normal text-[#0b1f17] text-sm tracking-tight">1. Delivery Evidence</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono font-medium">
                {selectedMilestoneId}
              </span>
            </div>

            <div>
              <div className="text-[#6b7f75] text-[11px]">Milestone Title:</div>
              <div className="text-[#0b1f17] text-xs font-semibold pt-0.5">
                {reviewDetails?.milestone.title ?? 'Loading...'}
              </div>
            </div>

            <div>
              <div className="text-[#6b7f75] text-[11px]">Agreed Budget:</div>
              <div className="text-[#0b1f17] font-semibold text-base pt-0.5 font-mono">
                {formatUsdCents(reviewDetails?.milestone.agreedAmountCents)}
              </div>
            </div>

            {latestSub ? (
              <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-1.5 text-[11px] font-mono">
                <div className="text-[#2f7a50] font-semibold">Attempt #{latestSub.attemptNumber}</div>
                <div className="text-[#3d5248] truncate">Repo: {latestSub.repoUrl}</div>
                <div className="text-[#3d5248]">Commit: {latestSub.commitSha.slice(0, 10)}</div>
                <div className="text-[#3d5248]">PR: {latestSub.prStatus}</div>
                <div className="text-[#0b1f17] font-medium">
                  CI: {latestSub.ciReport.passedTests}/{latestSub.ciReport.totalTests} passed ({latestSub.ciReport.coveragePct}%)
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] text-[11px] text-[#6b7f75]">
                No delivery evidence submitted for this milestone yet.
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-[rgba(11,31,23,0.08)]">
            <button
              disabled={loading}
              onClick={() => void onSubmitDemoEvidence()}
              className="w-full px-3.5 py-2 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.12)] transition disabled:opacity-50"
            >
              Submit Demo Evidence
            </button>
            <button
              disabled={loading}
              onClick={() => void onVerifyGithubProvenance()}
              className="w-full px-3.5 py-2 rounded-full bg-[#e9efe6] hover:bg-[#dce6d8] text-[#2f7a50] text-xs font-medium border border-[rgba(47,122,80,0.2)] transition disabled:opacity-50"
            >
              Verify GitHub Telemetry
            </button>
            <button
              disabled={loading}
              onClick={() => void onRunAiEvaluation()}
              className="w-full px-3.5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
            >
              Run AI Evaluation
            </button>
          </div>
        </div>

        {/* Column 2: Multi-Agent AI Advisory Findings */}
        <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] space-y-4 text-xs flex flex-col justify-between shadow-[0_4px_20px_-2px_rgba(11,31,23,0.05)]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-2.5">
              <span className="font-normal text-[#0b1f17] text-sm tracking-tight">2. AI Advisory</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#fbf7ed] text-[#8a681c] border border-[#e8dcb8] font-mono font-medium">
                ADVISORY ONLY
              </span>
            </div>

            {latestEval ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[#6b7f75] text-[11px]">Arbitrator Recommendation:</div>
                    <div className="text-[#0b1f17] font-semibold text-sm pt-0.5">
                      {latestEval.arbitratorRecommendation.recommendedOutcome}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                        latestEval.evaluationMode === 'LIVE_GEMINI'
                          ? 'bg-[#e9efe6] text-[#2f7a50] border-[rgba(47,122,80,0.25)]'
                          : latestEval.evaluationMode === 'DETERMINISTIC_FALLBACK'
                          ? 'bg-[#fbf7ed] text-[#8a681c] border-[#e8dcb8]'
                          : 'bg-[#f6f5f0] text-[#3d5248] border-[rgba(11,31,23,0.1)]'
                      }`}
                    >
                      {latestEval.evaluationMode === 'LIVE_GEMINI'
                        ? '⚡ LIVE GEMINI'
                        : latestEval.evaluationMode === 'DETERMINISTIC_FALLBACK'
                        ? '🔄 FALLBACK'
                        : '⚙️ MOCK'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-1.5 text-[11px] font-mono">
                  <div className="text-[#3d5248]">
                    Evidence:{' '}
                    <span className="text-[#2f7a50] font-semibold">
                      {latestEval.evidenceAnalysis.verifiedCount}/{latestEval.evidenceAnalysis.totalCount} Verified
                    </span>
                  </div>
                  <div className="text-[#3d5248]">
                    Risk Severity:{' '}
                    <span
                      className={`font-semibold ${
                        latestEval.riskAnalysis.overallRiskSeverity === 'CRITICAL'
                          ? 'text-[#a62b2b]'
                          : latestEval.riskAnalysis.overallRiskSeverity === 'HIGH'
                          ? 'text-[#a66a1c]'
                          : 'text-[#2f7a50]'
                      }`}
                    >
                      {latestEval.riskAnalysis.overallRiskSeverity}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#3d5248] leading-relaxed line-clamp-3">
                  {latestEval.arbitratorRecommendation.rationale}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] text-[11px] text-[#6b7f75]">
                Evaluation has not been executed yet. Click &quot;Run AI Evaluation&quot; to synthesize evidence.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[rgba(11,31,23,0.08)]">
            <button
              onClick={() => {
                setIsInspectorOpen(true);
                onOpenAiInspector();
              }}
              className="w-full px-3.5 py-2 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs font-medium transition"
            >
              🔍 Inspect AI Reasoning
            </button>
          </div>
        </div>

        {/* Column 3: Deterministic Policy & Human Review */}
        <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] space-y-4 text-xs flex flex-col justify-between shadow-[0_4px_20px_-2px_rgba(11,31,23,0.05)]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-2.5">
              <span className="font-normal text-[#0b1f17] text-sm tracking-tight">3. Policy & Approval</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono font-medium">
                FIDUCIARY GATE
              </span>
            </div>

            <div className="space-y-2 p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] font-mono">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6b7f75]">Agreed Budget:</span>
                <span className="text-[#0b1f17] font-semibold">{formatUsdCents(policy?.agreedAmountCents)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#6b7f75]">Late Penalty:</span>
                <span className="text-[#a62b2b]">-{formatUsdCents(policy?.latePenaltyCents)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[rgba(11,31,23,0.08)]">
                <span className="text-[#6b7f75] font-sans">Permitted Cap:</span>
                <span className="text-[#2f7a50] font-bold text-sm">
                  {formatUsdCents(policy?.permittedAmountCents)}
                </span>
              </div>
            </div>

            {isApprovedByHuman ? (
              <div className="p-3.5 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] space-y-1.5 text-[#1c4b31]">
                <div className="flex items-center gap-1.5 font-semibold text-xs">
                  <span>✓</span> <span>Milestone Approved by Fiduciary</span>
                </div>
                <div className="text-[11px]">
                  Decision: <strong>{latestApproval?.decision}</strong> • Amount: <strong>{formatUsdCents(latestApproval?.approvedAmountCents)}</strong>
                </div>
                <div className="text-[10px] text-[#3d5248] italic truncate">
                  &quot;{latestApproval?.justification}&quot;
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="text-[11px] text-[#6b7f75] block mb-1">
                    Disbursement Amount (Cents):
                  </label>
                  <input
                    type="number"
                    value={approvedAmountCentsInput}
                    onChange={(e) => setApprovedAmountCentsInput(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2f7a50]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#6b7f75] block mb-1">
                    Fiduciary Justification (Required):
                  </label>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Document fiduciary rationale for audit record..."
                    rows={2}
                    className="w-full px-3 py-1.5 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs outline-none focus:border-[#2f7a50]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-[rgba(11,31,23,0.08)]">
            {!isApprovedByHuman && (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    disabled={loading || !justification.trim() || !isReviewer}
                    onClick={() => void onReviewAction('approve')}
                    title={!isReviewer ? 'Reviewer role required (switch persona in top right)' : !justification.trim() ? 'Enter justification' : 'Approve Milestone'}
                    className="px-2 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-medium text-white text-xs transition disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    disabled={loading || !justification.trim() || !isReviewer}
                    onClick={() => void onReviewAction('request-changes')}
                    className="px-2 py-2 rounded-full bg-[#fbf7ed] hover:bg-[#f5edd4] border border-[#e8dcb8] font-medium text-[#8a681c] text-xs transition disabled:opacity-40"
                  >
                    Revise
                  </button>
                  <button
                    disabled={loading || !justification.trim() || !isReviewer}
                    onClick={() => void onReviewAction('reject')}
                    className="px-2 py-2 rounded-full bg-[#fdf2f2] hover:bg-[#fbe4e4] border border-[#f3c2c2] font-medium text-[#a62b2b] text-xs transition disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
                {!isReviewer && (
                  <div className="text-[10px] text-[#8a681c] text-center font-mono">
                    Switch to Reviewer persona (top right) to approve.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Column 4: PayPal Orders API v2 Lifecycle */}
        <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] space-y-4 text-xs flex flex-col justify-between shadow-[0_4px_20px_-2px_rgba(11,31,23,0.05)]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-2.5">
              <span className="font-normal text-[#0b1f17] text-sm tracking-tight">4. PayPal Settlement</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono font-medium">
                ORDERS V2
              </span>
            </div>

            {/* Regulatory Non-Escrow Notice */}
            <div className="p-3 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] text-[10px] text-[#8a681c] space-y-0.5">
              <div className="font-semibold uppercase tracking-wider font-mono">⚠️ Non-Escrow Notice</div>
              <p className="text-[10px] text-[#3d5248] leading-tight">
                29-day authorization hold via PayPal Orders API v2. TrustChain never takes fund custody.
              </p>
            </div>

            <div className="space-y-1.5 p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] font-mono text-[11px]">
              <div>
                Payment State:{' '}
                <span className="text-[#2f7a50] font-semibold">
                  {latestTx?.status ?? reviewDetails?.milestone.paymentStatus ?? 'NOT_READY'}
                </span>
              </div>
              {latestTx && (
                <div className="space-y-0.5 text-[#6b7f75] text-[10px] pt-1 border-t border-[rgba(11,31,23,0.06)]">
                  {latestTx.paypalOrderId && <div>Order: <span className="text-[#0b1f17]">{latestTx.paypalOrderId}</span></div>}
                  <div>Auth ID: <span className="text-[#0b1f17]">{latestTx.paypalAuthorizationId ?? '—'}</span></div>
                  <div>Capture ID: <span className="text-[#0b1f17]">{latestTx.paypalCaptureId ?? '—'}</span></div>
                </div>
              )}
            </div>

            {/* Buyer Approval Action Card */}
            {approveLink && (latestTx?.status === 'ORDER_CREATED' || latestTx?.status === 'SIMULATED_ORDER_CREATED') && (
              <div className="p-3 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] space-y-2">
                <div className="text-[10px] text-[#8a681c] font-semibold flex items-center gap-1">
                  <span>👉</span> <span>Action: Buyer Sandbox Approval</span>
                </div>
                <p className="text-[10px] text-[#3d5248] leading-tight">
                  PayPal Order created. Open Sandbox checkout to authenticate and approve the hold.
                </p>
                <a
                  href={approveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-full px-3 py-1.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white font-medium text-xs shadow-sm transition text-center"
                >
                  Open PayPal Checkout ↗
                </a>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-[rgba(11,31,23,0.08)]">
            <button
              disabled={loading}
              onClick={() => void onPayPalAction('order')}
              className="w-full px-3.5 py-2 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.12)] transition disabled:opacity-50"
            >
              1. Create Order (AUTHORIZE)
            </button>
            <button
              disabled={loading}
              onClick={() => void onPayPalAction('authorize')}
              className="w-full px-3.5 py-2 rounded-full bg-[#fbf7ed] hover:bg-[#f5edd4] border border-[#e8dcb8] text-[#8a681c] text-xs font-medium transition disabled:opacity-50"
            >
              2. Authorize Hold (29 Days)
            </button>
            <div>
              <button
                disabled={loading || !isApprovedByHuman || (latestTx?.status !== 'AUTHORIZED' && latestTx?.status !== 'SIMULATED_AUTHORIZED')}
                onClick={() => void onPayPalAction('capture')}
                className="w-full px-3.5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-medium transition disabled:opacity-30"
              >
                3. Capture Settlement
              </button>
              {!isApprovedByHuman && (
                <div className="text-[9px] text-[#6b7f75] text-center mt-1">
                  🔒 Fiduciary gate: human review approval required in Column 3
                </div>
              )}
            </div>
            <button
              disabled={loading}
              onClick={() => void onPayPalReconcile()}
              className="w-full px-3 py-1.5 rounded-full bg-white hover:bg-[#f6f5f0] text-[#2f7a50] text-[11px] border border-[rgba(47,122,80,0.2)] transition"
            >
              🔄 Reconcile with Sandbox
            </button>
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
