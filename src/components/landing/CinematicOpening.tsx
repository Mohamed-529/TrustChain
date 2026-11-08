/**
 * CinematicOpening — Stage A: Premium, Immersive Dark Cinematic Opening
 *
 * Design Inspiration: Google Antigravity aesthetic:
 * - Ultra-dark obsidian foundation (#02040a)
 * - Subtle dynamic depth particles
 * - Luminous cyan/indigo energy arc
 * - Minimal centered TrustChain logo reveal with gentle light pulse
 * - Accessible controls: "Explore TrustChain", "Play Intro", "Skip Intro"
 */

import React, { useState, useEffect } from 'react';
import { LuminousWaveCanvas } from './LuminousWaveCanvas.tsx';

interface CinematicOpeningProps {
  onExplore: () => void;
  onPlayIntro: () => void;
  onSkipIntro: () => void;
  onSignIn: () => void;
  isPlayingIntro?: boolean;
}

export function CinematicOpening({
  onExplore,
  onPlayIntro,
  onSkipIntro,
  onSignIn,
  isPlayingIntro = false,
}: CinematicOpeningProps) {
  const [logoRevealed, setLogoRevealed] = useState(false);
  const [subtitleRevealed, setSubtitleRevealed] = useState(false);
  const [actionsRevealed, setActionsRevealed] = useState(false);

  useEffect(() => {
    // Choreographed entrance timing
    const t1 = setTimeout(() => setLogoRevealed(true), 300);
    const t2 = setTimeout(() => setSubtitleRevealed(true), 900);
    const t3 = setTimeout(() => setActionsRevealed(true), 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <section
      className="relative min-h-[90vh] flex flex-col items-center justify-center text-center overflow-hidden px-4 sm:px-6 select-none bg-[#02040a]"
      aria-label="TrustChain Cinematic Opening"
    >
      {/* Background Luminous Wave & Particle Canvas */}
      <LuminousWaveCanvas intensity={isPlayingIntro ? 1.3 : 1.0} />

      {/* Atmospheric Radial Depth Overlays */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Skip Intro Anchor (top-right) */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={onSkipIntro}
          className="px-3 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-400 hover:text-slate-200 transition backdrop-blur-md"
          title="Skip intro and view full platform"
        >
          Skip Intro ✕
        </button>
      </div>

      {/* Stage A Centered Content */}
      <div className="relative z-10 max-w-4xl mx-auto space-y-8 flex flex-col items-center">
        {/* Minimal Centered Logo Glyph Reveal */}
        <div
          className={`transition-all duration-1000 transform ${
            logoRevealed
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-90 translate-y-6'
          }`}
        >
          <div className="relative group cursor-pointer inline-block" onClick={onPlayIntro}>
            {/* Pulsating energy glow ring */}
            <div className="absolute -inset-2 bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400 rounded-3xl blur-lg opacity-40 group-hover:opacity-75 transition duration-700 animate-pulse" />

            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-b from-slate-900 to-black p-0.5 border border-slate-700/80 shadow-2xl flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-slate-950 flex flex-col items-center justify-center">
                {/* Custom Minimalist Shield / Chain SVG Glyph */}
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div
          className={`space-y-4 transition-all duration-1000 delay-200 transform ${
            subtitleRevealed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-sky-500/30 text-[11px] font-mono tracking-widest text-sky-300 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
            EVIDENCE-TO-SETTLEMENT ORCHESTRATION
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white tracking-tight leading-tight">
            Trust<span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-emerald-400 bg-clip-text text-transparent">Chain</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto font-light leading-relaxed">
            Where verified software delivery meets deterministic financial settlement.
          </p>
        </div>

        {/* Interactive Action Controls */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 pt-4 transition-all duration-1000 delay-500 transform ${
            actionsRevealed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-6'
          }`}
        >
          <button
            onClick={onExplore}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-sm font-bold text-white shadow-xl shadow-sky-500/20 transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Explore TrustChain ↓
          </button>

          <button
            onClick={onPlayIntro}
            className="px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-sm font-semibold text-sky-300 hover:text-white transition flex items-center gap-2 backdrop-blur-md"
          >
            <span>▶</span> Play Cinematic Intro
          </button>

          <button
            onClick={onSignIn}
            className="px-5 py-3 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-sm font-medium text-slate-300 hover:text-white transition backdrop-blur-md"
          >
            Sign In / Persona
          </button>
        </div>

        {/* Minimal Scroll Down Cue */}
        <div className="pt-10 opacity-70 hover:opacity-100 transition cursor-pointer" onClick={onExplore}>
          <div className="w-5 h-8 rounded-full border border-slate-700 flex items-start justify-center p-1 mx-auto">
            <div className="w-1 h-2 rounded-full bg-sky-400 animate-bounce" />
          </div>
          <span className="text-[10px] font-mono text-slate-500 tracking-wider mt-1 block">SCROLL TO DISCOVER</span>
        </div>
      </div>
    </section>
  );
}
