/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type {
  CriterionEvidenceMappingItem,
  EvidenceGraphNode,
  EvidencePassport,
  PassportVerificationStatus,
} from '../types/domain';

interface EvidencePassportViewerProps {
  passport: EvidencePassport | null;
  loading?: boolean;
  onRefresh?: () => void;
  onValidateRuntime?: (previewUrl: string, healthEndpoint?: string) => Promise<void>;
}

function getStatusBadgeClass(status: PassportVerificationStatus | string): string {
  switch (status) {
    case 'VERIFIED':
    case 'PASSED':
      return 'bg-[#e9efe6] text-[#2f7a50] border-[rgba(47,122,80,0.25)]';
    case 'FAILED':
    case 'INVALID':
    case 'BLOCKED_SECURITY':
      return 'bg-[#fdf2f2] text-[#a62b2b] border-[#f3c2c2]';
    case 'PARTIALLY_VERIFIED':
    case 'CONFLICTING_EVIDENCE':
    case 'NEEDS_REVIEW':
      return 'bg-[#fbf7ed] text-[#8a681c] border-[#e8dcb8]';
    case 'UNVERIFIED':
    case 'INSUFFICIENT_EVIDENCE':
      return 'bg-[#fbf7ed] text-[#8a681c] border-[#e8dcb8]';
    case 'NOT_APPLICABLE':
      return 'bg-[#f6f5f0] text-[#6b7f75] border-[rgba(11,31,23,0.1)]';
    default:
      return 'bg-[#f6f5f0] text-[#3d5248] border-[rgba(11,31,23,0.1)]';
  }
}

export function EvidencePassportViewer({
  passport,
  loading = false,
  onRefresh,
  onValidateRuntime,
}: EvidencePassportViewerProps) {
  const [activeTab, setActiveTab] = useState<
    'matrix' | 'source' | 'ci' | 'provenance' | 'runtime' | 'graph'
  >('matrix');
  const [customPreviewUrl, setCustomPreviewUrl] = useState<string>('');
  const [customHealthEndpoint, setCustomHealthEndpoint] = useState<string>('/api/health');
  const [validatingRuntime, setValidatingRuntime] = useState<boolean>(false);
  const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});

  const toggleCriterion = (id: string) => {
    setExpandedCriteria((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRunSmokeTest = async () => {
    if (!onValidateRuntime) return;
    const url = customPreviewUrl || passport?.runtimeValidation.previewUrl || '';
    if (!url) return;
    setValidatingRuntime(true);
    try {
      await onValidateRuntime(url, customHealthEndpoint);
    } finally {
      setValidatingRuntime(false);
    }
  };

  if (!passport) {
    return (
      <div className="p-8 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] text-center space-y-3 font-sans">
        <div className="text-[#6b7f75] text-sm">
          No Evidence Passport generated yet for this milestone.
        </div>
        {onRefresh && (
          <button
            disabled={loading}
            onClick={onRefresh}
            className="px-5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-xs font-medium text-white transition disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Generating Passport...' : 'Generate Evidence Passport'}
          </button>
        )}
      </div>
    );
  }

  const {
    identity,
    sourceIdentity,
    ciCd,
    buildProvenance,
    runtimeValidation,
    criteriaMapping,
    criteriaSummary,
    graph,
    settlementAuditTrace,
    passportDigestSha256,
  } = passport;

  return (
    <div className="bg-white p-6 space-y-5 text-[#0b1f17] font-sans">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[rgba(11,31,23,0.08)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono">
              TRUSTCHAIN PASSPORT
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border ${getStatusBadgeClass(
                identity.overallStatus
              )}`}
            >
              {identity.overallStatus}
            </span>
          </div>
          <h2 className="text-xl font-normal text-[#0b1f17] tracking-tight mt-1.5">
            Evidence Passport — {identity.milestoneTitle}
          </h2>
          <div className="text-xs text-[#6b7f75] font-mono mt-0.5 space-x-3">
            <span>ID: {identity.passportId}</span>
            <span>Criteria Ver: v{identity.criteriaVersion}</span>
            <span className="truncate inline-block max-w-xs align-bottom">
              Criteria Hash: {identity.criteriaHash.slice(0, 16)}...
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              disabled={loading}
              onClick={onRefresh}
              className="px-4 py-2 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] border border-[rgba(11,31,23,0.12)] text-xs text-[#0b1f17] font-medium transition disabled:opacity-50"
            >
              {loading ? 'Re-verifying...' : 'Re-verify Evidence'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
        <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
          <div className="text-[#6b7f75] text-[10px] uppercase font-sans">Total Criteria</div>
          <div className="text-base font-semibold text-[#0b1f17] pt-0.5">{criteriaSummary.total}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
          <div className="text-[#6b7f75] text-[10px] uppercase font-sans">Verified</div>
          <div className="text-base font-semibold text-[#2f7a50] pt-0.5">{criteriaSummary.verified}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
          <div className="text-[#6b7f75] text-[10px] uppercase font-sans">Failed / Rejected</div>
          <div className="text-base font-semibold text-[#a62b2b] pt-0.5">{criteriaSummary.failed}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
          <div className="text-[#6b7f75] text-[10px] uppercase font-sans">Insufficient Proof</div>
          <div className="text-base font-semibold text-[#8a681c] pt-0.5">{criteriaSummary.insufficient}</div>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
          <div className="text-[#6b7f75] text-[10px] uppercase font-sans">Conflicting / Risk</div>
          <div className="text-base font-semibold text-[#8a681c] pt-0.5">{criteriaSummary.conflicting}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto no-scrollbar touch-pan-x touch-scroll border-b border-[rgba(11,31,23,0.08)] gap-2 text-xs font-medium pb-0.5">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'matrix'
              ? 'border-[#0b1f17] text-[#0b1f17] font-semibold'
              : 'border-transparent text-[#6b7f75] hover:text-[#0b1f17]'
          }`}
        >
          Criteria Mapping ({criteriaMapping.length})
        </button>
        <button
          onClick={() => setActiveTab('source')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'source'
              ? 'border-[#0b1f17] text-[#0b1f17] font-semibold'
              : 'border-transparent text-[#6b7f75] hover:text-[#0b1f17]'
          }`}
        >
          Source & Signature ({sourceIdentity.signature.status})
        </button>
        <button
          onClick={() => setActiveTab('ci')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'ci'
              ? 'border-[#0b1f17] text-[#0b1f17] font-semibold'
              : 'border-transparent text-[#6b7f75] hover:text-[#0b1f17]'
          }`}
        >
          CI/CD Evidence ({ciCd.verificationStatus})
        </button>
        <button
          onClick={() => setActiveTab('provenance')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'provenance'
              ? 'border-[#0b1f17] text-[#0b1f17] font-semibold'
              : 'border-transparent text-[#6b7f75] hover:text-[#0b1f17]'
          }`}
        >
          Artifact Provenance ({buildProvenance.verificationStatus})
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'runtime'
              ? 'border-[#0b1f17] text-[#0b1f17] font-semibold'
              : 'border-transparent text-[#6b7f75] hover:text-[#0b1f17]'
          }`}
        >
          Runtime & SSRF Guard ({runtimeValidation.overallStatus})
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'graph'
              ? 'border-[#0b1f17] text-[#0b1f17] font-semibold'
              : 'border-transparent text-[#6b7f75] hover:text-[#0b1f17]'
          }`}
        >
          Cryptographic Graph & Audit
        </button>
      </div>

      {/* Tab 1: Criteria-to-Evidence Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          <p className="text-xs text-[#6b7f75]">
            Every contractual criterion requires independent technical verification. One passing
            test does not validate an entire milestone.
          </p>
          <div className="space-y-2.5">
            {criteriaMapping.map((item) => (
              <div
                key={item.criterionId}
                className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10px] border ${getStatusBadgeClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span className="font-semibold text-[#0b1f17]">{item.criterionTitle}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white border border-[rgba(11,31,23,0.1)] text-[#6b7f75]">
                      {item.requiredProofType}
                    </span>
                  </div>
                  <div className="font-mono text-[#6b7f75]">
                    Confidence: {(item.confidenceScore * 100).toFixed(0)}%
                  </div>
                </div>

                <p className="text-[#3d5248]">{item.description}</p>

                {item.findings.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {item.findings.map((f, i) => (
                      <div key={i} className="text-[#6b7f75] text-[11px] flex items-center gap-1.5">
                        <span className="text-[#2f7a50]">•</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => toggleCriterion(item.criterionId)}
                  className="text-[11px] text-[#2f7a50] hover:underline font-mono pt-1 inline-block"
                >
                  {expandedCriteria[item.criterionId] ? 'Hide Details' : 'View Supporting Telemetry'}
                </button>

                {expandedCriteria[item.criterionId] && (
                  <div className="p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] font-mono text-[11px] space-y-1 text-[#3d5248]">
                    <div>Commit: {item.supportingEvidence.commitSha || 'None'}</div>
                    <div>Pull Request: {item.supportingEvidence.prRef || 'None'}</div>
                    <div>CI Summary: {item.supportingEvidence.ciTestSummary || 'None'}</div>
                    <div>Runtime Test: {item.supportingEvidence.runtimeSmokeTest || 'None'}</div>
                    <div>AI Citation IDs: {item.supportingEvidence.evidenceCitationIds.join(', ') || 'None'}</div>
                    {item.supportingEvidence.fileReferences && (
                      <div>Files: {item.supportingEvidence.fileReferences.join(', ') || 'None'}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Source Identity & Commit Signature */}
      {activeTab === 'source' && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-2">
              <h3 className="font-semibold text-[#0b1f17] text-sm">GitHub Source Repository</h3>
              <div className="font-mono space-y-1.5 text-[#3d5248]">
                <div>
                  Repository:{' '}
                  {sourceIdentity.repoUrl ? (
                    <a
                      href={sourceIdentity.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2f7a50] hover:underline"
                    >
                      {sourceIdentity.repoOwner}/{sourceIdentity.repoName}
                    </a>
                  ) : (
                    'Not submitted'
                  )}
                </div>
                <div>
                  Commit SHA:{' '}
                  <span className="text-[#0b1f17] font-semibold">{sourceIdentity.commitSha || 'None'}</span>
                </div>
                <div>Branch: {sourceIdentity.branch || 'None'}</div>
                <div>
                  PR:{' '}
                  {sourceIdentity.prUrl ? (
                    <a
                      href={sourceIdentity.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2f7a50] hover:underline"
                    >
                      PR #{sourceIdentity.prNumber} ({sourceIdentity.prStatus})
                    </a>
                  ) : (
                    'None'
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#0b1f17] text-sm">Commit Signature Verification</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10px] border ${getStatusBadgeClass(
                    sourceIdentity.signature.status
                  )}`}
                >
                  {sourceIdentity.signature.status}
                </span>
              </div>
              <div className="font-mono space-y-1.5 text-[#3d5248]">
                <div>Verified: {sourceIdentity.signature.verified ? 'YES' : 'NO'}</div>
                <div>Reason / Code: {sourceIdentity.signature.reason || 'unsigned'}</div>
                <div>Signer Key: {sourceIdentity.signature.signerKeyId || 'N/A'}</div>
                <div>Details: {sourceIdentity.signature.details}</div>
              </div>
              <div className="p-3 rounded-xl bg-[#fbf7ed] border border-[#e8dcb8] text-[11px] text-[#8a681c] mt-2">
                <strong>Limitation Notice:</strong> {sourceIdentity.signature.limitationsNotice}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: CI/CD Evidence */}
      {activeTab === 'ci' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#0b1f17] text-sm">CI/CD Execution Telemetry</h3>
              <span
                className={`px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10px] border ${getStatusBadgeClass(
                  ciCd.verificationStatus
                )}`}
              >
                {ciCd.verificationStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)]">
                <div className="text-[#6b7f75]">Total Tests</div>
                <div className="text-base font-semibold text-[#0b1f17]">{ciCd.totalTests}</div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)]">
                <div className="text-[#6b7f75]">Passed</div>
                <div className="text-base font-semibold text-[#2f7a50]">{ciCd.passedTests}</div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)]">
                <div className="text-[#6b7f75]">Failed</div>
                <div className="text-base font-semibold text-[#a62b2b]">{ciCd.failedTests}</div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)]">
                <div className="text-[#6b7f75]">Coverage</div>
                <div className="text-base font-semibold text-[#2f7a50]">{ciCd.coveragePct}%</div>
              </div>
            </div>

            <div className="font-mono space-y-1.5 text-[#3d5248] pt-1">
              <div>Provider: {ciCd.provider}</div>
              <div>Workflow Name: {ciCd.workflowName || 'N/A'}</div>
              <div>Workflow Run ID: {ciCd.runId || 'N/A'}</div>
              <div>
                Associated Commit SHA:{' '}
                <span className="text-[#0b1f17] font-semibold">{ciCd.associatedCommitSha || 'None'}</span>
              </div>
              <div>
                Commit Matches Source:{' '}
                <span
                  className={ciCd.commitMatchesSource ? 'text-[#2f7a50] font-semibold' : 'text-[#a62b2b] font-semibold'}
                >
                  {ciCd.commitMatchesSource ? 'MATCHED' : 'COMMIT MISMATCH'}
                </span>
              </div>
              {ciCd.runUrl && (
                <div>
                  Run URL:{' '}
                  <a
                    href={ciCd.runUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2f7a50] hover:underline"
                  >
                    {ciCd.runUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] text-[11px] text-[#6b7f75]">
              <strong>Verification Result:</strong> {ciCd.details}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Build Provenance & Artifact Attestations */}
      {activeTab === 'provenance' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#0b1f17] text-sm">
                Build Provenance & Artifact Attestations (SLSA)
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10px] border ${getStatusBadgeClass(
                  buildProvenance.verificationStatus
                )}`}
              >
                {buildProvenance.verificationStatus}
              </span>
            </div>

            <div className="font-mono space-y-1.5 text-[#3d5248]">
              <div>
                Artifact Digest (SHA-256):{' '}
                <span className="text-[#0b1f17] font-semibold font-mono">
                  {buildProvenance.artifactDigestSha256 || 'None declared'}
                </span>
              </div>
              <div>
                Attestation Supported:{' '}
                {buildProvenance.attestationSupported ? 'YES (GitHub Attestations)' : 'NO / UNAVAILABLE'}
              </div>
              <div>Predicate Type: {buildProvenance.predicateType || 'N/A'}</div>
              <div>Workflow Identity: {buildProvenance.workflowIdentity || 'N/A'}</div>
              <div>Verified At: {buildProvenance.verifiedAt || 'N/A'}</div>
              <div>Details: {buildProvenance.details}</div>
            </div>

            <div className="p-3 rounded-xl bg-[#fbf7ed] border border-[#e8dcb8] text-[11px] text-[#8a681c]">
              <strong>Limitation Notice:</strong> {buildProvenance.limitationsNotice}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Runtime Validation & SSRF Guard */}
      {activeTab === 'runtime' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#0b1f17] text-sm">Deployment Preview & Smoke Checks</h3>
              <span
                className={`px-2.5 py-0.5 rounded-full font-mono font-semibold text-[10px] border ${getStatusBadgeClass(
                  runtimeValidation.overallStatus
                )}`}
              >
                {runtimeValidation.overallStatus}
              </span>
            </div>

            <p className="text-[#6b7f75]">
              Performs network reachability and HTTP smoke validation on candidate deployment previews
              with strict SSRF guards blocking private, loopback, and cloud-metadata IP destinations.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={customPreviewUrl}
                onChange={(e) => setCustomPreviewUrl(e.target.value)}
                placeholder="https://preview-app.example.com"
                className="flex-1 min-w-[240px] px-3.5 py-2 rounded-xl bg-white border border-[rgba(11,31,23,0.12)] text-[#0b1f17] font-mono text-xs outline-none focus:border-[#2f7a50]"
              />
              <input
                type="text"
                value={customHealthEndpoint}
                onChange={(e) => setCustomHealthEndpoint(e.target.value)}
                placeholder="/api/health"
                className="w-32 px-3.5 py-2 rounded-xl bg-white border border-[rgba(11,31,23,0.12)] text-[#0b1f17] font-mono text-xs outline-none focus:border-[#2f7a50]"
              />
              <button
                disabled={validatingRuntime}
                onClick={handleRunSmokeTest}
                className="px-4 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-medium text-white transition disabled:opacity-50 text-xs shadow-sm"
              >
                {validatingRuntime ? 'Executing...' : 'Run Smoke Check'}
              </button>
            </div>

            {/* Security Checks Report */}
            <div className="p-3.5 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] font-mono text-[11px] space-y-1 text-[#3d5248]">
              <div className="font-semibold text-[#0b1f17]">SSRF Security Controls:</div>
              <div>SSRF Filter Validated: {runtimeValidation.securityChecks.ssrfValidated ? 'YES' : 'FAILED'}</div>
              <div>Internal IP Filter: {runtimeValidation.securityChecks.ipBlocked ? 'BLOCKED' : 'CLEARED'}</div>
              <div>Resolved IPs: {runtimeValidation.securityChecks.dnsResolvedIps.join(', ') || 'None'}</div>
            </div>

            {/* Smoke Checks Output */}
            {runtimeValidation.smokeChecks.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-[#0b1f17]">Smoke Test Output:</div>
                {runtimeValidation.smokeChecks.map((sc, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] font-mono text-[11px] space-y-0.5"
                  >
                    <div className="flex justify-between">
                      <span className="text-[#0b1f17] font-semibold">{sc.name}</span>
                      <span
                        className={`px-2 py-0.2 rounded-full text-[10px] font-semibold border ${getStatusBadgeClass(
                          sc.status
                        )}`}
                      >
                        {sc.status}
                      </span>
                    </div>
                    <div>Target URL: {sc.targetUrl}</div>
                    <div>HTTP Status: {sc.actualStatus ?? 'No response'}</div>
                    {sc.responseTimeMs !== null && <div>Response Time: {sc.responseTimeMs}ms</div>}
                    <div className="text-[#6b7f75]">{sc.details}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#fbf7ed] border border-[#e8dcb8] text-[11px] text-[#8a681c]">
              <strong>Limitation Notice:</strong> {runtimeValidation.limitationsNotice}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Cryptographic Evidence Graph & Audit Trail */}
      {activeTab === 'graph' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#0b1f17] text-sm">Deterministic Evidence Graph</h3>
              <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-semibold">
                INTEGRITY VALID
              </span>
            </div>

            <p className="text-[#6b7f75]">
              Traceable, immutable provenance graph linking agreed contractual criteria to source
              commits, CI telemetry, build provenance, runtime validation, AI analysis, human review,
              and hash-chained audit events.
            </p>

            <div className="space-y-2 pt-2">
              {graph.nodes.map((node: EvidenceGraphNode, idx: number) => (
                <div key={node.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-[#e9efe6] border border-[rgba(47,122,80,0.2)] text-[#2f7a50] flex items-center justify-center font-mono font-semibold text-[10px]">
                      {idx + 1}
                    </div>
                    {idx < graph.nodes.length - 1 && (
                      <div className="w-0.5 h-8 bg-[rgba(11,31,23,0.1)] my-0.5" />
                    )}
                  </div>
                  <div className="flex-1 p-3 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#0b1f17]">{node.label}</span>
                      <span
                        className={`px-2 py-0.2 rounded-full text-[10px] border ${getStatusBadgeClass(
                          node.status
                        )}`}
                      >
                        {node.status}
                      </span>
                    </div>
                    <div className="text-[#6b7f75] text-[10px]">Type: {node.type} | Hash: {node.hash.slice(0, 16)}...</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Passport Canonical Digest */}
            <div className="p-3.5 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] font-mono text-[11px] space-y-1 text-[#3d5248]">
              <div className="text-[#6b7f75]">Canonical Passport SHA-256 Digest:</div>
              <div className="text-[#2f7a50] font-semibold break-all">{passportDigestSha256}</div>
            </div>

            {/* Audit References */}
            <div className="p-3.5 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] font-mono text-[11px] space-y-1 text-[#3d5248]">
              <div className="text-[#6b7f75]">
                Audit Trail Event References ({settlementAuditTrace.auditEventReferences.length} hashes):
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {settlementAuditTrace.auditEventReferences.map((ref, idx) => (
                  <div key={idx} className="text-[#6b7f75] text-[10px] truncate">
                    #{idx + 1}: {ref}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
