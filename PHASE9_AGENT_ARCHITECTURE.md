# MilestoneProof AI — Phase 9 Agent Architecture

## 1. Executive Summary & Architectural Scope

MilestoneProof AI is a multi-agent evidence-to-settlement orchestration platform for software engineering contracts. Phase 9 establishes the formal agent behavior specification, prompt engineering framework, structured output schemas, and adversarial evaluation baseline.

In accordance with Phase 9 workspace boundaries:
- **Google AI Studio** owns agent behavior design, system instructions, prompt engineering, structured output validation rules, adversarial resilience, and evaluation test cases.
- **Google Antigravity** owns subsequent backend/frontend integration, REST endpoints, database schema migrations, and automated integration tests (scheduled for Phase 10).
- **Core Principle:** AI agents are strictly advisory. AI never captures, transfers, releases, or voids funds; AI never marks milestones `APPROVED` or `SETTLED`; and AI never overrides the deterministic Settlement Policy Engine or human reviewer decisions.

```
                           +----------------------------------------+
                           |  Developer Evidence Submission         |
                           |  (Commit SHA, PR URL, CI, Security)   |
                           +-------------------+--------------------+
                                               |
                                               v
                     +----------------------------------------------------+
                     |  Stage 0: Ingestion, Hashing & Provenance Gate     |
                     |  - SHA-256 Canonical Digest Computation            |
                     |  - Untrusted Evidence Encapsulation (XML Escape)   |
                     |  - Pre-Evaluation Prompt Injection Scanner         |
                     |  - Independent GitHub REST API Provenance Verification|
                     +-------------------------+--------------------------+
                                               |
                     +-------------------------+--------------------------+
                     |                                                    |
                     v                                                    v
    +----------------------------------+        +----------------------------------+
    |  Stage A: Evidence Analyst       |        |  Stage B: Risk Analyst           |
    |  - Criteria-by-criteria audit    |        |  - Security CVE severity audit   |
    |  - Canonical citation binding    |        |  - Telemetry cross-contradiction |
    |  - Missing proof identification  |        |  - Adversarial signal detection  |
    +-----------------+----------------+        +-----------------+----------------+
                      |                                           |
                      +--------------------+----------------------+
                                           |
                                           v
                     +----------------------------------------------------+
                     |  Stage C: Arbitrator / Review Synthesizer (AI)     |
                     |  - Cross-agent evidence reconciliation             |
                     |  - Explainable rationale & confidence scoring      |
                     |  - Advisory recommendation (PASS/HOLD/REJECT)      |
                     |  - MANDATORY ADVISORY NOTICE ENFORCEMENT           |
                     +---------------------+------------------------------+
                                           |
                                           v
                     +----------------------------------------------------+
                     |  Stage D: Deterministic Settlement Policy Engine   |
                     |  (PURE INTEGER-CENT BUSINESS LOGIC — ZERO AI)      |
                     |  - Verification ratio * Agreed milestone amount    |
                     |  - Late delivery penalty calculation               |
                     |  - Policy gate verification (CI, Scan, Caps)       |
                     |  - Permitted Maximum Settlement Amount             |
                     +---------------------+------------------------------+
                                           |
                                           v
                     +----------------------------------------------------+
                     |  Stage E: Human-in-the-Loop Review Gate            |
                     |  - Authorized Client / Reviewer RBAC               |
                     |  - Review Decision (APPROVE / REJECT / REVISE)     |
                     |  - Approved Amount <= Policy Permitted Amount      |
                     +---------------------+------------------------------+
                                           |
                                           v
                     +----------------------------------------------------+
                     |  Stage F: Financial Settlement & PayPal Sandbox    |
                     |  - Idempotent Server-Side Capture Execution        |
                     |  - Hash-Chained Audit Log Trail                    |
                     +----------------------------------------------------+
```

---

## 2. Multi-Agent Orchestration Topology

The evaluation pipeline comprises three advisory AI agents followed by a deterministic calculation engine:

### 2.1 Evidence Analyst (`EvidenceAgent`)
- **Primary Mission:** Objective verification of submitted technical artifacts against contractual acceptance criteria.
- **Input Sources:**
  - Contractual milestone acceptance criteria (`id`, `title`, `description`, `requiredProofType`, `threshold`).
  - Server-verified canonical evidence references (`COMMIT`, `PULL_REQUEST`, `CI_REPORT`, `SECURITY_SCAN`).
  - Raw developer notes and CI logs (strictly isolated within `<untrusted_evidence>`).
- **Core Rules:**
  - Must evaluate each criterion independently into one of: `VERIFIED`, `PARTIAL`, `UNVERIFIED`, `CONTRADICTED`.
  - Must cite only registered canonical evidence identifiers (e.g., `ev_commit_1`, `ev_ci_1`). AI-invented IDs, raw external URLs, or unsanctioned references are filtered out.
  - Never assume a commit implies requirements are met if changed files are superficial (e.g., README-only edits).
  - Never fabricate test execution or coverage numbers.

### 2.2 Risk Analyst (`RiskAgent`)
- **Primary Mission:** Independent security vulnerability evaluation, contradiction detection, and adversarial threat discovery.
- **Input Sources:**
  - Automated dependency scan findings (package names, CVE IDs, CVSS scores, severities).
  - CI test execution telemetry (total, passed, failed, duration, coverage).
  - PR status and repository coordinates (matching target contract repo).
  - Prompt injection pre-scan indicators.
- **Core Rules:**
  - Cross-check developer claims against raw telemetry. If developer notes claim "100% tests passing" while CI reports failed tests, trigger an explicit `CONTRADICTION` flag.
  - Enforce server-authoritative vulnerability thresholds: Any unmitigated `CRITICAL` vulnerability forces `overallRiskSeverity = CRITICAL`.
  - Detect repository mismatch (PR pointing to a different repo than the contract target).
  - Detect unmerged pull requests (`OPEN` or `CLOSED` without merge).

### 2.3 Review Synthesizer / Arbitrator (`ArbitratorAgent`)
- **Primary Mission:** Explainable reconciliation of evidence findings and technical risks to produce a structured human advisory package.
- **Input Sources:**
  - Verified outputs from `EvidenceAnalyst`.
  - Assessed risks and contradictions from `RiskAnalyst`.
- **Core Rules:**
  - Identify and articulate disagreements between evidence completion and security risk (e.g., all criteria verified, but high risk severity).
  - Formulate one of three recommendation codes:
    - `RECOMMEND_APPROVAL` (Maps to `recommendedOutcome = PASS`)
    - `RECOMMEND_HOLD` (Maps to `recommendedOutcome = NEEDS_HUMAN_REVIEW`)
    - `RECOMMEND_REJECTION` (Maps to `recommendedOutcome = FAIL`)
  - Include the 7 mandatory advisory components: Decision, Citations, Reasoning Summary, Confidence Level, Missing Information, Risk Flags, and Human Review Requirement.
  - Always append the immutable statutory notice: *"ADVISORY ONLY: AI evaluation never approves milestones, never sets final payable amounts, and never triggers PayPal operations."*

### 2.4 Deterministic Settlement Policy Engine (`SettlementPolicyEngine`)
- **Nature:** Non-AI, deterministic, integer-cent mathematical logic.
- **Execution:** Runs after Stage C. AI outputs cannot alter its formula, override gates, or suppress penalties.
- **Formula:**
  $$\text{GrossEligible} = \left\lfloor \frac{\text{AgreedAmountCents} \times \text{VerifiedCriteriaCount}}{\text{TotalCriteriaCount}} \right\rfloor$$
  $$\text{LatePenalty} = \left\lfloor \frac{\text{AgreedAmountCents} \times \text{LateDays} \times \text{DailyPenaltyBps}}{10000} \right\rfloor$$
  $$\text{PermittedAmountCents} = \max(0, \min(\text{AgreedAmountCents}, \text{GrossEligible} - \text{LatePenalty}))$$
- **Hard Policy Gates:**
  - `requirePassingCi`: If CI failed, permitted amount is strictly $0.
  - `requireSecurityScan`: If scanner unavailable, permitted amount is strictly $0.
  - `maxAllowedCriticalVulns`: Exceeded critical CVE count blocks payout ($0).
  - `maxAllowedHighVulns`: Exceeded high CVE count blocks payout ($0).
  - `allowPartialPayout`: If false and verified < total, permitted amount is strictly $0.
  - `provenanceBlocked`: If GitHub verification fails or evidence payload was tampered, permitted amount is strictly $0.

---

## 3. Strict Financial Safety & Authority Invariants

To eliminate any possibility of financial exploitation, the following architectural boundaries are strictly enforced:

### 3.1 Prohibited AI Authority Keys
Raw AI model outputs are subjected to strict schema validation. If an AI response contains any of the following fields, the response is instantly rejected with `422 AI_FINANCIAL_BOUNDARY_VIOLATION`:
- `approvedAmountCents`
- `finalPayableAmountCents`
- `paypalOrderId`
- `paypalCaptureId`
- `milestoneStatus`
- `paymentStatus`
- `bypassHumanApproval`

### 3.2 Evidence Integrity vs. Evidence Truth
MilestoneProof AI maintains a fundamental distinction:
1. **Evidence Integrity:** Did the submitted artifact originate from the stated repository, branch, and commit? Was the payload tampered with after submission?
   - Verified cryptographically via canonical SHA-256 digests and independent GitHub REST API calls (`GitHubVerificationService`).
   - Binary state: `VERIFIED`, `MISMATCH_DETECTED`, `TAMPERED_PAYLOAD`, `PENDING`, or `UNVERIFIED_UNAVAILABLE`.
2. **Evidence Truth:** Does the code actually fulfill the functional acceptance criteria?
   - Evaluated semantically by AI agents and verified by human reviewers.
   - Integrity failure immediately short-circuits truth evaluation: if an artifact is tampered or unverified, all criteria are marked `CONTRADICTED` and settlement is blocked.

### 3.3 State Machine Isolation
AI evaluation can transition a milestone only from `SUBMITTED` -> `EVALUATING` -> `PENDING_REVIEW` (or back to `SUBMITTED` upon evaluation failure).
Under no circumstances can an AI agent transition a milestone to `APPROVED`, `REJECTED`, or `SETTLED`.

---

## 4. Prompt Injection & Adversarial Defense Architecture

Untrusted developer input (commit messages, PR descriptions, test output logs, developer comments) poses a direct prompt-injection risk. The architecture applies defense-in-depth:

```
[ Developer Input ] 
       │
       ▼
[ Layer 1: Pre-Scan Regex Classifier ]
   └── Scans for instruction overrides, role hijacks, approval commands, payment commands.
       │
       ▼
[ Layer 2: Delimiter Isolation & XML Entity Sanitization ]
   └── Neutralizes all closing tags (</untrusted_evidence> -> [ESCAPED_UNTRUSTED_TAG]).
   └── Wraps untrusted text strictly within <untrusted_evidence> delimiters.
       │
       ▼
[ Layer 3: System Prompt Framing ]
   └── Instructions explicitly mandate that text inside <untrusted_evidence> is passive data, never code or instruction.
       │
       ▼
[ Layer 4: Server-Side Telemetry Overrides ]
   └── Even if a model hallucinates low risk under an injection attack, the server re-asserts telemetry facts:
       actual Critical CVE count, CI pass/fail status, and prompt injection indicators override AI fields.
       │
       ▼
[ Layer 5: Post-Execution Schema & Financial Boundary Gate ]
   └── Validates against JSON Schema with additionalProperties: false and prohibited keys assertions.
```

---

## 5. Resilience, Timeouts & Fallback Providers

MilestoneProof AI supports two operational modes via `MultiAgentEvaluatorProvider`:

1. **`LIVE_GEMINI` (Production / Staging):**
   - Connects to Google Gemini API (`gemini-2.5-flash` or `gemini-1.5-pro`).
   - Uses `AbortSignal.timeout(15000)` to ensure evaluations never hang.
   - Enforces `temperature: 0.1` and `responseMimeType: "application/json"`.
   - Redacts all API keys in error messages and audit logs.
   - Retries transient 503/429 errors up to 2 times with exponential backoff before failing closed.

2. **`DETERMINISTIC_MOCK` (Offline / Local Dev / CI):**
   - Deterministic rule-based evaluation harness.
   - Produces reproducible, fully conformant outputs labeled with `isMock: true` and `model: "mock-deterministic-v1"`.
   - Never calls external networks; ideal for automated testing and offline verification.

---

## 6. Audit Trail & Cryptographic Traceability

Every stage of agent evaluation is recorded in the SQLite ACID database and linked to the tamper-evident hash-chained audit ledger (`AuditService`):
- `EVALUATION_STARTED`: Records actor, milestone, submission ID, attempt number, evaluation mode, and timestamp.
- `EVALUATION_COMPLETED`: Records verified criteria count, overall risk severity, recommended outcome, calculated permitted amount, and policy gate flags.
- `EVALUATION_FAILED`: Records error code, sanitized error message, and restores milestone status to `SUBMITTED`.
- The complete `EvaluationRun` record is persisted with exact sub-agent outputs, enabling post-settlement audits and forensic verification.
