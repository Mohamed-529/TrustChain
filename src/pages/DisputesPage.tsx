import React from 'react';
import { DisputeEvidencePackViewer } from '../components/DisputeEvidencePackViewer.tsx';
import type { DisputeEvidencePack } from '../types/domain.ts';

interface DisputesPageProps {
  disputePack: DisputeEvidencePack | null;
  token: string;
  selectedContractId: string;
  selectedMilestoneId: string;
  onGenerateDisputePack: (reason?: string) => Promise<void>;
  onVerifyDisputePack: () => Promise<void>;
  onExportDisputePack: () => Promise<void>;
  loading: boolean;
}

export function DisputesPage({
  disputePack,
  token,
  selectedContractId,
  selectedMilestoneId,
  onGenerateDisputePack,
  onVerifyDisputePack,
  onExportDisputePack,
  loading,
}: DisputesPageProps) {
  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <h1 className="text-xl font-bold text-white">
              Dispute Evidence Pack & Arbitration Suite
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Traceable engineering evidence record aggregating milestone criteria, GitHub telemetry, Evidence Passport, immutable audit replay, and human approval for external dispute resolution.
          </p>
        </div>
      </div>

      {/* Primary Dispute Evidence Pack Viewer */}
      <div id="dispute-evidence-pack-section">
        <DisputeEvidencePackViewer
          disputePack={disputePack}
          loading={loading}
          onGeneratePack={onGenerateDisputePack}
          onVerifyPack={async () => {
            await onVerifyDisputePack();
            return null;
          }}
          onExportPack={() => void onExportDisputePack()}
        />
      </div>
    </div>
  );
}
