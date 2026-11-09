# Bryntum Scheduling Correctness & Algorithm Report

## 1. Overview of Algorithms

TrustChain implements deterministic scheduling algorithms inside `src/server/services/ScheduleControlTowerService.ts` to power the Bryntum Gantt view:

```
+----------------------------------------------------------------------+
|             Schedule Control Tower Core Scheduling Engine             |
|                                                                      |
|  [Contract Milestones] ---> [WBS Decomposition into Criteria Tasks]  |
|                                     |                                |
|                                     v                                |
|                     [Kahn's DAG Cycle Detection]                     |
|                                     |                                |
|                                     v                                |
|                    [Critical Path Method (CPM)]                      |
|                                     |                                |
|                                     v                                |
|                  [Downstream Delay Cascade (BFS/DFS)]                |
|                                     |                                |
|                                     v                                |
|                [Bryntum Gantt ProjectModel Task Store]               |
+----------------------------------------------------------------------+
```

---

## 2. Work Breakdown Structure (WBS) Decomposition

Milestones are decomposed into child tasks based on contractual acceptance criteria:
1. **Parent Task:** The contract milestone (e.g., `Milestone 1: Backend Foundation`). Non-leaf node with rollup duration and rollup progress.
2. **Child Tasks:** Individual criteria (e.g., `Schema Migration`, `Authentication`). Leaf nodes with:
   - `percentDone`: Calculated as `100` if cryptographic evidence verification status is `PASSED`, else `0`.
   - `requiredProofType`: Tagged with proof expectation (`CI_TESTS`, `CODE_COMMIT`, `SECURITY_SCAN`, `DEPLOYMENT_PREVIEW`).

---

## 3. Dependency Validation & Kahn's Cycle Detection

TrustChain supports all standard Bryntum dependency types:
- `Type 0`: Start-to-Start (SS)
- `Type 1`: Start-to-Finish (SF)
- `Type 2`: Finish-to-Start (FS) [Default]
- `Type 3`: Finish-to-Finish (FF)

Before saving or calculating schedules, dependencies are verified as a Directed Acyclic Graph (DAG) using **Kahn's Algorithm**:
1. In-degrees are computed for all task nodes.
2. Nodes with in-degree 0 are queued and processed.
3. If processed count is less than total nodes, a circular dependency cycle exists.
4. **Behavior on Failure:** Immediate HTTP 400 rejection with `CYCLIC_DEPENDENCY_DETECTED` and the exact list of offending task IDs, protecting the Gantt engine from infinite layout loops.

---

## 4. Critical Path Method (CPM) Implementation

The Critical Path is computed via topological sort and memoized Depth-First Search:
- **Duration Calculation:** Working days between start and end dates.
- **Earliest Start / Earliest Finish:** Forward pass across predecessor chains.
- **Latest Start / Latest Finish:** Backward pass from total project completion date.
- **Float / Slack:** `Latest Start - Earliest Start`. Tasks with `Slack == 0` belong to the Critical Path.
- **Parallel Branches:** When parallel branches merge into a milestone, the branch with the maximum cumulative duration dictates the critical path, correctly calculating positive float on parallel non-critical tracks.

---

## 5. Downstream Delay Cascade Calculation

When a milestone is delayed (e.g. CI build failure or delayed evidence submission):
- The algorithm calculates the forward impact on all successor milestones in the dependency graph.
- Successor task start dates are pushed forward by `max(0, DelayDays - Lag)`.
- If an affected successor is on the Critical Path, the contract's projected completion date slips by the exact delay delta.
- Enables the AI Advisor to propose **Schedule Recovery Plans** (e.g., fast-tracking or scope compression).
