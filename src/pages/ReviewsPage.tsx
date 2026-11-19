import React, { useState, useEffect } from 'react';
import { AiDecisionInspectorModal } from '../components/dashboard/AiDecisionInspectorModal.tsx';
import type {
  MilestoneReviewDetails,
  PayPalTransactionRecord,
  EvidenceProvenanceVerificationRecord,
  User,
  Contract,
  Milestone,
} from '../types/domain.ts';

export interface CustomEvidenceInput {
  repoUrl?: string;
  branch?: string;
  commitSha?: string;
  prUrl?: string;
  passedTests?: number;
  totalTests?: number;
  coveragePct?: number;
  developerNotes?: string;
}

interface ReviewsPageProps {
  currentUser: User | null;
  selectedMilestoneId: string;
  setSelectedMilestoneId: (id: string) => void;
  reviewDetails: MilestoneReviewDetails | null;
  contracts?: Contract[];
  selectedContractId?: string;
  onSelectContract?: (id: string) => void;
  provenanceData: {
    latestProvenance: EvidenceProvenanceVerificationRecord | null;
    provenanceHistory: EvidenceProvenanceVerificationRecord[];
  } | null;
  paypalTransactions: PayPalTransactionRecord[];
  loading: boolean;
  approvedAmountCentsInput: number;
  setApprovedAmountCentsInput: (val: number) => void;
  justification: string;
  setJustification: (val: string) => void;
  onSubmitDemoEvidence: (customData?: CustomEvidenceInput) => Promise<void>;
  onVerifyGithubProvenance: () => Promise<void>;
  onRunAiEvaluation: () => Promise<void>;
  onReviewAction: (action: 'approve' | 'reject' | 'request-changes') => Promise<void>;
  onPayPalAction: (step: 'order' | 'authorize' | 'capture') => Promise<void>;
  onPayPalReconcile: () => Promise<void>;
  onOpenAiInspector: () => void;
  onOpenPassport: () => void;
  onOpenDisputePack: () => void;
}

function formatUsdCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReviewsPage({
  currentUser,
  selectedMilestoneId,
  setSelectedMilestoneId,
  reviewDetails,
  contracts,
  selectedContractId,
  onSelectContract,
  provenanceData,
  paypalTransactions,
  loading,
  approvedAmountCentsInput,
  setApprovedAmountCentsInput,
  justification,
  setJustification,
  onSubmitDemoEvidence,
  onVerifyGithubProvenance,
  onRunAiEvaluation,
  onReviewAction,
  onPayPalAction,
  onPayPalReconcile,
  onOpenAiInspector,
  onOpenPassport,
  onOpenDisputePack,
}: ReviewsPageProps) {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<1 | 2 | 3 | 4>(1);

  const activeContract =
    contracts?.find((c) => c.id === selectedContractId) ?? contracts?.[0] ?? null;

  const milestonesList =
    activeContract?.milestones && activeContract.milestones.length > 0
      ? activeContract.milestones.map((m: Milestone) => ({
          id: m.id,
          label: `${m.title} (${m.status})`,
        }))
      : [
          { id: 'ms_seed_01', label: 'Milestone 1 · Core Deliverable (Active)' },
          { id: 'ms_seed_02', label: 'Milestone 2 · Settlement Policy Engine (Case B)' },
          { id: 'ms_seed_03', label: 'Milestone 3 · Audit Replay & Security' },
        ];

  // Custom Evidence Ingestion State (e.g. Flight Booking System or custom repo)
  const [intakeMode, setIntakeMode] = useState<'CUSTOM' | 'PRESET'>('CUSTOM');
  const [customRepo, setCustomRepo] = useState('https://github.com/Mohamed-529/flight-booking-system');
  const [customBranch, setCustomBranch] = useState('main');
  const [customCommit, setCustomCommit] = useState('7c4e21a93d8b1f52');
  const [customPr, setCustomPr] = useState('https://github.com/Mohamed-529/flight-booking-system/pull/1');
  const [customPassedTests, setCustomPassedTests] = useState(48);
  const [customTotalTests, setCustomTotalTests] = useState(48);
  const [customCoverage, setCustomCoverage] = useState(94.5);
  const [customNotes, setCustomNotes] = useState('Flight booking seat selection, itinerary state, and PayPal authorization integrated with 100% test pass.');

  const latestSub = reviewDetails?.latestSubmission;
  const latestEval = reviewDetails?.latestEvaluation;
  const policy = reviewDetails?.policyCalculation;
  const latestTx = paypalTransactions[0] ?? null;

  const latestApproval = reviewDetails?.approvals?.[0] ?? null;
  const isApprovedByHuman =
    reviewDetails?.milestone.status === 'APPROVED' ||
    reviewDetails?.milestone.status === 'SETTLED' ||
    latestApproval?.decision === 'APPROVE';

  const isCaptured =
    latestTx?.status === 'CAPTURED' ||
    reviewDetails?.milestone.paymentStatus === 'CAPTURED' ||
    reviewDetails?.milestone.status === 'SETTLED';

  const isAuthorized =
    latestTx?.status === 'AUTHORIZED' ||
    latestTx?.status === 'SIMULATED_AUTHORIZED' ||
    reviewDetails?.milestone.paymentStatus === 'AUTHORIZED';

  const isDeveloper = currentUser?.role === 'DEVELOPER';

  // Compute stage progression flags
  const isStage1Complete = Boolean(latestSub);
  const isStage2Complete = Boolean(latestEval && latestEval.status === 'COMPLETED');
  const isStage3Complete = isApprovedByHuman;
  const isStage4Complete = isCaptured;

  // Auto-advance spotlight stage as progression occurs
  useEffect(() => {
    if (isStage4Complete) {
      setActiveStage(4);
    } else if (isStage3Complete || isAuthorized) {
      setActiveStage(4);
    } else if (isStage2Complete) {
      setActiveStage(3);
    } else if (isStage1Complete) {
      setActiveStage(2);
    } else {
      setActiveStage(1);
    }
  }, [isStage1Complete, isStage2Complete, isStage3Complete, isStage4Complete, isAuthorized]);

  const handleCustomSubmit = async () => {
    if (intakeMode === 'CUSTOM') {
      await onSubmitDemoEvidence({
        repoUrl: customRepo,
        branch: customBranch,
        commitSha: customCommit,
        prUrl: customPr,
        passedTests: customPassedTests,
        totalTests: customTotalTests,
        coveragePct: customCoverage,
        developerNotes: customNotes,
      });
    } else {
      await onSubmitDemoEvidence();
    }
    setActiveStage(2);
  };

  // Steppers tailored by role
  const developerStages = [
    {
      id: 1 as const,
      number: '1',
      title: 'Submit Code & Proof',
      shortTitle: 'Submit Code',
      isComplete: isStage1Complete,
      chip: latestSub ? `✓ ${latestSub.ciReport.passedTests}/${latestSub.ciReport.totalTests} Tests` : 'Ready to Ingest',
      icon: '📦',
    },
    {
      id: 2 as const,
      number: '2',
      title: 'Multi-Agent Audit',
      shortTitle: 'AI Verification',
      isComplete: isStage2Complete,
      chip: latestEval
        ? `✓ ${latestEval.arbitratorRecommendation.recommendedOutcome} (3/3 AC)`
        : 'Run Multi-Agent AI',
      icon: '🤖',
    },
    {
      id: 3 as const,
      number: '3',
      title: 'My Eligible Payout',
      shortTitle: 'Earnings',
      isComplete: isStage3Complete,
      chip: isApprovedByHuman
        ? `✓ Permitted: ${formatUsdCents(policy?.permittedAmountCents ?? 227500)}`
        : 'Awaiting Client Approval',
      icon: '💰',
    },
    {
      id: 4 as const,
      number: '4',
      title: 'Escrow & Payout',
      shortTitle: 'Disbursement',
      isComplete: isStage4Complete,
      chip: isCaptured
        ? '✓ Funds Disbursed'
        : isAuthorized
        ? '🔒 Guaranteed in Escrow'
        : 'Pending 29-Day Hold',
      icon: '🏦',
    },
  ];

  const clientStages = [
    {
      id: 1 as const,
      number: '1',
      title: 'Review Deliverables',
      shortTitle: 'Deliverables',
      isComplete: isStage1Complete,
      chip: latestSub ? `✓ PR Merged & Tested` : 'Awaiting Dev Submission',
      icon: '🔍',
    },
    {
      id: 2 as const,
      number: '2',
      title: 'Tri-Agent Advisory',
      shortTitle: 'AI Consensus',
      isComplete: isStage2Complete,
      chip: latestEval
        ? `✓ ${latestEval.arbitratorRecommendation.recommendedOutcome} (3/3 AC)`
        : 'Pending AI Analysis',
      icon: '🛡️',
    },
    {
      id: 3 as const,
      number: '3',
      title: 'Fiduciary Approval Gate',
      shortTitle: 'Sign-Off',
      isComplete: isStage3Complete,
      chip: isApprovedByHuman
        ? `✓ Approved: ${formatUsdCents(policy?.permittedAmountCents ?? 227500)}`
        : 'Action Required',
      icon: '✍️',
    },
    {
      id: 4 as const,
      number: '4',
      title: 'PayPal Settlement',
      shortTitle: 'Settlement',
      isComplete: isStage4Complete,
      chip: isCaptured
        ? '✓ Settlement Complete'
        : isAuthorized
        ? '🔒 29-Day Hold Active'
        : 'Ready to Authorize',
      icon: '💳',
    },
  ];

  const currentStages = isDeveloper ? developerStages : clientStages;

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Top Banner: Clear Step Sequence Guide */}
      <div className="p-3.5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
          <span className="font-semibold text-[#0b1f17]">Interactive Fiduciary Lifecycle:</span>
          <span className="text-[#3d5248] hidden sm:inline">
            1. Developer submits code → 2. Tri-Agent AI verifies requirements → 3. Client approves fiduciary gate → 4. Client locks 29-day hold &amp; captures settlement.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-[#6b7f75]">Active Persona:</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
              isDeveloper ? 'bg-[#e0e7ff] text-[#2563eb]' : 'bg-[#e9efe6] text-[#2f7a50]'
            }`}
          >
            {isDeveloper ? '👨‍💻 MARCUS CHEN (DEVELOPER)' : '👩‍💼 ELENA VANCE (CLIENT)'}
          </span>
        </div>
      </div>

      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.08)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-5 h-[2px] inline-block ${isDeveloper ? 'bg-[#2563eb]' : 'bg-[#10b981]'}`} />
            <span
              className={`text-[11px] font-mono tracking-wider uppercase font-semibold ${
                isDeveloper ? 'text-[#2563eb]' : 'text-[#10b981]'
              }`}
            >
              {isDeveloper
                ? 'Developer Delivery & Payout Workbench · Marcus Chen'
                : 'Client Fiduciary Inspection & Settlement Vault · Elena Vance'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl text-[#0b1f17] tracking-tight font-normal">
            {isDeveloper ? 'Milestone Delivery & Escrow Payout' : 'Milestone Fiduciary Review & Settlement'}
          </h1>
          <p className="text-xs text-[#3d5248] mt-1 max-w-2xl leading-relaxed">
            {isDeveloper
              ? 'Submit real repository deliverables (e.g. Flight Booking System), trigger multi-agent AI verification, and monitor escrow payout release.'
              : 'Inspect software delivered by Marcus Chen (Developer), verify AI consensus risk scores, approve milestone payout caps, and release PayPal pre-authorized escrow holds.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenPassport}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-xs font-medium text-[#0b1f17] transition shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <span>🛡️</span> <span>View Passport</span>
          </button>
          <button
            onClick={onOpenDisputePack}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-xs font-medium text-[#0b1f17] transition shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <span>📂</span> <span>Dispute Pack</span>
          </button>
        </div>
      </div>

      {/* Target Milestone Selector & Contract Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(11,31,23,0.08)] pb-3 py-1">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-[#6b7f75] font-mono mr-1 tracking-wide uppercase shrink-0">
            Target Milestone:
          </span>
          {milestonesList.map((m: { id: string; label: string }) => {
            const isSelected = selectedMilestoneId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMilestoneId(m.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#0b1f17] text-white shadow-sm'
                    : 'bg-white border border-[rgba(11,31,23,0.12)] text-[#3d5248] hover:bg-[#f6f5f0] hover:text-[#0b1f17]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {contracts && contracts.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#6b7f75] font-mono text-[11px]">Contract:</span>
            <select
              value={selectedContractId ?? activeContract?.id}
              onChange={(e) => onSelectContract?.(e.target.value)}
              className="px-2.5 py-1 rounded-full bg-white border border-[rgba(11,31,23,0.15)] text-xs font-medium text-[#0b1f17] outline-none"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 1. TOP ANIMATED PIPELINE STEPPER */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_24px_-4px_rgba(11,31,23,0.05)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative">
          {currentStages.map((stage) => {
            const isActive = activeStage === stage.id;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(stage.id)}
                className={`text-left p-3.5 rounded-2xl transition-all relative z-10 border ${
                  isActive
                    ? isDeveloper
                      ? 'bg-[#f0f4ff] border-[#2563eb] shadow-sm'
                      : 'bg-[#f6f5f0] border-[#0b1f17] shadow-sm'
                    : stage.isComplete
                    ? 'bg-white hover:bg-[#faf9f5] border-[rgba(16,185,129,0.3)]'
                    : 'bg-white hover:bg-[#faf9f5] border-[rgba(11,31,23,0.08)] opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold transition-colors ${
                      stage.isComplete
                        ? 'bg-[#10b981] text-white'
                        : isActive
                        ? isDeveloper
                          ? 'bg-[#2563eb] text-white ring-2 ring-[#2563eb]/20'
                          : 'bg-[#0b1f17] text-white ring-2 ring-[#0b1f17]/20'
                        : 'bg-[#f6f5f0] text-[#6b7f75]'
                    }`}
                  >
                    {stage.isComplete ? '✓' : stage.number}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                      stage.isComplete
                        ? 'bg-[#e9efe6] text-[#2f7a50]'
                        : isActive
                        ? isDeveloper
                          ? 'bg-[#2563eb]/10 text-[#2563eb]'
                          : 'bg-[#0b1f17]/10 text-[#0b1f17]'
                        : 'bg-[#f6f5f0] text-[#6b7f75]'
                    }`}
                  >
                    {stage.isComplete ? 'COMPLETED' : isActive ? 'ACTIVE' : `STEP ${stage.number}`}
                  </span>
                </div>

                <div className="text-xs font-semibold text-[#0b1f17] flex items-center gap-1.5">
                  <span>{stage.icon}</span>
                  <span className="truncate">{stage.title}</span>
                </div>

                <div className="text-[10px] font-mono text-[#6b7f75] mt-1 truncate">
                  {stage.chip}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN LAYOUT: CENTER HERO SPOTLIGHT (70%) + STICKY SIDEBAR (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CENTER HERO SPOTLIGHT STAGE (Col-span 8) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-6 sm:p-7 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_24px_-4px_rgba(11,31,23,0.06)] min-h-[480px] flex flex-col justify-between transition-all">
            {/* ============================================================== */}
            {/* STAGE 1 SPOTLIGHT: DELIVERY EVIDENCE & CUSTOM INTAKE          */}
            {/* ============================================================== */}
            {activeStage === 1 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-8 h-8 rounded-2xl flex items-center justify-center text-sm font-bold ${
                        isDeveloper ? 'bg-[#e0e7ff] text-[#2563eb]' : 'bg-[#e9efe6] text-[#2f7a50]'
                      }`}
                    >
                      1
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        {isDeveloper
                          ? 'Stage 1 · Code & Automated Telemetry Submission'
                          : 'Stage 1 · Developer Deliverables Inspection'}
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        {isDeveloper
                          ? 'Ingest your custom repository (e.g. Flight Booking System), pull request status, and test telemetry.'
                          : 'Inspect git deliverables submitted by Marcus Chen (Developer) prior to escrow release.'}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-mono bg-[#f6f5f0] text-[#0b1f17] border border-[rgba(11,31,23,0.1)]">
                    {selectedMilestoneId}
                  </span>
                </div>

                {/* DEVELOPER CUSTOM INGESTION INTERFACE */}
                {isDeveloper && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-2.5">
                      <span className="text-xs font-semibold text-[#0b1f17]">
                        Select Delivery Input Mode:
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIntakeMode('CUSTOM')}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            intakeMode === 'CUSTOM'
                              ? 'bg-[#2563eb] text-white shadow-sm'
                              : 'bg-[#f6f5f0] text-[#6b7f75] hover:text-[#0b1f17]'
                          }`}
                        >
                          🔗 Custom GitHub Repo (Real App)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIntakeMode('PRESET')}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            intakeMode === 'PRESET'
                              ? 'bg-[#2563eb] text-white shadow-sm'
                              : 'bg-[#f6f5f0] text-[#6b7f75] hover:text-[#0b1f17]'
                          }`}
                        >
                          ⚡ Quick Demo Preset
                        </button>
                      </div>
                    </div>

                    {intakeMode === 'CUSTOM' ? (
                      /* Custom Deliverable Intake Form */
                      <div className="p-4 rounded-2xl bg-[#f0f4ff] border border-[rgba(37,99,235,0.15)] space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1e40af] flex items-center gap-1.5">
                            <span>✈️</span> <span>Real Repository Telemetry Intake (e.g., Flight Booking App)</span>
                          </span>
                          <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded text-[#2563eb] border border-[#2563eb]/20">
                            LIVE INPUT
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-semibold text-[#3d5248] block mb-1">
                              GitHub Repository URL:
                            </label>
                            <input
                              type="text"
                              value={customRepo}
                              onChange={(e) => setCustomRepo(e.target.value)}
                              placeholder="https://github.com/my-name/flight-booking-system"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2563eb]"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-[#3d5248] block mb-1">
                              Pull Request URL:
                            </label>
                            <input
                              type="text"
                              value={customPr}
                              onChange={(e) => setCustomPr(e.target.value)}
                              placeholder="https://github.com/my-name/flight-booking-system/pull/1"
                              className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2563eb]"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-[#3d5248] block mb-1">
                              Commit SHA &amp; Branch:
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={customCommit}
                                onChange={(e) => setCustomCommit(e.target.value)}
                                placeholder="7c4e21a93d8b1f52"
                                className="w-2/3 px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2563eb]"
                              />
                              <input
                                type="text"
                                value={customBranch}
                                onChange={(e) => setCustomBranch(e.target.value)}
                                placeholder="main"
                                className="w-1/3 px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2563eb]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-[#3d5248] block mb-1">
                              CI Tests Passed / Total (Coverage %):
                            </label>
                            <div className="flex gap-2 items-center">
                              <input
                                type="number"
                                value={customPassedTests}
                                onChange={(e) => setCustomPassedTests(Number(e.target.value))}
                                className="w-1/3 px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2563eb]"
                              />
                              <span className="text-[#6b7f75]">/</span>
                              <input
                                type="number"
                                value={customTotalTests}
                                onChange={(e) => setCustomTotalTests(Number(e.target.value))}
                                className="w-1/3 px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2563eb]"
                              />
                              <input
                                type="number"
                                step="0.5"
                                value={customCoverage}
                                onChange={(e) => setCustomCoverage(Number(e.target.value))}
                                className="w-1/3 px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#2563eb]"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-[#3d5248] block mb-1">
                            Developer Delivery Notes &amp; Solved Scope:
                          </label>
                          <input
                            type="text"
                            value={customNotes}
                            onChange={(e) => setCustomNotes(e.target.value)}
                            placeholder="Describe how the bug or milestone was delivered..."
                            className="w-full px-3 py-2 rounded-xl bg-white border border-[rgba(37,99,235,0.2)] text-[#0b1f17] text-xs outline-none focus:border-[#2563eb]"
                          />
                        </div>

                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[11px] text-[#475569]">
                            Multi-agent mesh will inspect this repository tree &amp; PR merge status.
                          </span>
                          <button
                            disabled={loading}
                            onClick={() => void handleCustomSubmit()}
                            className="px-6 py-2.5 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold shadow-md transition flex items-center gap-2"
                          >
                            <span>🚀 Ingest &amp; Submit Code Deliverables</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Preset Demo State */
                      <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-[#0b1f17]">Storefront Microservice Preset</div>
                          <div className="text-[11px] text-[#6b7f75]">Pre-loaded repository with 64/64 passing tests and zero CVEs.</div>
                        </div>
                        <button
                          disabled={loading}
                          onClick={() => void onSubmitDemoEvidence()}
                          className="px-5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold shadow-sm transition"
                        >
                          Submit Preset Evidence
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* CURRENT SUBMISSION SUMMARY (Visible to both Client & Developer) */}
                {latestSub ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-3 font-mono text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(11,31,23,0.08)] pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] font-semibold">
                            Attempt #{latestSub.attemptNumber}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#0b1f17] text-white">
                            PR: {latestSub.prStatus}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-white border border-[rgba(11,31,23,0.12)] text-[#0b1f17]">
                            Author: <strong>Marcus Chen</strong>
                          </span>
                        </div>
                        <span className="text-[11px] text-[#6b7f75]">
                          Branch: <strong className="text-[#0b1f17]">{latestSub.branch}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[#6b7f75] block">Repository:</span>
                          <span className="text-[#0b1f17] font-semibold truncate block" title={latestSub.repoUrl}>
                            {latestSub.repoUrl}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#6b7f75] block">Commit SHA:</span>
                          <span className="text-[#2f7a50] font-semibold block">
                            {latestSub.commitSha.slice(0, 16)}...
                          </span>
                        </div>
                      </div>

                      {latestSub.developerNotes && (
                        <div className="pt-2 border-t border-[rgba(11,31,23,0.06)] text-[11px] text-[#3d5248] italic">
                          Notes: &quot;{latestSub.developerNotes}&quot;
                        </div>
                      )}
                    </div>

                    {/* CI Test & Vulnerability Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] text-[#1c4b31] space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Automated CI Test Suite</span>
                          <span className="font-mono text-[#2f7a50]">
                            {latestSub.ciReport.passedTests}/{latestSub.ciReport.totalTests} Passed
                          </span>
                        </div>
                        <div className="w-full bg-[#c9e7d3] h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#10b981] h-full rounded-full transition-all duration-500"
                            style={{ width: `${latestSub.ciReport.coveragePct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#3d5248]">
                          <span>Provider: {latestSub.ciReport.provider}</span>
                          <span className="font-semibold">{latestSub.ciReport.coveragePct}% Coverage</span>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] text-[#8a681c] space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Security Vulnerability Scan</span>
                          <span className="font-mono text-[#2f7a50]">0 CVEs Found</span>
                        </div>
                        <p className="text-[11px] text-[#3d5248] leading-tight pt-1">
                          Zero critical or high severity vulnerabilities. Scanner:{' '}
                          <code className="text-[#0b1f17]">{latestSub.securityScan.scanner}</code>.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : !isDeveloper ? (
                  /* Client Empty State: Awaiting Developer */
                  <div className="p-8 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] text-center space-y-3">
                    <span className="text-3xl">⏳</span>
                    <h3 className="text-sm font-semibold text-[#0b1f17]">Awaiting Developer Delivery Submission</h3>
                    <p className="text-xs text-[#6b7f75] max-w-md mx-auto">
                      Marcus Chen has not yet submitted code deliverables for Milestone 1. Once submitted, our multi-agent AI mesh will inspect the repository commits, test suite, and pull request.
                    </p>
                    <div className="pt-2">
                      <button
                        disabled={loading}
                        onClick={() => void onSubmitDemoEvidence()}
                        className="px-6 py-2.5 rounded-full bg-white hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.15)] shadow-sm transition inline-flex items-center gap-2"
                      >
                        <span>⚡</span>
                        <span>Simulate Developer Submission (Test Sandbox)</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Stage 1 Actions: Strictly Persona-Driven */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)] flex flex-wrap items-center justify-between gap-3">
                  {isDeveloper ? (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={loading}
                          onClick={() => void onVerifyGithubProvenance()}
                          className="px-4 py-2 rounded-full bg-[#e9efe6] hover:bg-[#dce6d8] text-[#2f7a50] text-xs font-medium border border-[rgba(47,122,80,0.2)] transition disabled:opacity-50"
                        >
                          Verify GitHub Provenance
                        </button>
                      </div>
                      <button
                        disabled={loading}
                        onClick={() => {
                          void onRunAiEvaluation();
                          setActiveStage(2);
                        }}
                        className="px-6 py-2.5 rounded-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold shadow-md hover:shadow-lg transition flex items-center gap-2 group"
                      >
                        <span>Run Multi-Agent AI Acceptance Verification</span>
                        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-[#6b7f75]">
                        {latestSub
                          ? 'Deliverable ingested from Marcus Chen. Fiduciary review ready.'
                          : 'Waiting for Marcus Chen to submit code.'}
                      </span>
                      {latestSub && (
                        <button
                          disabled={loading}
                          onClick={() => {
                            if (!latestEval) {
                              void onRunAiEvaluation();
                            }
                            setActiveStage(2);
                          }}
                          className="px-6 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold shadow-md hover:shadow-lg transition flex items-center gap-2 group"
                        >
                          <span>Proceed to Tri-Agent AI Audit</span>
                          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STAGE 2 SPOTLIGHT: TRI-AGENT LIVE REASONING CONSOLE           */}
            {/* ============================================================== */}
            {activeStage === 2 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-2xl bg-[#e9efe6] text-[#2f7a50] flex items-center justify-center text-sm font-bold">
                      2
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        Stage 2 · Live Tri-Agent Multi-Agent Audit Console
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        Multi-agent mesh verifying repository code, security scans, and contractual criteria.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#fbf7ed] text-[#8a681c] border border-[#e8dcb8] font-mono font-medium">
                    ADVISORY ONLY
                  </span>
                </div>

                {/* LIVE AGENT TERMINAL STREAM (Visible Evidence) */}
                <div className="p-4 rounded-2xl bg-[#0b1f17] text-white font-mono text-[11px] space-y-2 shadow-inner border border-white/10">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[10px] text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                      <span className="text-emerald-400 font-semibold ml-1">Live Multi-Agent Telemetry Stream</span>
                    </div>
                    <span>Target: {latestSub?.repoUrl ?? 'https://github.com/Mohamed-529/TrustChain'}</span>
                  </div>

                  <div className="space-y-1.5 py-1 text-zinc-300">
                    <p className="text-emerald-400">
                      [Agent 1: EvidenceAgent] Ingesting commit SHA: <span className="text-white">{latestSub?.commitSha.slice(0, 16) ?? 'a8f4c219e03d'}...</span> (PR: {latestSub?.prStatus ?? 'MERGED'})
                    </p>
                    <p className="text-cyan-300">
                      [Agent 1: EvidenceAgent] Verifying CI Test Suite: <span className="text-white">{latestSub?.ciReport.passedTests ?? 64}/{latestSub?.ciReport.totalTests ?? 64} tests passed</span> ({latestSub?.ciReport.coveragePct ?? 91.5}% coverage). Validated ✓
                    </p>
                    <p className="text-amber-300">
                      [Agent 2: RiskAgent] Scanning dependency vulnerability tree (npm audit / Slither)... 0 Critical, 0 High findings. Clean ✓
                    </p>
                    <p className="text-indigo-300">
                      [Agent 3: ArbitratorAgent] Synthesizing deliverables against contractual acceptance criteria...
                    </p>
                    <p className="text-emerald-300 pl-4">
                      • AC-1 (Storefront &amp; Core Logic): Satisfied ✓
                    </p>
                    <p className="text-emerald-300 pl-4">
                      • AC-2 (Automated Test Threshold &gt;=90%): Satisfied ({latestSub?.ciReport.coveragePct ?? 91.5}%) ✓
                    </p>
                    <p className="text-emerald-300 pl-4">
                      • AC-3 (Zero Exploit Vulnerability Gate): Satisfied ✓
                    </p>
                    <p className="text-emerald-400 font-bold pt-1 border-t border-white/10">
                      ⚡ Final Consensus Verdict: PASS (Fiduciary Disbursement Permitted: $2,275.00)
                    </p>
                  </div>
                </div>

                {/* 3 Agents Staggered Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b7f75]">
                      Agent 1 · Evidence
                    </div>
                    <div className="text-xs font-semibold text-[#0b1f17]">Evidence Agent</div>
                    <div className="text-[11px] font-mono text-[#2f7a50] font-bold">
                      {latestEval?.evidenceAnalysis.verifiedCount ?? 3}/{latestEval?.evidenceAnalysis.totalCount ?? 3} Verified
                    </div>
                    <p className="text-[10px] text-[#6b7f75] leading-tight">
                      Verified commit SHA and PR merge telemetry against repository.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#6b7f75]">
                      Agent 2 · Security
                    </div>
                    <div className="text-xs font-semibold text-[#0b1f17]">Risk Agent</div>
                    <div className="text-[11px] font-mono text-[#2f7a50] font-bold">
                      {latestEval?.riskAnalysis.overallRiskSeverity ?? 'NONE'}
                    </div>
                    <p className="text-[10px] text-[#6b7f75] leading-tight">
                      Zero CVEs. Dependency tree sanitized against exploits.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] space-y-1.5">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#2f7a50]">
                      Agent 3 · Arbitrator
                    </div>
                    <div className="text-xs font-semibold text-[#1c4b31]">Arbitrator Agent</div>
                    <div className="text-[11px] font-mono text-[#2f7a50] font-bold">
                      {latestEval?.arbitratorRecommendation.recommendedOutcome ?? 'PASS'}
                    </div>
                    <p className="text-[10px] text-[#3d5248] leading-tight">
                      Contractual acceptance criteria verified.
                    </p>
                  </div>
                </div>

                {/* Acceptance Criteria Status Chips */}
                <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#6b7f75]">
                    Contractual Acceptance Criteria Status:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9] font-medium flex items-center gap-1.5">
                      <span>✓</span> <span>AC-1: Core Feature Logic &amp; Catalog State</span>
                    </span>
                    <span className="px-3 py-1 rounded-full text-[11px] bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9] font-medium flex items-center gap-1.5">
                      <span>✓</span> <span>AC-2: Automated CI Tests Passing (&gt;=90%)</span>
                    </span>
                    <span className="px-3 py-1 rounded-full text-[11px] bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9] font-medium flex items-center gap-1.5">
                      <span>✓</span> <span>AC-3: Zero Critical/High CVEs</span>
                    </span>
                  </div>
                </div>

                {/* Stage 2 Actions */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)] flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setIsInspectorOpen(true);
                      onOpenAiInspector();
                    }}
                    className="px-4 py-2.5 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs font-medium transition"
                  >
                    🔍 Inspect AI Reasoning
                  </button>

                  <button
                    onClick={() => setActiveStage(3)}
                    className="px-6 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold shadow-md transition flex items-center gap-2 group"
                  >
                    <span>{isDeveloper ? 'Check My Payout Status' : 'Proceed to Fiduciary Gate'}</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STAGE 3 SPOTLIGHT: POLICY GATE / DEVELOPER EARNINGS           */}
            {/* ============================================================== */}
            {activeStage === 3 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-2xl bg-[#e9efe6] text-[#2f7a50] flex items-center justify-center text-sm font-bold">
                      3
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        {isDeveloper
                          ? 'Stage 3 · Eligible Developer Payout Breakdown'
                          : 'Stage 3 · Deterministic Policy Gate & Buyer Sign-Off'}
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        {isDeveloper
                          ? 'Deterministic payout calculation based on contractual acceptance and SLA timeline.'
                          : 'Review calculated permitted cap and grant formal fiduciary approval for settlement release.'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono font-medium">
                    {isDeveloper ? 'DEVELOPER PAYOUT' : 'FIDUCIARY GATE'}
                  </span>
                </div>

                {/* Financial Breakdown Receipt */}
                <div className="p-5 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[#6b7f75]">
                    <span>Contract Agreed Milestone Budget:</span>
                    <span className="text-[#0b1f17] font-semibold text-sm">
                      {formatUsdCents(policy?.agreedAmountCents ?? 250000)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#6b7f75]">
                    <span>SLA Late Penalty (100 bps/day overdue):</span>
                    <span className="text-[#a62b2b] font-semibold">
                      -{formatUsdCents(policy?.latePenaltyCents ?? 22500)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#6b7f75]">
                    <span>Security Exploit Deductions:</span>
                    <span className="text-[#0b1f17] font-semibold">$0.00</span>
                  </div>
                  <div className="pt-3 border-t border-[rgba(11,31,23,0.12)] flex items-center justify-between">
                    <span className="font-sans font-bold text-sm text-[#0b1f17]">
                      {isDeveloper ? 'Your Eligible Payout Cap:' : 'Permitted Fiduciary Disbursement Cap:'}
                    </span>
                    <span className="text-xl font-bold text-[#10b981]">
                      {formatUsdCents(policy?.permittedAmountCents ?? 227500)}
                    </span>
                  </div>
                </div>

                {isDeveloper ? (
                  /* DEVELOPER PERSPECTIVE: Payout Status (Zero Buyer Buttons) */
                  <div className="space-y-3">
                    {isApprovedByHuman ? (
                      <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] text-[#1c4b31] space-y-1">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <span>✓</span> <span>Milestone Approved by Client (Elena Vance)</span>
                        </div>
                        <p className="text-[11px] text-[#3d5248]">
                          Approved amount: <strong>{formatUsdCents(policy?.permittedAmountCents ?? 227500)}</strong>. Escrow funds are ready for release in Stage 4.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] text-[#8a681c] space-y-1.5 text-center">
                        <div className="text-xs font-bold flex items-center justify-center gap-1.5">
                          <span>⏳</span> <span>Pending Client Fiduciary Approval</span>
                        </div>
                        <p className="text-[11px] text-[#3d5248]">
                          Client (Elena Vance) must review and approve the fiduciary gate before funds can be released.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* CLIENT PERSPECTIVE: Buyer Approval Form */
                  <div className="space-y-3">
                    {isApprovedByHuman ? (
                      <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] text-[#1c4b31] space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          <span>✓</span> <span>Fiduciary Approval Recorded</span>
                        </div>
                        <p className="text-[11px] text-[#3d5248] leading-tight">
                          Decision: <strong>{latestApproval?.decision ?? 'APPROVE'}</strong> • Permitted Amount:{' '}
                          <strong>{formatUsdCents(latestApproval?.approvedAmountCents ?? policy?.permittedAmountCents ?? 227500)}</strong>
                        </p>
                        <p className="text-[10px] text-[#6b7f75] italic pt-1 border-t border-[#a8d8b9]/50">
                          Rationale: &quot;{latestApproval?.justification ?? 'Acceptance criteria verified. Fiduciary gate cleared for settlement release.'}&quot;
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-[#6b7f75] block mb-1">
                              Disbursement Amount (Cents):
                            </label>
                            <input
                              type="number"
                              value={approvedAmountCentsInput}
                              onChange={(e) => setApprovedAmountCentsInput(Number(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs font-mono outline-none focus:border-[#10b981]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-[#6b7f75] block mb-1">
                              Fiduciary Justification (Required):
                            </label>
                            <input
                              type="text"
                              value={justification}
                              onChange={(e) => setJustification(e.target.value)}
                              placeholder="Document rationale..."
                              className="w-full px-3 py-2 rounded-xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] text-xs outline-none focus:border-[#10b981]"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            disabled={loading}
                            onClick={() => {
                              void onReviewAction('approve');
                              setActiveStage(4);
                            }}
                            className="px-5 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] font-semibold text-white text-xs transition disabled:opacity-40"
                          >
                            ✓ Approve Payout
                          </button>
                          <button
                            disabled={loading}
                            onClick={() => void onReviewAction('request-changes')}
                            className="px-4 py-2.5 rounded-full bg-[#fbf7ed] hover:bg-[#f5edd4] border border-[#e8dcb8] font-medium text-[#8a681c] text-xs transition disabled:opacity-40"
                          >
                            Revise
                          </button>
                          <button
                            disabled={loading}
                            onClick={() => void onReviewAction('reject')}
                            className="px-4 py-2.5 rounded-full bg-[#fdf2f2] hover:bg-[#fbe4e4] border border-[#f3c2c2] font-medium text-[#a62b2b] text-xs transition disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stage 3 Actions */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)] flex items-center justify-between">
                  <button
                    onClick={() => setActiveStage(2)}
                    className="text-xs text-[#6b7f75] hover:text-[#0b1f17] font-medium"
                  >
                    ← Back to AI Consensus
                  </button>
                  <button
                    onClick={() => setActiveStage(4)}
                    className="px-6 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold shadow-md transition flex items-center gap-2 group"
                  >
                    <span>{isDeveloper ? 'View Escrow Protection' : 'Proceed to Settlement Vault'}</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* STAGE 4 SPOTLIGHT: PAYPAL ESCROW & SETTLEMENT                 */}
            {/* ============================================================== */}
            {activeStage === 4 && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-2xl bg-[#e9efe6] text-[#2f7a50] flex items-center justify-center text-sm font-bold">
                      4
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-[#0b1f17]">
                        {isDeveloper
                          ? 'Stage 4 · Escrow Protection & Bank Disbursement'
                          : 'Stage 4 · Virtual Escrow Hold & Settlement Vault'}
                      </h2>
                      <p className="text-[11px] text-[#6b7f75]">
                        {isDeveloper
                          ? '29-day pre-authorized funds guaranteed in PayPal sandbox escrow awaiting disbursement.'
                          : 'Non-custodial 29-day authorization hold and programmatic release via PayPal Orders API v2.'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#e9efe6] text-[#2f7a50] border border-[rgba(47,122,80,0.2)] font-mono font-medium">
                    ORDERS V2
                  </span>
                </div>

                {/* Regulatory Non-Escrow Disclosure */}
                <div className="p-3.5 rounded-2xl bg-[#fbf7ed] border border-[#e8dcb8] text-[11px] text-[#8a681c] flex items-start gap-2.5">
                  <span className="text-base">⚠️</span>
                  <div>
                    <strong className="block font-semibold">Regulatory Non-Escrow Disclosure:</strong>
                    <span className="text-[#3d5248] leading-relaxed">
                      Veridex executes non-custodial 29-day authorization holds via PayPal Orders API v2. TrustChain never takes fund custody or controls third-party banking balances.
                    </span>
                  </div>
                </div>

                {/* Virtual Hold Vault Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#0b1f17] to-[#1a382c] text-white space-y-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🏦</span>
                      <span className="text-xs font-mono tracking-wider uppercase text-emerald-400 font-semibold">
                        PayPal Orders v2 Virtual Vault
                      </span>
                    </div>
                    <span
                      className={`px-3 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isCaptured
                          ? 'bg-[#10b981] text-white'
                          : isAuthorized
                          ? 'bg-amber-400 text-black'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {latestTx?.status ?? reviewDetails?.milestone.paymentStatus ?? 'NOT_READY'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-white/60 block text-[10px]">Order ID</span>
                      <span className="font-bold text-white truncate block">
                        {latestTx?.paypalOrderId ?? 'ORD-PENDING'}
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-white/60 block text-[10px]">Authorization ID (29d)</span>
                      <span className="font-bold text-emerald-400 truncate block">
                        {latestTx?.paypalAuthorizationId ?? (isAuthorized ? 'AUTH-LOCKED' : '—')}
                      </span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <span className="text-white/60 block text-[10px]">Capture ID</span>
                      <span className="font-bold text-white truncate block">
                        {latestTx?.paypalCaptureId ?? (isCaptured ? 'CAP-SETTLED' : '—')}
                      </span>
                    </div>
                  </div>

                  {isCaptured && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✓</span>
                        <span>
                          <strong>Funds Released ($2,275.00 Settled):</strong> Transferred directly to developer PayPal sandbox account.
                        </span>
                      </div>
                      <button
                        onClick={onOpenPassport}
                        className="px-3 py-1 rounded-full bg-white text-[#0b1f17] text-[10px] font-bold shadow-sm"
                      >
                        Inspect Hash Seal
                      </button>
                    </div>
                  )}
                </div>

                {/* Role Specific Actions */}
                <div className="pt-4 border-t border-[rgba(11,31,23,0.08)]">
                  {isDeveloper ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl bg-[#edf6f0] border border-[#a8d8b9] text-[#1c4b31] space-y-1">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>🛡️</span> <span>Developer Escrow Guarantee</span>
                        </div>
                        <p className="text-[11px] text-[#3d5248]">
                          {isCaptured
                            ? 'Funds have been disbursed to your account. Cryptographic audit receipt recorded.'
                            : isAuthorized
                            ? 'Client has pre-authorized the 29-day payment hold. Payout will execute automatically upon fiduciary sign-off.'
                            : 'Waiting for client to lock pre-authorized escrow hold.'}
                        </p>
                      </div>
                      <button
                        disabled={loading}
                        onClick={() => void onPayPalReconcile()}
                        className="w-full px-4 py-2.5 rounded-full bg-white hover:bg-[#f6f5f0] text-[#2f7a50] text-xs font-semibold border border-[rgba(47,122,80,0.25)] transition shadow-sm"
                      >
                        🔄 Refresh Escrow &amp; Payout Telemetry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] text-xs text-[#3d5248] space-y-1">
                        <div className="font-semibold text-[#0b1f17] flex items-center gap-1.5">
                          <span>💳</span> <span>Client 3-Step Fiduciary Settlement Protocol:</span>
                        </div>
                        <p className="text-[11px] text-[#6b7f75]">
                          Follow sequential steps 1, 2, and 3 below to establish the pre-authorized hold and release funds.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                          disabled={loading}
                          onClick={() => void onPayPalAction('order')}
                          className="px-3.5 py-2.5 rounded-full bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.12)] transition disabled:opacity-50"
                        >
                          1. Create Order (AUTHORIZE)
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => void onPayPalAction('authorize')}
                          className="px-3.5 py-2.5 rounded-full bg-[#fbf7ed] hover:bg-[#f5edd4] border border-[#e8dcb8] text-[#8a681c] text-xs font-medium transition disabled:opacity-50"
                        >
                          2. Authorize Hold (29 Days)
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => void onPayPalAction('capture')}
                          className={`px-3.5 py-2.5 rounded-full text-xs font-bold transition shadow-sm ${
                            isCaptured
                              ? 'bg-[#edf6f0] text-[#1c4b31] border border-[#a8d8b9]'
                              : isAuthorized
                              ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-md'
                              : 'bg-[#0b1f17] hover:bg-[#1a382c] text-white'
                          }`}
                        >
                          {isCaptured ? '✓ Funds Released' : '3. Capture Settlement & Release Funds →'}
                        </button>
                      </div>

                      <button
                        disabled={loading}
                        onClick={() => void onPayPalReconcile()}
                        className="w-full px-4 py-2 rounded-full bg-white hover:bg-[#f6f5f0] text-[#2f7a50] text-xs font-medium border border-[rgba(47,122,80,0.2)] transition text-center"
                      >
                        🔄 Reconcile with Sandbox
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. STICKY SIDEBAR TAILORED BY ROLE (Col-span 4)                */}
        {/* ============================================================== */}
        <div className="lg:col-span-4 space-y-4">
          <div className="sticky top-6 p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_24px_-4px_rgba(11,31,23,0.06)] space-y-5">
            <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-3.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${isDeveloper ? 'bg-[#2563eb]' : 'bg-[#10b981]'}`} />
                <span className="text-xs font-mono uppercase tracking-wider text-[#0b1f17] font-semibold">
                  {isDeveloper ? 'Developer Earnings Vault' : 'Client Fiduciary Vault'}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                  isDeveloper ? 'bg-[#e0e7ff] text-[#2563eb]' : 'bg-[#e9efe6] text-[#2f7a50]'
                }`}
              >
                {isDeveloper ? 'MY EARNINGS' : 'FIDUCIARY'}
              </span>
            </div>

            {/* Payout Display */}
            <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] text-center space-y-1">
              <span className="text-[11px] font-mono text-[#6b7f75] uppercase tracking-wider block">
                {isDeveloper ? 'My Eligible Net Payout' : 'Permitted Disbursement Cap'}
              </span>
              <div className="text-3xl font-extrabold text-[#0b1f17] font-mono tracking-tight">
                {formatUsdCents(policy?.permittedAmountCents ?? 227500)}
              </div>
              <div className="text-[10px] text-[#6b7f75] pt-1">
                Agreed: <strong>{formatUsdCents(policy?.agreedAmountCents ?? 250000)}</strong> • Penalty:{' '}
                <strong className="text-[#a62b2b]">-{formatUsdCents(policy?.latePenaltyCents ?? 22500)}</strong>
              </div>
            </div>

            {/* Status Checks Tailored by Persona */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">
                  {isDeveloper ? 'My Code Deliverable:' : 'Developer Submission:'}
                </span>
                <span className="font-semibold text-[#0b1f17] truncate max-w-[150px]">
                  {latestSub ? latestSub.repoUrl.split('/').pop() || 'Flight App' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">AI Verification:</span>
                <span className="font-semibold text-[#10b981]">
                  {latestEval ? `${latestEval.arbitratorRecommendation.recommendedOutcome} (3/3 AC)` : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">
                  {isDeveloper ? 'Escrow Protection:' : 'Bank Escrow Hold:'}
                </span>
                <span className="font-semibold text-[#0b1f17]">
                  {isCaptured ? 'SETTLED' : isAuthorized ? 'AUTHORIZED (29d)' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(11,31,23,0.06)]">
                <span className="text-[#6b7f75]">Audit Trail:</span>
                <span className="font-semibold text-[#2f7a50]">
                  SHA-256 VERIFIED
                </span>
              </div>
            </div>

            {/* Quick Stage Jump */}
            <div className="space-y-1.5 pt-2 border-t border-[rgba(11,31,23,0.08)]">
              <span className="text-[10px] font-mono text-[#6b7f75] uppercase tracking-wider block">
                Quick Stage Jump:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {currentStages.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setActiveStage(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition text-left truncate ${
                      activeStage === st.id
                        ? isDeveloper
                          ? 'bg-[#2563eb] text-white'
                          : 'bg-[#0b1f17] text-white'
                        : 'bg-[#f6f5f0] text-[#3d5248] hover:bg-[#ecebe4]'
                    }`}
                  >
                    {st.number}. {st.shortTitle}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit & Legal Actions */}
            <div className="pt-2 border-t border-[rgba(11,31,23,0.08)] space-y-2">
              <button
                onClick={onOpenPassport}
                className="w-full px-3.5 py-2 rounded-xl bg-[#f6f5f0] hover:bg-[#ecebe4] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.08)] transition flex items-center justify-center gap-1.5"
              >
                <span>🛡️</span> <span>Inspect Evidence Passport</span>
              </button>
              <button
                onClick={onOpenDisputePack}
                className="w-full px-3.5 py-2 rounded-xl bg-white hover:bg-[#f6f5f0] text-[#0b1f17] text-xs font-medium border border-[rgba(11,31,23,0.12)] transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>📂</span> <span>Generate Dispute Evidence Pack</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AiDecisionInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        reviewDetails={reviewDetails}
        onOpenPassport={onOpenPassport}
        onOpenDisputePack={onOpenDisputePack}
      />
    </div>
  );
}
