import React from 'react';
import { EvidencePassportViewer } from '../components/EvidencePassportViewer.tsx';
import type {
  EvidencePassport,
  EvidenceProvenanceVerificationRecord,
} from '../types/domain.ts';

interface TrustPageProps {
  passport: EvidencePassport | null;
  provenanceData: {
    latestProvenance: EvidenceProvenanceVerificationRecord | null;
    provenanceHistory: EvidenceProvenanceVerificationRecord[];
  } | null;
  token: string;
  selectedContractId: string;
  selectedMilestoneId: string;
  onRefreshData: () => Promise<void>;
  onVerifyGithubProvenance: () => Promise<void>;
  onValidateRuntime: (url: string, health?: string) => Promise<void>;
  onGeneratePassport: () => Promise<void>;
  loading: boolean;
}

export function TrustPage({
  passport,
  provenanceData,
  token,
  selectedContractId,
  selectedMilestoneId,
  onRefreshData,
  onVerifyGithubProvenance,
  onValidateRuntime,
  onGeneratePassport,
  loading,
}: TrustPageProps) {
  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h1 className="text-xl font-bold text-white">
              Cryptographic Evidence Passport & Audit Replay
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable technical delivery record: verified criteria mapping, SHA-256 commit attestations, CI coverage telemetry, SLSA provenance, and SSRF-guarded runtime smoke tests.
          </p>
        </div>
      </div>

      {/* Primary Evidence Passport Viewer */}
      <div id="evidence-passport-section">
        <EvidencePassportViewer
          passport={passport}
          loading={loading}
          onRefresh={() => void onRefreshData()}
          onValidateRuntime={onValidateRuntime}
        />
      </div>

      {/* Independent GitHub REST API Provenance & Canonical Integrity Verification */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 mr-2">
              PHASE 7 • GITHUB API PROVENANCE
            </span>
            <span className="text-white font-bold">Independent Evidence Verification</span>
          </div>
          <button
            disabled={loading}
            onClick={() => void onVerifyGithubProvenance()}
            className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 font-semibold text-white text-xs transition disabled:opacity-50"
          >
            Re-Verify via GitHub API
          </button>
        </div>

        {provenanceData?.latestProvenance ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px]">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400">Repository</div>
              <div className="text-white font-semibold truncate pt-1">
                {provenanceData.latestProvenance.repository.canonicalFullName ??
                  `${provenanceData.latestProvenance.repository.owner}/${provenanceData.latestProvenance.repository.repo}`}
              </div>
              <div className="text-[10px] text-emerald-400 pt-0.5">
                {provenanceData.latestProvenance.repository.status}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400">Commit SHA</div>
              <div className="text-white font-semibold truncate pt-1">
                {provenanceData.latestProvenance.commit?.canonicalSha?.slice(0, 12) ??
                  provenanceData.latestProvenance.commit?.submittedSha?.slice(0, 12) ??
                  '—'}
              </div>
              <div className="text-[10px] text-emerald-400 pt-0.5">
                {provenanceData.latestProvenance.commit?.status ?? 'UNVERIFIED'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400">Pull Request</div>
              <div className="text-white font-semibold truncate pt-1">
                PR #{provenanceData.latestProvenance.pullRequest?.prNumber ?? '—'}
              </div>
              <div className="text-[10px] text-emerald-400 pt-0.5">
                {provenanceData.latestProvenance.pullRequest?.status ?? 'UNVERIFIED'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-slate-400">CI Workflow Run</div>
              <div className="text-white font-semibold truncate pt-1">
                Run #{provenanceData.latestProvenance.workflowRun?.runId ?? '—'}
              </div>
              <div className="text-[10px] text-emerald-400 pt-0.5">
                {provenanceData.latestProvenance.workflowRun?.status ?? 'UNVERIFIED'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-center">
            No independent GitHub provenance record available for this milestone yet.
          </div>
        )}
      </div>
    </div>
  );
}
