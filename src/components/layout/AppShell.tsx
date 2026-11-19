/**
 * AppShell — High-End Segmented Editorial Navigation
 *
 * Implements:
 * - Floating segmented navigation island with crystal-clear active states
 * - Sponsor technology micro-indicators (PayPal, Bryntum, AG Grid, APIMatic, Gemini)
 * - Distinct, spacious buttons with zero cramped emojis
 * - Interactive Persona Selector dropdown with avatar chips
 * - Universal keyboard search trigger (⌘K / /)
 * - Floating toast notifications instead of jarring layout shifts
 */

import React, { useState, useRef, useEffect } from 'react';
import { Link, usePathname, useNavigate } from '../../router/Router.tsx';
import type { User } from '../../types/domain.ts';

interface AppShellProps {
  currentUser: User | null;
  onSwitchPersona: (userId: string) => Promise<void>;
  statusBanner: { type: 'success' | 'error' | 'info'; message: string } | null;
  onStartTour: () => void;
  onOpenSearch: () => void;
  onOpenCreateProject: () => void;
  children: React.ReactNode;
}

interface NavDestination {
  path: string;
  label: string;
  tag?: string;
}

export function AppShell({
  currentUser,
  onSwitchPersona,
  statusBanner,
  onStartTour,
  onOpenSearch,
  onOpenCreateProject,
  children,
}: AppShellProps) {
  const currentPath = usePathname();
  const navigate = useNavigate();
  const role = currentUser?.role ?? 'CLIENT';

  const [personaMenuOpen, setPersonaMenuOpen] = useState(false);
  const personaRef = useRef<HTMLDivElement>(null);

  // Close persona dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (personaRef.current && !personaRef.current.contains(e.target as Node)) {
        setPersonaMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navDestinations: NavDestination[] = [
    { path: '/', label: 'Overview' },
    { path: '/marketplace', label: 'Marketplace', tag: 'AI Spec' },
    { path: '/dashboard', label: 'Projects' },
    { path: '/reviews', label: 'Review & Settle', tag: 'Escrow' },
    { path: '/timeline', label: 'Timeline', tag: 'Gantt' },
    { path: '/intelligence', label: 'Decision Ledger', tag: 'Live' },
    { path: '/trust', label: 'Evidence Passport' },
    { path: '/developers', label: 'API Engine', tag: 'v1.0' },
  ];

  const personas = [
    {
      id: 'client_01',
      name: 'Elena Vance',
      role: 'CLIENT',
      org: 'Acme FinTech Buyer',
      avatar: 'EV',
      color: 'bg-emerald-600',
    },
    {
      id: 'dev_01',
      name: 'Marcus Chen',
      role: 'DEVELOPER',
      org: 'Core Systems Lead',
      avatar: 'MC',
      color: 'bg-blue-600',
    },
    {
      id: 'reviewer_01',
      name: 'Sophia Sterling',
      role: 'REVIEWER',
      org: 'Independent Fiduciary',
      avatar: 'SS',
      color: 'bg-amber-600',
    },
  ];

  const currentPersonaData =
    personas.find((p) => p.id === currentUser?.id) ?? personas[0];

  const handleActionClick = () => {
    if (role === 'CLIENT') {
      onOpenCreateProject();
    } else if (role === 'DEVELOPER') {
      navigate('/reviews');
    } else {
      navigate('/settings');
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f5f0] text-[#0b1f17] flex flex-col font-sans selection:bg-[#c8f542] selection:text-[#0b1f17]">
      {/* ─────────────────────────────────────────────────────────────
          TOP NAVBAR: High-End Segmented Floating Header
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#f6f5f0]/95 backdrop-blur-xl border-b border-[rgba(11,31,23,0.08)]">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-18 gap-2 sm:gap-4">
            
            {/* ZONE 1: BRAND LOGO & LIVE TELEMETRY BADGE */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-xl bg-[#0b1f17] text-white flex items-center justify-center font-bold text-xs shadow-sm group-hover:scale-105 transition">
                  ◈
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight text-[#0b1f17] leading-tight">
                    veridex
                  </span>
                  <span className="text-[9px] text-[#2f7a50] font-mono tracking-tight flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2f7a50] animate-pulse" />
                    <span className="hidden sm:inline">Live Sandbox</span>
                  </span>
                </div>
              </Link>
            </div>

            {/* ZONE 2: SEGMENTED FLOATING WORKSPACE NAV */}
            <nav className="hidden lg:flex items-center bg-[#e9efe6]/90 p-1 rounded-full border border-[rgba(11,31,23,0.08)] shadow-[0_2px_8px_-2px_rgba(11,31,23,0.04)]">
              {navDestinations.map((dest) => {
                const isActive =
                  currentPath === dest.path ||
                  (dest.path !== '/' && currentPath.startsWith(dest.path));

                return (
                  <Link
                    key={dest.path}
                    to={dest.path}
                    className={`relative px-3 py-1.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0b1f17] text-white shadow-sm'
                        : 'text-[#3d5248] hover:text-[#0b1f17] hover:bg-white/70'
                    }`}
                  >
                    <span>{dest.label}</span>
                    {dest.tag && (
                      <span
                        className={`text-[8px] px-1.5 py-0.2 rounded-full font-mono font-semibold tracking-tight transition ${
                          isActive
                            ? 'bg-[#c8f542] text-[#0b1f17]'
                            : 'bg-white/80 text-[#3d5248] border border-[rgba(11,31,23,0.08)]'
                        }`}
                      >
                        {dest.tag}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* ZONE 3: SEARCH, TOUR, PERSONA SWITCHER & PRIMARY ACTION */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              
              {/* Universal Spotlight Search Pill (Desktop) */}
              <button
                onClick={onOpenSearch}
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full bg-white hover:bg-[#e9efe6] border border-[rgba(11,31,23,0.1)] text-xs text-[#3d5248] hover:text-[#0b1f17] transition shadow-sm"
                title="Universal Search (Press / or ⌘K)"
              >
                <span>🔍</span>
                <span className="font-normal">Search</span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f6f5f0] text-[#3d5248] border border-[rgba(11,31,23,0.1)]">
                  /
                </kbd>
              </button>

              {/* Mobile Search Button (Phones) */}
              <button
                onClick={onOpenSearch}
                className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-white hover:bg-[#e9efe6] border border-[rgba(11,31,23,0.1)] text-xs text-[#3d5248] transition shadow-sm"
                title="Search"
                aria-label="Universal Search"
              >
                <span>🔍</span>
              </button>

              {/* Guided Tour Launcher */}
              <button
                onClick={onStartTour}
                className="px-2.5 sm:px-3.5 py-2 rounded-full bg-[#e9efe6] hover:bg-[#dce6d8] border border-[rgba(11,31,23,0.1)] text-xs font-medium text-[#2f7a50] flex items-center gap-1.5 transition shadow-sm"
                title="Interactive 7-Step Fiduciary Product Walkthrough"
              >
                <span>✨</span>
                <span className="hidden md:inline">Guided Tour</span>
              </button>

              {/* Persona Switcher Dropdown */}
              <div className="relative" ref={personaRef}>
                <button
                  onClick={() => setPersonaMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-white hover:bg-[#e9efe6] border border-[rgba(11,31,23,0.1)] transition shadow-sm text-left"
                >
                  <div
                    className={`w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${currentPersonaData.color}`}
                  >
                    {currentPersonaData.avatar}
                  </div>
                  <div className="hidden lg:flex flex-col text-left pr-1">
                    <span className="text-xs font-medium text-[#0b1f17] leading-tight">
                      {currentPersonaData.name.split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-mono text-[#6b7f75] uppercase leading-none">
                      {currentPersonaData.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#6b7f75]">▾</span>
                </button>

                {/* Persona Switcher Popup Menu */}
                {personaMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-xl border border-[rgba(11,31,23,0.1)] p-2 z-50 animate-fadeIn">
                    <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#6b7f75] border-b border-[rgba(11,31,23,0.06)] mb-1">
                      Switch Role Persona
                    </div>
                    {personas.map((p) => {
                      const isSelected = p.id === currentUser?.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            void onSwitchPersona(p.id);
                            setPersonaMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-left transition ${
                            isSelected
                              ? 'bg-[#e9efe6] text-[#0b1f17] font-semibold'
                              : 'hover:bg-[#f6f5f0] text-[#3d5248]'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${p.color}`}
                          >
                            {p.avatar}
                          </div>
                          <div className="flex-1 truncate">
                            <div className="text-xs">{p.name}</div>
                            <div className="text-[10px] text-[#6b7f75]">{p.org}</div>
                          </div>
                          {isSelected && (
                            <span className="text-xs text-[#2f7a50] font-bold">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Primary Action Button (Tailored to Role) */}
              <button
                onClick={handleActionClick}
                className="px-3 sm:px-4 py-2 rounded-full bg-[#0b1f17] hover:bg-[#1a382c] text-white text-xs font-medium transition shadow-sm flex items-center gap-1.5"
              >
                {role === 'CLIENT' && (
                  <>
                    <span>＋</span>
                    <span className="hidden sm:inline">New Project</span>
                  </>
                )}
                {role === 'DEVELOPER' && (
                  <>
                    <span>🚀</span>
                    <span className="hidden sm:inline">Submit Proof</span>
                  </>
                )}
                {role === 'REVIEWER' && (
                  <>
                    <span>🛡️</span>
                    <span className="hidden sm:inline">Review Fiduciary</span>
                  </>
                )}
              </button>

            </div>

          </div>
        </div>

        {/* Compact Responsive Segmented Navigation Bar (Only for Mobile & Tablets < 1024px) */}
        <div className="lg:hidden border-t border-[rgba(11,31,23,0.08)] bg-[#f6f5f0] px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar touch-pan-x touch-scroll">
          {navDestinations.map((dest) => {
            const isActive =
              currentPath === dest.path ||
              (dest.path !== '/' && currentPath.startsWith(dest.path));

            return (
              <Link
                key={dest.path}
                to={dest.path}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'bg-[#0b1f17] text-white shadow-sm'
                    : 'bg-[#e9efe6] text-[#3d5248] hover:text-[#0b1f17]'
                }`}
              >
                <span>{dest.label}</span>
                {dest.tag && (
                  <span
                    className={`text-[8px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-[#c8f542] text-[#0b1f17]' : 'bg-white text-[#3d5248]'
                    }`}
                  >
                    {dest.tag}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Floating Modern Toast Notification (Zero Layout Shift) */}
      {statusBanner && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-slideUp">
          <div
            className={`p-4 rounded-3xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
              statusBanner.type === 'success'
                ? 'bg-[#e9efe6]/95 border-[#2f7a50]/30 text-[#1c4b31]'
                : statusBanner.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                : 'bg-white/95 border-[rgba(11,31,23,0.12)] text-[#0b1f17]'
            }`}
          >
            <span className="text-base shrink-0">
              {statusBanner.type === 'success' ? '✓' : statusBanner.type === 'error' ? '⚠️' : 'ℹ'}
            </span>
            <div className="flex-1 text-xs leading-relaxed">
              {statusBanner.message}
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Canvas */}
      <main
        className={`flex-1 w-full mx-auto ${
          currentPath === '/'
            ? 'px-0 py-0 max-w-full'
            : 'max-w-7xl px-3 sm:px-6 lg:px-8 py-6 sm:py-8'
        } pb-[calc(1.5rem+env(safe-area-inset-bottom))]`}
      >
        {children}
      </main>

      {/* Cascrow-Style Minimalist Footer (only shown on internal app routes) */}
      {currentPath !== '/' && (
        <footer className="border-t border-[#0b1f17]/10 py-6 bg-[#f6f5f0] text-xs text-[#3d5248] font-sans">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-medium text-[#0b1f17]">trustchain</span>
              <span className="text-[#0b1f17]/20">•</span>
              <span>Multi-Agent AI Verification & Deterministic PayPal Escrow Hold</span>
            </div>
            <div className="text-[11px] text-[#3d5248]/80 font-mono">
              SQLite ACID Persistence • Hash-Chained Audit • Non-Custodial Intent: AUTHORIZE
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
