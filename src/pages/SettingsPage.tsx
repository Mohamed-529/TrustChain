import React from 'react';
import type { User, AuditLogEntry } from '../types/domain.ts';
import { STORAGE_KEY_ONBOARDING } from '../components/onboarding/GuidedTourModal.tsx';

interface SettingsPageProps {
  currentUser: User | null;
  onSwitchPersona: (userId: string) => Promise<void>;
  auditLogs: AuditLogEntry[];
  onStartTour: () => void;
  statusBanner: { type: 'success' | 'error' | 'info'; message: string } | null;
}

export function SettingsPage({
  currentUser,
  onSwitchPersona,
  auditLogs,
  onStartTour,
}: SettingsPageProps) {
  const handleResetTour = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_ONBOARDING);
    }
    onStartTour();
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <h1 className="text-xl font-bold text-white">Platform Settings & Tour Controller</h1>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure active personas, replay interactive onboarding tours, and inspect system audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Active Persona Configuration */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>👤</span> Active Fiduciary Persona
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              {currentUser?.role ?? 'CLIENT'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Switch between personas to test role-based permissions: Clients can approve disbursements, Developers submit delivery evidence, and Reviewers analyze risk.
          </p>

          <div className="space-y-2">
            {[
              {
                id: 'client_01',
                name: 'Elena Vance',
                role: 'CLIENT (Acme FinTech Buyer)',
                desc: 'Authority to authorize PayPal Sandbox holds and capture milestone disbursements.',
              },
              {
                id: 'dev_01',
                name: 'Marcus Chen',
                role: 'DEVELOPER (Senior Fullstack Lead)',
                desc: 'Submits delivery evidence, GitHub commits, and PRs. Cannot self-approve.',
              },
              {
                id: 'reviewer_01',
                name: 'Sophia Sterling',
                role: 'REVIEWER (Fiduciary Compliance)',
                desc: 'Independent auditor evaluating multi-agent risk analysis and policy bounds.',
              },
            ].map((p) => {
              const isSelected = currentUser?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => void onSwitchPersona(p.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-950/70 border-indigo-500 shadow'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-white">{p.name}</span>
                    <span className="text-[10px] font-mono text-indigo-400">{p.role}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Guided Tour & Interactive Walkthrough */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>✨</span> Product Guided Tour
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
              INTERACTIVE
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Replay the multi-stage interactive tour to explore how TrustChain orchestrates evidence verifications, AG Grid decision ledgers, Bryntum timelines, and PayPal settlement.
          </p>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="text-slate-400">Onboarding State:</div>
            <div className="text-emerald-400 font-mono font-bold">
              ✓ Ready for Replay or First-Visit Inspection
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleResetTour}
              className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
            >
              <span>🚀</span> Launch Interactive Product Tour
            </button>
          </div>
        </div>
      </div>

      {/* Audit History Log Preview */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="font-bold text-white">Tamper-Evident SHA-256 Audit Trail History</span>
          <span className="text-xs text-slate-400">{auditLogs.length} verified events</span>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1.5 text-[11px] pr-1">
          {auditLogs.slice(0, 10).map((log) => (
            <div
              key={log.id}
              className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-indigo-400 font-bold">#{log.seq}</span>
                <span className="text-slate-300">{log.action}</span>
                <span className="text-slate-500 truncate text-[10px]">[{log.entityType}:{log.entityId}]</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {log.timestamp.slice(11, 19)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
