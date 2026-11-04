# MilestoneProof AI — Open Questions & Technical Research Items

This document tracks technical uncertainties, external dependency assumptions, licensing constraints, and recommended defaults for the MilestoneProof AI architecture.

---

## 1. PayPal Sandbox Integration Details

### Question 1.1: Exact Authorization & Capture Lifecycle vs. Direct Order Capture
- **Context:** PayPal Orders v2 API supports two main intents: `intent: "AUTHORIZE"` and `intent: "CAPTURE"`.
  - With `AUTHORIZE`: The buyer approves the authorization upfront when the contract or milestone is created. The funds are reserved for up to 29 days (with a 3-day honor period in standard PayPal processing). A capture API call captures the authorized amount later upon human approval.
  - With `CAPTURE`: The buyer approves payment at the time of final approval.
- **Impact:** `AUTHORIZE` matches the mental model of pre-funding a milestone. However, standard PayPal Sandbox accounts occasionally have restrictions on authorization validity windows or partial capture support.
- **Recommended Default for MVP:** Implement `intent: "AUTHORIZE"` as the primary flow. When the client creates/funds the milestone, the PayPal order is authorized. When the reviewer approves, `/v2/payments/authorizations/{authorization_id}/capture` is called. If the reviewer approves a partial amount, the partial amount is captured and the remaining balance is voided via `/v2/payments/authorizations/{authorization_id}/void`. As a resilient fallback, support instant `intent: "CAPTURE"` if the sandbox account lacks authorization permissions.

### Question 1.2: Two-Sided Market Payouts vs. Single-Party Merchant Settlement
- **Context:** In a complete marketplace, the client pays the platform/escrow, and the platform pays the freelancer. PayPal's multi-party marketplace payout requires PayPal Payouts API or PayPal Commerce Platform (PPCP) approval, which is frequently restricted in developer sandboxes without vetted business accounts.
- **Impact:** Attempting multi-party automated freelancer disbursement could fail in standard sandbox testing.
- **Recommended Default for MVP:** Treat the client payment as a verified milestone authorization and capture into the contract settlement account, returning a verifiable PayPal Capture ID. For freelancer payout demonstration, record the ledger settlement record and present a transparent payout voucher with recipient email attribution. Do not claim full custodial marketplace escrow without the required partner approval.

---

## 2. Sponsor Technologies: Licensing & Integration Constraints

### Question 2.1: APIMatic Context Plugin & Portal Publishing Prerequisites
- **Context:** The prompt notes: "Investigate APIMatic Context Plugin support for our AI-assisted development workflow, subject to its actual prerequisites." APIMatic Context Plugin typically requires an active APIMatic subscription or specific plugin configuration within an IDE or CI pipeline.
- **Impact:** If external cloud accounts or paid tokens are required, automated offline CI might not access the private APIMatic API.
- **Recommended Default for MVP:** Author a rigorous, 100% compliant OpenAPI 3.0/3.1 definition file (`docs/api/openapi.json`) following APIMatic's strict schema standards. Provide an interactive in-app API documentation viewer and SDK code generation script. Document the exact APIMatic Context Plugin configuration prerequisites so judges can run it with their own APIMatic API credentials.

### Question 2.2: Bryntum Gantt Hackathon Trial Licensing
- **Context:** Bryntum offers trial packages via their evaluation repository or public npm wrappers (`@bryntum/gantt` / `@bryntum/gantt-react`). Sometimes evaluation packages require npm login tokens or render a trial watermark.
- **Impact:** Network-restricted builds could fail if private npm scopes are referenced without credentials.
- **Recommended Default for MVP:** Structure the project with a clean Gantt wrapper interface (`ContractGantt.tsx`). Test standard npm evaluation package availability. Include an embedded, interactive high-fidelity timeline renderer as a zero-dependency fallback that adheres to Bryntum project data formats (tasks, baselines, dependencies) if external package registry tokens are unavailable during build time.

### Question 2.3: AG Grid Community vs. Enterprise Features
- **Context:** AG Grid offers Community (free, open source) and Enterprise (commercial). Features such as Excel export, grouping with aggregations, and master-detail sub-grids require Enterprise keys.
- **Impact:** Using Enterprise features without a license key displays a persistent console/UI license warning.
- **Recommended Default for MVP:** Standardize 100% on **AG Grid Community Edition (`ag-grid-react`, `ag-grid-community`)**. AG Grid Community provides sorting, filtering, quick search, column resizing, pinning, and custom React cell renderers for status badges and action buttons without any license key requirements or watermarks.

---

## 3. Evidence Ingestion & Sandbox Execution Strategy

### Question 3.1: GitHub Repository Ingestion Method
- **Context:** Developers can submit public GitHub repository links, commit SHAs, and PR numbers. To verify evidence, the system can:
  - Option A: Make read-only REST calls to GitHub Public API (`api.github.com/repos/.../commits/{sha}`) without requiring user OAuth.
  - Option B: Require full GitHub OAuth app installation.
  - Option C: Accept structured commit diff and CI log payloads directly in the submission form alongside the GitHub URLs.
- **Impact:** GitHub Public API without token has a 60 request/hour rate limit. OAuth adds setup complexity for judges testing arbitrary repos.
- **Recommended Default for MVP:** Support both Option C and Option A: The UI allows the developer to enter the GitHub PR / Commit URL and paste or upload the CI log / security scan JSON, while also providing pre-loaded realistic benchmark datasets (e.g., successful build, broken CI, critical CVE finding). If a GitHub Token is supplied in `.env`, the system optionally enriches live commit metadata via GitHub REST API.

### Question 3.2: Untrusted Code Execution vs. Trusted CI Artifacts
- **Context:** Should MilestoneProof AI clone and run `npm test` on submitted code locally?
- **Impact:** Running untrusted third-party code in the server process introduces severe security vulnerabilities (remote code execution, container escape, infinite loops).
- **Recommended Default for MVP:** **Never execute untrusted code in the backend process.** The platform ingests verified CI/CD execution artifacts (JUnit XML, GitHub Actions run logs, `npm audit` JSON, SARIF). The Evidence Agent and Risk Agent inspect the cryptographic hashes and outputs of these trusted artifacts.

---

## 4. Multi-Agent Orchestration & Reliability

### Question 4.1: Agent Timeout and Failure Handling
- **Context:** LLM API calls can occasionally encounter rate limits, network latency, or unexpected formatting errors.
- **Impact:** If an agent fails midway through evaluation, the milestone could be left in an inconsistent state.
- **Recommended Default for MVP:**
  - Wrap agent calls with strict timeout (30 seconds).
  - Use structured JSON response schemas with runtime validation (Zod).
  - If an agent call fails, the orchestrator flags the state as `EVALUATION_FAILED` with a one-click retry button.
  - Under no circumstance does a failed agent call trigger automatic payment release or arbitrary penalties.
