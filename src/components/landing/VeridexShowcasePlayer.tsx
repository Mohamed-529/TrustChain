import React, { useEffect, useRef, useState } from 'react';

interface VeridexShowcasePlayerProps {
  onGetStarted: () => void;
}

const TOTAL_DURATION_SEC = 30;

const CHAPTERS = [
  { id: 0, start: 0, end: 6, tag: '01 · CLIENT', label: 'Contract & PayPal Hold' },
  { id: 1, start: 6, end: 12, tag: '02 · DEVELOPER', label: 'Real GitHub Code Push' },
  { id: 2, start: 12, end: 19, tag: '03 · TRI-AGENT AI', label: 'Source & Risk Audit' },
  { id: 3, start: 19, end: 25, tag: '04 · POLICY GATE', label: 'Client Human Approval' },
  { id: 4, start: 25, end: 30, tag: '05 · SETTLEMENT', label: 'PayPal Release & Proof' },
] as const;

function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.min(TOTAL_DURATION_SEC, Math.floor(seconds)));
  return `0:${clamped.toString().padStart(2, '0')}`;
}

export function VeridexShowcasePlayer({ onGetStarted }: VeridexShowcasePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasAutoPlayedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  // Auto-play ONCE when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAutoPlayedRef.current) {
            hasAutoPlayedRef.current = true;
            setElapsedSec(0);
            setHasEnded(false);
            setIsPlaying(true);
          }
        }
      },
      { threshold: 0.45 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 60fps playback timer that stops cleanly after 1 full 30-second run
  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const dtSec = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      setElapsedSec((prev) => {
        const next = prev + dtSec;
        if (next >= TOTAL_DURATION_SEC) {
          setIsPlaying(false);
          setHasEnded(true);
          return TOTAL_DURATION_SEC;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

  const handleTogglePlay = () => {
    if (hasEnded || elapsedSec >= TOTAL_DURATION_SEC) {
      setElapsedSec(0);
      setHasEnded(false);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleJumpToChapter = (startSec: number) => {
    setElapsedSec(startSec);
    setHasEnded(false);
    setIsPlaying(true);
  };

  const activeChapter =
    CHAPTERS.find((c) => elapsedSec >= c.start && elapsedSec < c.end) ??
    CHAPTERS[CHAPTERS.length - 1];

  const chapterProgress = Math.min(
    1,
    Math.max(0, (elapsedSec - activeChapter.start) / (activeChapter.end - activeChapter.start))
  );
  const overallPercent = Math.min(100, (elapsedSec / TOTAL_DURATION_SEC) * 100);

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto">
      {/* Cinema Frame */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0d1117] border border-[#30363d] shadow-[0_24px_70px_-15px_rgba(13,17,23,0.45)]">
        {/* Top Studio Window Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-[#161b22] border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
            <span className="ml-3 text-[11px] font-mono text-[#8b949e] hidden sm:inline">
              veridex.app / live-escrow-pipeline
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#238636]/20 border border-[#3fb950]/40 text-[#3fb950] text-[10px] font-mono font-semibold">
              <span
                className={`w-1.5 h-1.5 rounded-full bg-[#3fb950] ${
                  isPlaying ? 'animate-ping' : ''
                }`}
              />
              {isPlaying ? 'PLAYING' : hasEnded ? 'FINISHED' : 'PAUSED'}
            </span>
            <span className="text-[11px] font-mono text-[#c9d1d9]">
              {formatTime(elapsedSec)} / 0:30
            </span>
          </div>
        </div>

        {/* 16:9 Stage Viewport */}
        <div className="relative min-h-[380px] sm:min-h-[440px] p-6 sm:p-10 flex flex-col justify-between overflow-hidden">
          {/* Ambient dynamic glow based on current chapter */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-all duration-700"
            style={{
              background:
                activeChapter.id === 0
                  ? 'radial-gradient(circle at 20% 30%, rgba(56,139,253,0.18), transparent 55%)'
                  : activeChapter.id === 1
                  ? 'radial-gradient(circle at 80% 30%, rgba(163,113,247,0.20), transparent 55%)'
                  : activeChapter.id === 2
                  ? 'radial-gradient(circle at 50% 45%, rgba(46,160,67,0.22), transparent 60%)'
                  : activeChapter.id === 3
                  ? 'radial-gradient(circle at 30% 60%, rgba(210,153,34,0.18), transparent 55%)'
                  : 'radial-gradient(circle at 50% 50%, rgba(63,185,80,0.26), transparent 60%)',
            }}
          />

          {/* Chapter Header Pill */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono font-semibold text-white tracking-wider">
              {activeChapter.tag} &mdash; {activeChapter.label.toUpperCase()}
            </span>
            <span className="text-xs font-mono text-[#8b949e] hidden sm:inline">
              Client &harr; Developer &harr; PayPal
            </span>
          </div>

          {/* SCENE 1 (0:00 - 0:06): CLIENT CREATES CONTRACT & PAYPAL HOLD */}
          {activeChapter.id === 0 && (
            <div className="relative z-10 my-auto py-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-[#58a6ff]">
                  Step 1 &bull; Client Fiduciary
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Define real milestones.<br />Lock funds safely.
                </h3>
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  Elena creates the <strong className="text-white">Flight Booking System</strong> contract, assigns Marcus Chen, and secures a non-custodial 29-day PayPal hold.
                </p>
              </div>
              <div className="rounded-xl bg-[#161b22] border border-[#30363d] p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-[#1f6feb] text-white text-xs font-bold flex items-center justify-center">
                      EV
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">Elena Vance (Client)</div>
                      <div className="text-[11px] text-[#8b949e]">Contract #ct_flight_01</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#1f6feb]/20 text-[#58a6ff] text-[10px] font-mono font-bold">
                    ACTIVE
                  </span>
                </div>
                <div className="p-3.5 rounded-lg bg-[#0d1117] border border-[#30363d] space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8b949e]">Project</span>
                    <span className="text-white font-semibold">Flight Booking System</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8b949e]">Assigned Developer</span>
                    <span className="text-[#3fb950] font-medium">Marcus Chen</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8b949e]">Milestone 1 Budget</span>
                    <span className="text-white font-mono font-bold">$2,500.00</span>
                  </div>
                </div>
                <div
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-all duration-500 ${
                    chapterProgress > 0.45
                      ? 'bg-[#238636]/20 border-[#3fb950]/60 text-[#3fb950]'
                      : 'bg-[#21262d] border-[#30363d] text-[#8b949e]'
                  }`}
                >
                  <span className="text-xs font-medium">
                    {chapterProgress > 0.45
                      ? '✓ PayPal 29-Day Hold Authorized'
                      : 'Authorizing PayPal Hold...'}
                  </span>
                  <span className="text-[10px] font-mono">ORDERS V2</span>
                </div>
              </div>
            </div>
          )}

          {/* SCENE 2 (0:06 - 0:12): DEVELOPER SHIPS REAL CODE */}
          {activeChapter.id === 1 && (
            <div className="relative z-10 my-auto py-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-[#bc8cff]">
                  Step 2 &bull; Developer Workspace
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Ship real code.<br />Submit GitHub proof.
                </h3>
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  Marcus builds the feature, pushes commit <code className="text-[#d2a8ff]">55615cf</code>, and submits his real GitHub repository directly for automated inspection.
                </p>
              </div>
              <div className="rounded-xl bg-[#161b22] border border-[#30363d] p-5 space-y-3.5 shadow-xl font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#d2a8ff] font-semibold">Morfikos-flight-booking</span>
                  <span className="px-2 py-0.5 rounded bg-[#8957e5]/25 text-[#d2a8ff] text-[10px]">
                    commit 55615cf
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d] text-[11px] space-y-1.5 leading-relaxed">
                  <div className="text-[#8b949e]">$ git push origin main</div>
                  <div className="text-[#3fb950]">+ App.tsx (flight search, seat map, booking)</div>
                  <div className="text-[#3fb950]">+ package.json (Expo SDK verified)</div>
                  <div
                    className={`transition-opacity duration-500 ${
                      chapterProgress > 0.4 ? 'opacity-100 text-[#58a6ff]' : 'opacity-30 text-[#8b949e]'
                    }`}
                  >
                    ✓ CI Pipeline: 64 / 64 tests passed (0 failed)
                  </div>
                </div>
                <div
                  className={`px-3.5 py-2 rounded-lg text-xs font-sans font-semibold text-center transition-all duration-500 ${
                    chapterProgress > 0.55
                      ? 'bg-[#8957e5] text-white shadow-lg shadow-[#8957e5]/30'
                      : 'bg-[#21262d] text-[#8b949e]'
                  }`}
                >
                  {chapterProgress > 0.55
                    ? '✓ Real GitHub Bundle Submitted to Tri-Agent AI'
                    : 'Packaging Commit & Telemetry...'}
                </div>
              </div>
            </div>
          )}

          {/* SCENE 3 (0:12 - 0:19): TRI-AGENT AI INSPECTS REAL CODE */}
          {activeChapter.id === 2 && (
            <div className="relative z-10 my-auto py-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <div className="text-xs font-mono uppercase tracking-widest text-[#3fb950]">
                    Step 3 &bull; Multi-Agent AI Verification
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                    Three independent AI agents inspect every line.
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#3fb950]">
                  3/3 Acceptance Criteria Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {[
                  {
                    name: 'Evidence Agent',
                    icon: '🔍',
                    threshold: 0.15,
                    detail: 'Verified App.tsx, commit SHA 55615cf & 64/64 passing tests.',
                    badge: 'VERIFIED',
                  },
                  {
                    name: 'Risk Agent',
                    icon: '🛡️',
                    threshold: 0.42,
                    detail: '0 Critical CVEs, zero leaked secrets, clean dependency tree.',
                    badge: 'LOW RISK',
                  },
                  {
                    name: 'Arbitrator Agent',
                    icon: '⚖️',
                    threshold: 0.68,
                    detail: 'AC-1 ✓ Search · AC-2 ✓ Seat Map · AC-3 ✓ Checkout Ready.',
                    badge: 'APPROVE',
                  },
                ].map((agent) => {
                  const done = chapterProgress >= agent.threshold;
                  return (
                    <div
                      key={agent.name}
                      className={`p-4 rounded-xl border transition-all duration-500 ${
                        done
                          ? 'bg-[#161b22] border-[#3fb950]/60 shadow-[0_0_25px_rgba(63,185,80,0.15)]'
                          : 'bg-[#161b22]/50 border-[#30363d] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">{agent.icon}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            done
                              ? 'bg-[#238636]/25 text-[#3fb950]'
                              : 'bg-[#21262d] text-[#8b949e]'
                          }`}
                        >
                          {done ? `✓ ${agent.badge}` : 'SCANNING...'}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white">{agent.name}</div>
                      <p className="text-[11px] text-[#8b949e] mt-1 leading-relaxed">
                        {agent.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SCENE 4 (0:19 - 0:25): DETERMINISTIC POLICY & HUMAN FIDUCIARY APPROVAL */}
          {activeChapter.id === 3 && (
            <div className="relative z-10 my-auto py-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-widest text-[#d29922]">
                  Step 4 &bull; Human Fiduciary Gate
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  AI recommends.<br />Only the Client approves.
                </h3>
                <p className="text-sm text-[#8b949e] leading-relaxed">
                  Our deterministic policy engine computes exact cent-safe payouts. No AI agent can ever move funds without explicit human sign-off.
                </p>
              </div>
              <div className="rounded-xl bg-[#161b22] border border-[#30363d] p-5 space-y-3 shadow-xl">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#8b949e]">
                  Deterministic Settlement Receipt
                </div>
                <div className="space-y-2 text-xs border-y border-[#30363d] py-3 font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">Agreed Milestone Budget</span>
                    <span className="text-white">$2,500.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8b949e]">Late / Risk Penalty</span>
                    <span className="text-[#3fb950]">-$0.00</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-[#30363d]/60 font-bold text-sm">
                    <span className="text-white">Permitted Release Cap</span>
                    <span className="text-[#3fb950]">$2,500.00</span>
                  </div>
                </div>
                <div
                  className={`w-full py-2.5 rounded-lg text-xs font-semibold text-center transition-all duration-500 ${
                    chapterProgress > 0.5
                      ? 'bg-[#238636] text-white shadow-lg shadow-[#238636]/40 scale-[1.02]'
                      : 'bg-[#21262d] text-[#c9d1d9]'
                  }`}
                >
                  {chapterProgress > 0.5
                    ? '✓ Approved by Elena Vance (Client Fiduciary)'
                    : 'Click to Approve Payout...'}
                </div>
              </div>
            </div>
          )}

          {/* SCENE 5 (0:25 - 0:30): PAYPAL RELEASE & SHA-256 PASSPORT */}
          {activeChapter.id === 4 && (
            <div className="relative z-10 my-auto py-6 text-center max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#238636]/20 border border-[#3fb950]/60 text-[#3fb950] flex items-center justify-center text-3xl mx-auto shadow-[0_0_40px_rgba(63,185,80,0.35)]">
                ✓
              </div>
              <div className="text-xs font-mono uppercase tracking-widest text-[#3fb950]">
                Step 5 &bull; Instant PayPal Capture
              </div>
              <h3 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                $2,500.00 Released to Marcus Chen
              </h3>
              <p className="text-sm text-[#8b949e]">
                Settled via PayPal Orders v2 &bull; Cryptographic SHA-256 Evidence Passport permanently recorded.
              </p>
              <div className="inline-flex flex-wrap items-center justify-center gap-2 pt-1 font-mono text-[11px]">
                <span className="px-3 py-1 rounded-full bg-[#161b22] border border-[#3fb950]/40 text-[#3fb950]">
                  PAYPAL CAPTURED
                </span>
                <span className="px-3 py-1 rounded-full bg-[#161b22] border border-[#30363d] text-[#c9d1d9]">
                  SHA-256: 9f4c...a81e
                </span>
              </div>
            </div>
          )}

          {/* Ended Overlay (after 1 full 30-sec play) */}
          {hasEnded && (
            <div className="absolute inset-0 z-20 bg-[#0d1117]/82 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-5 animate-fadeIn">
              <div className="space-y-1.5">
                <div className="text-xs font-mono uppercase tracking-widest text-[#3fb950]">
                  30-Second Walkthrough Complete
                </div>
                <h4 className="text-2xl sm:text-3xl font-bold text-white">
                  Ready to verify real software delivery?
                </h4>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
                >
                  <span>▶</span>
                  <span>Replay 30s Video</span>
                </button>
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="px-6 py-2.5 rounded-lg bg-[#1f883d] hover:bg-[#1a7f37] text-white text-sm font-semibold shadow-lg transition cursor-pointer"
                >
                  Create Free Account &rsaquo;
                </button>
              </div>
            </div>
          )}

          {/* Bottom Interactive Timeline Controls */}
          <div className="relative z-10 space-y-3 pt-4">
            {/* Progress Track */}
            <div className="w-full h-1.5 rounded-full bg-[#21262d] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#58a6ff] via-[#bc8cff] to-[#3fb950] transition-[width] duration-100"
                style={{ width: `${overallPercent}%` }}
              />
            </div>

            {/* Play/Pause + Chapter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="px-3.5 py-1.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>{isPlaying ? '⏸' : '▶'}</span>
                <span>{isPlaying ? 'Pause' : hasEnded ? 'Replay' : 'Play'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                {CHAPTERS.map((ch) => {
                  const isCurrent = activeChapter.id === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleJumpToChapter(ch.start)}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono transition cursor-pointer ${
                        isCurrent
                          ? 'bg-[#3fb950]/20 text-[#3fb950] border border-[#3fb950]/50 font-semibold'
                          : 'bg-[#161b22] text-[#8b949e] border border-[#30363d] hover:text-white'
                      }`}
                    >
                      {ch.tag.split(' · ')[0]} {ch.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
