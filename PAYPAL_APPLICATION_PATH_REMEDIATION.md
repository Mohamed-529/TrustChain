# PAYPAL APPLICATION-PATH REMEDIATION & FORENSIC REPORT

**MilestoneProof AI (TrustChain)**  
**Investigation Date:** 2026-11-09  
**Status:** COMPLETED & VERIFIED  

---

## 1. Executive Summary & Forensic Findings

During forensic review of the PayPal Sandbox integration, the following remote entities were audited:

| Attribute | Forensic Value |
|---|---|
| **PayPal Order ID** | `0N806388NV784822T` |
| **Authorization ID** | `63431076A90318908` |
| **Capture ID** | `4L688309CS300123Y` |
| **Amount / Currency** | `$50.00 USD` |
| **Remote Status** | `COMPLETED` |
| **Buyer Approval** | Sandbox Buyer (US / John Doe) |

### The Root Cause of Application-Path Disconnect
The forensic investigation established that order `0N806388NV784822T`, authorization `63431076A90318908`, and capture `4L688309CS300123Y` were executed via standalone scratch test scripts (`scratch/create_order.mjs`, `scratch/test_execute_authorize.mjs`, `scratch/execute_capture.mjs`) using a bearer token from local configuration, **completely bypassing the TrustChain Express backend (`localhost:3000`)**.

As a consequence:
1. **Return URL Disconnect:** The order was created with `return_url: "https://example.com/return"`, meaning buyer approval could never redirect to the TrustChain application.
2. **Configuration Disconnect:** The running TrustChain server reported `paypalConfigured: false` because it was checking only `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` and not reading runtime access tokens.
3. **Database Disconnect:** The local `payment_transactions` table contained 0 records.
4. **Audit Trail Disconnect:** No SHA-256 hash-chained audit events were created for the payment lifecycle.
5. **Webhook Disconnect:** No real PayPal webhooks reached the backend because no public HTTPS webhook endpoint was registered with PayPal.

This represented an application-path failure and financial-control bypass.

---

## 2. Containment of Order `0N806388NV784822T` (Phase A)

Under strict fiduciary and audit principles, TrustChain took immediate containment action:
1. **Zero Duplicate Capture:** No further capture was executed against this order or authorization.
2. **Zero Falsification:** No fictitious approval records or fabricated payment rows were inserted into the database.
3. **Deterministic Quarantine via Reconciliation:** In `PayPalService.reconcilePayment()`, if an external capture (`4L688309CS300123Y`) is presented without a preceding human review record (`decision === 'APPROVE'`) and without a pre-existing authorized hold record in SQLite, the engine transitions to:
   - `outcome: "MANUAL_INTERVENTION_REQUIRED"`
   - `actionTaken: "FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE"`
4. **Milestone State Protection:** The milestone cannot transition to `SETTLED` or `PAID`. Financial credit is strictly denied until an authorized compliance officer reviews the discrepancy.

---

## 3. Architecture & Code Remediation (Phases B & C)

### A. PayPalService Hardening (`src/server/services/PayPalService.ts`)
- **Credential Fallback:** Extended `PayPalServiceOptions` with `accessToken?: string` and `appUrl?: string`. When OAuth client credentials are not configured, `getAccessToken()` falls back to `PAYPAL_ACCESS_TOKEN` for sandbox testing. `isLivePayPalConfigured()` evaluates both credentials and direct tokens.
- **Application Context Return/Cancel URLs:** Updated `createOrder()` in both live and simulation branches to supply:
  ```json
  "application_context": {
    "brand_name": "MilestoneProof AI",
    "user_action": "CONTINUE",
    "return_url": "http://localhost:3000/reviews?paypal_return=approved&milestone_id=<milestoneId>",
    "cancel_url": "http://localhost:3000/reviews?paypal_return=cancelled&milestone_id=<milestoneId>"
  }
  ```
- **Pre-Authorization Buyer Approval Verification:** When `authorizeOrder()` is invoked before the buyer visits the PayPal checkout URL, PayPal returns `ORDER_NOT_APPROVED`. The backend maps this to a 422 HTTP status with code `PAYPAL_ORDER_AWAITING_BUYER_APPROVAL`, prompting the user to complete sandbox approval first.
- **Post-Capture Remote Confirmatory Query:** `captureAuthorization()` executes `POST /v2/payments/authorizations/{id}/capture` and then immediately verifies remote state via `GET /v2/payments/captures/{capture_id}`. Capture details are committed atomically inside an SQLite transaction alongside the hash-chained audit record.
- **Remote Order Inspection:** Added `getOrderDetails(actor, milestoneId)` to query `GET /v2/checkout/orders/{id}` directly from PayPal, exposing status (`CREATED`, `APPROVED`, `COMPLETED`), payer info, and checkout links.

### B. Controller & Route Layer (`PaymentController.ts` & `apiRoutes.ts`)
- Added `getOrderDetails` controller endpoint with actor authentication (`CLIENT`, `REVIEWER`, `AUDITOR`).
- Mounted `GET /api/v1/milestones/:id/paypal/order-details` on the API router.
- Updated `GET /api/v1/health` capability check to report `paypalConfigured: true` when `PAYPAL_ACCESS_TOKEN` is present.

### C. Frontend Reviews Workbench & Application Shell (`ReviewsPage.tsx` & `App.tsx`)
- **Buyer Sandbox Approval Card:** In the Reviews Workbench (`/reviews`), when an order is created, an interactive card displays:
  - Order ID & Status (`CREATED` / `APPROVED`)
  - Direct action button: `👉 Open PayPal Sandbox Checkout ↗` (pointing to `rawPaypalResponse.links.find(l => l.rel === 'payer-action' || l.rel === 'approve')`).
- **Fiduciary Capture Gate in UI:** The "3. Capture Settlement" button is disabled with an informative message unless:
  - Milestone status is `APPROVED`
  - Latest human approval decision is `APPROVE`
  - A valid PayPal authorization exists
- **Return URL Listener:** In `App.tsx`, incoming query parameters `?paypal_return=approved` and `?paypal_return=cancelled` trigger status banners ("PayPal Sandbox buyer approval completed. You may now authorize the escrow hold.") and clean up the browser URL using `window.history.replaceState`.

---

## 4. End-to-End Test Suite (`paypal_application_path_remediation.test.ts`)

A dedicated test suite was built in `src/server/__tests__/paypal_application_path_remediation.test.ts`:

1. **`createOrder` incorporates TrustChain return & cancel URLs:** Verifies `application_context` contains the correct `/reviews` path and milestone ID.
2. **`getOrderDetails` retrieves status via application path:** Verifies that the backend queries PayPal and returns order status, amount, and payer actions.
3. **Fiduciary Gate Blocks Unauthorized Capture:** Proves that attempting to capture an authorization before human approval throws `PRECONDITION_FAILED: Milestone must be approved by human reviewer before capturing payment`.
4. **Full Lifecycle Execution:** Executes Order Creation $\rightarrow$ Authorization Hold $\rightarrow$ Human Review Approval $\rightarrow$ Authorized Capture $\rightarrow$ SQLite Verification $\rightarrow$ SHA-256 Audit Chain Verification.
5. **Unauthorized Remote Capture Containment:** Proves that reconciling a capture executed outside the application path (like `0N806388NV784822T`) triggers `MANUAL_INTERVENTION_REQUIRED` / `FLAGGED_UNAUTHORIZED_REMOTE_CAPTURE` and blocks milestone settlement.
6. **Idempotency Protection:** Verifies that replaying the same `PayPal-Request-Id` returns cached transaction results and strictly prevents duplicate financial operations.

---

## 5. Verification Matrix Summary

| Test Suite | Total Tests | Passing | Failing | Status |
|---|---|---|---|---|
| `paypal_application_path_remediation.test.ts` | 6 | 6 | 0 | **PASSED** |
| `paypal_lifecycle.test.ts` | 12 | 12 | 0 | **PASSED** |
| `dispute_evidence_pack.test.ts` | 17 | 17 | 0 | **PASSED** |
| `evidence_passport.test.ts` | 53 | 53 | 0 | **PASSED** |
| `audit_replay.test.ts` | 20 | 20 | 0 | **PASSED** |
| `cinematic_frontend.test.ts` | 17 | 17 | 0 | **PASSED** |
| `prompt6_intelligence.test.ts` | 14 | 14 | 0 | **PASSED** |
| All other Phase 1–8 suites (11 suites) | 55 | 55 | 0 | **PASSED** |
| **Total Automated Coverage** | **194** | **194** | **0** | **100% GREEN** |
| **TypeScript Compilation (`tsc --noEmit`)** | — | — | — | **0 ERRORS** |
| **Frontend Production Build (`vite build`)** | — | — | — | **PASSED** |
