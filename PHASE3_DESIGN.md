# PHASE 3 DESIGN — Evidence Intelligence Engine & Multi-Agent Evaluation Pipeline

## 1. Architectural Overview

Phase 3 implements the real milestone evidence-ingestion and multi-agent AI evaluation pipeline for **MilestoneProof AI**, adhering strictly to the modular monolith architecture, OpenAPI 3.0.3 contract ([`openapi.yaml`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/openapi.yaml)), and financial safety boundaries defined in [`AGENTS.md`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/AGENTS.md).

```mermaid
flowchart TD
    Dev["Developer (Authenticated DEVELOPER Role)"] -->|POST /api/v1/milestones/:id/evidence| EvCtrl["EvidenceController"]
    EvCtrl --> EvSvc["EvidenceService"]
    EvSvc -->|Validate GitHub Repo URL, Commit SHA, PR URL & OpenAPI Schema| EvRepo["EvidenceRepository (SQLite WAL/FULL)"]
    EvSvc -->|Build Canonical Evidence References| EvRepo
    EvSvc -->|Append EVIDENCE_SUBMITTED| Audit["AuditService (SHA-256 Hash Chain)"]

    Rev["Reviewer / Client / Developer"] -->|POST /api/v1/milestones/:id/evaluate| EvalSvc["EvaluationService (Orchestrator)"]
    EvalSvc -->|1. Isolate Untrusted Input & Scan for Prompt Injection| Guard["inspectAndIsolateUntrustedEvidence (<untrusted_evidence>)"]
    EvalSvc -->|2. Stage A| AnalystA["Evidence Analyst (EvidenceAgent)"]
    EvalSvc -->|3. Stage B| AnalystB["Risk Analyst (RiskAgent)"]
    EvalSvc -->|4. Stage C (Advisory Only)| Synth["Review Synthesizer (ArbitratorAgent)"]
    EvalSvc -->|5. Stage D (Authoritative Math)| Policy["Deterministic SettlementPolicyEngine"]
    EvalSvc -->|Validate Schemas & Strip Untrusted Citations| EvalRepo["EvaluationRepository (SQLite)"]
    EvalSvc -->|Append EVALUATION_STARTED / COMPLETED / FAILED| Audit
```

---

## 2. Evidence Ingestion & Canonical Reference Registry

Implemented in [`EvidenceService.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvidenceService.ts) and [`DomainRepositories.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/repositories/DomainRepositories.ts):
1. **Strict Input & Format Validation:**
   - Enforces `DEVELOPER` role and verifies `actor.id === contract.developerId`.
   - Validates `repoUrl` (`^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/?$`).
   - Validates `commitSha` (`^[0-9a-fA-F]{7,40}$`).
   - Validates `prUrl` (`^https://github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)/pull/([0-9]+)/?$`) and captures `prStatus` (`MERGED | OPEN | CLOSED`).
   - Captures commit changed-file summaries (`ciReport.changedFiles`), CI test counts/coverage (`ciReport`), and vulnerability findings (`securityScan`).
   - Validates the full payload against `OPENAPI_REQUEST_SCHEMAS.SubmitEvidenceRequest`.
2. **Canonical Server-Verified Evidence References (`buildCanonicalEvidenceReferences`):**
   - Each submission generates 4 server-authoritative `EvidenceReference` objects:
     - `ev_commit_<submissionId>` (`COMMIT`)
     - `ev_pr_<submissionId>` (`PULL_REQUEST`)
     - `ev_ci_<submissionId>` (`CI_REPORT`)
     - `ev_sec_<submissionId>` (`SECURITY_SCAN`)
   - AI evaluators may only cite these canonical IDs; any AI-hallucinated ID or external URL is stripped during output validation.
3. **Zero Code Execution:**
   - Submitted repository URLs, commit SHAs, file lists, and CI logs are inspected strictly as passive data structures; repository code is **never** executed.

---

## 3. Three-Stage Multi-Agent Evaluation Architecture

Implemented in [`EvaluationService.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts):

### A. Evidence Analyst (`EvidenceAnalysis`)
- Evaluates each milestone `AcceptanceCriterion` (`CODE_COMMIT`, `PULL_REQUEST`, `CI_TESTS`, `SECURITY_SCAN`, `API_DOCS`) against the submitted artifacts.
- Populates `missingEvidence: string[]`, `factualObservations: string[]`, `criteriaResults: CriterionVerificationResult[]`, `verifiedCount`, `totalCount`, and `evidenceReferences: EvidenceReference[]`.

### B. Risk Analyst (`RiskAssessment`)
- Analyzes `securityScan` (`criticalVulnCount`, `highVulnCount`, `scannerStatus`), `ciReport` (`ciBuildPassed`), PR state, and commit file summaries.
- Detects:
  - Repository mismatch between `repoUrl` and `prUrl`.
  - Contradictory CI status (`status === 'SUCCESS'` while `failedTests > 0`, or `passedTests + failedTests !== totalTests`).
  - Unmerged (`OPEN`) or rejected (`CLOSED`) pull requests.
  - Superficial/stale commits (e.g., only `README.md` modified) and missing test files (`missingTestSignals`).
  - Contradictions between `developerNotes` claims and actual CI/CVE telemetry (`contradictions`).
  - Adversarial prompt-injection attempts (`promptInjectionDetected`, `promptInjectionIndicators`).

### C. Review Synthesizer (`ReviewSynthesis`)
- Combines `EvidenceAnalysis` and `RiskAssessment`.
- Identifies explicit `disagreements: string[]` between evidence verification and risk findings.
- Produces `recommendedOutcome`: `'PASS' | 'FAIL' | 'NEEDS_HUMAN_REVIEW'` (and corresponding OpenAPI `recommendation`: `'RECOMMEND_APPROVAL' | 'RECOMMEND_HOLD' | 'RECOMMEND_REJECTION'`).
- Enforces `isAdvisoryOnly: true` and attaches a clear `advisoryNotice`.

---

## 4. Strict Financial Safety & Prompt-Injection Boundaries

1. **Advisory-Only AI Boundary (`assertNoProhibitedAuthorityFields`):**
   - If any evaluator stage outputs prohibited authority keys (`approvedAmountCents`, `finalPayableAmountCents`, `paypalOrderId`, `paypalCaptureId`, `milestoneStatus`, `paymentStatus`, `bypassHumanApproval`), `EvaluationService` throws `422 AI_FINANCIAL_BOUNDARY_VIOLATION` and aborts the evaluation.
   - Upon completion of an evaluation (even when `recommendedOutcome === 'PASS'`), the milestone transitions strictly to `'PENDING_REVIEW'` (never `'APPROVED'` or `'SETTLED'`), and `paymentStatus` remains untouched.
   - The deterministic [`calculateDeterministicPolicy`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts) function calculates `permittedAmountCents` using integer-cent arithmetic.
2. **Prompt-Injection Defense (`inspectAndIsolateUntrustedEvidence`):**
   - Neutralizes any embedded `<untrusted_evidence>` / `</untrusted_evidence>` breakout tags in `developerNotes` and `ciReport.logSummary`, wrapping untrusted text inside `<untrusted_evidence>...</untrusted_evidence>`.
   - Scans untrusted text against adversarial patterns (`INSTRUCTION_OVERRIDE_ATTEMPT`, `SYSTEM_ROLE_HIJACK_ATTEMPT`, `XML_TAG_BREAKOUT_ATTEMPT`, `UNAUTHORIZED_APPROVAL_COMMAND`, `UNAUTHORIZED_PAYMENT_COMMAND`).
   - When detected, forces `overallRiskSeverity = 'CRITICAL'` and `recommendedOutcome = 'FAIL'`.

---

## 5. Reproducible 3-Milestone Demo Scenario

Defined in [`DemoEvidenceFixtures.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/DemoEvidenceFixtures.ts) and seeded on `contract_seed_01` (*"Core Payment Gateway & OAuth2 Microservice Contract"*, `$8,500.00` total budget):

| Milestone ID | Title & Agreed Budget | Demo Fixture Key | Evaluation Outcome & Reason |
| :--- | :--- | :--- | :--- |
| `ms_seed_01` | Milestone 1: OAuth2 Service & Unit Test Suite (`$2,500.00`) | `SUCCESSFUL_SUBMISSION` | **`PASS` (`RECOMMEND_APPROVAL`)** — 2/2 criteria verified (`MERGED` PR #42, 64/64 tests passing with 91.5% coverage, 0 CVEs). Policy engine permits `250000` cents (`$2,500.00`). |
| `ms_seed_02` | Milestone 2: OpenAPI 3.0 Spec & Settlement Webhook Engine (`$3,500.00`) | `INCOMPLETE_SUBMISSION` | **`NEEDS_HUMAN_REVIEW` (`RECOMMEND_HOLD`)** — 1/2 criteria verified (`openapi.yaml` delivered, but PR #57 is still `OPEN` and dependency security scan status is `UNAVAILABLE`). Policy gate `GATE_SECURITY_SCANNER_UNAVAILABLE` blocks payout (`0` cents permitted). |
| `ms_seed_03` | Milestone 3: Production Security Hardening & Ledger Reconciliation (`$2,500.00`) | `SUSPICIOUS_CONTRADICTORY_SUBMISSION` | **`FAIL` (`RECOMMEND_REJECTION`)** — 0/2 criteria verified. PR #99 points to an unrelated repository and is `CLOSED`, CI claims `SUCCESS` despite 18 failed tests, only `README.md` changed, and Trivy found `CVE-2026-9901` (`CRITICAL`, CVSS 9.8). Policy engine blocks payout (`0` cents permitted). |
