# PROJECT STATUS — MilestoneProof AI (TrustChain)

## 1. Executive Summary & System Identity

**MilestoneProof AI (TrustChain)** is a production-grade, multi-agent evidence-to-settlement orchestration platform for software development contracts. It bridges the trust gap between software engineering deliverables (Git commits, PRs, CI test runs, and security audits) and milestone payments via PayPal.

* **Primary AI Coding Agent**: Google Antigravity
* **Architecture**: Modular Monolith (Node.js 22 + TypeScript Express Backend + React 19 / Tailwind CSS v4 Frontend)
* **Core Philosophy**: Spec-driven development (GSD), anti-bloat restraint (Ponytail), and bounded test-driven verification (Ralph Loop).
* **Test Verification**: **291 / 291 automated tests passing across 25 suites (100% pass rate, 0 failures)**.
* **Type Safety & Build**: Zero TypeScript compilation errors (`tsc --noEmit`), clean production build (`vite build`).

---

## 2. Core Architectural Invariants & Fiduciary Principles

The platform enforces five non-negotiable financial and architectural safety rules:

1. **No Autonomous Payment Execution**: AI agents (`EvidenceAgent`, `RiskAgent`, `ArbitratorAgent`) produce strictly advisory recommendations and structured risk assessments. They can **never** unilaterally capture, void, or transfer payments.
2. **Mandatory Human Approval Gate**: An authorized human fiduciary (`REVIEWER` or `CLIENT`) must explicitly review and submit an `APPROVE` decision before PayPal capture can be triggered.
3. **Deterministic Settlement Policy Engine**: Settlement amounts are calculated by pure TypeScript business logic enforcing contract payment formulas, integer-cent arithmetic (no floating-point rounding errors), CI passing ratios, and zero-critical-vulnerability gates.
4. **Append-Only Tamper-Evident Audit Trail**: All financial state transitions, AI evaluations, reviewer decisions, and evidence verifications are committed to an immutable SQLite audit log anchored with SHA-256 hash chains.
5. **Fail-Closed PayPal Lifecycle & Gateway Resilience**:
   * Authorization holds up to 29 days (`intent: AUTHORIZE`) with explicit non-escrow regulatory disclosures.
   * Server-side idempotency protection via `PayPal-Request-Id`.
   * Upstream timeouts transition transactions to `REQUIRES_RECONCILIATION` without creating phantom settlement states.
   * Webhook verification (`POST /v1/notifications/verify-webhook-signature`) enforces anti-SSRF certificate pinning (`api.paypal.com` / `api.sandbox.paypal.com`) and replay duplicate detection.

---

## 3. Sponsor Technology Excellence & Integration Matrix

### 3.1 APIMatic — API Contract Quality, Parity & SDK
* **OpenAPI 3.0.3 Specification**: Canonical contract maintained in `/openapi.yaml` with 100% route parity against backend routes (`/api/v1/*`).
* **Metadata & Discovery**: Live discovery endpoints (`GET /openapi.json`, `GET /openapi.yaml`) paired with `/APIMATIC-META.json`.
* **TypeScript SDK**: Full-featured client (`src/sdk/MilestoneProofClient.ts`) implementing automatic retries, backoff, typed error deserialization, and demo persona switching.
* **Validation**: Zero broken `$ref` pointers, unique operation IDs, integer monetary cents, and strict schema validation middleware (`validateRequest.ts`).

### 3.2 Bryntum Gantt — Intelligent Execution Timeline
* **Interactive Schedule Viewer**: Component in `src/components/BryntumGanttViewer.tsx` powered by `@bryntum/gantt-react`.
* **Work Breakdown Structure (WBS)**: Hierarchical milestone decomposition with dependency linking, Critical Path Method (CPM) calculation, and cycle detection.
* **Recovery Workflows**: Fiduciary approval window extensions (+7d recovery) without silently altering contractual budgets or acceptance criteria.
* **Licensing**: Trial execution configured cleanly without broken watermarks or runtime halts.

### 3.3 AG Grid — Financial Decision Intelligence Ledger
* **Intelligence Grid**: Implemented in `src/components/ag-grid/MilestoneIntelligenceGrid.tsx` using `ag-grid-community` v36.
* **Master/Detail Evidence Inspection**: Full-width expansion drawer (`EvidenceDetailPanel.tsx`) showing multi-agent AI findings, test summaries, vulnerability scores, and audit hash-chains.
* **Natural Language Query Bar**: Component in `NaturalLanguageFilterBar.tsx` powered by a strict whitelist AST parser (`queryParser.ts`) enabling intuitive queries (e.g. `status:APPROVED risk:LOW amount>1000`).
* **Security & Licensing**: Strictly MIT Community-licensed (zero trial keys/watermarks), with CWE-1236 CSV formula injection defense (sanitizing `=`, `+`, `-`, `@` prefixes).

### 3.4 Google Gemini API — Tri-Agent Advisory Consensus
* **Model**: Google Generative Language API using modern `gemini-3.5-flash-lite`.
* **Advisory Consensus**:
  1. `EvidenceAgent`: Validates verifiable repository deliverables (commits, PRs, CI logs). Isolates untrusted submissions within `<untrusted_evidence>` blocks.
  2. `RiskAgent`: Analyzes actual CVE/CVSS security scan findings and flags prompt injection attempts.
  3. `ArbitratorAgent`: Evaluates delivery against contractual acceptance criteria and suggests settlement percentages.
* **Schema-Constrained Decoding**: Native JSON schema grammar enforcement (`responseSchema`) preventing syntax degradation and hallucinated keys.
* **Resilience Pipeline**: Automatic fallback to deterministic rules upon transient 429 quota exhaustion or timeouts, recording `EVALUATION_FALLBACK_TRIGGERED` in the audit ledger.

### 3.5 PayPal Sandbox — Payment Lifecycle Management
* **Lifecycle**: Orders v2 `intent: AUTHORIZE` creates pre-authorized holds; capture occurs only after human fiduciary sign-off.
* **Dispute Evidence Pack**: Generation of tamper-evident dispute bundles with two-stage non-circular SHA-256 digest anchoring (`DisputeEvidencePackService.ts`).
* **Evidence Passport**: Cryptographic engineering passport (`EvidencePassportService.ts`) packaging commit signatures, SLSA provenance, and audit logs.

---

## 4. Multi-Page Application Architecture

The frontend is organized into 9 modular routes wrapped in an enterprise application shell (`AppShell.tsx`):

| Route | View / Page Component | Core Responsibilities |
|---|---|---|
| `/` | `WelcomeLandingPage.tsx` | Cinematic entry, luminous wave canvas, 3D lifecycle preview, and capability showcase |
| `/onboarding` | `GuidedTourModal.tsx` | 6-stage interactive walkthrough for new fiduciaries and reviewers |
| `/dashboard` | `DashboardPage.tsx` | Executive control room, real-time KPI metrics, and AI Decision Inspector modal |
| `/intelligence` | `IntelligencePage.tsx` | AG Grid Financial Decision Intelligence cockpit with NL filter bar and CSV export |
| `/timeline` | `TimelinePage.tsx` | Bryntum Gantt schedule, CPM dependency chains, and schedule recovery proposals |
| `/reviews` | `ReviewsPage.tsx` | Human Reviewer Workbench with approval gate, policy formula review, and PayPal capture |
| `/trust` | `TrustPage.tsx` | Cryptographic Evidence Passport viewer with signature and SLSA provenance checks |
| `/disputes` | `DisputesPage.tsx` | Dispute Evidence Pack viewer with tamper-evident SHA-256 export |
| `/settings` | `SettingsPage.tsx` | Role switching (Client, Developer, Reviewer, Auditor) and environment status |

---

## 5. Verification & Test Suite Matrix (291 Tests / 25 Suites)

All test suites execute via `npm test` (`node --test src/server/__tests__/*.test.ts`):

1. `phase1.test.ts`: HMAC authentication, RBAC permissions, and SQLite persistence.
2. `phase2.test.ts`: OpenAPI 3.0.3 contract and schema validation.
3. `phase3.test.ts`: Evidence ingestion, untrusted isolation, and multi-agent consensus.
4. `phase4.test.ts`: Settlement policy formulas and human approval gate.
5. `phase5.test.ts`: Sponsor integration baseline (Bryntum schedule & PayPal authorizer).
6. `phase6.test.ts`: PayPal security remediation and integer-cent invariants.
7. `phase7.test.ts`: GitHub provenance verification and webhook ingestion.
8. `phase8_foundation.test.ts`: Bryntum Gantt scheduling and component mounting.
9. `phase8_integration.test.ts`: End-to-end WBS dependency management and progress mapping.
10. `phase9_agent_integration.test.ts`: Gemini agent consensus and prompt injection defense.
11. `audit_replay.test.ts`: Audit replay engine, state machine reconstruction, and hash-chain audit.
12. `evidence_passport.test.ts`: Cryptographic Evidence Passport, commit signatures, and SLSA provenance.
13. `dispute_evidence_pack.test.ts`: Tamper-evident Dispute Evidence Pack and non-circular digest calculation.
14. `paypal_lifecycle.test.ts`: Orders v2 authorization holds, capture, void, and status transitions.
15. `ag_grid_intelligence.test.ts`: AG Grid Community licensing, master/detail panels, and NL query parser.
16. `bryntum_schedule_intelligence.test.ts`: Bryntum CPM merge, calendar scheduling, and cycle detection.
17. `cinematic_frontend.test.ts`: Multi-page routing, guided tour, and canvas animation telemetry.
18. `paypal_application_path_remediation.test.ts`: Route parity and path remediation verification.
19. `paypal_webhook_live_verification.test.ts`: Webhook signature verification, replay protection, and cert URL pinning.
20. `prompt7_hardening.test.ts`: Backend hardening, rate limiting, and network timeout recovery.
21. `prompt8_e2e_acceptance.test.ts`: 10-stage end-to-end contract delivery and settlement acceptance.
22. `prompt8_failure_recovery.test.ts`: 20-scenario cross-system failure and recovery matrix.
23. `apimatic_contract_excellence.test.ts`: APIMatic OpenAPI quality, operationId uniqueness, and SDK retries.
24. `sponsor_excellence_forensic.test.ts`: Unified sponsor compliance (APIMatic + Bryntum + AG Grid).
25. `gemini_live_and_adversarial.test.ts`: Live Gemini API integration, adversarial injection, and schema compliance.

---

## 6. Demo Evidence & Visual Artifacts

High-resolution visual proof captured in `/demo-evidence/`:

* `01_developers_apimatic_portal.png`: APIMatic Developer Portal with live OpenAPI documentation.
* `02_timeline_bryntum_gantt.png`: Bryntum Gantt execution schedule with critical path dependencies.
* `03_intelligence_ag_grid_cockpit.png`: AG Grid Financial Decision Intelligence cockpit with Master/Detail drawer.
* `04_intelligence_nlp_date_filter.png`: Natural language filter bar executing dynamic range queries.
* `05_ledger_financial_decisions.png`: Financial Decision Ledger with audit-traceable state transitions.
* `06_reviews_human_approval_workbench.png`: Human Approval Workbench enforcing the fiduciary gate.
* `07_trust_evidence_passport.png`: Evidence Passport with cryptographic commit signatures and SLSA status.
* `08_disputes_evidence_pack.png`: Dispute Evidence Pack viewer with SHA-256 digest verification.
* `09_dashboard_executive_overview.png`: Executive Dashboard with real-time portfolio health telemetry.
* `10_live_gemini_evaluation_workbench.png`: Review Workbench with Live Gemini Evaluation Provenance.
* `11_live_gemini_decision_inspector.png`: AI Decision Inspector modal with token telemetry and policy breakdown.
* `acceptance_summary.json`: Machine-readable acceptance test results.
* `cross_sponsor_workflow_execution.json`: End-to-end sponsor workflow validation logs.

---

## 7. Canonical Documentation Index

To maintain documentation hygiene, all detailed system specifications and operational manuals are organized canonically:

* **Repository Overview**: `README.md`
* **Agent Guidelines & Tooling**: `AGENTS.md`
* **System Architecture**: `SYSTEM_ARCHITECTURE.md`
* **High-Level Design**: `HLD.md`
* **Low-Level Design**: `LLD.md`
* **API Specification**: `openapi.yaml`
* **APIMatic Metadata**: `APIMATIC-META.json`
* **Product Specifications**:
  * `docs/PRD.md` — Product Requirements Document
  * `docs/MVP_SCOPE.md` — MVP Boundaries & Constraints
  * `docs/PRODUCT_WORKFLOWS.md` — Detailed Workflow State Transitions
  * `docs/SPONSOR_INTEGRATION_PLAN.md` — Sponsor Technology Specifications
  * `docs/DEVELOPER_PORTAL.md` — Developer Portal & Integration Manual
  * `docs/product/ACCEPTANCE_CRITERIA.md` — Contract Acceptance Criteria
  * `docs/product/USER_FLOWS.md` — End-to-End User Journeys
