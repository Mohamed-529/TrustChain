---
name: test-driven-development
description: >-
  Strict test-driven development (TDD) workflow enforcing the RED-GREEN-REFACTOR cycle.
  Use when implementing new features, fixing bugs, or modifying domain logic to guarantee
  test coverage, prevent regressions, and verify behavior against specifications before coding.
---

# Test-Driven Development (TDD) Workflow

Adapted from `obra/superpowers` (MIT License) for MilestoneProof AI.

This skill guides feature implementation and bug remediation through disciplined test-first engineering, ensuring high code quality, verifiable contracts, and zero unintentional regressions.

---

## The Three Laws of TDD

1. **You may not write any production code until you have written a failing test.**
2. **You may not write more of a test than is sufficient to fail; and not compiling or throwing assertion error is failing.**
3. **You may not write more production code than is sufficient to pass the currently failing test.**

---

## The RED-GREEN-REFACTOR Cycle

```
  ┌───────────────┐
  │   1. RED      │ ◄── Write a failing test matching requirement
  └───────┬───────┘
          │ (Verify failure reason matches expectation)
          ▼
  ┌───────────────┐
  │   2. GREEN    │ ◄── Write minimal code to pass test
  └───────┬───────┘
          │ (Verify all tests pass)
          ▼
  ┌───────────────┐
  │  3. REFACTOR  │ ◄── Clean code, remove duplication, verify types
  └───────┬───────┘
          │ (Verify test suite remains 100% green)
          └───────► Repeat for next requirement
```

### Step 1: RED (Write the Test First)
- Identify the smallest next unit of requirement from the feature specification or bug report.
- Write a clean, readable test expressing that requirement in the appropriate test suite (e.g., `src/server/__tests__/`).
- Execute the test runner:
  ```bash
  npm test
  ```
- **Verify Failure:** The test MUST fail. Inspect the failure message to ensure it failed for the exact expected reason (e.g., method does not exist, assertion failed on missing field), NOT due to an accidental typo, syntax error, or harness bug.

### Step 2: GREEN (Make It Pass)
- Write the minimal amount of code necessary in the implementation file to satisfy the failing test.
- Do not anticipate future requirements or over-engineer abstractions.
- Execute the test runner:
  ```bash
  npm test
  ```
- Verify that the new test and all previously passing tests now pass cleanly.

### Step 3: REFACTOR (Improve Quality)
- Review the code just written for:
  - Code clarity, naming conventions, and docstrings.
  - Elimination of duplicate logic or hardcoded literals.
  - Adherence to architectural separation of concerns (controller vs service vs repository).
  - Strict TypeScript types (no `any`, no unhandled optional fields).
- Re-run the full test suite and type-checker to ensure refactoring introduced no regressions:
  ```bash
  npm run lint
  npm test
  ```

---

## Critical Rules for Financial & Security Code

- **Never mock calculations in policy engine tests:** Use real deterministic integer-cent calculations to verify mathematical invariants.
- **Always assert state transitions:** Verify that unauthorized or premature actions return appropriate HTTP error codes and leave database state unchanged.
- **Include negative and boundary cases:** Test invalid inputs, zero/negative amounts, expired tokens, and duplicate idempotency keys.
