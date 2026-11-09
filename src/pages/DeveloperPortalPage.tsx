/**
 * DeveloperPortalPage — APIMatic Sponsor Excellence & OpenAPI 3.0.3 Contract Explorer
 *
 * Provides a sleek, interactive developer experience covering:
 * - OpenAPI 3.0.3 canonical specification discovery (JSON / YAML)
 * - APIMatic CodeGen configuration and validation metadata
 * - Strongly-typed TypeScript SDK quickstart with runnable examples
 * - Complete 54-route interactive catalog across 10 API groups
 * - AI Agent Tool Manifest & Fiduciary Boundary Directory
 * - Security, Idempotency, and Non-Escrow Regulatory Notices
 */

import React, { useState } from 'react';

interface EndpointItem {
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  auth: boolean;
  role?: string;
  tag: string;
}

const API_ENDPOINTS: EndpointItem[] = [
  // 1. System
  { method: 'GET', path: '/health', summary: 'Server liveness, SQLite ping latency, and service capability flags', auth: false, tag: 'System' },
  { method: 'GET', path: '/ready', summary: 'Deep operational readiness probe inspecting SQLite, migrations, and memory', auth: false, tag: 'System' },
  { method: 'GET', path: '/openapi.json', summary: 'OpenAPI 3.0.3 canonical specification in JSON format', auth: false, tag: 'System' },
  { method: 'GET', path: '/openapi.yaml', summary: 'OpenAPI 3.0.3 canonical specification in YAML format', auth: false, tag: 'System' },

  // 2. Auth
  { method: 'POST', path: '/auth/login', summary: 'Scrypt-verified credential authentication with HMAC-SHA256 session token', auth: false, tag: 'Auth' },
  { method: 'POST', path: '/auth/demo-switch', summary: 'Fast persona impersonation for hackathon demonstration environments', auth: false, tag: 'Auth' },
  { method: 'GET', path: '/auth/me', summary: 'Inspect active session claims, permissions, and actor metadata', auth: true, tag: 'Auth' },
  { method: 'POST', path: '/auth/logout', summary: 'Revoke active HMAC session and invalidate token', auth: true, tag: 'Auth' },

  // 3. Users
  { method: 'GET', path: '/users', summary: 'List registered platform actors (Clients, Developers, Reviewers)', auth: true, tag: 'Users' },

  // 4. Contracts
  { method: 'GET', path: '/contracts', summary: 'List software contracts visible to authenticated session', auth: true, tag: 'Contracts' },
  { method: 'POST', path: '/contracts', summary: 'Create new software development contract with milestone acceptance criteria', auth: true, role: 'CLIENT', tag: 'Contracts' },
  { method: 'GET', path: '/contracts/:id', summary: 'Retrieve contract details, agreed amount, and milestone hierarchy', auth: true, tag: 'Contracts' },
  { method: 'POST', path: '/contracts/:id/activate', summary: 'Activate draft contract and lock milestones for execution', auth: true, role: 'CLIENT', tag: 'Contracts' },
  { method: 'GET', path: '/contracts/:id/schedule', summary: 'Retrieve Bryntum Gantt schedule, child tasks, baselines, and CPM', auth: true, tag: 'Contracts' },
  { method: 'POST', path: '/contracts/:id/schedule/analyze-risk', summary: 'Trigger AI schedule risk analysis and recovery proposal generation', auth: true, tag: 'Contracts' },
  { method: 'POST', path: '/contracts/:id/schedule/proposals/:proposalId/review', summary: 'Review and approve/reject AI schedule recovery proposal', auth: true, role: 'CLIENT / REVIEWER', tag: 'Contracts' },
  { method: 'POST', path: '/contracts/:id/schedule/demo-scenario', summary: 'Load multi-stage delayed schedule demo scenario', auth: true, tag: 'Contracts' },
  { method: 'POST', path: '/contracts/:id/schedule/baseline', summary: 'Freeze agreed schedule baseline snapshot into audit log', auth: true, role: 'CLIENT / REVIEWER', tag: 'Contracts' },
  { method: 'GET', path: '/contracts/:id/schedule/impact', summary: 'Calculate downstream delay cascade impact using BFS', auth: true, tag: 'Contracts' },
  { method: 'POST', path: '/contracts/:id/schedule/validate-dependencies', summary: 'Validate dependency graph for circular cycles using Kahn algorithm', auth: true, tag: 'Contracts' },

  // 5. Evidence
  { method: 'POST', path: '/milestones/:id/evidence', summary: 'Submit developer delivery evidence (GitHub PR, CI report, security scan)', auth: true, role: 'DEVELOPER', tag: 'Evidence' },
  { method: 'GET', path: '/milestones/:id/evidence', summary: 'List submitted delivery evidence artifacts for milestone', auth: true, tag: 'Evidence' },
  { method: 'POST', path: '/milestones/:id/evidence/verify', summary: 'Verify GitHub commit signatures, trees, and provenance status', auth: true, tag: 'Evidence' },
  { method: 'GET', path: '/milestones/:id/evidence/provenance', summary: 'Retrieve latest cryptographic provenance verification record', auth: true, tag: 'Evidence' },
  { method: 'GET', path: '/contracts/:contractId/milestones/:milestoneId/evidence-passport', summary: 'Retrieve Evidence Passport with Git commit signatures & CI telemetry', auth: true, tag: 'Evidence' },
  { method: 'GET', path: '/milestones/:milestoneId/evidence-passport', summary: 'Direct lookup of Evidence Passport by milestone ID', auth: true, tag: 'Evidence' },
  { method: 'POST', path: '/contracts/:contractId/milestones/:milestoneId/evidence-passport/runtime-validate', summary: 'SSRF-guarded runtime preview validation of deployed application', auth: true, tag: 'Evidence' },
  { method: 'POST', path: '/milestones/:milestoneId/evidence-passport/runtime-validate', summary: 'Direct SSRF-guarded runtime preview validation', auth: true, tag: 'Evidence' },

  // 6. Evaluations
  { method: 'POST', path: '/milestones/:id/evaluate', summary: 'Trigger Gemini multi-agent advisory consensus (Evidence, Risk, Synthesizer)', auth: true, tag: 'Evaluations' },
  { method: 'GET', path: '/milestones/:id/evaluations', summary: 'List historical multi-agent evaluation runs and risk scores', auth: true, tag: 'Evaluations' },

  // 7. SettlementPolicy
  { method: 'POST', path: '/milestones/:id/policy-preview', summary: 'Simulate deterministic integer-cent settlement calculation', auth: true, tag: 'SettlementPolicy' },
  { method: 'GET', path: '/ledger', summary: 'Retrieve AG Grid Financial Decision Intelligence Ledger rows', auth: true, tag: 'SettlementPolicy' },

  // 8. Approvals & Disputes
  { method: 'GET', path: '/milestones/:id/review', summary: 'Retrieve milestone review details, AI advisory summary, and policy recommendation', auth: true, tag: 'Approvals' },
  { method: 'POST', path: '/milestones/:id/review', summary: 'Submit human reviewer sign-off decision with approved payout cents', auth: true, role: 'CLIENT / REVIEWER', tag: 'Approvals' },
  { method: 'POST', path: '/milestones/:id/review/approve', summary: 'Fiduciary human reviewer approval gate for milestone settlement', auth: true, role: 'CLIENT / REVIEWER', tag: 'Approvals' },
  { method: 'POST', path: '/milestones/:id/review/reject', summary: 'Human reviewer rejection of milestone delivery', auth: true, role: 'CLIENT / REVIEWER', tag: 'Approvals' },
  { method: 'POST', path: '/milestones/:id/review/request-changes', summary: 'Human reviewer request for revisions on deliverable', auth: true, role: 'CLIENT / REVIEWER', tag: 'Approvals' },
  { method: 'POST', path: '/contracts/:contractId/milestones/:milestoneId/dispute-pack', summary: 'Generate Dispute Evidence Pack with two-stage non-circular digest anchoring', auth: true, tag: 'Approvals' },
  { method: 'GET', path: '/contracts/:contractId/dispute-packs/:packId', summary: 'Retrieve Dispute Evidence Pack details and chronological audit records', auth: true, tag: 'Approvals' },
  { method: 'GET', path: '/contracts/:contractId/dispute-packs/:packId/verify', summary: 'Cryptographically verify Dispute Evidence Pack digest integrity', auth: true, tag: 'Approvals' },
  { method: 'GET', path: '/contracts/:contractId/dispute-packs/:packId/export', summary: 'Export portable sanitized JSON representation of Dispute Pack', auth: true, tag: 'Approvals' },

  // 9. Payments
  { method: 'POST', path: '/milestones/:id/paypal/order', summary: 'Create PayPal Sandbox order with intent: AUTHORIZE (Hold up to 29 days)', auth: true, role: 'CLIENT', tag: 'Payments' },
  { method: 'POST', path: '/milestones/:id/paypal/authorize', summary: 'Authorize buyer payment hold on PayPal Sandbox', auth: true, role: 'CLIENT', tag: 'Payments' },
  { method: 'POST', path: '/milestones/:id/paypal/capture', summary: 'Capture authorized funds following mandatory human reviewer approval', auth: true, role: 'CLIENT / REVIEWER', tag: 'Payments' },
  { method: 'GET', path: '/milestones/:id/paypal/transactions', summary: 'List payment transactions, authorization IDs, and capture records', auth: true, tag: 'Payments' },
  { method: 'GET', path: '/milestones/:id/paypal/order-details', summary: 'Inspect live PayPal order details directly from PayPal Orders API v2', auth: true, tag: 'Payments' },
  { method: 'GET', path: '/milestones/:id/paypal/reconcile', summary: 'Inspect reconciliation status between local ledger and PayPal', auth: true, tag: 'Payments' },
  { method: 'POST', path: '/milestones/:id/paypal/reconcile', summary: 'Trigger authoritative reconciliation to heal network drift', auth: true, tag: 'Payments' },
  { method: 'POST', path: '/webhooks/paypal', summary: 'Handle PayPal webhook notifications with RSA cert-chain signature verification', auth: false, tag: 'Payments' },
  { method: 'POST', path: '/webhooks/github', summary: 'Handle GitHub PR and release events with HMAC-SHA256 signature verification', auth: false, tag: 'Payments' },

  // 10. Audit
  { method: 'GET', path: '/audit', summary: 'List immutable SHA-256 hash-chained audit log records', auth: true, tag: 'Audit' },
  { method: 'GET', path: '/audit/verify', summary: 'Verify cryptographic integrity of global audit log hash chain', auth: true, tag: 'Audit' },
  { method: 'GET', path: '/contracts/:id/audit/replay', summary: 'Reconstruct contract lifecycle state machine from audit log replay', auth: true, tag: 'Audit' },
  { method: 'GET', path: '/contracts/:id/audit/verify', summary: 'Verify cryptographic SHA-256 hash chain for a specific contract', auth: true, tag: 'Audit' },
];

export function DeveloperPortalPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'sdk' | 'agent' | 'apimatic' | 'security'>('catalog');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedSnippet, setCopiedSnippet] = useState<boolean>(false);

  const tags = ['ALL', 'System', 'Auth', 'Users', 'Contracts', 'Evidence', 'Evaluations', 'SettlementPolicy', 'Approvals', 'Payments', 'Audit'];

  const filteredEndpoints = API_ENDPOINTS.filter((ep) => {
    const matchesTag = selectedTag === 'ALL' || ep.tag === selectedTag;
    const matchesSearch =
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTag && matchesSearch;
  });

  const handleCopyCode = () => {
    const code = `import { MilestoneProofClient } from './src/sdk/MilestoneProofClient.ts';

const client = new MilestoneProofClient({ baseUrl: 'http://localhost:3000/api/v1' });

// Authenticate session
await client.switchDemoPersona({ userId: 'client_01' });

// Retrieve schedule & baselines
const schedule = await client.getContractSchedule('contract_seed_01');
console.log('Contract Schedule:', schedule.contractTitle, schedule.tasks.length);

// Inspect Evidence Passport
const { passport } = await client.getEvidencePassport('ms_seed_01');
console.log('Evidence Passport Digest:', passport.passportDigest);`;

    navigator.clipboard?.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <span className="text-9xl font-mono text-emerald-400">⚡</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                OpenAPI 3.0.3 Specification
              </span>
              <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                APIMatic CodeGen Ready
              </span>
              <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-zinc-800 text-zinc-300">
                54 Operations
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold text-zinc-100 tracking-tight">
              Developer Ecosystem & API Control Tower
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Standardized, type-safe API contract connecting software development deliverables,
              multi-agent AI advisory evaluation, and PayPal Orders API v2 settlement.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <a
              href="/api/v1/openapi.yaml"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors shadow-sm"
            >
              📄 openapi.yaml
            </a>
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors shadow-sm"
            >
              {"{ }"} openapi.json
            </a>
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-mono transition-colors shadow-sm"
            >
              {copiedSnippet ? '✓ Copied SDK Code' : '⚡ Copy SDK Quickstart'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-8 border-b border-zinc-800 pb-px overflow-x-auto">
          {[
            { id: 'catalog', label: 'API Route Catalog (54)', icon: '◈' },
            { id: 'sdk', label: 'TypeScript Client SDK', icon: '⚡' },
            { id: 'agent', label: 'AI Agent Tool Manifest', icon: '🤖' },
            { id: 'apimatic', label: 'APIMatic Metadata & Governance', icon: '⚙' },
            { id: 'security', label: 'Financial Safety Invariants', icon: '🛡' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-400 bg-zinc-900/60'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: API Route Catalog */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/80">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
                    selectedTag === tag
                      ? 'bg-emerald-500 text-zinc-950 font-bold'
                      : 'bg-zinc-800/70 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder="Search endpoints by path or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1.5 text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Endpoint Cards List */}
          <div className="grid grid-cols-1 gap-2.5">
            {filteredEndpoints.map((ep, idx) => (
              <div
                key={idx}
                className="bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/70 hover:border-zinc-700/80 rounded-xl p-3.5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                <div className="flex items-start md:items-center gap-3">
                  <span
                    className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded ${
                      ep.method === 'GET'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <div>
                    <span className="font-mono text-xs font-semibold text-zinc-200 group-hover:text-emerald-300 transition-colors">
                      {ep.path}
                    </span>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{ep.summary}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-400">
                    {ep.tag}
                  </span>
                  {ep.role && (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {ep.role}
                    </span>
                  )}
                  {ep.auth ? (
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                      🔒 Auth
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Public
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredEndpoints.length === 0 && (
              <div className="text-center py-12 bg-zinc-900/20 rounded-xl border border-dashed border-zinc-800 text-zinc-500 text-xs">
                No matching endpoints found for &ldquo;{searchQuery}&rdquo;.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: TypeScript Client SDK */}
      {activeTab === 'sdk' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-base font-bold text-zinc-200">
              Strongly-Typed TypeScript SDK (`MilestoneProofClient`)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Aligned with APIMatic CodeGen specifications and OpenAPI 3.0.3 component schemas.
            </p>

            <div className="mt-4 bg-zinc-950 p-4 rounded-lg font-mono text-xs text-zinc-300 overflow-x-auto border border-zinc-800 leading-relaxed">
              <pre>{`// 1. Initialize client
import { MilestoneProofClient } from './src/sdk/MilestoneProofClient.ts';

const client = new MilestoneProofClient({
  baseUrl: 'http://localhost:3000/api/v1',
  maxRetries: 2,
});

// 2. Authenticate session with scrypt password or demo persona
const { token, user } = await client.loginUser({
  email: 'client@trustchain.local',
  password: 'Password123!',
});

// 3. Inspect schedule, critical path, and baselines
const schedule = await client.getContractSchedule('contract_seed_01');
console.log('Milestones count:', schedule.tasks.length);

// 4. Verify cryptographic Evidence Passport
const { passport } = await client.getEvidencePassport('ms_seed_01');
console.log('Commit Signature Valid:', passport.gitProvenance.isCommitSigned);
console.log('SLSA Level:', passport.ciTelemetry.slsaLevel);

// 5. Freeze agreed schedule baseline (Client or Reviewer only)
const baseline = await client.captureScheduleBaseline('contract_seed_01', {
  label: 'Sprint 1 Scope Agreement Freeze',
});
console.log('Audit Entry Hash:', baseline.auditEntryHash);`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: AI Agent Tool Manifest */}
      {activeTab === 'agent' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-200">
                  AI Agent Tool Directory & Fiduciary Boundaries
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Enforces Financial Safety Rule #1: AI agents are strictly advisory. Payouts and
                  captures require explicit human reviewer sign-off.
                </p>
              </div>
              <span className="px-3 py-1 text-xs font-mono rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Rule #1 Enforced
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-emerald-500/20">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  SAFE READ-ONLY TOOLS
                </span>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Autonomous AI invocation permitted. Zero side-effects.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs font-mono text-zinc-300">
                  <li>• trustchain_get_contract</li>
                  <li>• trustchain_get_schedule</li>
                  <li>• trustchain_get_evidence_passport</li>
                  <li>• trustchain_verify_audit_chain</li>
                  <li>• trustchain_get_dispute_pack</li>
                  <li>• trustchain_get_downstream_impact</li>
                </ul>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-amber-500/20">
                <span className="text-xs font-mono font-bold text-amber-300">
                  SENSITIVE HUMAN GATES
                </span>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Requires explicit authenticated human credential.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs font-mono text-zinc-300">
                  <li>• trustchain_submit_evidence (DEV)</li>
                  <li>• trustchain_capture_baseline (CLIENT)</li>
                  <li>• trustchain_generate_dispute_pack</li>
                </ul>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-red-500/20">
                <span className="text-xs font-mono font-bold text-red-400">
                  BLOCKED FINANCIAL ACTIONS
                </span>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Autonomous AI calls are strictly forbidden & rejected.
                </p>
                <ul className="mt-3 space-y-1.5 text-xs font-mono text-zinc-300">
                  <li>✕ trustchain_approve_milestone</li>
                  <li>✕ trustchain_capture_paypal_payment</li>
                  <li>✕ trustchain_authorize_paypal</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: APIMatic Metadata */}
      {activeTab === 'apimatic' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-base font-bold text-zinc-200">APIMatic CodeGen Settings & Metadata</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Configuration loaded from `APIMATIC-META.json` at project root.
            </p>

            <div className="mt-4 bg-zinc-950 p-4 rounded-lg font-mono text-xs text-zinc-300 overflow-x-auto border border-zinc-800 leading-relaxed">
              <pre>{`{
  "ExportFormats": ["OpenApi3Yaml", "OpenApi3Json"],
  "CodeGenSettings": {
    "SynchronizePackageVersion": true,
    "UseModelPrefix": false,
    "UseMethodPrefix": true,
    "UseEnumPrefix": false,
    "UseControllerPrefix": true,
    "CollectParameters": true,
    "Timeout": 30,
    "RetryConfiguration": {
      "MaxNumberOfRetries": 2,
      "RetryOnTimeout": false,
      "RetryInterval": 1.0,
      "MaximumRetryWaitTime": 10,
      "BackoffFactor": 2,
      "HttpStatusCodesToRetry": [408, 429, 502, 503, 504],
      "HttpMethodsToRetry": ["GET", "POST"]
    }
  },
  "ValidationConfiguration": {
    "SpecificationFile": "openapi.yaml",
    "EnforceUniqueOperationIds": true,
    "EnforceStrictIntegerMonetaryCents": true,
    "DisallowAdditionalPropertiesOnRequests": true,
    "RequireRfc7807ErrorResponses": true
  }
}`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Financial Safety Invariants */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-base font-bold text-zinc-200">Fiduciary & Architectural Invariants</h2>
            <div className="mt-4 space-y-3 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="font-bold text-amber-400">1. Mandatory Non-Escrow Regulatory Disclosure:</span>
                <p className="mt-1 text-zinc-400">
                  TrustChain operates using PayPal Orders API v2 (`intent: AUTHORIZE`). This creates delayed-capture
                  authorization holds up to 29 days. It is NOT a custodial bank escrow account.
                </p>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="font-bold text-emerald-400">2. Deterministic Integer-Cent Calculations:</span>
                <p className="mt-1 text-zinc-400">
                  All monetary values (`totalBudgetCents`, `agreedAmountCents`, `permittedAmountCents`) are
                  strictly calculated as 64-bit integers. Floating-point arithmetic is forbidden to prevent
                  precision drift.
                </p>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                <span className="font-bold text-cyan-400">3. Idempotency & Webhook Signature Verification:</span>
                <p className="mt-1 text-zinc-400">
                  Financial mutations require the `PayPal-Request-Id` idempotency header. Webhooks are verified
                  using PayPal RSA public certificate chains with anti-SSRF IP pinning.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
