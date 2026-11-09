# Sponsor Demo Readiness Checklist & Walkthrough Scripts

This guide provides fast, self-contained walkthrough scripts (60–90 seconds each) designed specifically for hackathon judges and sponsor evaluators.

---

## 1. APIMatic Sponsor Walkthrough (60 Seconds)

### Objective:
Demonstrate API contract quality, OpenAPI 3.0.3 completeness, SDK integration, and AI agent security.

1. **Open Developer Portal:**
   - Navigate to `/developers` in the browser.
   - Point out the live API specification badges: **OpenAPI 3.0.3**, **54 Endpoints**, **100% Parity**.
2. **Inspect Interactive Spec:**
   - Click "OpenAPI Spec YAML" or "JSON" tab.
   - Show strongly-typed currency representation in 64-bit integer cents (`integer`, format: `int64`) with non-escrow notice.
3. **Execute SDK in Code / Dev Console:**
   - Show `src/sdk/MilestoneProofClient.ts`: 54 methods with automatic retries on 408/429/502/503/504 and `MilestoneProofApiError` deserialization.
4. **Demonstrate AI Agent Tool Guard:**
   - Open `src/agent/TrustChainAgentTools.ts`.
   - Point out the 10 tool manifests: 7 read-only permitted tools, 3 financial mutation tools strictly blocked under **Financial Safety Rule #1** with `FIDUCIARY_BOUNDARY_ENFORCED`.

---

## 2. Bryntum Gantt Sponsor Walkthrough (60 Seconds)

### Objective:
Demonstrate how Bryntum Gantt serves as an intelligent, evidence-aware schedule control tower.

1. **Navigate to Timeline View:**
   - Switch persona to `Client` or `Reviewer`.
   - Navigate to `/contracts/contract_seed_01/timeline` (or Timeline tab).
2. **Inspect WBS Decomposition:**
   - Expand `Milestone 1: Backend Foundation`.
   - Show child acceptance criteria tasks (`Schema Migration`, `Authentication`).
   - Highlight that task `percentDone` is driven 100% by cryptographic verification records, not manual slider guesses.
3. **Toggle Critical Path & Zoom:**
   - Click the "Critical Path" button on toolbar -> Critical path bars illuminate with amber borders.
   - Click "Day / Week / Month" zoom controls to show smooth time axis scaling.
4. **Demonstrate Delay Impact Cascade & Baseline Freeze:**
   - Click "Freeze Baseline" -> Generates SHA-256 hash-chained audit record.
   - Simulate a 5-day delay on Milestone 1 -> Show cascading delay shift automatically calculated across successor milestones.

---

## 3. AG Grid Sponsor Walkthrough (60 Seconds)

### Objective:
Demonstrate financial decision intelligence, custom Community Master/Detail expansion, natural-language filtering, and CWE-1236 protection.

1. **Navigate to Financial Ledger:**
   - Navigate to `/ledger` (Financial Decision Intelligence Ledger).
   - Point out the AG Grid Community v36 implementation with floating filters, sortable headers, and status badges.
2. **Demonstrate Natural-Language Query Bar:**
   - In the NLP query input, type: `high risk` -> Grid filters instantly to critical risk milestones.
   - Type: `submitted this week` -> Grid applies an exact date range filter on `submittedAtIso` without backend lag.
3. **Demonstrate Custom Full-Width Master/Detail:**
   - Click the chevron on Milestone 1 row -> Custom full-width detail panel smoothly expands.
   - Show embedded Evidence Passport, SLSA provenance badge, and GitHub commit hash without requiring AG Grid Enterprise!
4. **Demonstrate Sanitized CSV Export:**
   - Click "Export Ledger CSV" -> Download ledger file.
   - Open or inspect file: All cell values starting with `=, +, -, @` are prepended with `'` (CWE-1236 immune), and internal secrets are 100% stripped.

---

## 4. Unified End-to-End Sponsor Walkthrough (90 Seconds)

### The Complete Journey:
1. **Planning (Bryntum):** Start at Timeline -> Show milestones, WBS criteria, dependencies, and frozen baseline.
2. **Execution (APIMatic):** Developer submits evidence via typed SDK `submitMilestoneEvidence()` -> Verified by automated tests.
3. **Intelligence (AG Grid):** Reviewer queries ledger via Natural Language -> Expands Evidence Passport detail panel to verify SLSA provenance.
4. **Settlement (PayPal + APIMatic):** Reviewer approves eligible amount calculated by Deterministic Policy -> PayPal sandbox captures funds under `intent: AUTHORIZE`.
5. **Verification (Audit Replay):** Verify SHA-256 hash chain -> Whole lifecycle is cryptographically sealed and verified!
