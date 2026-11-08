# TrustChain Dispute Evidence Pack — Security Review & Threat Model

**Component:** Dispute Evidence Pack Engine  
**Review Type:** Independent Cryptographic & Architectural Security Assessment  
**Repository:** `Mohamed-529/TrustChain`  
**Date:** November 8, 2026  
**Auditor:** Google Antigravity (Senior Security & Full-Stack Engineer)  

---

## 1. Threat Model & Attacker Profiles

| Attacker Profile | Capability | Motivation | Target Invariant |
|:---|:---|:---|:---|
| **Malicious Contractor** | Can submit crafted evidence payloads, commit messages, or PR links. | Fabricate completion proof, bypass failing CI, obtain unearned payouts. | Evidence grounding & provenance verification. |
| **Rogue Reviewer** | Has valid reviewer credentials; can approve/reject milestones. | Unilaterally alter agreed amounts or bypass settlement formula gates. | Deterministic policy calculation & immutable audit trail. |
| **Cross-Contract Outsider** | Has valid JWT credentials for Contract A; tries to access Contract B. | Corporate espionage, data scraping, unauthorized financial inspection. | Multi-tenant isolation & server-side RBAC. |
| **Privileged Database Attacker** | Has direct write access to SQLite database file on disk. | Mutate historical pack records, change audit entries, or fake approvals. | Cryptographic digest re-verification on read (`isCryptographicallyValid`). |
| **Adversarial LLM Prompt Injector** | Injects instructions inside commit headlines, markdown, or PR titles. | Trick AI agents into recommending payout approval or overriding gates. | Non-agentic arbitration boundary & server-side determinism. |

---

## 2. Invariant Verification Analysis

### A. Strict Read-Only Financial Boundary
- **Threat:** Generating or viewing a dispute pack triggers automated escrow release or voids authorization holds.
- **Defense Mechanism:**
  - `DisputeEvidencePackService` has zero payment execution methods.
  - The controller exposes only `POST .../dispute-pack`, `GET .../dispute-packs/:packId`, `GET .../verify`, and `GET .../export`.
  - Automated regression test `16` directly asserts that milestone `status`, `payment_status`, and `agreed_amount_cents` remain unchanged, and zero entries are added to `payment_transactions`.
- **Verdict:** **PASS.**

### B. Non-Agentic AI Boundary
- **Threat:** AI review syntheses are treated as legally binding arbitration decisions or automated approvals.
- **Defense Mechanism:**
  - The domain type `DisputeEvidencePack['aiAdvisoryAssessment']` mandates `isAdvisory: true`.
  - Prominent disclaimer text is embedded in both the API response and the frontend viewer:
    *"Multi-agent AI evaluations are strictly advisory tools... AI models cannot approve milestones, authorize disbursements, modify contract terms, or render binding dispute resolutions."*
  - Automated regression test `7` verifies that the disclaimer is always present and that settlement policy math is isolated from advisory strings.
- **Verdict:** **PASS.**

### C. Two-Stage Non-Circular Digest & Tamper Detection
- **Threat:** Circular hashing dependencies or undetected SQLite row modification.
- **Defense Mechanism:**
  - **Stage 1 (Pre-Audit):** All pack data (contract terms, submissions, passport summary, audit replay summary, AI advisory, settlement outcome, timeline) is assembled and canonicalized (`RFC 8785` sorted keys). A SHA-256 hash `packContentDigestSha256` is computed.
  - **Stage 2 (Audit Anchor):** Within `db.withTransaction()`, `auditService.appendWithinTx()` logs `DISPUTE_PACK_GENERATED` with `packContentDigestSha256` in its payload. The resulting `auditEntry.entryHash` is linked into `auditEventReferences`.
  - **Final Digest:** `packDigestSha256` is computed over the payload including the audit reference and persisted to the SQLite row and indexed column.
  - **Read-Time Verification:** On retrieval (`getDisputePack` and `verifyDisputePack`), the server re-hashes the canonical payload. Any modification to `pack_data_json` immediately causes `isDigestValid: false` and `isCryptographicallyValid: false`.
  - Automated regression test `12` confirms that modifying milestone amount in SQLite is instantly caught.
- **Verdict:** **PASS.**

### D. Multi-Tenant Authorization & Cross-Contract Isolation
- **Threat:** User belonging to Contract A accesses or generates dispute packs for Contract B.
- **Defense Mechanism:**
  - `DisputeController.assertContractParty()` checks server-side:
    ```typescript
    const isParty =
      actorId === contract.clientId ||
      actorId === contract.developerId ||
      actorId === contract.reviewerId;
    if (!isParty) {
      throw new AppError(403, 'FORBIDDEN_NOT_CONTRACT_PARTY', '...');
    }
    ```
  - Cross-milestone checking ensures `milestone.contractId === contract.id`, returning `404 MILESTONE_NOT_FOUND` on mismatch.
  - Automated regression tests `9`, `10`, and `11` verify unauthenticated (401), unauthorized outsider (403), and cross-contract mismatch (404) rejections.
- **Verdict:** **PASS.**

### E. Sanitization & Sensitive Credential Exclusion
- **Threat:** Pack export leaks PayPal client secrets, OAuth bearer tokens, session keys, or password hashes.
- **Defense Mechanism:**
  - `DisputeEvidencePackService.exportDisputePack()` performs structural sanitization:
    - PayPal raw API response dictionaries are scrubbed of `accessToken`, `clientSecret`, and `rawPaypalResponse`.
    - User password hashes are never queried or mapped into pack domain types.
    - An `exportSha256` checksum is appended for transport verification.
  - Automated regression test `13` validates that the serialized export contains 0 occurrences of `access_token`, `client_secret`, `password_hash`, or authorization headers.
- **Verdict:** **PASS.**

### F. Atomic Concurrency & Failure Recovery
- **Threat:** Mid-process failure creates orphaned dispute packs or corrupted audit trails.
- **Defense Mechanism:**
  - `db.withTransaction()` guarantees all-or-nothing execution.
  - If `auditService.appendWithinTx()` throws, SQLite rolls back the transaction, leaving zero partial records in `dispute_evidence_packs`.
  - Automated regression test `14` verifies that an injected transaction error leaves database row count unchanged.
  - Automated regression test `15` verifies concurrent generation requests without sequence collisions.
- **Verdict:** **PASS.**

---

## 3. Residual Risks & Recommended Production Mitigations

1. **Host-Level File Modification:**
   While the SQLite hash chain and pack digest immediately flag alterations on retrieval, they cannot prevent a local root administrator from deleting or overwriting the entire `.db` file.  
   *Production Mitigation:* In multi-server deployments, stream audit log hashes to an external, write-once-read-many (WORM) cloud storage service or public timestamping authority (e.g., RFC 3161 timestamping authority).
2. **Clock Skew on Single Nodes:**
   Deterministic timeline ordering relies on normalized ISO timestamps, with `seq` and `id` as tie-breakers.  
   *Production Mitigation:* Standardize on NTP-synchronized UTC clocks across all application cluster nodes.

---

## 4. Final Security Certification

The Dispute Evidence Pack implementation adheres strictly to the TrustChain Financial Safety Rules, Non-Agentic AI Boundaries, and Ponytail Code Restraint guidelines. All 17 automated security and regression tests pass unconditionally.
