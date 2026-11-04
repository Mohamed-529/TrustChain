# MilestoneProof AI — Product Workflows & State Machine Architecture

---

## 1. End-to-End Core Workflow

The MilestoneProof AI governance lifecycle progresses across six major operational stages:

```
[Contract Definition] ──> [Evidence Ingestion] ──> [Multi-Agent Analysis] 
        │                                                    │
        ▼                                                    ▼
[Audit Logging & Ledger] <── [Payment Settlement] <── [Deterministic Policy & Human Approval]
```

### Stage 1: Contract & Milestone Definition
1. **Client** defines contract metadata (title, total budget, currency, participants: Client, Developer, Reviewer).
2. Client defines payment parameters:
   - Milestone sequence.
   - Milestone target completion date.
   - Milestone contractual fee.
   - Structured Acceptance Criteria (e.g., `AC-1: OAuth2 Google Sign-in implemented`, `AC-2: 80% unit test coverage`).
   - Risk policies (e.g., `MaxAllowedCVSS = 7.0`, `RequirePassingCI = true`, `AllowPartialPayout = false`).
3. Contract is saved in `DRAFT` state, then client activates/funds the authorization. Contract enters `ACTIVE`.

### Stage 2: Evidence Submission
1. **Developer** works on the milestone deliverables.
2. Developer accesses MilestoneProof UI and submits:
   - Repository URL + Branch + Commit SHA(s).
   - Pull Request link + PR description.
   - CI/CD execution report (status: Success/Failure, test count, pass rate, log artifact).
   - Vulnerability/Security scan output (e.g., SAST or dependency audit report).
   - Optional developer notes.
3. System verifies payload schema, generates a submission attempt ID, updates status to `SUBMITTED`, and notifies the orchestrator.

### Stage 3: Multi-Agent Inspection Pipeline
1. **Orchestrator** transitions milestone to `EVALUATING`.
2. **Evidence Agent** runs:
   - Scans PR title, commit messages, code diff chunks, and CI test output logs.
   - Evaluates each Acceptance Criterion:
     - `VERIFIED`: Concrete code/test artifact proves compliance.
     - `PARTIAL`: Code exists but automated tests or coverage are missing.
     - `UNVERIFIED`: No artifacts or diffs match requirement.
     - `CONTRADICTED`: Artifacts explicitly conflict with requirement.
   - Outputs structured `evidenceAnalysis`.
3. **Risk Agent** runs:
   - Parses security scan findings, dependency advisories, and CI failure logs.
   - Classifies vulnerabilities by CVSS severity (Critical, High, Medium, Low).
   - Flags contractual policy violations (e.g., "Found 1 Critical CVE in dependency XYZ").
   - Outputs structured `riskAnalysis`.
4. **Arbitrator Agent** runs:
   - Consumes `evidenceAnalysis` and `riskAnalysis`.
   - Formulates explainable summary with exact citations.
   - Recommends:
     - `RECOMMEND_APPROVAL` (All criteria verified, 0 blocking risks).
     - `RECOMMEND_HOLD` (Missing tests, partial evidence, or remediable medium risks).
     - `RECOMMEND_REJECTION` (Critical security breach, completely missing deliverables, or fake commits).
   - Generates advisory notes for the Reviewer.

### Stage 4: Deterministic Policy Calculation
1. **Deterministic Settlement Engine** ingests:
   - Contractual terms and agreed milestone amount.
   - Gate configuration (`ZeroCriticalRiskGate`, `CIPassGate`).
   - Agent evaluation results.
2. Policy Engine computes:
   - Gate status: `PASSED` or `TRIPPED`.
   - If Gate `TRIPPED` -> `PermittedAmount = $0.00`, Status = `GATE_BLOCKED`.
   - If Gate `PASSED` ->
     - If Full Completion: `PermittedAmount = AgreedAmount`.
     - If Partial Policy enabled: `PermittedAmount = AgreedAmount * (VerifiedCriteriaCount / TotalCriteriaCount) - Deductions`.
     - Boundary clamp: `0 <= PermittedAmount <= AgreedAmount`.
3. Milestone transitions to `PENDING_HUMAN_REVIEW`.

### Stage 5: Human Decision & Approval
1. **Authorized Reviewer** inspects the AG Grid Financial Ledger and Milestone Details.
2. Reviewer compares:
   - Agreed Amount vs. Policy Permitted Cap.
   - Bryntum Gantt schedule (identifying any delivery delays).
   - Agent evidence citations and vulnerability logs.
3. Reviewer executes one of three actions:
   - **Approve:** Approves an amount `$A` where `$0 < $A <= PermittedAmount`.
   - **Request Revision:** Returns milestone to Developer with detailed remediation instructions.
   - **Reject:** Declines milestone settlement.

### Stage 6: Settlement & Audit Record
1. Upon Approval: System calls PayPal Sandbox API to capture authorized funds up to approved amount `$A`.
2. PayPal confirms capture with `CaptureID` and `Completed` status.
3. If partial capture occurs, system voids remaining authorization balance or records balance carryover.
4. Milestone transitions to `SETTLED`.
5. Immutable audit entry appended with timestamp, actor IDs, decision logs, and PayPal transaction hash.

---

## 2. Detailed Workflow Scenarios

### 2.1 Scenario A: Normal Successful Delivery (Happy Path)
- **Context:** Milestone 1 ($2,500) has 3 criteria.
- **Evidence:** Developer provides commit SHA `a1b2c3d`, PR #12 merged, GitHub Actions CI passed (100% test pass), `npm audit` shows 0 vulnerabilities.
- **Agent Analysis:** Evidence Agent verifies all 3 criteria; Risk Agent reports Clean/Zero vulnerabilities; Arbitrator outputs `RECOMMEND_APPROVAL`.
- **Policy Engine:** Gates passed, 3/3 verified -> `PermittedAmount = $2,500.00`.
- **Reviewer Action:** Reviewer clicks Approve for $2,500.00.
- **Settlement:** PayPal captures $2,500.00 authorization; status set to `SETTLED`.

### 2.2 Scenario B: Incomplete Evidence Workflow
- **Context:** Milestone 2 ($3,000) requires REST API endpoints + Swagger documentation.
- **Evidence:** Developer submits PR with code, but CI test report is omitted and API documentation URL is a 404 or missing.
- **Agent Analysis:** Evidence Agent marks Criterion 1 (endpoints) as `VERIFIED`, Criterion 2 (documentation) as `UNVERIFIED`. Risk Agent marks test coverage as `MISSING_EVIDENCE`. Arbitrator outputs `RECOMMEND_HOLD` ("Missing API Documentation and test logs").
- **Policy Engine:** If contract requires 100% completion before release, `PermittedAmount = $0.00`. If partial release allowed, `PermittedAmount = $1,500.00`.
- **Reviewer Action:** Reviewer issues `REQUEST_REVISIONS`, stating "Submit valid API docs and upload test output".
- **Transition:** Milestone transitions from `PENDING_HUMAN_REVIEW` back to `REVISION_REQUESTED`. Developer is prompted to upload missing artifacts.

### 2.3 Scenario C: Failed CI / Broken Build Workflow
- **Context:** Milestone 3 ($4,000) requires core algorithm implementation.
- **Evidence:** Developer submits PR #44. CI log shows build failed with exit code 1 (3 failing unit tests in test suite).
- **Agent Analysis:** Evidence Agent detects code changes but notes `CI_TESTS_FAILED`. Risk Agent trips the `CI_BUILD_FAILURE` rule (Severity: High). Arbitrator outputs `RECOMMEND_HOLD / REJECT`.
- **Policy Engine:** `CIPassGate` is violated. Hard block triggered -> `PermittedAmount = $0.00`.
- **Reviewer Action:** Reviewer rejects or requests revision. Payment cannot be approved until a passing CI build SHA is submitted.

### 2.4 Scenario D: High-Risk Security Finding Workflow
- **Context:** Milestone 1 ($5,000) requires authentication service.
- **Evidence:** Developer submits implementation using an outdated package version with a known remote code execution vulnerability (CVE-2023-XXXX, CVSS 9.8 Critical).
- **Agent Analysis:** Evidence Agent confirms auth routes exist. Risk Agent parses dependency report, flags Critical CVE with CVSS 9.8. Arbitrator warns: "Critical vulnerability detected in auth dependency; payment release prohibited under security gate".
- **Policy Engine:** Mandatory `ZeroCriticalRiskGate` tripped -> `PermittedAmount = $0.00`.
- **Reviewer Action:** Reviewer triggers `REQUEST_REVISIONS` with CVE details. System halts payment authorization.

### 2.5 Scenario E: Human Override Workflow
- **Context:** Agent Arbitrator recommends `RECOMMEND_APPROVAL`, but Human Reviewer discovers client-side visual regressions during manual QA that weren't covered by automated unit tests.
- **Handling:**
  - The human reviewer has constitutional final authority.
  - Reviewer inputs override reason: "Manual QA failed: responsive layout breaks on tablet viewports".
  - Reviewer selects `REQUEST_REVISIONS` or adjusts approved amount downward.
  - System logs: `OVERRIDE_EVENT` in audit ledger, recording that the human diverged from the AI recommendation and recording the required justification.
- **Crucial Boundary:** A human reviewer CANNOT override the deterministic gate upward (i.e. if the policy engine caps at $0.00 due to a critical security violation, the reviewer cannot bypass the security gate to force capture).

### 2.6 Scenario F: PayPal Payment Failure & Retry Handling
- **Context:** Reviewer approves $2,000.00. System initiates PayPal API capture call.
- **Failure:** PayPal API returns HTTP 422 `UNPROCESSABLE_ENTITY` or HTTP 500 / Network timeout.
- **Handling:**
  - Status transitions to `PAYMENT_FAILED`.
  - Transaction error details and PayPal `debug_id` are saved in audit records.
  - System does NOT mark milestone as settled.
  - Reviewer is shown the exact error reason (e.g., expired authorization, insufficient buyer funds in sandbox).
  - A retry action is provided with the identical `PayPal-Request-Id` (idempotency key) to prevent double-charging if the previous call was processed on PayPal's end during the network blip.

### 2.7 Scenario G: Duplicate Submission & Concurrency Protection
- **Context:** Developer or script attempts double-submission of the same milestone simultaneously.
- **Handling:**
  - Optimistic locking and milestone state checks: submissions are rejected if the milestone status is already `EVALUATING` or `PENDING_HUMAN_REVIEW`.
  - Each submission creates an immutable `SubmissionAttempt` record with an incremented revision sequence (v1, v2, v3).
  - Prior evaluations are archived and linked in the audit history.

---

## 3. Milestone State Machine

```
                   ┌────────────────┐
                   │     DRAFT      │
                   └───────┬────────┘
                           │ Contract Activated & Funded
                           ▼
                   ┌────────────────┐
        ┌─────────>│     ACTIVE     │<────────┐
        │          └───────┬────────┘         │
        │                  │ Evidence Submitted
        │                  ▼                  │
        │          ┌────────────────┐         │
        │          │   SUBMITTED    │         │
        │          └───────┬────────┘         │
        │                  │ Orchestrator Triggers
        │                  ▼                  │
        │          ┌────────────────┐         │
        │          │   EVALUATING   │         │
        │          └───────┬────────┘         │
        │                  │ Agents & Policy Complete
        │                  ▼                  │
        │          ┌────────────────┐         │
        │          │ PENDING_REVIEW │         │
        │          └───────┬────────┘         │
        │                  │                  │
        │       ┌──────────┼──────────┐       │
        │       │ Approve  │ Revise   │ Reject│
        │       │          │          │       │
        │       ▼          ▼          ▼       │
        │ ┌──────────┐ ┌────────┐ ┌────────┐  │
        │ │ APPROVED │ │REVISION│ │REJECTED│  │
        │ └─────┬────┘ └───┬────┘ └────────┘  │
        │       │          │                  │
        │       │ PayPal   └──────────────────┘
        │       │ Capture                     
        │       ▼                             
        │ ┌──────────┐                        
        │ │ SETTLED  │                        
        │ └──────────┘                        
        │       │                             
        │       │ Payment Failed              
        │       ▼                             
        └─┌──────────┐                        
          │PAY_FAILED│                        
          └──────────┘                        
```

---

## 4. State Transition Matrix

| Current State | Event Trigger | Next State | Allowed Roles | System Operations |
| :--- | :--- | :--- | :--- | :--- |
| `DRAFT` | `ACTIVATE_CONTRACT` | `ACTIVE` | Client | Creates PayPal auth, sets start dates |
| `ACTIVE` | `SUBMIT_EVIDENCE` | `SUBMITTED` | Developer | Validates input URLs, creates submission record |
| `SUBMITTED` | `START_EVALUATION` | `EVALUATING` | System / Auto | Invokes Evidence & Risk Agents |
| `EVALUATING` | `AGENTS_COMPLETED` | `PENDING_REVIEW` | System / Auto | Computes Policy Engine, generates ledger row |
| `PENDING_REVIEW`| `HUMAN_APPROVE` | `APPROVED` | Reviewer | Records approval amount `$A <= PermittedAmount` |
| `APPROVED` | `EXECUTE_PAYMENT` | `SETTLED` | System / Reviewer | Captures PayPal authorization, writes audit trail |
| `APPROVED` | `PAYMENT_ERROR` | `PAY_FAILED` | System | Logs error, allows idempotent retry |
| `PAY_FAILED` | `RETRY_PAYMENT` | `SETTLED` / `PAY_FAILED` | Reviewer | Re-sends with identical idempotency key |
| `PENDING_REVIEW`| `REQUEST_REVISIONS` | `ACTIVE` | Reviewer | Opens new submission attempt, stores feedback |
| `PENDING_REVIEW`| `REJECT` | `REJECTED` | Reviewer | Voids milestone authorization, marks terminal |
