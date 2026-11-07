---
name: ralph-loop
description: >-
  Bounded autonomous execution loop for repetitive, test-driven iteration. Enforces strict
  maximum iteration limits, hard failure stop conditions, and mandatory human checkpoints
  for financial and settlement operations.
---

# Ralph Loop — Bounded Iterative Engineering Harness

Adapted from the Ralph Wiggum / Autonomous Agent Loop pattern for TrustChain / MilestoneProof AI.

The Ralph Loop provides structured, bounded iteration for executing task lists and resolving test failures without runaway execution, context drift, or unauthorized financial state mutations.

---

## MANDATORY FIDUCIARY SAFEGUARDS (STRICT RULES)

> [!CAUTION]
> 1. **BOUNDED LOOPS ONLY:** The loop MUST NEVER run indefinitely. Maximum iterations per session is **5 iterations**. If tasks are incomplete after 5 iterations, STOP and report progress to the human user.
> 2. **NO FINANCIAL AUTO-APPROVAL:** The loop MUST NEVER automatically approve milestones, authorize payments, capture funds, or modify settlement policy formulas.
> 3. **NO AUTOMATIC PUSHING:** The loop MUST NEVER execute `git push` autonomously. Pushing code to `origin/main` requires explicit user confirmation.
> 4. **HARD STOP ON CONSECUTIVE FAILURES:** If the same test fails across **2 consecutive iterations** without progress, the loop MUST STOP immediately and engage the `systematic-debugging` skill.
> 5. **VERIFICATION BEFORE COMPLETION:** The agent can NEVER declare a task complete without executing `npm test` and `npm run lint` and confirming exit code 0.

---

## Execution Loop Architecture

```
       ┌───────────────────────────────┐
       │   Initialize Bounded Task     │
       │     (Max 5 Iterations)        │
       └──────────────┬────────────────┘
                      │
                      ▼
       ┌───────────────────────────────┐
       │  Step 1: Check Invariants     │ <───────┐
       │  & Fiduciary Boundaries       │         │
       └──────────────┬────────────────┘         │
                      │                          │
                      ▼                          │
       ┌───────────────────────────────┐         │
       │  Step 2: RED Phase            │         │
       │  (Failing Test Assertion)     │         │
       └──────────────┬────────────────┘         │
                      │                          │
                      ▼                          │
       ┌───────────────────────────────┐         │ (Iterate if < 5
       │  Step 3: GREEN Phase          │         │  and tests fail)
       │  (Minimal Code via Ponytail)  │         │
       └──────────────┬────────────────┘         │
                      │                          │
                      ▼                          │
       ┌───────────────────────────────┐         │
       │  Step 4: Execute Full Tests   │ ────────┘
       │  (npm test + npm run lint)    │
       └──────────────┬────────────────┘
                      │ (All 43+ tests pass)
                      ▼
       ┌───────────────────────────────┐
       │  Step 5: Human Checkpoint     │
       │  (Status Report & Stop)       │
       └───────────────────────────────┘
```

---

## Step-by-Step Loop Protocol

### 1. Loop Initialization
- Read current task state from `PROJECT_STATUS.md` or user request.
- Set iteration counter: `iteration = 1; maxIterations = 5`.
- Verify Git working tree status.

### 2. Guardrails Preflight
- Is this task attempting to modify financial logic?
  - If YES: Verify that settlement policy arithmetic remains integer cents and human approval gates are NOT bypassed.
- Is this task attempting to capture PayPal payments?
  - If YES: HALT IMMEDIATELY. Only an authenticated human reviewer via the API/UI can trigger capture.

### 3. Test-Driven Iteration
- Formulate the minimal failing test case.
- Write minimal, focused code (following `ponytail` guidelines).
- Execute `npm test`.

### 4. Stop Conditions (Evaluation)
Halt the loop immediately if any of the following occur:
- **Condition A (Success):** All tests pass, lint is clean, build succeeds. Proceed to Step 5.
- **Condition B (Iteration Limit):** `iteration >= 5`. Stop and report current state to the user.
- **Condition C (Repeated Failure):** Same assertion fails twice consecutively. Trigger `systematic-debugging`.
- **Condition D (Ambiguity):** Requirements conflict or financial invariants are threatened. Stop and ask the user for clarification.

### 5. Completion Checkpoint
- Present the exact tests run, files changed, and outcomes.
- Request user review before creating commits or advancing phases.
