# MilestoneProof AI — Product Requirements Document (PRD)
## Multi-Agent Evidence-to-Settlement Orchestrator for Software Contracts

---

## 1. Executive Summary

**MilestoneProof AI** is an evidence-driven financial governance platform for milestone-based software contracts. It bridges the critical trust and verification gap between software buyers (clients) and software providers (freelancers, agencies) by replacing subjective payment disputes with verifiable technical evidence, multi-agent AI verification, deterministic financial settlement policy enforcement, and PayPal Sandbox payment authorization and capture.

Rather than acting as a generic conversational chatbot or a passive project tracker, MilestoneProof AI operates as a stateful, auditable financial governance pipeline. It ingests verifiable artifacts (GitHub commits, pull requests, CI/CD run logs, SAST security reports, and dependency scans), coordinates specialized AI agents (Evidence Agent, Risk Agent, Arbitrator Agent) to inspect artifacts against contractual acceptance criteria, runs the findings through a deterministic settlement policy engine, and provides an authorized human financial reviewer with an explainable ledger and schedule to approve, hold, or reject payments.

---

## 2. Problem Statement & Market Reality

### 2.1 The Problem
In modern software outsourcing:
1. **The Verification Black Box:** Clients lack the technical depth or tooling to verify whether a submitted milestone truly meets acceptance criteria. A pull request or git commit may be submitted with empty stubs, broken tests, critical vulnerabilities, or missing features.
2. **Subjective Approval Battles:** Disputes occur when a developer claims "it's done" while the client claims "it doesn't work as agreed". Without objective evidence mapping, payments get held indefinitely or released prematurely.
3. **Flawed All-or-Nothing Escrow:** Traditional freelance platforms operate on blunt all-or-nothing release models without granular contract rule evaluation, vulnerability gates, or automated proof checking.
4. **AI Slop & Hallucination Risks:** Generic AI chatbots applied to contract review hallucinate contract terms, make up security scores, or promise payouts they cannot legally or programmatically enforce.

### 2.2 The Solution
MilestoneProof AI establishes a dual-engine architecture:
- **Advisory Multi-Agent Intelligence:** Specialized AI agents strictly bound to real evidence (GitHub commits, PR diffs, CI/CD test reports, SARIF/npm audit scans) that inspect, extract risk findings, and evaluate acceptance criteria without hallucinating facts.
- **Deterministic Settlement Policy Engine:** A pure mathematical/business logic engine governed by pre-agreed contract clauses. The AI recommends; the deterministic engine calculates permitted caps, penalties, or holds; and the authorized human makes the final decision.
- **Auditable Financial Ledger:** Integrated with PayPal Sandbox for verifiable payment authorization and capture, Bryntum Gantt for contractual schedule vs. delivery tracking, and AG Grid for granular ledger auditing.

---

## 3. Product Vision & Principles

1. **Evidence Over Assertion:** A claim of completion is meaningless without verifiable artifacts (commit SHA, PR URL, test execution output, vulnerability report).
2. **Deterministic Financial Authority:** AI never decides payments. AI advises; deterministic policy gates; humans authorize.
3. **Zero Hallucination Tolerance:** If an artifact is missing or an automated check is absent, the agent reports "Evidence Missing", never synthetic approval.
4. **Transparent Audit Trail:** Every state change, agent recommendation, policy deduction, human approval, and PayPal API response is cryptographically or sequentially logged with immutable timestamps.
5. **Separation of Duties:** Role-based access control prevents contract actors from approving their own financial settlements or altering agreed contracts unilaterally.

---

## 4. Target Users & Personas

### 4.1 Client / Contract Owner
- **Profile:** Product Manager, Startup Founder, or Enterprise IT Buyer hiring technical contractors.
- **Core Jobs-to-be-Done:**
  - Create contracts with explicit milestone definitions, delivery deadlines, acceptance criteria, and penalty/hold terms.
  - Review delivery submissions with clear, visual breakdowns of verified vs. unverified requirements.
  - Retain final approval authority over financial release.
- **Pain Points:** Fear of paying for broken, insecure, or incomplete code; spending hours manually cloning repos and parsing CI logs.

### 4.2 Developer / Freelancer / Software Agency
- **Profile:** Software engineer or agency delivery team responsible for building the agreed software.
- **Core Jobs-to-be-Done:**
  - View contractual requirements and acceptance criteria in unambiguous terms.
  - Submit delivery evidence: repository links, commit SHAs, PR references, CI/CD test run artifacts, security reports.
  - Receive actionable, explainable feedback on why a milestone was flagged or held, allowing targeted remediation.
- **Pain Points:** Subjective client rejections, delayed payments despite fulfilling specifications, "scope creep" masquerading as unmet acceptance criteria.

### 4.3 Reviewer / Financial Approver
- **Profile:** Finance Director, Project Controller, or authorized Client Reviewer with fiduciary sign-off authority.
- **Core Jobs-to-be-Done:**
  - Inspect the financial settlement ledger (AG Grid), comparing agreed milestone amounts with policy-permitted caps.
  - Inspect the project timeline (Bryntum Gantt) to evaluate on-time vs. delayed delivery penalties.
  - Execute or hold PayPal payment transactions based on explainable evidence.
- **Security Rule:** The Developer assigned to a milestone can NEVER act as Reviewer or Financial Approver for their own milestone.

---

## 5. System Roles & Access Control (RBAC)

| Role | Contract Creation | Milestone Edit | Evidence Submission | Run AI Evaluation | Financial Approval | PayPal Capture | Audit Inspection |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Client / Owner** | Yes | Yes (Draft phase) | No | Yes | Yes | Yes | Yes |
| **Developer** | No | No | Yes | Yes (Self-check) | No | No | Read-Only |
| **Financial Reviewer** | No | No | No | Yes | Yes | Yes | Yes |
| **System Orchestrator** | Internal | Internal | Internal | Automated | Automated Policy | Triggered by Human | System Append |

---

## 6. Functional Requirements

### 6.1 Contract & Milestone Management
- **FR-1.1:** System shall allow Clients to create contracts with: Title, Description, Total Budget, Currency (e.g., USD), Client ID, Developer ID, Reviewer ID, and Payment Rules (e.g., maximum partial payout % for partial completion, mandatory zero-critical-vulnerability gate).
- **FR-1.2:** System shall support creating multiple sequential or parallel Milestones per contract.
- **FR-1.3:** Each Milestone must define:
  - Sequence order and milestone title.
  - Deliverable description.
  - Target deadline (ISO 8601 timestamp).
  - Agreed milestone fee / payout amount.
  - Structured acceptance criteria list (each with an ID, description, required test/proof type).
  - Risk constraints (e.g., Zero Critical CVEs, 100% CI pass rate).
- **FR-1.4:** Contract terms become immutable once the contract enters the `Active` or `Funded` state. Any changes require explicit bilateral amendment logs.

### 6.2 Evidence Submission & Artifact Ingestion
- **FR-2.1:** Developers shall submit delivery evidence for an assigned milestone containing:
  - GitHub repository URL and target branch.
  - Specific commit SHA(s).
  - Pull Request URL and PR status (Merged/Open).
  - CI/CD build run URL or attached structured execution log (JSON/JUnit/TAP).
  - Automated security/dependency scan artifact (e.g., SARIF, `npm audit` JSON, Trivy/Snyk output).
- **FR-2.2:** System shall validate input URLs and format integrity before triggering agent pipelines.
- **FR-2.3:** System shall isolate external inputs; no untrusted repository code shall be executed directly inside the core backend process.

### 6.3 Multi-Agent Orchestration & Evaluation
- **FR-3.1:** **Evidence Agent** shall:
  - Parse commit metadata, PR summaries, code diff headers, and CI test outputs.
  - Cross-reference specific acceptance criteria IDs against submitted artifacts.
  - Generate a structured `EvidenceEvaluationResult` mapping each criterion to `VERIFIED`, `PARTIAL`, `UNVERIFIED`, or `CONTRADICTED`.
- **FR-3.2:** **Risk Agent** shall:
  - Ingest vulnerability and test pass/fail data.
  - Classify findings into Critical, High, Medium, Low severity.
  - Check compliance against contract gates (e.g., "Critical Vulnerability Gate: Fail if any CVE CVSS >= 9.0").
  - Generate a structured `RiskEvaluationResult` with concrete references to CVEs or failed test suites.
- **FR-3.3:** **Arbitrator Agent** shall:
  - Synthesize outputs from the Evidence Agent and Risk Agent.
  - Compare overall delivery against contractual criteria.
  - Generate an advisory verdict: `RECOMMEND_APPROVAL`, `RECOMMEND_HOLD`, or `RECOMMEND_REJECTION`.
  - Provide human-readable, fact-grounded explanatory notes citing exact commit SHAs and test logs.
- **FR-3.4:** System Orchestrator shall enforce sequential validation, timeout limits (default 30 seconds per agent invocation), and structured schema validation (JSON Schema/Zod) for agent outputs.

### 6.4 Deterministic Settlement Policy Engine
- **FR-4.1:** The Policy Engine must be a deterministic, mathematical component independent of AI prompts.
- **FR-4.2:** Calculation Rules:
  - `BaseAmount` = Contract Agreed Milestone Amount.
  - If any Mandatory Gate fails (e.g., Critical Security Finding or CI Build Failed): `PermittedAmount = $0.00`, Status = `GATE_BLOCKED`.
  - If all criteria are verified: `PermittedAmount = BaseAmount`.
  - If partial delivery policy is enabled in the contract:
    - `VerifiedRatio` = (Count of Verified Criteria) / (Total Criteria).
    - `TentativeAmount` = `BaseAmount * VerifiedRatio`.
    - If Late Delivery penalty applies: `Deduction = BaseAmount * (LateDays * DailyPenaltyRate)`.
    - `PermittedAmount = Max(0, Min(BaseAmount, TentativeAmount - Deduction))`.
- **FR-4.3:** Engine must enforce strict boundary checks: `PermittedAmount` cannot be negative and cannot exceed the original pre-authorized milestone amount under any circumstance.

### 6.5 Financial Review & Human Approval
- **FR-5.1:** Reviewer dashboard shall present side-by-side:
  - Contractual specifications & acceptance criteria.
  - Agent evidence findings & risk reports.
  - Arbitrator advisory recommendation.
  - Deterministic policy breakdown (permitted cap, deductions, gate flags).
- **FR-5.2:** Reviewer can take three explicit actions:
  - `APPROVE`: Authorize settlement up to `PermittedAmount`. Reviewer can adjust downward (with justification) but never upward beyond `PermittedAmount`.
  - `REQUEST_REVISIONS`: Hold payment and generate structured revision requests for the developer.
  - `REJECT`: Reject milestone delivery with documented cause.
- **FR-5.3:** No PayPal capture or payment disbursement may occur without recorded human approval.

### 6.6 PayPal Sandbox Settlement Integration
- **FR-6.1:** System shall integrate with PayPal Sandbox v2 Checkout / Orders & Authorizations API.
- **FR-6.2:** At Contract/Milestone funding, Client creates a PayPal Order with intent `AUTHORIZE` (or `CAPTURE` based on flow specification) for the milestone amount.
- **FR-6.3:** Upon Human Reviewer approval, backend calls PayPal API to capture the approved amount against the authorization ID.
- **FR-6.4:** If the approved amount is less than the authorized amount, the backend captures the approved partial amount and voids the remaining authorization balance.
- **FR-6.5:** System shall maintain idempotency keys on all payment calls to prevent duplicate charge attempts.
- **FR-6.6:** Transaction IDs, capture statuses, and PayPal debug IDs must be persisted to the audit ledger.

### 6.7 Sponsor Integrations
- **FR-7.1 (APIMatic):** System shall define complete OpenAPI 3.0/3.1 specifications for all platform endpoints (Contracts, Milestones, Evidence, Evaluation, Settlement, Audit) and provide interactive, validated API contract documentation.
- **FR-7.2 (Bryntum Gantt):** System shall render contractual delivery timelines, milestone dependencies, planned vs. actual delivery dates, critical paths, and delay warnings.
- **FR-7.3 (AG Grid):** System shall present the interactive Financial Decision Intelligence Ledger displaying milestones, verification percentages, risk levels, agreed amounts, recommended amounts, approved amounts, settlement statuses, and audit drill-downs.

---

## 7. Non-Functional Requirements (NFRs)

### 7.1 Security & Access
- Role-based authorization enforced on all server routes.
- Sanitization of all external inputs (GitHub URLs, diff strings, CI logs).
- Secret management: PayPal credentials and Gemini API keys must reside solely on the server environment.

### 7.2 Financial Integrity & Idempotency
- Every payment capture request must supply a deterministic `PayPal-Request-Id` (UUID based on MilestoneID + SubmissionAttempt).
- Database consistency: State transitions (`SUBMITTED` -> `EVALUATING` -> `RECOMMENDED` -> `APPROVED` -> `CAPTURED`) must be transactional and prevent race conditions.

### 7.3 Observability & Auditability
- Append-only audit log recording:
  - Timestamp (UTC ISO 8601).
  - Actor ID and Role.
  - Event Type (e.g., `MILESTONE_CREATED`, `EVIDENCE_SUBMITTED`, `EVALUATION_COMPLETED`, `APPROVAL_GRANTED`, `PAYMENT_CAPTURED`).
  - Input payload hash / summary.
  - Decision reasoning and state delta.

### 7.4 Performance & Reliability
- AI evaluation pipeline timeout budgeted at <= 30 seconds per agent.
- Frontend rendering of AG Grid and Bryntum Gantt must maintain 60 FPS responsiveness with graceful loading and empty states.

---

## 8. Out-of-Scope (Excluded from MVP)

- Multi-party escrow licensing under state banking regulations (PayPal standard authorization/capture flow is utilized; not a custodial bank).
- Automated git repository cloning and compilation inside the application container (untrusted code execution risk).
- Multi-currency forex hedging.
- Multi-split automated developer payouts across 50 international subcontractors (requires PayPal Payouts / Marketplace approval).
- Arbitrary blockchain smart contract settlement.
