/**
 * WelcomeLandingPage — Cinematic Entry Experience for TrustChain
 *
 * Implements:
 * - Stage A: Cinematic Opening (Dark background, luminous wave canvas, minimal logo reveal, intro playback)
 * - Stage B: Product Reveal (Lifecycle animation, headline, CTAs, interactive stage inspector)
 * - Stage C: Platform Capabilities Showcase (7 modules, sponsor integrations, direct route jumping)
 * - Interactive 3D Trust Lifecycle (60fps Canvas orbital telemetry)
 * - First-time vs returning user intelligence with skip/replay controls.
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
  const [showFullExplore, setShowFullExplore] = useState<boolean>(true);

  // Check if returning user
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasVisited = localStorage.getItem(STORAGE_KEY_CINEMATIC_VISITED);
      if (!hasVisited) {
        localStorage.setItem(STORAGE_KEY_CINEMATIC_VISITED, 'true');
        // First visit: highlight intro
        setIsPlayingIntro(true);
      }
    }
  }, []);

  const handleExplore = () => {
    setShowFullExplore(true);
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
    setShowFullExplore(true);
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
    <div className="min-h-screen bg-[#02040a] text-slate-100 font-sans selection:bg-sky-500 selection:text-white">
      {/* STAGE A: Cinematic Opening Sequence */}
      <CinematicOpening
        onExplore={handleExplore}
        onPlayIntro={handlePlayIntro}
        onSkipIntro={handleSkipIntro}
        onSignIn={handleSignIn}
        isPlayingIntro={isPlayingIntro}
      />

      {/* Replay Intro Floating Controller (always accessible) */}
      <div className="sticky top-20 z-30 flex justify-end px-6 pointer-events-none">
        <button
          onClick={handlePlayIntro}
          className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-mono text-sky-300 hover:text-white transition shadow-lg backdrop-blur-md flex items-center gap-1.5"
          title="Replay cinematic opening animation"
        >
          <span>✨</span>
          <span>Replay Cinematic Intro</span>
        </button>
      </div>

      {/* STAGE B: Product Reveal & Core 6-Stage Lifecycle Flow */}
      <div className="border-t border-slate-800/80 bg-gradient-to-b from-[#02040a] via-slate-950 to-slate-950">
        <LifecycleRevealSection
          onExplore={() => {
            const el = document.getElementById('platform-capabilities-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          onSignIn={handleSignIn}
        />
      </div>

      {/* Interactive 3D Trust Lifecycle Orbital Visualizer */}
      <div className="py-12 border-t border-slate-800/80 bg-slate-950 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono font-medium text-slate-400">
            <span>INTERACTIVE 3D TELEMETRY</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-bold text-white">
            Orbital Trust Graph & Invariant Mesh
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">
            Click any orbital node in the 3D visualizer to inspect runtime schemas, cryptographic gates, and fiduciary boundaries.
          </p>
        </div>

        <TrustLifecycle3D />
      </div>

      {/* STAGE C: Platform Capabilities Showcase (7 Modules) */}
      <div className="border-t border-slate-800/80 bg-[#02040a]">
        <PlatformCapabilitiesShowcase />
      </div>

      {/* Sponsor Technology & Regulatory Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 p-0.5">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center font-bold text-white text-[10px]">
                TC
              </div>
            </div>
            <div>
              <span className="text-slate-300 font-bold">TrustChain</span> — Multi-Agent Evidence-to-Settlement Orchestration
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span className="text-slate-400">AG Grid Community v36</span>
            <span>•</span>
            <span className="text-slate-400">Bryntum Gantt v7.3</span>
            <span>•</span>
            <span className="text-slate-400">PayPal Orders API v2</span>
            <span>•</span>
            <span className="text-slate-400">APIMatic OpenAPI</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onStartTour}
              className="text-sky-400 hover:text-sky-300 transition"
            >
              Start Guided Tour 🧭
            </button>
            <span>•</span>
            <button
              onClick={() => navigate('/settings')}
              className="hover:text-slate-300 transition"
            >
              Audit Trail 🛡️
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
