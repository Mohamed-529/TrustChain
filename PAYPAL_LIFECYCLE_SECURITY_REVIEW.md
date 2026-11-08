# PAYPAL_LIFECYCLE_SECURITY_REVIEW.md — TrustChain Financial Security & Boundary Review

## 1. Scope & Objective

This security review evaluates the financial invariants, role separation, cryptographic controls, and resilience of **TrustChain PayPal Lifecycle Management** against adversarial actions, race conditions, and out-of-band inconsistencies.

---

## 2. Mandatory Financial Invariants

### 2.1 Rule 1: Zero Autonomous AI Financial Power
- **Design**: AI multi-agent evaluations (Evidence Agent, Risk Agent, Arbitrator Agent) run strictly in an isolated analysis container. Their output is restricted to JSON advice (`ArbitratorRecommendation`).
- **Enforcement**:
  - AI agents have no tools or API endpoints capable of calling PayPal APIs, creating orders, or capturing authorizations.
  - The deterministic Settlement Policy Engine computes policy bounds independently of AI text generation.
  - `captureAuthorization` explicitly verifies the presence of an authenticated `HumanApprovalRecord` with `decision === 'APPROVE'`.
- **Verdict**: **COMPLIANT & SECURE**.

### 2.2 Rule 2: Separation of Duties (Anti-Self-Dealing)
- **Design**: A developer who submitted delivery evidence must never approve their own milestone or trigger settlement.
- **Enforcement**:
  - `createOrder`: restricted to `CLIENT` (`actor.role === 'CLIENT' && actor.id === contract.clientId`).
  - `captureAuthorization`: strictly blocks developers (`actor.role === 'DEVELOPER' || actor.id === contract.developerId`). Only `CLIENT` or designated `REVIEWER` fiduciaries may capture.
  - `reconcilePayment`: strictly blocks developers (`actor.role === 'DEVELOPER' || actor.id === contract.developerId`).
- **Verdict**: **COMPLIANT & SECURE**.

### 2.3 Rule 3: Server-Authoritative Integer Cents Arithmetic
- **Design**: No client-supplied payment amounts are accepted by the server.
- **Enforcement**:
  - `agreedAmountCents`, `permittedAmountCents`, `authorizedAmountCents`, and `capturedAmountCents` are stored and processed strictly as integer cents.
  - Double and float operations are strictly avoided during policy calculation to prevent IEEE-754 precision drift.
  - Amounts are re-verified at capture time:
    $$0 < \text{captureCents} \le \text{permittedAmountCents} \le \text{authorizedAmountCents}$$
- **Verdict**: **COMPLIANT & SECURE**.

### 2.4 Rule 4: Idempotency & Double-Capture Prevention
- **Design**: Every financial mutation enforces a mandatory `PayPal-Request-Id` header.
- **Enforcement**:
  - Database enforces a `UNIQUE` index on `payment_transactions.idempotency_key`.
  - Replayed requests with the same idempotency key return the cached transaction record without re-invoking PayPal APIs.
  - Reusing an idempotency key across different milestones triggers an immediate `409 IDEMPOTENCY_KEY_REUSE_CONFLICT`.
  - Database mutations are protected by atomic SQLite `BEGIN IMMEDIATE` transactions.
- **Verdict**: **COMPLIANT & SECURE**.

---

## 3. Ambiguous Network Timeout & Failure Recovery

### 3.1 The Risk: Distributed Capture Ambiguity
When a payment client calls `POST /v2/payments/authorizations/{id}/capture` and the network socket drops or PayPal returns a 504 Gateway Timeout:
- Blindly assuming success can record uncaptured revenue as settled.
- Blindly retrying with a new idempotency key can cause double captures.
- Blindly marking the milestone failed blocks legitimate developer compensation.

### 3.2 Mitigation: Transitional `REQUIRES_RECONCILIATION` State
In TrustChain:
1. When a network timeout or upstream 5xx occurs during capture, the transaction is immediately recorded in SQLite with status `REQUIRES_RECONCILIATION`.
2. A high-priority audit event `PAYPAL_CAPTURE_AMBIGUOUS_TIMEOUT` is recorded.
3. The HTTP response returns `504 PAYPAL_CAPTURE_TIMEOUT_REQUIRES_RECONCILIATION`.
4. The client or reviewer can trigger `reconcilePayment()`, which queries PayPal `GET /v2/payments/captures` or `GET /v2/payments/authorizations` to check whether the capture succeeded remotely under that `PayPal-Request-Id`.
5. If remote capture succeeded (`COMPLETED`), the local state is safely advanced to `CAPTURED` and milestone to `SETTLED`.
- **Verdict**: **COMPLIANT & SECURE**.

---

## 4. Webhook Security & Tamper Protection

### 4.1 Cryptographic Signature Verification
Inbound webhooks to `/api/v1/webhooks/paypal` require:
1. `PAYPAL-TRANSMISSION-ID`
2. `PAYPAL-TRANSMISSION-TIME`
3. `PAYPAL-TRANSMISSION-SIG`
4. `PAYPAL-CERT-URL`
5. `PAYPAL-AUTH-ALGO`

### 4.2 SSRF & Certificate Spoofing Defense
`PayPalService.handleWebhook` enforces that `PAYPAL-CERT-URL` must strictly match the regex:
```ts
/^https:\/\/api(\.sandbox)?\.paypal\.com\//i
```
Attempts by an attacker to point the cert URL to an external malicious server or internal IP literal are immediately rejected with `401 UNTRUSTED_PAYPAL_CERT_URL`.

### 4.3 Monotonic Terminal State Protection
Webhooks arriving out-of-order cannot downgrade a terminal `CAPTURED` state. An incoming `PAYMENT.AUTHORIZATION.VOIDED` webhook for an authorization that was already captured will not void the local settled milestone.

---

## 5. Secret Leakage Prevention

- **Audit Logs**: All audit payloads are sanitized before hash chaining. Neither `PAYPAL_CLIENT_SECRET`, OAuth bearer tokens, nor webhook credentials are included in audit records.
- **API Responses**: Payment records return sanitized summaries (`id`, `status`, `authorizedAmountCents`, `capturedAmountCents`, `nonEscrowDisclosure`).
- **Regression Verification**: Verified by automated test `9. ensures zero tokens or secrets are leaked into audit logs or response payloads`.

---

## 6. Security Summary & Recommendations

| Category | Status | Notes |
| :--- | :--- | :--- |
| Escrow Regulatory Compliance | **PASSED** | Explicit non-escrow notice declared in all API responses and UI components. |
| AI Financial Boundary | **PASSED** | AI is strictly advisory; human approval gate enforced before capture. |
| Role RBAC & Separation of Duties | **PASSED** | Developer cannot create orders, capture, or reconcile. |
| Idempotency & Concurrency | **PASSED** | Enforced via `PayPal-Request-Id` and SQLite `BEGIN IMMEDIATE` locks. |
| Distributed Timeout Handling | **PASSED** | `REQUIRES_RECONCILIATION` state machine path with authoritative query. |
| Webhook Authenticity & Anti-SSRF | **PASSED** | PayPal signature verification and cert URL domain pinning. |
| Credential & Secret Protection | **PASSED** | No credentials in database rows, audit payloads, or API responses. |
