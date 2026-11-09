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
  const [activeInstructions, setActiveInstructions] = useState<GridFilterInstruction[]>([]);
  const [showPlanModal, setShowPlanModal] = useState<boolean>(false);
  const [appliedBadge, setAppliedBadge] = useState<string | null>(null);

  const handleInterpret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    const plan = interpretNaturalLanguageQuery(queryInput);
    setActivePlan(plan);
    setShowPlanModal(true);
  };

  const applyInstructionsToGrid = (instructions: GridFilterInstruction[], originalQuery = '') => {
    if (!gridApi) return;

    const filterModel: Record<string, any> = {};

    for (const inst of instructions) {
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
      } else if (inst.operator === 'IN') {
        const values = String(inst.value)
          .split(',')
          .map((v) => v.trim());
        if (values.length === 1) {
          filterModel[inst.column] = {
            filterType: 'text',
            type: 'equals',
            filter: values[0],
          };
        } else {
          filterModel[inst.column] = {
            filterType: 'text',
            operator: 'OR',
            conditions: values.map((val) => ({
              filterType: 'text',
              type: 'equals',
              filter: val,
            })),
          };
        }
      }
    }

    gridApi.setFilterModel(filterModel);
    gridApi.onFilterChanged();
    setActiveInstructions(instructions);

    if (instructions.length > 0) {
      setAppliedBadge(
        originalQuery
          ? `${instructions.length} filter(s) active: "${originalQuery}"`
          : `${instructions.length} filter rule(s) active`
      );
    } else {
      setAppliedBadge(null);
    }
  };

  const handleApplyPlan = () => {
    if (!activePlan || !gridApi) return;
    applyInstructionsToGrid(activePlan.instructions, activePlan.originalQuery);
    setShowPlanModal(false);
    onFilterApplied?.(activePlan);
  };

  const handleRemoveInstruction = (columnName: string) => {
    const updated = activeInstructions.filter((inst) => inst.column !== columnName);
    applyInstructionsToGrid(updated);
    if (updated.length === 0) {
      onResetFilters?.();
    }
  };

  const handleClear = () => {
    setQueryInput('');
    setActivePlan(null);
    setActiveInstructions([]);
    setAppliedBadge(null);
    if (gridApi) {
      gridApi.setFilterModel(null);
      gridApi.setGridOption('quickFilterText', '');
      gridApi.onFilterChanged();
    }
    onResetFilters?.();
  };

  const presets = [
    'Show evidence requiring human review',
    'Find high-risk milestone submissions',
    'Show evidence submitted this week',
    'Show failed verification results',
    'Show milestones with budget > $2,000',
    'Show unverified evidence (<100%)',
  ];

  return (
    <div className="space-y-2">
      <form onSubmit={handleInterpret} className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[280px]">
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Natural language investigation query (e.g., 'Show evidence requiring human review', 'Find high-risk milestone submissions')..."
            className="w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>
        <button
          type="submit"
          disabled={!queryInput.trim()}
          className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 transition"
        >
          <span>✨</span> Interpret Query
        </button>
        {(appliedBadge || queryInput || activeInstructions.length > 0) && (
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

      {/* Active Filter Pills with 1-Click Removal */}
      {activeInstructions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono text-slate-400">Active Rules:</span>
          {activeInstructions.map((inst) => (
            <span
              key={inst.column}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-[11px] font-mono shadow-sm"
            >
              <span className="font-semibold text-indigo-300">{inst.columnLabel}:</span>
              <span>{inst.operator === 'IN' ? `[${inst.value}]` : String(inst.value)}</span>
              <button
                type="button"
                onClick={() => handleRemoveInstruction(inst.column)}
                className="text-slate-400 hover:text-rose-400 font-bold ml-1 transition"
                title={`Remove ${inst.columnLabel} filter`}
                aria-label={`Remove ${inst.columnLabel} filter`}
              >
                ✕
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] font-mono text-slate-400 hover:text-white underline ml-1"
          >
            Clear all
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
                Original Query:{' '}
                <span className="font-mono text-white">"{activePlan.originalQuery}"</span>
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
                        <span className="text-[10px] text-slate-500 font-sans">
                          {inst.description}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 text-slate-400 italic">
                    No specific filter rules extracted. A general keyword search across visible columns
                    will be applied.
                  </div>
                )}
              </div>

              {activePlan.sortInstruction && (
                <div className="pt-1 text-[11px] font-mono text-indigo-300">
                  ⚡ Suggested Sort: {activePlan.sortInstruction.columnLabel} (
                  {activePlan.sortInstruction.direction.toUpperCase()})
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyPlan}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1"
              >
                <span>✓</span> Apply Filter Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
