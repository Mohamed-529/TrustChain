import React from 'react';

interface SiteFooterProps {
  onNavigateAuth?: (mode: 'SIGN_IN' | 'CREATE_ACCOUNT') => void;
  onNavigatePath?: (path: string) => void;
  variant?: 'light' | 'subtle';
}

export function SiteFooter({
  onNavigateAuth,
  onNavigatePath,
  variant = 'light',
}: SiteFooterProps) {
  const handleLink = (path?: string, authMode?: 'SIGN_IN' | 'CREATE_ACCOUNT') => {
    if (path && onNavigatePath) {
      onNavigatePath(path);
      return;
    }
    if (authMode && onNavigateAuth) {
      onNavigateAuth(authMode);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      className={`w-full border-t border-[#d0d7de]/80 ${
        variant === 'subtle' ? 'bg-[#f6f8fa]' : 'bg-white'
      } text-[#59636e]`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d1117] text-white flex items-center justify-center font-black text-sm shadow-sm">
                ◈
              </div>
              <span className="text-base font-bold tracking-tight text-[#1f2328]">Veridex</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#dafbe1] text-[#116329] text-[10px] font-mono font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1f883d] animate-pulse" />
                Live Sandbox
              </span>
            </div>
            <p className="text-xs text-[#59636e] leading-relaxed max-w-xs">
              Autonomous software escrow &amp; tri-agent verification engine connecting real GitHub delivery to deterministic PayPal settlement.
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-[#59636e]">
              <span className="px-2 py-0.5 rounded bg-[#f6f8fa] border border-[#d0d7de]">
                Orders v2
              </span>
              <span className="px-2 py-0.5 rounded bg-[#f6f8fa] border border-[#d0d7de]">
                SHA-256 Ledger
              </span>
              <span className="px-2 py-0.5 rounded bg-[#f6f8fa] border border-[#d0d7de]">
                Non-Custodial
              </span>
            </div>
          </div>

          {/* Platform Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1f2328]">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/dashboard', 'CREATE_ACCOUNT')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  Contract Overview
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/reviews', 'SIGN_IN')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  Tri-Agent Verification
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/timeline', 'SIGN_IN')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  Milestone Schedule
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/intelligence', 'SIGN_IN')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  Financial Ledger
                </button>
              </li>
            </ul>
          </div>

          {/* Workspaces Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1f2328]">
              Workspaces
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/dashboard', 'CREATE_ACCOUNT')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  For Clients (Hiring)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/marketplace', 'CREATE_ACCOUNT')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  Developer Workspace
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/trust', 'SIGN_IN')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  Evidence Passport
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleLink('/docs', 'SIGN_IN')}
                  className="hover:text-[#1f883d] transition cursor-pointer"
                >
                  OpenAPI &amp; SDK Docs
                </button>
              </li>
            </ul>
          </div>

          {/* Governance Column */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1f2328]">
              Governance
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <span className="text-[#59636e]">29-Day PayPal Auth Hold</span>
              </li>
              <li>
                <span className="text-[#59636e]">Human-Only Capture Gate</span>
              </li>
              <li>
                <span className="text-[#59636e]">Terms of Service</span>
              </li>
              <li>
                <span className="text-[#59636e]">Privacy &amp; Security</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Architecture Bar */}
      <div className="border-t border-[#d0d7de]/70 bg-[#f6f8fa]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#59636e]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#1f2328]">&copy; 2026 Veridex</span>
            <span>&middot;</span>
            <span>All rights reserved.</span>
          </div>
          <div className="font-mono text-[10px] sm:text-[11px] text-[#59636e] text-center sm:text-right">
            SQLite ACID Persistence &bull; Hash-Chained SHA-256 Audit &bull; Non-Custodial Intent: AUTHORIZE
          </div>
        </div>
      </div>
    </footer>
  );
}
