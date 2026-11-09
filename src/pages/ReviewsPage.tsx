import React from 'react';
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
  const latestSub = reviewDetails?.latestSubmission;
  const latestEval = reviewDetails?.latestEvaluation;
  const policy = reviewDetails?.policyCalculation;
  const latestTx = paypalTransactions[0] ?? null;

  return (
    <div className="space-y-6 font-sans">
      {/* 1-Line Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">◈</span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Milestone Review & Settlement Workbench
            </h1>
          </div>
          {/* EXACTLY 1 LINE DESCRIPTION */}
          <p className="text-xs text-zinc-400 mt-1">
            Four-stage fiduciary workflow: Evidence Ingestion → AI Advisory Synthesis → Deterministic Settlement Cap → Human Review & PayPal Settlement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPassport}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-emerald-400 transition"
          >
            🛡️ View Passport
          </button>
          <button
            onClick={onOpenDisputePack}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-amber-400 transition"
          >
            📂 View Dispute Pack
          </button>
        </div>
      </div>

      {/* Milestone Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        <span className="text-xs text-zinc-500 font-mono mr-2">MILESTONE:</span>
        {[
          { id: 'ms_seed_01', label: 'Milestone 1 (OAuth2 Auth)' },
          { id: 'ms_seed_02', label: 'Milestone 2 (Settlement Engine)' },
          { id: 'ms_seed_03', label: 'Milestone 3 (Audit Replay & E2E)' },
        ].map((m) => {
          const isSelected = selectedMilestoneId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMilestoneId(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                isSelected
                  ? 'bg-zinc-800 text-emerald-400 font-bold border border-emerald-500/40 shadow-sm'
                  : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 4-Column Operational Workbench */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Column 1: Evidence Summary */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 font-mono text-xs flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-white text-sm">1. Delivery Evidence</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-950 text-emerald-400 border border-zinc-800">
                {reviewDetails?.milestone.status ?? 'PENDING'}
              </span>
            </div>

            <div>
              <div className="text-zinc-500 text-[11px]">Milestone Title:</div>
              <div className="text-white font-sans text-xs font-semibold pt-0.5">
                {reviewDetails?.milestone.title ?? 'Loading...'}
              </div>
            </div>

            <div>
              <div className="text-zinc-500 text-[11px]">Agreed Budget:</div>
              <div className="text-emerald-400 font-bold text-sm pt-0.5">
                {formatUsdCents(reviewDetails?.milestone.agreedAmountCents)}
              </div>
            </div>

            {latestSub ? (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-[11px]">
                <div className="text-zinc-400">Attempt #{latestSub.attemptNumber}</div>
                <div className="text-zinc-300 truncate">Repo: {latestSub.repoUrl}</div>
                <div className="text-zinc-300">Commit: {latestSub.commitSha.slice(0, 10)}</div>
                <div className="text-zinc-300">PR: {latestSub.prStatus}</div>
                <div className="text-zinc-300">
                  CI: {latestSub.ciReport.passedTests}/{latestSub.ciReport.totalTests} passed (
                  {latestSub.ciReport.coveragePct}%)
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400">
                No delivery evidence submitted for this milestone yet.
              </div>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-800">
            <button
              disabled={loading}
              onClick={() => void onSubmitDemoEvidence()}
              className="w-full px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition disabled:opacity-50"
            >
              Submit Demo Evidence
            </button>
            <button
              disabled={loading}
              onClick={() => void onVerifyGithubProvenance()}
              className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-emerald-400 text-xs font-medium border border-zinc-800 transition disabled:opacity-50"
            >
              Verify GitHub Telemetry
            </button>
            <button
              disabled={loading}
              onClick={() => void onRunAiEvaluation()}
              className="w-full px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold shadow transition disabled:opacity-50"
            >
              Run AI Evaluation
            </button>
          </div>
        </div>

        {/* Column 2: Multi-Agent AI Advisory Findings */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 font-mono text-xs flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-white text-sm">2. AI Advisory</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800 font-bold">
                ADVISORY ONLY
              </span>
            </div>

            {latestEval ? (
              <div className="space-y-2.5">
                <div>
                  <div className="text-zinc-500 text-[11px]">Arbitrator Recommendation:</div>
                  <div className="text-amber-400 font-bold text-sm pt-0.5">
                    {latestEval.arbitratorRecommendation.recommendedOutcome}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-[11px]">
                  <div className="text-zinc-300">
                    Evidence:{' '}
                    <span className="text-emerald-400 font-bold">
                      {latestEval.evidenceAnalysis.verifiedCount}/{latestEval.evidenceAnalysis.totalCount} Verified
                    </span>
                  </div>
                  <div className="text-zinc-300">
                    Risk Severity:{' '}
                    <span
                      className={`font-bold ${
                        latestEval.riskAnalysis.overallRiskSeverity === 'CRITICAL'
                          ? 'text-rose-400'
                          : latestEval.riskAnalysis.overallRiskSeverity === 'HIGH'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {latestEval.riskAnalysis.overallRiskSeverity}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-300 font-sans leading-relaxed line-clamp-3">
                  {latestEval.arbitratorRecommendation.rationale}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400">
                Evaluation has not been executed yet. Click &quot;Run AI Evaluation&quot; to synthesize evidence.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-800">
            <button
              onClick={onOpenAiInspector}
              className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-amber-400 text-xs font-semibold transition"
            >
              Open AI Inspector →
            </button>
          </div>
        </div>

        {/* Column 3: Deterministic Policy & Human Review */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 font-mono text-xs flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-white text-sm">3. Policy & Approval</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-950 text-zinc-300 border border-zinc-800">
                FIDUCIARY GATE
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Agreed Budget:</span>
                <span className="text-white">{formatUsdCents(policy?.agreedAmountCents)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Late Penalty:</span>
                <span className="text-rose-400">-{formatUsdCents(policy?.latePenaltyCents)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">Permitted Cap:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {formatUsdCents(policy?.permittedAmountCents)}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Disbursement Amount (Cents):
                </label>
                <input
                  type="number"
                  value={approvedAmountCentsInput}
                  onChange={(e) => setApprovedAmountCentsInput(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Fiduciary Justification (Required):
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Document fiduciary rationale for audit record..."
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs font-sans"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-800">
            <div className="grid grid-cols-3 gap-1.5">
              <button
                disabled={loading || !justification.trim()}
                onClick={() => void onReviewAction('approve')}
                className="px-2 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-zinc-950 text-xs transition disabled:opacity-40"
              >
                Approve
              </button>
              <button
                disabled={loading || !justification.trim()}
                onClick={() => void onReviewAction('request-changes')}
                className="px-2 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-semibold text-zinc-950 text-xs transition disabled:opacity-40"
              >
                Revise
              </button>
              <button
                disabled={loading || !justification.trim()}
                onClick={() => void onReviewAction('reject')}
                className="px-2 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 font-semibold text-white text-xs transition disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        </div>

        {/* Column 4: PayPal Orders API v2 Lifecycle */}
        <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 font-mono text-xs flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="font-bold text-white text-sm">4. PayPal Settlement</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-950 text-emerald-400 border border-zinc-800 font-mono">
                ORDERS V2
              </span>
            </div>

            {/* Regulatory Non-Escrow Notice: 1 line */}
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-900/60 text-[10px] text-amber-300 space-y-0.5">
              <div className="font-bold uppercase tracking-wider">⚠️ Non-Escrow Notice</div>
              <p className="text-[10px] text-zinc-300 font-sans leading-tight">
                29-day authorization hold via PayPal Orders API v2. TrustChain never takes fund custody.
              </p>
            </div>

            <div className="space-y-1 text-[11px]">
              <div>
                Payment State:{' '}
                <span className="text-emerald-400 font-bold">
                  {latestTx?.status ?? reviewDetails?.milestone.paymentStatus ?? 'NOT_READY'}
                </span>
              </div>
              {latestTx && (
                <div className="space-y-0.5 text-zinc-400 text-[10px]">
                  <div>Auth ID: {latestTx.paypalAuthorizationId ?? '—'}</div>
                  <div>Capture ID: {latestTx.paypalCaptureId ?? '—'}</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-zinc-800">
            <button
              disabled={loading}
              onClick={() => void onPayPalAction('order')}
              className="w-full px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition disabled:opacity-50"
            >
              1. Create Order (AUTHORIZE)
            </button>
            <button
              disabled={loading}
              onClick={() => void onPayPalAction('authorize')}
              className="w-full px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 text-xs font-bold transition disabled:opacity-50"
            >
              2. Authorize Hold (29 Days)
            </button>
            <button
              disabled={loading}
              onClick={() => void onPayPalAction('capture')}
              className="w-full px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold transition disabled:opacity-50"
            >
              3. Capture Settlement
            </button>
            <button
              disabled={loading}
              onClick={() => void onPayPalReconcile()}
              className="w-full px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-850 text-amber-400 text-[11px] border border-zinc-800 transition"
            >
              🔄 Reconcile with Sandbox
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
