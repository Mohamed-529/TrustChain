/**
 * AppShell — Modern Minimalist Digital Trust Navigation Shell
 *
 * Design Refinements:
 * - Ultra-sleek glassmorphic floating header with backdrop-blur-xl
 * - Sophisticated Obsidian, Zinc, Emerald & Champagne Gold color palette (NO generic blue)
 * - Clean, spacious navigation pills with refined micro-interactions
 * - Minimalist persona switcher with live status indicator dots
 * - Generous breathing room and uncluttered workspace framing
 */

import React from 'react';
import { Link, usePathname } from '../../router/Router.tsx';
import type { User } from '../../types/domain.ts';

interface AppShellProps {
  currentUser: User | null;
  onSwitchPersona: (userId: string) => Promise<void>;
  statusBanner: { type: 'success' | 'error' | 'info'; message: string } | null;
  onStartTour: () => void;
  children: React.ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Overview', icon: '✦' },
  { path: '/dashboard', label: 'Dashboard', icon: '▦' },
  { path: '/intelligence', label: 'AG Grid', icon: '⚡', badge: 'v36' },
  { path: '/timeline', label: 'Timeline', icon: '◷', badge: 'Gantt' },
  { path: '/reviews', label: 'Review & Pay', icon: '◈', badge: 'PayPal' },
  { path: '/trust', label: 'Passport', icon: '🛡' },
  { path: '/disputes', label: 'Disputes', icon: '⚖' },
  { path: '/developers', label: 'API & SDK', icon: '⚡', badge: 'APIMatic' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

export function AppShell({
  currentUser,
  onSwitchPersona,
  statusBanner,
  onStartTour,
  children,
}: AppShellProps) {
  const currentPath = usePathname();

  const getBreadcrumbLabel = (path: string): string => {
    const item = NAV_ITEMS.find((n) => n.path === path);
    return item ? `${item.icon} ${item.label}` : 'Overview';
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Sleek Minimalist Glassmorphic Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-6">
            {/* Brand Logo & Name */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-300 to-amber-400 p-0.5 shadow-md shadow-emerald-500/10 group-hover:scale-105 transition duration-300">
                <div className="w-full h-full bg-[#09090b] rounded-[10px] flex items-center justify-center text-xs font-bold text-emerald-400 font-mono">
                  TC
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white group-hover:text-emerald-300 transition">
                  TrustChain
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hidden sm:inline-block">
                  FINANCIAL AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1.5 py-1">
              {NAV_ITEMS.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'bg-zinc-800/90 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/5 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                    }`}
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          isActive
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls: Tour & Clean Persona Switcher */}
            <div className="flex items-center gap-3">
              {/* Tour Launcher Button */}
              <button
                onClick={onStartTour}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition"
                title="Launch Guided Product Tour"
              >
                <span>✨</span>
                <span className="hidden sm:inline">Tour</span>
              </button>

              {/* Minimal Persona Switcher */}
              <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
                {[
                  { id: 'client_01', label: 'Client' },
                  { id: 'dev_01', label: 'Developer' },
                  { id: 'reviewer_01', label: 'Reviewer' },
                ].map((p) => {
                  const isCurrent = currentUser?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => void onSwitchPersona(p.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-zinc-800 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="lg:hidden border-t border-zinc-800/80 bg-zinc-950 px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${
                  isActive
                    ? 'bg-zinc-800 text-emerald-400 font-bold border border-emerald-500/40'
                    : 'text-zinc-400 hover:bg-zinc-900'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Subtle Breadcrumb Ribbon */}
      <div className="bg-zinc-950/40 border-b border-zinc-800/60 px-4 sm:px-6 lg:px-8 py-2 text-xs font-mono flex items-center justify-between text-zinc-400">
        <div className="flex items-center gap-2">
          <Link to="/" className="hover:text-zinc-200 transition">
            TrustChain
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-200 font-semibold">{getBreadcrumbLabel(currentPath)}</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px]">
          <span>Role: <strong className="text-emerald-400">{currentUser?.role ?? 'AUTHENTICATING'}</strong></span>
          <span className="text-zinc-700">•</span>
          <span>Active User: <strong className="text-zinc-300">{currentUser?.name ?? '—'}</strong></span>
        </div>
      </div>

      {/* Global Status Banner */}
      {statusBanner && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4">
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono shadow-md flex items-center justify-between ${
              statusBanner.type === 'error'
                ? 'bg-rose-950/70 border-rose-800/80 text-rose-200'
                : statusBanner.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-200'
            }`}
          >
            <span>{statusBanner.message}</span>
            <span className="text-[10px] text-zinc-500">ESC to dismiss</span>
          </div>
        </div>
      )}

      {/* Main Workspace Area with Generous Spacing */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
