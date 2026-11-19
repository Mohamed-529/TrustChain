import React, { useState } from 'react';
import { useNavigate } from '../router/Router.tsx';
import { IntelligenceControlRoomDashboard } from '../components/dashboard/IntelligenceControlRoomDashboard.tsx';
import type { FinancialLedgerRow, ContractScheduleResponse, User, Contract } from '../types/domain.ts';

interface DashboardPageProps {
  currentUser: User | null;
  ledgerRows: FinancialLedgerRow[];
  scheduleData: ContractScheduleResponse | null;
  contracts: Contract[];
  selectedContractId?: string;
  onSelectContract?: (contractId: string) => void;
  onSelectQuickFilter: (filter: string) => void;
  onOpenCreateProject: () => void;
  onOpenWalkthrough: () => void;
  onResetDemoContract: () => Promise<void>;
  onSelectMilestone: (id: string) => void;
}

export function DashboardPage({
  currentUser,
  ledgerRows,
  scheduleData,
  contracts,
  selectedContractId,
  onSelectContract,
  onSelectQuickFilter,
  onOpenCreateProject,
  onOpenWalkthrough,
  onResetDemoContract,
  onSelectMilestone,
}: DashboardPageProps) {
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const isClient = currentUser?.role === 'CLIENT';
  const isDev = currentUser?.role === 'DEVELOPER';

  const activeContract =
    contracts.find((c) => c.id === selectedContractId) ?? contracts[0] ?? null;

  const handleReset = async () => {
    setResetting(true);
    try {
      await onResetDemoContract();
    } finally {
      setResetting(false);
    }
  };

  const handleFilterAndJump = (filterType: string) => {
    onSelectQuickFilter(filterType);
    navigate('/intelligence');
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Cascrow Editorial Header: Monospace kicker with green bar + Light weight 400 heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[#0b1f17]/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#2f7a50] font-medium tracking-tight">
            <span className="w-5 h-[1.5px] bg-[#2f7a50] inline-block" />
            <span>
              {isClient ? 'CLIENT FIDUCIARY OVERVIEW' : isDev ? 'DEVELOPER DELIVERY WORKSPACE' : 'PORTFOLIO INTELLIGENCE'}
            </span>
          </div>
          <h1 className="text-3xl font-normal text-[#0b1f17] tracking-tight">
            {isClient
              ? `Welcome back, ${currentUser?.name ?? 'Elena Vance'}`
              : isDev
              ? `Engineering Workspace — ${currentUser?.name ?? 'Marcus Chen'}`
              : `Executive Intelligence Control Room`}
          </h1>
          <p className="text-sm text-[#3d5248] max-w-2xl leading-relaxed">
            {isClient
              ? 'Verify software delivery proof against contractual acceptance criteria before releasing payment.'
              : isDev
              ? 'Deliver technical commits and CI evidence, inspect multi-agent AI verification reports, and track PayPal payment releases.'
              : 'Real-time portfolio telemetry aggregated from active contracts, GitHub telemetry, and PayPal payment records.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenWalkthrough}
            className="px-4 py-2 rounded-full bg-[#e9efe6] hover:bg-[#dfe7da] text-[#0b1f17] border border-[#0b1f17]/10 text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
          >
            <span>✨</span>
            <span>How it works</span>
          </button>

          {isClient && (
            <button
              onClick={onOpenCreateProject}
              className="px-4 py-2 rounded-full bg-[#0b1f17] hover:bg-[#183528] text-white text-xs font-medium transition shadow-sm"
            >
              + Create Project
            </button>
          )}

          <button
            disabled={resetting}
            onClick={handleReset}
            title="Reset demo contract (contract_seed_01) to clean state for demo video recording"
            className="px-3.5 py-2 rounded-full bg-white hover:bg-[#e9efe6] border border-[#0b1f17]/10 text-xs font-mono text-[#3d5248] hover:text-[#0b1f17] transition disabled:opacity-50 shadow-sm"
          >
            {resetting ? 'Resetting...' : '🔄 Reset Demo'}
          </button>
        </div>
      </div>

      {/* Project Switcher Bar */}
      {contracts.length > 1 && (
        <div className="p-3 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-[#0b1f17]">Active Contract:</span>
            <div className="flex flex-wrap gap-1.5">
              {contracts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelectContract?.(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    activeContract?.id === c.id
                      ? 'bg-[#0b1f17] text-white shadow-sm'
                      : 'bg-[#f6f5f0] text-[#3d5248] hover:bg-[#e9efe6]'
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </div>
          {isClient && (
            <button
              onClick={onOpenCreateProject}
              className="px-3.5 py-1 rounded-full bg-[#e9efe6] text-[#2f7a50] text-xs font-semibold hover:bg-[#dbe7d7] transition shrink-0"
            >
              + Create New Project
            </button>
          )}
        </div>
      )}

      {/* Cascrow Hero Card: Sage surface with rounded-3xl container */}
      <div className="p-7 rounded-[28px] bg-[#e9efe6] border border-[#0b1f17]/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_1px_rgba(11,31,23,0.05),0_20px_40px_-25px_rgba(11,31,23,0.15)]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#2f7a50] border border-[#0b1f17]/10">
              ACTIVE CONTRACT
            </span>
            <span className="text-xs font-mono text-[#3d5248]">
              {activeContract?.id ?? 'contract_seed_01'}
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9]">
              {activeContract?.status ?? 'ACTIVE'}
            </span>
          </div>
          <h2 className="text-xl font-normal text-[#0b1f17]">
            {activeContract?.title ?? 'Core Payment Gateway & OAuth2 Microservice Contract'}
          </h2>
          <p className="text-xs text-[#3d5248] max-w-2xl leading-relaxed">
            {activeContract?.description ??
              'Milestone-governed software delivery contract for OAuth2 authentication, REST API specification, and payment ledger modules.'}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#3d5248] pt-1">
            <span>
              Total Budget:{' '}
              <strong className="text-[#0b1f17] font-semibold">
                ${((activeContract?.totalBudgetCents ?? 850000) / 100).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}{' '}
                USD
              </strong>
            </span>
            <span>•</span>
            <span>Contractor: <span className="text-[#0b1f17] font-semibold">Marcus Chen</span></span>
            <span>•</span>
            <span>Client Fiduciary: <span className="text-[#0b1f17] font-semibold">Elena Vance</span></span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/reviews')}
            className="px-5 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#183528] text-white text-xs font-medium shadow-md transition whitespace-nowrap"
          >
            {isDev ? 'Submit Delivery Evidence →' : 'Open Review & Pay →'}
          </button>
        </div>
      </div>

      {/* KPI & Risk Summary Section */}
      <IntelligenceControlRoomDashboard
        ledgerRows={ledgerRows}
        scheduleData={scheduleData}
        onSelectQuickFilter={handleFilterAndJump}
      />

      {/* Active Milestones Grid: Pure White Elevated Cards with 24px Radius */}
      <div className="p-7 rounded-[28px] bg-[#edf1ea] border border-[#0b1f17]/10 space-y-4">
        <div className="flex items-center justify-between border-b border-[#0b1f17]/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-[1.5px] bg-[#2f7a50] inline-block" />
              <h3 className="text-lg font-normal text-[#0b1f17]">
                Milestones & Agreed Deliverables
              </h3>
            </div>
            <p className="text-xs text-[#3d5248] mt-0.5">
              Select any milestone to inspect technical delivery evidence, AI reasoning, and release authorization.
            </p>
          </div>
          <span className="text-xs font-mono text-[#3d5248] bg-white px-3 py-1 rounded-full border border-[#0b1f17]/10 shadow-sm">
            {ledgerRows.length} Milestones
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ledgerRows.map((row) => {
            const isApproved =
              row.milestoneStatus === 'APPROVED' || row.stateMachineStatus === 'APPROVED';
            const isPendingReview = row.stateMachineStatus === 'PENDING_REVIEW';

            return (
              <div
                key={row.milestoneId}
                onClick={() => {
                  onSelectMilestone(row.milestoneId);
                  navigate('/reviews');
                }}
                className="p-5 rounded-[22px] bg-white border border-[#0b1f17]/10 hover:border-[#2f7a50]/40 transition cursor-pointer space-y-3 group shadow-[0_1px_rgba(11,31,23,0.04),0_12px_24px_-16px_rgba(11,31,23,0.08)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#f6f5f0] text-[#3d5248] border border-[#0b1f17]/10 font-semibold">
                    Milestone {row.sequenceOrder}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border ${
                      isApproved
                        ? 'bg-[#e9efe6] text-[#2f7a50] border-[#2f7a50]/30'
                        : isPendingReview
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-[#f6f5f0] text-[#3d5248] border-[#0b1f17]/10'
                    }`}
                  >
                    {row.stateMachineStatus}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-[#0b1f17] group-hover:text-[#2f7a50] transition">
                    {row.milestoneTitle}
                  </h4>
                  <div className="text-[11px] text-[#3d5248] font-mono mt-1">
                    Deadline: {row.deadlineIso?.slice(0, 10) ?? '2026-11-20'}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#0b1f17]/10 text-xs font-mono">
                  <span className="text-[#3d5248] text-[11px]">Agreed Budget:</span>
                  <span className="text-[#0b1f17] font-semibold text-sm">
                    ${(row.agreedAmountCents / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cascrow-Style 3 Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
        <div
          onClick={() => navigate('/intelligence')}
          className="p-6 rounded-[24px] bg-[#e9efe6] border border-[#0b1f17]/10 hover:border-[#2f7a50]/40 transition cursor-pointer space-y-2.5 group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">⚡</span>
            <span className="text-xs text-[#2f7a50] font-mono group-hover:translate-x-1 transition font-medium">
              Open Grid →
            </span>
          </div>
          <h3 className="text-base font-normal text-[#0b1f17]">AG Grid Decision Cockpit</h3>
          <p className="text-xs text-[#3d5248] leading-relaxed">
            Multi-column investigation, natural-language query parser, and Master/Detail evidence cards.
          </p>
        </div>

        <div
          onClick={() => navigate('/timeline')}
          className="p-6 rounded-[24px] bg-[#e9efe6] border border-[#0b1f17]/10 hover:border-[#2f7a50]/40 transition cursor-pointer space-y-2.5 group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">◷</span>
            <span className="text-xs text-[#2f7a50] font-mono group-hover:translate-x-1 transition font-medium">
              Open Timeline →
            </span>
          </div>
          <h3 className="text-base font-normal text-[#0b1f17]">Bryntum Delivery Timeline</h3>
          <p className="text-xs text-[#3d5248] leading-relaxed">
            Interactive Gantt schedule, Finish-to-Start dependencies, critical path, and AI recovery proposals.
          </p>
        </div>

        <div
          onClick={() => navigate('/trust')}
          className="p-6 rounded-[24px] bg-[#e9efe6] border border-[#0b1f17]/10 hover:border-[#2f7a50]/40 transition cursor-pointer space-y-2.5 group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🛡</span>
            <span className="text-xs text-[#2f7a50] font-mono group-hover:translate-x-1 transition font-medium">
              Open Passport →
            </span>
          </div>
          <h3 className="text-base font-normal text-[#0b1f17]">Cryptographic Evidence Passport</h3>
          <p className="text-xs text-[#3d5248] leading-relaxed">
            SLSA build provenance, tamper-evident digests, runtime smoke checks, and exportable dispute packs.
          </p>
        </div>
      </div>
    </div>
  );
}
