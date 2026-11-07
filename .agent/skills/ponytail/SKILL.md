---
name: ponytail
description: >-
  Pragmatic engineering ruleset and code restraint workflow to prevent AI overengineering,
  unnecessary abstractions, and dependency bloat. Enforces the 7-rung decision ladder
  while strictly preserving all security, testing, and financial invariants.
---

# Ponytail — Code Restraint & Anti-Bloat Engineering Workflow

Adapted from Ponytail (Dietrich Gebert / MIT License) for TrustChain / MilestoneProof AI.

**Core Philosophy:** *"The best code is the code you never wrote."*

AI coding assistants frequently overengineer: generating unnecessary wrapper classes, adding external npm dependencies for trivial utilities, and creating deep inheritance hierarchies where a simple function would suffice. Ponytail enforces discipline and restraint.

---

## Non-Negotiable Safety Invariant

> [!IMPORTANT]
> **Code restraint NEVER compromises security, financial safety, or test coverage.**
> - Do NOT delete input validation, RBAC checks, or CSRF/HMAC verifications to reduce code length.
> - Do NOT simplify deterministic financial calculations (integer cents, penalty caps).
> - Do NOT delete tests or assertions.
> - Ponytail eliminates **accidental complexity and redundant boilerplate**, never essential fiduciary controls.

---

## The 7-Rung Decision Ladder

Before writing any new code, class, service, or dependency, evaluate this ladder top-to-bottom:

```
┌────────────────────────────────────────────────────────────┐
│ 1. Does this feature/code need to exist at all?             │ ──> If NO: Drop it.
├────────────────────────────────────────────────────────────┤
│ 2. Does an existing service/repository already solve this? │ ──> If YES: Reuse it.
├────────────────────────────────────────────────────────────┤
│ 3. Does the Node.js / TypeScript standard library solve it? │ ──> If YES: Use crypto, path, fs, URL.
├────────────────────────────────────────────────────────────┤
│ 4. Can an already-installed dependency handle this?        │ ──> If YES: Use express, vite, lucide.
├────────────────────────────────────────────────────────────┤
│ 5. Can a standard native platform or HTML/CSS solve this?   │ ──> If YES: Use native flexbox/grid.
├────────────────────────────────────────────────────────────┤
│ 6. Can it be written in a simple, readable 5-line function?│ ──> If YES: Write a simple function.
├────────────────────────────────────────────────────────────┤
│ 7. ONLY THEN: Write new modular, isolated code.             │
└────────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns Strictly Forbidden

1. **Premature Abstraction:** Do not create abstract factories, generic repository interfaces, or complex generic wrappers for a single concrete implementation.
2. **Dependency Creep:** Do not run `npm install <package>` for simple utility logic (e.g. date formatting, string manipulation, sha256 hashing). Node.js native `crypto`, `Intl.DateTimeFormat`, and standard methods must be used.
3. **Duplication of Domain Logic:** If a query or validation exists in `DomainRepositories.ts` or `ContractService.ts`, do NOT re-implement it in a controller. Call the existing service method.
4. **Deep Prop Drilling in UI:** Reuse existing typed state and clean props rather than introducing external global state libraries (e.g., Redux, MobX).

---

## Code Debt Tagging Convention

When a pragmatic simplification is made, or when temporary hackathon code is intentionally kept minimal, tag the location with a clear comment:

```typescript
// ponytail: simplified in-memory cache used instead of Redis; acceptable for single-node modular monolith
```

This ensures future engineers can audit intentional design trade-offs without losing context.
