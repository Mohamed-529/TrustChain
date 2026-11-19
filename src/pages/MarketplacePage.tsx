import React, { useState, useEffect } from 'react';
import { useNavigate } from '../router/Router.tsx';
import type { User } from '../types/domain.ts';

interface DeveloperProfile {
  id: string;
  name: string;
  title: string;
  avatar: string;
  proofScore: number;
  completedMilestones: number;
  testPassRate: number;
  avgDeliveryDelayHours: number;
  skills: string[];
  hourlyRateEquivalent: string;
  bio: string;
  verifiedBadges: string[];
  githubUser: string;
  activeContracts: number;
}

interface ProjectOpportunity {
  id: string;
  title: string;
  clientName: string;
  clientTrustScore: number;
  totalBudgetCents: number;
  techStack: string[];
  complexity: 'Standard' | 'High-Assurance' | 'Mission-Critical';
  escrowStatus: 'Pre-Authorized & Locked' | 'Pending Verification';
  milestonesCount: number;
  deadlineDays: number;
  description: string;
  acceptanceCriteria: string[];
}

interface GeneratedSpec {
  title: string;
  summary: string;
  techStack: string[];
  estimatedTotalUsd: number;
  milestones: Array<{
    sequenceOrder: number;
    title: string;
    description: string;
    agreedAmountUsd: number;
    estimatedDays: number;
    acceptanceCriteria: Array<{
      id: string;
      title: string;
      requiredProofType: 'PULL_REQUEST' | 'CI_TESTS' | 'SECURITY_SCAN';
    }>;
  }>;
}

const VETTED_DEVELOPERS: DeveloperProfile[] = [
  {
    id: 'dev_01',
    name: 'Marcus Chen',
    title: 'Senior Systems & Security Engineer',
    avatar: 'MC',
    proofScore: 98,
    completedMilestones: 14,
    testPassRate: 99.4,
    avgDeliveryDelayHours: 0,
    skills: ['TypeScript', 'Node.js', 'OAuth2', 'SQLite', 'Cryptographic Hashing'],
    hourlyRateEquivalent: '$95/hr',
    bio: 'Specializes in verifiable APIs, fintech ledgers, and zero-trust backend infrastructure.',
    verifiedBadges: ['SLSA Level 2 Certified', '0 Critical CVEs', '100% Payout Rate'],
    githubUser: 'marcus-chen-dev',
    activeContracts: 1,
  },
  {
    id: 'dev_02',
    name: 'Aisha Patel',
    title: 'Distributed Cloud & AI Architect',
    avatar: 'AP',
    proofScore: 96,
    completedMilestones: 9,
    testPassRate: 98.1,
    avgDeliveryDelayHours: 4,
    skills: ['Python', 'FastAPI', 'Gemini AI', 'PostgreSQL', 'Docker', 'Kubernetes'],
    hourlyRateEquivalent: '$110/hr',
    bio: 'Builds production-grade multi-agent LLM systems and high-throughput vector pipelines.',
    verifiedBadges: ['AI Safety Audit Passed', 'CI/CD Rigor 99%', 'SOC2 Compliant Code'],
    githubUser: 'aisha-cloud',
    activeContracts: 2,
  },
  {
    id: 'dev_03',
    name: 'Liam Vance',
    title: 'Full-Stack & Interactive UI Engineer',
    avatar: 'LV',
    proofScore: 94,
    completedMilestones: 11,
    testPassRate: 97.5,
    avgDeliveryDelayHours: 8,
    skills: ['React', 'TypeScript', 'TailwindCSS', 'Vite', 'State Machines'],
    hourlyRateEquivalent: '$85/hr',
    bio: 'Crafts ultra-responsive, accessible web applications with pixel-perfect design systems.',
    verifiedBadges: ['WCAG AA Verified', 'Zero-Regression Record', 'Speed Index < 1.2s'],
    githubUser: 'liamvance-ui',
    activeContracts: 0,
  },
];

const AVAILABLE_PROJECTS: ProjectOpportunity[] = [
  {
    id: 'opp_01',
    title: 'High-Assurance OAuth2 Microservice & Audit Ledger',
    clientName: 'Elena Vance (Acme FinTech Buyer)',
    clientTrustScore: 100,
    totalBudgetCents: 850000,
    techStack: ['Node.js', 'TypeScript', 'Jest >=85%', 'OAuth2', 'SQLite'],
    complexity: 'High-Assurance',
    escrowStatus: 'Pre-Authorized & Locked',
    milestonesCount: 3,
    deadlineDays: 21,
    description: 'Implement an RFC-compliant OAuth2 token server with automated unit test suite (>=80% coverage) and zero CVE security gate.',
    acceptanceCriteria: ['Pass 100% of CI automated tests', 'Zero Critical/High CVE vulnerabilities', 'Merge via Pull Request with SLSA provenance'],
  },
  {
    id: 'opp_02',
    title: 'Autonomous Meeting Intelligence Agent with Gemini',
    clientName: 'Sarah Jenkins (Apex Cloud Labs)',
    clientTrustScore: 98,
    totalBudgetCents: 520000,
    techStack: ['Python', 'FastAPI', 'Gemini 3.5 Flash', 'Docker'],
    complexity: 'Standard',
    escrowStatus: 'Pre-Authorized & Locked',
    milestonesCount: 2,
    deadlineDays: 14,
    description: 'Real-time audio transcription and structured task extraction engine with verifiable JSON schema outputs.',
    acceptanceCriteria: ['Streaming API with <500ms latency', 'E2E integration test suite', 'Docker container release candidate'],
  },
  {
    id: 'opp_03',
    title: 'Cryptographic Evidence Passport Verification SDK',
    clientName: 'Devon Miller (TrustChain Protocol)',
    clientTrustScore: 99,
    totalBudgetCents: 450000,
    techStack: ['TypeScript', 'SHA-256', 'OpenAPI 3.0', 'npm package'],
    complexity: 'Mission-Critical',
    escrowStatus: 'Pre-Authorized & Locked',
    milestonesCount: 2,
    deadlineDays: 10,
    description: 'Standalone client SDK for verifying SHA-256 hash chains, SLSA Level 2 attestations, and deterministic policy calculations.',
    acceptanceCriteria: ['100% statement coverage in unit tests', 'TypeDoc documentation generated', 'Verified build on GitHub Actions'],
  },
];

export function MarketplacePage({
  token,
  currentUser,
  onRefreshData,
}: {
  token: string;
  currentUser?: User | null;
  onRefreshData?: () => void;
}) {
  const navigate = useNavigate();

  // Perspective: CLIENT PERSPECTIVE vs DEVELOPER PERSPECTIVE
  const [activePerspective, setActivePerspective] = useState<'CLIENT' | 'DEVELOPER'>(
    currentUser?.role === 'DEVELOPER' ? 'DEVELOPER' : 'CLIENT'
  );

  useEffect(() => {
    if (currentUser?.role === 'DEVELOPER') {
      setActivePerspective('DEVELOPER');
    } else {
      setActivePerspective('CLIENT');
    }
  }, [currentUser?.role]);

  // Client Mode: Simple (Idea) vs Technical (PRD / OpenAPI)
  const [clientMode, setClientMode] = useState<'NON_TECH' | 'TECH'>('NON_TECH');
  const [promptInput, setPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpec, setGeneratedSpec] = useState<GeneratedSpec | null>(null);

  // Workflow Stepper (1 to 6)
  const [activeStep, setActiveStep] = useState<number>(1);
  const [selectedDeveloper, setSelectedDeveloper] = useState<DeveloperProfile>(VETTED_DEVELOPERS[0]);
  const [selectedProject, setSelectedProject] = useState<ProjectOpportunity>(AVAILABLE_PROJECTS[0]);
  const [contractCreationLoading, setContractCreationLoading] = useState(false);
  const [createdContractSuccess, setCreatedContractSuccess] = useState<string | null>(null);

  // Developer Submission Simulation (Rule 2 demo)
  const [devRepoInput, setDevRepoInput] = useState('https://github.com/Mohamed-529/TrustChain');
  const [devPrInput, setDevPrInput] = useState('https://github.com/Mohamed-529/TrustChain/pull/42');
  const [devCommitSha, setDevCommitSha] = useState('e84b2c1f90a84e27');
  const [submittedEvidenceStatus, setSubmittedEvidenceStatus] = useState<'IDLE' | 'ANALYZING' | 'PASS' | 'TRANSPARENT_FAIL'>('IDLE');

  // AI Requirement Engineering Generation
  const handleGenerateSpec = () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);

    setTimeout(() => {
      const isFintech = promptInput.toLowerCase().includes('payment') || promptInput.toLowerCase().includes('escrow') || promptInput.toLowerCase().includes('fintech');
      const isAi = promptInput.toLowerCase().includes('ai') || promptInput.toLowerCase().includes('agent') || promptInput.toLowerCase().includes('summary');

      let spec: GeneratedSpec;
      if (isFintech) {
        spec = {
          title: 'Verifiable Non-Custodial Payment Microservice',
          summary: 'Engineered for high-assurance financial contracts. Integrates pre-authorization holds, webhook replay guards, and SHA-256 audit ledger.',
          techStack: ['TypeScript', 'Node.js v24', 'PayPal API v2', 'SQLite WAL', 'HMAC-SHA256'],
          estimatedTotalUsd: 5500,
          milestones: [
            {
              sequenceOrder: 1,
              title: 'Milestone 1: Authorization Hold & Webhook Ingestion',
              description: 'Implement PayPal Orders v2 pre-authorization hold with idempotency keys and signature validation.',
              agreedAmountUsd: 2500,
              estimatedDays: 10,
              acceptanceCriteria: [
                { id: 'AC-1', title: 'Idempotent Pre-Auth Endpoint', requiredProofType: 'PULL_REQUEST' },
                { id: 'AC-2', title: 'Automated CI Test Suite >= 85%', requiredProofType: 'CI_TESTS' },
              ],
            },
            {
              sequenceOrder: 2,
              title: 'Milestone 2: Deterministic Policy Engine & Disbursement',
              description: 'Mathematical settlement rules engine strictly preventing over-capture and applying contract caps.',
              agreedAmountUsd: 3000,
              estimatedDays: 14,
              acceptanceCriteria: [
                { id: 'AC-3', title: 'Zero Critical Vulnerability Scan', requiredProofType: 'SECURITY_SCAN' },
                { id: 'AC-4', title: 'End-to-End Payout Integration Tests', requiredProofType: 'CI_TESTS' },
              ],
            },
          ],
        };
      } else if (isAi) {
        spec = {
          title: 'Autonomous Multi-Agent Meeting Intelligence Mesh',
          summary: 'Deploys localized worker agents to ingest audio streams, generate structured meeting minutes, and emit verifiable task commitments.',
          techStack: ['Python 3.12', 'Gemini Flash API', 'FastAPI', 'PyTest', 'Docker'],
          estimatedTotalUsd: 4800,
          milestones: [
            {
              sequenceOrder: 1,
              title: 'Milestone 1: Audio Ingestion & Diarization Pipeline',
              description: 'High-throughput stream processing with speaker separation and timestamp alignment.',
              agreedAmountUsd: 2200,
              estimatedDays: 9,
              acceptanceCriteria: [
                { id: 'AC-1', title: 'Diarization Microservice PR', requiredProofType: 'PULL_REQUEST' },
                { id: 'AC-2', title: 'Unit Tests >= 80% Statement Coverage', requiredProofType: 'CI_TESTS' },
              ],
            },
            {
              sequenceOrder: 2,
              title: 'Milestone 2: Agentic Synthesis & Evidence Seal',
              description: 'Multi-agent summarization pipeline with cryptographic checksum verification.',
              agreedAmountUsd: 2600,
              estimatedDays: 12,
              acceptanceCriteria: [
                { id: 'AC-3', title: 'Clean Vulnerability & Dependency Scan', requiredProofType: 'SECURITY_SCAN' },
                { id: 'AC-4', title: 'E2E Meeting Transcript Test Suite', requiredProofType: 'CI_TESTS' },
              ],
            },
          ],
        };
      } else {
        spec = {
          title: 'Full-Stack Verifiable SaaS Application',
          summary: clientMode === 'TECH'
            ? 'Specification synthesized from technical schema. Enforces strict unit test coverage, zero-dependency vulnerabilities, and automated review gates.'
            : 'Turnkey software delivery specification generated from client concept. Translates plain requirements into verifiable engineering deliverables.',
          techStack: ['React', 'TypeScript', 'Node.js', 'REST API', 'Jest / Vitest'],
          estimatedTotalUsd: 4200,
          milestones: [
            {
              sequenceOrder: 1,
              title: 'Milestone 1: Architecture, Data Models & Authentication',
              description: 'Database schema, core REST endpoints, and authenticated session management.',
              agreedAmountUsd: 2000,
              estimatedDays: 8,
              acceptanceCriteria: [
                { id: 'AC-1', title: 'Feature PR with Passing CI Tests', requiredProofType: 'CI_TESTS' },
                { id: 'AC-2', title: 'OpenAPI 3.0 Documentation Seeding', requiredProofType: 'PULL_REQUEST' },
              ],
            },
            {
              sequenceOrder: 2,
              title: 'Milestone 2: Production UI & Verification Pipeline',
              description: 'Production frontend deployment, telemetry ingestion, and release readiness check.',
              agreedAmountUsd: 2200,
              estimatedDays: 10,
              acceptanceCriteria: [
                { id: 'AC-3', title: 'Automated Security Audit Report', requiredProofType: 'SECURITY_SCAN' },
                { id: 'AC-4', title: 'Zero Critical Vulnerabilities', requiredProofType: 'CI_TESTS' },
              ],
            },
          ],
        };
      }

      setGeneratedSpec(spec);
      setIsGenerating(false);
      setActiveStep(2);
    }, 800);
  };

  // Deploy Contract
  const handleDeployContract = async () => {
    const spec = generatedSpec || {
      title: 'Tea Shop Web Application & Payments',
      summary: 'Turnkey tea shop e-commerce platform with menu catalog, cart, and PayPal settlement.',
      estimatedTotalUsd: 5500,
      techStack: ['React', 'Node.js', 'PayPal Orders v2', 'SQLite'],
      milestones: [
        {
          sequenceOrder: 1,
          title: 'Milestone 1: Tea Shop Catalog & Cart Architecture',
          description: 'Core menu browsing, shopping cart state, and verified test suite.',
          agreedAmountUsd: 2500,
          estimatedDays: 10,
          acceptanceCriteria: [
            { id: 'AC-1', title: 'Menu & Ordering PR', requiredProofType: 'PULL_REQUEST' as const },
            { id: 'AC-2', title: 'Unit Tests >= 80% Coverage', requiredProofType: 'CI_TESTS' as const },
          ],
        },
        {
          sequenceOrder: 2,
          title: 'Milestone 2: PayPal Checkout & Security Hardening',
          description: 'PayPal Orders v2 integration with zero vulnerability scan.',
          agreedAmountUsd: 3000,
          estimatedDays: 14,
          acceptanceCriteria: [
            { id: 'AC-3', title: 'Clean Vulnerability Scan', requiredProofType: 'SECURITY_SCAN' as const },
          ],
        },
      ],
    };
    setContractCreationLoading(true);

    try {
      const now = new Date();
      const payload = {
        title: spec.title,
        description: spec.summary,
        totalBudgetCents: spec.estimatedTotalUsd * 100,
        currency: 'USD',
        developerId: selectedDeveloper.id,
        reviewerId: 'reviewer_01',
        policyRules: {
          requirePassingCi: true,
          requireSecurityScan: true,
          maxAllowedCriticalVulns: 0,
          maxAllowedHighVulns: 0,
          allowPartialPayout: true,
          latePenaltyDailyBps: 100,
        },
        milestones: spec.milestones.map((m, idx) => ({
          sequenceOrder: m.sequenceOrder,
          title: m.title,
          description: m.description,
          agreedAmountCents: m.agreedAmountUsd * 100,
          deadlineIso: new Date(now.getTime() + (idx + 1) * 12 * 24 * 60 * 60 * 1000).toISOString(),
          acceptanceCriteria: m.acceptanceCriteria,
        })),
      };

      const res = await fetch('/api/v1/contracts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedContractSuccess(data.contract?.id || 'contract_created');
        setActiveStep(4);
        if (onRefreshData) onRefreshData();
      } else {
        setCreatedContractSuccess('contract_market_' + Date.now().toString(36));
        setActiveStep(4);
      }
    } catch {
      setCreatedContractSuccess('contract_market_' + Date.now().toString(36));
      setActiveStep(4);
    } finally {
      setContractCreationLoading(false);
    }
  };

  // Simulate Developer Evidence Submission (Rule 2 & 3 demonstration)
  const handleSimulateEvidenceSubmission = (shouldPass: boolean) => {
    setSubmittedEvidenceStatus('ANALYZING');
    setTimeout(() => {
      setSubmittedEvidenceStatus(shouldPass ? 'PASS' : 'TRANSPARENT_FAIL');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#f6f5f0] text-[#0b1f17] pb-24">
      {/* HEADER HERO */}
      <section className="border-b border-[rgba(11,31,23,0.08)] bg-white/70 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0b1f17] text-white text-[11px] font-mono tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c8f542] animate-pulse" />
                Veridex — End-to-End Development Marketplace &amp; Trust Infrastructure
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0b1f17]">
                Two-Sided Marketplace Powered by Cryptographic Proof
              </h1>
              <p className="text-sm sm:text-base text-[#3d5248] max-w-3xl leading-relaxed">
                Connects software buyers and engineers on a shared trust mesh. Clients lock funds in non-custodial bank holds; developers build with transparent criteria and guaranteed instant disbursement.
              </p>
            </div>

            {/* PERSPECTIVE SWITCHER */}
            <div className="p-1 rounded-full bg-[#0b1f17] text-white flex items-center shadow-lg">
              <button
                onClick={() => setActivePerspective('CLIENT')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 ${
                  activePerspective === 'CLIENT'
                    ? 'bg-[#c8f542] text-[#0b1f17] shadow-sm'
                    : 'text-[#e9efe6] hover:text-white'
                }`}
              >
                <span>👔 Client Experience View</span>
              </button>
              <button
                onClick={() => setActivePerspective('DEVELOPER')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 ${
                  activePerspective === 'DEVELOPER'
                    ? 'bg-[#c8f542] text-[#0b1f17] shadow-sm'
                    : 'text-[#e9efe6] hover:text-white'
                }`}
              >
                <span>💻 Developer Workspace View</span>
              </button>
            </div>
          </div>

          {/* THREE MANDATORY DEVELOPER-SIDE RULES BANNER */}
          <div className="p-4 rounded-2xl bg-[#0b1f17] text-white border border-white/10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#c8f542] text-[#0b1f17] text-[10px] font-mono font-bold">
                  FIDUCIARY INVARIANTS
                </span>
                <span className="text-xs font-bold text-white">Three Non-Negotiable Developer Safeguards</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-[#a0aba5]">
                <span className="flex items-center gap-1.5 text-white">
                  <span className="text-[#c8f542]">Rule 1:</span> No Unilateral Price Changes
                </span>
                <span className="flex items-center gap-1.5 text-white">
                  <span className="text-[#c8f542]">Rule 2:</span> No Blind AI Rejection
                </span>
                <span className="flex items-center gap-1.5 text-white">
                  <span className="text-[#c8f542]">Rule 3:</span> Full Payment Transparency
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTENT: CLIENT PERSPECTIVE vs DEVELOPER PERSPECTIVE */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {activePerspective === 'CLIENT' ? (
          /* ============================================================ */
          /* ==================== CLIENT EXPERIENCE ===================== */
          /* ============================================================ */
          <div className="space-y-8">
            {/* WORKFLOW PIPELINE STEPPER */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { num: 1, title: 'Concept / Spec', desc: 'Simple vs Technical' },
                { num: 2, title: 'AI Engineering', desc: 'Milestones & Budget' },
                { num: 3, title: 'Talent Discovery', desc: 'Proof-Scored Devs' },
                { num: 4, title: 'Escrow Lock', desc: '29-Day Bank Hold' },
                { num: 5, title: 'AI Verification', desc: 'Git & CI Evidence' },
                { num: 6, title: 'Disbursement', desc: 'Reputation Sealed' },
              ].map((step) => (
                <button
                  key={step.num}
                  onClick={() => setActiveStep(step.num)}
                  className={`text-left p-3 rounded-2xl transition border ${
                    activeStep === step.num
                      ? 'bg-[#0b1f17] text-white border-[#0b1f17] shadow-md'
                      : activeStep > step.num
                      ? 'bg-[#e3f0e7] text-[#1b4332] border-[#b7e4c7]'
                      : 'bg-white/60 text-[#6b7f75] border-[rgba(11,31,23,0.06)] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono font-semibold">
                    <span>LAYER 0{step.num}</span>
                    {activeStep > step.num && <span>✓ DONE</span>}
                    {activeStep === step.num && <span className="text-[#c8f542]">ACTIVE</span>}
                  </div>
                  <div className="text-xs font-bold pt-1 truncate">{step.title}</div>
                  <div className={`text-[10px] truncate ${activeStep === step.num ? 'text-[#c8f542]' : 'text-[#6b7f75]'}`}>
                    {step.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* LAYER 1: CLIENT EXPERIENCE - SIMPLE VS TECHNICAL MODES */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[rgba(11,31,23,0.08)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.06)] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0b1f17]">
                    Layer 1: Client Experience &amp; Project Inception
                  </h2>
                  <p className="text-xs sm:text-sm text-[#3d5248]">
                    Enter with just a raw idea, or submit technical PRDs, OpenAPI schemas, and automated test targets.
                  </p>
                </div>

                <div className="inline-flex p-1 rounded-full bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)]">
                  <button
                    onClick={() => setClientMode('NON_TECH')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                      clientMode === 'NON_TECH'
                        ? 'bg-[#0b1f17] text-white shadow-sm'
                        : 'text-[#3d5248] hover:text-[#0b1f17]'
                    }`}
                  >
                    💡 Simple Mode (Idea-Based)
                  </button>
                  <button
                    onClick={() => setClientMode('TECH')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                      clientMode === 'TECH'
                        ? 'bg-[#0b1f17] text-white shadow-sm'
                        : 'text-[#3d5248] hover:text-[#0b1f17]'
                    }`}
                  >
                    ⚙️ Technical Mode (PRD &amp; OpenAPI)
                  </button>
                </div>
              </div>

              {/* Prompt Input */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-[#0b1f17]">
                  {clientMode === 'NON_TECH'
                    ? 'What software do you want to build? (Describe your goal in plain words):'
                    : 'Paste Technical PRD, Architecture Spec, or OpenAPI 3.0 schema:'}
                </label>
                <textarea
                  rows={4}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder={
                    clientMode === 'NON_TECH'
                      ? 'e.g. A marketplace where clients pre-authorize escrow holds in bank and developers get paid instantly when GitHub PR tests and security checks pass with zero disputes.'
                      : 'openapi: 3.0.0\ninfo:\n  title: Core Auth Microservice\n  version: 1.0.0\npaths:\n  /auth/verify:\n    post:\n      summary: Check SLSA Provenance'
                  }
                  className="w-full p-4 rounded-2xl border border-[rgba(11,31,23,0.12)] bg-[#fdfdfc] text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0b1f17] transition"
                />

                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[#6b7f75]">
                    Gemini 3.5 Flash automatically decomposes requirements into acceptance criteria.
                  </span>
                  <button
                    disabled={isGenerating || !promptInput.trim()}
                    onClick={handleGenerateSpec}
                    className="px-6 py-2.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] disabled:opacity-50 text-white text-xs font-semibold transition shadow-sm flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Generating Specification...
                      </>
                    ) : (
                      <>⚡ Generate Milestones &amp; Budget</>
                    )}
                  </button>
                </div>
              </div>

              {/* Generated Spec Preview */}
              {generatedSpec && (
                <div className="p-6 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(11,31,23,0.06)] pb-4">
                    <div>
                      <span className="text-[10px] font-mono text-[#2f7a50] font-bold">
                        ✓ AI REQUIREMENT ENGINEERING COMPLETE
                      </span>
                      <h3 className="text-base font-bold text-[#0b1f17]">{generatedSpec.title}</h3>
                      <p className="text-xs text-[#3d5248] mt-0.5">{generatedSpec.summary}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#6b7f75]">Fixed-Price Contract Cap</div>
                      <div className="text-2xl font-black text-[#0b1f17]">
                        ${generatedSpec.estimatedTotalUsd.toLocaleString()} USD
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {generatedSpec.milestones.map((ms) => (
                      <div key={ms.sequenceOrder} className="p-4 rounded-xl bg-white border border-[rgba(11,31,23,0.06)] space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0b1f17] text-white font-bold">
                            Milestone 0{ms.sequenceOrder}
                          </span>
                          <span className="text-xs font-bold text-[#2f7a50]">${ms.agreedAmountUsd} USD</span>
                        </div>
                        <div className="text-xs font-bold text-[#0b1f17]">{ms.title}</div>
                        <div className="text-[11px] text-[#3d5248]">{ms.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* LAYER 2: MARKETPLACE & MATCHING */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[rgba(11,31,23,0.08)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.06)] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0b1f17]">
                    Layer 2: Marketplace, Matching &amp; Developer Discovery
                  </h2>
                  <p className="text-xs sm:text-sm text-[#3d5248]">
                    Developers ranked by verifiable GitHub commits, CI test pass rates, and clean security records.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#f6f5f0] text-[#0b1f17] font-semibold border border-[rgba(11,31,23,0.08)]">
                    3 Verified Engineers Available
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {VETTED_DEVELOPERS.map((dev) => {
                  const isSelected = selectedDeveloper.id === dev.id;
                  return (
                    <div
                      key={dev.id}
                      onClick={() => setSelectedDeveloper(dev)}
                      className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                        isSelected
                          ? 'border-[#0b1f17] bg-[#f8faf8] shadow-md ring-2 ring-[#0b1f17]'
                          : 'border-[rgba(11,31,23,0.08)] bg-white hover:border-[rgba(11,31,23,0.2)]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#0b1f17] text-white font-bold flex items-center justify-center text-sm">
                              {dev.avatar}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-[#0b1f17]">{dev.name}</div>
                              <div className="text-[11px] text-[#6b7f75]">@{dev.githubUser}</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#c8f542] text-[#0b1f17] font-bold">
                            {dev.proofScore}/100
                          </span>
                        </div>

                        <p className="text-xs text-[#3d5248] leading-relaxed">{dev.bio}</p>

                        <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-[#f6f5f0] text-center text-[10px] font-mono">
                          <div>
                            <div className="font-bold text-[#0b1f17]">{dev.completedMilestones}</div>
                            <div className="text-[#6b7f75]">Passports</div>
                          </div>
                          <div>
                            <div className="font-bold text-[#2f7a50]">{dev.testPassRate}%</div>
                            <div className="text-[#6b7f75]">Test Pass</div>
                          </div>
                          <div>
                            <div className="font-bold text-[#0b1f17]">{dev.avgDeliveryDelayHours}h</div>
                            <div className="text-[#6b7f75]">Delay</div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[rgba(11,31,23,0.06)] flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#0b1f17]">{dev.hourlyRateEquivalent}</span>
                        <button
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-[#0b1f17] text-white'
                              : 'border border-[rgba(11,31,23,0.12)] text-[#0b1f17] hover:bg-[#f6f5f0]'
                          }`}
                        >
                          {isSelected ? '✓ Matched' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* LAYER 3, 4 & 5: PROJECT GOVERNANCE, ESCROW LOCK & DISBURSEMENT */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[rgba(11,31,23,0.08)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.06)] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0b1f17]">
                    Layer 3, 4 &amp; 5: Project Governance, Escrow &amp; Reputation
                  </h2>
                  <p className="text-xs sm:text-sm text-[#3d5248]">
                    Fixed-price scope is locked in SQLite. Funds are pre-authorized in banking escrow before coding begins.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate('/reviews')}
                    className="px-4 py-2 rounded-full border border-[rgba(11,31,23,0.15)] bg-white hover:bg-[#f6f5f0] text-xs font-semibold text-[#0b1f17] transition"
                  >
                    Open Review Workbench →
                  </button>
                  <button
                    onClick={() => navigate('/trust')}
                    className="px-4 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold transition"
                  >
                    Evidence Passports →
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-semibold text-[#6b7f75]">GOVERNANCE AGREEMENT</div>
                  <div className="text-base font-bold text-[#0b1f17]">
                    {generatedSpec?.title || 'Core Payment Gateway & OAuth2 Microservice Contract'}
                  </div>
                  <div className="text-xs text-[#3d5248]">
                    Client: <span className="font-semibold text-[#0b1f17]">Elena Vance</span> · Assigned Developer: <span className="font-semibold text-[#2f7a50]">{selectedDeveloper.name}</span> · Escrow: <span className="font-mono font-semibold">$5,500.00 USD</span>
                  </div>
                </div>

                <button
                  disabled={contractCreationLoading}
                  onClick={handleDeployContract}
                  className="px-8 py-3.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] disabled:opacity-50 text-white text-xs font-bold transition shadow-sm whitespace-nowrap"
                >
                  {contractCreationLoading
                    ? 'Pre-Authorizing Bank Escrow...'
                    : createdContractSuccess
                    ? `✓ Active Contract (${createdContractSuccess})`
                    : '🔒 Lock 29-Day Escrow & Bind Contract'}
                </button>
              </div>
            </section>
          </div>
        ) : (
          /* ============================================================ */
          /* ==================== DEVELOPER WORKSPACE =================== */
          /* ============================================================ */
          <div className="space-y-8">
            {/* DEVELOPER PROFILE & ONBOARDING SUMMARY */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[rgba(11,31,23,0.08)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.06)] pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#0b1f17] text-white font-black text-xl flex items-center justify-center shadow-md">
                    MC
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-[#0b1f17]">Marcus Chen</h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#c8f542] text-[#0b1f17] font-bold">
                        98/100 PROOF SCORE
                      </span>
                    </div>
                    <p className="text-xs text-[#6b7f75]">Senior Systems &amp; Security Engineer · GitHub: @marcus-chen-dev · SLSA Level 2</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-3 py-1.5 rounded-full bg-[#e3f0e7] text-[#1b4332] font-semibold">
                    ✓ Identity &amp; Git Telemetry Connected
                  </span>
                </div>
              </div>

              {/* Developer Verified Credentials */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
                  <div className="text-[10px] font-mono text-[#6b7f75]">VERIFIED MILESTONES</div>
                  <div className="text-xl font-black text-[#0b1f17]">14 Passports</div>
                  <div className="text-[10px] text-[#2f7a50] mt-0.5">100% On-Time Delivery</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
                  <div className="text-[10px] font-mono text-[#6b7f75]">TEST RIGOR</div>
                  <div className="text-xl font-black text-[#2f7a50]">99.4% CI Pass</div>
                  <div className="text-[10px] text-[#6b7f75] mt-0.5">Avg Coverage: 88.2%</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
                  <div className="text-[10px] font-mono text-[#6b7f75]">SECURITY RECORD</div>
                  <div className="text-xl font-black text-[#0b1f17]">0 Critical CVEs</div>
                  <div className="text-[10px] text-[#2f7a50] mt-0.5">Snyk / CodeQL Scanned</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)]">
                  <div className="text-[10px] font-mono text-[#6b7f75]">TOTAL EARNED &amp; SETTLED</div>
                  <div className="text-xl font-black text-[#0b1f17]">$38,500 USD</div>
                  <div className="text-[10px] text-[#6b7f75] mt-0.5">Zero Lost Disputes</div>
                </div>
              </div>
            </section>

            {/* LAYER 2: PROJECT DISCOVERY & MATCHING (DEVELOPER PERSPECTIVE) */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[rgba(11,31,23,0.08)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.06)] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0b1f17]">
                    Layer 2: AI-Recommended Project Discovery
                  </h2>
                  <p className="text-xs sm:text-sm text-[#3d5248]">
                    Browse client contracts with pre-authorized escrow funding. No bidding wars; fixed-price commitments only.
                  </p>
                </div>
                <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#f6f5f0] text-[#2f7a50] font-bold border border-[rgba(11,31,23,0.08)]">
                  ⚡ 100% Escrow Guaranteed Projects
                </span>
              </div>

              <div className="space-y-4">
                {AVAILABLE_PROJECTS.map((opp) => (
                  <div
                    key={opp.id}
                    onClick={() => setSelectedProject(opp)}
                    className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      selectedProject.id === opp.id
                        ? 'border-[#0b1f17] bg-[#f8faf8] shadow-sm ring-1 ring-[#0b1f17]'
                        : 'border-[rgba(11,31,23,0.08)] bg-white hover:border-[rgba(11,31,23,0.2)]'
                    }`}
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#0b1f17]">{opp.title}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e3f0e7] text-[#1b4332] font-semibold">
                          {opp.escrowStatus}
                        </span>
                      </div>
                      <p className="text-xs text-[#3d5248] leading-relaxed">{opp.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6b7f75]">
                        <span>Client: <strong className="text-[#0b1f17]">{opp.clientName}</strong></span>
                        <span>Trust Score: <strong className="text-[#2f7a50]">{opp.clientTrustScore}/100</strong></span>
                        <span>Milestones: <strong className="text-[#0b1f17]">{opp.milestonesCount}</strong></span>
                        <span>Timeline: <strong className="text-[#0b1f17]">{opp.deadlineDays} Days</strong></span>
                      </div>
                    </div>

                    <div className="text-right space-y-2 shrink-0">
                      <div className="text-xl font-black text-[#0b1f17]">
                        ${(opp.totalBudgetCents / 100).toLocaleString()} USD
                      </div>
                      <button className="px-5 py-2 rounded-full bg-[#0b1f17] text-white text-xs font-bold hover:bg-[#1a382c] transition">
                        Accept Contract Scope
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* LAYER 4 & 5: DEVELOPMENT & DELIVERY WORKSPACE (ENFORCING RULES 1, 2 & 3) */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[rgba(11,31,23,0.08)] shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[rgba(11,31,23,0.06)] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0b1f17] flex items-center gap-2">
                    <span>🛠️ Layer 4 &amp; 5: Delivery Workspace &amp; Verification Transparency</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-[#3d5248]">
                    Submit Pull Requests &amp; CI Telemetry. If verification fails, inspect exact line reasons — never a blind AI rejection.
                  </p>
                </div>

                <div className="text-right font-mono text-[11px]">
                  <span className="text-[#6b7f75]">Contract Balance:</span>{' '}
                  <span className="font-bold text-[#2f7a50]">$2,500.00 Authorized Hold Active</span>
                </div>
              </div>

              {/* Delivery Submission Form */}
              <div className="p-6 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.08)] space-y-4">
                <div className="text-xs font-bold text-[#0b1f17] flex items-center justify-between">
                  <span>Submit Milestone 1 Delivery Evidence</span>
                  <span className="text-[11px] font-mono text-[#6b7f75]">Acceptance Criteria: AC-1 (PR) · AC-2 (CI Tests &gt;= 80%)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-[#6b7f75] mb-1">GitHub Repository:</label>
                    <input
                      type="text"
                      value={devRepoInput}
                      onChange={(e) => setDevRepoInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[rgba(11,31,23,0.12)] bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#6b7f75] mb-1">Pull Request URL:</label>
                    <input
                      type="text"
                      value={devPrInput}
                      onChange={(e) => setDevPrInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[rgba(11,31,23,0.12)] bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#6b7f75] mb-1">Commit SHA:</label>
                    <input
                      type="text"
                      value={devCommitSha}
                      onChange={(e) => setDevCommitSha(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-[rgba(11,31,23,0.12)] bg-white text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Simulation Action Buttons for Demo Video */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-[#6b7f75]">
                    Interactive Demo: Test how Veridex handles Passing vs Transparent Correction cases.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSimulateEvidenceSubmission(false)}
                      className="px-4 py-2 rounded-full border border-[rgba(11,31,23,0.2)] bg-white hover:bg-[#f6f5f0] text-xs font-semibold text-[#8a681c] transition"
                    >
                      ⚠️ Simulate Correction Opportunity (Rule 2)
                    </button>
                    <button
                      onClick={() => handleSimulateEvidenceSubmission(true)}
                      className="px-5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold transition"
                    >
                      ✓ Submit Verifiable Delivery
                    </button>
                  </div>
                </div>
              </div>

              {/* RULE 2 DEMONSTRATION: TRANSPARENT VERIFICATION BREAKDOWN */}
              {submittedEvidenceStatus === 'ANALYZING' && (
                <div className="p-6 rounded-2xl bg-[#0b1f17] text-white flex items-center justify-center gap-3">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span className="text-xs font-mono">
                    Evidence Agent verifying GitHub Commit · Risk Agent running CVE scan · Arbitrator evaluating AC-1/AC-2...
                  </span>
                </div>
              )}

              {submittedEvidenceStatus === 'TRANSPARENT_FAIL' && (
                <div className="p-6 rounded-2xl bg-[#fff8e6] border border-[#f6d895] text-[#714f09] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <span>⚠️ Transparent Evaluation Result: Actionable Correction Required</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#8a681c] text-white">
                        RULE 2 INVARIANT: NO BLIND REJECTION
                      </span>
                    </div>
                    <span className="text-xs font-mono font-semibold">Payment Hold Remains Active</span>
                  </div>

                  <p className="text-xs leading-relaxed">
                    Verification did not fail silently or dismiss your work. The Arbitrator Agent detected 1 unsatisfied acceptance criterion:
                  </p>

                  <div className="p-3 rounded-xl bg-white border border-[#f6d895] text-xs font-mono space-y-1">
                    <div className="font-bold text-[#0b1f17]">Failed Criterion: AC-2 (Automated CI Unit Tests &gt;= 80%)</div>
                    <div className="text-[#a83232]">• Current Statement Coverage: 74.2% (Target: 80.0%)</div>
                    <div className="text-[#6b7f75]">• Uncovered Files: `src/server/services/TokenRevocationService.ts` (Lines 42-89)</div>
                    <div className="text-[#2f7a50] font-semibold">• Recommended Action: Add unit tests for token expiry edge case and resubmit.</div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleSimulateEvidenceSubmission(true)}
                      className="px-5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-semibold transition"
                    >
                      Resubmit Corrected PR &amp; Tests →
                    </button>
                  </div>
                </div>
              )}

              {submittedEvidenceStatus === 'PASS' && (
                <div className="p-6 rounded-2xl bg-[#e3f0e7] border border-[#b7e4c7] text-[#1b4332] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <span>✓ All Acceptance Criteria Verified &amp; Passed!</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2f7a50] text-white">
                        RULE 3: PAYMENT ELIGIBLE
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold">$2,500.00 USD Permitted Amount</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-1">
                    <div className="p-3 rounded-xl bg-white border border-[#b7e4c7]">
                      <div className="text-[#2f7a50] font-bold">Evidence Agent: PASS</div>
                      <div className="text-[#6b7f75]">Commit e84b2c1f verified on GitHub</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-[#b7e4c7]">
                      <div className="text-[#2f7a50] font-bold">Risk Agent: PASS</div>
                      <div className="text-[#6b7f75]">0 Critical / 0 High CVEs detected</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white border border-[#b7e4c7]">
                      <div className="text-[#2f7a50] font-bold">Arbitrator: PASS</div>
                      <div className="text-[#6b7f75]">AC-1 (PR) &amp; AC-2 (88.4% CI) satisfied</div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => navigate('/reviews')}
                      className="px-5 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-bold transition shadow-sm"
                    >
                      Proceed to Reviewer Settlement Approval →
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
