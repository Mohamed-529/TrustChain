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
    <div className="bg-[#e9efe6] border border-[#0b1f17]/10 rounded-[28px] p-4 sm:p-6 space-y-5 font-sans shadow-[0_1px_rgba(11,31,23,0.05),0_18px_36px_-24px_rgba(11,31,23,0.12)]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#0b1f17]/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white text-[#2f7a50] border border-[#0b1f17]/10 font-mono">
              FINANCIAL LEDGER OVERVIEW
            </span>
            <h2 className="text-base font-normal text-[#0b1f17]">
              Portfolio Operations & Risk Telemetry
            </h2>
          </div>
          <p className="text-xs text-[#3d5248] mt-0.5">
            Operational telemetry aggregated from authoritative contracts, independent GitHub telemetry, and PayPal payment records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[#3d5248] font-mono text-[11px]">Filter:</span>
          <button
            onClick={() => onSelectQuickFilter?.('ALL')}
            className="px-3 py-1 rounded-full bg-white hover:bg-[#dfe7da] text-[#0b1f17] font-mono text-[11px] border border-[#0b1f17]/10 transition shadow-sm"
          >
            All ({totalMilestones})
          </button>
          <button
            onClick={() => onSelectQuickFilter?.('HIGH_RISK')}
            className="px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 font-mono text-[11px] border border-amber-200 transition"
          >
            High Risk ({criticalRiskCount + highRiskCount})
          </button>
          <button
            onClick={() => onSelectQuickFilter?.('PENDING_REVIEW')}
            className="px-3 py-1 rounded-full bg-white hover:bg-[#dfe7da] text-[#0b1f17] font-mono text-[11px] border border-[#0b1f17]/10 transition shadow-sm"
          >
            Pending Review ({pendingReviewMilestones})
          </button>
          <button
            onClick={() => onSelectQuickFilter?.('SETTLED')}
            className="px-3 py-1 rounded-full bg-[#dfe7da] hover:bg-[#c8f542] text-[#0b1f17] font-mono text-[11px] border border-[#0b1f17]/10 transition shadow-sm"
          >
            Settled ({ledgerRows.filter((r) => r.paymentStatus === 'CAPTURED').length})
          </button>
        </div>
      </div>

      {/* 4 Clean Pure White Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 font-mono">
        {/* Card 1: Agreed Budget vs Settled */}
        <div className="p-5 rounded-[22px] bg-white border border-[#0b1f17]/10 space-y-1.5 shadow-[0_1px_rgba(11,31,23,0.04),0_10px_20px_-14px_rgba(11,31,23,0.08)]">
          <div className="text-[#3d5248] text-[11px] uppercase tracking-wide">Total Contract Budget</div>
          <div className="text-xl font-normal text-[#0b1f17] tracking-tight">{formatUsdCents(totalAgreedBudgetCents)}</div>
          <div className="text-[11px] text-[#3d5248] flex justify-between pt-1 border-t border-[#0b1f17]/5">
            <span>Captured:</span>
            <span className="text-[#2f7a50] font-semibold">{formatUsdCents(totalCapturedCents)}</span>
          </div>
        </div>

        {/* Card 2: Permitted Cap vs Approved */}
        <div className="p-5 rounded-[22px] bg-white border border-[#0b1f17]/10 space-y-1.5 shadow-[0_1px_rgba(11,31,23,0.04),0_10px_20px_-14px_rgba(11,31,23,0.08)]">
          <div className="text-[#3d5248] text-[11px] uppercase tracking-wide">Policy Cap vs Approved</div>
          <div className="text-xl font-normal text-[#2f7a50] tracking-tight">{formatUsdCents(totalPermittedCents)}</div>
          <div className="text-[11px] text-[#3d5248] flex justify-between pt-1 border-t border-[#0b1f17]/5">
            <span>Human Approved:</span>
            <span className="text-[#0b1f17] font-semibold">{formatUsdCents(totalApprovedCents)}</span>
          </div>
        </div>

        {/* Card 3: Milestone Delivery Progress */}
        <div className="p-5 rounded-[22px] bg-white border border-[#0b1f17]/10 space-y-1.5 shadow-[0_1px_rgba(11,31,23,0.04),0_10px_20px_-14px_rgba(11,31,23,0.08)]">
          <div className="text-[#3d5248] text-[11px] uppercase tracking-wide">Milestone Progress</div>
          <div className="text-xl font-normal text-[#0b1f17] tracking-tight">
            {approvedMilestones} / {totalMilestones}{' '}
            <span className="text-xs text-[#3d5248]">
              ({totalMilestones > 0 ? ((approvedMilestones / totalMilestones) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="text-[11px] text-[#3d5248] flex justify-between pt-1 border-t border-[#0b1f17]/5">
            <span>Pending Review:</span>
            <span className="text-amber-800 font-semibold">{pendingReviewMilestones}</span>
          </div>
        </div>

        {/* Card 4: Schedule Risk & Critical Path */}
        <div className="p-5 rounded-[22px] bg-white border border-[#0b1f17]/10 space-y-1.5 shadow-[0_1px_rgba(11,31,23,0.04),0_10px_20px_-14px_rgba(11,31,23,0.08)]">
          <div className="text-[#3d5248] text-[11px] uppercase tracking-wide">Schedule & CI Health</div>
          <div className="text-xl font-normal text-rose-700 tracking-tight">
            {overdueMilestones}{' '}
            <span className="text-xs text-[#3d5248]">overdue/failed</span>
          </div>
          <div className="text-[11px] text-[#3d5248] flex justify-between pt-1 border-t border-[#0b1f17]/5">
            <span>Blocked Tasks:</span>
            <span className="text-amber-800 font-semibold">{blockedByDependency}</span>
          </div>
        </div>
      </div>

      {/* Risk Distribution Bar */}
      <div className="p-4 rounded-[20px] bg-white border border-[#0b1f17]/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-[#3d5248]">Risk Distribution:</span>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[11px]">
              Critical: {criticalRiskCount}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[11px]">
              High: {highRiskCount}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#f6f5f0] text-[#3d5248] border border-[#0b1f17]/10 text-[11px]">
              Medium: {mediumRiskCount}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] border border-[#2f7a50]/20 text-[11px]">
              Low/None: {lowOrNoneRiskCount}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-[#3d5248]">
          Source: SQLite ACID Ledger • Deterministic Fiduciary Telemetry
        </div>
      </div>
    </div>
  );
}
