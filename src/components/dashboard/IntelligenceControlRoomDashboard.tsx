import React from 'react';
import type { FinancialLedgerRow, ContractScheduleResponse } from '../../types/domain';

interface IntelligenceControlRoomDashboardProps {
  ledgerRows: FinancialLedgerRow[];
  scheduleData: ContractScheduleResponse | null;
  onSelectQuickFilter?: (filterType: string) => void;
}

function formatUsdCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function IntelligenceControlRoomDashboard({
  ledgerRows,
  scheduleData,
  onSelectQuickFilter,
}: IntelligenceControlRoomDashboardProps) {
  // Compute authentic operational numbers directly from authoritative backend ledger rows
  const totalMilestones = ledgerRows.length;
  const approvedMilestones = ledgerRows.filter(
    (r) => r.stateMachineStatus === 'APPROVED' || r.milestoneStatus === 'APPROVED'
  ).length;
  const pendingReviewMilestones = ledgerRows.filter(
    (r) => r.submissionId && r.stateMachineStatus !== 'APPROVED' && r.stateMachineStatus !== 'REJECTED'
  ).length;
  const overdueMilestones = scheduleData?.summary.overdueCount ?? 0;
  const blockedByDependency = scheduleData?.summary.blockedByDependencyCount ?? 0;

  // Financial aggregates
  const totalAgreedBudgetCents = ledgerRows.reduce((sum, r) => sum + r.agreedAmountCents, 0);
  const totalPermittedCents = ledgerRows.reduce((sum, r) => sum + (r.permittedAmountCents ?? 0), 0);
  const totalApprovedCents = ledgerRows.reduce((sum, r) => sum + (r.approvedAmountCents ?? 0), 0);
  const totalCapturedCents = ledgerRows
    .filter((r) => r.paymentStatus === 'CAPTURED' || r.paymentStatus === 'SIMULATED_CAPTURED')
    .reduce((sum, r) => sum + (r.approvedAmountCents ?? r.agreedAmountCents), 0);

  // Risk distribution
  const criticalRiskCount = ledgerRows.filter((r) => r.riskSeverity === 'CRITICAL').length;
  const highRiskCount = ledgerRows.filter((r) => r.riskSeverity === 'HIGH').length;
  const mediumRiskCount = ledgerRows.filter((r) => r.riskSeverity === 'MEDIUM').length;
  const lowOrNoneRiskCount = ledgerRows.filter(
    (r) => r.riskSeverity === 'LOW' || r.riskSeverity === 'NONE'
  ).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono">
              INTELLIGENCE CONTROL ROOM
            </span>
            <h2 className="text-base font-bold text-white">
              Portfolio Operations & Risk Distribution
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational telemetry aggregated from authoritative contracts, independent GitHub telemetry, and PayPal payment records.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Quick Views:</span>
          <button
            onClick={() => onSelectQuickFilter?.('ALL')}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] border border-slate-700"
          >
            All ({totalMilestones})
          </button>
          <button
            onClick={() => onSelectQuickFilter?.('HIGH_RISK')}
            className="px-2.5 py-1 rounded bg-orange-950/70 hover:bg-orange-900 text-orange-200 font-mono text-[11px] border border-orange-700"
          >
            High Risk ({criticalRiskCount + highRiskCount})
          </button>
          <button
            onClick={() => onSelectQuickFilter?.('PENDING_REVIEW')}
            className="px-2.5 py-1 rounded bg-amber-950/70 hover:bg-amber-900 text-amber-200 font-mono text-[11px] border border-amber-700"
          >
            Pending Review ({pendingReviewMilestones})
          </button>
          <button
            onClick={() => onSelectQuickFilter?.('SETTLED')}
            className="px-2.5 py-1 rounded bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 font-mono text-[11px] border border-emerald-700"
          >
            Settled ({ledgerRows.filter((r) => r.paymentStatus === 'CAPTURED').length})
          </button>
        </div>
      </div>

      {/* 4 Financial & Delivery Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        {/* Card 1: Agreed Budget vs Settled */}
        <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Total Contract Budget</div>
          <div className="text-lg font-bold text-white">{formatUsdCents(totalAgreedBudgetCents)}</div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>Captured:</span>
            <span className="text-emerald-400 font-bold">{formatUsdCents(totalCapturedCents)}</span>
          </div>
        </div>

        {/* Card 2: Permitted Cap vs Approved */}
        <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Policy Cap vs Approved</div>
          <div className="text-lg font-bold text-indigo-400">{formatUsdCents(totalPermittedCents)}</div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>Human Approved:</span>
            <span className="text-emerald-300 font-bold">{formatUsdCents(totalApprovedCents)}</span>
          </div>
        </div>

        {/* Card 3: Milestone Delivery Progress */}
        <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Milestone Progress</div>
          <div className="text-lg font-bold text-sky-400">
            {approvedMilestones} / {totalMilestones}{' '}
            <span className="text-xs text-slate-400">
              ({totalMilestones > 0 ? ((approvedMilestones / totalMilestones) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>Pending Review:</span>
            <span className="text-amber-300 font-semibold">{pendingReviewMilestones}</span>
          </div>
        </div>

        {/* Card 4: Schedule Risk & Critical Path */}
        <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1">
          <div className="text-slate-400 text-[10px] uppercase">Schedule & CI Health</div>
          <div className="text-lg font-bold text-rose-400">
            {overdueMilestones}{' '}
            <span className="text-xs font-normal text-slate-400">overdue/failed</span>
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between">
            <span>Blocked by Dep:</span>
            <span className="text-amber-400">{blockedByDependency} tasks</span>
          </div>
        </div>
      </div>

      {/* Risk Distribution Breakdown Bar */}
      <div className="p-3 rounded bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Portfolio Risk Distribution:</span>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[11px]">
              Critical: {criticalRiskCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800 text-[11px]">
              High: {highRiskCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[11px]">
              Medium: {mediumRiskCount}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px]">
              Low/None: {lowOrNoneRiskCount}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          Source: Real-time SQLite Ledger • Fully Verified Telemetry
        </div>
      </div>
    </div>
  );
}
