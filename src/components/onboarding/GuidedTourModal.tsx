import React, { useState, useEffect } from 'react';
import { useNavigate } from '../../router/Router.tsx';

export interface TourStep {
  step: number;
  title: string;
  category: string;
  badge: string;
  targetRoute: string;
  icon: string;
  summary: string;
  keyHighlights: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    step: 1,
    title: 'Welcome to MilestoneProof AI / TrustChain',
    category: 'PLATFORM OVERVIEW',
    badge: 'MULTI-AGENT ORCHESTRATION',
    targetRoute: '/',
    icon: '🏛️',
    summary:
      'TrustChain transforms traditional, disputed software contracts into deterministic, verifiable delivery lifecycles. By connecting live engineering telemetry directly to PayPal settlement, clients and developers collaborate with mathematical certainty.',
    keyHighlights: [
      'Eliminates subjective payment disputes with cryptographic proof',
      'Combines AI advisory analysis with deterministic financial calculation',
      'Never takes custody of funds — operates via authoritative PayPal Sandbox hold/capture',
    ],
  },
  {
    step: 2,
    title: 'Executive Intelligence Dashboard',
    category: 'PORTFOLIO INTELLIGENCE',
    badge: 'EXECUTIVE OVERVIEW',
    targetRoute: '/dashboard',
    icon: '📊',
    summary:
      'The Executive Dashboard computes real-time portfolio metrics directly from authoritative SQLite ledger rows. Monitor total agreed budgets, permitted disbursement caps, and portfolio risk distributions without fabricated numbers.',
    keyHighlights: [
      'Live aggregate contract budget and permitted cap counters',
      'Interactive risk distribution cards (Critical, High, Medium, Low/None)',
      'Instant filtering across all active portfolio contracts',
    ],
  },
  {
    step: 3,
    title: 'AG Grid Milestone Intelligence Cockpit',
    category: 'SPONSOR INTEGRATION: AG GRID',
    badge: 'AG GRID COMMUNITY V36',
    targetRoute: '/intelligence',
    icon: '📑',
    summary:
      'An investigation-first decision support cockpit powered by AG Grid v36 Community Edition. Explore multi-column sorting, floating filters, column layout persistence, CWE-1236 sanitized CSV export, and safe Natural Language Query parsing.',
    keyHighlights: [
      'Master/Detail full-width expandable rows isolating Git, PR, and CI telemetry',
      'Safe natural language search with interactive user confirmation modal',
      '100% MIT Community licensed with zero enterprise trial watermarks',
    ],
  },
  {
    step: 4,
    title: 'Bryntum Gantt Software Delivery Control Tower',
    category: 'SPONSOR INTEGRATION: BRYNTUM',
    badge: 'GANTT SCHEDULE ENGINE',
    targetRoute: '/timeline',
    icon: '📅',
    summary:
      'Interactive project timeline visualization synchronized with backend milestones. Displays Finish-to-Start dependencies (type=2), baseline dates vs. actual variance, critical path tasks, and AI Schedule-Risk recovery proposals.',
    keyHighlights: [
      'Automated downstream cascading on milestone deadline shifts',
      'AI Schedule Advisor proposals requiring explicit human fiduciary review',
      'Strict invariant: timeline adjustments cannot secretly alter contractual payment terms',
    ],
  },
  {
    step: 5,
    title: 'Human Review Workbench & PayPal Settlement',
    category: 'FINANCIAL INTEGRITY',
    badge: 'PAYPAL ORDERS API V2',
    targetRoute: '/reviews',
    icon: '⚖️',
    summary:
      'The 4-column operational core enforcing the non-bypassable human approval gate. AI agents provide advisory synthesis, but only an authenticated human fiduciary can authorize release of PayPal Sandbox funds.',
    keyHighlights: [
      'PayPal intent: AUTHORIZE holds funds on hold up to 29 days',
      'Deterministic policy engine strictly caps disbursement to contractual terms',
      'Mandatory regulatory non-escrow notice and server-side integer cents validation',
    ],
  },
  {
    step: 6,
    title: 'Cryptographic Evidence Passport & Dispute Packs',
    category: 'VERIFIABILITY & DISPUTES',
    badge: 'SHA-256 HASH-CHAIN',
    targetRoute: '/trust',
    icon: '🛡️',
    summary:
      'Inspect tamper-evident Evidence Passports and generate two-stage non-circular SHA-256 Dispute Evidence Packs. If a dispute arises, export a portable, sanitized JSON package to resolve claims with undeniable cryptographic proof.',
    keyHighlights: [
      'Append-only SQLite WAL audit log chained with SHA-256 backwards hashes',
      'Anti-SSRF IP pinning and SLSA provenance attestation verification',
      'Audit replay engine validates complete deterministic state machine reconstruction',
    ],
  },
];

export const STORAGE_KEY_ONBOARDING = 'tc_onboarding_completed_v1';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuidedTourModal({ isOpen, onClose }: GuidedTourModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const progressPct = ((currentStep.step) / TOUR_STEPS.length) * 100;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      navigate(TOUR_STEPS[nextIdx].targetRoute);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      navigate(TOUR_STEPS[prevIdx].targetRoute);
    }
  };

  const handleComplete = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ONBOARDING, 'true');
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto font-sans"
    >
      <div className="bg-slate-900 border border-indigo-700/80 rounded-2xl max-w-2xl w-full p-6 lg:p-7 space-y-6 shadow-2xl relative">
        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl p-1.5 rounded-lg bg-slate-800 border border-slate-700">
              {currentStep.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  {currentStep.badge}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Step {currentStep.step} of {TOUR_STEPS.length}
                </span>
              </div>
              <h2 id="tour-modal-title" className="text-lg font-bold text-white mt-0.5">
                {currentStep.title}
              </h2>
            </div>
          </div>
          <button
            onClick={handleComplete}
            className="text-slate-400 hover:text-white px-2 py-1 text-sm font-semibold rounded hover:bg-slate-800 transition"
            title="Skip Tour"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">{currentStep.summary}</p>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Key Engineering Highlights:
            </div>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {currentStep.keyHighlights.map((hl, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>{hl}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Controls Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            onClick={handleComplete}
            className="text-xs text-slate-400 hover:text-slate-200 font-medium px-2 py-1.5 rounded hover:bg-slate-800 transition"
          >
            Skip Guided Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
              >
                ← Previous
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition flex items-center gap-1"
            >
              <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish & Explore' : 'Next Step →'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
