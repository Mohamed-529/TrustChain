/**
 * LifecycleRevealSection — Stage B: Product Reveal & Core Lifecycle Presentation
 *
 * Implements:
 * 1. Visual representation of core 6-stage lifecycle:
 *    GitHub Evidence → AI Analysis → Deterministic Policy → Human Approval → PayPal Settlement → Immutable Audit
 * 2. Sequential animation with glowing conduits and data packets.
 * 3. Headline: "Trust every delivery. Verify every milestone."
 * 4. Interactive stage inspection showing invariants, schemas, and security boundaries.
 * 5. High-contrast, cinematic aesthetic with glassmorphic cards and glowing badges.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from '../../router/Router.tsx';

interface LifecycleStep {
  id: string;
  number: string;
  name: string;
  category: string;
  badge: string;
  badgeColor: string;
  icon: string;
  summary: string;
  technicalProof: string;
  invariant: string;
  targetRoute: string;
}

const LIFECYCLE_STEPS: LifecycleStep[] = [
  {
    id: 'github',
    number: '01',
    name: 'GitHub Delivery Evidence',
    category: 'Ingestion & Telemetry',
    badge: 'PROVENANCE VERIFIED',
    badgeColor: 'border-sky-700 bg-sky-950/80 text-sky-300',
    icon: '📦',
    summary: 'Developer submits delivery evidence with commit SHA, pull request, and CI test artifacts.',
    technicalProof: 'X-Hub-Signature-256 HMAC and canonical SHA-256 evidence hashing.',
    invariant: 'Evidence is treated as untrusted input until independently verified via GitHub REST API.',
    targetRoute: '/trust',
  },
  {
    id: 'ai_analysis',
    number: '02',
    name: 'Multi-Agent AI Analysis',
    category: 'Risk & Evidence Agents',
    badge: 'ADVISORY ONLY',
    badgeColor: 'border-purple-700 bg-purple-950/80 text-purple-300',
    icon: '🤖',
    summary: 'Evidence Analyst cross-examines criteria; Risk Analyst evaluates CVEs and security findings.',
    technicalProof: 'Structured output schemas with additionalProperties: false and anti-injection quarantine.',
    invariant: 'AI synthesis is strictly advisory and cannot execute or mutate financial disbursement terms.',
    targetRoute: '/intelligence',
  },
  {
    id: 'policy',
    number: '03',
    name: 'Deterministic Settlement Policy',
    category: 'Financial Policy Engine',
    badge: 'DETERMINISTIC FORMULA',
    badgeColor: 'border-indigo-700 bg-indigo-950/80 text-indigo-300',
    icon: '⚡',
    summary: 'Calculates the permitted payment cap using integer cents arithmetic and contractual penalties.',
    technicalProof: 'Formula: permitted = agreed × verifiedRatio - latePenalty - criticalBlockers.',
    invariant: 'Disbursement caps are determined by code, preventing arbitrary or hallucinated payout values.',
    targetRoute: '/intelligence',
  },
  {
    id: 'human_approval',
    number: '04',
    name: 'Human Fiduciary Approval',
    category: 'Mandatory Human Gate',
    badge: 'MANDATORY GATE',
    badgeColor: 'border-amber-700 bg-amber-950/80 text-amber-300',
    icon: '👤',
    summary: 'Designated fiduciary reviewer examines evidence and signs an authoritative decision.',
    technicalProof: 'HMAC session verification + role gate (REVIEWER only) recorded with timestamp & reason.',
    invariant: 'Zero automated payment execution. Human approval is mandatory before capture is permitted.',
    targetRoute: '/reviews',
  },
  {
    id: 'paypal',
    number: '05',
    name: 'PayPal Sandbox Settlement',
    category: 'Non-Escrow Orders API v2',
    badge: '29-DAY HOLD & CAPTURE',
    badgeColor: 'border-emerald-700 bg-emerald-950/80 text-emerald-300',
    icon: '💳',
    summary: 'Client authorizes funding hold; permitted amount is captured directly upon approval.',
    technicalProof: 'PayPal-Request-Id idempotency, 29-day authorization hold, webhook HMAC validation.',
    invariant: 'Non-escrow regulatory compliance: TrustChain never takes custody of funds.',
    targetRoute: '/reviews',
  },
  {
    id: 'audit',
    number: '06',
    name: 'Immutable Hash-Chained Audit',
    category: 'ACID Audit Trail',
    badge: 'SHA-256 CHAINED',
    badgeColor: 'border-cyan-700 bg-cyan-950/80 text-cyan-300',
    icon: '🛡️',
    summary: 'Every lifecycle transition is recorded in an append-only, SHA-256 Merkle-linked audit log.',
    technicalProof: 'SQLite WAL mode with append-only triggers and cryptographic replay verification.',
    invariant: 'History cannot be rewritten or truncated; full state machine can be deterministically verified.',
    targetRoute: '/settings',
  },
];

interface LifecycleRevealSectionProps {
  onExplore: () => void;
  onSignIn: () => void;
}

export function LifecycleRevealSection({ onExplore, onSignIn }: LifecycleRevealSectionProps) {
  const navigate = useNavigate();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(true);

  // Auto-cycle through the lifecycle stages sequentially
  useEffect(() => {
    if (!isAutoCycling) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % LIFECYCLE_STEPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoCycling]);

  const activeStep = LIFECYCLE_STEPS[activeStepIndex];

  return (
    <section
      id="product-reveal-section"
      className="relative py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 font-sans"
      aria-label="TrustChain Product Reveal and Core Lifecycle"
    >
      {/* Section Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono font-medium text-slate-400">
          <span>THE TRUSTCHAIN ARCHITECTURE</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Trust every delivery.{' '}
          <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">
            Verify every milestone.
          </span>
        </h2>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
          From uncommitted source code to authoritative PayPal disbursement, every transition is governed by independent evidence, deterministic calculation, and cryptographic permanence.
        </p>
      </div>

      {/* Sequential 6-Stage Timeline Bar */}
      <div className="relative">
        {/* Glow connector bar behind steps */}
        <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-0.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 opacity-25 -translate-y-1/2 pointer-events-none" />

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 relative z-10">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const isActive = idx === activeStepIndex;
            return (
              <button
                key={step.id}
                onClick={() => {
                  setActiveStepIndex(idx);
                  setIsAutoCycling(false);
                }}
                className={`p-4 rounded-xl text-left transition-all duration-300 border flex flex-col justify-between group ${
                  isActive
                    ? 'bg-slate-900 border-sky-500/80 shadow-lg shadow-sky-500/10 scale-102 ring-1 ring-sky-500/50'
                    : 'bg-slate-950/80 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="text-xl sm:text-2xl group-hover:scale-110 transition">{step.icon}</span>
                  <span className="font-mono text-xs text-slate-500 font-bold">{step.number}</span>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                    {step.category}
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-white leading-tight">
                    {step.name}
                  </div>
                </div>

                {/* Animated active indicator pip */}
                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${step.badgeColor}`}
                  >
                    {step.badge.split(' ')[0]}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Stage Detailed Inspection Glass Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Glow ambient background accent */}
        <div className="absolute -top-24 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
          {/* Stage Overview */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl">{activeStep.icon}</span>
              <div>
                <span className="text-xs font-mono text-slate-400">
                  STAGE {activeStep.number} OF 06 • {activeStep.category}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  {activeStep.name}
                </h3>
              </div>
              <span
                className={`ml-auto text-[11px] font-mono px-2.5 py-1 rounded-full border ${activeStep.badgeColor}`}
              >
                {activeStep.badge}
              </span>
            </div>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {activeStep.summary}
            </p>

            {/* Technical Proof & Invariant Callout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-mono text-sky-400 font-semibold uppercase">
                  Technical Mechanism
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  {activeStep.technicalProof}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-[11px] font-mono text-amber-400 font-semibold uppercase">
                  Fiduciary Invariant
                </div>
                <div className="text-xs text-slate-300 font-mono">
                  {activeStep.invariant}
                </div>
              </div>
            </div>
          </div>

          {/* Jump to Relevant Module Action */}
          <div className="p-5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col justify-between space-y-4 h-full">
            <div>
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Live Module Execution
              </div>
              <div className="text-white font-bold text-sm">
                Inspect in Production Interface
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Jump directly into the live implementation of this lifecycle phase.
              </p>
            </div>

            <button
              onClick={() => navigate(activeStep.targetRoute)}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
            >
              Open {activeStep.name.split(' ')[0]} View →
            </button>
          </div>
        </div>
      </div>

      {/* Stage B Primary Call-to-Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <button
          onClick={onExplore}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white shadow-xl shadow-indigo-600/20 transition transform hover:-translate-y-0.5"
        >
          Explore All Platform Modules ↓
        </button>

        <button
          onClick={onSignIn}
          className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-semibold text-slate-300 hover:text-white transition"
        >
          Sign In / Switch Persona
        </button>
      </div>
    </section>
  );
}
