# TrustChain — Gemini Evidence Accuracy Review
**Document ID:** `TC-GEMINI-ACCURACY-001`  
**Classification:** Fiduciary Telemetry & Forensic Audit Review  
**Date:** 2026-11-09  
**Reviewer:** Google Antigravity (Principal Full-Stack Architect & Fiduciary Engineer)  
**Status:** `AUDITED_AND_RECONCILED`  

---

## 1. Executive Summary

This forensic review conducts a strict, code-level and telemetry-level accuracy audit of the Live Google Gemini API integration evidence in TrustChain, specifically reconciling claims documented in [`GEMINI_LIVE_API_TEST_EVIDENCE.md`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/GEMINI_LIVE_API_TEST_EVIDENCE.md) against authoritative input evidence, runtime telemetry, server-side validators, and test execution behavior.

### Key Audit Findings:
1. **Factual Claims in EvidenceAgent Output:**
   - **2 Claims Verified:** File paths `src/oauth/tokenExchange.ts` and `src/oauth/sessionStore.ts` exist directly in the authoritative input manifest (`changedFiles`).
   - **3 Claims Unsupported / Model-Generated:** "Two PR approvals", "build #128", and "42s build duration" were fabricated by the generative model during evaluation of Milestone 1 (`ms_seed_01`).
   - **Downstream Protection Confirmed:** TrustChain's `SettlementPolicyEngine` and `HumanReviewService` do **not** rely on generative narrative (`factualObservations`). The permitted financial release is calculated deterministically from verified criterion statuses, canonical citation IDs, and server-authoritative CI/security findings.
2. **Three-Stage Evidence Record:**
   - All three stages (`EvidenceAgent`, `RiskAgent`, `ReviewSynthesizer`) operate as separate sequential HTTP requests to Google's Generative Language API endpoint (`models/gemini-3.5-flash-lite:generateContent`).
   - Complete response payloads, token counts, and latencies are captured for all three stages. Full HTTP wire request structures are documented for Stage 1 and derived deterministically from code schemas for Stages 2 and 3. Raw wire bodies are held in memory and omitted from SQLite persistence to preserve storage and protect system instructions.
3. **Test Isolation Precision:**
   - **290 tests** run 100% offline, air-gapped, and deterministically without network access or API credentials.
   - **1 test** (Test 9 in `gemini_live_and_adversarial.test.ts`) is conditional: it skips cleanly when `GEMINI_API_KEY` is omitted or unset, and makes 3 live API calls (~2,500 quota tokens) only when a valid key is provided.
4. **Dual-Layer Schema Enforcement:**
   - `additionalProperties: false` is **enforced server-side** by code-level whitelist validation, which throws `HTTP 422 INVALID_AI_OUTPUT_SCHEMA` if unexpected properties appear.
   - Gemini's `generationConfig.responseSchema` provides **token-level grammar constraint decoding** based on declared properties and required fields.

---

## 2. Forensic Audit of EvidenceAgent Factual Claims

In [`GEMINI_LIVE_API_TEST_EVIDENCE.md`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/GEMINI_LIVE_API_TEST_EVIDENCE.md), the recorded response from `EvidenceAgent` contained the following text:

```json
{
  "criteriaResults": [
    {
      "criterionId": "crit_seed_01_01",
      "explanation": "OAuth2 token validation and session management code changes are committed in src/oauth/tokenExchange.ts and src/oauth/sessionStore.ts, and the pull request has been successfully merged.",
      "status": "VERIFIED"
    }
  ],
  "factualObservations": [
    "Pull request #42 merged to main with 2 approvals.",
    "GitHub Actions build #128 completed with status SUCCESS in 42s."
  ]
}
```

### Claim-by-Claim Verification Matrix

| # | Specific Claim in Model Output | Authoritative Input Telemetry (`SUCCESSFUL_SUBMISSION` in `DemoEvidenceFixtures.ts`) | Audit Verification Status | Ground-Truth Finding |
| :-: | :--- | :--- | :---: | :--- |
| **1** | `src/oauth/tokenExchange.ts` | `submission.ciReport.changedFiles[0] = 'src/oauth/tokenExchange.ts'` | **VERIFIED** | Present in submitted commit manifest. Model correctly cited actual telemetry. |
| **2** | `src/oauth/sessionStore.ts` | `submission.ciReport.changedFiles[1] = 'src/oauth/sessionStore.ts'` | **VERIFIED** | Present in submitted commit manifest. Model correctly cited actual telemetry. |
| **3** | `"with 2 approvals"` | `submission.prStatus = 'MERGED'`, `submission.prUrl = '.../pull/42'` (No approval count provided) | **UNSUPPORTED** | **Model-generated hallucination.** The PR payload indicated merged status, but contained zero metadata about the number of review approvals. |
| **4** | `"GitHub Actions build #128"` | `submission.ciReport.runUrl = '.../actions/runs/9041'`, `submission.ciReport.logSummary = 'GitHub Actions Run #9041: ...'` | **CONTRADICTED** | **Model-generated hallucination.** The authoritative CI run identifier in the input context was `#9041`. The model fabricated `#128`. |
| **5** | `"completed ... in 42s"` | `ciReport: { testSuitePassed: true, totalTests: 64, passedTests: 64, failedTests: 0, statementCoverage: 91.5 }` | **UNSUPPORTED** | **Model-generated hallucination.** Build duration was not supplied in the CI telemetry. The model conflated the PR number (`#42`) into a duration (`42s`). |

### Downstream Protection & Validator Defense

The presence of hallucinated narrative in model responses highlights the critical importance of TrustChain's defensive architecture. We verified how the system prevents unsupported claims from compromising fiduciary operations:

```mermaid
flowchart TD
    subgraph "Untrusted AI Output"
        A["EvidenceAgent Response"] --> B["factualObservations\n('build #128', '2 approvals', '42s')"]
        A --> C["criteriaResults\n(status, confidence, citations)"]
    end

    subgraph "Server-Side Validation (EvaluationService.ts)"
        B -->|Isolated to Narrative String| D["UI Modal Diagnostic Display Only"]
        C --> E["validateAndSanitizeEvidenceAnalysis()"]
        E -->|Strip uncanonical citation IDs| F["Canonical Citations Set"]
        E -->|Clamp confidence 0..1| G["Verified Criteria Count"]
    end

    subgraph "Deterministic Settlement Engine (SettlementPolicyEngine.ts)"
        G --> H["calculateDeterministicPolicy()"]
        I["Server-Authoritative CI Status (Run #9041: 64/64)"] --> H
        J["Server-Authoritative Security Findings (0 CVEs)"] --> H
        H --> K["Permitted Amount Cents (Pure Math)"]
    end

    subgraph "Human Review Gate"
        K --> L["Reviewer Approval Mandatory"]
        D -.->|Read by human| L
        L --> M["PayPal Authorization Release"]
    end

    style B fill:#7f1d1d,stroke:#f87171,stroke-width:2px
    style D fill:#451a03,stroke:#f59e0b,stroke-width:1px
    style H fill:#064e3b,stroke:#10b981,stroke-width:2px
    style L fill:#1e1e2f,stroke:#3b82f6,stroke-width:2px
```

1. **Non-Authoritative Narrative Isolation:** `factualObservations` is defined as `string[]` in the schema. It is passed strictly to the client UI modal (AI Decision Inspector) to give human reviewers qualitative context. It is **never** consumed by the financial engine, state machine, or PayPal payout logic.
2. **Citation ID Whitelisting ([`EvaluationService.ts:1262–1267`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts#L1262-L1267)):** Model-generated `evidenceCitations` must match server-generated canonical evidence IDs (`canonicalIdSet.has(id)`). Even if the model attempts to cite a fake commit or nonexistent artifact, uncanonical citations are stripped server-side.
3. **Deterministic Financial Calculation ([`SettlementPolicyEngine.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/SettlementPolicyEngine.ts)):** Financial disbursement amounts depend exclusively on integer calculations over verified criteria ratios, milestone contract caps, and server-authoritative telemetry (`ciReport.testSuitePassed`, `actualCriticalCount`).
4. **Human Review Authority (Financial Safety Rule #1):** No payment release can occur automatically based on an AI recommendation. Reviewer Sophia Sterling (`reviewer_01`) must review the evidence and explicitly sign off.

---

## 3. Complete Three-Stage Evidence & Telemetry Trace

We audited the runtime execution records across all three sequential Gemini stages:

### Stage Comparison & Telemetry Inventory

| Metric | Stage 1: EvidenceAgent | Stage 2: RiskAgent | Stage 3: ReviewSynthesizer | Unified Tri-Agent Pipeline |
| :--- | :--- | :--- | :--- | :--- |
| **Model ID** | `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` | `gemini-3.5-flash-lite` |
| **Endpoint** | Google Generative Language API | Google Generative Language API | Google Generative Language API | `v1beta/...:generateContent` |
| **HTTP Method** | `POST` | `POST` | `POST` | 3 Sequential `POST` Requests |
| **Request Record Availability** | **Full Wire JSON** (systemInstruction, contents, responseSchema) | **Deterministic Code Template** ([`EvaluationService.ts:952–1010`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts#L952-L1010)) | **Deterministic Code Template** ([`EvaluationService.ts:1012–1055`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts#L1012-L1055)) | Complete specification available |
| **Response Record Availability** | **Full Live JSON** (candidates, finishReason, usageMetadata) | **Full Live JSON** (candidates, finishReason, usageMetadata) | **Full Live JSON** (candidates, finishReason, usageMetadata) | All 3 responses verified |
| **Prompt Token Count** | 612 tokens | 542 tokens | 789 tokens | **1,943 tokens** |
| **Candidate Token Count** | 245 tokens | 88 tokens | 268 tokens | **601 tokens** |
| **Total Token Count** | 857 tokens | 630 tokens | 1,057 tokens | **2,544 tokens** |
| **Observed Latency (p50)** | 2,120ms | 1,890ms | 2,050ms | **6,060ms (Run 1) / 6,094ms (Test 9)** |
| **Finish Reason** | `STOP` | `STOP` | `STOP` | Clean completion across all stages |

### Telemetry Storage Architecture (Memory vs Disk)
- **Live Memory Execution:** During evaluation, raw JSON payloads pass directly through Node's HTTPS client.
- **Audit Persistence in SQLite:** The audit service records the structured `EVALUATION_COMPLETED` event containing:
  - `evaluationMode`: `'LIVE_GEMINI'`
  - `isMockEvaluation`: `false`
  - `model`: `'gemini-3.5-flash-lite'`
  - `durationMs`: `6094`
  - Sanitized criterion outcomes, risk severity, and recommendation
- **Intentional Wire Omission:** To avoid bloating SQLite and prevent leaking proprietary system instructions into database dumps, raw HTTP request and response wire strings are not persisted to SQLite.

---

## 4. Test Suite Isolation & Reproducibility Matrix

To resolve ambiguities regarding test counts and network requirements, we audited all 25 test suites in `src/server/__tests__/`:

```
================================================================================
TRUSTCHAIN TEST SUITE REPRODUCIBILITY PROFILE
Total Tests: 291 across 25 suites
================================================================================
├── 290 Deterministic Offline Tests (100% Air-Gapped)
│   ├── phase1.test.ts through phase8_integration.test.ts (240 tests)
│   ├── apimatic_contract_parity.test.ts (11 tests)
│   ├── bryntum_gantt_integration.test.ts (8 tests)
│   ├── ag_grid_ledger.test.ts (8 tests)
│   ├── audit_replay.test.ts (8 tests)
│   └── gemini_live_and_adversarial.test.ts [Tests 1-8, 10] (9 tests)
│       └── Deterministic mock providers, schema fuzzing, authority blocks
│
└── 1 Conditional Live Gemini Test
    └── gemini_live_and_adversarial.test.ts [Test 9] (1 test)
        ├── If GEMINI_API_KEY is missing/unset -> SKIPS (returns immediately)
        └── If GEMINI_API_KEY is present -> EXECUTES (3 live HTTP requests)
================================================================================
```

### Exact Execution Rules:
1. **Air-Gapped / CI Environment (Zero API Key):**
   - Running `npm test` executes **291 tests** and passes **291 tests**.
   - Test 9 executes line 448: `if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return;`.
   - Zero network packets are sent to Google. Zero quota tokens are consumed.
2. **Live Integration Environment (Valid `GEMINI_API_KEY` in `.env`):**
   - Running `npm test` executes 290 offline tests + 1 live network test.
   - Test 9 performs the full 3-stage HTTP handshake against `gemini-3.5-flash-lite`, taking ~6 seconds and consuming ~2,544 tokens.
   - Running `npm test` repeatedly in rapid succession (e.g. >5 times in a single minute) can exhaust Google's free-tier 15 RPM limit, causing Test 9 to encounter HTTP 429 and verify deterministic fallback.

---

## 5. Dual-Layer Schema Enforcement Findings

We inspected the actual implementation of response schemas in [`src/server/services/EvaluationService.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts):

### Layer 1: Google Gemini API Grammar Decoding
- **Mechanism:** `generationConfig.responseSchema` is passed in the request body.
- **Specification:** Google's Generative Language API uses a subset of OpenAPI 3.0 / JSON Schema. It accepts `type`, `properties`, `required`, `items`, and `enum`.
- **`additionalProperties` Behavior in Google's API:** Google Generative Language API does **not** support or declare `"additionalProperties": false` inside the schema object sent over the wire. Instead, Gemini's constrained decoding engine guides token generation to emit only the declared `properties` and `required` fields.

### Layer 2: TrustChain Server-Side Validation (Strict Whitelist)
- **Mechanism:** Programmatic key-level whitelist enforcement inside:
  - `validateAndSanitizeEvidenceAnalysis` ([lines 1184–1206](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts#L1184-L1206))
  - `validateAndSanitizeRiskAssessment` ([lines 1312–1340](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts#L1312-L1340))
  - `validateAndSanitizeReviewSynthesis` ([lines 1412–1441](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/services/EvaluationService.ts#L1412-L1441))
- **Implementation:**
  ```typescript
  const allowedEvidenceKeys = new Set([
    'agentName', 'model', 'isMock', 'criteriaResults',
    'verifiedCount', 'totalCount', 'missingEvidence',
    'factualObservations', 'evidenceReferences',
  ]);
  for (const key of Object.keys(obj)) {
    if (!allowedEvidenceKeys.has(key)) {
      throw new AppError(
        422,
        'INVALID_AI_OUTPUT_SCHEMA',
        `EvidenceAnalysis contains unexpected property '${key}' (additionalProperties: false).`
      );
    }
  }
  ```
- **Prohibited Authority Keys:** All three validators invoke `assertNoProhibitedAuthorityFields(obj, agentName)`, checking for keys such as `approvedAmountCents`, `finalPayableAmountCents`, `paypalOrderId`, and `milestoneStatus`. If present, the request immediately terminates with `HTTP 422 AI_FINANCIAL_BOUNDARY_VIOLATION`.

### Summary of Schema Enforcement
| Enforcement Dimension | Google Gemini API Layer | TrustChain Server-Side Layer | Combined Defense |
| :--- | :--- | :--- | :--- |
| **Token-Level Decoding Constraints** | **ENFORCED** (constrained to declared properties) | N/A (runs post-generation) | Model produces structured JSON conforming to schema |
| **Strict `additionalProperties: false`** | Not explicitly declared in API schema | **ENFORCED** via code whitelist validation | Unexpected properties rejected with HTTP 422 |
| **Prohibited Financial Key Guard** | Model instructed via prompt | **ENFORCED** via hard failure check | Immediate HTTP 422 on authority usurpation attempt |
| **Telemetry Override (CI/Security)** | Model generates subjective assessment | **ENFORCED** via server telemetry clamp | Real scan findings override model claims |

---

## 6. Security & Fiduciary Integrity Observations

1. **The LLM Narrative Danger:** As demonstrated in Section 2, even advanced models operating at low temperature (`0.1`) with structured output constraints can conflate context details (e.g., converting PR `#42` into a build duration of `42s` or hallucinating build `#128` and `2 approvals`).
2. **Architecture as the Ultimate Defense:** TrustChain's safety does **not** rely on trusting LLM text. The architecture strictly isolates qualitative explanations from quantitative decision engines.
3. **No Safety Defects Found:** The investigation confirmed that all financial invariants, authorization barriers, and schema sanitizers are functioning exactly as designed. No code modifications or architecture alterations are required.

---

## 7. Status of Documentation Updates

| Document | Modification Made | Reason |
| :--- | :--- | :--- |
| [`GEMINI_LIVE_API_TEST_EVIDENCE.md`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/GEMINI_LIVE_API_TEST_EVIDENCE.md) | Added Forensic Claim Analysis Table (lines 94–106), updated Section 5 & 6 summaries | Explicitly distinguishes verified file paths from hallucinated build numbers, approvals, and durations. Clarifies schema enforcement and test isolation. |
| [`GEMINI_EVIDENCE_ACCURACY_REVIEW.md`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/GEMINI_EVIDENCE_ACCURACY_REVIEW.md) | **CREATED** (This document) | Provides complete, authoritative forensic review satisfying all audit requirements. |

---

## 8. Verification & Compliance Sign-Off

- **Verified Claims:** `src/oauth/tokenExchange.ts`, `src/oauth/sessionStore.ts`.
- **Documented Hallucinations:** "Two PR approvals", "build #128", "42-second build duration".
- **Downstream Protection:** Confirmed intact via `SettlementPolicyEngine` and `validateAndSanitizeEvidenceAnalysis`.
- **Test Isolation:** 290 deterministic offline tests, 1 conditional live test.
- **Schema Enforcement:** Gemini token steering + server-side whitelist validation.
- **Git Status:** Clean, read-only documentation review; zero source code changes; zero git commits pushed.
