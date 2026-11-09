# PAYPAL LIVE & AUTOMATED WEBHOOK VERIFICATION REPORT

**MilestoneProof AI (TrustChain)**  
**Verification Date:** 2026-11-09  
**Integration Scope:** PayPal Orders API v2, Payments Authorizations & Captures API v2, Webhook Notifications (`POST /api/v1/webhooks/paypal`)  
**Status:** FULLY HARDENED & AUTOMATED TEST SUITE PASSING (205 / 205 Tests)  

---

## 1. Executive Summary & Webhook Delivery Distinction Matrix

In compliance with the project principle (**Hackathon-ready is not the same as market-ready**), TrustChain distinguishes rigorously between test simulation, local tunnel delivery, and live production infrastructure.

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                    TRUSTCHAIN WEBHOOK VERIFICATION STATUS MATRIX                                      |
+------------------------------------------------------+----------------------------------------------------------------|
| 1. Automated Tests Passed                            | VERIFIED — 205/205 automated tests passing across 19 suites.  |
| 2. Simulator Delivery (PayPal Webhooks Simulator)    | READY — Endpoint accepts raw/parsed body, parses transmission. |
| 3. Real Sandbox Webhook Inbound Delivery             | EXTERNAL DEPENDENCY — Requires public HTTPS tunnel URL.        |
| 4. Real Sandbox Signature Verification Path          | VERIFIED — Calls /v1/notifications/verify-webhook-signature.   |
| 5. Event Persistence & Hash-Chained Audit Log        | VERIFIED — Persisted to webhook_events & chained in audit_logs.|
| 6. Duplicate & Out-of-Order Delivery Safety          | VERIFIED — In-flight locking & terminal state preservation.    |
| 7. Fiduciary Gate Bypass Interception                | VERIFIED — Webhooks NEVER bypass human review (APPROVE).       |
+------------------------------------------------------+----------------------------------------------------------------+
```

---

## 2. In-Depth Phase Inspection & Technical Architecture

### Phase 1 — Route, Raw-Body & Cryptographic Signature Verification
- **Exact Webhook Route:** `POST /api/v1/webhooks/paypal` (defined in [`apiRoutes.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/routes/apiRoutes.ts#L304) and dispatched by [`PaymentController.handleWebhook`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/controllers/PaymentController.ts#L104)).
- **Raw-Body Preservation:** In [`src/server/index.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/index.ts#L254), incoming HTTP streams preserve both `apiReq.body` (parsed object) and `apiReq.rawBody` (raw UTF-8 string). `PayPalService.handleWebhook` seamlessly accepts either raw JSON string or parsed object.
- **PayPal Verification Mechanism:** TrustChain invokes PayPal's authoritative `POST /v1/notifications/verify-webhook-signature` REST endpoint with:
  ```json
  {
    "auth_algo": "SHA256withRSA",
    "cert_url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-...",
    "transmission_id": "<PAYPAL-TRANSMISSION-ID>",
    "transmission_sig": "<PAYPAL-TRANSMISSION-SIG>",
    "transmission_time": "<PAYPAL-TRANSMISSION-TIME>",
    "webhook_id": "<PAYPAL_WEBHOOK_ID>",
    "webhook_event": { ... }
  }
  ```
  - **Anti-SSRF Protection:** Validates that `paypal-cert-url` strictly matches `^https:\/\/api(\.sandbox)?\.paypal\.com\/`.
  - **Fail Closed:** If `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_ID`, or `PAYPAL_CLIENT_SECRET` are unconfigured, requests fail closed with HTTP 503 `WEBHOOK_VERIFICATION_UNAVAILABLE`.

### Required Event Types for AUTHORIZE / CAPTURE Lifecycle

TrustChain subscribes exclusively to 6 lifecycle events:
1. `CHECKOUT.ORDER.APPROVED` — Buyer approved the authorization hold on PayPal Sandbox.
2. `PAYMENT.AUTHORIZATION.CREATED` — 29-day authorization hold created on PayPal.
3. `PAYMENT.AUTHORIZATION.VOIDED` — Authorization hold was voided; milestone payment marked `VOIDED`.
4. `PAYMENT.AUTHORIZATION.EXPIRED` — 29-day hold window expired; milestone payment marked `EXPIRED`.
5. `PAYMENT.CAPTURE.COMPLETED` — Hold captured after delivery evidence verification and explicit human approval.
6. `PAYMENT.CAPTURE.DENIED` — Capture attempt failed/denied; milestone marked `FAILED`.

*Unsupported or foreign events* (e.g. `BILLING.SUBSCRIPTION.CREATED`) are acknowledged safely with HTTP 200 `VERIFIED_UNKNOWN_EVENT_NOOP` without throwing errors or mutating contract state.

---

## 3. Public HTTPS Tunnel Setup (Phase 2 & 3 Guide)

Because PayPal Sandbox servers cannot dispatch webhooks to `http://localhost:3000`, the local backend must be exposed via an encrypted HTTPS tunnel:

### Option A: Using `npx localtunnel` (No Account Required)
```powershell
# In a separate terminal window:
npx localtunnel --port 3000
# Output example: your url is: https://bright-lion-92.loca.lt
```

### Option B: Using `cloudflared` (Recommended for Enterprise Stability)
```powershell
# Run free Cloudflare quick tunnel:
cloudflared tunnel --url http://localhost:3000
# Output example: https://xxxx-xxxx-xxxx.trycloudflare.com
```

### Option C: Using `ngrok`
```powershell
ngrok http 3000
# Output example: https://xxxx.ngrok-free.app
```

---

## 4. PayPal Sandbox Webhook Registration Instructions

1. Log in to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
2. Select your active Sandbox REST Application.
3. Under the **Webhooks** section, click **Add Webhook**.
4. **Webhook URL:** Enter your public tunnel URL with the exact TrustChain endpoint:
   ```
   https://<your-tunnel-domain>/api/v1/webhooks/paypal
   ```
5. **Event Subscriptions:** Select only the 6 required events:
   - `Checkout order approved` (`CHECKOUT.ORDER.APPROVED`)
   - `Payment authorization created` (`PAYMENT.AUTHORIZATION.CREATED`)
   - `Payment authorization voided` (`PAYMENT.AUTHORIZATION.VOIDED`)
   - `Payment authorization expired` (`PAYMENT.AUTHORIZATION.EXPIRED`)
   - `Payment capture completed` (`PAYMENT.CAPTURE.COMPLETED`)
   - `Payment capture denied` (`PAYMENT.CAPTURE.DENIED`)
6. Click **Save**.
7. Copy the generated **Webhook ID** (a 17-character alphanumeric string such as `8RG38475KL829104A`).
8. Add this ID to `.env`:
   ```bash
   PAYPAL_WEBHOOK_ID=8RG38475KL829104A
   ```
   *(Note: Never confuse Webhook ID with Client ID or Client Secret).*
9. Restart the server. The startup log will display:
   ```
   MilestoneProof AI server listening on http://localhost:3000
   PayPal Webhook verification: CONFIGURED (Webhook ID: 8RG3***)
   ```

---

## 5. Secure Webhook Processing & Financial Invariant Guards (Phase 4)

TrustChain enforces uncompromising fiduciary controls inside `PayPalService.handleWebhook`:

1. **Pre-Processing Signature Check:** Webhook signatures are checked against PayPal's verification service before any database transaction is initiated. Rejected attempts are written to `webhook_events` as `REJECTED` and audited as `PAYPAL_WEBHOOK_REJECTED`.
2. **In-Flight Lock Deduplication:** `activeWebhookLocks.has(eventId)` detects and ignores concurrent duplicate transmissions in-flight, preventing race conditions.
3. **Persistent Idempotency:** The `webhook_events` table enforces unique event IDs. Replayed events return HTTP 200 `{ verified: true, duplicate: true, status: 'DUPLICATE_IGNORED' }` without duplicate processing.
4. **Terminal State Preservation:** If an out-of-order `PAYMENT.AUTHORIZATION.VOIDED` arrives after a milestone is already `CAPTURED` or `SETTLED`, the state machine ignores the reversal and preserves `TERMINAL_STATE_PRESERVED`.
5. **Fiduciary Human Gate Enforcement:**
   - When `PAYMENT.CAPTURE.COMPLETED` arrives, the backend queries `HumanApprovalRepository`.
   - If no human approval exists or if `decision !== 'APPROVE'`, the webhook returns `REJECTED_MISSING_HUMAN_APPROVAL`, and the milestone **remains UNSETTLED**.
   - If the captured amount differs from `approvedAmountCents`, it returns `REJECTED_AMOUNT_MISMATCH`.
6. **Unsolicited Remote Capture Quarantine:** If an external capture arrives for an authorization hold that TrustChain never called capture on, the system quarantines the transaction as `UNSOLICITED_REMOTE_CAPTURE_FLAGGED` and transitions it to `REQUIRES_RECONCILIATION` for manual compliance review.

---

## 6. Old Transaction Containment (Phase 6)

For legacy PayPal order `0N806388NV784822T`, authorization `63431076A90318908`, and capture `4L688309CS300123Y`:
- **Zero Re-Capture:** No further capture was or will ever be initiated.
- **Zero Fictitious Credit:** The milestone remains unset to `PAID` or `SETTLED`.
- **Quarantine Preservation:** Transaction status remains locked as `FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE`.
- **Zero Fabricated Records:** Historical audit chains and approvals remain unpolluted.

---

## 7. Automated Test Suite Matrix (Phase 7)

```
========================================================================================================
                                     TRUSTCHAIN TEST RUNNER MATRIX
========================================================================================================
Test Suite                                                    Tests   Passing  Failing  Status
--------------------------------------------------------------------------------------------------------
paypal_webhook_live_verification.test.ts                        11      11        0     PASSED
paypal_application_path_remediation.test.ts                      6       6        0     PASSED
paypal_lifecycle.test.ts                                        12      12        0     PASSED
cinematic_frontend.test.ts                                      17      17        0     PASSED
ag_grid_intelligence.test.ts                                    14      14        0     PASSED
audit_replay.test.ts                                            20      20        0     PASSED
dispute_evidence_pack.test.ts                                   17      17        0     PASSED
evidence_passport.test.ts                                       53      53        0     PASSED
phase1.test.ts through phase9_agent_integration.test.ts (11 suites) 55      55        0     PASSED
--------------------------------------------------------------------------------------------------------
TOTAL AUTOMATED TEST VERIFICATION                              205     205        0     100% GREEN
========================================================================================================
TypeScript Typecheck (`npm run lint` — `tsc --noEmit`):         0 errors (clean compilation)
Client Production Build (`npm run build` — `vite build`):        clean production bundle generated
========================================================================================================
```
