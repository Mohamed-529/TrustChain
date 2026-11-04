# MilestoneProof AI — Sponsor Technology Integration Plan

This document establishes the functional rationale, architecture, licensing requirements, and demonstration plans for the three sponsor technologies integrated into MilestoneProof AI:
1. **APIMatic** — API Contract Quality, Documentation, and SDK Generation
2. **Bryntum Gantt** — Contract Milestone Scheduling & Delivery Timeline
3. **AG Grid** — Financial Decision Intelligence Ledger

---

## 1. APIMatic — API Contract Quality & Developer Experience

### 1.1 The Real Problem Solved
In an evidence-to-settlement orchestration platform, API contracts must be strictly validated and unambiguous. External clients, developer CLI tools, CI/CD webhooks, and the frontend user interface must interact with backend endpoints (Milestones, Evidence Submissions, Risk Evaluations, PayPal Settlements) without schema drift or unexpected data types.
If an Evidence submission format or an Evaluation response schema drifts, the deterministic settlement policy engine could miscalculate payouts or fail silently.

### 1.2 Placement in Architecture
- **Location:** Backend API layer (`/api/v1/*`), OpenAPI 3.0/3.1 Contract Specification, APIMatic Portal & CodeGen CLI/SDK generation pipeline.
- **Endpoints Governed:**
  - `POST /api/contracts` — Contract lifecycle management
  - `POST /api/milestones/:id/evidence` — Ingestion of git, PR, and CI artifacts
  - `POST /api/milestones/:id/evaluate` — Multi-agent evaluation invocation
  - `POST /api/milestones/:id/settle` — Policy execution and PayPal capture
  - `GET /api/ledger` — AG Grid financial feed
  - `GET /api/timeline` — Bryntum Gantt milestone feed

### 1.3 Concrete Features Utilizing APIMatic
- **OpenAPI Schema Definition & Validation:** A pristine, battle-tested OpenAPI 3.0 specification covering request/response schemas, query parameters, error definitions (RFC 7807), and security schemes.
- **Interactive Developer Documentation:** APIMatic-rendered API documentation enabling developers to test evidence submission endpoints directly.
- **Typed SDK Generation:** Generating client SDKs (TypeScript) to ensure frontend-to-backend type parity, preventing runtime parsing mismatches.
- **Investigation of APIMatic Context Plugin:** Assessing feasibility of the APIMatic Context Plugin for AI-assisted contract verification workflows, subject to actual platform and account prerequisites.

### 1.4 Technical & Licensing Prerequisites
- **OpenAPI Specification:** Standard OpenAPI 3.0/3.1 JSON/YAML maintained in the repository (`/docs/api/openapi.json`).
- **APIMatic Account / Free/Trial Tier:** Required for hosted portal publishing or CLI-based SDK transformations. If hosted generation is rate-limited in offline/sandbox judging, local validation against the OpenAPI specification is supported.

### 1.5 Demonstration Plan for Judges
- Showcase the OpenAPI contract specification in the platform under an "API & Developer Portal" tab.
- Demonstrate live request validation against the specification: show how an invalid evidence submission is caught and rejected with descriptive schema errors before reaching AI agents.
- Highlight the auto-generated TypeScript API client types consumed by the React application.

---

## 2. Bryntum Gantt — Contract Milestone Scheduling & Delivery Timeline

### 2.1 The Real Problem Solved
Software development contracts depend heavily on delivery timelines, critical paths, and milestone dependencies. For instance, Milestone 2 (Backend Integration) cannot start until Milestone 1 (Database Architecture) is delivered.
Traditional dashboards display simple static due dates without visualizing:
- Inter-milestone dependency chains.
- Planned deadline vs. actual submission date.
- Schedule variance (lead time or delivery slippage).
- Automatic calculation of late delivery penalties under contractual terms.

### 2.2 Placement in Architecture
- **Location:** Main Contract View & Scheduling Dashboard (`src/components/timeline/ContractGantt.tsx`).
- **Data Source:** Contract Milestone Schedule API (`GET /api/contracts/:id/schedule`), formatted to Bryntum Gantt Project data model (`tasks`, `dependencies`, `baselines`).

### 2.3 Concrete Features Utilizing Bryntum Gantt
- **Milestone Dependency Visualization:** Clear arrows showing blocking dependencies between milestone phases.
- **Baseline vs. Actual Tracking:** Visually compares agreed contractual deadlines (Baseline) against actual evidence submission timestamps.
- **Late Delivery Detection:** Automatically computes delay days when evidence submission occurs after the baseline deadline, feeding this delay metric directly into the Deterministic Settlement Policy Engine for penalty calculations.
- **Status Color Encoding:** Tasks and milestones color-coded by state (`Active`, `Submitted`, `Evaluating`, `Approved`, `Late`, `Rejected`).
- **Audited Schedule Adjustments:** Timeline drag-and-drop triggers an explicit contract amendment workflow rather than silently modifying signed contract dates.

### 2.4 Technical & Licensing Prerequisites
- **Bryntum Gantt for React:** Bryntum offers an npm trial / evaluation package (`@bryntum/gantt` / `@bryntum/gantt-react`) for evaluation and non-commercial hackathon use.
- **Prerequisite Check:** Ensure NPM registry access or trial package integration without production build watermarks interfering with usability. If offline fallback is needed, provide a robust timeline fallback with interactive Gantt-like SVG projection while preserving the Bryntum component configuration.

### 2.5 Demonstration Plan for Judges
- Navigate to the "Delivery Schedule" tab for a contract with 4 milestones.
- Show Milestone 1 completed on time.
- Show Milestone 2 submitted 3 days past deadline: Bryntum Gantt displays the slippage against baseline and highlights the critical path impact on Milestone 3.
- Show how the delay metric flows from the timeline into the settlement engine to calculate late-delivery deduction.

---

## 3. AG Grid — Financial Decision Intelligence Ledger

### 3.1 The Real Problem Solved
Financial reviewers and contract owners need an institutional-grade, high-density ledger to audit multiple milestones, evidence scores, security findings, and payment amounts across contracts. A simplistic card-based view fails to provide the multi-column sorting, filtering, range aggregation, and inline drill-down required for fiduciary compliance.

### 3.2 Placement in Architecture
- **Location:** Financial Ledger & Approvals View (`src/components/ledger/FinancialLedger.tsx`).
- **Data Source:** Settlement Intelligence API (`GET /api/ledger`), combining contract data, agent evaluation summaries, policy engine calculations, and PayPal transaction records.

### 3.3 Concrete Features Utilizing AG Grid
- **Structured Financial Data Columns:**
  - Milestone Title & Contract Reference.
  - Delivery Status (Badge).
  - Verified Criteria (e.g. `3/3 (100%)`).
  - Risk Level (e.g., `None`, `Medium (1)`, `Critical (1)`).
  - AI Recommendation (`RECOMMEND_APPROVAL`, `RECOMMEND_HOLD`, `RECOMMEND_REJECTION`).
  - Original Agreed Amount ($).
  - Permitted Policy Cap ($).
  - Approved Amount ($).
  - PayPal Status (`Authorized`, `Captured`, `Held`, `Voided`).
- **Interactive Capabilities:**
  - Instant column filtering (filter by `PENDING_REVIEW`, `HIGH_RISK`, etc.).
  - Multi-column sorting (sort by settlement amount or risk severity).
  - Custom cell renderers for status badges, risk severity indicators, and payment action buttons.
  - Quick Search across all contract and milestone fields.
  - Detail Row Expansion / Modal Link: Clicking a row opens the full multi-agent evidence breakdown and PayPal audit receipts.

### 3.4 Technical & Licensing Prerequisites
- **AG Grid Community Edition (`ag-grid-react`, `ag-grid-community`):** Completely free, open-source (MIT), and provides comprehensive sorting, filtering, custom cell rendering, quick search, and reactive data updates.
- **AG Grid Enterprise Assessment:** Enterprise features (such as server-side row model, Excel export, and integrated charting) require an enterprise license key. For the hackathon MVP, AG Grid Community fulfills 100% of the core requirements without licensing restrictions or trial banner degradation.

### 3.5 Demonstration Plan for Judges
- Open the "Financial Ledger" tab.
- Demonstrate filtering for milestones requiring human review (`Status = PENDING_REVIEW`).
- Show the visual contrast between agreed amount vs. policy permitted amount (e.g. $5,000 agreed vs $0.00 permitted due to a critical security violation).
- Filter by high-risk items; drill down from the AG Grid row directly into the Evidence & Risk Agent inspection modal.
- Demonstrate approval directly updating the AG Grid row state from `PENDING_REVIEW` to `SETTLED` in real-time.
