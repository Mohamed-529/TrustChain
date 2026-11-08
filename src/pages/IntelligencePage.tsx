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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono">
              AG GRID COMMUNITY • V36.3.0
            </span>
            <h1 className="text-xl font-bold text-white">
              Milestone Investigation & Settlement Intelligence Grid
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Enterprise decision-support ledger with multi-column sorting, safe floating filters, column layout persistence, and Master/Detail evidence drilldown.
          </p>
        </div>
      </div>

      {/* Primary AG Grid Table Component */}
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
