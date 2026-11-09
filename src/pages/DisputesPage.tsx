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
      {/* 1-Line Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚖️</span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Dispute Evidence Pack & Arbitration Suite
            </h1>
          </div>
          {/* EXACTLY 1 LINE DESCRIPTION */}
          <p className="text-xs text-zinc-400 mt-1">
            Tamper-evident arbitration bundle: GitHub telemetry, Evidence Passport, immutable audit replay, and portable JSON export.
          </p>
        </div>
      </div>

      {/* Primary Dispute Evidence Pack Viewer */}
      <div id="dispute-evidence-pack-section" className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
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
