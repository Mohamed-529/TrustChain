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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono">
              SPONSOR INTEGRATION A • BRYNTUM GANTT
            </span>
            <h1 className="text-xl font-bold text-white">
              Evidence-Aware Software Delivery Control Tower
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized with backend milestones, Finish-to-Start dependencies (type=2), Baseline vs. Actual variance, Critical Path, and Human-Controlled Schedule Recovery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={loading}
            onClick={() => void onLoadControlTowerDemo()}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow transition disabled:opacity-50"
          >
            Load 3-Milestone Risk & Recovery Demo
          </button>
          <button
            disabled={loading}
            onClick={() => void onAnalyzeScheduleRisk()}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition disabled:opacity-50"
          >
            Run AI Schedule-Risk Advisor
          </button>
        </div>
      </div>

      {scheduleData && (
        <div className="space-y-6">
          {/* KPI Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Tasks</div>
              <div className="text-lg font-bold text-white mt-1">
                {scheduleData.summary.totalMilestones}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Completed</div>
              <div className="text-lg font-bold text-emerald-400 mt-1">
                {scheduleData.summary.completedCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Overdue / CI Fail</div>
              <div className="text-lg font-bold text-rose-400 mt-1">
                {scheduleData.summary.overdueCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Blocked by Dep</div>
              <div className="text-lg font-bold text-amber-400 mt-1">
                {scheduleData.summary.blockedByDependencyCount}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Critical Path</div>
              <div className="text-lg font-bold text-indigo-400 mt-1">
                {scheduleData.summary.criticalPathCount} tasks
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Pending Proposals</div>
              <div className="text-lg font-bold text-amber-300 mt-1">
                {scheduleData.summary.pendingProposalsCount}
              </div>
            </div>
          </div>

          {/* Genuine Bryntum Gantt Viewer Container */}
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900 p-4 shadow-xl">
            <BryntumGanttViewer schedule={scheduleData} />
          </div>

          {/* Schedule Risk Recovery Proposals Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>🤖</span> AI Schedule-Risk Recovery Proposals (Human Fiduciary Approval Required)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  When CI/CD or delivery delays occur, the AI Advisor formulates schedule shift proposals. Fiduciary approval recalculates downstream Finish-to-Start dependencies while preserving contractual budgets.
                </p>
              </div>
            </div>

            {scheduleData.proposals.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 text-center font-mono">
                No schedule shift proposals pending. Current schedule is aligned with baselines.
              </div>
            ) : (
              <div className="space-y-3">
                {scheduleData.proposals.map((prop: ScheduleRecoveryProposal) => (
                  <div
                    key={prop.id}
                    className="p-4 rounded-xl bg-slate-950 border border-indigo-900/60 space-y-3 font-mono text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-white text-sm">
                        Proposal <span className="text-indigo-400">{prop.id}</span> — Milestone: {prop.milestoneId}
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        {prop.status}
                      </span>
                    </div>

                    <p className="text-slate-300 font-sans text-xs">{prop.aiRationale}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400 bg-slate-900 p-2.5 rounded-lg">
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
                          className="flex-1 min-w-[260px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          placeholder="Fiduciary reason for approving/rejecting recovery..."
                        />
                        <button
                          disabled={loading}
                          onClick={() => void onReviewProposal(prop, 'APPROVE')}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-xs text-white transition disabled:opacity-50"
                        >
                          Approve Schedule Shift
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => void onReviewProposal(prop, 'REJECT')}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold text-xs text-white transition disabled:opacity-50"
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
        </div>
      )}
    </div>
  );
}
