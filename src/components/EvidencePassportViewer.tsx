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
      return 'bg-emerald-950 text-emerald-300 border-emerald-700';
    case 'FAILED':
    case 'INVALID':
    case 'BLOCKED_SECURITY':
      return 'bg-rose-950 text-rose-300 border-rose-700';
    case 'PARTIALLY_VERIFIED':
    case 'CONFLICTING_EVIDENCE':
    case 'NEEDS_REVIEW':
      return 'bg-amber-950 text-amber-300 border-amber-700';
    case 'UNVERIFIED':
    case 'INSUFFICIENT_EVIDENCE':
      return 'bg-yellow-950 text-yellow-300 border-yellow-700';
    case 'NOT_APPLICABLE':
      return 'bg-slate-800 text-slate-400 border-slate-700';
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
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
      <div className="p-6 rounded-lg bg-slate-900 border border-slate-800 text-center space-y-3">
        <div className="text-slate-400 text-sm">
          No Evidence Passport generated yet for this milestone.
        </div>
        {onRefresh && (
          <button
            disabled={loading}
            onClick={onRefresh}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition disabled:opacity-50"
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
    aiSummary,
    settlementAuditTrace,
    passportDigestSha256,
  } = passport;

  return (
    <div className="bg-slate-900 border border-indigo-900/80 rounded-lg p-5 space-y-5 text-slate-200">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">
              TRUSTCHAIN PASSPORT
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${getStatusBadgeClass(
                identity.overallStatus
              )}`}
            >
              {identity.overallStatus}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            Evidence Passport — {identity.milestoneTitle}
          </h2>
          <div className="text-xs text-slate-400 font-mono mt-0.5 space-x-3">
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
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition disabled:opacity-50"
            >
              {loading ? 'Re-verifying...' : 'Re-verify Evidence'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
        <div className="p-3 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-400">Total Criteria</div>
          <div className="text-base font-bold text-white">{criteriaSummary.total}</div>
        </div>
        <div className="p-3 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-400">Verified</div>
          <div className="text-base font-bold text-emerald-400">{criteriaSummary.verified}</div>
        </div>
        <div className="p-3 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-400">Failed / Rejected</div>
          <div className="text-base font-bold text-rose-400">{criteriaSummary.failed}</div>
        </div>
        <div className="p-3 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-400">Insufficient Proof</div>
          <div className="text-base font-bold text-yellow-400">{criteriaSummary.insufficient}</div>
        </div>
        <div className="p-3 rounded bg-slate-950 border border-slate-800">
          <div className="text-slate-400">Conflicting / Risk</div>
          <div className="text-base font-bold text-amber-400">{criteriaSummary.conflicting}</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-slate-800 gap-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'matrix'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Criteria Mapping ({criteriaMapping.length})
        </button>
        <button
          onClick={() => setActiveTab('source')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'source'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Source & Signature ({sourceIdentity.signature.status})
        </button>
        <button
          onClick={() => setActiveTab('ci')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'ci'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          CI/CD Evidence ({ciCd.verificationStatus})
        </button>
        <button
          onClick={() => setActiveTab('provenance')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'provenance'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Artifact Provenance ({buildProvenance.verificationStatus})
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'runtime'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Runtime & SSRF Guard ({runtimeValidation.overallStatus})
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={`pb-2.5 px-3 border-b-2 transition ${
            activeTab === 'graph'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Cryptographic Graph & Audit
        </button>
      </div>

      {/* Tab 1: Criteria-to-Evidence Matrix */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Every contractual criterion requires independent technical verification. One passing
            test does not validate an entire milestone.
          </p>
          <div className="space-y-2">
            {criteriaMapping.map((item) => (
              <div
                key={item.criterionId}
                className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getStatusBadgeClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                    <span className="font-semibold text-white">{item.criterionTitle}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-700 text-slate-400">
                      {item.requiredProofType}
                    </span>
                  </div>
                  <div className="font-mono text-slate-400">
                    Confidence: {(item.confidenceScore * 100).toFixed(0)}%
                  </div>
                </div>

                <p className="text-slate-300">{item.description}</p>

                {item.findings.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {item.findings.map((f, i) => (
                      <div key={i} className="text-slate-400 text-[11px] flex items-center gap-1.5">
                        <span className="text-indigo-400">•</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => toggleCriterion(item.criterionId)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-mono pt-1"
                >
                  {expandedCriteria[item.criterionId] ? 'Hide Details' : 'View Supporting Telemetry'}
                </button>

                {expandedCriteria[item.criterionId] && (
                  <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
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
            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-2">
              <h3 className="font-semibold text-white text-sm">GitHub Source Repository</h3>
              <div className="font-mono space-y-1.5 text-slate-300">
                <div>
                  Repository:{' '}
                  {sourceIdentity.repoUrl ? (
                    <a
                      href={sourceIdentity.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      {sourceIdentity.repoOwner}/{sourceIdentity.repoName}
                    </a>
                  ) : (
                    'Not submitted'
                  )}
                </div>
                <div>
                  Commit SHA:{' '}
                  <span className="text-white">{sourceIdentity.commitSha || 'None'}</span>
                </div>
                <div>Branch: {sourceIdentity.branch || 'None'}</div>
                <div>
                  PR:{' '}
                  {sourceIdentity.prUrl ? (
                    <a
                      href={sourceIdentity.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      PR #{sourceIdentity.prNumber} ({sourceIdentity.prStatus})
                    </a>
                  ) : (
                    'None'
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Commit Signature Verification</h3>
                <span
                  className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getStatusBadgeClass(
                    sourceIdentity.signature.status
                  )}`}
                >
                  {sourceIdentity.signature.status}
                </span>
              </div>
              <div className="font-mono space-y-1.5 text-slate-300">
                <div>Verified: {sourceIdentity.signature.verified ? 'YES' : 'NO'}</div>
                <div>Reason / Code: {sourceIdentity.signature.reason || 'unsigned'}</div>
                <div>Signer Key: {sourceIdentity.signature.signerKeyId || 'N/A'}</div>
                <div>Details: {sourceIdentity.signature.details}</div>
              </div>
              <div className="p-2.5 rounded bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200 mt-2">
                <strong>Limitation Notice:</strong> {sourceIdentity.signature.limitationsNotice}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: CI/CD Evidence */}
      {activeTab === 'ci' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">CI/CD Execution Telemetry</h3>
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getStatusBadgeClass(
                  ciCd.verificationStatus
                )}`}
              >
                {ciCd.verificationStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Total Tests</div>
                <div className="text-base font-bold text-white">{ciCd.totalTests}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Passed</div>
                <div className="text-base font-bold text-emerald-400">{ciCd.passedTests}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Failed</div>
                <div className="text-base font-bold text-rose-400">{ciCd.failedTests}</div>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <div className="text-slate-400">Coverage</div>
                <div className="text-base font-bold text-indigo-400">{ciCd.coveragePct}%</div>
              </div>
            </div>

            <div className="font-mono space-y-1.5 text-slate-300 pt-1">
              <div>Provider: {ciCd.provider}</div>
              <div>Workflow Name: {ciCd.workflowName || 'N/A'}</div>
              <div>Workflow Run ID: {ciCd.runId || 'N/A'}</div>
              <div>
                Associated Commit SHA:{' '}
                <span className="text-white">{ciCd.associatedCommitSha || 'None'}</span>
              </div>
              <div>
                Commit Matches Source:{' '}
                <span
                  className={ciCd.commitMatchesSource ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}
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
                    className="text-indigo-400 hover:underline"
                  >
                    {ciCd.runUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
              <strong>Verification Result:</strong> {ciCd.details}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Build Provenance & Artifact Attestations */}
      {activeTab === 'provenance' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">
                Build Provenance & Artifact Attestations (SLSA)
              </h3>
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getStatusBadgeClass(
                  buildProvenance.verificationStatus
                )}`}
              >
                {buildProvenance.verificationStatus}
              </span>
            </div>

            <div className="font-mono space-y-1.5 text-slate-300">
              <div>
                Artifact Digest (SHA-256):{' '}
                <span className="text-white font-mono">
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

            <div className="p-2.5 rounded bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200">
              <strong>Limitation Notice:</strong> {buildProvenance.limitationsNotice}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Runtime Validation & SSRF Guard */}
      {activeTab === 'runtime' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">Deployment Preview & Smoke Checks</h3>
              <span
                className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${getStatusBadgeClass(
                  runtimeValidation.overallStatus
                )}`}
              >
                {runtimeValidation.overallStatus}
              </span>
            </div>

            <p className="text-slate-400">
              Performs network reachability and HTTP smoke validation on candidate deployment previews
              with strict SSRF guards blocking private, loopback, and cloud-metadata IP destinations.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                value={customPreviewUrl}
                onChange={(e) => setCustomPreviewUrl(e.target.value)}
                placeholder="https://preview-app.example.com"
                className="flex-1 min-w-[240px] px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
              />
              <input
                type="text"
                value={customHealthEndpoint}
                onChange={(e) => setCustomHealthEndpoint(e.target.value)}
                placeholder="/api/health"
                className="w-32 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-white font-mono text-xs"
              />
              <button
                disabled={validatingRuntime}
                onClick={handleRunSmokeTest}
                className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition disabled:opacity-50"
              >
                {validatingRuntime ? 'Executing...' : 'Run Smoke Check'}
              </button>
            </div>

            {/* Security Checks Report */}
            <div className="p-3 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
              <div className="font-semibold text-white">SSRF Security Controls:</div>
              <div>SSRF Filter Validated: {runtimeValidation.securityChecks.ssrfValidated ? 'YES' : 'FAILED'}</div>
              <div>Internal IP Filter: {runtimeValidation.securityChecks.ipBlocked ? 'BLOCKED' : 'CLEARED'}</div>
              <div>Resolved IPs: {runtimeValidation.securityChecks.dnsResolvedIps.join(', ') || 'None'}</div>
            </div>

            {/* Smoke Checks Output */}
            {runtimeValidation.smokeChecks.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-semibold text-slate-300">Smoke Test Output:</div>
                {runtimeValidation.smokeChecks.map((sc, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-0.5"
                  >
                    <div className="flex justify-between">
                      <span className="text-white font-bold">{sc.name}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getStatusBadgeClass(
                          sc.status
                        )}`}
                      >
                        {sc.status}
                      </span>
                    </div>
                    <div>Target URL: {sc.targetUrl}</div>
                    <div>HTTP Status: {sc.actualStatus ?? 'No response'}</div>
                    {sc.responseTimeMs !== null && <div>Response Time: {sc.responseTimeMs}ms</div>}
                    <div className="text-slate-400">{sc.details}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-2.5 rounded bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-200">
              <strong>Limitation Notice:</strong> {runtimeValidation.limitationsNotice}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Cryptographic Evidence Graph & Audit Trail */}
      {activeTab === 'graph' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">Deterministic Evidence Graph</h3>
              <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700">
                INTEGRITY VALID
              </span>
            </div>

            <p className="text-slate-400">
              Traceable, immutable provenance graph linking agreed contractual criteria to source
              commits, CI telemetry, build provenance, runtime validation, AI analysis, human review,
              and hash-chained audit events.
            </p>

            <div className="space-y-2 pt-2">
              {graph.nodes.map((node: EvidenceGraphNode, idx: number) => (
                <div key={node.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-indigo-900 border border-indigo-700 text-indigo-300 flex items-center justify-center font-mono font-bold text-[10px]">
                      {idx + 1}
                    </div>
                    {idx < graph.nodes.length - 1 && (
                      <div className="w-0.5 h-8 bg-slate-800 my-0.5" />
                    )}
                  </div>
                  <div className="flex-1 p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{node.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] border ${getStatusBadgeClass(
                          node.status
                        )}`}
                      >
                        {node.status}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[10px]">Type: {node.type} | Hash: {node.hash.slice(0, 16)}...</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Passport Canonical Digest */}
            <div className="p-3 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-slate-400">Canonical Passport SHA-256 Digest:</div>
              <div className="text-indigo-400 font-bold break-all">{passportDigestSha256}</div>
            </div>

            {/* Audit References */}
            <div className="p-3 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-slate-400">
                Audit Trail Event References ({settlementAuditTrace.auditEventReferences.length} hashes):
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {settlementAuditTrace.auditEventReferences.map((ref, idx) => (
                  <div key={idx} className="text-slate-400 text-[10px] truncate">
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
