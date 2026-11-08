import React, { useState, useEffect } from 'react';
import type {
  FinancialLedgerRow,
  EvidenceSubmission,
  EvidenceProvenanceVerificationRecord,
  EvidencePassport,
} from '../../types/domain';

interface EvidenceDetailPanelProps {
  data: FinancialLedgerRow;
  token: string;
  onOpenPassport?: (milestoneId: string) => void;
  onOpenDisputePack?: (milestoneId: string) => void;
  onOpenAiInspector?: (milestoneId: string) => void;
}

export function EvidenceDetailPanel({
  data,
  token,
  onOpenPassport,
  onOpenDisputePack,
  onOpenAiInspector,
}: EvidenceDetailPanelProps) {
  const [evidence, setEvidence] = useState<EvidenceSubmission[]>([]);
  const [provenance, setProvenance] = useState<EvidenceProvenanceVerificationRecord | null>(null);
  const [passport, setPassport] = useState<EvidencePassport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchDetailData() {
      if (!token) return;
      setLoading(true);
      setFetchError(null);
      try {
        const [evRes, provRes, passRes] = await Promise.all([
          fetch(`/api/v1/milestones/${data.milestoneId}/evidence`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/v1/milestones/${data.milestoneId}/evidence/provenance`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(
            `/api/v1/contracts/${data.contractId}/milestones/${data.milestoneId}/evidence-passport`,
            { headers: { Authorization: `Bearer ${token}` } }
          ),
        ]);

        if (isMounted) {
          if (evRes.ok) {
            const evJson = await evRes.json();
            setEvidence(evJson.evidence ?? []);
          }
          if (provRes.ok) {
            const provJson = await provRes.json();
            setProvenance(provJson.latestProvenance ?? null);
          }
          if (passRes.ok) {
            const passJson = await passRes.json();
            setPassport(passJson.passport ?? null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setFetchError(err instanceof Error ? err.message : 'Error fetching evidence details');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void fetchDetailData();
    return () => {
      isMounted = false;
    };
  }, [data.milestoneId, data.contractId, token]);

  const latestSub = evidence[0] ?? null;

  return (
    <div className="bg-slate-950 border-t border-b border-indigo-900/60 p-4 space-y-4 text-xs font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
            MASTER/DETAIL EVIDENCE INVESTIGATION
          </span>
          <span className="text-white font-semibold">
            {data.milestoneTitle} ({data.milestoneId})
          </span>
          <span className="text-slate-400 font-mono">Contract: {data.contractTitle}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenAiInspector?.(data.milestoneId)}
            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 font-medium text-white text-[11px] flex items-center gap-1"
          >
            <span>🤖</span> AI Decision Inspector
          </button>
          <button
            onClick={() => onOpenPassport?.(data.milestoneId)}
            className="px-2.5 py-1 rounded bg-sky-700 hover:bg-sky-600 font-medium text-white text-[11px] flex items-center gap-1"
          >
            <span>🛡️</span> View Evidence Passport
          </button>
          <button
            onClick={() => onOpenDisputePack?.(data.milestoneId)}
            className="px-2.5 py-1 rounded bg-purple-700 hover:bg-purple-600 font-medium text-white text-[11px] flex items-center gap-1"
          >
            <span>⚖️</span> Dispute Pack
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 py-3">
          <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading authoritative delivery evidence from backend...</span>
        </div>
      )}

      {fetchError && (
        <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300">
          Failed to load live evidence details: {fetchError}
        </div>
      )}

      {!loading && !fetchError && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Tile 1: Source & Git Telemetry */}
          <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span className="text-indigo-300 font-mono">1. SOURCE & COMMITS</span>
              <span className="text-[10px] text-slate-500">AUTHORITATIVE</span>
            </div>
            {latestSub ? (
              <div className="space-y-1 font-mono text-[11px]">
                <div className="truncate text-slate-200" title={latestSub.repoUrl}>
                  Repo: {latestSub.repoUrl.replace('https://github.com/', '')}
                </div>
                <div className="text-slate-300">
                  Commit: <span className="text-sky-400">{latestSub.commitSha.slice(0, 10)}</span>
                </div>
                <div className="text-slate-400 text-[10px]">
                  Branch: {latestSub.branch} • Attempt #{latestSub.attemptNumber}
                </div>
                {provenance?.commit && (
                  <div className="text-[10px] text-emerald-400 pt-0.5">
                    Commit Status: {provenance.commit.status}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 italic text-[11px]">No Git submission recorded.</p>
            )}
          </div>

          {/* Tile 2: Pull Request & Peer Review */}
          <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span className="text-indigo-300 font-mono">2. PULL REQUEST</span>
              <span className="text-[10px] text-slate-500">GITHUB REST API</span>
            </div>
            {latestSub?.prUrl ? (
              <div className="space-y-1 font-mono text-[11px]">
                <div className="truncate text-slate-200">
                  <a
                    href={latestSub.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline hover:text-indigo-300"
                  >
                    PR #{latestSub.prUrl.split('/').pop()}
                  </a>
                </div>
                <div className="text-slate-300">
                  State:{' '}
                  <span
                    className={
                      latestSub.prStatus === 'MERGED'
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400'
                    }
                  >
                    {latestSub.prStatus}
                  </span>
                </div>
                {provenance?.pullRequest && (
                  <div className="text-[10px] text-slate-400">
                    Verified: {provenance.pullRequest.status}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 italic text-[11px]">No PR attached to milestone.</p>
            )}
          </div>

          {/* Tile 3: CI/CD & Security Telemetry */}
          <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span className="text-indigo-300 font-mono">3. CI & SECURITY</span>
              <span className="text-[10px] text-slate-500">PIPELINE VERIFIED</span>
            </div>
            {latestSub ? (
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">CI Execution:</span>
                  <span
                    className={
                      latestSub.ciReport.status === 'SUCCESS'
                        ? 'text-emerald-400 font-bold'
                        : 'text-rose-400 font-bold'
                    }
                  >
                    {latestSub.ciReport.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Tests: {latestSub.ciReport.passedTests}/{latestSub.ciReport.totalTests} passed (
                  {latestSub.ciReport.coveragePct}% cov)
                </div>
                <div className="text-[10px] text-slate-400">
                  Scanner: {latestSub.securityScan.scanner} ({latestSub.securityScan.status})
                </div>
                <div
                  className={`text-[10px] font-semibold ${
                    latestSub.securityScan.findings.length === 0
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  Findings: {latestSub.securityScan.findings.length} reported
                </div>
              </div>
            ) : (
              <p className="text-slate-500 italic text-[11px]">No CI telemetry submitted.</p>
            )}
          </div>

          {/* Tile 4: Evidence Passport & Integrity Digest */}
          <div className="p-3 rounded bg-slate-900 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span className="text-indigo-300 font-mono">4. PASSPORT & AUDIT</span>
              <span className="text-[10px] text-slate-500">CRYPTOGRAPHIC</span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div>
                Passport:{' '}
                <span
                  className={
                    passport?.identity.overallStatus === 'VERIFIED'
                      ? 'text-emerald-400 font-bold'
                      : passport
                        ? 'text-amber-400'
                        : 'text-slate-500'
                  }
                >
                  {passport?.identity.overallStatus ?? 'NOT_GENERATED'}
                </span>
              </div>
              {passport && (
                <div className="text-[10px] text-slate-400 truncate" title={passport.passportDigestSha256}>
                  Digest: {passport.passportDigestSha256.slice(0, 14)}…
                </div>
              )}
              <div className="text-[10px] text-slate-400">
                Audit Events: {data.auditEventCount} recorded
              </div>
              {data.latestAuditEntryHash && (
                <div className="text-[10px] text-slate-500 truncate" title={data.latestAuditEntryHash}>
                  Chain Tip: {data.latestAuditEntryHash.slice(0, 14)}…
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attribution Disclaimer & Security Boundary Notice */}
      <div className="text-[11px] text-slate-500 border-t border-slate-900 pt-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-400">Attribution Notice:</span> SHA-256 hashes and
          GitHub API verifications confirm artifact identity and provenance. AI synthesis is strictly advisory; human fiduciary review is required before settlement.
        </div>
        <div className="font-mono text-[10px] text-slate-400">
          Updated: {data.updatedAt.slice(0, 19).replace('T', ' ')}
        </div>
      </div>
    </div>
  );
}
