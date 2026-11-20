import React, { useRef, useState } from 'react';
import { VeridexShowcasePlayer } from './VeridexShowcasePlayer.tsx';
import { SiteFooter } from '../layout/SiteFooter.tsx';

interface PublicLandingPageProps {
  onOpenAuth: (mode: 'SIGN_IN' | 'CREATE_ACCOUNT', prefillEmail?: string) => void;
}

export function PublicLandingPage({ onOpenAuth }: PublicLandingPageProps) {
  const [heroEmail, setHeroEmail] = useState('');
  const videoSectionRef = useRef<HTMLElement | null>(null);

  const handleHeroSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenAuth('CREATE_ACCOUNT', heroEmail.trim());
  };

  const scrollToVideo = () => {
    videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-white text-[#1f2328] flex flex-col selection:bg-[#1f883d] selection:text-white">
      {/* TOP MINIMAL NAVBAR (Matching GitHub 2026 clean header) */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#eaeef2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left Brand + Minimal Nav Links */}
          <div className="flex items-center gap-7">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-[#0d1117] text-white flex items-center justify-center font-black text-sm shadow-sm group-hover:scale-105 transition">
                ◈
              </div>
              <span className="text-base font-bold tracking-tight text-[#1f2328]">Veridex</span>
            </button>

            <nav className="hidden md:flex items-center gap-6 text-sm text-[#1f2328]/85 font-medium">
              <button
                type="button"
                onClick={scrollToVideo}
                className="hover:text-[#1f883d] transition cursor-pointer"
              >
                How it works
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('CREATE_ACCOUNT')}
                className="hover:text-[#1f883d] transition cursor-pointer"
              >
                Clients
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('CREATE_ACCOUNT')}
                className="hover:text-[#1f883d] transition cursor-pointer"
              >
                Developers
              </button>
              <button
                type="button"
                onClick={scrollToVideo}
                className="hover:text-[#1f883d] transition cursor-pointer"
              >
                Security
              </button>
            </nav>
          </div>

          {/* Right Auth Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenAuth('SIGN_IN')}
              className="px-3.5 py-2 text-sm font-medium text-[#1f2328] hover:text-[#1f883d] transition cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('CREATE_ACCOUNT')}
              className="px-4 py-2 rounded-md bg-[#0d1117] hover:bg-[#1f2328] text-white text-sm font-semibold shadow-sm transition cursor-pointer"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* SECTION 1: ABOVE-THE-FOLD HERO (Exact Clean Photo Layout — Zero Text Wall) */}
      <section className="relative w-full bg-white">
        <div className="max-w-5xl mx-auto border-x border-[#eaeef2] min-h-[calc(100vh-4rem)] flex flex-col justify-between items-center px-6 pt-16 sm:pt-24 pb-0 text-center">
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center space-y-8">
            {/* Announcement Pill */}
            <button
              type="button"
              onClick={scrollToVideo}
              className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-[#d0d7de] shadow-xs hover:border-[#8c959f] transition text-xs sm:text-sm font-medium text-[#1f2328] cursor-pointer"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-tr from-[#3b82f6] via-[#8b5cf6] to-[#10b981] text-white text-[10px] font-bold">
                ◈
              </span>
              <span>Veridex Escrow &amp; Tri-Agent AI &apos;26</span>
              <span className="text-[#59636e] text-xs">&rsaquo;</span>
            </button>

            {/* Giant Crisp Two-Line Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-bold tracking-[-0.03em] text-[#0d1117] leading-[1.06]">
              Trusted delivery starts
              <br />
              with Veridex
            </h1>

            {/* Inline Email + Green Sign Up Bar + Secondary Demo Button */}
            <div className="w-full max-w-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
              <form
                onSubmit={handleHeroSignUp}
                className="flex-1 flex items-center bg-[#f6f8fa] border border-[#d0d7de] rounded-lg p-1.5 focus-within:border-[#0969da] focus-within:ring-2 focus-within:ring-[#0969da]/15 transition"
              >
                <input
                  type="email"
                  value={heroEmail}
                  onChange={(e) => setHeroEmail(e.target.value)}
                  placeholder="Enter your email"
                  aria-label="Enter your email"
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-[#1f2328] placeholder:text-[#6e7781] focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  className="shrink-0 px-4 sm:px-5 py-2.5 rounded-md bg-[#1f883d] hover:bg-[#1a7f37] text-white text-sm font-semibold shadow-xs transition cursor-pointer"
                >
                  Sign up for Veridex
                </button>
              </form>

              <button
                type="button"
                onClick={scrollToVideo}
                className="px-5 py-3.5 rounded-lg bg-[#f6f8fa] hover:bg-[#eaeef2] border border-[#d0d7de] text-sm font-semibold text-[#1f2328] transition whitespace-nowrap cursor-pointer"
              >
                Watch 30s demo &darr;
              </button>
            </div>
          </div>

          {/* Cute Peeking Veridex Sentinel Emblem above Multi-Color Horizon Bar */}
          <div className="pt-14 sm:pt-20 flex flex-col items-center">
            <button
              type="button"
              onClick={scrollToVideo}
              title="Scroll down for 30s product video"
              className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
            >
              <div className="w-24 h-16 rounded-t-3xl bg-gradient-to-b from-[#0d1117] to-[#1f2937] border-x border-t border-[#30363d] shadow-lg flex flex-col items-center justify-center gap-1.5 translate-y-1 group-hover:translate-y-0 transition-transform">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950] shadow-[0_0_8px_#3fb950]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3fb950] shadow-[0_0_8px_#3fb950]" />
                </div>
                <span className="text-[9px] font-mono text-[#8b949e] tracking-widest">
                  SCROLL &darr;
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Signature Multi-Color Architectural Horizon Bar (matching photo) */}
        <div className="w-full h-1.5 grid grid-cols-5">
          <div className="bg-[#0969da]" />
          <div className="bg-[#1f883d]" />
          <div className="bg-[#8250df]" />
          <div className="bg-[#bf3989]" />
          <div className="bg-[#2da44e]" />
        </div>
      </section>

      {/* SECTION 2: AFTER 1 SCROLL — 30-SECOND AUTO-PLAYING PRODUCT SHOWCASE */}
      <section
        ref={videoSectionRef}
        className="w-full bg-[#f6f8fa] py-16 sm:py-24 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-[#1f883d]">
                30-Second Interactive Walkthrough
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0d1117] mt-1">
                From Client Contract to Developer Payout
              </h2>
            </div>
            <p className="text-xs text-[#59636e] font-mono">
              Auto-plays once &bull; Click Play anytime to replay
            </p>
          </div>

          <VeridexShowcasePlayer onGetStarted={() => onOpenAuth('CREATE_ACCOUNT')} />
        </div>
      </section>

      {/* SECTION 3: GLOBAL UNIFIED SITE FOOTER */}
      <SiteFooter onNavigateAuth={(mode) => onOpenAuth(mode)} variant="light" />
    </div>
  );
}
