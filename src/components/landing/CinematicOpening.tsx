/**
 * CinematicOpening — Stage A: Premium Minimalist Digital Opening
 *
 * Design Focus:
 * - Minimal text: No clutter, just 1 punchy line
 * - Emerald & Champagne Gold luminous wave and depth particles
 * - Centered radiant shield monogram
 * - Clean action buttons with generous breathing room
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
    const t1 = setTimeout(() => setLogoRevealed(true), 250);
    const t2 = setTimeout(() => setSubtitleRevealed(true), 700);
    const t3 = setTimeout(() => setActionsRevealed(true), 1200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <section
      className="relative min-h-[85vh] flex flex-col items-center justify-center text-center overflow-hidden px-4 sm:px-6 select-none bg-[#09090b]"
      aria-label="TrustChain Opening"
    >
      {/* Background Luminous Emerald & Gold Wave Canvas */}
      <LuminousWaveCanvas intensity={isPlayingIntro ? 1.3 : 1.0} />

      {/* Atmospheric Radial Glow Overlays */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[110px] pointer-events-none" />

      {/* Skip Intro Control (top-right) */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={onSkipIntro}
          className="px-3 py-1.5 rounded-full bg-zinc-900/70 hover:bg-zinc-850 border border-zinc-800 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition backdrop-blur-md"
        >
          Skip Intro ✕
        </button>
      </div>

      {/* Centered Minimal Content */}
      <div className="relative z-10 max-w-3xl mx-auto space-y-6 flex flex-col items-center">
        {/* Minimal Centered Monogram */}
        <div
          className={`transition-all duration-1000 transform ${
            logoRevealed
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-90 translate-y-6'
          }`}
        >
          <div className="relative group cursor-pointer inline-block" onClick={onPlayIntro}>
            {/* Pulsating Emerald & Gold Aura */}
            <div className="absolute -inset-2 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-3xl blur-lg opacity-40 group-hover:opacity-75 transition duration-700 animate-pulse" />

            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-zinc-950 p-0.5 border border-zinc-800 shadow-2xl flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-[#0c0c0e] flex items-center justify-center">
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400"
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

        {/* Brand Name & Single 1-Line Subtitle */}
        <div
          className={`space-y-3 transition-all duration-1000 delay-150 transform ${
            subtitleRevealed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/90 border border-emerald-500/30 text-xs font-mono tracking-wider text-emerald-400 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            EVIDENCE-TO-SETTLEMENT
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight">
            Trust<span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">Chain</span>
          </h1>

          {/* EXACTLY 1 LINE PUNCHY SUBTITLE */}
          <p className="text-base sm:text-lg text-zinc-300 max-w-xl mx-auto font-normal">
            Where verified software delivery meets deterministic financial settlement.
          </p>
        </div>

        {/* Clean Action Controls */}
        <div
          className={`flex flex-wrap items-center justify-center gap-3 pt-3 transition-all duration-1000 delay-300 transform ${
            actionsRevealed
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-6'
          }`}
        >
          <button
            onClick={onExplore}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition transform hover:-translate-y-0.5"
          >
            Explore Platform ↓
          </button>

          <button
            onClick={onPlayIntro}
            className="px-5 py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-sm font-medium text-emerald-300 hover:text-white transition flex items-center gap-2 backdrop-blur-md"
          >
            <span>▶</span> Play Intro
          </button>

          <button
            onClick={onSignIn}
            className="px-5 py-3 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-400 hover:text-white transition backdrop-blur-md"
          >
            Sign In / Persona
          </button>
        </div>
      </div>
    </section>
  );
}
