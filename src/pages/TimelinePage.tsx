import React, { useState, useMemo } from 'react';
import { BryntumGanttViewer } from '../components/BryntumGanttViewer.tsx';
import type { ContractScheduleResponse, ScheduleRecoveryProposal, ContractScheduleTask } from '../types/domain.ts';

interface TimelinePageProps {
  scheduleData: ContractScheduleResponse | null;
  loading: boolean;
  onLoadControlTowerDemo: () => Promise<void>;
  onAnalyzeScheduleRisk: () => Promise<void>;
  onReviewProposal: (proposal: ScheduleRecoveryProposal, decision: 'APPROVE' | 'REJECT') => Promise<void>;
  scheduleDecisionReason: string;
  setScheduleDecisionReason: (reason: string) => void;
  token?: string;
  onNavigateToReviews?: () => void;
  onNavigateToDisputes?: () => void;
  onNavigateToIntelligence?: () => void;
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
  token,
  onNavigateToReviews,
  onNavigateToDisputes,
  onNavigateToIntelligence,
}: TimelinePageProps) {
  const [filterMode, setFilterMode] = useState<'ALL' | 'CRITICAL' | 'AT_RISK' | 'BLOCKED'>('ALL');
  const [baselineStatusMessage, setBaselineStatusMessage] = useState<string | null>(null);
  const [isCapturingBaseline, setIsCapturingBaseline] = useState<boolean>(false);

  // Downstream delay simulation state
  const [simMilestoneId, setSimMilestoneId] = useState<string>('');
  const [simDelayDays, setSimDelayDays] = useState<number>(7);
  const [simResult, setSimResult] = useState<{
    impactedMilestones: { milestoneId: string; title: string; originalDeadline: string; newProjectedDeadline: string; daysShifted: number }[];
    criticalPathAffected: boolean;
    contractDeadlineExceeded: boolean;
  } | null>(null);

  // Filter tasks based on selected mode
  const displayedTasks = useMemo<ContractScheduleTask[] | undefined>(() => {
    if (!scheduleData?.tasks) return undefined;
    switch (filterMode) {
      case 'CRITICAL':
        return scheduleData.tasks.filter((t) => t.critical);
      case 'AT_RISK':
        return scheduleData.tasks.filter((t) => t.isAtRisk || t.isOverdue);
      case 'BLOCKED':
        return scheduleData.tasks.filter((t) => t.isBlockedByDependency);
      case 'ALL':
      default:
        return scheduleData.tasks;
    }
  }, [scheduleData, filterMode]);

  const handleCaptureBaseline = async () => {
    if (!scheduleData?.contractId || !token) return;
    setIsCapturingBaseline(true);
    setBaselineStatusMessage(null);
    try {
      const res = await fetch(`/api/v1/contracts/${scheduleData.contractId}/schedule/baseline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ label: 'Fiduciary Approved Baseline Snapshot' }),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to capture baseline');
      }
      const data = await res.json();
      setBaselineStatusMessage(
        `✓ Baseline snapshot captured for ${data.baselineMilestoneCount} milestones (Audit Hash: ${data.auditEntryHash.slice(0, 12)}...)`
      );
    } catch (err) {
      setBaselineStatusMessage(err instanceof Error ? `Error: ${err.message}` : 'Baseline capture failed');
    } finally {
      setIsCapturingBaseline(false);
    }
  };

  const handleSimulateDelay = async () => {
    if (!scheduleData?.contractId || !simMilestoneId) return;
    try {
      const res = await fetch(
        `/api/v1/contracts/${scheduleData.contractId}/schedule/impact?milestoneId=${encodeURIComponent(simMilestoneId)}&delayDays=${simDelayDays}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSimResult(data);
      }
    } catch {
      // Graceful fallback
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Clean Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950/80 text-teal-300 border border-teal-800/80 font-mono">
              BRYNTUM GANTT v7.3.8
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Intelligent Contract Execution Timeline
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Finish-to-Start dependency tracking, baseline variance, sub-task tree decomposition, and human-approved recovery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToReviews && (
            <button
              onClick={onNavigateToReviews}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition"
              title="Navigate to Human Review Workbench"
            >
              ⚖️ Review Workbench
            </button>
          )}
          {onNavigateToDisputes && (
            <button
              onClick={onNavigateToDisputes}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-purple-300 hover:text-white transition"
              title="Navigate to Dispute Evidence Pack"
            >
              🛡️ Dispute Pack
            </button>
          )}
          {token && scheduleData && (
            <button
              disabled={isCapturingBaseline}
              onClick={handleCaptureBaseline}
              className="px-3 py-1.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-xs font-semibold text-indigo-200 transition disabled:opacity-50"
              title="Freeze current schedule as an immutable audit-logged contract baseline"
            >
              {isCapturingBaseline ? 'Freezing...' : '📌 Capture Baseline'}
            </button>
          )}
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

      {baselineStatusMessage && (
        <div className="px-3 py-2 rounded-lg bg-indigo-950/60 border border-indigo-800 text-xs font-mono text-indigo-300 flex items-center justify-between">
          <span>{baselineStatusMessage}</span>
          <button
            onClick={() => setBaselineStatusMessage(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Timeline KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950 border border-zinc-800 px-4 py-2.5 rounded-xl">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-zinc-500 font-mono text-[11px] mr-1">Filter View:</span>
          {(['ALL', 'CRITICAL', 'AT_RISK', 'BLOCKED'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filterMode === mode
                  ? 'bg-teal-900/60 text-teal-200 border border-teal-700/80 font-semibold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {mode === 'ALL'
                ? 'All Tasks'
                : mode === 'CRITICAL'
                  ? 'Critical Path Only'
                  : mode === 'AT_RISK'
                    ? 'At Risk / Overdue'
                    : 'Blocked by Dependencies'}
            </button>
          ))}
        </div>

        {scheduleData?.summary && (
          <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400">
            <span>
              Total: <strong className="text-white">{scheduleData.summary.totalMilestones}</strong>
            </span>
            <span>
              Critical: <strong className="text-amber-400">{scheduleData.summary.criticalPathCount}</strong>
            </span>
            <span>
              Overdue: <strong className="text-rose-400">{scheduleData.summary.overdueCount}</strong>
            </span>
            <span>
              Blocked: <strong className="text-purple-400">{scheduleData.summary.blockedByDependencyCount}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Bryntum Gantt Chart Section */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl overflow-hidden">
        <BryntumGanttViewer
          schedule={scheduleData}
          tasks={displayedTasks}
          isLoading={loading}
        />
      </div>

      {/* Interactive Downstream Delay Impact Simulator */}
      {scheduleData && scheduleData.tasks.length > 0 && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3 font-sans text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <h3 className="font-bold text-white text-sm">
                Downstream Dependency Delay Impact Analyzer
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">
              Predictive Finish-to-Start Simulation
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={simMilestoneId}
              onChange={(e) => {
                setSimMilestoneId(e.target.value);
                setSimResult(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-white"
            >
              <option value="">Select a milestone to test delay impact...</option>
              {scheduleData.tasks.map((t) => (
                <option key={t.milestoneId} value={t.milestoneId}>
                  {t.name} ({t.milestoneId})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400 font-mono text-[11px]">Hypothetical Delay:</span>
              <input
                type="number"
                min="1"
                max="60"
                value={simDelayDays}
                onChange={(e) => setSimDelayDays(parseInt(e.target.value, 10) || 1)}
                className="w-16 px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-white font-mono text-center"
              />
              <span className="text-zinc-400 font-mono text-[11px]">days</span>
            </div>

            <button
              onClick={handleSimulateDelay}
              disabled={!simMilestoneId}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition"
            >
              Simulate Cascade
            </button>
          </div>

          {simResult && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 mt-2 font-mono text-[11px]">
              <div className="flex flex-wrap items-center gap-4">
                <span className={simResult.criticalPathAffected ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {simResult.criticalPathAffected
                    ? '⚠️ Critical Path Impacted'
                    : '✓ Critical Path Unaffected'}
                </span>
                <span className={simResult.contractDeadlineExceeded ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  {simResult.contractDeadlineExceeded
                    ? '⚠️ Final Contract Completion Date Delayed'
                    : '✓ Final Contract Completion Date Safe'}
                </span>
              </div>
              {simResult.impactedMilestones.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <div className="text-zinc-400">Affected Downstream Dependent Milestones:</div>
                  {simResult.impactedMilestones.map((im) => (
                    <div key={im.milestoneId} className="flex items-center justify-between text-zinc-300 pl-2">
                      <span>• {im.title} ({im.milestoneId})</span>
                      <span className="text-amber-400">
                        {im.originalDeadline.slice(0, 10)} → {im.newProjectedDeadline.slice(0, 10)} (+{im.daysShifted}d)
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-zinc-500 italic">No downstream milestones depend on this task.</div>
              )}
            </div>
          )}
        </div>
      )}

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
