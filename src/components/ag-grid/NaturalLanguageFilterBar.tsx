import React, { useState } from 'react';
import type { GridApi } from 'ag-grid-community';
import {
  type GridFilterInstruction,
  type InterpretedQueryPlan,
  WHITELISTED_COLUMNS,
  interpretNaturalLanguageQuery,
} from './queryParser.ts';

export type { GridFilterInstruction, InterpretedQueryPlan };
export { WHITELISTED_COLUMNS, interpretNaturalLanguageQuery };

interface NaturalLanguageFilterBarProps {
  gridApi: GridApi | null;
  onFilterApplied?: (plan: InterpretedQueryPlan) => void;
  onResetFilters?: () => void;
}

export function NaturalLanguageFilterBar({
  gridApi,
  onFilterApplied,
  onResetFilters,
}: NaturalLanguageFilterBarProps) {
  const [queryInput, setQueryInput] = useState<string>('');
  const [activePlan, setActivePlan] = useState<InterpretedQueryPlan | null>(null);
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [appliedBadge, setAppliedBadge] = useState<string | null>(null);

  const handleInterpret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    const plan = interpretNaturalLanguageQuery(queryInput);
    setActivePlan(plan);
    setShowPlanModal(true);
  };

  const handleApplyPlan = () => {
    if (!activePlan || !gridApi) return;

    // Apply strict whitelisted filters
    const filterModel: Record<string, any> = {};

    for (const inst of activePlan.instructions) {
      if (inst.operator === 'EQUALS') {
        filterModel[inst.column] = {
          filterType: 'text',
          type: 'equals',
          filter: String(inst.value),
        };
      } else if (inst.operator === 'GREATER_THAN') {
        filterModel[inst.column] = {
          filterType: 'number',
          type: 'greaterThan',
          filter: Number(inst.value),
        };
      } else if (inst.operator === 'LESS_THAN') {
        filterModel[inst.column] = {
          filterType: 'number',
          type: 'lessThan',
          filter: Number(inst.value),
        };
      }
    }

    gridApi.setFilterModel(filterModel);
    gridApi.onFilterChanged();

    setAppliedBadge(
      activePlan.instructions.length > 0
        ? `${activePlan.instructions.length} filter(s) active: "${activePlan.originalQuery}"`
        : `Searched "${activePlan.originalQuery}"`
    );

    setShowPlanModal(false);
    onFilterApplied?.(activePlan);
  };

  const handleClear = () => {
    setQueryInput('');
    setActivePlan(null);
    setAppliedBadge(null);
    if (gridApi) {
      gridApi.setFilterModel(null);
      gridApi.setGridOption('quickFilterText', '');
      gridApi.onFilterChanged();
    }
    onResetFilters?.();
  };

  const presets = [
    'Show HIGH risk milestones',
    'Show milestones with budget > $2,000',
    'Show approved milestones',
    'Show unverified evidence (<100%)',
    'Show AUTHORIZED escrow holds',
  ];

  return (
    <div className="space-y-2">
      <form onSubmit={handleInterpret} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[280px]">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Natural language investigation query (e.g., 'Show high risk milestones with budget > $1,000')..."
            className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>
        <button
          type="submit"
          disabled={!queryInput.trim()}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5"
        >
          <span>✨</span> Interpret Query
        </button>
        {(appliedBadge || queryInput) && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700"
          >
            Reset
          </button>
        )}
      </form>

      {/* Preset Query Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-slate-500 font-mono">Suggested:</span>
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setQueryInput(p);
              const plan = interpretNaturalLanguageQuery(p);
              setActivePlan(plan);
              setShowPlanModal(true);
            }}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] transition"
          >
            {p}
          </button>
        ))}
      </div>

      {appliedBadge && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded bg-indigo-950/60 border border-indigo-800 text-indigo-200 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span>{appliedBadge}</span>
          </div>
          <button
            onClick={handleClear}
            className="text-[11px] underline hover:text-white text-indigo-300"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Review & Apply Modal */}
      {showPlanModal && activePlan && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-slate-900 border border-indigo-800 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">✨</span>
                <h3 className="text-sm font-bold text-white">
                  Review Interpreted Grid Filter Plan
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
                Safe Whitelist
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="text-slate-400">
                Original Query: <span className="font-mono text-white">"{activePlan.originalQuery}"</span>
              </div>
              <div className="text-slate-400">
                Rationale: <span className="text-slate-300">{activePlan.rationale}</span>
              </div>

              <div className="pt-2">
                <div className="font-semibold text-white mb-1.5">Proposed Filter Operations:</div>
                {activePlan.instructions.length > 0 ? (
                  <div className="space-y-1.5">
                    {activePlan.instructions.map((inst, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] flex items-center justify-between"
                      >
                        <div>
                          <span className="text-indigo-400 font-bold">{inst.columnLabel}</span>{' '}
                          <span className="text-slate-400">[{inst.operator}]</span>{' '}
                          <span className="text-emerald-400">
                            {inst.column.includes('Cents')
                              ? `$${(Number(inst.value) / 100).toLocaleString()}`
                              : String(inst.value)}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">Column: {inst.column}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-amber-300 text-[11px] italic">
                    No strict filters matched; query will be applied as general search text.
                  </p>
                )}
              </div>

              {activePlan.sortInstruction && (
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px]">
                  Sort By:{' '}
                  <span className="text-sky-300 font-bold">
                    {activePlan.sortInstruction.columnLabel}
                  </span>{' '}
                  ({activePlan.sortInstruction.direction.toUpperCase()})
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyPlan}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 font-semibold text-white flex items-center gap-1.5"
              >
                <span>✓</span> Apply to Grid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
