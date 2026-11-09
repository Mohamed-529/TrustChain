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
      {/* 1-Line Clean Header */}
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚙️</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Platform Settings & Tour Controller</h1>
        </div>
        {/* EXACTLY 1 LINE DESCRIPTION */}
        <p className="text-xs text-zinc-400 mt-1">
          Configure active personas, replay interactive onboarding tours, and inspect immutable system audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Active Persona Configuration */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>👤</span> Active Fiduciary Persona
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-mono">
              {currentUser?.role ?? 'CLIENT'}
            </span>
          </div>

          <p className="text-xs text-zinc-300">
            Switch between personas to test role-based permissions: Clients authorize funding holds, Developers submit evidence, and Reviewers approve settlement.
          </p>

          <div className="space-y-2">
            {[
              {
                id: 'client_01',
                name: 'Elena Vance',
                role: 'CLIENT (Acme FinTech Buyer)',
                desc: 'Authority to authorize PayPal Sandbox holds and release milestone disbursements.',
              },
              {
                id: 'dev_01',
                name: 'Marcus Chen',
                role: 'DEVELOPER (Senior Fullstack Lead)',
                desc: 'Submits delivery evidence, GitHub commits, and PRs. Cannot self-approve payouts.',
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
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-zinc-800 text-white border-emerald-500/60 shadow-sm'
                      : 'bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-white">{p.name}</span>
                    <span className="text-[10px] font-mono text-emerald-400">{p.role}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Guided Tour & Interactive Walkthrough */}
        <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>✨</span> Product Guided Tour
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800 font-mono">
                INTERACTIVE
              </span>
            </div>

            <p className="text-xs text-zinc-300">
              Replay the 6-stage interactive walkthrough covering evidence verifications, AG Grid decision ledgers, Bryntum timelines, and PayPal settlement.
            </p>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
              <div className="text-zinc-500">Onboarding State:</div>
              <div className="text-emerald-400 font-mono font-bold">
                ✓ Ready for Replay or First-Visit Inspection
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={handleResetTour}
              className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-zinc-950 shadow-md shadow-emerald-600/10 transition flex items-center justify-center gap-2"
            >
              <span>🚀</span> Launch Interactive Product Tour
            </button>
          </div>
        </div>
      </div>

      {/* Audit History Log Preview */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 font-mono text-xs shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <span className="font-bold text-white">Tamper-Evident SHA-256 Audit Trail History</span>
          <span className="text-xs text-zinc-400">{auditLogs.length} verified events</span>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1.5 text-[11px] pr-1">
          {auditLogs.slice(0, 10).map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-emerald-400 font-bold">#{log.seq}</span>
                <span className="text-zinc-300">{log.action}</span>
                <span className="text-zinc-500 truncate text-[10px]">[{log.entityType}:{log.entityId}]</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                {log.timestamp.slice(11, 19)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
