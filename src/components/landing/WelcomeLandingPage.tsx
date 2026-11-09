/**
 * WelcomeLandingPage — Modern Minimalist Digital Trust Entry
 *
 * Design Focus:
 * - Minimal text: No bloated paragraphs, punchy 1-line descriptions
 * - Pleasant Emerald, Champagne Gold, and Charcoal palette (NO generic blue)
 * - Spacious layout with generous breathing room
 * - Replay intro and guided tour controls
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from '../../router/Router.tsx';
import { CinematicOpening } from './CinematicOpening.tsx';
import { LifecycleRevealSection } from './LifecycleRevealSection.tsx';
import { PlatformCapabilitiesShowcase } from './PlatformCapabilitiesShowcase.tsx';
import { TrustLifecycle3D } from './TrustLifecycle3D.tsx';

export const STORAGE_KEY_CINEMATIC_VISITED = 'tc_cinematic_visited_v1';

interface WelcomeLandingPageProps {
  onStartTour: () => void;
  onOpenSignIn?: () => void;
}

export function WelcomeLandingPage({ onStartTour, onOpenSignIn }: WelcomeLandingPageProps) {
  const navigate = useNavigate();
  const [isPlayingIntro, setIsPlayingIntro] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasVisited = localStorage.getItem(STORAGE_KEY_CINEMATIC_VISITED);
      if (!hasVisited) {
        localStorage.setItem(STORAGE_KEY_CINEMATIC_VISITED, 'true');
        setIsPlayingIntro(true);
      }
    }
  }, []);

  const handleExplore = () => {
    setIsPlayingIntro(false);
    const target = document.getElementById('product-reveal-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePlayIntro = () => {
    setIsPlayingIntro(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSkipIntro = () => {
    setIsPlayingIntro(false);
    const target = document.getElementById('product-reveal-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSignIn = () => {
    if (onOpenSignIn) {
      onOpenSignIn();
    } else {
      navigate('/settings');
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* STAGE A: Minimalist Opening */}
      <CinematicOpening
        onExplore={handleExplore}
        onPlayIntro={handlePlayIntro}
        onSkipIntro={handleSkipIntro}
        onSignIn={handleSignIn}
        isPlayingIntro={isPlayingIntro}
      />

      {/* Floating Replay Button */}
      <div className="sticky top-20 z-30 flex justify-end px-6 pointer-events-none">
        <button
          onClick={handlePlayIntro}
          className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 transition shadow-lg backdrop-blur-md flex items-center gap-1.5"
          title="Replay intro animation"
        >
          <span>✨</span>
          <span>Replay Intro</span>
        </button>
      </div>

      {/* STAGE B: 6-Stage Lifecycle Flow */}
      <div className="border-t border-zinc-800/80 bg-zinc-950">
        <LifecycleRevealSection
          onExplore={() => {
            const el = document.getElementById('platform-capabilities-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          onSignIn={handleSignIn}
        />
      </div>

      {/* Interactive 3D Trust Graph */}
      <div className="py-12 border-t border-zinc-800/80 bg-[#09090b] px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-4">
        <div className="text-center space-y-1 max-w-xl mx-auto">
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            Orbital Trust Graph & Invariant Mesh
          </h3>
          <p className="text-xs text-zinc-400">
            Click any orbital node to inspect schemas, cryptographic gates, and fiduciary boundaries.
          </p>
        </div>

        <TrustLifecycle3D />
      </div>

      {/* STAGE C: Platform Modules Showcase */}
      <div className="border-t border-zinc-800/80 bg-zinc-950">
        <PlatformCapabilitiesShowcase />
      </div>

      {/* Refined Minimal Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#09090b] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-400 to-amber-400 p-0.5">
              <div className="w-full h-full bg-[#09090b] rounded-[6px] flex items-center justify-center font-bold text-emerald-400 text-[10px]">
                TC
              </div>
            </div>
            <div>
              <span className="text-zinc-300 font-bold">TrustChain</span> — Multi-Agent Evidence-to-Settlement Orchestration
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
            <span>AG Grid Community v36</span>
            <span>•</span>
            <span>Bryntum Gantt v7.3</span>
            <span>•</span>
            <span>PayPal Orders API v2</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onStartTour}
              className="text-amber-400 hover:text-amber-300 transition"
            >
              Product Tour 🧭
            </button>
            <span>•</span>
            <button
              onClick={() => navigate('/settings')}
              className="hover:text-zinc-300 transition"
            >
              Audit Trail 🛡️
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
