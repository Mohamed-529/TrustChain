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
      {/* Cascrow Editorial Kicker & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.08)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-5 h-[1.5px] bg-[#2f7a50] inline-block" />
            <span className="text-[11px] font-mono tracking-wider uppercase text-[#2f7a50] font-semibold">
              Cryptographic Audit Passport
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl text-[#0b1f17] tracking-tight font-normal">
            Evidence Passport & Audit Replay
          </h1>
          <p className="text-xs text-[#3d5248] mt-1 max-w-2xl leading-relaxed">
            Immutable technical delivery record: verified criteria, SHA-256 commit attestations, SLSA provenance, and SSRF-guarded runtime smoke tests.
          </p>
        </div>
      </div>

      {/* Primary Evidence Passport Viewer */}
      <div id="evidence-passport-section" className="rounded-3xl border border-[rgba(11,31,23,0.08)] bg-white overflow-hidden shadow-[0_4px_20px_-2px_rgba(11,31,23,0.05)]">
        <EvidencePassportViewer
          passport={passport}
          loading={loading}
          onRefresh={() => void onRefreshData()}
          onValidateRuntime={onValidateRuntime}
        />
      </div>

      {/* Independent GitHub REST API Provenance & Canonical Integrity Verification */}
      <div className="p-6 rounded-3xl bg-[#e9efe6] border border-[rgba(47,122,80,0.15)] space-y-4 text-xs shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(47,122,80,0.15)] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono">
              GITHUB API PROVENANCE
            </span>
            <span className="text-[#0b1f17] font-semibold">Independent Evidence Verification</span>
          </div>
          <button
            disabled={loading}
            onClick={() => void onVerifyGithubProvenance()}
            className="px-4 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-medium text-white text-xs transition disabled:opacity-50 shadow-sm"
          >
            Re-Verify via GitHub API
          </button>
        </div>

        {provenanceData?.latestProvenance ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px] font-mono">
            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] shadow-sm">
              <div className="text-[#6b7f75]">Repository</div>
              <div className="text-[#0b1f17] font-semibold truncate pt-1">
                {provenanceData.latestProvenance.repository.canonicalFullName ??
                  `${provenanceData.latestProvenance.repository.owner}/${provenanceData.latestProvenance.repository.repo}`}
              </div>
              <div className="text-[10px] text-[#2f7a50] pt-0.5 font-sans font-medium">
                {provenanceData.latestProvenance.repository.status}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] shadow-sm">
              <div className="text-[#6b7f75]">Commit SHA</div>
              <div className="text-[#0b1f17] font-semibold truncate pt-1">
                {provenanceData.latestProvenance.commit?.canonicalSha?.slice(0, 12) ??
                  provenanceData.latestProvenance.commit?.submittedSha?.slice(0, 12) ??
                  '—'}
              </div>
              <div className="text-[10px] text-[#2f7a50] pt-0.5 font-sans font-medium">
                {provenanceData.latestProvenance.commit?.status ?? 'UNVERIFIED'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] shadow-sm">
              <div className="text-[#6b7f75]">Pull Request</div>
              <div className="text-[#0b1f17] font-semibold truncate pt-1">
                PR #{provenanceData.latestProvenance.pullRequest?.prNumber ?? '—'}
              </div>
              <div className="text-[10px] text-[#2f7a50] pt-0.5 font-sans font-medium">
                {provenanceData.latestProvenance.pullRequest?.status ?? 'UNVERIFIED'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] shadow-sm">
              <div className="text-[#6b7f75]">CI Workflow Run</div>
              <div className="text-[#0b1f17] font-semibold truncate pt-1">
                Run #{provenanceData.latestProvenance.workflowRun?.runId ?? '—'}
              </div>
              <div className="text-[10px] text-[#2f7a50] pt-0.5 font-sans font-medium">
                {provenanceData.latestProvenance.workflowRun?.status ?? 'UNVERIFIED'}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] text-[#6b7f75] text-center">
            No independent GitHub provenance record available for this milestone yet.
          </div>
        )}
      </div>
    </div>
  );
}
