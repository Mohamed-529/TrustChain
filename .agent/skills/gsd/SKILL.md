---
name: gsd
description: >-
  Get Shit Done (GSD) spec-driven development, project-level planning, task decomposition,
  and context preservation workflow for complex engineering phases. Enforces disciplined
  Discuss-Plan-Execute-Verify-Ship loops to prevent context rot.
---

# Get Shit Done (GSD) — Spec-Driven Engineering Workflow

Adapted from `open-gsd/gsd-core` (MIT License) for TrustChain / MilestoneProof AI.

GSD provides a disciplined, phase-based execution framework that prevents AI context rot, drifting requirements, and incomplete implementations.

---

## Non-Negotiable Integration Rule

> **GSD operates within the architectural and fiduciary boundaries defined in `AGENTS.md`. GSD plans and decomposes tasks, but does NOT replace existing project documentation, database schemas, or financial safety gates.**

---

## Core Principles

1. **Spec Before Code:** No code is written until requirements, acceptance criteria, and failure modes are explicitly specified.
2. **Context Window Hygiene:** Keep task iterations focused. Long-running sessions cause context degradation; break large phases into discrete, verifiable sub-phases.
3. **Atomic Verification:** Every sub-task must define its own automated verification check before implementation begins.
4. **State Persistence:** Project progress and decisions must be recorded in durable files (`PROJECT_STATUS.md`, phase audit reports) so context is never lost across session restarts.

---

## 5-Phase GSD Development Loop

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
│ 1. DISCUSS  │ ──> │   2. PLAN    │ ──> │  3. EXECUTE  │ ──> │  4. VERIFY   │ ──> │  5. SHIP   │
└─────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └───────────┘
```

### Phase 1: Discuss & Scope
- **Identify Goals:** What is the exact problem being solved in this phase?
- **Clarify Constraints:** Review `AGENTS.md` and domain invariants (e.g., decimal-safe integer cents, separation of duties).
- **Define Boundaries:** Explicitly declare what is **in scope** and what is **out of scope**.

### Phase 2: Plan & Decompose
- **Decompose into Steps:** Break down the feature or bug fix into small, sequential milestones (3–7 steps maximum).
- **Define Acceptance Criteria:** For each step, define binary criteria:
  - Input/Output specifications.
  - Required tests (unit, integration, error paths).
- **Map Dependencies:** Identify affected components (repositories, controllers, frontend hooks).

### Phase 3: Execute (Focused Implementation)
- **Implement One Step at a Time:** Do not attempt multi-step leaps.
- **Consult Ponytail:** Enforce code restraint—reuse existing helpers, repositories, and domain models before introducing new abstractions.
- **Preserve Documentation:** Retain existing comments, docstrings, and audit histories.

### Phase 4: Verify (Deterministic Proof)
- **Run Full Validation Suite:**
  - Automated tests: `npm test`
  - Type checking: `npm run lint` (`tsc --noEmit`)
  - Production bundling: `npm run build` (`vite build`)
- **Negative & Boundary Testing:** Verify that invalid inputs, missing assets, and unauthorized roles are rejected.
- **Never Assume:** A task is not verified until the automated command exits with code 0.

### Phase 5: Ship & Persist
- **Update Documentation:** Update `PROJECT_STATUS.md` with completed milestones and verified metrics.
- **Create Conventional Commit:** Make logical, well-structured commits (e.g., `feat(...)`, `fix(...)`).
- **Audit Logging:** If system runtime states were modified, ensure hash-chained audit trails reflect the transition.

---

## Context Preservation Standard

To preserve context between sessions or after context truncations:
1. **Source of Truth:** Always read `AGENTS.md`, `PROJECT_STATUS.md`, and the latest phase audit report at the start of any new session.
2. **Phase Status Check:** Inspect Git commit history and working tree before making assumptions about what has been implemented.
3. **No Hallucinated Progress:** Only mark steps as complete if their implementation exists on disk and passes automated tests.
