import React, { useState, useEffect } from 'react';
import { useNavigate } from '../../router/Router.tsx';
import type { User } from '../../types/domain.ts';

export interface WalkthroughStep {
  stepNumber: number;
  title: string;
  role: 'CLIENT' | 'DEVELOPER';
  whereAmI: string;
  targetRoute: string;
  whyThisStepExists: string;
  whatShouldIDo: string;
  actionButtonText: string;
  actionTargetRoute: string;
  expectedOutput: string;
  howDoIKnowItSucceeded: string;
  whatsNext: string;
  isRealAction?: boolean;
}

export const CLIENT_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    stepNumber: 1,
    title: 'Step 1 — Create or Inspect a Project Contract',
    role: 'CLIENT',
    whereAmI: 'Dashboard / My Projects',
    targetRoute: '/dashboard',
    whyThisStepExists: 'A contract defines the legally binding project scope, total budget, currency, and participants (Client, Developer, and Reviewer). It establishes the contractual rules before code is delivered.',
    whatShouldIDo: 'Click "Start / Inspect Project" to review the active contract terms ($8,500.00 USD) and milestone schedule, or define a new contract.',
    actionButtonText: 'Go to Projects & Milestones →',
    actionTargetRoute: '/dashboard',
    expectedOutput: 'An active contract appears showing $8,500.00 total budget, Elena Vance as Client, Marcus Chen as Contractor, and Sophia Sterling as Fiduciary Reviewer.',
    howDoIKnowItSucceeded: 'Contract status displays ACTIVE, and all 3 agreed milestones are listed with individual budget allocations.',
    whatsNext: 'Step 2: Inspect agreed requirements and acceptance criteria.'
  },
  {
    stepNumber: 2,
    title: 'Step 2 — Define Milestones & Acceptance Criteria',
    role: 'CLIENT',
    whereAmI: 'Gantt Timeline / Requirements Matrix',
    targetRoute: '/timeline',
    whyThisStepExists: 'Large projects must be broken into measurable milestones with clear criteria (AC-1, AC-2) so engineering delivery can be cryptographically verified rather than subjectively argued.',
    whatShouldIDo: 'Open the Bryntum Timeline or AG Grid to verify milestone dependencies (Finish-to-Start), deadlines, and proof requirements (Code Commit, CI Tests, Security Scan).',
    actionButtonText: 'Inspect Delivery Schedule in Bryntum →',
    actionTargetRoute: '/timeline',
    expectedOutput: 'Milestone 1 ($2,500), Milestone 2 ($3,500), and Milestone 3 ($2,500) appear on the interactive Gantt chart with verified dependencies.',
    howDoIKnowItSucceeded: 'Finish-to-Start dependency arrows are visible and baseline dates match contractual commitments.',
    whatsNext: 'Step 3: Make the supported PayPal payment commitment (Authorization Hold).'
  },
  {
    stepNumber: 3,
    title: 'Step 3 — Make the Supported PayPal Payment Commitment',
    role: 'CLIENT',
    whereAmI: 'Review & Pay / Column 4 (PayPal Settlement)',
    targetRoute: '/reviews',
    whyThisStepExists: 'Clients commit funds using PayPal Orders API v2 intent: AUTHORIZE. This creates a temporary 29-day payment authorization hold without taking custodial escrow. Funds remain safely with PayPal until authorized for release.',
    whatShouldIDo: 'Switch to Column 4, click "1. Create Order (AUTHORIZE)", and approve the Sandbox checkout hold.',
    actionButtonText: 'Open PayPal Settlement Workbench →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'PayPal returns an authoritative Order ID (e.g., ORD-MPAI-...) with status ORDER_CREATED, followed by an Authorization ID upon hold approval.',
    howDoIKnowItSucceeded: 'Payment State transitions to AUTHORIZED (or SIMULATED_AUTHORIZED in mock mode). Transaction is stamped in the audit ledger.',
    whatsNext: 'Step 4: Inspect Developer delivery evidence and AI verification report.'
  },
  {
    stepNumber: 4,
    title: 'Step 4 — Inspect Developer Delivery & AI Report',
    role: 'CLIENT',
    whereAmI: 'Review & Pay / Columns 1 & 2',
    targetRoute: '/reviews',
    whyThisStepExists: 'The Developer submits actual GitHub commit SHAs, PR URLs, and CI test logs. The Multi-Agent AI system (EvidenceAgent, RiskAgent, ArbitratorAgent) evaluates evidence against agreed criteria.',
    whatShouldIDo: 'Inspect Column 1 for repository evidence, then review Column 2 for the Arbitrator recommendation and click "Inspect AI Reasoning".',
    actionButtonText: 'Inspect Delivery & AI Findings →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'Criterion-by-criterion breakdown showing AC-1 and AC-2 VERIFIED, 64/64 tests passed, 0 CVEs, and Arbitrator recommendation PASS.',
    howDoIKnowItSucceeded: 'Deterministic policy cap calculates eligible disbursement ($2,500.00 permitted with zero penalties).',
    whatsNext: 'Step 5: Accept delivery or request revisions.'
  },
  {
    stepNumber: 5,
    title: 'Step 5 — Accept or Request Changes',
    role: 'CLIENT',
    whereAmI: 'Review & Pay / Column 3 (Policy & Approval)',
    targetRoute: '/reviews',
    whyThisStepExists: 'Client acceptance verifies that deliverables meet business expectations, distinct from technical CI passing.',
    whatShouldIDo: 'Review the technical report. If satisfied, leave approval justification or submit change requests for missing requirements.',
    actionButtonText: 'Go to Human Review Workbench →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'Feedback is recorded in the milestone state machine and visible to the contractor.',
    howDoIKnowItSucceeded: 'State machine updates to PENDING_REVIEW or NEEDS_CHANGES.',
    whatsNext: 'Step 6: Reviewer fiduciary approval and PayPal settlement capture.'
  },
  {
    stepNumber: 6,
    title: 'Step 6 — Inspect Approval & Final Settlement',
    role: 'CLIENT',
    whereAmI: 'Review & Pay / Columns 3 & 4',
    targetRoute: '/reviews',
    whyThisStepExists: 'Financial Safety Rule #1: No AI agent can capture payments. An authenticated human reviewer must sign off before PayPal capture is unlocked.',
    whatShouldIDo: 'Once approved by the Reviewer, trigger "3. Capture Settlement" to execute the verified disbursement.',
    actionButtonText: 'Inspect Settlement Gate →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'PayPal capture transaction executes. Milestone transitions to APPROVED and CAPTURED.',
    howDoIKnowItSucceeded: 'Payment State displays CAPTURED (or SIMULATED_CAPTURED) with immutable Capture ID.',
    whatsNext: 'Step 7: Inspect cryptographic audit trail and Evidence Passport.'
  },
  {
    stepNumber: 7,
    title: 'Step 7 — Inspect Audit Chain & Evidence Passport',
    role: 'CLIENT',
    whereAmI: 'Audit & Trust Passport / Disputes',
    targetRoute: '/trust',
    whyThisStepExists: 'Every state transition is sealed in an immutable, SHA-256 hash-chained SQLite audit ledger. The Evidence Passport bundles SLSA provenance, git attestations, and runtime smoke checks.',
    whatShouldIDo: 'Click "Verify Audit Chain" and inspect the SLSA build provenance and runtime smoke test results.',
    actionButtonText: 'Open Cryptographic Evidence Passport →',
    actionTargetRoute: '/trust',
    expectedOutput: 'Audit verification returns INTACT (100% hash integrity). Evidence Passport displays verified criterion badges and tamper-evident digests.',
    howDoIKnowItSucceeded: 'Cryptographic digest matches and zero tampered events are reported.',
    whatsNext: 'Tour Complete! You have explored the full TrustChain Client fiduciary lifecycle.'
  }
];

export const DEVELOPER_WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    stepNumber: 1,
    title: 'Step 1 — Open Assigned Project',
    role: 'DEVELOPER',
    whereAmI: 'Dashboard / My Projects',
    targetRoute: '/dashboard',
    whyThisStepExists: 'Contractors see all projects they are assigned to, the total contract budget, and active milestones requiring engineering delivery.',
    whatShouldIDo: 'Review your assigned contract ("Core Payment Gateway & OAuth2 Microservice Contract") and click on Milestone 1.',
    actionButtonText: 'View My Assigned Project →',
    actionTargetRoute: '/dashboard',
    expectedOutput: 'Contract details appear with Marcus Chen listed as Lead Contractor and 3 milestones to deliver.',
    howDoIKnowItSucceeded: 'Contractor identity is confirmed and milestone statuses are visible.',
    whatsNext: 'Step 2: Understand contractual requirements and acceptance criteria.'
  },
  {
    stepNumber: 2,
    title: 'Step 2 — Understand Requirements & Acceptance Criteria',
    role: 'DEVELOPER',
    whereAmI: 'AG Grid / Requirements Matrix',
    targetRoute: '/intelligence',
    whyThisStepExists: 'Before writing code, contractors must know the exact proof required (e.g. >=80% test coverage, 0 Critical CVEs) so delivery is unambiguous.',
    whatShouldIDo: 'Inspect the AG Grid milestone cockpit or requirements matrix to understand AC-1 (OAuth2 Endpoints) and AC-2 (Automated Unit Tests).',
    actionButtonText: 'Inspect Requirements in AG Grid →',
    actionTargetRoute: '/intelligence',
    expectedOutput: 'Each criterion displays its required proof type: CODE_COMMIT for endpoints, CI_TESTS for coverage.',
    howDoIKnowItSucceeded: 'Acceptance criteria IDs and descriptions are clearly detailed.',
    whatsNext: 'Step 3: Submit project delivery evidence.'
  },
  {
    stepNumber: 3,
    title: 'Step 3 — Submit Project Delivery Evidence',
    role: 'DEVELOPER',
    whereAmI: 'Review Workbench / Column 1 (Delivery Evidence)',
    targetRoute: '/reviews',
    whyThisStepExists: 'Contractors submit genuine technical evidence: repository URL, commit SHA, pull request URL, and CI test summaries.',
    whatShouldIDo: 'In Column 1, click "Submit Demo Evidence" to submit verified OAuth2 implementation telemetry.',
    actionButtonText: 'Open Evidence Submission Form →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'Submission is persisted with commit a8f4c219e03d, PR #42 (MERGED), 64 passed tests, and 91.5% coverage.',
    howDoIKnowItSucceeded: 'Milestone status updates to SUBMITTED / PENDING_REVIEW and a SHA-256 payload digest is generated.',
    whatsNext: 'Step 4: Run and inspect AI verification findings.'
  },
  {
    stepNumber: 4,
    title: 'Step 4 — Run and Inspect AI Verification',
    role: 'DEVELOPER',
    whereAmI: 'Review Workbench / Column 2 (AI Advisory)',
    targetRoute: '/reviews',
    whyThisStepExists: 'Tri-Agent AI synthesis checks commits, PR merges, CI logs, and vulnerability scans to produce structured advisory findings.',
    whatShouldIDo: 'Click "Run AI Evaluation" and inspect the criterion-level reasoning and risk severity.',
    actionButtonText: 'Run AI Multi-Agent Evaluation →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'Top badge displays LIVE GEMINI (or FALLBACK). Evidence analysis confirms 2/2 criteria verified with zero security risks.',
    howDoIKnowItSucceeded: 'Arbitrator recommends PASS / RECOMMEND_APPROVAL with full factual observations.',
    whatsNext: 'Step 5: Resubmit on incomplete evidence or proceed to payment tracking.'
  },
  {
    stepNumber: 5,
    title: 'Step 5 — Handle Missing Requirements & Resubmit',
    role: 'DEVELOPER',
    whereAmI: 'Review Workbench / Milestone 2 (Case B Demo)',
    targetRoute: '/reviews',
    whyThisStepExists: 'When evidence is incomplete (e.g. Milestone 2 where PR is unmerged and security scan is missing), AI provides actionable feedback on what is missing.',
    whatShouldIDo: 'Select Milestone 2 in the workbench selector to inspect an incomplete submission and understand the required corrective actions.',
    actionButtonText: 'Inspect Incomplete Submission Case →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'AI flags missing security scan artifact and unmerged PR #57, setting recommendation to NEEDS_HUMAN_REVIEW or REJECT.',
    howDoIKnowItSucceeded: 'Deterministic policy engine blocks payment ($0.00 permitted) until corrected evidence is provided.',
    whatsNext: 'Step 6: Track approval and payment settlement.'
  },
  {
    stepNumber: 6,
    title: 'Step 6 — Track Approval & Payment Settlement',
    role: 'DEVELOPER',
    whereAmI: 'Review Workbench / Column 4 (PayPal Settlement)',
    targetRoute: '/reviews',
    whyThisStepExists: 'Contractors can track real settlement progress: Order Created → Authorization Hold Placed → Human Review Approved → Capture Released.',
    whatShouldIDo: 'Inspect Column 4 to verify whether payment hold has been authorized and captured by the client and reviewer.',
    actionButtonText: 'Track Settlement Status →',
    actionTargetRoute: '/reviews',
    expectedOutput: 'Clear payment lifecycle stage: AUTHORIZED indicates funds are secured on hold; CAPTURED indicates funds were disbursed.',
    howDoIKnowItSucceeded: 'Authoritative PayPal transaction IDs and timestamps are displayed.',
    whatsNext: 'Step 7: Inspect Evidence Passport for permanent engineering reputation.'
  },
  {
    stepNumber: 7,
    title: 'Step 7 — Permanent Proof & Dispute Protection',
    role: 'DEVELOPER',
    whereAmI: 'Passport & Dispute Suite',
    targetRoute: '/trust',
    whyThisStepExists: 'The Evidence Passport creates a permanent, portable cryptographic record of completed work, protecting contractors from arbitrary non-payment.',
    whatShouldIDo: 'Export the Evidence Passport or Dispute Evidence Pack to inspect your tamper-evident proof package.',
    actionButtonText: 'View Evidence Passport & Dispute Pack →',
    actionTargetRoute: '/trust',
    expectedOutput: 'Cryptographically sealed JSON and visual certificate proving exact code delivered, passing tests, and approved amounts.',
    howDoIKnowItSucceeded: 'SHA-256 certificate digest can be verified independently by any third-party auditor.',
    whatsNext: 'Tour Complete! You have mastered the Developer delivery & verification workflow.'
  }
];

interface InteractiveWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export function InteractiveWalkthroughModal({
  isOpen,
  onClose,
  currentUser,
}: InteractiveWalkthroughModalProps) {
  const navigate = useNavigate();
  const isClient = currentUser?.role === 'CLIENT';
  const roleSteps = isClient ? CLIENT_WALKTHROUGH_STEPS : DEVELOPER_WALKTHROUGH_STEPS;

  const storageKey = `trustchain_walkthrough_step_${currentUser?.role ?? 'CLIENT'}`;
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const idx = parseInt(saved, 10);
      if (!isNaN(idx) && idx >= 0 && idx < roleSteps.length) {
        setCurrentStepIndex(idx);
      }
    }
  }, [storageKey, roleSteps.length]);

  if (!isOpen) return null;

  const currentStep = roleSteps[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < roleSteps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      localStorage.setItem(storageKey, String(nextIdx));
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      localStorage.setItem(storageKey, String(prevIdx));
    }
  };

  const handleGoToPage = (route: string) => {
    navigate(route);
    onClose();
  };

  const handleRestart = () => {
    setCurrentStepIndex(0);
    localStorage.setItem(storageKey, '0');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0b1f17]/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] rounded-3xl w-full max-w-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(11,31,23,0.25)] flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[rgba(11,31,23,0.08)] bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] flex items-center justify-center text-sm font-semibold font-mono">
              {currentStep.stepNumber}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.15)] uppercase">
                  {currentStep.role} WORKFLOW
                </span>
                <span className="text-xs text-[#6b7f75] font-mono">
                  Step {currentStepIndex + 1} of {roleSteps.length}
                </span>
              </div>
              <h2 className="text-base text-[#0b1f17] tracking-tight mt-0.5 font-normal">
                {currentStep.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#3d5248] hover:text-[#0b1f17] flex items-center justify-center border border-[rgba(11,31,23,0.1)] transition text-xs"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body with 7 Strict Invariants */}
        <div className="p-6 space-y-4 overflow-y-auto font-sans text-xs">
          {/* 1. Where am I? */}
          <div className="p-3.5 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] flex items-center justify-between">
            <span className="text-[#6b7f75] font-medium">📍 Where am I?</span>
            <span className="font-mono text-[#2f7a50] font-semibold">{currentStep.whereAmI}</span>
          </div>

          {/* 2. Why does this step exist? */}
          <div className="space-y-1">
            <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#6b7f75] font-mono">
              💡 Why does this step exist?
            </h4>
            <p className="text-[#3d5248] leading-relaxed bg-white p-3.5 rounded-2xl border border-[rgba(11,31,23,0.08)]">
              {currentStep.whyThisStepExists}
            </p>
          </div>

          {/* 3. What should I do? */}
          <div className="space-y-1">
            <h4 className="text-[11px] uppercase tracking-wider font-semibold text-[#8a681c] font-mono">
              🎯 What should I do?
            </h4>
            <p className="text-[#3d5248] leading-relaxed bg-[#fbf7ed] p-3.5 rounded-2xl border border-[#e8dcb8]">
              {currentStep.whatShouldIDo}
            </p>
          </div>

          {/* 4. Action */}
          <div className="pt-1">
            <button
              onClick={() => handleGoToPage(currentStep.actionTargetRoute)}
              className="w-full py-2.5 px-4 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-medium text-white text-xs shadow-sm transition flex items-center justify-center gap-2"
            >
              <span>{currentStep.actionButtonText}</span>
            </button>
          </div>

          {/* 5. Expected Output & 6. How do I know it succeeded? */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#6b7f75] block font-semibold">
                📋 Expected Output
              </span>
              <p className="text-[#3d5248] text-[11px] leading-snug">
                {currentStep.expectedOutput}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#2f7a50] block font-semibold">
                ✓ How do I know it succeeded?
              </span>
              <p className="text-[#3d5248] text-[11px] leading-snug">
                {currentStep.howDoIKnowItSucceeded}
              </p>
            </div>
          </div>

          {/* 7. What's next? */}
          <div className="p-3.5 rounded-2xl bg-[#e9efe6] border border-[rgba(47,122,80,0.15)] flex items-center justify-between text-[11px]">
            <span className="text-[#2f7a50] font-medium">➡️ What&apos;s Next?</span>
            <span className="text-[#3d5248] font-sans italic">{currentStep.whatsNext}</span>
          </div>
        </div>

        {/* Footer Navigation Controls */}
        <div className="px-6 py-4 border-t border-[rgba(11,31,23,0.08)] bg-white flex items-center justify-between gap-4">
          <button
            onClick={handleRestart}
            className="text-xs text-[#6b7f75] hover:text-[#0b1f17] underline font-mono transition"
          >
            Restart Tour
          </button>

          <div className="flex items-center gap-2">
            <button
              disabled={currentStepIndex === 0}
              onClick={handlePrev}
              className="px-4 py-2 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs font-medium disabled:opacity-40 transition"
            >
              ← Previous
            </button>
            <button
              disabled={currentStepIndex === roleSteps.length - 1}
              onClick={handleNext}
              className="px-5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-medium disabled:opacity-40 transition shadow-sm"
            >
              Next Step →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
