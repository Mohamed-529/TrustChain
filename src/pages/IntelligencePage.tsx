import React from 'react';
import { MilestoneIntelligenceGrid } from '../components/ag-grid/MilestoneIntelligenceGrid.tsx';
import { AiDecisionInspectorModal } from '../components/dashboard/AiDecisionInspectorModal.tsx';
import type { FinancialLedgerRow, MilestoneReviewDetails } from '../types/domain.ts';

interface IntelligencePageProps {
  ledgerRows: FinancialLedgerRow[];
  token: string;
  selectedMilestoneId: string;
  onSelectMilestone: (id: string) => void;
  onOpenPassport: (id: string) => void;
  onOpenDisputePack: (id: string) => void;
  showAiInspector: boolean;
  setShowAiInspector: (show: boolean) => void;
  reviewDetails: MilestoneReviewDetails | null;
  quickFilterType: string;
}

export function IntelligencePage({
  ledgerRows,
  token,
  selectedMilestoneId,
  onSelectMilestone,
  onOpenPassport,
  onOpenDisputePack,
  showAiInspector,
  setShowAiInspector,
  reviewDetails,
  quickFilterType,
}: IntelligencePageProps) {
  return (
    <div className="space-y-6 font-sans">
      {/* 1-Line Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 font-mono">
              AG GRID v36 COMMUNITY
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Milestone Intelligence Control Room
            </h1>
          </div>
          {/* EXACTLY 1 LINE DESCRIPTION */}
          <p className="text-xs text-zinc-400 mt-1">
            Enterprise decision-support ledger with natural-language filtering, column layout persistence, and Master/Detail telemetry.
          </p>
        </div>
      </div>

      {/* Primary AG Grid Table Component */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
        <MilestoneIntelligenceGrid
          ledgerRows={ledgerRows}
          token={token}
          selectedMilestoneId={selectedMilestoneId}
          onSelectMilestone={onSelectMilestone}
          onOpenPassport={onOpenPassport}
          onOpenDisputePack={onOpenDisputePack}
          onOpenAiInspector={() => setShowAiInspector(true)}
          quickFilterType={quickFilterType}
        />
      </div>

      {/* AI Decision Inspector Modal */}
      <AiDecisionInspectorModal
        isOpen={showAiInspector}
        onClose={() => setShowAiInspector(false)}
        reviewDetails={reviewDetails}
        onOpenPassport={() => onOpenPassport(selectedMilestoneId)}
        onOpenDisputePack={() => onOpenDisputePack(selectedMilestoneId)}
      />
    </div>
  );
}
