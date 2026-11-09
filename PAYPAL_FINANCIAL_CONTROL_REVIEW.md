# PAYPAL FINANCIAL CONTROL & FIDUCIARY INVARIANT REVIEW

**MilestoneProof AI (TrustChain)**  
**Auditor Reference:** Fiduciary Financial Review  
**Date:** 2026-11-09  

---

## 1. Executive Summary

MilestoneProof AI is an escrow and delivery verification system where code deliverables directly govern financial settlement through PayPal. Under such an architecture, financial controls cannot be secondary features or advisory suggestions—they must be immutable system invariants enforced at the database, service, controller, and network boundaries.

This review formalizes the financial controls, invariants, and reconciliation mechanisms implemented in TrustChain following the application-path remediation of PayPal Sandbox Order `0N806388NV784822T`.

---

## 2. Core Financial Invariants

```
+---------------------------------------------------------------------------------------------------+
|                                  TRUSTCHAIN FINANCIAL SAFETY GATES                                 |
+---------------------------------------------------------------------------------------------------+
| 1. AI AGENT BOUNDARY      | AI outputs are strictly non-authoritative advisory proposals.         |
|                           | AI agents NEVER hold PayPal API keys or invoke capture/transfer/void.  |
|---------------------------+-----------------------------------------------------------------------|
| 2. FIDUCIARY HUMAN GATE   | Fiduciary capture is forbidden unless a human reviewer has explicitly  |
|                           | submitted decision: 'APPROVE' matching deterministic settlement.      |
|---------------------------+-----------------------------------------------------------------------|
| 3. SERVER-SIDE ARITHMETIC | All monetary calculations use 64-bit integer cents. Browser inputs     |
|                           | cannot override or increase settlement amounts.                       |
|---------------------------+-----------------------------------------------------------------------|
| 4. HOLD BEFORE CAPTURE    | Intent is ALWAYS 'AUTHORIZE' (up to 29-day hold). TrustChain never     |
|                           | performs direct instant capture without verified delivery hold.       |
|---------------------------+-----------------------------------------------------------------------|
| 5. IDEMPOTENT EXECUTION   | Every PayPal mutation enforces a deterministic PayPal-Request-Id.     |
|                           | Replays return cached transaction records without re-execution.       |
|---------------------------+-----------------------------------------------------------------------|
| 6. RECONCILIATION DRIFT   | Any capture executed outside the TrustChain application path is       |
|                           | quarantined as FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE.                  |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Detailed Invariant Analysis & Enforcement

### Invariant 1: AI Agent Financial Isolation
- **Rule:** No AI agent may capture, transfer, or void payments.
- **Enforcement:**
  - AI agents (`EvidenceAnalyst`, `RiskAnalyst`, `ReviewSynthesizer`) operate purely on schema-validated JSON outputs (`additionalProperties: false`).
  - Prohibited authority keys (e.g. `execute_capture`, `release_escrow`, `transfer_funds`) are blocked at runtime (`AI_FINANCIAL_BOUNDARY_VIOLATION`).
  - No PayPal credentials or SDK instances exist in the agent execution context.

### Invariant 2: Separation of Duties & Mandatory Human Review
- **Rule:** Separation between the payer, developer, and fiduciary reviewer.
- **Enforcement:**
  - `CLIENT`: Creates the contract, defines milestone criteria, and authorizes the 29-day escrow hold via PayPal Sandbox.
  - `DEVELOPER`: Submits cryptographic evidence (commits, PRs, build artifacts, test runs).
  - `REVIEWER`: Inspects AI evidence synthesis, verifies technical risk, and executes human fiduciary approval (`APPROVE` / `REJECT` / `HOLD`).
  - `SETTLEMENT`: `captureAuthorization()` explicitly queries `humanApprovalRepo.findLatestByMilestoneId()`. If no approval exists, or if `approval.decision !== 'APPROVE'`, the capture request is rejected with HTTP 412 `PRECONDITION_FAILED`.

### Invariant 3: Server-Side Deterministic Integer Arithmetic
- **Rule:** Floating-point rounding errors and client-supplied amounts are strictly prohibited.
- **Enforcement:**
  - Milestone amounts are stored as integer cents (`agreedAmountCents`, `permittedAmountCents`).
  - Settlement calculation (`SettlementPolicyService`) is deterministic business logic, evaluating completed requirements, late-delivery penalties (e.g., 50 bps/day), and security overrides.
  - Capture requests ignore any client-supplied amount parameters, pulling `permittedAmountCents` directly from the verified database record.

### Invariant 4: Two-Stage Authorization & Capture (`intent: AUTHORIZE`)
- **Rule:** TrustChain never initiates immediate payment captures upon contract signing.
- **Enforcement:**
  - `PayPalService.createOrder()` sets `"intent": "AUTHORIZE"`.
  - The client authorizes an escrow hold (valid for up to 29 days in PayPal).
  - Capture is only invoked when delivery evidence is submitted, analyzed, and approved.
  - Non-escrow regulatory notices are transparently surfaced to the user.

### Invariant 5: Idempotency & Concurrency Guards
- **Rule:** Network retries must never double-charge or create duplicate transactions.
- **Enforcement:**
  - Every PayPal mutation embeds `PayPal-Request-Id` derived deterministically from the milestone ID, action, and transaction attempt.
  - SQLite enforces a unique constraint on `idempotency_key` in the `payment_transactions` table.
  - Duplicate requests immediately return the existing transaction record without contacting PayPal's remote servers.

### Invariant 6: Reconciliation & External Drift Quarantine
- **Rule:** Unauthorized captures executed outside the application path (e.g., direct API scripts or portal manipulation) must never be credited as successful milestone settlements.
- **Enforcement:**
  - `PayPalService.reconcilePayment()` compares local SQLite state against remote PayPal API state.
  - If a remote capture exists (`COMPLETED`) but no matching local authorization and human approval record exists in TrustChain:
    - The state machine immediately flags the transaction:
      - `outcome: "MANUAL_INTERVENTION_REQUIRED"`
      - `actionTaken: "FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE"`
    - The milestone status is locked against automatic payout.
    - An immutable audit log entry is appended with cryptographic hash chaining.

---

## 4. Forensic Application to Order `0N806388NV784822T`

Applying the above controls to the forensically audited order:

1. **Remote Reality:** Order `0N806388NV784822T` was captured remotely for `$50.00 USD` as `4L688309CS300123Y`.
2. **Local Reality:** TrustChain has no approved human review or legitimate application-path authorization record for this milestone.
3. **Fiduciary Resolution:** TrustChain refuses to treat this capture as an approved settlement. In accordance with Invariant 6, the transaction is marked for manual compliance review (`FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE`). Zero fraudulent state transitions occurred.
