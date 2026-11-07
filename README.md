# MilestoneProof AI — Multi-Agent Evidence-to-Settlement Orchestrator

MilestoneProof AI is an evidence-backed software contract and milestone payment platform built for the PayPal AI Hackathon. It verifies software delivery artifacts (GitHub commits, pull requests, CI/CD test telemetry, and dependency security scans), runs a 3-stage advisory AI evaluation pipeline (`EvidenceAnalyst`, `RiskAnalyst`, `ReviewSynthesizer`), enforces deterministic integer-cent settlement policies, requires human reviewer sign-off, and executes idempotent settlement through PayPal Orders API v2 while recording every state transition in a tamper-evident SHA-256 hash-chained SQLite audit trail.

**Repository:** [https://github.com/Mohamed-529/TrustChain](https://github.com/Mohamed-529/TrustChain)

---

## Primary Sponsor Integrations (Bryntum & APIMatic + PayPal Orders API v2)

### Primary Integration A — Bryntum Gantt: Evidence-Aware Software Delivery Control Tower
Implemented in [`src/server/services/ScheduleControlTowerService.ts`](./src/server/services/ScheduleControlTowerService.ts), [`src/server/controllers/ScheduleController.ts`](./src/server/controllers/ScheduleController.ts), and [`src/App.tsx`](./src/App.tsx):
- **Contract Planning & Dependency Modeling:** Represents each contract milestone as a Bryntum Gantt task (`startDate`, `endDate`, `duration`, `percentDone`, `baselineStartDate`, `baselineEndDate`, `baselines`) connected by Finish-to-Start (`type: 2`) dependencies (`ContractScheduleDependency`), resource assignments (`ContractScheduleResource`, `ContractScheduleAssignment`), and automated **Critical Path** calculation (`criticalPathTaskIds`).
- **Evidence-Aware Progress:** Links every Gantt task directly to its persisted backend `milestoneId`, `evidence_submissions`, `ai_evaluations`, and `human_approvals`. Task `percentDone` is computed deterministically from persisted milestone status and verified criteria counts—never fabricated from unstructured AI text.
- **AI Schedule-Risk Intelligence (`POST /api/v1/contracts/:id/schedule/analyze-risk`):** Detects overdue and failed-CI milestones, identifies downstream tasks blocked by dependencies (`BLOCKED_BY_DEPENDENCY`), cites canonical `evidenceId`s (`ev_ci_...`), and generates structured `ScheduleRecoveryProposal` records.
- **Human-Controlled Schedule Recovery (`POST /api/v1/contracts/:id/schedule/proposals/:proposalId/review`):** Enforces separation of duties (`DEVELOPER` self-approval is blocked with `403 SCHEDULE_APPROVAL_FORBIDDEN_FOR_DEVELOPER`). Only authorized `CLIENT` or `REVIEWER` fiduciaries can approve schedule modifications, which persist updated schedule dates, recalculate downstream Finish-to-Start dependencies, preserve original baseline dates for Baseline vs. Actual variance comparison, and **never** modify contractual payment amounts (`agreedAmountCents`) or acceptance criteria.
- **3-Milestone Control Tower Demo Scenario (`POST /api/v1/contracts/:id/schedule/demo-scenario`):**
  1. **Milestone 1 (Authentication):** Completed (`100%`, `APPROVED`).
  2. **Milestone 2 (Payment Integration):** Failed CI and delayed (`OVERDUE`, cites `ev_ci_...`).
  3. **Milestone 3 (Deployment):** Blocked by Milestone 2 dependency (`BLOCKED_BY_DEPENDENCY`).

### Primary Integration B — APIMatic & PayPal Orders API v2
Implemented in [`openapi.yaml`](./openapi.yaml), [`APIMATIC-META.json`](./APIMATIC-META.json), [`src/sdk/MilestoneProofClient.ts`](./src/sdk/MilestoneProofClient.ts), [`src/server/services/PayPalService.ts`](./src/server/services/PayPalService.ts), and [`docs/DEVELOPER_PORTAL.md`](./docs/DEVELOPER_PORTAL.md):
- **APIMatic OpenAPI 3.0.3 Validation & Governance:** Validated OpenAPI 3.0.3 contract (`openapi.yaml`) with 28 globally unique `operationId`s across 10 controller tag groups, zero unresolved `$ref` pointers, strict integer-cent monetary schemas, and runtime schema enforcement (`src/server/middleware/validateRequest.ts`).
- **TypeScript Client SDK & Developer Portal:** Strongly-typed client SDK (`src/sdk/MilestoneProofClient.ts`) generated from our OpenAPI contract with retry handling, Bearer token management, and `PayPal-Request-Id` idempotency headers, paired with developer documentation in [`docs/DEVELOPER_PORTAL.md`](./docs/DEVELOPER_PORTAL.md).
- **PayPal Context Plugin Grounding & PayPal Orders API v2:** Grounded in the authoritative APIMatic/PayPal Server SDK (`@paypal/paypal-server-sdk`) Orders v2 & Authorizations v2 specifications:
  - `POST /api/v1/milestones/:id/paypal/order`: Creates a PayPal Order with `intent: "AUTHORIZE"` (`CLIENT` only). Includes explicit non-escrow disclosure (PayPal authorization is a temporary 29-day hold, **not** custodial escrow).
  - `POST /api/v1/milestones/:id/paypal/authorize`: Authorizes the order and records `paypalAuthorizationId` and `authExpiresAt`.
  - `POST /api/v1/milestones/:id/paypal/capture`: Captures settlement **only** after a persisted `HUMAN_APPROVAL` (`decision === 'APPROVE'`), verifying `0 < approvedAmountCents <= permittedAmountCents <= authorizedAmountCents` and enforcing `PayPal-Request-Id` idempotency.
  - `POST /api/v1/webhooks/paypal`: Verifies `PAYPAL-TRANSMISSION-*` webhook headers and certificate domain authenticity (`https://api.sandbox.paypal.com`), reconciles payment state, and logs to the hash-chained audit trail.

---

## Core Architecture & Phases

- **Phase 1 — Backend Foundation, Auth/RBAC & Hash-Chained Audit Trail:**
  - Native Node.js HTTP server (`node:http`) + Vite SPA middleware integration.
  - Non-blocking asynchronous `crypto.scrypt()` authentication, server-side role resolution (`CLIENT`, `DEVELOPER`, `REVIEWER`), and HMAC-SHA256 signed Bearer sessions backed by SQLite revocation (`auth_sessions`).
  - Native `node:sqlite` (`WAL` mode + `PRAGMA synchronous = FULL`) ACID transactions with `BEFORE UPDATE` and `BEFORE DELETE` immutability triggers on `audit_logs`.
- **Phase 2 — OpenAPI 3.0.3 Contract & APIMatic Governance:**
  - Complete OpenAPI 3.0.3 specification (`openapi.yaml`) paired with `APIMATIC-META.json` and runtime request schema validation (`src/server/middleware/validateRequest.ts`).
- **Phase 3 — Evidence Intelligence Engine & Financial Safety Boundary:**
  - Validates GitHub HTTPS repository URLs, 7–40 hex commit SHAs, PR URLs/statuses, changed-file summaries, CI reports, and vulnerability scans.
  - Isolates untrusted repository text inside `<untrusted_evidence>` delimiters and detects adversarial prompt-injection attempts.
- **Phase 4 — Deterministic Settlement Policy Engine, Human Review & Financial Decision Ledger:**
  - Dedicated `SettlementPolicyService` using integer cents only, human review state machine (`HumanReviewService`), and audit-traceable Financial Decision Ledger (`GET /api/v1/ledger`).
- **Phase 5 — Sponsor Integrations (Bryntum Gantt Control Tower + APIMatic SDK + PayPal Orders API v2):**
  - Full Bryntum Schedule Control Tower, human-approved schedule recovery with Finish-to-Start dependency cascades, TypeScript Client SDK, and PayPal Orders API v2 settlement engine.

---

## Prerequisites & Local Setup

- **Runtime:** Node.js `v22.5.0+` or `v24.x` (`v24.14.0` recommended for native `node:sqlite` and TypeScript execution).

1. **Configure Environment Variables (Optional for Local Demo):**
   Copy `.env.example` to `.env` if you want to configure a live `GEMINI_API_KEY`, `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`, or custom `AUTH_TOKEN_SECRET`. When external API keys are omitted, the server automatically uses the labeled `DeterministicMockEvaluator` and `SANDBOX_SIMULATION` mode.

2. **Install Frontend Dependencies (Optional for Backend/API Tests):**
   ```bash
   npm install
   ```

3. **Run the Server:**
   ```bash
   npm run dev
   ```
   - API Health Check: `http://localhost:3000/api/v1/health`
   - OpenAPI 3.0.3 YAML Spec: `http://localhost:3000/api/v1/openapi.yaml`
   - OpenAPI 3.0.3 JSON Discovery: `http://localhost:3000/api/v1/openapi.json`

4. **Run the Automated Test Suites (Phases 1–5, 21 Automated Tests):**
   ```bash
   npm test
   ```

---

## Architecture & Design Documentation

- [AGENTS.md](./AGENTS.md) — Engineering, Security & Financial Safety Rules
- [HLD.md](./HLD.md) — High-Level System Design
- [LLD.md](./LLD.md) — Low-Level Component & Schema Design
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) — System Architecture & Sponsor Integrations
- [openapi.yaml](./openapi.yaml) — Normative OpenAPI 3.0.3 Specification
- [docs/DEVELOPER_PORTAL.md](./docs/DEVELOPER_PORTAL.md) — APIMatic SDK & Developer Portal Integration Guide
- [PHASE4_IMPLEMENTATION_REPORT.md](./PHASE4_IMPLEMENTATION_REPORT.md) — Phase 4 Settlement Policy & Human Review Report
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) — Current Implementation & Verification Status
