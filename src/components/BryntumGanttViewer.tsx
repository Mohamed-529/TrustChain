import React, { useMemo } from 'react';
import { BryntumGantt } from '@bryntum/gantt-react';
import type { GridColumnConfig } from '@bryntum/gantt';
import type {
  ContractScheduleDependency,
  ContractScheduleResponse,
  ContractScheduleTask,
} from '../types/domain.ts';
import '@bryntum/gantt/gantt.css';
import '@bryntum/gantt/stockholm-light.css';

export interface BryntumGanttViewerProps {
  schedule?: ContractScheduleResponse | null;
  tasks?: ContractScheduleTask[];
  dependencies?: ContractScheduleDependency[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  readOnly?: boolean;
  height?: number | string;
}

/**
 * Fallback representative schedule dataset used when no props are provided
 * (e.g. standalone test mode or empty state demo).
 */
export const DEFAULT_BRYNTUM_TASKS: ContractScheduleTask[] = [
  {
    id: 'ms_demo_01',
    milestoneId: 'ms_demo_01',
    sequenceOrder: 1,
    name: 'M1: Architecture Blueprint & OpenAPI 3.0.3 Contract',
    startDate: '2026-11-01',
    endDate: '2026-11-08',
    duration: 7,
    durationUnit: 'day',
    percentDone: 100,
    baselineStartDate: '2026-11-01',
    baselineEndDate: '2026-11-08',
    baselines: [
      {
        startDate: '2026-11-01',
        endDate: '2026-11-08',
        label: 'Contract Baseline',
      },
    ],
    actualSubmittedAt: '2026-11-07T12:00:00Z',
    status: 'APPROVED',
    paymentStatus: 'AUTHORIZED',
    scheduleHealth: 'COMPLETED',
    critical: true,
    isOverdue: false,
    isAtRisk: false,
    isBlockedByDependency: false,
    blockingMilestoneIds: [],
    lateDays: 0,
    baselineVarianceDays: 0,
    agreedAmountCents: 500000,
    permittedAmountCents: 500000,
    approvedAmountCents: 500000,
    assignedDeveloperId: 'usr_dev_01',
    assignedDeveloperName: 'Lead Engineer',
    evidenceStatus: 'VERIFIED',
    ciStatus: 'SUCCESS',
    evaluationStatus: 'COMPLETED',
    riskSeverity: 'LOW',
    evidenceReferences: ['ev_commit_01', 'ev_pr_01'],
    riskExplanation: 'Verified against canonical repository commits and clean CI artifacts.',
  },
  {
    id: 'ms_demo_02',
    milestoneId: 'ms_demo_02',
    sequenceOrder: 2,
    name: 'M2: Core Settlement & Hash-Chained Audit Trail',
    startDate: '2026-11-08',
    endDate: '2026-11-18',
    duration: 10,
    durationUnit: 'day',
    percentDone: 40,
    baselineStartDate: '2026-11-08',
    baselineEndDate: '2026-11-15',
    baselines: [
      {
        startDate: '2026-11-08',
        endDate: '2026-11-15',
        label: 'Contract Baseline',
      },
    ],
    actualSubmittedAt: '2026-11-18T10:00:00Z',
    status: 'SUBMITTED',
    paymentStatus: 'AUTHORIZED',
    scheduleHealth: 'OVERDUE',
    critical: true,
    isOverdue: true,
    isAtRisk: true,
    isBlockedByDependency: false,
    blockingMilestoneIds: [],
    lateDays: 3,
    baselineVarianceDays: 3,
    agreedAmountCents: 750000,
    permittedAmountCents: null,
    approvedAmountCents: null,
    assignedDeveloperId: 'usr_dev_01',
    assignedDeveloperName: 'Lead Engineer',
    evidenceStatus: 'SUBMITTED',
    ciStatus: 'FAILURE',
    evaluationStatus: 'COMPLETED',
    riskSeverity: 'HIGH',
    evidenceReferences: ['ev_commit_02', 'ev_ci_fail_02'],
    riskExplanation: 'Unit tests failed; late penalty applies; AI Recovery Proposal generated.',
  },
  {
    id: 'ms_demo_03',
    milestoneId: 'ms_demo_03',
    sequenceOrder: 3,
    name: 'M3: Sponsor Integration (Bryntum, APIMatic, PayPal)',
    startDate: '2026-11-18',
    endDate: '2026-11-28',
    duration: 10,
    durationUnit: 'day',
    percentDone: 0,
    baselineStartDate: '2026-11-15',
    baselineEndDate: '2026-11-25',
    baselines: [
      {
        startDate: '2026-11-15',
        endDate: '2026-11-25',
        label: 'Contract Baseline',
      },
    ],
    actualSubmittedAt: null,
    status: 'ACTIVE',
    paymentStatus: 'NOT_READY',
    scheduleHealth: 'BLOCKED_BY_DEPENDENCY',
    critical: true,
    isOverdue: false,
    isAtRisk: true,
    isBlockedByDependency: true,
    blockingMilestoneIds: ['ms_demo_02'],
    lateDays: 0,
    baselineVarianceDays: 3,
    agreedAmountCents: 750000,
    permittedAmountCents: null,
    approvedAmountCents: null,
    assignedDeveloperId: 'usr_dev_01',
    assignedDeveloperName: 'Lead Engineer',
    evidenceStatus: 'NONE',
    ciStatus: 'NONE',
    evaluationStatus: 'NONE',
    riskSeverity: 'NONE',
    evidenceReferences: [],
    riskExplanation: 'Blocked by Finish-to-Start dependency on Milestone 2 completion.',
  },
];

export const DEFAULT_BRYNTUM_DEPENDENCIES: ContractScheduleDependency[] = [
  {
    id: 'dep_ms_demo_01_ms_demo_02',
    fromTask: 'ms_demo_01',
    toTask: 'ms_demo_02',
    fromEvent: 'ms_demo_01',
    toEvent: 'ms_demo_02',
    type: 2, // 2 = Finish-to-Start (FS) in Bryntum Gantt
    lag: 0,
    lagUnit: 'day',
    isBlocking: false,
  },
  {
    id: 'dep_ms_demo_02_ms_demo_03',
    fromTask: 'ms_demo_02',
    toTask: 'ms_demo_03',
    fromEvent: 'ms_demo_02',
    toEvent: 'ms_demo_03',
    type: 2, // 2 = Finish-to-Start (FS) in Bryntum Gantt
    lag: 0,
    lagUnit: 'day',
    isBlocking: true,
  },
];

function formatUsdCents(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || Number.isNaN(cents)) {
    return '$0.00';
  }
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

function normalizeDateStr(isoStr: string | null | undefined): string {
  if (!isoStr) return new Date().toISOString().slice(0, 10);
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toISOString().slice(0, 10);
  } catch {
    return String(isoStr);
  }
}

const GANTT_COLUMNS: GridColumnConfig[] = [
  { type: 'name', field: 'name', text: 'Milestone / Task', width: 260 },
  { type: 'startdate', field: 'startDate', text: 'Start Date', width: 105 },
  { type: 'enddate', field: 'endDate', text: 'Deadline', width: 105 },
  { type: 'duration', field: 'duration', text: 'Duration', width: 80 },
  { type: 'percentdone', field: 'percentDone', text: '% Done', width: 80, showValue: true },
  {
    text: 'Health',
    field: 'scheduleHealth',
    width: 130,
    renderer: (renderData: any) => {
      const record = renderData?.record;
      const h = record?.scheduleHealth ?? (record?.get ? record.get('scheduleHealth') : 'ON_TRACK') ?? 'ON_TRACK';
      const color =
        h === 'COMPLETED'
          ? '#10b981'
          : h === 'OVERDUE'
            ? '#f43f5e'
            : h === 'AT_RISK'
              ? '#f59e0b'
              : h === 'BLOCKED_BY_DEPENDENCY'
                ? '#a855f7'
                : '#3b82f6';
      return `<span style="font-weight:700;color:${color};text-transform:uppercase;font-size:11px;">${h}</span>`;
    },
  },
  {
    text: 'Agreed Budget',
    field: 'agreedAmountCents',
    width: 110,
    renderer: (renderData: any) => {
      const record = renderData?.record;
      const cents = record?.agreedAmountCents ?? (record?.get ? record.get('agreedAmountCents') : 0);
      return `<span style="font-family:monospace;font-weight:600;color:#e2e8f0;">${formatUsdCents(cents)}</span>`;
    },
  },
  {
    text: 'Variance',
    field: 'baselineVarianceDays',
    width: 85,
    renderer: (renderData: any) => {
      const record = renderData?.record;
      const v = record?.baselineVarianceDays ?? (record?.get ? record.get('baselineVarianceDays') : 0) ?? 0;
      if (v > 0) {
        return `<span style="color:#f43f5e;font-weight:700;font-family:monospace;">+${v}d</span>`;
      }
      return `<span style="color:#64748b;font-family:monospace;">0d</span>`;
    },
  },
];

/**
 * Genuine Bryntum Gantt React component wrapper.
 * Connects the real backend schedule response to Bryntum Gantt with dual baselines,
 * Finish-to-Start dependency arrows, critical path detection, and health indicators.
 */
export const BryntumGanttViewer: React.FC<BryntumGanttViewerProps> = ({
  schedule,
  tasks,
  dependencies,
  isLoading = false,
  error = null,
  onRetry,
  readOnly = true,
  height = '480px',
}) => {
  const activeTasks = useMemo(() => {
    const rawList =
      tasks && tasks.length > 0
        ? tasks
        : schedule?.tasks && schedule.tasks.length > 0
          ? schedule.tasks
          : DEFAULT_BRYNTUM_TASKS;

    return rawList.map((t) => {
      const startDate = normalizeDateStr(t.startDate);
      const endDate = normalizeDateStr(t.endDate);
      const baselineStart = normalizeDateStr(t.baselineStartDate ?? t.startDate);
      const baselineEnd = normalizeDateStr(t.baselineEndDate ?? t.endDate);

      const baselines =
        t.baselines && t.baselines.length > 0
          ? t.baselines.map((b) => ({
              startDate: normalizeDateStr(b.startDate),
              endDate: normalizeDateStr(b.endDate),
              name: b.label ?? 'Contract Baseline',
            }))
          : [
              {
                startDate: baselineStart,
                endDate: baselineEnd,
                name: 'Contract Baseline',
              },
            ];

      return {
        id: t.id ?? t.milestoneId,
        milestoneId: t.milestoneId ?? t.id,
        name: t.name,
        startDate,
        endDate,
        duration: Math.max(1, t.duration ?? 1),
        durationUnit: 'day',
        percentDone: Math.min(100, Math.max(0, t.percentDone ?? 0)),
        baselines,
        scheduleHealth: t.scheduleHealth ?? 'ON_TRACK',
        agreedAmountCents: t.agreedAmountCents ?? 0,
        baselineVarianceDays: t.baselineVarianceDays ?? 0,
        critical: Boolean(t.critical),
        cls: `health-${(t.scheduleHealth ?? 'on_track').toLowerCase()}`,
      };
    });
  }, [schedule, tasks]);

  const activeDependencies = useMemo(() => {
    const rawDeps =
      dependencies && dependencies.length > 0
        ? dependencies
        : schedule?.dependencies && schedule.dependencies.length > 0
          ? schedule.dependencies
          : DEFAULT_BRYNTUM_DEPENDENCIES;

    return rawDeps.map((d) => ({
      id: d.id,
      fromEvent: d.fromEvent ?? d.fromTask,
      toEvent: d.toEvent ?? d.toTask,
      type: d.type ?? 2, // 2 = Finish-to-Start (FS)
      lag: d.lag ?? 0,
      lagUnit: 'day',
    }));
  }, [schedule, dependencies]);

  if (isLoading) {
    return (
      <div
        className="rounded-lg border border-slate-800 bg-slate-950 p-8 flex flex-col items-center justify-center text-center space-y-3"
        style={{ height }}
      >
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-sm font-semibold text-slate-200">
          Loading Contract Delivery Schedule...
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Synchronizing Bryntum ProjectModel with SQLite milestone baselines and dependencies.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-6 flex flex-col items-center justify-center text-center space-y-3"
        style={{ height }}
      >
        <div className="text-rose-400 font-bold text-sm">Failed to Load Schedule Data</div>
        <div className="text-xs text-rose-300 font-mono max-w-lg">{error}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors"
          >
            Retry Schedule Synchronization
          </button>
        )}
      </div>
    );
  }

  if (activeTasks.length === 0) {
    return (
      <div
        className="rounded-lg border border-slate-800 bg-slate-950 p-8 flex flex-col items-center justify-center text-center space-y-2"
        style={{ height }}
      >
        <div className="text-sm font-semibold text-slate-300">No Milestones or Schedule Found</div>
        <div className="text-xs text-slate-500">
          This contract has no active milestones. Create milestones to visualize the Gantt delivery timeline.
        </div>
      </div>
    );
  }

  return (
    <div
      className="bryntum-gantt-root rounded-lg border border-slate-800 overflow-hidden bg-slate-950 shadow-2xl"
      style={{ height, width: '100%' }}
    >
      <BryntumGantt
        tasks={activeTasks}
        dependencies={activeDependencies}
        columns={GANTT_COLUMNS}
        viewPreset="weekAndDayLetter"
        barMargin={6}
        rowHeight={44}
        readOnly={readOnly}
        baselinesFeature={{ disabled: false }}
        dependenciesFeature={{ disabled: false }}
        criticalPathsFeature={{ disabled: false }}
        taskTooltipFeature={{ disabled: false }}
      />
    </div>
  );
};

export default BryntumGanttViewer;
