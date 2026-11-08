import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type RowSelectedEvent,
  type ICellRendererParams,
} from 'ag-grid-community';

// AG Grid v36 CSS styles
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import type { FinancialLedgerRow } from '../../types/domain';
import {
  StatusBadgeRenderer,
  PaymentStatusRenderer,
  RiskBadgeRenderer,
  MonetaryCellRenderer,
  EvidenceCompletenessRenderer,
} from './cell-renderers/Renderers';
import { EvidenceDetailPanel } from './EvidenceDetailPanel';
import { NaturalLanguageFilterBar } from './NaturalLanguageFilterBar';

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

const STORAGE_KEY_COL_STATE = 'tc_ag_grid_milestone_col_state';

interface MilestoneIntelligenceGridProps {
  ledgerRows: FinancialLedgerRow[];
  token: string;
  selectedMilestoneId: string;
  onSelectMilestone: (milestoneId: string) => void;
  onOpenPassport: (milestoneId: string) => void;
  onOpenDisputePack: (milestoneId: string) => void;
  onOpenAiInspector: (milestoneId: string) => void;
  quickFilterType?: string;
}

export function MilestoneIntelligenceGrid({
  ledgerRows,
  token,
  selectedMilestoneId,
  onSelectMilestone,
  onOpenPassport,
  onOpenDisputePack,
  onOpenAiInspector,
  quickFilterType = 'ALL',
}: MilestoneIntelligenceGridProps) {
  const gridRef = useRef<AgGridReact<FinancialLedgerRow>>(null);
  const [gridApi, setGridApi] = useState<GridApi<FinancialLedgerRow> | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const toggleRowExpansion = useCallback((milestoneId: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  }, []);

  // Filter rows if quick filter is selected
  const filteredRows = useMemo(() => {
    if (!ledgerRows) return [];
    switch (quickFilterType) {
      case 'HIGH_RISK':
        return ledgerRows.filter((r) => r.riskSeverity === 'CRITICAL' || r.riskSeverity === 'HIGH');
      case 'PENDING_REVIEW':
        return ledgerRows.filter(
          (r) =>
            r.submissionId &&
            r.stateMachineStatus !== 'APPROVED' &&
            r.stateMachineStatus !== 'REJECTED'
        );
      case 'SETTLED':
        return ledgerRows.filter(
          (r) => r.paymentStatus === 'CAPTURED' || r.paymentStatus === 'SIMULATED_CAPTURED'
        );
      case 'ALL':
      default:
        return ledgerRows;
    }
  }, [ledgerRows, quickFilterType]);

  // Master/Detail Expand Renderer (Community Edition Full-Width Pattern)
  const ExpandCellRenderer = useCallback(
    (params: ICellRendererParams<FinancialLedgerRow>) => {
      if (!params.data) return null;
      const isExpanded = expandedRowIds.has(params.data.milestoneId);
      const isSelected = params.data.milestoneId === selectedMilestoneId;

      return (
        <div className="flex items-center justify-center gap-1.5 h-full">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleRowExpansion(params.data!.milestoneId);
            }}
            className={`w-6 h-6 flex items-center justify-center rounded text-xs transition ${
              isExpanded
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title={isExpanded ? 'Collapse evidence details' : 'Expand evidence details (Master/Detail)'}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          {isSelected && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              title="Currently selected in workbench"
            />
          )}
        </div>
      );
    },
    [expandedRowIds, selectedMilestoneId, toggleRowExpansion]
  );

  // Column Definitions
  const columnDefs = useMemo<ColDef<FinancialLedgerRow>[]>(() => {
    return [
      {
        headerName: '',
        field: 'milestoneId',
        width: 55,
        minWidth: 55,
        maxWidth: 60,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        cellRenderer: ExpandCellRenderer,
      },
      {
        headerName: 'Milestone',
        field: 'milestoneTitle',
        minWidth: 200,
        flex: 1.5,
        pinned: 'left',
        sortable: true,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams<FinancialLedgerRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex flex-col justify-center h-full py-1">
              <span className="font-semibold text-white truncate">{params.data.milestoneTitle}</span>
              <span className="text-[10px] font-mono text-slate-400">
                #{params.data.sequenceOrder} • {params.data.milestoneId}
              </span>
            </div>
          );
        },
      },
      {
        headerName: 'Contract',
        field: 'contractTitle',
        minWidth: 160,
        flex: 1,
        sortable: true,
        filter: 'agTextColumnFilter',
        cellClass: 'text-slate-300 font-sans text-xs',
      },
      {
        headerName: 'State',
        field: 'stateMachineStatus',
        width: 130,
        sortable: true,
        filter: 'agTextColumnFilter',
        cellRenderer: StatusBadgeRenderer,
      },
      {
        headerName: 'Evidence',
        field: 'verifiedRatioPct',
        width: 140,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellRenderer: EvidenceCompletenessRenderer,
      },
      {
        headerName: 'AI Advisory',
        field: 'aiRecommendation',
        width: 120,
        sortable: true,
        filter: 'agTextColumnFilter',
        cellRenderer: (params: ICellRendererParams) => {
          const rec = String(params.value ?? 'PENDING');
          let color = 'text-amber-300';
          if (rec === 'APPROVED' || rec === 'PASS') color = 'text-emerald-300';
          if (rec === 'REJECTED' || rec === 'FAIL') color = 'text-rose-300';
          return (
            <span className={`font-mono text-xs font-semibold ${color}`} title="AI Advisory Recommendation">
              {rec}
            </span>
          );
        },
      },
      {
        headerName: 'Risk Level',
        field: 'riskSeverity',
        width: 125,
        sortable: true,
        filter: 'agTextColumnFilter',
        cellRenderer: RiskBadgeRenderer,
      },
      {
        headerName: 'Agreed Budget',
        field: 'agreedAmountCents',
        width: 120,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellRenderer: MonetaryCellRenderer,
      },
      {
        headerName: 'Permitted Cap',
        field: 'permittedAmountCents',
        width: 120,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellRenderer: MonetaryCellRenderer,
      },
      {
        headerName: 'Approved Payout',
        field: 'approvedAmountCents',
        width: 125,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellRenderer: (params: ICellRendererParams) => {
          const val = params.value;
          if (val === null || val === undefined) {
            return <span className="text-slate-500 font-mono">—</span>;
          }
          return (
            <span className="font-mono text-xs font-semibold text-emerald-400">
              ${(Number(val) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          );
        },
      },
      {
        headerName: 'Payment Status',
        field: 'paymentStatus',
        width: 160,
        sortable: true,
        filter: 'agTextColumnFilter',
        cellRenderer: PaymentStatusRenderer,
      },
      {
        headerName: 'Audit Events',
        field: 'auditEventCount',
        width: 110,
        sortable: true,
        filter: 'agNumberColumnFilter',
        cellRenderer: (params: ICellRendererParams) => (
          <span className="font-mono text-xs text-slate-300">
            {params.value} events
          </span>
        ),
      },
    ];
  }, [ExpandCellRenderer]);

  // Restore column state from localStorage
  const onGridReady = useCallback((params: GridReadyEvent<FinancialLedgerRow>) => {
    setGridApi(params.api);
    try {
      const savedState = localStorage.getItem(STORAGE_KEY_COL_STATE);
      if (savedState) {
        params.api.applyColumnState({
          state: JSON.parse(savedState),
          applyOrder: true,
        });
      }
    } catch {
      // Ignore localStorage parse error
    }
  }, []);

  // Save column state to localStorage
  const handleSaveLayout = useCallback(() => {
    if (!gridApi) return;
    const colState = gridApi.getColumnState();
    localStorage.setItem(STORAGE_KEY_COL_STATE, JSON.stringify(colState));
  }, [gridApi]);

  // Reset column state
  const handleResetLayout = useCallback(() => {
    if (!gridApi) return;
    localStorage.removeItem(STORAGE_KEY_COL_STATE);
    gridApi.resetColumnState();
  }, [gridApi]);

  // Export Sanitized CSV
  const handleExportCsv = useCallback(() => {
    if (!gridApi) return;
    gridApi.exportDataAsCsv({
      fileName: `trustchain-milestone-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      columnKeys: [
        'milestoneTitle',
        'contractTitle',
        'stateMachineStatus',
        'verifiedRatioPct',
        'aiRecommendation',
        'riskSeverity',
        'agreedAmountCents',
        'permittedAmountCents',
        'approvedAmountCents',
        'paymentStatus',
        'auditEventCount',
      ],
      processCellCallback: (params) => {
        let val = params.value;
        if (params.column.getColId().includes('Cents') && val !== null && val !== undefined) {
          val = `$${(Number(val) / 100).toFixed(2)}`;
        }
        // Neutralize Excel/CSV Formula Injection (CWE-1236)
        if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) {
          return `'${val}`;
        }
        return val;
      },
    });
  }, [gridApi]);

  // Row selection handler
  const onRowSelected = useCallback(
    (event: RowSelectedEvent<FinancialLedgerRow>) => {
      if (event.node.isSelected() && event.data) {
        onSelectMilestone(event.data.milestoneId);
      }
    },
    [onSelectMilestone]
  );

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 font-sans">
      {/* Grid Toolbar & Natural Language Filter */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono">
                AG GRID COMMUNITY • V36.3.0
              </span>
              <h2 className="text-base font-bold text-white">
                Milestone Investigation & Settlement Intelligence Grid
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Interactive multi-column sorting, safe filtering, column state persistence, and full-width Master/Detail evidence drilldown.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
              title="Export sanitized CSV excluding credentials and internal hashes"
            >
              <span>📥</span> Export CSV
            </button>
            <button
              onClick={handleSaveLayout}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200"
              title="Save current column order and widths to browser storage"
            >
              Save Layout
            </button>
            <button
              onClick={handleResetLayout}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-400 hover:text-white"
              title="Reset column layout to default"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Priority 3: Safe Natural Language Query Filter Bar */}
        <NaturalLanguageFilterBar
          gridApi={gridApi}
          onResetFilters={() => {
            if (gridApi) gridApi.onFilterChanged();
          }}
        />
      </div>

      {/* Main AG Grid Container */}
      <div className="ag-theme-quartz-dark w-full rounded-lg overflow-hidden border border-slate-800" style={{ height: '380px' }}>
        <AgGridReact<FinancialLedgerRow>
          ref={gridRef}
          rowData={filteredRows}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
            filter: true,
          }}
          rowSelection="single"
          onGridReady={onGridReady}
          onRowSelected={onRowSelected}
          rowHeight={48}
          headerHeight={40}
          animateRows={true}
          suppressCellFocus={false}
          enableCellTextSelection={true}
        />
      </div>

      {/* Inline Master/Detail Expanded Row Detail Panels (Community Full-Width Pattern) */}
      {expandedRowIds.size > 0 && (
        <div className="space-y-3 pt-2">
          {Array.from(expandedRowIds).map((mId) => {
            const rowData = ledgerRows.find((r) => r.milestoneId === mId);
            if (!rowData) return null;
            return (
              <div key={mId} className="rounded-lg overflow-hidden border border-indigo-800/80 shadow-lg">
                <EvidenceDetailPanel
                  data={rowData}
                  token={token}
                  onOpenPassport={() => onOpenPassport(mId)}
                  onOpenDisputePack={() => onOpenDisputePack(mId)}
                  onOpenAiInspector={() => onOpenAiInspector(mId)}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
