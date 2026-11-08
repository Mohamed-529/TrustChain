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
  { path: '/', label: 'Welcome', icon: '🏛️' },
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/intelligence', label: 'AG Grid', icon: '📑', badge: 'v36' },
  { path: '/timeline', label: 'Timeline', icon: '📅', badge: 'Bryntum' },
  { path: '/reviews', label: 'Review & Pay', icon: '⚖️', badge: 'PayPal' },
  { path: '/trust', label: 'Passport', icon: '🛡️' },
  { path: '/disputes', label: 'Disputes', icon: '⚖️' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Brand Logo & Name */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 p-0.5 shadow-lg group-hover:scale-105 transition">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-sm font-bold text-white font-mono">
                  TC
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white group-hover:text-indigo-300 transition">
                    TrustChain
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                    AI ORCHESTRATOR
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
                  Evidence-to-Settlement Control Tower
                </div>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
              {NAV_ITEMS.map((item) => {
                const isActive = currentPath === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          isActive
                            ? 'bg-indigo-800 text-indigo-100'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls: Tour & Persona Switcher */}
            <div className="flex items-center gap-2.5">
              {/* Tour Launcher Button */}
              <button
                onClick={onStartTour}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/80 text-xs font-semibold text-indigo-300 flex items-center gap-1 transition"
                title="Launch Interactive Product Tour"
              >
                <span>✨</span>
                <span className="hidden sm:inline">Tour</span>
              </button>

              {/* Persona Switcher Buttons */}
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-xs font-mono">
                {[
                  { id: 'client_01', label: 'Elena (Client)' },
                  { id: 'dev_01', label: 'Marcus (Dev)' },
                  { id: 'reviewer_01', label: 'Sophia (Fiduciary)' },
                ].map((p) => {
                  const isCurrent = currentUser?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => void onSwitchPersona(p.id)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                        isCurrent
                          ? 'bg-emerald-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="lg:hidden border-t border-slate-800/80 bg-slate-950/90 px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-2.5 py-1 rounded text-xs whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Breadcrumbs & Active Location Ribbon */}
      <div className="bg-slate-900/40 border-b border-slate-800/60 px-4 sm:px-6 lg:px-8 py-1.5 text-xs font-mono flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <Link to="/" className="hover:text-white transition">
            TrustChain
          </Link>
          <span>/</span>
          <span className="text-white font-semibold">{getBreadcrumbLabel(currentPath)}</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px]">
          <span>Role: <strong className="text-emerald-400">{currentUser?.role ?? 'AUTHENTICATING'}</strong></span>
          <span>•</span>
          <span>User: <strong className="text-slate-200">{currentUser?.name ?? '—'}</strong></span>
        </div>
      </div>

      {/* Global Status Banner / Alert Toast */}
      {statusBanner && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-3">
          <div
            className={`p-3 rounded-lg border text-xs font-mono shadow flex items-center justify-between ${
              statusBanner.type === 'error'
                ? 'bg-rose-950/80 border-rose-700 text-rose-200'
                : statusBanner.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                : 'bg-slate-900 border-indigo-700 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{statusBanner.type === 'error' ? '⚠️' : statusBanner.type === 'success' ? '✓' : 'ℹ️'}</span>
              <span>{statusBanner.message}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-300 font-bold">TrustChain Settlement Engine v1.1.0</span>
            <span>• Verified Multi-Agent Orchestration</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>AG Grid Community</span>
            <span>Bryntum Gantt</span>
            <span>APIMatic OpenAPI</span>
            <span>PayPal Orders v2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
