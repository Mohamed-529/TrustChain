import React, { useMemo } from 'react';
import { BryntumGantt } from '@bryntum/gantt-react';
import type { GridColumnConfig } from '@bryntum/gantt';
import '@bryntum/gantt/gantt.css';
import '@bryntum/gantt/stockholm-light.css';

export interface BryntumGanttTaskInput {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  duration?: number;
  percentDone?: number;
  baselines?: Array<{
    startDate: string;
    endDate: string;
    name?: string;
  }>;
  baselineStartDate?: string;
  baselineEndDate?: string;
  cls?: string;
}

export interface BryntumGanttDependencyInput {
  id: string;
  from?: string;
  to?: string;
  fromEvent?: string;
  toEvent?: string;
  fromTask?: string;
  toTask?: string;
  type?: number;
  lag?: number;
}

export interface BryntumGanttViewerProps {
  tasks?: BryntumGanttTaskInput[];
  dependencies?: BryntumGanttDependencyInput[];
  readOnly?: boolean;
  height?: number | string;
}

/**
 * Representative fallback schedule dataset used when no props are provided
 * (e.g. standalone foundation testing or initial mount).
 */
export const DEFAULT_BRYNTUM_TASKS: BryntumGanttTaskInput[] = [
  {
    id: 'ms_demo_01',
    name: 'M1: Architecture Blueprint & OpenAPI 3.0.3 Contract',
    startDate: '2026-11-01',
    endDate: '2026-11-08',
    duration: 7,
    percentDone: 100,
    baselines: [
      {
        startDate: '2026-11-01',
        endDate: '2026-11-08',
        name: 'Contract Baseline',
      },
    ],
  },
  {
    id: 'ms_demo_02',
    name: 'M2: Core Settlement & Hash-Chained Audit Trail',
    startDate: '2026-11-08',
    endDate: '2026-11-18',
    duration: 10,
    percentDone: 40,
    baselines: [
      {
        startDate: '2026-11-08',
        endDate: '2026-11-15',
        name: 'Contract Baseline',
      },
    ],
  },
  {
    id: 'ms_demo_03',
    name: 'M3: Sponsor Integration (Bryntum, APIMatic, PayPal)',
    startDate: '2026-11-18',
    endDate: '2026-11-28',
    duration: 10,
    percentDone: 0,
    baselines: [
      {
        startDate: '2026-11-15',
        endDate: '2026-11-25',
        name: 'Contract Baseline',
      },
    ],
  },
];

export const DEFAULT_BRYNTUM_DEPENDENCIES: BryntumGanttDependencyInput[] = [
  {
    id: 'dep_01_02',
    fromEvent: 'ms_demo_01',
    toEvent: 'ms_demo_02',
    type: 2, // 2 = Finish-to-Start (FS)
    lag: 0,
  },
  {
    id: 'dep_02_03',
    fromEvent: 'ms_demo_02',
    toEvent: 'ms_demo_03',
    type: 2, // 2 = Finish-to-Start (FS)
    lag: 0,
  },
];

const GANTT_COLUMNS: GridColumnConfig[] = [
  { type: 'name', field: 'name', text: 'Milestone / Task', width: 280 },
  { type: 'startdate', field: 'startDate', text: 'Start Date', width: 110 },
  { type: 'enddate', field: 'endDate', text: 'End Date', width: 110 },
  { type: 'duration', field: 'duration', text: 'Duration', width: 90 },
  { type: 'percentdone', field: 'percentDone', text: '% Done', width: 90, showValue: true },
];

/**
 * Genuine Bryntum Gantt React component wrapper.
 * Displays milestone tasks, Finish-to-Start dependency links, and contract baselines.
 */
export const BryntumGanttViewer: React.FC<BryntumGanttViewerProps> = ({
  tasks,
  dependencies,
  readOnly = true,
  height = '420px',
}) => {
  const activeTasks = useMemo(() => {
    const rawList = tasks && tasks.length > 0 ? tasks : DEFAULT_BRYNTUM_TASKS;
    return rawList.map((t) => {
      const baselines =
        t.baselines && t.baselines.length > 0
          ? t.baselines
          : t.baselineStartDate && t.baselineEndDate
            ? [
                {
                  startDate: t.baselineStartDate,
                  endDate: t.baselineEndDate,
                  name: 'Contract Baseline',
                },
              ]
            : undefined;

      return {
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        duration: t.duration,
        percentDone: t.percentDone ?? 0,
        baselines,
        cls: t.cls,
      };
    });
  }, [tasks]);

  const activeDependencies = useMemo(() => {
    const rawList = dependencies && dependencies.length > 0 ? dependencies : DEFAULT_BRYNTUM_DEPENDENCIES;
    return rawList.map((d) => ({
      id: d.id,
      fromEvent: d.fromEvent ?? d.fromTask ?? d.from,
      toEvent: d.toEvent ?? d.toTask ?? d.to,
      type: d.type ?? 2,
      lag: d.lag ?? 0,
    }));
  }, [dependencies]);

  return (
    <div
      className="bryntum-gantt-container rounded-lg border border-slate-700 overflow-hidden bg-slate-900"
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
