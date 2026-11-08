# TrustChain Dispute Evidence Pack — Architecture & Technical Specification

**Version:** 1.0.0  
**Schema Version:** `mpai-dispute-pack-v1`  
**Status:** Approved for Implementation  
**Primary Integration Workspace:** Google Antigravity  

---

## 1. Executive Summary & Objective

In software development contracts, disagreements frequently arise regarding whether deliverables fulfill contractual acceptance criteria, whether test and build telemetry was tampered with, whether deadlines were met, and whether human review decisions complied with agreed payment terms.

The **TrustChain Dispute Evidence Pack** is a structured, traceable, and tamper-evident aggregation engine. It compiles existing, immutable TrustChain records into an authoritative, portable evidence package to support objective human arbitration.

### Non-Goals & Invariant Boundaries

> [!CRITICAL]
> **Strict Financial Safety & Non-Agentic Arbitration Invariants:**
> 1. **No Automated Dispute Judge:** The Dispute Evidence Pack organizes and traces evidence; it **never** renders a binding legal or arbitral ruling.
> 2. **Zero Financial Mutation:** Generating, viewing, or exporting a dispute pack is strictly read-only. It cannot authorize, capture, void, or transfer funds.
> 3. **AI is Strictly Advisory:** All AI evaluations (Evidence Agent, Risk Agent, Review Synthesizer) are explicitly branded with `isAdvisory: true` and documented with warnings that AI recommendations cannot approve milestones or override contract terms.
> 4. **No Fabricated Evidence:** If an artifact, CI log, commit signature, or human approval is missing, it is explicitly flagged as `UNAVAILABLE` or `UNVERIFIED`—never imputed or simulated.
> 5. **Deterministic Policy Preservation:** Permitted settlement calculations remain governed by the deterministic contract formula, verified by server-side math, not LLM conjecture.

---

## 2. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               DISPUTE EVIDENCE PACK ENGINE                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                              AGGREGATION SOURCES                               │   │
│   │                                                                                │   │
│   │  [ Contract & Milestones ] ──> Agreed Scope, Acceptance Criteria, Deadlines   │   │
│   │  [ Evidence Submissions  ] ──> Repos, PRs, Commits, CI Logs, Vulnerability Scans│   │
│   │  [ Evidence Passport     ] ──> Cryptographic Node/Edge Graph & Attestation     │   │
│   │  [ Audit Replay Engine   ] ──> Hash-Chain Integrity & Reconstructed Lifecycles │   │
│   │  [ AI Advisory Synthesis ] ──> Advisory Notes (Branded `isAdvisory: true`)     │   │
│   │  [ Settlement Policy     ] ──> Deterministic Payable Amounts & Gate Checks     │   │
│   │  [ Human Review Records  ] ──> Approval / Rejection / Override Justifications  │   │
│   │  [ PayPal Transaction Log] ──> Order IDs, Authorization Holds, Capture History │   │
│   │  [ Immutable Audit Logs  ] ──> Chronological Event Trail & Actor Attribution   │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │                                             │
│                                          ▼                                             │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                     DETERMINISTIC TIMELINE RECONSTRUCTION                      │   │
│   │  - Sort primary: timestamp ASC                                                 │   │
│   │  - Sort secondary (tie-breaker): seq ASC / deterministic event ID              │   │
│   │  - Standardized categorizations: SUBMISSION, VERIFICATION, AI_ADVISORY,        │   │
│   │    SETTLEMENT, HUMAN_DECISION, PAYMENT, AUDIT_ANCHOR, DISPUTE                  │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │                                             │
│                                          ▼                                             │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                  TWO-STAGE NON-CIRCULAR CRYPTOGRAPHIC DIGEST                   │   │
│   │                                                                                │   │
│   │  Stage 1: Compute packContentDigestSha256 = SHA256(canonicalJson(payload))     │   │
│   │  Stage 2: db.withTransaction(() => {                                           │   │
│   │             auditLog = auditService.appendWithinTx({                           │   │
│   │               action: 'DISPUTE_PACK_GENERATED',                                │   │
│   │               payload: { packId, packContentDigestSha256 }                     │   │
│   │             })                                                                 │   │
│   │             finalDigest = SHA256(canonicalJson(payload + auditRef))            │   │
│   │             repo.save(packWithFinalDigest)                                     │   │
│   │           })                                                                   │   │
│   └──────────────────────────────────────┬─────────────────────────────────────────┘   │
│                                          │                                             │
│                                          ▼                                             │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                               CONSUMPTION APIS                                 │   │
│   │  - POST .../milestones/:id/dispute-pack     (Generate & Anchor Snapshot)       │   │
│   │  - GET  .../dispute-packs/:packId           (Inspect Pack Details)             │   │
│   │  - GET  .../dispute-packs/:packId/verify    (Cryptographic Tamper Check)       │   │
│   │  - GET  .../dispute-packs/:packId/export    (Sanitized JSON Export)            │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model & Domain Types (`mpai-dispute-pack-v1`)

### 3.1 Type Definitions (`src/types/domain.ts`)

```typescript
export type DisputePackStatus =
  | 'INITIALIZED'
  | 'COMPLETE'
  | 'INCOMPLETE_EVIDENCE'
  | 'CORRUPTED_INTEGRITY';

export type DisputeTimelineEventCategory =
  | 'CONTRACT_MILESTONE'
  | 'SUBMISSION'
  | 'VERIFICATION'
  | 'AI_ADVISORY'
  | 'SETTLEMENT_POLICY'
  | 'HUMAN_DECISION'
  | 'PAYMENT'
  | 'AUDIT_ANCHOR'
  | 'DISPUTE';

export interface DisputeTimelineEvent {
  id: string;
  seq?: number;
  timestamp: string;
  category: DisputeTimelineEventCategory;
  action: string;
  actorId: string;
  actorRole: string;
  summary: string;
  referenceId?: string;
  details?: Record<string, unknown>;
}

export interface DisputeEvidencePack {
  id: string;
  schemaVersion: 'mpai-dispute-pack-v1';
  contractId: string;
  milestoneId: string;
  disputeStatus: DisputePackStatus;
  
  contractSummary: {
    title: string;
    description: string;
    clientId: string;
    developerId: string;
    reviewerId: string;
    totalBudgetCents: number;
    currency: string;
    status: string;
    version: number;
  };

  milestoneSummary: {
    sequenceOrder: number;
    title: string;
    description: string;
    agreedAmountCents: number;
    deadlineIso: string;
    status: string;
    paymentStatus: string;
    acceptanceCriteria: AcceptanceCriterion[];
  };

  evidenceSubmissions: {
    totalSubmissions: number;
    latestSubmission: EvidenceSubmission | null;
    submissionHistory: Array<{
      id: string;
      attemptNumber: number;
      submittedAt: string;
      commitSha: string;
      branch: string;
      prUrl: string;
      prStatus: string;
      payloadSha256: string;
      ciStatus: string;
      securityFindingsCount: number;
    }>;
  };

  provenanceAndVerification: {
    provenanceStatus: string;
    commitVerified: boolean;
    commitSigner?: string | null;
    ciWorkflowValid: boolean;
    ciRunUrl?: string | null;
    provenanceRecordId?: string | null;
  };

  passportSummary: {
    available: boolean;
    passportId?: string;
    overallStatus?: string;
    passportDigestSha256?: string;
    isCryptographicallyValid?: boolean;
    criteriaSummary?: {
      total: number;
      verified: number;
      failed: number;
      insufficient: number;
      conflicting: number;
    };
    graphNodesCount?: number;
    graphEdgesCount?: number;
  };

  auditReplaySummary: {
    replayed: boolean;
    isCryptographicallyValid: boolean;
    isLogicallyConsistent: boolean;
    totalEventsInspected: number;
    replayStatus: string;
    findingsCount: number;
    findings: Array<{
      category: string;
      severity: string;
      code: string;
      message: string;
    }>;
  };

  aiAdvisoryAssessment: {
    available: boolean;
    isAdvisory: true; // MANDATORY INVARIANT
    advisoryDisclaimer: string;
    evidenceAgentFindings?: {
      model: string;
      verifiedCount: number;
      totalCount: number;
      missingEvidence: string[];
    };
    riskAgentFindings?: {
      model: string;
      overallRiskSeverity: string;
      promptInjectionDetected: boolean;
      suspiciousSignals: string[];
    };
    reviewSynthesizerRecommendation?: {
      model: string;
      recommendedOutcome: string;
      disagreements: string[];
      reasoning: string;
    };
  };

  settlementOutcome: {
    evaluated: boolean;
    permittedAmountCents: number;
    penaltyCents: number;
    gateBlocked: boolean;
    blockingReasons: string[];
    calculationTimestamp?: string;
  };

  humanApprovalHistory: {
    recorded: boolean;
    latestDecision?: string;
    approvedAmountCents?: number;
    reviewerId?: string;
    decidedAt?: string;
    justification?: string;
    isOverride?: boolean;
    allDecisions: Array<{
      id: string;
      decision: string;
      approvedAmountCents: number;
      reviewerId: string;
      decidedAt: string;
      justification: string;
    }>;
  };

  paymentLifecycleHistory: {
    recorded: boolean;
    latestStatus?: string;
    transactions: Array<{
      id: string;
      paypalOrderId: string | null;
      paypalAuthorizationId: string | null;
      paypalCaptureId: string | null;
      authorizedAmountCents: number;
      capturedAmountCents: number;
      currency: string;
      status: string;
      executionMode: string;
      updatedAt: string;
    }>;
  };

  timeline: DisputeTimelineEvent[];

  integrity: {
    packContentDigestSha256: string;
    auditEventReferences: string[];
    packDigestSha256: string;
    isCryptographicallyValid: boolean;
    generatedAt: string;
    generatedBy: string;
  };
}
```

---

## 4. SQLite Schema Migration (Version 6)

Implemented within `src/server/repositories/Database.ts` under schema migration version 6:

```sql
CREATE TABLE IF NOT EXISTS dispute_evidence_packs (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
  pack_digest TEXT NOT NULL CHECK (length(pack_digest) = 64),
  schema_version TEXT NOT NULL,
  dispute_status TEXT NOT NULL,
  pack_data_json TEXT NOT NULL,
  generated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  generated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_packs_contract_id
  ON dispute_evidence_packs(contract_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_packs_milestone_id
  ON dispute_evidence_packs(milestone_id);
```

---

## 5. Non-Circular Cryptographic Anchoring Workflow

To eliminate circular dependency between the hash-chained audit log and the Dispute Evidence Pack digest, TrustChain employs a deterministic two-stage pipeline:

1. **Pre-Audit Content Assembly:**
   All domain records are collected and assembled into `disputePackPayloadWithoutDigest`.
2. **Canonical Serialization & Content Digest:**
   `packContentDigestSha256` is generated via SHA-256 over `canonicalizeJson(disputePackPayloadWithoutDigest)`.
3. **Atomic Transactional Audit Anchor (`db.withTransaction`):**
   Within an isolated SQLite ACID transaction:
   - An immutable audit log entry is appended:
     ```json
     {
       "action": "DISPUTE_PACK_GENERATED",
       "entityType": "MILESTONE",
       "entityId": milestoneId,
       "contractId": contractId,
       "milestoneId": milestoneId,
       "payload": {
         "packId": "...",
         "packContentDigestSha256": "...",
         "disputeStatus": "...",
         "schemaVersion": "mpai-dispute-pack-v1"
       }
     }
     ```
   - The returned `auditEntry.entryHash` is linked into the pack's `integrity.auditEventReferences`.
   - The final `packDigestSha256` is computed over the complete pack (including the anchored audit reference).
   - The complete pack snapshot is saved to `dispute_evidence_packs`.
4. **Independent Retrieval Verification:**
   On retrieval via `GET .../dispute-packs/:packId` or `/verify`, the server recomputes the SHA-256 digest over the canonical JSON of the retrieved payload. Any out-of-band SQLite tampering alters the digest and causes `isCryptographicallyValid: false` with HTTP 200 verification reporting.

---

## 6. Deterministic Timeline Construction

The timeline synthesizes all events directly from:
- `audit_logs` entries for the contract and milestone
- `evidence_submissions` history
- `human_approvals` records
- `payment_transactions` events

### Sorting Rules:
1. **Primary Sort Key:** `timestamp ASC` (normalized ISO-8601 strings).
2. **Deterministic Tie-Breaker:** For events with identical timestamps:
   - If both have an audit sequence number, order by `seq ASC`.
   - Otherwise, order by deterministic string comparison on `id ASC`.
3. **Traceability:** Every event identifies `actorId`, `actorRole`, `action`, and `referenceId`.

---

## 7. Security Model, RBAC, and Sensitive Data Exclusion

1. **Contract Party Authorization:**
   Access is strictly restricted to participants of the contract:
   `req.actor.id === contract.clientId || req.actor.id === contract.developerId || req.actor.id === contract.reviewerId`.
   Outsiders or actors from unrelated contracts receive `403 FORBIDDEN_NOT_CONTRACT_PARTY`.
2. **Cross-Contract & Cross-Milestone Isolation:**
   If `milestone.contractId !== contract.id`, the request is rejected with `404 MILESTONE_NOT_FOUND`.
3. **Credential & Secret Stripping:**
   Exported JSON and API responses **never** contain GitHub OAuth tokens, PayPal Client Secrets, API keys, webhook signing secrets, or password hashes.
4. **Untrusted Evidence Boundary:**
   Developer comments, PR descriptions, and commit messages are safely treated as untrusted strings and are never executed or rendered as raw unescaped HTML.

---

## 8. Summary of Components to Implement

| Component | Path | Responsibility |
|:---|:---|:---|
| **Domain Types** | `src/types/domain.ts` | Complete type definitions for Dispute Evidence Pack & Timeline |
| **DB Migration** | `src/server/repositories/Database.ts` | Version 6 schema migration for `dispute_evidence_packs` |
| **Repository** | `src/server/repositories/DomainRepositories.ts` | CRUD and integrity query operations for dispute packs |
| **Core Service** | `src/server/services/DisputeEvidencePackService.ts` | Aggregation, timeline reconstruction, non-circular hashing, verification |
| **Controller** | `src/server/controllers/DisputeController.ts` | HTTP request validation, RBAC enforcement, error mapping |
| **Route Registration** | `src/server/routes/apiRoutes.ts`, `src/server/index.ts` | Endpoint mounting under `/api/v1` |
| **Frontend UI** | `src/App.tsx` | Visual dispute evidence review workbench & JSON export |
| **Automated Tests** | `src/server/__tests__/dispute_evidence_pack.test.ts` | 15+ comprehensive regression and edge case tests |
