# PHASE 6 — PayPal Security Remediation & Payment Integrity Report

## 1. Executive Summary

Phase 6 remediates every critical and high-priority PayPal vulnerability identified in the independent Phase 5 implementation audit. The PayPal Orders API v2 settlement engine (`src/server/services/PayPalService.ts`) is now:

1. **Authoritative on Live Authorization IDs:** Extracts and validates `purchase_units[0].payments.authorizations[0].id` from PayPal's authorization response, rejects missing or malformed authorization IDs (`422 MISSING_PAYPAL_AUTHORIZATION_ID`, `422 MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE`), never falls back to synthetic `AUTH-MPAI-*` IDs in live sandbox mode, and passes the persisted real authorization ID to `POST /v2/payments/authorizations/{id}/capture`.
2. **Cryptographically Verified on Webhooks (Fail-Closed):** Replaces header-format/length checks with PayPal's official webhook verification endpoint (`POST /v1/notifications/verify-webhook-signature`) using server-side OAuth2 credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) and configured `PAYPAL_WEBHOOK_ID`. Fails closed (`503`) when webhook configuration is missing or when PayPal's verification service is unreachable, and accepts events only when `verification_status === 'SUCCESS'`.
3. **Idempotent & Transactional on Webhook Processing:** Persists every webhook delivery in the `paypal_webhook_events` SQLite table (`event_id TEXT PRIMARY KEY`) via `WebhookEventRepository`, prevents duplicate and concurrent duplicate deliveries, rolls back state mutations on database failures while marking the event `FAILED` for safe retry, and logs all verified, duplicate, failed, and rejected webhook events in the SHA-256 hash-chained audit trail.
4. **Explicitly Separated Between Simulation and Real Sandbox Settlement:** Distinguishes `SANDBOX_SIMULATION` (`SIMULATED_ORDER_CREATED`, `SIMULATED_AUTHORIZED`, `SIMULATED_CAPTURED`, `SIMULATED_PARTIALLY_CAPTURED`) from `PAYPAL_SANDBOX` (`ORDER_CREATED`, `AUTHORIZED`, `CAPTURED`, `PARTIALLY_CAPTURED_VOIDED`). A simulated capture **never** transitions `milestone.status` to `SETTLED` or `milestone.paymentStatus` to `CAPTURED`.

---

## 2. Remediated Findings

### Finding 1 — Live Authorization ID Extraction (`PayPalService.authorizeOrder`)
- **Previous Weakness:** `authorizeOrder()` initialized a synthetic `AUTH-MPAI-...` authorization ID before calling PayPal's `POST /v2/checkout/orders/{id}/authorize` endpoint and did not extract `purchase_units[0].payments.authorizations[0].id` from the returned JSON response.
- **Remediation:** Implemented `extractLiveAuthorizationFromOrderResponse(rawAuthResponse)` in `src/server/services/PayPalService.ts`. In live `PAYPAL_SANDBOX` mode:
  - Validates that the response is a JSON object containing `purchase_units[0].payments.authorizations[0].id`.
  - Rejects missing or empty authorization IDs with `422 MISSING_PAYPAL_AUTHORIZATION_ID`.
  - Rejects malformed JSON responses with `422 MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE`.
  - Rejects non-active authorization statuses (`DENIED`, `VOIDED`, `EXPIRED`) with `422 PAYPAL_AUTHORIZATION_NOT_ACTIVE`.
  - Persists the real `paypalOrderId`, `paypalAuthorizationId`, and `expiration_time` (`authExpiresAt`), and uses `latestTx.paypalAuthorizationId` directly in `POST /v2/payments/authorizations/{authorization_id}/capture`.

### Finding 2 — Official PayPal Webhook Signature Verification (`PayPalService.handleWebhook`)
- **Previous Weakness:** `handleWebhook()` checked header presence, `https://api.sandbox.paypal.com` certificate domain regex, and `transmissionSig.length >= 12`, without calling PayPal's cryptographic signature verification API.
- **Remediation:** Implemented `verifyWebhookSignatureWithPayPal()` in `src/server/services/PayPalService.ts`:
  - Obtains a server-side OAuth2 Bearer token via `POST /v1/oauth2/token`.
  - Calls `POST /v1/notifications/verify-webhook-signature` with `transmission_id`, `transmission_time`, `cert_url`, `auth_algo`, `transmission_sig`, `webhook_id` (`PAYPAL_WEBHOOK_ID`), and `webhook_event`.
  - Accepts the webhook **only** when PayPal returns `verification_status === 'SUCCESS'`.
  - Fails closed (`503 WEBHOOK_VERIFICATION_UNAVAILABLE`) when `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, or `PAYPAL_WEBHOOK_ID` is missing.
  - Fails closed (`503 PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE`) when PayPal's OAuth2 or verification endpoint is unreachable, returns non-200, or returns malformed JSON.
  - Rejects invalid signatures (`verification_status !== 'SUCCESS'`) with `401 INVALID_PAYPAL_WEBHOOK_SIGNATURE` and logs `PAYPAL_WEBHOOK_REJECTED` in the audit trail without mutating payment or milestone state.

### Finding 3 — Persistent Webhook Event Idempotency (`paypal_webhook_events`)
- **Previous Weakness:** Replaying the same verified webhook `event.id` could re-run state transitions and append duplicate reconciliation entries.
- **Remediation:**
  - Added schema migration `003_phase6_paypal_webhook_idempotency` in `src/server/repositories/Database.ts` creating `paypal_webhook_events` with `event_id TEXT PRIMARY KEY`.
  - Implemented `WebhookEventRepository` in `src/server/repositories/DomainRepositories.ts`.
  - Combined an in-memory concurrency lock (`activeWebhookLocks`) with persistent `processing_status` tracking (`PROCESSING`, `PROCESSED`, `FAILED`, `REJECTED`):
    - Already-`PROCESSED` or in-flight concurrent duplicate events return `{ verified: true, eventId, status: 'DUPLICATE_IGNORED', duplicate: true }` and record `PAYPAL_WEBHOOK_DUPLICATE_IGNORED` in the audit log without mutating payment or milestone state.
    - If a database error occurs during reconciliation, the SQLite transaction rolls back, the webhook event record is marked `FAILED`, and a subsequent retry of the same `event_id` is permitted to re-execute reconciliation cleanly.

### Finding 4 — Separation of `SANDBOX_SIMULATION` from Real `PAYPAL_SANDBOX` Settlement
- **Previous Weakness:** Simulated captures transitioned `milestone.status` to `SETTLED` and `milestone.paymentStatus` to `CAPTURED`, making simulated captures indistinguishable from verified PayPal sandbox settlements at the milestone level.
- **Remediation:**
  - Added explicit simulation statuses (`SIMULATED_ORDER_CREATED`, `SIMULATED_AUTHORIZED`, `SIMULATED_CAPTURED`, `SIMULATED_PARTIALLY_CAPTURED`) to `PaymentStatus` and `PayPalTransactionStatus` in `src/types/domain.ts`, `Database.ts`, `openapi.yaml`, and `PayPalService.ts`.
  - Standardized `executionMode` to `'PAYPAL_SANDBOX' | 'SANDBOX_SIMULATION'`.
  - In `SANDBOX_SIMULATION` mode, `captureAuthorization()` sets `milestone.paymentStatus` to `'SIMULATED_CAPTURED'` (or `'SIMULATED_PARTIALLY_CAPTURED'`) and leaves `milestone.status` as `'APPROVED'` (**never** `'SETTLED'`).
  - Only a verified `PAYPAL_SANDBOX` capture transitions `milestone.status` to `'SETTLED'` and `milestone.paymentStatus` to `'CAPTURED'`.
  - Updated `HumanReviewService.getFinancialDecisionLedger()` and `src/App.tsx` to include and display `paymentExecutionMode` (`PAYPAL_SANDBOX` vs `SANDBOX_SIMULATION` vs `NONE`).

---

## 3. Verification & Test Coverage (`src/server/__tests__/phase6.test.ts`)

All **26 automated tests across 6 test suites** (`phase1` through `phase6`) pass (`0` failures):

1. `1. Authorization ID Extraction & Persistence`: Verifies real PayPal order creation (`PAYPAL-LIVE-ORD-778899`), rejection of missing authorization ID (`422 MISSING_PAYPAL_AUTHORIZATION_ID`), rejection of malformed JSON (`422 MALFORMED_PAYPAL_AUTHORIZATION_RESPONSE`), extraction of real authorization ID (`PAYPAL-REAL-AUTH-99001122`), and capture against `/v2/payments/authorizations/PAYPAL-REAL-AUTH-99001122/capture`.
2. `2. Genuine Webhook Verification (Fail-Closed)`: Verifies fail-closed `503 WEBHOOK_VERIFICATION_UNAVAILABLE` when `PAYPAL_WEBHOOK_ID` is unconfigured, `401 INVALID_PAYPAL_WEBHOOK_SIGNATURE` when PayPal returns `verification_status: 'FAILURE'`, fail-closed `503 PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE` on HTTP 500 or network error, and state reconciliation only when PayPal returns `verification_status: 'SUCCESS'`.
3. `3. Webhook Idempotency, Concurrency & Failure Recovery`: Verifies first valid webhook delivery (`VERIFIED_LOGGED`), second duplicate delivery (`DUPLICATE_IGNORED`), concurrent duplicate deliveries (`Promise.all`), atomic rollback on transient failure during reconciliation (`FAILED`), and successful retry of the failed webhook event (`RECONCILED_VOIDED` -> `PROCESSED`).
4. `4. Simulation vs. Real Sandbox Separation & Financial Safety Guards`: Verifies that `SANDBOX_SIMULATION` records `SIMULATED_ORDER_CREATED` -> `SIMULATED_AUTHORIZED` -> `SIMULATED_CAPTURED` while keeping `milestone.status === 'APPROVED'` (never `SETTLED`), and verifies over-approval blocking (`400`), declined capture handling (`422 PAYPAL_CAPTURE_DECLINED`), and retry capture with a new `PayPal-Request-Id`.
