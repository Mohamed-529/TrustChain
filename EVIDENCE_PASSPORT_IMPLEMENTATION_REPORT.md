# Evidence Passport Implementation Report — TrustChain (MilestoneProof AI)

**Phase / Deliverable:** Prompt 2/8 — Evidence Passport: Verifiable Engineering Evidence Record  
**Workspace:** Google Antigravity  
**Repository:** `Mohamed-529/TrustChain`  
**Branch:** `main`  
**Status:** Completed & Fully Verified (`25 / 25` Evidence Passport tests passing; `100 / 100` total project tests passing across 10 suites)

---

## 1. Executive Summary

MilestoneProof AI moves beyond superficial AI milestone grading by introducing the **Evidence Passport**: an authoritative, traceable, and cryptographically linked engineering record for software contract delivery.

The Evidence Passport provides deterministic traceability across nine distinct verification pillars:
1. **Agreed Milestone Acceptance Criteria:** Contract version, canonical criteria hash, and criterion-by-criterion evidence mapping.
2. **GitHub Repository & Source Commit:** Normalized repository URL, branch, verified commit SHA, author identity, and pull request state.
3. **Cryptographic Commit Signatures:** GPG / SSH / S/MIME signature verification with explicit status semantics (`VERIFIED`, `UNVERIFIED`, `INVALID`, `UNSUPPORTED`, `UNAVAILABLE`) and documented limitations.
4. **CI/CD Execution Telemetry:** Automated workflow provider, run URL, exact commit matching check (`commitMatchesSource`), test counts, and code coverage.
5. **Artifact Provenance & Digest Attestation:** SLSA v1.0 / in-toto build provenance attestation verification, SHA-256 binary digest recording, and builder identity checks.
6. **Runtime Deployment Smoke-Testing & SSRF Guard:** Live endpoint HTTP status checks, latency measurement, and server-side request forgery (SSRF) protection against loopback, private IPv4/IPv6, and cloud metadata (AWS IMDSv1/v2).
7. **Multi-Agent Evaluation Synthesis:** Tri-agent findings from Evidence Agent, Risk Agent, and Arbitrator Agent, including explicit handling of agent disagreement and adversarial prompt-injection neutralization.
8. **Deterministic Verification Outcomes:** Criteria-driven overall passport status (`VERIFIED`, `FAILED`, `UNVERIFIED`, `UNAVAILABLE`, `NOT_APPLICABLE`) and zero-permit blocking gates.
9. **Audit Trail & Cryptographic Graph:** Directed acyclic graph (DAG) of all evidence nodes and hashes, embedded audit event sequence references, and a top-level canonical passport SHA-256 digest (`mpai-passport-canon-v1`).

---

## 2. Architecture & Domain Model

### 2.1 Core Types (`src/types/domain.ts`)

```typescript
export type PassportVerificationStatus = 'VERIFIED' | 'FAILED' | 'UNVERIFIED' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
export type CommitSignatureStatus = 'VERIFIED' | 'UNVERIFIED' | 'INVALID' | 'UNSUPPORTED' | 'UNAVAILABLE';
export type AttestationVerificationStatus = 'VERIFIED' | 'FAILED' | 'UNVERIFIED' | 'UNAVAILABLE';
export type RuntimeValidationStatus = 'VERIFIED' | 'FAILED' | 'UNVERIFIED' | 'UNAVAILABLE';
export type CriterionMappingStatus = 'VERIFIED' | 'FAILED' | 'UNVERIFIED' | 'UNAVAILABLE' | 'NOT_APPLICABLE';

export interface EvidencePassport {
  id: string; // pass_<milestoneId>_<submissionId>
  schemaVersion: '1.0.0';
  canonicalizationVersion: 'mpai-passport-canon-v1';
  identity: EvidencePassportIdentity;
  sourceIdentity: EvidencePassportSourceIdentity;
  ciCd: EvidencePassportCiCd;
  provenance: EvidencePassportProvenance;
  runtime: EvidencePassportRuntime;
  agentSummary: EvidencePassportAgentSummary;
  criteriaSummary: EvidencePassportCriteriaSummary;
  criteriaMapping: CriterionEvidenceMappingItem[];
  graph: EvidenceGraph;
  auditTrail: EvidencePassportAuditReference;
  passportDigestSha256: string;
  isCryptographicallyValid: boolean;
  generatedAt: string;
}
```

### 2.2 Database Storage (`src/server/repositories/Database.ts` & `DomainRepositories.ts`)

- **Schema Migration Version 5:** Added `evidence_passports` table with indexed lookups on `milestone_id`, `contract_id`, `submission_id`, and `created_at`.
- **Repository Methods (`EvidencePassportRepository`):**
  - `save(passport: EvidencePassport): void` (Atomic insert/replace with JSON-serialized subgraphs).
  - `findByMilestoneId(milestoneId: string): EvidencePassport | null`
  - `findById(id: string): EvidencePassport | null`

---

## 3. Implementation Details

### 3.1 Traceability Pillars

1. **Agreed Criteria Mapping:** Every acceptance criterion from the milestone definition is evaluated against source, CI/CD, security scan, provenance, or runtime evidence. If no proof is supplied for a required criterion, it is flagged as `UNVERIFIED` with reason `INSUFFICIENT_EVIDENCE`.
2. **Commit Signature Verification:**
   - Detects GPG/SSH signatures via GitHub verification payloads or developer attestations.
   - Status transitions:
     - `VERIFIED`: Valid GPG/SSH key signed by authorized committer.
     - `UNVERIFIED`: Normal unsigned commit (standard in many development workflows; does not reject contract).
     - `INVALID`: Expired key, revoked key, or corrupted signature.
     - `UNSUPPORTED`: Unknown signature algorithm or unparseable payload.
     - `UNAVAILABLE`: GitHub verification service unreachable.
   - Documentation Notice: Clearly discloses that commit signature verifies *author identity*, not code correctness or absence of malicious intent.
3. **CI/CD Execution & Foreign Commit Guard:**
   - Verifies whether the CI workflow executed against the *exact* submitted commit (`ciReport.runCommitSha === submission.commitSha`).
   - If CI executed on an unrelated or foreign commit, it is flagged as `FAILED` with discrepancy details.
4. **Build Artifact Provenance:**
   - Parses SLSA v1.0 provenance attestations and checks artifact digests.
   - When no attestation is configured, returns `UNAVAILABLE` without failing the milestone.
5. **Runtime Deployment Preview & SSRF Protection:**
   - Performs automated smoke-testing against preview environments.
   - Strict SSRF filter blocks:
     - Loopback addresses (`127.0.0.0/8`, `::1`, `localhost`)
     - RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
     - Link-local and Carrier-Grade NAT (`169.254.0.0/16`, `100.64.0.0/10`)
     - Cloud Instance Metadata (`169.254.169.254`, `metadata.google.internal`)
     - Non-HTTP/HTTPS protocols (`file:`, `gopher:`, `ftp:`)
     - Internal redirect targets (SSRF redirect hop protection)
6. **Cryptographic Graph & Canonical Digest:**
   - Constructs a DAG connecting Contract -> Milestone -> Submission -> Source/CI/Risk -> Passport.
   - Computes canonical SHA-256 digest (`passportDigestSha256`) over canonical JSON representation with excluded volatile digest field.

### 3.2 API Endpoints & RBAC

- `GET /api/v1/contracts/:contractId/milestones/:milestoneId/evidence-passport`
  - Contract-party RBAC enforced (`FORBIDDEN_NOT_CONTRACT_PARTY`).
  - Supports query parameter `?forceRefresh=true` for on-demand re-verification.
- `POST /api/v1/contracts/:contractId/milestones/:milestoneId/evidence-passport/runtime-validate`
  - Validates preview URLs against SSRF filter and executes HTTP smoke-test.
  - Restricted to authenticated contract participants.

### 3.3 Milestone Workbench UI Integration (`src/components/EvidencePassportViewer.tsx`)

A tabbed interface embedded directly inside the Milestone Workbench with 6 interactive views:
1. **Criteria Mapping:** Visual table showing every contractual criterion mapped to evidence references, status badges, and gap descriptions.
2. **Source & Signature:** Commit details, author info, GPG/SSH status, and cryptographic limitations advisory.
3. **CI/CD Evidence:** Workflow status, test counts, coverage bar, and commit association indicator.
4. **Artifact Provenance:** Digest verification status, SLSA level badge, and subject artifact SHA-256 hash.
5. **Runtime & SSRF Guard:** Live endpoint status, response latency, and SSRF security filter status.
6. **Cryptographic Graph & Audit:** Visual DAG node/edge metrics, canonical passport SHA-256 digest, and tamper-check badge.

---

## 4. Test Verification Matrix

All 25 test cases in `src/server/__tests__/evidence_passport.test.ts` pass cleanly:

| # | Test Scenario | Verified Outcome |
|---|---|---|
| 1 | Complete Evidence Passport generation & data integrity | `VERIFIED`, all 9 pillars populated |
| 2 | Distinguish missing evidence as UNVERIFIED | `UNVERIFIED`, no false completion |
| 3 | Detect duplicate submissions & preserve attempt history | Attempt 2 supersedes Attempt 1 |
| 4 | Detect invalid evidence payload hash | `PAYLOAD_HASH_MISMATCH` caught |
| 5 | Detect post-submission tampering | Content modification flagged |
| 6 | Recognize cryptographically VERIFIED commit signatures | `VERIFIED` with limitation notice |
| 7 | Classify standard unsigned commits as UNVERIFIED | `UNVERIFIED` without rejecting contract |
| 8 | Classify expired/corrupted keys as INVALID | `INVALID` signature status |
| 9 | Classify unmapped signature algorithms as UNSUPPORTED | `UNSUPPORTED` without crashing |
| 10 | Verify CI run associated with exact submitted commit | `commitMatchesSource: true` |
| 11 | Flag CI run on wrong commit as FAILED | `commitMatchesSource: false`, `FAILED` |
| 12 | Flag failed CI workflow as FAILED | `FAILED` status blocks passport |
| 13 | Verify build artifact SHA-256 & SLSA provenance | `VERIFIED` SLSA attestation |
| 14 | Safely handle missing attestation as UNAVAILABLE | `UNAVAILABLE` without failing milestone |
| 15 | Verify runtime deployment preview HTTP 200 | `status: VERIFIED`, latency recorded |
| 16 | Catch runtime endpoint failures (HTTP 500) | `status: FAILED`, non-200 captured |
| 17 | Enforce SSRF protection (loopback, RFC1918, metadata) | Blocked with `SSRF_DETECTED` |
| 18 | Restrict redirects and prevent SSRF bypass | Redirect to `169.254.169.254` blocked |
| 19 | Detect unsupported completion claims | `INSUFFICIENT_EVIDENCE` |
| 20 | Preserve agent disagreements in audit synthesis | Discordant findings preserved |
| 21 | Neutralize adversarial prompt injection | `<untrusted_evidence>` sanitized |
| 22 | Enforce mandatory human review before settlement | Policy engine requires human approval |
| 23 | Guarantee zero autonomous PayPal operations | Read-only passport generation |
| 24 | Block unauthorized outsiders | HTTP 403 `FORBIDDEN_NOT_CONTRACT_PARTY` |
| 25 | Authenticated runtime validation endpoint with SSRF | HTTP 200 / SSRF block verified |

---

## 5. Security & Financial Invariants

1. **Read-Only Passport Generation:** No payment gateway operations, database mutations on ledger, or milestone status overrides occur during Evidence Passport generation or retrieval.
2. **Zero Autonomous PayPal Execution:** Neither Evidence Passport nor AI agents can authorize, capture, or void payments.
3. **Mandatory Human Review:** Human review is enforced by policy gates; passport serves strictly as decision intelligence.
4. **Server-Authoritative Cryptographic Digest:** Passport digest is calculated strictly server-side using canonical JSON hashing.
