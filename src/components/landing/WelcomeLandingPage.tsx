import React from 'react';
import { useNavigate } from '../../router/Router.tsx';
import { TrustLifecycle3D } from './TrustLifecycle3D.tsx';

interface WelcomeLandingPageProps {
  onStartTour: () => void;
}

export function WelcomeLandingPage({ onStartTour }: WelcomeLandingPageProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-12 py-6 font-sans">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border border-slate-800 p-8 lg:p-14 text-center space-y-6 shadow-2xl">
        {/* Glow ambient background circles */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -left-20 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/80 text-[11px] font-mono font-bold text-indigo-300">
          <span>⚡</span> MULTI-AGENT EVIDENCE-TO-SETTLEMENT ORCHESTRATION
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight">
          From software delivery to <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">trusted settlement</span>.
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Verify technical delivery against contractual criteria, evaluate security findings with multi-agent intelligence, and authorize PayPal disbursements through an immutable, audit-replayable decision ledger.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/intelligence')}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white shadow-xl shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
          >
            Launch Intelligence Control Room →
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-slate-200 transition"
          >
            Executive Dashboard
          </button>

          <button
            onClick={onStartTour}
            className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-700/60 text-sm font-semibold text-indigo-300 transition flex items-center gap-1.5"
          >
            <span>✨</span> Interactive Guided Tour
          </button>
        </div>

        {/* Sponsor Technology Matrix Strip */}
        <div className="pt-8 border-t border-slate-800/80 mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono text-slate-400">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-white font-bold">AG Grid Community v36</div>
            <div className="text-[10px] text-slate-500">Investigation Cockpit</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-white font-bold">Bryntum Gantt v7</div>
            <div className="text-[10px] text-slate-500">Delivery Control Tower</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-white font-bold">PayPal Orders API v2</div>
            <div className="text-[10px] text-slate-500">29-Day Hold & Capture</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="text-white font-bold">APIMatic OpenAPI 3.0</div>
            <div className="text-[10px] text-slate-500">Validated API Contract</div>
          </div>
        </div>
      </section>

      {/* Interactive 3D Trust Lifecycle Section */}
      <section className="space-y-4">
        <TrustLifecycle3D />
      </section>

      {/* Core Architectural Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-sky-950 border border-sky-800 flex items-center justify-center text-xl">
            🛡️
          </div>
          <h3 className="text-base font-bold text-white">Cryptographic Verifiability</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Every commit, PR, and CI log is cryptographically anchored. Untrusted external payloads cannot overwrite server telemetry or fabricate test results.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-xl">
            🤖
          </div>
          <h3 className="text-base font-bold text-white">Strict Advisory AI Boundary</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Three specialized agents synthesize evidence and risk, but AI is strictly non-authoritative. Only an authenticated human fiduciary can authorize fund release.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-xl">
            💳
          </div>
          <h3 className="text-base font-bold text-white">Deterministic PayPal Settlement</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Funds are temporarily held using PayPal Sandbox intent: AUTHORIZE (up to 29 days). Disbursements are mathematically calculated by contract policy.
          </p>
        </div>
      </section>
    </div>
  );
}
