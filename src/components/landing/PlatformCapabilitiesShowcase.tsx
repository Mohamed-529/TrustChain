/**
 * PlatformCapabilitiesShowcase — Stage C: Clean, Spacious Platform Modules
 *
 * Design Focus:
 * - Exactly 1-line description per module (No wall of text!)
 * - Emerald, Champagne Gold, and Platinum themes (NO generic blue)
 * - Spacious cards with high breathing room
 * - Direct route jump buttons to operational pages
 */

import React from 'react';
import { useNavigate } from '../../router/Router.tsx';

interface PlatformModule {
  id: string;
  title: string;
  badge: string;
  badgeTheme: string;
  icon: string;
  oneLineSummary: string;
  tags: string[];
  route: string;
  routeLabel: string;
}

const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'evidence',
    title: 'Evidence Intelligence',
    badge: 'INDEPENDENT TELEMETRY',
    badgeTheme: 'border-emerald-700 bg-emerald-950/80 text-emerald-300',
    icon: '🔍',
    oneLineSummary: 'Direct GitHub REST API verification of repos, commits, PRs, and CI runs.',
    tags: ['GitHub API REST', 'SHA-256 Provenance', 'Tamper Interception'],
    route: '/trust',
    routeLabel: 'Open Evidence Passport',
  },
  {
    id: 'ag-grid',
    title: 'Milestone Intelligence',
    badge: 'AG GRID COMMUNITY v36',
    badgeTheme: 'border-amber-700 bg-amber-950/80 text-amber-300',
    icon: '⚡',
    oneLineSummary: 'High-density decision ledger with natural language search and Master/Detail telemetry.',
    tags: ['AG Grid v36 (MIT)', 'NLP Query Parser', 'Formula Injection Defense'],
    route: '/intelligence',
    routeLabel: 'Launch Intelligence Grid',
  },
  {
    id: 'timeline',
    title: 'Bryntum Timeline Tower',
    badge: 'BRYNTUM GANTT v7.3',
    badgeTheme: 'border-teal-700 bg-teal-950/80 text-teal-300',
    icon: '📅',
    oneLineSummary: 'Finish-to-Start delivery schedule with critical paths and budget-preserving shift proposals.',
    tags: ['Bryntum Gantt v7.3', 'Baseline Variance', 'AI Schedule Shifts'],
    route: '/timeline',
    routeLabel: 'Open Bryntum Timeline',
  },
  {
    id: 'reviews',
    title: 'Human Review Workbench',
    badge: 'MANDATORY FIDUCIARY GATE',
    badgeTheme: 'border-amber-700 bg-amber-950/80 text-amber-300',
    icon: '⚖️',
    oneLineSummary: 'Authoritative 4-column workbench for fiduciary approval and payment release.',
    tags: ['4-Column Cockpit', 'Integer Cents Capping', 'Reviewer Authority Gate'],
    route: '/reviews',
    routeLabel: 'Open Review Workbench',
  },
  {
    id: 'passport',
    title: 'Cryptographic Passport',
    badge: 'SHA-256 MERKLE SEALED',
    badgeTheme: 'border-emerald-700 bg-emerald-950/80 text-emerald-300',
    icon: '🛡️',
    oneLineSummary: 'Immutable technical delivery record with socket-level IP-pinning and SSRF-hardened preview.',
    tags: ['18-Point Security Gate', 'Socket IP-Pinning', 'Anti-SSRF Protection'],
    route: '/trust',
    routeLabel: 'View Evidence Passport',
  },
  {
    id: 'disputes',
    title: 'Dispute Evidence Pack',
    badge: 'ARBITRATION DOSSIER',
    badgeTheme: 'border-rose-700 bg-rose-950/80 text-rose-300',
    icon: '📂',
    oneLineSummary: 'Tamper-evident chronological evidence pack with exportable sanitized JSON dossier.',
    tags: ['Non-Circular SHA-256', 'Sequence Tie-Breaking', 'Portable JSON Export'],
    route: '/disputes',
    routeLabel: 'Open Dispute Pack',
  },
  {
    id: 'paypal',
    title: 'PayPal Settlement',
    badge: 'PAYPAL ORDERS API v2',
    badgeTheme: 'border-emerald-700 bg-emerald-950/80 text-emerald-300',
    icon: '💳',
    oneLineSummary: '29-day non-escrow authorization hold and webhook-reconciled milestone payment capture.',
    tags: ['29-Day Hold & Capture', 'Idempotency Keys', 'Webhook HMAC Protection'],
    route: '/reviews',
    routeLabel: 'Inspect PayPal Settlement',
  },
];

export function PlatformCapabilitiesShowcase() {
  const navigate = useNavigate();

  return (
    <section
      id="platform-capabilities-section"
      className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 font-sans"
      aria-label="Platform Capabilities"
    >
      {/* 1-Line Section Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Purpose-Built Digital Trust Modules
        </h2>
        <p className="text-zinc-400 text-sm">
          Select any module to inspect live data, contracts, and telemetry.
        </p>
      </div>

      {/* 7 Clean Spacious Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PLATFORM_MODULES.map((mod) => (
          <div
            key={mod.id}
            className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between space-y-4 shadow-lg group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl group-hover:scale-105 transition">{mod.icon}</span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${mod.badgeTheme}`}>
                  {mod.badge}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                  {mod.title}
                </h3>
                {/* EXACTLY 1 LINE DESCRIPTION */}
                <p className="text-xs text-zinc-300 mt-1 leading-snug">
                  {mod.oneLineSummary}
                </p>
              </div>

              {/* Concise Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {mod.tags.map((tag, tIdx) => (
                  <span
                    key={tIdx}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate(mod.route)}
              className="w-full py-2 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 hover:text-emerald-300 transition flex items-center justify-center gap-1.5 group-hover:border-zinc-700"
            >
              <span>{mod.routeLabel}</span>
              <span>→</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
