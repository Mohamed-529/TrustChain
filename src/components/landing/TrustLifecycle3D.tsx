import React, { useState } from 'react';

export interface LifecycleNode {
  id: string;
  number: number;
  title: string;
  tagline: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  architecturalInvariants: string[];
  samplePayloadSnippet: string;
}

const LIFECYCLE_NODES: LifecycleNode[] = [
  {
    id: 'evidence',
    number: 1,
    title: 'GitHub Delivery Evidence',
    tagline: 'Cryptographic Provenance & CI Runs',
    icon: '📦',
    color: 'text-sky-400',
    bgColor: 'bg-sky-950/60',
    borderColor: 'border-sky-500',
    description:
      'Developer commits and PRs are ingested with authentic SHA-256 hashes, webhook delivery IDs, and CI/CD test results. External evidence is strictly isolated in untrusted blocks.',
    architecturalInvariants: [
      'X-Hub-Signature-256 webhook HMAC verification',
      'Anti-SSRF IP pinning on external telemetry fetch',
      'Untrusted evidence input boundary isolation',
    ],
    samplePayloadSnippet: '{\n  "commitSha": "a8f4c219e03d",\n  "ciPassed": 64,\n  "ciTotal": 64,\n  "coveragePct": 91.5\n}',
  },
  {
    id: 'ai-analysis',
    number: 2,
    title: 'Multi-Agent Advisory AI',
    tagline: 'Tri-Agent Synthesis (Advisory Only)',
    icon: '🤖',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-950/60',
    borderColor: 'border-indigo-500',
    description:
      'Three specialized agents evaluate delivery: Evidence Agent verifies contract criteria, Risk Agent flags vulnerabilities, and Arbitrator synthesizes advisory recommendations.',
    architecturalInvariants: [
      'Strictly non-authoritative advisory synthesis',
      'Zero financial transaction triggers from AI',
      'Grounded evidence citations required for claims',
    ],
    samplePayloadSnippet: '{\n  "outcome": "PASS",\n  "confidence": 0.95,\n  "isAdvisoryOnly": true,\n  "riskSeverity": "NONE"\n}',
  },
  {
    id: 'policy',
    number: 3,
    title: 'Deterministic Policy Engine',
    tagline: 'Mathematical Cap & Late Penalties',
    icon: '⚖️',
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/60',
    borderColor: 'border-amber-500',
    description:
      'Pure deterministic TypeScript business logic applies contract formulas. Validates integer currency, calculates late penalties, and computes the maximum permitted disbursement cap.',
    architecturalInvariants: [
      'Zero floating-point arithmetic (integer cents only)',
      'Deterministic verification ratio calculation',
      'Permitted amount clamped strictly to agreed budget',
    ],
    samplePayloadSnippet: '{\n  "agreedCents": 250000,\n  "permittedCents": 250000,\n  "latePenaltyCents": 0,\n  "verifiedRatio": 1.0\n}',
  },
  {
    id: 'approval',
    number: 4,
    title: 'Human Fiduciary Review',
    tagline: 'Mandatory Non-Bypassable Gate',
    icon: '🛡️',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/60',
    borderColor: 'border-emerald-500',
    description:
      'The client fiduciary inspects evidence, reviews AI advisory rationale, and explicitly approves or rejects. No automated bypass is architecturally permitted.',
    architecturalInvariants: [
      'Role-based access control (CLIENT / REVIEWER only)',
      'Mandatory fiduciary justification note recorded',
      'Decision immutably anchored in audit history',
    ],
    samplePayloadSnippet: '{\n  "decision": "APPROVE",\n  "reviewer": "client_01",\n  "justification": "Verified CI & PR",\n  "approvedCents": 250000\n}',
  },
  {
    id: 'paypal',
    number: 5,
    title: 'PayPal Orders API v2',
    tagline: 'Authoritative 29-Day Hold & Capture',
    icon: '💳',
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/60',
    borderColor: 'border-blue-500',
    description:
      'Real PayPal Sandbox integration: creates order with intent: AUTHORIZE (holding funds up to 29 days), verified buyer approval, and server-side human-gated idempotent capture.',
    architecturalInvariants: [
      'intent: AUTHORIZE hold (never premature capture)',
      'PayPal-Request-Id idempotency protection',
      'Mandatory regulatory non-escrow notice',
    ],
    samplePayloadSnippet: '{\n  "intent": "AUTHORIZE",\n  "orderId": "0N806388NV784822T",\n  "authId": "63431076A90318908",\n  "captureId": "4L688309CS300123Y"\n}',
  },
  {
    id: 'audit',
    number: 6,
    title: 'Immutable Audit Trail',
    tagline: 'Cryptographic SHA-256 Hash-Chain',
    icon: '🔗',
    color: 'text-purple-400',
    bgColor: 'bg-purple-950/60',
    borderColor: 'border-purple-500',
    description:
      'Every state transition is appended to SQLite with SQLite WAL triggers and chained backwards via canonical SHA-256 hashes for mathematical proof of non-tampering.',
    architecturalInvariants: [
      'Append-only trigger prevents UPDATE / DELETE',
      'Canonical JSON stringification with sorted keys',
      'Full lifecycle state replay & integrity verification',
    ],
    samplePayloadSnippet: '{\n  "seq": 11,\n  "entryHash": "7dc1555038399b7d...",\n  "prevHash": "1cdab248077c5483...",\n  "integrity": "VERIFIED"\n}',
  },
];

export function TrustLifecycle3D() {
  const [selectedNode, setSelectedNode] = useState<LifecycleNode>(LIFECYCLE_NODES[0]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 lg:p-8 relative overflow-hidden backdrop-blur-md shadow-2xl">
      {/* Background Radial Glow */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono">
              INTERACTIVE TRUST ARCHITECTURE
            </span>
            <span className="text-xs text-slate-400">• Click any stage to inspect data contracts</span>
          </div>
          <h3 className="text-xl lg:text-2xl font-bold text-white mt-1">
            TrustChain End-to-End Orchestration Flow
          </h3>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Stage {selectedNode.number} of 6: <span className={selectedNode.color}>{selectedNode.title}</span>
        </div>
      </div>

      {/* Interactive 6-Stage Timeline Graph */}
      <div className="py-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {LIFECYCLE_NODES.map((node) => {
            const isSelected = selectedNode.id === node.id;
            const isHovered = hoveredNodeId === node.id;

            return (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? `${node.bgColor} ${node.borderColor} ring-2 ring-indigo-500/50 shadow-lg scale-102`
                    : isHovered
                    ? 'bg-slate-900 border-slate-700 hover:scale-101'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Connecting arrow indicator on larger screens */}
                {node.number < 6 && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600 text-xs pointer-events-none">
                    →
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-bold">
                    {node.number}
                  </span>
                  <span className="text-base">{node.icon}</span>
                </div>

                <div className="mt-2.5">
                  <div className={`font-semibold text-xs leading-snug ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {node.title}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={node.tagline}>
                    {node.tagline}
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-indigo-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Node Deep-Dive Inspector Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 mt-2 transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Description & Invariants */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl p-2 rounded-lg bg-slate-800 border border-slate-700">
                {selectedNode.icon}
              </span>
              <div>
                <div className="text-xs uppercase tracking-wider font-mono text-slate-400">
                  Stage {selectedNode.number} • {selectedNode.tagline}
                </div>
                <h4 className="text-lg font-bold text-white">{selectedNode.title}</h4>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{selectedNode.description}</p>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono mb-2">
                Mandatory Architectural Invariants:
              </div>
              <ul className="space-y-1.5 text-xs text-slate-200">
                {selectedNode.architecturalInvariants.map((inv, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{inv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: Data Contract Snippet */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-lg p-3.5 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800">
              <span className="text-indigo-300 font-bold">Typed Data Contract</span>
              <span className="text-[10px] text-slate-500">JSON SCHEMA</span>
            </div>
            <pre className="text-emerald-300 text-[11px] overflow-x-auto p-1 leading-relaxed">
              {selectedNode.samplePayloadSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
