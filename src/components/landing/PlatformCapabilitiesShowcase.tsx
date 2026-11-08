/**
 * PlatformCapabilitiesShowcase — Stage C: Comprehensive Interactive Module Showcase
 *
 * Implements Stage C requirements:
 * 1. Evidence Intelligence
 * 2. Milestone Intelligence (AG Grid)
 * 3. Project Timeline (Bryntum)
 * 4. Human Review
 * 5. Evidence Passport
 * 6. Dispute Evidence Pack
 * 7. PayPal Payment Lifecycle
 *
 * Each card explains its concrete purpose, live sponsor integration, and provides
 * a direct jump link into the operational route.
 */

import React from 'react';
import { useNavigate } from '../../router/Router.tsx';

interface PlatformModule {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  badgeTheme: string;
  icon: string;
  description: string;
  features: string[];
  route: string;
  routeLabel: string;
  sponsorTechnology?: string;
}

const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'evidence',
    title: 'Evidence Intelligence',
    tagline: 'Independent GitHub Provenance & Artifact Verification',
    badge: 'PHASE 7 VERIFIED',
    badgeTheme: 'border-sky-700 bg-sky-950 text-sky-300',
    icon: '🔍',
    description:
      'Inspects raw GitHub telemetry directly via REST API. Verifies repository authenticity, commit SHAs, PR merge status, and CI workflow runs without trusting developer-supplied assertions.',
    features: [
      'Independent GitHub REST API verification',
      'Canonical SHA-256 payload integrity hashing',
      'Mismatched PR and false-claim detection',
      'Anti-tamper SQLite payload verification',
    ],
    route: '/trust',
    routeLabel: 'Open Evidence Passport',
  },
  {
    id: 'ag-grid',
    title: 'Milestone Intelligence Control Room',
    tagline: 'High-Density Decision Ledger with Natural Language Filtering',
    badge: 'AG GRID COMMUNITY v36',
    badgeTheme: 'border-amber-700 bg-amber-950 text-amber-300',
    icon: '⚡',
    sponsorTechnology: 'AG Grid Community v36 (MIT)',
    description:
      'An enterprise investigation interface built on AG Grid Community v36. Features full-width Master/Detail telemetry drawers, multi-field natural-language query translation, and sanitization against CSV injection.',
    features: [
      'Zero-license-key AG Grid v36 Community deployment',
      'Safe NLP query parser with strict column whitelist',
      'Full-width Master/Detail commit and CI drawers',
      'AI Decision Inspector with policy formula breakdown',
    ],
    route: '/intelligence',
    routeLabel: 'Launch Intelligence Grid',
  },
  {
    id: 'timeline',
    title: 'Project Timeline Control Tower',
    tagline: 'Finish-to-Start Schedule Tracking & AI Shift Proposals',
    badge: 'BRYNTUM GANTT v7.3',
    badgeTheme: 'border-indigo-700 bg-indigo-950 text-indigo-300',
    icon: '📅',
    sponsorTechnology: 'Bryntum Gantt v7.3',
    description:
      'Evidence-aware Gantt engine visualizing software delivery milestones, baseline comparisons, variance, and critical paths. When CI delays occur, the AI Advisor formulates schedule shift proposals that strictly preserve contract budgets.',
    features: [
      'Interactive Gantt timeline with baseline variance',
      'Finish-to-Start dependency cascading & critical path',
      'AI Schedule Shift recovery proposals with fiduciary approval',
      'Strict contractual budget preservation during shifts',
    ],
    route: '/timeline',
    routeLabel: 'Open Bryntum Timeline',
  },
  {
    id: 'reviews',
    title: 'Human Review Workbench',
    tagline: '4-Column Fiduciary Decision & Payout Approval Hub',
    badge: 'MANDATORY FIDUCIARY GATE',
    badgeTheme: 'border-emerald-700 bg-emerald-950 text-emerald-300',
    icon: '⚖️',
    description:
      'Authoritative fiduciary workspace orchestrating multi-agent evaluations, deterministic settlement policy caps, and human sign-off before any financial disbursement is authorized.',
    features: [
      '4-column milestone decision cockpit',
      'Decimal-safe integer cents payout capping',
      'Role-governed human sign-off (Reviewer only)',
      'Deterministic policy engine enforcement',
    ],
    route: '/reviews',
    routeLabel: 'Open Review Workbench',
  },
  {
    id: 'passport',
    title: 'Cryptographic Evidence Passport',
    tagline: 'Immutable Engineering Record & SSRF-Guarded Runtime Smoke Tests',
    badge: 'SHA-256 SEALED',
    badgeTheme: 'border-cyan-700 bg-cyan-950 text-cyan-300',
    icon: '🛡️',
    description:
      'A tamper-evident technical delivery passport aggregating criterion-evidence links, SLSA provenance, and SSRF-hardened runtime smoke tests with socket-level IP-pinning and DNS rebinding defense.',
    features: [
      '18-point cryptographic and security gate',
      'Socket-level IP-pinning & DNS rebinding immunity',
      'Hex-encoded IPv4-mapped IPv6 address interceptor',
      'Self-contained JSON attestation export',
    ],
    route: '/trust',
    routeLabel: 'View Evidence Passport',
  },
  {
    id: 'disputes',
    title: 'Dispute Evidence Pack',
    tagline: 'Portable Tamper-Evident Arbitration Dossier',
    badge: 'EXTERNAL ARBITRATION',
    badgeTheme: 'border-rose-700 bg-rose-950 text-rose-300',
    icon: '📂',
    description:
      'Generates a sealed, self-verifying evidence bundle for third-party mediation or PayPal dispute resolution. Integrates delivery evidence, GitHub telemetry, AI synthesis, and the complete audit timeline.',
    features: [
      'Two-stage non-circular SHA-256 digest sealing',
      'Deterministic chronological timeline with sequence tie-breaking',
      'Independent hash-chain verification tool',
      'Sanitized portable JSON file export',
    ],
    route: '/disputes',
    routeLabel: 'Open Dispute Pack',
  },
  {
    id: 'paypal',
    title: 'PayPal Payment Lifecycle',
    tagline: '29-Day Non-Escrow Authorization & Webhook Reconciliation',
    badge: 'PAYPAL ORDERS API v2',
    badgeTheme: 'border-blue-700 bg-blue-950 text-blue-300',
    icon: '💳',
    sponsorTechnology: 'PayPal Orders API v2',
    description:
      'Implements real PayPal Sandbox authorization holds for up to 29 days without taking fund custody. Captures funds only after explicit human approval, backed by idempotency keys and webhook HMAC verification.',
    features: [
      'PayPal Orders API v2 with intent: AUTHORIZE',
      'Authoritative payment reconciliation engine',
      'Webhook signature verification with anti-SSRF cert pinning',
      'Strict non-escrow compliance notice',
    ],
    route: '/reviews',
    routeLabel: 'Inspect PayPal Lifecycle',
  },
];

export function PlatformCapabilitiesShowcase() {
  const navigate = useNavigate();

  return (
    <section
      id="platform-capabilities-section"
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 font-sans"
      aria-label="Platform Capabilities"
    >
      {/* Section Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono font-medium text-slate-400">
          <span>STAGE C • EXPLORE THE PLATFORM</span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Purpose-Built Digital Trust Infrastructure
        </h2>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          Each module is engineered to address a specific failure mode in modern software contracting — from phantom commits to unapproved fund release.
        </p>
      </div>

      {/* 7 Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLATFORM_MODULES.map((mod) => (
          <div
            key={mod.id}
            className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-5 shadow-xl group hover:shadow-sky-500/5"
          >
            {/* Top metadata */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-3xl group-hover:scale-110 transition transform">{mod.icon}</span>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${mod.badgeTheme}`}>
                  {mod.badge}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition">
                  {mod.title}
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  {mod.tagline}
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {mod.description}
              </p>

              {/* Feature bullet list */}
              <ul className="space-y-1.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                {mod.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-1.5">
                    <span className="text-sky-400">✓</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Direct Route Action */}
            <div className="pt-2">
              <button
                onClick={() => navigate(mod.route)}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 group-hover:border-sky-500/60 group-hover:text-sky-300"
              >
                <span>{mod.routeLabel}</span>
                <span>→</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
