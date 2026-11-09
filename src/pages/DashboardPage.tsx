import React from 'react';
import { useNavigate } from '../router/Router.tsx';
import { IntelligenceControlRoomDashboard } from '../components/dashboard/IntelligenceControlRoomDashboard.tsx';
import type { FinancialLedgerRow, ContractScheduleResponse } from '../types/domain.ts';

interface DashboardPageProps {
  ledgerRows: FinancialLedgerRow[];
  scheduleData: ContractScheduleResponse | null;
  onSelectQuickFilter: (filter: string) => void;
}

export function DashboardPage({
  ledgerRows,
  scheduleData,
  onSelectQuickFilter,
}: DashboardPageProps) {
  const navigate = useNavigate();

  const handleFilterAndJump = (filterType: string) => {
    onSelectQuickFilter(filterType);
    navigate('/intelligence');
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1-Line Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">▦</span>
            <h1 className="text-xl font-bold text-white tracking-tight">Executive Dashboard</h1>
          </div>
          {/* EXACTLY 1 LINE DESCRIPTION */}
          <p className="text-xs text-zinc-400 mt-1">
            Real-time portfolio telemetry aggregated from active contracts, GitHub telemetry, and PayPal payment records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/intelligence')}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-zinc-950 shadow-md shadow-emerald-600/10 transition"
          >
            Investigate in AG Grid →
          </button>
        </div>
      </div>

      {/* Primary KPI & Risk Distribution Dashboard */}
      <IntelligenceControlRoomDashboard
        ledgerRows={ledgerRows}
        scheduleData={scheduleData}
        onSelectQuickFilter={handleFilterAndJump}
      />

      {/* Clean Quick Access Hub: 1-line descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div
          onClick={() => navigate('/intelligence')}
          className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/60 transition cursor-pointer space-y-2 group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">⚡</span>
            <span className="text-xs text-emerald-400 font-mono group-hover:translate-x-1 transition">
              Open Grid →
            </span>
          </div>
          <h3 className="text-sm font-bold text-white">AG Grid Milestone Cockpit</h3>
          <p className="text-xs text-zinc-400">
            Multi-column investigation, natural-language query parser, and Master/Detail evidence cards.
          </p>
        </div>

        <div
          onClick={() => navigate('/timeline')}
          className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/60 transition cursor-pointer space-y-2 group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">◷</span>
            <span className="text-xs text-emerald-400 font-mono group-hover:translate-x-1 transition">
              Open Timeline →
            </span>
          </div>
          <h3 className="text-sm font-bold text-white">Bryntum Delivery Timeline</h3>
          <p className="text-xs text-zinc-400">
            Interactive Gantt schedule, Finish-to-Start dependencies, critical path, and AI recovery proposals.
          </p>
        </div>

        <div
          onClick={() => navigate('/reviews')}
          className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/60 transition cursor-pointer space-y-2 group shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">◈</span>
            <span className="text-xs text-emerald-400 font-mono group-hover:translate-x-1 transition">
              Open Workbench →
            </span>
          </div>
          <h3 className="text-sm font-bold text-white">Milestone Review & PayPal Settlement</h3>
          <p className="text-xs text-zinc-400">
            Multi-agent advisory findings, deterministic policy cap math, and PayPal 29-day authorization hold and capture.
          </p>
        </div>
      </div>
    </div>
  );
}
