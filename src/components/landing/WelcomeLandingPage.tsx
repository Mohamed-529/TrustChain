/**
 * WelcomeLandingPage — Autonomous Evidence-to-Settlement Orchestration
 *
 * Bespoke, high-end fiduciary trust experience designed for TrustChain / MilestoneProof AI.
 * Bridges software development repositories, multi-agent AI verification, and PayPal Orders v2 settlement.
 */

import React, { useState } from 'react';
import { useNavigate } from '../../router/Router.tsx';

interface WelcomeLandingPageProps {
  onStartTour: () => void;
  onOpenSignIn?: () => void;
}

export function WelcomeLandingPage({ onStartTour }: WelcomeLandingPageProps) {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<number>(3); // 1: Setup, 2: Evidence, 3: AI Check, 4: Paid
  const [selectedAgentTab, setSelectedAgentTab] = useState<'evidence' | 'risk' | 'arbitrator'>('arbitrator');

  return (
    <div className="min-h-screen bg-[#f6f5f0] text-[#0b1f17] font-sans selection:bg-[#c8f542] selection:text-[#0b1f17]">
      
      {/* ─────────────────────────────────────────────────────────────
          SECTION 1: HERO (Autonomous Evidence-to-Settlement Orchestration)
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6 max-w-6xl mx-auto text-center overflow-hidden">
        {/* Soft Ambient Radial Sage & Chartreuse Glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#b2d6b9]/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[#c8f542]/20 rounded-full blur-[110px] pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Centered Kicker with Pine Line */}
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-5 h-[1.5px] bg-[#2f7a50] inline-block" />
            <span className="text-[13px] text-[#2f7a50] tracking-tight font-normal">
              Autonomous Software Escrow &amp; Verification Engine
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-normal text-[#0b1f17] tracking-[-0.035em] max-w-4xl mx-auto leading-[1.08] break-words">
            Cryptographic Proof for Milestone Disbursements
          </h1>

          {/* Subheading */}
          <p className="text-sm sm:text-base md:text-lg text-[#3d5248] max-w-2xl mx-auto leading-relaxed font-normal px-2">
            Eliminate freelance ghosting, broken deliverables, and software milestone disputes.
            Veridex bridges git repositories, automated test telemetry, and non-custodial payment holds.
            Tri-agent AI verifies milestone criteria before human reviewers approve programmatic settlement.
          </p>

          {/* Twin Pill Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-md mx-auto sm:max-w-none">
            <button
              onClick={() => navigate('/reviews')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-sm font-medium transition shadow-sm active:scale-[0.98]"
            >
              Inspect Live Evaluation
            </button>
            <button
              onClick={onStartTour}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#e9efe6] hover:bg-[#dce6d8] text-[#0b1f17] text-sm font-medium border border-[rgba(11,31,23,0.08)] transition active:scale-[0.98]"
            >
              Explore Interactive Walkthrough
            </button>
          </div>

          {/* Core Architecture Standards Bar */}
          <div className="mt-20 pt-8 border-t border-[rgba(11,31,23,0.08)] flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-[#6b7f75]">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#2f7a50] font-semibold">
              Core Architecture:
            </span>
            <span className="hover:text-[#0b1f17] transition cursor-pointer" onClick={() => navigate('/developers')}>
              OpenAPI 3.0 Contract Specification
            </span>
            <span>•</span>
            <span className="hover:text-[#0b1f17] transition cursor-pointer" onClick={() => navigate('/timeline')}>
              Critical-Path Execution Gantt
            </span>
            <span>•</span>
            <span className="hover:text-[#0b1f17] transition cursor-pointer" onClick={() => navigate('/intelligence')}>
              Cryptographic Decision Ledger
            </span>
            <span>•</span>
            <span className="hover:text-[#0b1f17] transition cursor-pointer" onClick={() => navigate('/reviews')}>
              Multi-Agent AI Verification Mesh
            </span>
            <span>•</span>
            <span className="hover:text-[#0b1f17] transition cursor-pointer" onClick={() => navigate('/trust')}>
              Immutable Evidence Passport
            </span>
          </div>
        </div>
      </section>


      {/* ─────────────────────────────────────────────────────────────
          SECTION 2: CORE INTERACTIVE DEMONSTRATION
      ───────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto pb-24">
        <div className="bg-[#e9efe6] rounded-[36px] p-6 sm:p-10 border border-[rgba(11,31,23,0.08)] space-y-8 shadow-sm">
          
          {/* 3-Column Interactive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* COLUMN 1: Client (Elena Vance) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0b1f17]">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-[rgba(11,31,23,0.08)] text-[11px]">
                  📋
                </div>
                <div>
                  <div>Enterprise Client (Elena Vance)</div>
                  <div className="text-[11px] text-[#6b7f75] font-normal">defines contract specification &amp; funds hold</div>
                </div>
              </div>

              {/* Card 1: Agreed Contract Scope */}
              <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[rgba(11,31,23,0.06)] space-y-3 shadow-sm text-xs">
                <div className="text-[#6b7f75] text-[11px]">Active Contract #contract_seed_01</div>
                <div className="font-semibold text-[#0b1f17] text-sm">
                  Core Payment Gateway &amp; OAuth2 Microservice
                </div>
                <div className="space-y-1.5 font-mono text-[11px] text-[#3d5248]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#2f7a50]">✓</span>
                    <span>OAuth2 auth endpoints &amp; route guards</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#2f7a50]">✓</span>
                    <span>Automated CI unit test suite (&gt;=80% cov)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#2f7a50]">✓</span>
                    <span>Zero critical/high CVE vulnerabilities</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-[rgba(11,31,23,0.06)] flex items-center justify-between text-[11px]">
                  <span className="text-[#6b7f75]">Target Milestone Allocation:</span>
                  <span className="font-mono font-semibold text-[#0b1f17]">$2,500.00 USD</span>
                </div>
              </div>

              {/* Card 2: Pre-Authorization Hold */}
              <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[rgba(11,31,23,0.06)] space-y-2 shadow-sm text-xs">
                <div className="text-[#6b7f75] text-[11px]">Fiduciary Capital Protection</div>
                <div className="font-semibold text-[#0b1f17]">
                  Non-Custodial Pre-Authorization Escrow Hold
                </div>
                <p className="text-[11px] text-[#3d5248] leading-relaxed">
                  29-day financial guarantee. Funds stay securely in the client&apos;s pre-authorized hold until formal milestone sign-off.
                </p>
              </div>
            </div>

            {/* COLUMN 2: Center TrustChain Tri-Agent Review */}
            <div className="space-y-4">
              {/* Elevated Primary White Review Card */}
              <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_10px_30px_-5px_rgba(11,31,23,0.08)] space-y-5 text-xs">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[rgba(11,31,23,0.08)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2f7a50] animate-pulse" />
                    <span className="font-medium text-[#0b1f17] text-sm">Multi-Agent Consensus Engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] text-[10px] font-mono font-semibold">
                      Gemini 3.5 Flash
                    </span>
                    <span className="text-[11px] text-[#6b7f75] font-mono">Live Synthesis</span>
                  </div>
                </div>

                {/* Agreed terms vs The delivery */}
                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className="space-y-1">
                    <div className="text-[#6b7f75] uppercase text-[10px]">Contract Criteria (AC)</div>
                    <div className="text-[#3d5248]">PR merged with test suite</div>
                    <div className="text-[#3d5248]">Coverage &gt;= 80%</div>
                    <div className="text-[#3d5248]">0 CVEs detected</div>
                  </div>
                  <div className="space-y-1 border-l border-[rgba(11,31,23,0.08)] pl-3">
                    <div className="text-[#6b7f75] uppercase text-[10px]">Ingested Telemetry</div>
                    <div className="text-[#0b1f17] font-semibold">SHA a8f4c219 (PR #42)</div>
                    <div className="text-[#2f7a50] font-semibold">64/64 pass (91.5% cov)</div>
                    <div className="text-[#2f7a50] font-semibold">0 CVEs detected</div>
                  </div>
                </div>

                {/* Tri-Agent AI Advisory Synthesis & Verification Mesh */}
                <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-3 text-center">
                  <div className="text-xs font-semibold text-[#0b1f17]">
                    Tri-Agent AI Advisory Synthesis &amp; Verification Mesh
                  </div>
                  <div className="flex justify-center gap-2 text-[10px] font-mono">
                    <button
                      onClick={() => setSelectedAgentTab('evidence')}
                      className={`px-3 py-1.5 rounded-full transition ${
                        selectedAgentTab === 'evidence'
                          ? 'bg-[#0b1f17] text-white shadow-sm'
                          : 'bg-white text-[#3d5248] border border-[rgba(11,31,23,0.1)]'
                      }`}
                    >
                      Evidence Agent
                    </button>
                    <button
                      onClick={() => setSelectedAgentTab('risk')}
                      className={`px-3 py-1.5 rounded-full transition ${
                        selectedAgentTab === 'risk'
                          ? 'bg-[#0b1f17] text-white shadow-sm'
                          : 'bg-white text-[#3d5248] border border-[rgba(11,31,23,0.1)]'
                      }`}
                    >
                      Risk Agent
                    </button>
                    <button
                      onClick={() => setSelectedAgentTab('arbitrator')}
                      className={`px-3 py-1.5 rounded-full transition ${
                        selectedAgentTab === 'arbitrator'
                          ? 'bg-[#0b1f17] text-white shadow-sm'
                          : 'bg-white text-[#3d5248] border border-[rgba(11,31,23,0.1)]'
                      }`}
                    >
                      Arbitrator Agent
                    </button>
                  </div>

                  <p className="text-[11px] text-[#3d5248] leading-relaxed">
                    {selectedAgentTab === 'evidence' && 'Extracts git commit tree, verifies PR #42 merge commit SHA, and validates CI pipeline artifacts.'}
                    {selectedAgentTab === 'risk' && 'Audits npm dependency trees and static analysis logs. Validates 0 high or critical vulnerabilities.'}
                    {selectedAgentTab === 'arbitrator' && 'Cross-examines evidence against acceptance criteria AC-1 & AC-2; issues RECOMMEND_APPROVAL with 98% confidence.'}
                  </p>
                </div>

                {/* Status Bar */}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[rgba(11,31,23,0.08)]">
                  <div className="flex items-center gap-1.5 text-[#2f7a50] font-semibold">
                    <span>●</span> <span>3 of 3 acceptance gates satisfied</span>
                  </div>
                  <span className="text-[#6b7f75] font-mono">Arbitrator: PASS (Zero Risk)</span>
                </div>
              </div>

              {/* Bottom Ledger Card */}
              <div className="p-4 rounded-2xl bg-white/80 border border-[rgba(11,31,23,0.06)] space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#0b1f17]">Cryptographic SQLite Audit Ledger</span>
                  <span className="text-[#6b7f75] font-mono text-[10px]">SHA-256 chained • tamper-evident • verifiable</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
                  <div className="p-2 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] text-center">
                    <div className="text-[#6b7f75]">#001</div>
                    <div className="text-[#0b1f17] truncate">genesis</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] text-center">
                    <div className="text-[#6b7f75]">#002</div>
                    <div className="text-[#0b1f17] truncate">telemetry</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-[rgba(11,31,23,0.08)] text-center">
                    <div className="text-[#6b7f75]">#003</div>
                    <div className="text-[#0b1f17] truncate">synthesis</div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#e9efe6] border border-[rgba(47,122,80,0.2)] text-[#2f7a50] text-center font-semibold">
                    <div>#004</div>
                    <div className="truncate">settlement</div>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMN 3: Developer (Marcus Chen) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0b1f17]">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-[rgba(11,31,23,0.08)] text-[11px]">
                  💻
                </div>
                <div>
                  <div>Lead Engineer (Marcus Chen)</div>
                  <div className="text-[11px] text-[#6b7f75] font-normal">implements requirements &amp; submits proof</div>
                </div>
              </div>

              {/* Card 1: Accepts with terms */}
              <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[rgba(11,31,23,0.06)] space-y-2 shadow-sm text-xs">
                <div className="text-[#6b7f75] text-[11px]">Contractual Agreement</div>
                <div className="font-semibold text-[#0b1f17]">
                  Accepts Acceptance Criteria &amp; SLA Gates
                </div>
                <p className="text-[11px] text-[#3d5248] leading-relaxed">
                  Explicit verification benchmarks locked into contract state before implementation begins.
                </p>
              </div>

              {/* Card 2: Delivers the work */}
              <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[rgba(11,31,23,0.06)] space-y-2 shadow-sm text-xs">
                <div className="text-[#6b7f75] text-[11px]">Delivery Telemetry Ingestion</div>
                <div className="font-semibold text-[#0b1f17]">
                  Submits Work via Pull Request #42
                </div>
                <div className="p-2.5 rounded-xl bg-[#f6f5f0] font-mono text-[11px] text-[#3d5248] flex items-center justify-between">
                  <span>milestoneproof/core #42</span>
                  <span className="text-[#2f7a50] font-semibold">14 files committed</span>
                </div>
              </div>

              {/* Card 3: Paid $2,500.00 USD */}
              <div className="p-5 rounded-2xl bg-[#b8e2c8] border border-[rgba(47,122,80,0.2)] space-y-1 shadow-sm text-xs">
                <div className="text-[#2f7a50] text-[11px] uppercase tracking-wider font-semibold font-mono">
                  Programmatic Disbursement
                </div>
                <div className="font-semibold text-[#0b1f17] text-sm font-mono">
                  Disbursed $2,500.00 USD
                </div>
                <p className="text-[11px] text-[#1c4b31] leading-relaxed">
                  Captured from pre-authorized escrow hold following authenticated human reviewer approval.
                </p>
              </div>

              {/* Card 4: Evidence Passport */}
              <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-sm border border-[rgba(11,31,23,0.06)] space-y-2 shadow-sm text-xs">
                <div className="text-[#6b7f75] text-[11px]">Attested Artifact</div>
                <div className="font-semibold text-[#0b1f17]">
                  Cryptographic Evidence Passport Issued
                </div>
                <p className="text-[11px] text-[#3d5248] leading-relaxed">
                  Permanent SLSA build attestation, git signatures, and SSRF-guarded smoke test digest accessible at <code className="text-[#0b1f17]">/trust</code>.
                </p>
              </div>
            </div>

          </div>

          {/* Bottom Interactive Flow Track */}
          <div className="pt-6 border-t border-[rgba(11,31,23,0.08)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white flex items-center gap-3 shadow-sm">
                <span className="w-8 h-8 rounded-full bg-[#f6f5f0] text-sm flex items-center justify-center">💳</span>
                <div>
                  <div className="text-xs font-semibold text-[#0b1f17]">Client Funding Account</div>
                  <div className="text-[11px] text-[#6b7f75]">pre-authorizes 29-day financial hold</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0b1f17] text-white flex items-center gap-3 shadow-sm">
                <span className="w-8 h-8 rounded-full bg-[#1a382c] text-sm flex items-center justify-center">🔒</span>
                <div>
                  <div className="text-xs font-semibold text-white">Settlement Policy Engine</div>
                  <div className="text-[11px] text-zinc-300">deterministic formula; zero custody of private funds</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white flex items-center gap-3 shadow-sm">
                <span className="w-8 h-8 rounded-full bg-[#f6f5f0] text-sm flex items-center justify-center">💼</span>
                <div>
                  <div className="text-xs font-semibold text-[#0b1f17]">Contractor Settlement Account</div>
                  <div className="text-[11px] text-[#6b7f75]">receives verified funds on human sign-off</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 text-xs text-[#6b7f75]">
              <div>End-to-End Fiduciary Architecture • Milestone 1: OAuth2 Authentication Microservice</div>
              <button
                onClick={() => navigate('/reviews')}
                className="px-4 py-1.5 rounded-full bg-white hover:bg-[#f6f5f0] border border-[rgba(11,31,23,0.12)] text-[#0b1f17] font-medium transition shadow-sm"
              >
                Launch Fiduciary Workbench →
              </button>
            </div>
          </div>

        </div>
      </section>


      {/* ─────────────────────────────────────────────────────────────
          SECTION 3: CORE PLATFORM ARCHITECTURE
      ───────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto pb-24">
        <h2 className="text-3xl sm:text-4xl font-normal text-[#0b1f17] tracking-tight mb-8">
          Core Platform Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Capability 1 */}
          <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_20px_-2px_rgba(11,31,23,0.04)] space-y-4 hover:shadow-md transition">
            <span className="px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] text-[10px] font-mono font-semibold">
              Active AI
            </span>
            <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
              Tri-Agent AI Advisory Synthesis
            </h3>
            <p className="text-xs text-[#3d5248] leading-relaxed">
              Gemini 3.5 Flash evaluates git trees, test suites, and security scans against contractual criteria, returning structured advisory rationales.
            </p>
          </div>

          {/* Capability 2 */}
          <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_20px_-2px_rgba(11,31,23,0.04)] space-y-4 hover:shadow-md transition">
            <span className="px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] text-[10px] font-mono font-semibold">
              Cryptographic
            </span>
            <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
              Immutable Evidence Passport
            </h3>
            <p className="text-xs text-[#3d5248] leading-relaxed">
              SLSA Level 2 build provenance records, git commit digests, and SSRF-hardened runtime smoke tests sealed into exportable audit bundles.
            </p>
          </div>

          {/* Capability 3 */}
          <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_20px_-2px_rgba(11,31,23,0.04)] space-y-4 hover:shadow-md transition">
            <span className="px-2.5 py-0.5 rounded-full bg-[#fbf7ed] text-[#8a681c] text-[10px] font-mono font-semibold">
              Deterministic
            </span>
            <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
              Settlement Policy Engine
            </h3>
            <p className="text-xs text-[#3d5248] leading-relaxed">
              Pure mathematical logic enforcing contract caps, computing SLA penalty deductions, and guaranteeing zero over-disbursement.
            </p>
          </div>

          {/* Capability 4 */}
          <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-[0_4px_20px_-2px_rgba(11,31,23,0.04)] space-y-4 hover:shadow-md transition">
            <span className="px-2.5 py-0.5 rounded-full bg-[#e9efe6] text-[#2f7a50] text-[10px] font-mono font-semibold">
              Smart Escrow
            </span>
            <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
              Pre-Authorized Settlement Holds
            </h3>
            <p className="text-xs text-[#3d5248] leading-relaxed">
              Non-custodial payment pre-authorization ensuring client funds are secured while guaranteeing developers automated release upon verified milestone completion.
            </p>
          </div>
        </div>
      </section>


      {/* ─────────────────────────────────────────────────────────────
          SECTION 4: ARCHITECTURAL INVARIANTS & FIDUCIARY GUARDRAILS
      ───────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto pb-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl font-normal text-[#0b1f17] tracking-tight">
              Architectural Invariants &amp; Fiduciary Guardrails
            </h2>
          </div>
          <div className="max-w-md text-xs text-[#3d5248] leading-relaxed">
            Four non-negotiable security principles enforced server-side before any financial state transition can occur.
            <div className="mt-1">
              <span onClick={() => navigate('/settings')} className="text-[#0b1f17] underline cursor-pointer font-medium">
                Inspect complete security &amp; audit policy →
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Safeguard 1: Quorum / Advisory */}
          <div className="p-6 rounded-3xl bg-gradient-to-b from-[#e9efe6] to-white border border-[rgba(11,31,23,0.08)] flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#6b7f75]">
                <span>INVARIANT 1 • AI SAFETY</span>
                <span>Rule 1</span>
              </div>
              <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
                Advisory Intelligence, Zero Autonomous Execution
              </h3>
              <p className="text-xs text-[#3d5248] leading-relaxed">
                No AI agent can capture, transfer, or void payments. Multi-agent evaluation produces structured recommendations only.
              </p>
            </div>

            {/* Inner Visual Widget */}
            <div className="p-4 rounded-2xl bg-white border border-[rgba(11,31,23,0.08)] space-y-2 text-[11px] font-mono">
              <div className="flex justify-between text-[#6b7f75]">
                <span>Verification Panel</span>
                <span className="text-[#2f7a50] font-semibold">PASS (98% Conf)</span>
              </div>
              <div className="space-y-1 text-[#3d5248]">
                <div className="flex justify-between"><span>Evidence Agent</span><span className="text-[#2f7a50]">PASS</span></div>
                <div className="flex justify-between"><span>Risk Agent</span><span className="text-[#2f7a50]">0 CVEs</span></div>
                <div className="flex justify-between"><span>Arbitrator</span><span className="text-[#2f7a50]">PASS</span></div>
              </div>
              <div className="pt-2 border-t border-[rgba(11,31,23,0.08)] flex justify-between text-[10px] text-[#6b7f75]">
                <span>3 of 3 Agents Agree</span>
                <span>Consensus Met</span>
              </div>
            </div>
          </div>

          {/* Safeguard 2: No Custody */}
          <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#6b7f75]">
                <span>INVARIANT 2 • FINANCIAL INTEGRITY</span>
                <span>Rule 2</span>
              </div>
              <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
                Non-Custodial Zero-Escrow Architecture
              </h3>
              <p className="text-xs text-[#3d5248] leading-relaxed">
                A 29-day authorization hold is placed via banking payment gateway. Veridex holds no funds, no private keys, and no custodial wallet.
              </p>
            </div>

            {/* Inner Visual Widget */}
            <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-2 text-[11px] font-mono">
              <div className="flex justify-between text-[#6b7f75]">
                <span>Pre-Authorized Escrow</span>
                <span className="text-[#8a681c] font-semibold">Active Hold</span>
              </div>
              <div className="text-base font-semibold text-[#0b1f17]">$2,500.00 USD</div>
              <div className="space-y-1 text-[10px] text-[#3d5248] pt-1 border-t border-[rgba(11,31,23,0.06)]">
                <div className="flex justify-between"><span>Client:</span><span className="text-[#2f7a50]">✓ Authorization Active</span></div>
                <div className="flex justify-between"><span>Veridex:</span><span className="text-[#6b7f75]">Zero Custody Engine</span></div>
              </div>
            </div>
          </div>

          {/* Safeguard 3: Public Record */}
          <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#6b7f75]">
                <span>INVARIANT 3 • CRYPTOGRAPHIC PROVENANCE</span>
                <span>Rule 3</span>
              </div>
              <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
                Cryptographic Hash-Chained Audit Trail
              </h3>
              <p className="text-xs text-[#3d5248] leading-relaxed">
                Decisions and evidence digests are permanently sealed in a SHA-256 hash-chained SQLite ledger, so any later change is detected.
              </p>
            </div>

            {/* Inner Visual Widget */}
            <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-2 text-[11px] font-mono">
              <div className="flex justify-between text-[#6b7f75]">
                <span>Ledger Event</span>
                <span className="px-2 py-0.2 rounded-full bg-[#e9efe6] text-[#2f7a50] text-[10px] font-semibold">✓ Block Sealed</span>
              </div>
              <div className="text-[#3d5248] space-y-0.5 text-[10px]">
                <div>Event: AI_SYNTHESIS</div>
                <div>Hash: 3937...3d73</div>
                <div>Integrity: INTACT (100%)</div>
              </div>
            </div>
          </div>

          {/* Safeguard 4: Deterministic Cap */}
          <div className="p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] flex flex-col justify-between space-y-6 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#6b7f75]">
                <span>INVARIANT 4 • MATHEMATICAL DISBURSEMENT</span>
                <span>Rule 4</span>
              </div>
              <h3 className="text-lg font-normal text-[#0b1f17] tracking-tight">
                Deterministic Settlement Ceiling
              </h3>
              <p className="text-xs text-[#3d5248] leading-relaxed">
                Server-side business logic strictly caps permitted disbursement. Capture amounts cannot exceed authorized hold or verified criteria.
              </p>
            </div>

            {/* Inner Visual Widget */}
            <div className="p-4 rounded-2xl bg-[#f6f5f0] border border-[rgba(11,31,23,0.06)] space-y-2 text-[11px] font-mono">
              <div className="flex justify-between text-[#6b7f75]">
                <span>Settlement Formula</span>
                <span className="text-[#2f7a50] font-semibold">$2,500.00</span>
              </div>
              <div className="text-[10px] text-[#3d5248] space-y-0.5">
                <div>Agreed: $2,500.00</div>
                <div>Late Penalty: -$0.00</div>
                <div className="text-[#2f7a50] font-semibold pt-1 border-t border-[rgba(11,31,23,0.06)]">
                  Permitted: $2,500.00
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ─────────────────────────────────────────────────────────────
          SECTION 5: INTEGRATED ENGINEERING TOOLCHAINS
      ───────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          
          {/* Left Text */}
          <div className="space-y-5">
            <h2 className="text-3xl sm:text-5xl font-normal text-[#0b1f17] tracking-tight leading-[1.15]">
              Engineered for Modern Engineering Toolchains
            </h2>
            <p className="text-xs sm:text-sm text-[#3d5248] leading-relaxed">
              Trigger milestone verifications from GitHub Actions webhooks, inspect cryptographic proof via the TrustChain CLI, or integrate typed clients generated from our OpenAPI 3.0 schema.
            </p>
            <div className="flex items-center gap-4 text-xs font-medium text-[#0b1f17]">
              <span onClick={() => navigate('/developers')} className="underline cursor-pointer">
                Explore OpenAPI 3.0 Specification
              </span>
              <span>•</span>
              <span onClick={() => navigate('/reviews')} className="underline cursor-pointer">
                Fiduciary Review Workbench
              </span>
            </div>
          </div>

          {/* Right Visual Stack */}
          <div className="space-y-4">
            {/* Terminal Card 1 */}
            <div className="p-4 sm:p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-sm space-y-3 overflow-hidden">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#6b7f75]">
                <span>CLI &amp; Webhook Pipeline</span>
                <span className="px-2 py-0.5 rounded-full bg-[#f6f5f0] text-[#0b1f17]">v1.0.0</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#f6f5f0] text-xs font-mono text-[#3d5248] flex items-center justify-between overflow-x-auto">
                <span className="truncate mr-2">Check PR #42 against AC-1 &amp; AC-2</span>
                <span className="w-6 h-6 rounded-full bg-[#0b1f17] text-white flex items-center justify-center text-[10px] shrink-0">
                  ↑
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#e9efe6] text-[11px] font-mono text-[#2f7a50] flex items-center justify-between overflow-x-auto">
                <span className="truncate mr-2">trustchain_verification: 3 criteria met • Arbitrator PASS</span>
                <span className="text-[10px] text-[#6b7f75] shrink-0">Verified</span>
              </div>
            </div>

            {/* Code Block Card 2 */}
            <div className="p-4 sm:p-6 rounded-3xl bg-white border border-[rgba(11,31,23,0.08)] shadow-sm space-y-2 font-mono text-xs text-[#3d5248] overflow-x-auto">
              <div className="text-[#6b7f75]"># ingest delivery telemetry via TrustChain CLI</div>
              <div className="text-[#0b1f17] whitespace-pre sm:whitespace-normal">
                $ npx @trustchain/cli verify-milestone \<br />
                &nbsp;&nbsp;--contract &quot;contract_seed_01&quot; \<br />
                &nbsp;&nbsp;--milestone &quot;ms_seed_01&quot; \<br />
                &nbsp;&nbsp;--repo &quot;https://github.com/milestoneproof/core&quot;
              </div>
              <div className="pt-2 text-[#6b7f75]"># or install typed TypeScript client SDK</div>
              <div className="text-[#0b1f17]">$ npm install @trustchain/sdk</div>
            </div>
          </div>

        </div>
      </section>


      {/* ─────────────────────────────────────────────────────────────
          SECTION 6: CALL TO ACTION
      ───────────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 max-w-6xl mx-auto pb-20">
        <div className="bg-gradient-to-br from-[#e9efe6] via-[#f0f4ee] to-[#edf6ea] rounded-[36px] p-6 sm:p-12 md:p-20 text-center border border-[rgba(11,31,23,0.08)] space-y-6 shadow-sm">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-normal text-[#0b1f17] tracking-tight max-w-2xl mx-auto leading-tight">
            Ready to Eliminate Software Payment Disputes?
          </h2>
          <p className="text-xs sm:text-sm text-[#3d5248] max-w-lg mx-auto leading-relaxed">
            Explore our live $8,500.00 reference contract, trigger multi-agent AI telemetry verification, examine the cryptographic Evidence Passport, and test sandbox milestone capture.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 w-full max-w-md mx-auto sm:max-w-none">
            <button
              onClick={() => navigate('/reviews')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-sm font-medium transition shadow-sm active:scale-[0.98]"
            >
              Inspect Live Evaluation
            </button>
            <button
              onClick={onStartTour}
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-white hover:bg-[#f6f5f0] text-[#0b1f17] text-sm font-medium border border-[rgba(11,31,23,0.1)] transition shadow-sm active:scale-[0.98]"
            >
              Start Guided Walkthrough
            </button>
          </div>
        </div>
      </section>


      {/* ─────────────────────────────────────────────────────────────
          SECTION 7: EDITORIAL FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[rgba(11,31,23,0.08)] py-14 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8 text-xs text-[#6b7f75]">
          
          {/* Col 1: Brand */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0b1f17] text-white flex items-center justify-center text-[10px] font-bold">
                ◈
              </span>
              <span className="text-[#0b1f17] font-semibold text-sm tracking-tight">Veridex</span>
            </div>
            <p className="text-xs text-[#3d5248] leading-relaxed max-w-xs">
              Autonomous multi-agent evidence-to-settlement orchestration for software engineering contracts.
            </p>
            <div className="text-[11px] font-mono pt-2 text-[#6b7f75]">
              Powered by Google Antigravity &amp; Gemini 3.5 Flash
            </div>
          </div>

          {/* Col 2: Product */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#0b1f17] font-semibold">
              Product
            </div>
            <div className="space-y-1.5">
              <div onClick={() => navigate('/reviews')} className="hover:text-[#0b1f17] cursor-pointer">Fiduciary Review Workbench</div>
              <div onClick={() => navigate('/trust')} className="hover:text-[#0b1f17] cursor-pointer">Cryptographic Evidence Passport</div>
              <div onClick={() => navigate('/timeline')} className="hover:text-[#0b1f17] cursor-pointer">Critical-Path Gantt Timeline</div>
              <div onClick={() => navigate('/intelligence')} className="hover:text-[#0b1f17] cursor-pointer">Decision Intelligence Ledger</div>
            </div>
          </div>

          {/* Col 3: Standards */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#0b1f17] font-semibold">
              Ecosystem
            </div>
            <div className="space-y-1.5">
              <div onClick={() => navigate('/developers')} className="hover:text-[#0b1f17] cursor-pointer">OpenAPI Contract Studio</div>
              <div onClick={() => navigate('/reviews')} className="hover:text-[#0b1f17] cursor-pointer">Smart Settlement Gateway</div>
              <div onClick={() => navigate('/settings')} className="hover:text-[#0b1f17] cursor-pointer">SQLite Audit Ledger</div>
              <div onClick={() => navigate('/developers')} className="hover:text-[#0b1f17] cursor-pointer">Developer Documentation</div>
            </div>
          </div>

          {/* Col 4: Governance */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#0b1f17] font-semibold">
              Governance
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div>Non-Custodial Architecture</div>
              <div>29-Day Authorization Hold Rule</div>
              <div>AI Separation of Concerns</div>
              <div>Deterministic Settlement Policy</div>
            </div>
          </div>

        </div>

        <div className="mt-12 pt-6 border-t border-[rgba(11,31,23,0.06)] flex flex-wrap items-center justify-between gap-4 text-[11px] text-[#6b7f75]">
          <div>© 2026 Veridex · MilestoneProof AI. All rights reserved.</div>
          <div className="font-mono">SQLite ACID Persistence • SLSA Level 2 Provenance • Multi-Agent Fiduciary Mesh</div>
        </div>
      </footer>

    </div>
  );
}
