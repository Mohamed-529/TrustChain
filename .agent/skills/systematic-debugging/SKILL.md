---
name: systematic-debugging
description: >-
  Systematic debugging and root-cause analysis workflow for investigating defects,
  failing tests, and unexpected runtime behaviors. Enforces a strict 4-phase investigation
  process (reproduce, hypothesize, isolate, verify) and forbids symptom-patching or
  making code changes without a confirmed root cause.
---

# Systematic Debugging Workflow

Adapted from `obra/superpowers` (MIT License) for MilestoneProof AI.

This skill establishes a disciplined, scientific debugging process. It prevents trial-and-error edits, symptom masking, and premature code modifications.

---

## The Core Rule

> **Never modify production code until you have formulated a hypothesis, verified it against evidence, and reproduced the failure with a deterministic test case.**

---

## 4-Phase Debugging Process

### Phase 1: Defect Characterization & Minimal Reproduction
1. **Gather Concrete Evidence:**
   - Record the exact error message, stack trace, and exit code.
   - Identify the exact inputs, environment variables, and database state when the failure occurred.
2. **Build Minimal Deterministic Reproduction:**
   - Construct a minimal automated test or standalone Node.js reproduction script.
   - Eliminate unrelated components, mock external APIs where appropriate, and isolate the failing code path.
   - Run the reproduction to confirm it fails consistently with the expected error.

### Phase 2: Hypothesis Formulation & Scientific Instrumentation
1. **Trace the Execution Flow:**
   - Follow the call stack from the initial entry point to the divergence point where actual behavior diverged from expected behavior.
2. **Formulate Explicit Hypotheses:**
   - State clearly: *"I hypothesize that component X fails because variable Y is null when condition Z occurs."*
   - Avoid vague hunches like *"Maybe it's an async issue."*
3. **Test the Hypothesis Non-Destructively:**
   - Add targeted logging, assertions, or inspect variables in the execution path.
   - Do NOT start editing production logic yet.
   - Confirm or refute the hypothesis with verifiable data.

### Phase 3: Root-Cause Isolation
1. **Identify the Underlying Mechanism:**
   - Determine whether the root cause is:
     - A logic error (e.g., incorrect branch condition, off-by-one, unhandled edge case).
     - A type/schema mismatch (e.g., missing property in object mapping, incorrect casing).
     - A concurrency/ordering race condition (e.g., out-of-order events, un-awaited Promise).
     - An invariant violation (e.g., state transition attempted from invalid state).
2. **Distinguish Root Cause from Symptoms:**
   - Do not fix the symptom where the crash manifests if the invalid state originated earlier in the pipeline.

### Phase 4: Targeted Fix & Regression Verification
1. **Implement Minimal Surgical Fix:**
   - Apply the simplest, most direct fix that directly addresses the isolated root cause.
   - Preserve existing coding conventions, comments, and architecture boundaries.
2. **Verify Reproduction Test Passes:**
   - Run the reproduction test and confirm it now passes (turns GREEN).
3. **Run Full Regression Suite:**
   - Execute the entire project test suite (`npm test`).
   - Run linter / type-checker (`npm run lint`).
   - Confirm that no existing invariants or features were broken.

---

## Prohibited Practices

- **No Shotgun Debugging:** Never make multiple speculative edits hoping one will fix the problem.
- **No Symptom Masking:** Never add a `catch (err) {}` block or `if (val === undefined) return;` without understanding why the value was undefined.
- **No Uninstrumented Edits:** If you cannot explain why a change works, do not commit it.
- **No Premature Optimization:** Focus exclusively on correctness and root-cause resolution.
