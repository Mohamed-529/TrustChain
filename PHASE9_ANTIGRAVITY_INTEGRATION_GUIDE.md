# MilestoneProof AI — Phase 9 to Antigravity Integration Guide

## 1. Overview & Handoff Objectives

This guide provides the complete engineering specifications for the **Google Antigravity** implementation team to integrate Phase 9 AI agent intelligence, schemas, and prompts into the MilestoneProof AI codebase during Phase 10.

### Responsibilities Split
- **AI Studio (Phase 9 Complete):** Agent behavior design, prompt engineering, JSON output schemas, adversarial dataset, and evaluation verification.
- **Antigravity (Phase 10 Target):** Backend route integration, database migration updates, runtime schema validation middleware, UI rendering (AG Grid & Bryntum Gantt), and automated integration tests.

---

## 2. API Contract Specifications

### 2.1 Trigger Multi-Agent Evaluation
- **Endpoint:** `POST /api/v1/milestones/{milestoneId}/evaluations`
- **RBAC Authorization:** `CLIENT` or `REVIEWER` (or `ADMIN`). Developers are forbidden from triggering their own evaluation (`403 FORBIDDEN_ROLE`).
- **Prerequisites:**
  1. Milestone must be in `SUBMITTED` state.
  2. At least one valid `EvidenceSubmission` must exist for `milestoneId`.
  3. No evaluation must currently be in `EVALUATING` / `RUNNING` status for this milestone.
- **Success Response:** `201 Created`
  - Returns `EvaluationRun` conforming to `#/$defs/EvaluationRun` in `PHASE9_OUTPUT_SCHEMAS.json`.
- **Error Responses:**
  - `400 NO_EVIDENCE_SUBMITTED`: Milestone has no evidence submitted.
  - `403 FORBIDDEN_ROLE`: Actor role lacks evaluation trigger authority.
  - `404 MILESTONE_NOT_FOUND`: Milestone ID does not exist.
  - `409 EVALUATION_ALREADY_RUNNING`: Concurrency conflict (evaluation underway).
  - `422 INVALID_AI_OUTPUT_SCHEMA`: External model returned malformed data.
  - `422 AI_FINANCIAL_BOUNDARY_VIOLATION`: AI attempted prohibited authority action.
  - `504 AI_EVALUATION_TIMEOUT`: Gemini API call exceeded 15,000ms.

### 2.2 List Evaluations for Milestone
- **Endpoint:** `GET /api/v1/milestones/{milestoneId}/evaluations`
- **RBAC Authorization:** Authenticated users belonging to the contract (`CLIENT`, `DEVELOPER`, `REVIEWER`).
- **Success Response:** `200 OK`
  - Array of `EvaluationRun` records sorted by `evaluatedAt DESC`.

### 2.3 Preview Settlement Policy Math (Simulation)
- **Endpoint:** `POST /api/v1/milestones/{milestoneId}/evaluations/preview`
- **RBAC Authorization:** `CLIENT` or `REVIEWER`.
- **Payload:**
  ```json
  {
    "verifiedCriteriaCount": 2,
    "totalCriteriaCount": 3,
    "ciBuildPassed": true,
    "criticalVulnCount": 0,
    "highVulnCount": 0,
    "scannerStatus": "AVAILABLE"
  }
  ```
- **Success Response:** `200 OK`
  - Returns `PolicyCalculationResult` showing eligible gross, deductions, penalties, and permitted maximum amount without mutating database state.

---

## 3. Runtime Validation & Safety Gates

When integrating Phase 9 prompts and schemas, the backend MUST enforce these 4 defense-in-depth filters:

### 3.1 Pre-Scan Injection Filter
```typescript
import { inspectAndIsolateUntrustedEvidence } from './services/EvaluationService.ts';

// 1. Scan developer notes, CI logs, and commit messages
const scanResult = inspectAndIsolateUntrustedEvidence(latestSubmission);
if (scanResult.promptInjectionDetected) {
  // Flag indicators in risk assessment and escalate severity to CRITICAL
}
```

### 3.2 Canonical Citation Sanitizer
Model outputs must never be trusted to invent citation references:
```typescript
const canonicalIdSet = new Set(canonicalRefs.map(r => r.evidenceId));

// Discard any citation ID that does not exist in the server-provided canonical list
crit.evidenceCitations = crit.evidenceCitations.filter(id => canonicalIdSet.has(id));
```

### 3.3 Prohibited Financial Authority Gate
Assert that the AI model generated zero prohibited authority fields:
```typescript
const PROHIBITED_KEYS = [
  'approvedAmountCents',
  'finalPayableAmountCents',
  'paypalOrderId',
  'paypalCaptureId',
  'milestoneStatus',
  'paymentStatus',
  'bypassHumanApproval',
];

for (const key of PROHIBITED_KEYS) {
  if (key in rawAiOutput) {
    throw new AppError(
      422,
      'AI_FINANCIAL_BOUNDARY_VIOLATION',
      `AI evaluator attempted to set prohibited financial authority field '${key}'.`
    );
  }
}
```

### 3.4 Telemetry Override Invariant
Server-authoritative facts MUST override hallucinated AI assessments:
```typescript
// AI cannot claim clean security if raw scanner data shows critical CVEs
const actualCriticalCount = submission.securityScan.findings.filter(f => f.severity === 'CRITICAL').length;
if (actualCriticalCount > 0 || scanResult.promptInjectionDetected) {
  riskAssessment.overallRiskSeverity = 'CRITICAL';
}
```

---

## 4. Frontend UI Integration Specifications

### 4.1 AG Grid Financial Decision Intelligence Ledger
Display evaluation results in the AG Grid ledger (`src/client/FinancialLedger.tsx`):
- **Column 1 — Acceptance Progress:** Display `verifiedCount` / `totalCount` with progress bar renderer.
- **Column 2 — Risk Severity:** Badge renderer:
  - `CRITICAL` -> Red pill (`bg-red-500/20 text-red-400 border-red-500/30`)
  - `HIGH` -> Orange pill (`bg-orange-500/20 text-orange-400 border-orange-500/30`)
  - `MEDIUM` -> Yellow pill (`bg-yellow-500/20 text-yellow-400 border-yellow-500/30`)
  - `NONE` / `LOW` -> Green pill (`bg-emerald-500/20 text-emerald-400 border-emerald-500/30`)
- **Column 3 — Arbitrator Advisory:**
  - `PASS` (`RECOMMEND_APPROVAL`) -> Green checkmark + "Advisory: Ready for Client Approval"
  - `NEEDS_HUMAN_REVIEW` (`RECOMMEND_HOLD`) -> Yellow alert + "Advisory: Manual Review Needed"
  - `FAIL` (`RECOMMEND_REJECTION`) -> Red cross + "Advisory: Rejection Recommended"
- **Column 4 — Permitted Cap:** Formatted currency (`$X,XXX.XX USD`) computed by the deterministic policy engine.
- **Column 5 — Statutory Notice:** Tooltip displaying the mandatory notice:
  *"ADVISORY ONLY: AI evaluation never approves milestones, never sets final payable amounts, and never triggers PayPal operations."*

### 4.2 Bryntum Gantt Control Tower
Reflect evaluation and risk state on the Gantt chart (`src/client/BryntumGanttViewer.tsx`):
- Milestone tasks with `overallRiskSeverity === 'CRITICAL'` or `FAIL` outcome render with an alert indicator icon.
- Unmerged PRs or pending CI tests display a pulsing warning border.
- Schedule recovery proposals must clearly distinguish advisory timeline recommendations from signed contractual baselines.

---

## 5. Automated Test Matrix for Antigravity Phase 10

The following integration test cases must be added to `src/server/__tests__/phase10_agent_integration.test.ts`:

| Test # | Description | Target Invariant |
| :--- | :--- | :--- |
| **T10.1** | Trigger evaluation as CLIENT vs DEVELOPER | Verify 403 FORBIDDEN_ROLE for developer |
| **T10.2** | Concurrency conflict handling | Verify 409 EVALUATION_ALREADY_RUNNING on duplicate trigger |
| **T10.3** | Delimiter isolation and tag escaping | Confirm `</untrusted_evidence>` is neutralized |
| **T10.4** | Canonical citation verification | Verify hallucinated citation IDs are purged |
| **T10.5** | Prohibited authority field rejection | Verify 422 AI_FINANCIAL_BOUNDARY_VIOLATION |
| **T10.6** | Gemini timeout resilience (15,000ms) | Verify 504 AI_EVALUATION_TIMEOUT and state restored to SUBMITTED |
| **T10.7** | Hash-chained audit logging | Verify `EVALUATION_STARTED` and `EVALUATION_COMPLETED` entries in audit chain |
| **T10.8** | Policy Engine Permitted Cap Invariant | Verify human approval cannot exceed `permittedAmountCents` |

---

## 6. Phase 10 Implementation Checklist

- [ ] 1. Copy Phase 9 prompt templates from `PHASE9_AGENT_PROMPTS.md` into `src/server/prompts/`.
- [ ] 2. Register Phase 9 JSON schemas from `PHASE9_OUTPUT_SCHEMAS.json` into OpenAPI specification and runtime Ajv/Zod validator.
- [ ] 3. Update `EvaluationService.ts` to use structured prompt templates with `<contract>`, `<canonical_evidence>`, and `<untrusted_evidence>` XML delimiters.
- [ ] 4. Bind `SettlementPolicyService` directly into the evaluation completion transaction.
- [ ] 5. Connect AG Grid columns to display the 7 mandatory advisory fields.
- [ ] 6. Run automated test suite (`npm test`) to ensure all existing 43 tests pass and new Phase 10 tests achieve 100% pass rate.
