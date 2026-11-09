import React from 'react';
import { BryntumGanttViewer } from '../components/BryntumGanttViewer.tsx';
import type { ContractScheduleResponse, ScheduleRecoveryProposal } from '../types/domain.ts';

interface TimelinePageProps {
  scheduleData: ContractScheduleResponse | null;
  loading: boolean;
  onLoadControlTowerDemo: () => Promise<void>;
  onAnalyzeScheduleRisk: () => Promise<void>;
  onReviewProposal: (proposal: ScheduleRecoveryProposal, decision: 'APPROVE' | 'REJECT') => Promise<void>;
  scheduleDecisionReason: string;
  setScheduleDecisionReason: (reason: string) => void;
}

function formatUsdCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TimelinePage({
  scheduleData,
  loading,
  onLoadControlTowerDemo,
  onAnalyzeScheduleRisk,
  onReviewProposal,
  scheduleDecisionReason,
  setScheduleDecisionReason,
}: TimelinePageProps) {
  return (
    <div className="space-y-6 font-sans">
      {/* 1-Line Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950/80 text-teal-300 border border-teal-800/80 font-mono">
              BRYNTUM GANTT v7.3
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Software Delivery Timeline Control Tower
            </h1>
          </div>
          {/* EXACTLY 1 LINE DESCRIPTION */}
          <p className="text-xs text-zinc-400 mt-1">
            Finish-to-Start dependency tracking, baseline variance, critical path, and fiduciary AI schedule shift recovery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={loading}
            onClick={() => void onLoadControlTowerDemo()}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-zinc-950 shadow-md shadow-emerald-600/10 transition disabled:opacity-50"
          >
            Load 3-Milestone Demo
          </button>
          <button
            disabled={loading}
            onClick={() => void onAnalyzeScheduleRisk()}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition disabled:opacity-50"
          >
            Run AI Schedule Advisor
          </button>
        </div>
      </div>

      {/* Bryntum Gantt Chart Section */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl overflow-hidden">
        <BryntumGanttViewer schedule={scheduleData} isLoading={loading} />
      </div>

      {/* AI Schedule Recovery Proposals Section */}
      {scheduleData && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🤖</span> AI Schedule-Risk Recovery Proposals (Human Fiduciary Approval Required)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                AI schedule proposals recalculate downstream Finish-to-Start dependencies while preserving contractual budgets.
              </p>
            </div>
          </div>

          {scheduleData.proposals.length === 0 ? (
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 text-center font-mono">
              No schedule shift proposals pending. Current schedule is aligned with baselines.
            </div>
          ) : (
            <div className="space-y-3">
              {scheduleData.proposals.map((prop: ScheduleRecoveryProposal) => (
                <div
                  key={prop.id}
                  className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 font-mono text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-white text-sm">
                      Proposal <span className="text-amber-400">{prop.id}</span> — Milestone: {prop.milestoneId}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                      {prop.status}
                    </span>
                  </div>

                  <p className="text-zinc-300 font-sans text-xs">{prop.aiRationale}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-zinc-400 bg-zinc-900 p-2.5 rounded-lg border border-zinc-800/80">
                    <div>
                      Proposed Window:{' '}
                      <span className="text-white">
                        {prop.proposedStartDate.slice(0, 10)} → {prop.proposedEndDate.slice(0, 10)}
                      </span>
                    </div>
                    <div>
                      Shift Amount: <span className="text-amber-400 font-bold">+{prop.delayDays} days</span>
                    </div>
                    <div>
                      Contractual Budget:{' '}
                      <span className="text-emerald-400 font-bold">
                        {formatUsdCents(prop.preservesContractualAmountCents)} (UNCHANGED)
                      </span>
                    </div>
                  </div>

                  {prop.status === 'PENDING' && (
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <input
                        type="text"
                        value={scheduleDecisionReason}
                        onChange={(e) => setScheduleDecisionReason(e.target.value)}
                        className="flex-1 min-w-[260px] px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white"
                        placeholder="Fiduciary reason for approving/rejecting recovery..."
                      />
                      <button
                        disabled={loading}
                        onClick={() => void onReviewProposal(prop, 'APPROVE')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-zinc-950 transition disabled:opacity-50"
                      >
                        Approve Shift
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => void onReviewProposal(prop, 'REJECT')}
                        className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-semibold text-xs text-rose-400 border border-rose-800/40 transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
