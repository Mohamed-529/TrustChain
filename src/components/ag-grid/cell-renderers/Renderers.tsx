import React from 'react';
import type { ICellRendererParams } from 'ag-grid-community';

export function StatusBadgeRenderer(params: ICellRendererParams) {
  const value = String(params.value ?? '');
  if (!value) return <span className="text-slate-500">—</span>;

  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  if (value === 'APPROVED' || value === 'COMPLETED' || value === 'SETTLED') {
    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-700';
  } else if (value === 'REJECTED' || value === 'FAILED') {
    badgeColor = 'bg-rose-950 text-rose-300 border-rose-700';
  } else if (value === 'REVISION_REQUESTED' || value === 'NEEDS_CHANGES' || value === 'IN_REVIEW') {
    badgeColor = 'bg-amber-950 text-amber-300 border-amber-700';
  } else if (value === 'ACTIVE') {
    badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-700';
  }

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono border font-semibold ${badgeColor}`}
      title={`Milestone Status: ${value}`}
    >
      {value}
    </span>
  );
}

export function PaymentStatusRenderer(params: ICellRendererParams) {
  const value = String(params.value ?? '');
  const mode = params.data?.paymentExecutionMode;
  if (!value || value === 'NOT_READY') {
    return <span className="text-slate-500 text-xs font-mono">NOT_READY</span>;
  }

  let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
  if (value === 'CAPTURED' || value === 'SIMULATED_CAPTURED') {
    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-700';
  } else if (value === 'AUTHORIZED' || value === 'SIMULATED_AUTHORIZED') {
    badgeColor = 'bg-indigo-950 text-indigo-300 border-indigo-700';
  } else if (value === 'ORDER_CREATED' || value === 'SIMULATED_ORDER_CREATED') {
    badgeColor = 'bg-sky-950 text-sky-300 border-sky-700';
  } else if (value.includes('TIMEOUT') || value.includes('RECONCILIATION')) {
    badgeColor = 'bg-amber-950 text-amber-300 border-amber-700';
  } else if (value.includes('FAILED')) {
    badgeColor = 'bg-rose-950 text-rose-300 border-rose-700';
  }

  return (
    <div className="flex items-center gap-1.5 py-1">
      <span
        className={`px-2 py-0.5 rounded text-[10px] font-mono border font-semibold ${badgeColor}`}
        title={`Payment Status: ${value}`}
      >
        {value}
      </span>
      {mode && mode !== 'NONE' && (
        <span
          className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1 py-0.5 rounded border border-slate-800"
          title={`Execution Mode: ${mode}`}
        >
          {mode === 'PAYPAL_SANDBOX' ? 'LIVE-SB' : 'SIM'}
        </span>
      )}
    </div>
  );
}

export function RiskBadgeRenderer(params: ICellRendererParams) {
  const severity = String(params.value ?? 'UNAVAILABLE');

  let badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
  let icon = '🛡️';

  switch (severity) {
    case 'CRITICAL':
      badgeClass = 'bg-rose-950 text-rose-200 border-rose-700 font-bold';
      icon = '🚨';
      break;
    case 'HIGH':
      badgeClass = 'bg-orange-950 text-orange-200 border-orange-700 font-bold';
      icon = '⚠️';
      break;
    case 'MEDIUM':
      badgeClass = 'bg-amber-950 text-amber-200 border-amber-700';
      icon = '⚡';
      break;
    case 'LOW':
      badgeClass = 'bg-emerald-950 text-emerald-200 border-emerald-700';
      icon = '✅';
      break;
    case 'NONE':
      badgeClass = 'bg-emerald-950 text-emerald-300 border-emerald-800';
      icon = '🛡️';
      break;
    default:
      badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
      icon = '—';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${badgeClass}`}
      title={`Risk Severity: ${severity}`}
    >
      <span>{icon}</span>
      <span>{severity}</span>
    </span>
  );
}

export function MonetaryCellRenderer(params: ICellRendererParams) {
  const cents = params.value;
  if (cents === null || cents === undefined) {
    return <span className="text-slate-500 font-mono">—</span>;
  }
  const formatted = `$${(Number(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return <span className="font-mono text-xs text-white">{formatted}</span>;
}

export function EvidenceCompletenessRenderer(params: ICellRendererParams) {
  const pct = Number(params.value ?? 0);
  const subId = params.data?.submissionId;

  if (!subId) {
    return <span className="text-slate-500 text-xs italic">No submission</span>;
  }

  let barColor = 'bg-emerald-500';
  let textColor = 'text-emerald-300';
  if (pct < 50) {
    barColor = 'bg-rose-500';
    textColor = 'text-rose-300';
  } else if (pct < 100) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-300';
  }

  return (
    <div className="flex flex-col justify-center h-full w-full py-1">
      <div className="flex justify-between items-center text-[10px] font-mono mb-1">
        <span className={textColor}>{pct.toFixed(0)}%</span>
        <span className="text-slate-400">Att #{params.data?.attemptNumber ?? 1}</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}
