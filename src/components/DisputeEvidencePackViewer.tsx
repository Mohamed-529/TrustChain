/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type {
  DisputeEvidencePack,
  DisputePackVerificationResult,
  DisputeTimelineEvent,
} from '../types/domain';

interface DisputeEvidencePackViewerProps {
  disputePack: DisputeEvidencePack | null;
  loading?: boolean;
  onGeneratePack: (reason?: string) => Promise<void>;
  onVerifyPack: () => Promise<DisputePackVerificationResult | null>;
  onExportPack: () => void;
}

function getStatusBadge(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'COMPLETE':
    case 'VERIFIED':
    case 'PASSED':
      return { bg: 'bg-emerald-950', text: 'text-emerald-300', border: 'border-emerald-700' };
    case 'CORRUPTED_INTEGRITY':
    case 'FAILED':
      return { bg: 'bg-rose-950', text: 'text-rose-300', border: 'border-rose-700' };
    case 'INCOMPLETE_EVIDENCE':
    case 'NEEDS_REVIEW':
      return { bg: 'bg-amber-950', text: 'text-amber-300', border: 'border-amber-700' };
    default:
      return { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' };
  }
}

function getTimelineCategoryBadge(category: string): string {
  switch (category) {
    case 'SUBMISSION':
      return 'bg-blue-950 text-blue-300 border-blue-700';
    case 'VERIFICATION':
    case 'PASSPORT':
      return 'bg-cyan-950 text-cyan-300 border-cyan-700';
    case 'AI_ADVISORY':
      return 'bg-purple-950 text-purple-300 border-purple-700';
    case 'SETTLEMENT_POLICY':
      return 'bg-indigo-950 text-indigo-300 border-indigo-700';
    case 'HUMAN_DECISION':
      return 'bg-amber-950 text-amber-300 border-amber-700';
    case 'PAYMENT':
      return 'bg-emerald-950 text-emerald-300 border-emerald-700';
    case 'DISPUTE':
      return 'bg-rose-950 text-rose-300 border-rose-700';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}

export function DisputeEvidencePackViewer({
  disputePack,
  loading = false,
  onGeneratePack,
  onVerifyPack,
  onExportPack,
}: DisputeEvidencePackViewerProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'summary' | 'advisory' | 'integrity'>(
    'timeline'
  );
  const [verificationResult, setVerificationResult] =
    useState<DisputePackVerificationResult | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [showGenerateForm, setShowGenerateForm] = useState<boolean>(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await onVerifyPack();
      setVerificationResult(res);
    } finally {
      setVerifying(false);
    }
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onGeneratePack(disputeReason.trim() || undefined);
    setShowGenerateForm(false);
    setDisputeReason('');
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5 text-slate-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
              PROMPT 4/8 • DISPUTE EVIDENCE PACK
            </span>
            <span className="text-[11px] text-slate-400">Schema: mpai-dispute-pack-v1</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Dispute Evidence & Arbitration Pack</h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Traceable engineering evidence record aggregating milestone criteria, GitHub commits, CI
            telemetry, Evidence Passport, immutable audit replay, advisory AI synthesis, and human
            approvals.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {!disputePack && !showGenerateForm && (
            <button
              type="button"
              onClick={() => setShowGenerateForm(true)}
              disabled={loading}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs rounded shadow"
            >
              Generate Dispute Evidence Pack
            </button>
          )}

          {disputePack && (
            <>
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || verifying}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded border border-slate-700 text-slate-200 flex items-center gap-1.5"
              >
                {verifying ? 'Verifying...' : 'Verify Cryptographic Integrity'}
              </button>
              <button
                type="button"
                onClick={onExportPack}
                disabled={loading}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded text-white shadow"
              >
                Export Portable JSON
              </button>
              <button
                type="button"
                onClick={() => setShowGenerateForm(true)}
                disabled={loading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded border border-slate-700 text-slate-300"
              >
                Re-generate Pack
              </button>
            </>
          )}
        </div>
      </div>

      {/* Generate Pack Form Modal / Inline Form */}
      {showGenerateForm && (
        <form
          onSubmit={handleGenerateSubmit}
          className="bg-slate-950 border border-slate-700 rounded-lg p-4 space-y-3"
        >
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-white">
              Generate Tamper-Evident Dispute Pack
            </h4>
            <button
              type="button"
              onClick={() => setShowGenerateForm(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-slate-400">
            This will compile all current records, compute non-circular SHA-256 digests, and anchor a
            new immutable audit record. This operation is strictly read-only regarding contract
            finances.
          </p>
          <input
            type="text"
            placeholder="Dispute reason / arbitration notes (optional)..."
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowGenerateForm(false)}
              className="px-3 py-1 bg-slate-800 text-xs rounded text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1 bg-rose-600 hover:bg-rose-500 text-xs font-semibold rounded text-white"
            >
              {loading ? 'Assembling Records...' : 'Assemble & Cryptographically Anchor Pack'}
            </button>
          </div>
        </form>
      )}

      {/* Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-3 rounded border text-xs flex items-center justify-between ${
            verificationResult.isDigestValid && verificationResult.isAuditAnchored
              ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
              : 'bg-rose-950/70 border-rose-700 text-rose-300'
          }`}
        >
          <div className="space-y-0.5">
            <div className="font-bold flex items-center gap-1.5">
              <span>
                {verificationResult.isDigestValid && verificationResult.isAuditAnchored ? '✔' : '✖'}
              </span>
              <span>
                {verificationResult.isDigestValid
                  ? 'Cryptographic Digest Valid & Tamper-Free'
                  : 'INTEGRITY MISMATCH: Pack data has been altered!'}
              </span>
            </div>
            <div className="text-[11px] opacity-90">
              Stored Digest: <code className="font-mono">{verificationResult.storedDigest}</code> •
              Audit Anchor:{' '}
              {verificationResult.isAuditAnchored
                ? 'Anchored in immutable audit log'
                : 'Missing audit log anchor'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVerificationResult(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* No pack state */}
      {!disputePack && !showGenerateForm && (
        <div className="text-center py-8 text-slate-400 space-y-2">
          <p className="text-sm">No Dispute Evidence Pack has been generated for this milestone yet.</p>
          <p className="text-xs text-slate-500">
            Click &quot;Generate Dispute Evidence Pack&quot; to aggregate contract terms, commits, CI
            runs, Evidence Passport, AI review, and audit replay into a sealed evidence package.
          </p>
        </div>
      )}

      {disputePack && (
        <div className="space-y-5">
          {/* Metadata Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block">Pack Status</span>
              {(() => {
                const b = getStatusBadge(disputePack.disputeStatus);
                return (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${b.bg} ${b.text} ${b.border}`}
                  >
                    {disputePack.disputeStatus}
                  </span>
                );
              })()}
              <div className="text-[10px] text-slate-500 truncate" title={disputePack.id}>
                ID: {disputePack.id}
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block">Cryptographic Integrity</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    disputePack.integrity.isCryptographicallyValid
                      ? 'bg-emerald-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`text-xs font-bold ${
                    disputePack.integrity.isCryptographicallyValid
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {disputePack.integrity.isCryptographicallyValid
                    ? 'VERIFIED SEALED'
                    : 'INTEGRITY BREACH'}
                </span>
              </div>
              <div
                className="text-[10px] text-slate-400 font-mono truncate"
                title={disputePack.integrity.packDigestSha256}
              >
                SHA-256: {disputePack.integrity.packDigestSha256.slice(0, 16)}...
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block">Audit Replay & Passport</span>
              <div className="text-xs text-slate-300 font-semibold">
                Audit Chain:{' '}
                <span
                  className={
                    disputePack.auditReplaySummary.isCryptographicallyValid
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }
                >
                  {disputePack.auditReplaySummary.isCryptographicallyValid ? 'VALID' : 'BROKEN'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Passport:{' '}
                <span className="text-slate-300">
                  {disputePack.passportSummary.available
                    ? disputePack.passportSummary.overallStatus
                    : 'UNAVAILABLE'}
                </span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block">Timeline Events</span>
              <div className="text-lg font-bold text-white">{disputePack.timeline.length}</div>
              <div className="text-[10px] text-slate-500">
                Generated {new Date(disputePack.integrity.generatedAt).toLocaleTimeString()} by{' '}
                {disputePack.integrity.generatedBy}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Deterministic Timeline ({disputePack.timeline.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'summary'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Contract & Evidence Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('advisory')}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'advisory'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              AI Advisory & Settlement
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('integrity')}
              className={`px-4 py-2 font-semibold border-b-2 transition-colors ${
                activeTab === 'integrity'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Cryptographic Proof & Hashes
            </button>
          </div>

          {/* Tab 1: Chronological Event Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-3">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Deterministic timeline ordered by timestamp with sequence tie-breaking.</span>
                <span className="text-[11px] text-slate-500">
                  {disputePack.timeline.length} total events recorded
                </span>
              </div>

              <div className="space-y-2">
                {disputePack.timeline.map((evt: DisputeTimelineEvent, idx: number) => {
                  const isExpanded = expandedEventId === evt.id;
                  const catClass = getTimelineCategoryBadge(evt.category);
                  return (
                    <div
                      key={evt.id || idx}
                      className="bg-slate-950 border border-slate-800 rounded p-3 text-xs transition-colors hover:border-slate-700"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[11px]">
                            #{idx + 1}
                            {evt.seq !== undefined ? ` (seq ${evt.seq})` : ''}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catClass}`}
                          >
                            {evt.category}
                          </span>
                          <span className="font-semibold text-white">{evt.action}</span>
                        </div>
                        <div className="text-slate-400 text-[11px]">
                          {new Date(evt.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-2 text-slate-300 flex items-center justify-between">
                        <span>{evt.summary}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-500">
                            Actor: {evt.actorId} ({evt.actorRole})
                          </span>
                          {evt.details && (
                            <button
                              type="button"
                              onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                              className="text-indigo-400 hover:underline text-[11px]"
                            >
                              {isExpanded ? 'Hide Payload' : 'View Payload'}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && evt.details && (
                        <pre className="mt-2 p-2 bg-slate-900 border border-slate-800 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
                          {JSON.stringify(evt.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Contract & Evidence Summary */}
          {activeTab === 'summary' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Contract Terms */}
              <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">Contractual Milestone Terms</h4>
                <div className="space-y-1.5 text-slate-300">
                  <div>
                    <span className="text-slate-500">Contract:</span>{' '}
                    {disputePack.contractSummary.title}
                  </div>
                  <div>
                    <span className="text-slate-500">Milestone:</span>{' '}
                    {disputePack.milestoneSummary.title}
                  </div>
                  <div>
                    <span className="text-slate-500">Agreed Amount:</span> $
                    {(disputePack.milestoneSummary.agreedAmountCents / 100).toFixed(2)}{' '}
                    {disputePack.contractSummary.currency}
                  </div>
                  <div>
                    <span className="text-slate-500">Deadline:</span>{' '}
                    {new Date(disputePack.milestoneSummary.deadlineIso).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="text-slate-500">Parties:</span> Client:{' '}
                    <code>{disputePack.contractSummary.clientId}</code> | Dev:{' '}
                    <code>{disputePack.contractSummary.developerId}</code> | Reviewer:{' '}
                    <code>{disputePack.contractSummary.reviewerId}</code>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="font-semibold text-white mb-1.5">
                    Acceptance Criteria ({disputePack.milestoneSummary.acceptanceCriteria.length})
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {disputePack.milestoneSummary.acceptanceCriteria.map((c, i) => (
                      <div key={c.id || i} className="p-2 bg-slate-900 rounded border border-slate-800">
                        <div className="font-semibold text-slate-200">
                          {i + 1}. {c.title}
                        </div>
                        <div className="text-[11px] text-slate-400">{c.description}</div>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          Proof: {c.requiredProofType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Submissions & Provenance */}
              <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                <h4 className="font-bold text-white text-sm">
                  Submissions & GitHub Provenance ({disputePack.evidenceSubmissions.totalSubmissions})
                </h4>
                {disputePack.evidenceSubmissions.latestSubmission ? (
                  <div className="space-y-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">Latest Commit:</span>{' '}
                      <code className="text-sky-300">
                        {disputePack.evidenceSubmissions.latestSubmission.commitSha.slice(0, 10)}
                      </code>{' '}
                      on branch{' '}
                      <code className="text-slate-300">
                        {disputePack.evidenceSubmissions.latestSubmission.branch}
                      </code>
                    </div>
                    <div>
                      <span className="text-slate-500">Pull Request:</span>{' '}
                      <a
                        href={disputePack.evidenceSubmissions.latestSubmission.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 underline"
                      >
                        {disputePack.evidenceSubmissions.latestSubmission.prUrl}
                      </a>{' '}
                      ({disputePack.evidenceSubmissions.latestSubmission.prStatus})
                    </div>
                    <div>
                      <span className="text-slate-500">CI Telemetry:</span> Status:{' '}
                      <span className="font-semibold">
                        {disputePack.evidenceSubmissions.latestSubmission.ciReport.status}
                      </span>{' '}
                      ({disputePack.evidenceSubmissions.latestSubmission.ciReport.passedTests}/
                      {disputePack.evidenceSubmissions.latestSubmission.ciReport.totalTests} tests passed,{' '}
                      {disputePack.evidenceSubmissions.latestSubmission.ciReport.coveragePct}% coverage)
                    </div>
                    <div>
                      <span className="text-slate-500">Security Scan:</span>{' '}
                      {
                        disputePack.evidenceSubmissions.latestSubmission.securityScan.findings.length
                      }{' '}
                      findings ({disputePack.evidenceSubmissions.latestSubmission.securityScan.status})
                    </div>
                    <div>
                      <span className="text-slate-500">Payload SHA-256:</span>{' '}
                      <code className="font-mono text-[10px] text-slate-400">
                        {disputePack.evidenceSubmissions.latestSubmission.payloadSha256}
                      </code>
                    </div>
                  </div>
                ) : (
                  <div className="text-amber-400 text-xs py-4">
                    No evidence submissions recorded for this milestone.
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800">
                  <div className="font-semibold text-white mb-1">Independent Verification Status</div>
                  <div className="text-slate-300 space-y-1">
                    <div>
                      Provenance Status:{' '}
                      <span className="font-bold text-sky-400">
                        {disputePack.provenanceAndVerification.provenanceStatus}
                      </span>
                    </div>
                    <div>
                      Commit Signature:{' '}
                      {disputePack.provenanceAndVerification.commitVerified
                        ? 'Cryptographically Verified'
                        : 'Unverified / Unsigned'}
                    </div>
                    <div>
                      CI Workflow Valid:{' '}
                      {disputePack.provenanceAndVerification.ciWorkflowValid ? 'Yes' : 'No / Pending'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: AI Advisory Assessment & Settlement Outcome */}
          {activeTab === 'advisory' && (
            <div className="space-y-4 text-xs">
              {/* Mandatory Advisory Disclaimer Banner */}
              <div className="p-3 bg-purple-950/60 border border-purple-800 rounded text-purple-200">
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <span>ℹ</span> MANDATORY AI ADVISORY NOTICE
                </div>
                <p className="text-[11px] leading-relaxed">
                  {disputePack.aiAdvisoryAssessment.advisoryDisclaimer}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AI Multi-Agent Findings */}
                <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                  <h4 className="font-bold text-white text-sm">Multi-Agent AI Findings</h4>
                  {disputePack.aiAdvisoryAssessment.available ? (
                    <div className="space-y-3 text-slate-300">
                      <div>
                        <div className="font-semibold text-slate-200">Evidence Agent:</div>
                        <div className="text-[11px] text-slate-400">
                          Coverage:{' '}
                          {disputePack.aiAdvisoryAssessment.evidenceAgentFindings?.verifiedCount}/
                          {disputePack.aiAdvisoryAssessment.evidenceAgentFindings?.totalCount}{' '}
                          criteria verified
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">Risk Agent:</div>
                        <div className="text-[11px] text-slate-400">
                          Risk Severity:{' '}
                          {disputePack.aiAdvisoryAssessment.riskAgentFindings?.overallRiskSeverity} |
                          Prompt Injection:{' '}
                          {disputePack.aiAdvisoryAssessment.riskAgentFindings?.promptInjectionDetected
                            ? 'DETECTED'
                            : 'None'}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">Review Synthesizer:</div>
                        <div className="text-[11px] text-slate-400">
                          Recommendation:{' '}
                          <span className="font-bold text-white">
                            {
                              disputePack.aiAdvisoryAssessment.reviewSynthesizerRecommendation
                                ?.recommendedOutcome
                            }
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300 bg-slate-900 p-2 rounded border border-slate-800">
                          {
                            disputePack.aiAdvisoryAssessment.reviewSynthesizerRecommendation
                              ?.reasoning
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 py-3">No AI evaluation recorded.</div>
                  )}
                </div>

                {/* Deterministic Settlement & Human Review */}
                <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                  <h4 className="font-bold text-white text-sm">
                    Deterministic Settlement & Human Review
                  </h4>
                  <div className="space-y-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">Permitted Amount:</span>{' '}
                      <span className="font-bold text-white text-sm">
                        ${(disputePack.settlementOutcome.permittedAmountCents / 100).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Late Penalty:</span> $
                      {(disputePack.settlementOutcome.penaltyCents / 100).toFixed(2)}
                    </div>
                    <div>
                      <span className="text-slate-500">Settlement Gate:</span>{' '}
                      <span
                        className={
                          disputePack.settlementOutcome.gateBlocked
                            ? 'text-rose-400 font-bold'
                            : 'text-emerald-400 font-bold'
                        }
                      >
                        {disputePack.settlementOutcome.gateBlocked ? 'BLOCKED' : 'OPEN'}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <div className="font-semibold text-white mb-1">Human Review Records</div>
                      {disputePack.humanApprovalHistory.recorded ? (
                        <div className="space-y-1 text-slate-300">
                          <div>
                            Latest Decision:{' '}
                            <span className="font-bold text-amber-400">
                              {disputePack.humanApprovalHistory.latestDecision}
                            </span>
                          </div>
                          <div>
                            Approved Amount: $
                            {(
                              (disputePack.humanApprovalHistory.approvedAmountCents ?? 0) / 100
                            ).toFixed(2)}
                          </div>
                          <div>
                            Reviewer:{' '}
                            <code>{disputePack.humanApprovalHistory.reviewerId}</code>
                          </div>
                          <div>
                            Justification:{' '}
                            <em>{disputePack.humanApprovalHistory.justification}</em>
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500">No human approval decision recorded.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Cryptographic Proof & Integrity */}
          {activeTab === 'integrity' && (
            <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-4 text-xs">
              <h4 className="font-bold text-white text-sm">
                Two-Stage Non-Circular Cryptographic Hashing
              </h4>
              <p className="text-slate-400 text-xs">
                To guarantee tamper-evidence without circular dependencies between the audit hash-chain
                and the dispute pack, TrustChain employs a two-stage cryptographic anchoring pipeline.
              </p>

              <div className="space-y-3 font-mono">
                <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-[11px]">
                    Stage 1 Digest: Pre-Audit Pack Content (SHA-256)
                  </div>
                  <div className="text-white text-xs select-all">
                    {disputePack.integrity.packContentDigestSha256}
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-[11px]">
                    Stage 2 Audit Log Anchor Entry Hash
                  </div>
                  <div className="text-indigo-300 text-xs select-all">
                    {disputePack.integrity.auditEventReferences.join(', ') || 'No audit reference'}
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded border border-slate-800 space-y-1">
                  <div className="text-slate-400 text-[11px]">
                    Final Pack Digest (SHA-256 over Canonical JSON + Audit Reference)
                  </div>
                  <div className="text-emerald-300 text-xs select-all font-bold">
                    {disputePack.integrity.packDigestSha256}
                  </div>
                </div>
              </div>

              <div className="pt-2 text-slate-500 text-[11px]">
                Generated by user: <code>{disputePack.integrity.generatedBy}</code> at{' '}
                {disputePack.integrity.generatedAt}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
