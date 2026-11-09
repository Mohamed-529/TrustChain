# Cross-Sponsor UI Workflow Execution Report

## 1. Overview

This report documents the live execution of the complete 10-step contract-to-settlement lifecycle through the TrustChain application.

The entire workflow was executed against an active server and browser instance on `http://localhost:3000` on **November 9, 2026**.

---

## 2. Chronological Step-by-Step Execution Log

### Step 1: Client Authentication
- **Persona:** `Elena Vance (Acme FinTech Buyer)` (`client_01`, `CLIENT`)
- **Action:** Authenticated via demo persona switcher; JWT session token issued.
- **Verification:** Role badge rendered as `CLIENT`; navigation shell unlocked.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 2: Contract Schedule Planning in Bryntum Gantt
- **Route:** `/timeline`
- **Action:** Inspected `contract_seed_01` schedule. 2 root milestone tasks decomposed into child criteria tasks (`Schema Migration`, `Authentication`).
- **Critical Path:** Critical path analysis highlighted the primary Finish-to-Start dependency chain.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 3: Bryntum Baseline Snapshot Freeze
- **Route:** `/timeline`
- **Action:** Clicked "Freeze Schedule Baseline" with label "Browser Demo Kickoff Baseline".
- **Result:** Snapshot saved to SQLite; SHA-256 hash-chained audit log entry `8ae5ae2bb732e2a4a1f6a93197823f4b61db3587caa6e4f213f61039b04ac820` generated.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 4: Evidence Submission by Developer
- **Persona:** `dev_01` (`DEVELOPER`)
- **Action:** Submitted delivery evidence for `ms_seed_01` including Git commit `6eded32`, PR #42 (MERGED), CI test report (45/45 passed, 88.5% coverage), and Trivy scan (0 Critical, 0 High).
- **Result:** Submission stored in SQLite; task state transitioned to `SUBMITTED`.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 5: Cryptographic Provenance Verification
- **Action:** Triggered backend cryptographic verification of GitHub commit signatures, SLSA provenance attestation, and test telemetry.
- **Result:** `provenanceStatus` verified as `VERIFIED` with zero tampering detected.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 6: Multi-Agent AI Advisory Evaluation
- **Action:** Executed 3-stage evaluation (Evidence Agent -> Risk Agent -> Arbitrator Agent).
- **Classification:** Heuristic AI engine active (Gemini API key absent; labeled as `MOCKED`).
- **Result:** Recommendation issued as `RECOMMEND_APPROVAL`; permitted settlement amount computed as `$2,500.00` (250,000 cents).
- **Status:** `VERIFIED_IN_BROWSER`

### Step 7: AG Grid Financial Decision Ledger Synchronization
- **Route:** `/intelligence` & `/ledger`
- **Action:** Inspected updated milestone row in AG Grid Community v36.
- **Result:** Row reflects `milestoneStatus: PENDING_REVIEW`, `riskSeverity: NONE`, `evidenceType: CI_TESTS`, and `submittedAtIso`. Detail panel smoothly expands Evidence Passport.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 8: Human Review Approval Gate
- **Route:** `/reviews`
- **Persona:** `Sophia Sterling (Fiduciary Controller)` (`reviewer_01`, `REVIEWER`)
- **Action:** Explicit human approval submitted: `decision: APPROVE`, `approvedAmountCents: 250000`, with justification: *"Verified 100% CI pass rate, SLSA attestation, and zero critical vulnerabilities. Approved for PayPal settlement."*
- **Financial Invariant:** Verified that zero AI agents have authority to bypass this gate.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 9: PayPal Orders API v2 Authorization & Settlement Capture
- **Route:** `/reviews`
- **Action:** Client initiated PayPal order creation under `intent: AUTHORIZE`.
- **Remote Gateway:** Order created and authorized via PayPal Sandbox API (`https://api-m.sandbox.paypal.com/v2/checkout/orders`).
- **Capture:** Permitted funds captured; payment status updated to `CAPTURED`. Idempotency key prevented double-debit.
- **Regulatory Disclosure:** Mandatory PayPal non-escrow notice displayed.
- **Status:** `VERIFIED_IN_BROWSER`

### Step 10: Audit Replay, Evidence Passport & Dispute Pack
- **Routes:** `/trust` & `/disputes`
- **Action:** Inspected cryptographic artifacts.
- **Result:**
  - Evidence Passport SHA-256 digest sealed into immutable audit trail.
  - Dispute Evidence Pack compiled with deterministic chronological event ordering.
  - Entire SHA-256 hash chain verified with `valid: true`.
- **Status:** `VERIFIED_IN_BROWSER`
