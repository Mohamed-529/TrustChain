# PROMPT 6 — FRONTEND ARCHITECTURE SPECIFICATION
## MilestoneProof AI Intelligence Control Room & AG Grid Foundation

**Date:** 2026-11-08  
**Repository:** `Mohamed-529/TrustChain`  
**Branch:** `main`  
**Author:** Google Antigravity  
**Governing Standard:** Hackathon-ready is not market-ready. Production readiness is claimed only when verified by real integrations, security checks, and deterministic validations. Features must earn their place.

---

## 1. Existing Frontend Architecture & Capabilities

TrustChain's existing frontend is built with **React 19 + TypeScript + Vite + Tailwind CSS**, currently centered in `src/App.tsx` (1,426 lines):

### Existing Components & Subsystems
1. **Persona Authentication Switcher:**
   - Toggles active sessions among `client_01` (Elena Vance), `dev_01` (Marcus Chen), and `reviewer_01` (Sophia Sterling) via `POST /api/v1/auth/demo-switch`.
2. **Bryntum Gantt Delivery Control Tower (`src/components/BryntumGanttViewer.tsx`):**
   - Renders contractual milestone timelines, baseline schedules, Finish-to-Start dependencies (`type: 2`), and AI schedule-risk recovery proposals.
3. **Evidence Passport Viewer (`src/components/EvidencePassportViewer.tsx`):**
   - Displays cryptographic evidence graphs, commit signatures, CI telemetry, SLSA provenance, and SSRF-guarded runtime preview tests.
4. **Dispute Evidence Pack Viewer (`src/components/DisputeEvidencePackViewer.tsx`):**
   - Provides two-stage non-circular SHA-256 digest validation, audit-replay verification, and sanitized JSON package exports.
5. **Financial Decision Ledger:**
   - Fetches `GET /api/v1/ledger` and displays milestone financial and audit states in a basic HTML `<table>`.
6. **Authoritative PayPal Settlement Workflow:**
   - Multi-step client authorization hold (`intent: AUTHORIZE`) and reviewer human capture workflow with server-side validation.

---

## 2. Identified Gaps & Objectives for Prompt 6

| Area | Current State | Required Market-Grade Evolution |
| :--- | :--- | :--- |
| **Milestone Investigation** | Single milestone selected via isolated buttons (`ms_seed_01`, `02`, `03`). | Unified, multi-dimensional **AG Grid Milestone Intelligence Control Room** showing all contract milestones simultaneously. |
| **Financial Ledger** | Static, unfilterable HTML `<table>`. | Interactive AG Grid ledger with column sorting, floating filters, column resizing/pinning, and state persistence. |
| **Master/Detail Evidence** | Fragmented across individual cards below the main view. | Integrated **Master/Detail expandable row model** showing Git commits, PRs, CI runs, deployment previews, and audit logs. |
| **Executive Intelligence** | No top-level portfolio summary. | Operational **Intelligence Dashboard** summarizing active contracts, delivery progress, overdue tasks, and pending settlement exposure. |
| **Natural-Language Search** | Not implemented. | **Natural-Language Grid Query Translator**: converts human questions into typed, whitelisted AG Grid filter/sort models with user preview & apply. |
| **AI Advisory Boundary** | Advisory tags present in cards. | Dedicated **AI Decision Inspector** making crystal clear that AI evaluations are strictly non-authoritative recommendations. |

---

## 3. Proposed Component Structure

```
src/
├── components/
│   ├── ag-grid/
│   │   ├── MilestoneIntelligenceGrid.tsx     # Primary AG Grid component (Community Edition)
│   │   ├── EvidenceDetailPanel.tsx           # Master/Detail row expansion for deep evidence inspection
│   │   ├── NaturalLanguageFilterBar.tsx      # Safe NLP query parser with review & apply dialog
│   │   ├── GridToolbar.tsx                   # Quick filters, column visibility, CSV export, reset
│   │   └── cell-renderers/                   # Type-safe, accessible React cell renderers
│   │       ├── StatusBadgeRenderer.tsx
│   │       ├── MonetaryCellRenderer.tsx
│   │       ├── RiskBadgeRenderer.tsx
│   │       ├── ProvenanceCellRenderer.tsx
│   │       └── ActionButtonsRenderer.tsx
│   ├── dashboard/
│   │   ├── IntelligenceControlRoomDashboard.tsx # Top-level operational overview & KPI metrics
│   │   └── AiDecisionInspectorModal.tsx      # Comprehensive AI assessment & policy calculation modal
│   ├── BryntumGanttViewer.tsx                # Existing preserved Bryntum Gantt component
│   ├── EvidencePassportViewer.tsx            # Existing preserved Evidence Passport viewer
│   └── DisputeEvidencePackViewer.tsx         # Existing preserved Dispute Pack viewer
```

---

## 4. AG Grid Licensing & Compatibility Analysis

- **Installed Version:** `ag-grid-community` & `ag-grid-react` **v36.3.0** (installed via `--legacy-peer-deps` to preserve Vite/esbuild tree).
- **License Type:** **100% MIT Licensed Community Edition**.
- **Commercial Invariant:** Zero enterprise trial keys, zero trial watermarks, zero license expiration risks.
- **Master/Detail Implementation:** Built using AG Grid Community's fully supported `isFullWidthRow` and `fullWidthCellRenderer` mechanism, achieving seamless inline evidence expansion without requiring Enterprise licensing.

---

## 5. Security & Safety Invariants

1. **No Frontend Financial Triggers:** AG Grid row operations or filter applications NEVER mutate database state or trigger PayPal API calls.
2. **Untrusted Evidence Sanitization:** All commit messages, PR descriptions, and CI logs are rendered safely as escaped text to prevent XSS.
3. **No Dynamic Code Execution:** The Natural-Language filter bar strictly rejects `eval`, `Function()`, SQL expressions, or arbitrary JavaScript. Only explicit whitelisted column IDs, operators (`EQUALS`, `CONTAINS`, `GREATER_THAN`, `LESS_THAN`), and validated primitives are accepted.
4. **Export Sanitization:** CSV exports exclude auth tokens, session IDs, client secrets, and sensitive developer PII.
