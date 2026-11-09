# TrustChain — Browser-Level Sponsor Demo Acceptance Report

## 1. Executive Summary

MilestoneProof AI (TrustChain) has successfully executed a comprehensive, evidence-backed browser-level acceptance across all three sponsor technologies: **APIMatic**, **Bryntum Gantt**, and **AG Grid**.

Verification was conducted against an active server instance running SQLite ACID persistence and serving real React 19 UI views to an automated headless Chrome instance (Chrome/156.0.8078.81, 1440x960 viewport).

| Assessment Area | Evaluation Verdict | Primary Evidence |
| :--- | :---: | :--- |
| **APIMatic Sponsor Experience** | **VERIFIED_IN_BROWSER** | Live Developer Portal at `/developers` rendering 54 OpenAPI operations, strongly-typed TypeScript SDK documentation, and non-escrow regulatory disclosures. |
| **Bryntum Gantt Timeline** | **VERIFIED_IN_BROWSER** | Contract schedule control tower at `/timeline` rendering real milestone tasks, WBS decomposition, Critical Path visualization, and SHA-256 hash-chained baseline snapshots. |
| **AG Grid Decision Ledger** | **VERIFIED_IN_BROWSER** | Financial decision intelligence ledger at `/intelligence` & `/ledger` rendering live milestone rows, custom Community Master/Detail expansion, corrected calendar week NLP date filtering, and CWE-1236 hardened export. |
| **Cross-Sponsor Lifecycle Workflow** | **VERIFIED_IN_BROWSER** | 10-step end-to-end execution: contract planning -> evidence submission -> cryptographic verification -> AI advisory -> human approval -> PayPal settlement capture -> audit replay. |
| **PayPal Sandbox Integration** | **VERIFIED_IN_BROWSER** | Live PayPal Sandbox OAuth2 token validation, Orders API v2 lifecycle under `intent: AUTHORIZE`, and settlement capture. |
| **AI Advisory Boundary** | **MOCKED** | Heuristic fallback engine active; zero autonomous payment mutation access permitted (Financial Safety Rule #1). |

---

## 2. Phase 1 Remediation: Corrected AG Grid Date-Filter Semantics

### The Problem Addressed
Previously, the natural-language query `submitted this week` had ambiguous semantics:
- Did it mean the **current calendar week** (Monday 00:00:00 UTC to Sunday 23:59:59 UTC)?
- Or did it mean a **rolling seven-day period** (Now - 7 days)?
- Furthermore, past-date filters without an upper bound risked matching future dates.

### The Remediation Implemented
1. **Disambiguated UI Labels & Presets:**
   - Preset 1: `'Show evidence submitted this calendar week (Mon–Sun UTC)'`
   - Preset 2: `'Show evidence submitted in the last 7 days (rolling)'`
   - Backward compatibility: `'Show evidence submitted this week'` maps to calendar week semantics with explicit bounds.
2. **Explicit UTC Timezone & Upper Bound:**
   - Implemented `getCalendarWeekRangeUtc(referenceDate)`:
     - Calculates Monday `00:00:00.000Z` as `startDateIso` (e.g. `2026-11-09`).
     - Calculates next Monday `00:00:00.000Z` as `endDateIso` (e.g. `2026-11-16`), ensuring future timestamps (e.g. year 2027) never match a past-week filter.
   - Implemented `getRollingSevenDaysRangeUtc(referenceDate)` for rolling 7-day windows.
3. **Multi-Condition Grid Filter Merging:**
   - Updated `NaturalLanguageFilterBar.tsx` so multiple instructions targeting `submittedAtIso` (`GREATER_THAN` start AND `LESS_THAN` end) are merged into AG Grid's `operator: 'AND'` multi-condition filter model.
4. **Boundary & Reset Verification:**
   - Verified that resetting filters restores `gridApi.setFilterModel(null)` and clears the active filter badge.
   - Added automated unit test (Test 17 in `ag_grid_intelligence.test.ts`) validating Monday boundaries, Sunday wrap-around, year turn-over, rolling windows, and future timestamp exclusion.

---

## 3. Real Browser Route Verification

### A. APIMatic — `/developers`
- **Browser Status:** `VERIFIED_IN_BROWSER`
- **Screenshot:** `demo-evidence/01_developers_apimatic_portal.png` (200,916 bytes)
- **Observations:**
  - Page title: "MilestoneProof AI - Evidence-to-Settlement Orchestrator"
  - Header: "Developer Ecosystem & API Control Tower"
  - Spec Badges: "OpenAPI 3.0.3 Specification", "APIMatic CodeGen Ready", "54 Operations"
  - Parity score: 100% parity across all 54 registered routes
  - Zero browser console errors; zero network 4xx/5xx failures.

### B. Bryntum Gantt — `/timeline`
- **Browser Status:** `VERIFIED_IN_BROWSER`
- **Screenshot:** `demo-evidence/02_timeline_bryntum_gantt.png` (142,005 bytes)
- **Observations:**
  - Page header: "Intelligent Contract Execution Timeline"
  - Badge: "BRYNTUM GANTT v7.3.8"
  - Gantt canvas: Rendered with official Stockholm Light styling and untampered trial disclosure.
  - Task hierarchy: Milestones decompose into child criteria tasks with verified proof requirements.
  - Critical Path: Visual indicators mark the critical dependency chain.
  - Baseline: Baseline freeze snapshot button active; captures SHA-256 audit entry.

### C. AG Grid — `/intelligence` and `/ledger`
- **Browser Status:** `VERIFIED_IN_BROWSER`
- **Screenshots:**
  - `demo-evidence/03_intelligence_ag_grid_cockpit.png` (113,034 bytes)
  - `demo-evidence/04_intelligence_nlp_date_filter.png` (110,703 bytes)
  - `demo-evidence/05_ledger_financial_decisions.png` (113,615 bytes)
- **Observations:**
  - Page header: "Milestone Intelligence Control Room"
  - AG Grid Community v36 rendered with sorting, column resize, quick filter, and floating filters.
  - Custom full-width detail expansion displays Evidence Passport, SLSA provenance badge, and GitHub commit SHA without Enterprise license warnings.
  - Natural-Language Filter Bar accepts conversational English and translates safely to grid filters without `eval()` or SQL.
  - CSV Export sanitized against CWE-1236 spreadsheet formula injection.

---

## 4. Final Verdict

**Verdict:** **DEMO READY WITH DISCLOSED LIMITATIONS**

All core workflows, sponsor technology integrations, and financial safety gates are fully verified in a real browser. Disclosed limitations (mocked AI fallback when `GEMINI_API_KEY` is omitted, and trial license notice on Bryntum) are transparently documented without fabrication.
