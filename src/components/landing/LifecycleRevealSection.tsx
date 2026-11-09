/**
 * LifecycleRevealSection — Stage B: 6-Stage Core Lifecycle
 *
 * Design Focus:
 * - Exactly 1 line summary per stage (No wall of text!)
 * - Emerald & Champagne Gold accents instead of generic blue
 * - Spacious glass cards with clear status pills
 * - Interactive stage inspection showing invariants and direct launch button
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
    badgeColor: 'border-emerald-700 bg-emerald-950/80 text-emerald-300',
    icon: '📦',
    summary: 'Verifies commits, PR merge status, and CI logs directly via GitHub REST API.',
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
    badgeColor: 'border-amber-700 bg-amber-950/80 text-amber-300',
    icon: '🤖',
    summary: 'Quarantines untrusted code and scans CVEs under strict advisory bounds.',
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
    badgeColor: 'border-teal-700 bg-teal-950/80 text-teal-300',
    icon: '⚡',
    summary: 'Calculates exact payment cap via deterministic integer-cents formula.',
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
    summary: 'Mandatory fiduciary sign-off before any payment can proceed.',
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
    summary: '29-day non-escrow authorization hold and instant payout capture.',
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
    badgeColor: 'border-zinc-700 bg-zinc-900 text-zinc-300',
    icon: '🛡️',
    summary: 'Append-only SHA-256 hash-chain guaranteeing zero historical tampering.',
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

  const activeStep = LIFECYCLE_STEPS[activeStepIndex];

  return (
    <section
      id="product-reveal-section"
      className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8 font-sans"
      aria-label="TrustChain Lifecycle"
    >
      {/* 1-Line Section Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Trust every delivery.{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
            Verify every milestone.
          </span>
        </h2>
        <p className="text-zinc-400 text-sm">
          A continuous, verifiable journey from uncommitted code to released payment.
        </p>
      </div>

      {/* 6 Stage Compact Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {LIFECYCLE_STEPS.map((step, idx) => {
          const isActive = idx === activeStepIndex;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStepIndex(idx)}
              className={`p-4 rounded-xl text-left transition duration-200 border flex flex-col justify-between ${
                isActive
                  ? 'bg-zinc-900 border-emerald-500/80 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                  : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-2xl">{step.icon}</span>
                <span className="font-mono text-xs text-zinc-500 font-bold">{step.number}</span>
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-0.5">
                  {step.category}
                </div>
                <div className="font-semibold text-xs sm:text-sm text-white">
                  {step.name}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-zinc-800 flex items-center justify-between">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${step.badgeColor}`}>
                  {step.badge.split(' ')[0]}
                </span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Stage Clean Inspection Card */}
      <div className="p-6 sm:p-7 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{activeStep.icon}</span>
            <div>
              <div className="text-xs font-mono text-zinc-400">
                STAGE {activeStep.number} OF 06 • {activeStep.category}
              </div>
              <h3 className="text-xl font-bold text-white">
                {activeStep.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-mono px-3 py-1 rounded-full border ${activeStep.badgeColor}`}>
              {activeStep.badge}
            </span>
            <button
              onClick={() => navigate(activeStep.targetRoute)}
              className="py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-zinc-950 transition flex items-center gap-1.5 shadow"
            >
              <span>Open View</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* 1-Line Description */}
        <p className="text-zinc-200 text-sm font-medium">
          {activeStep.summary}
        </p>

        {/* Technical Callouts: 1 line each */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="text-[10px] font-mono text-emerald-400 font-semibold uppercase">
              Technical Verification
            </div>
            <div className="text-xs text-zinc-300 font-mono mt-0.5">
              {activeStep.technicalProof}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="text-[10px] font-mono text-amber-400 font-semibold uppercase">
              Fiduciary Invariant
            </div>
            <div className="text-xs text-zinc-300 font-mono mt-0.5">
              {activeStep.invariant}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
