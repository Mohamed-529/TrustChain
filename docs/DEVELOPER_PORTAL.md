# MilestoneProof AI — Developer Portal & APIMatic SDK Integration Guide

## 1. Overview

MilestoneProof AI exposes an OpenAPI 3.0.3 governed REST API (`/api/v1`) and a strongly-typed TypeScript Client SDK ([`src/sdk/MilestoneProofClient.ts`](../src/sdk/MilestoneProofClient.ts)) aligned with [`openapi.yaml`](../openapi.yaml) and [`APIMATIC-META.json`](../APIMATIC-META.json).

### Live OpenAPI Discovery Endpoints
- **YAML Specification:** `GET /api/v1/openapi.yaml`
- **JSON Discovery & Registered Request Schemas:** `GET /api/v1/openapi.json`

---

## 2. APIMatic Validation & PayPal Context Plugin Investigation

### A. OpenAPI 3.0.3 & APIMatic Governance (`openapi.yaml` + `APIMATIC-META.json`)
- **28 Globally Unique `operationId`s across 10 Controller Groups:**
  1. `System`: `getSystemHealth`, `getOpenApiJson`, `getOpenApiYaml`
  2. `Auth`: `loginUser`, `switchDemoPersona`, `getCurrentSession`, `logoutSession`
  3. `Users`: `listUsers`
  4. `Contracts` (including Bryntum Schedule Control Tower): `listContracts`, `createContract`, `getContractById`, `activateContract`, `getContractSchedule`, `analyzeContractScheduleRisk`, `reviewScheduleProposal`
  5. `Evidence`: `submitMilestoneEvidence`, `listMilestoneEvidence`
  6. `Evaluations`: `evaluateMilestoneEvidence`, `listMilestoneEvaluations`
  7. `SettlementPolicy`: `previewSettlementPolicy`, `getFinancialDecisionLedger`
  8. `Approvals`: `submitHumanReview`
  9. `Payments` (PayPal Orders API v2): `createPayPalOrder`, `authorizePayPalOrder`, `capturePayPalAuthorization`, `handlePayPalWebhook`
  10. `Audit`: `listAuditLogs`, `verifyAuditHashChain`
- **Strict Integer-Cent Monetary Schemas:** Every monetary field (`totalBudgetCents`, `agreedAmountCents`, `permittedAmountCents`, `approvedAmountCents`, `authorizedAmountCents`, `capturedAmountCents`) is enforced as `type: integer` to eliminate floating-point rounding defects.

### B. Official APIMatic PayPal Context Plugin Compatibility Assessment
- **Investigation:** We inspected the official APIMatic Context Plugin for PayPal (`npx context-plugins install paypal` / `@paypal/paypal-server-sdk`) and queried the Google Antigravity Agent Marketplace (`search_marketplace` for `apimatic` and `paypal`).
- **Findings:**
  - The APIMatic PayPal Context Plugin is designed to ground AI coding agents in the authoritative APIMatic-generated `@paypal/paypal-server-sdk` (PayPal Orders API v2 & Payments API v2) rather than the deprecated `paypal-rest-sdk` v1.
  - It is not currently listed as a native one-click card in the Antigravity Marketplace (`{"results":[]}`).
  - Accordingly, we grounded [`PayPalService.ts`](../src/server/services/PayPalService.ts) and [`MilestoneProofClient.ts`](../src/sdk/MilestoneProofClient.ts) directly in the authoritative PayPal Orders API v2 & Authorizations API v2 schemas:
    - `POST /v2/checkout/orders` (`intent: "AUTHORIZE"`)
    - `POST /v2/checkout/orders/{id}/authorize` (29-day authorization validity window)
    - `POST /v2/payments/authorizations/{authorization_id}/capture` (`final_capture: true`, `PayPal-Request-Id` idempotency)
    - `POST /v1/notifications/verify-webhook-signature` (`PAYPAL-TRANSMISSION-*` headers)

---

## 3. Quickstart: Integrating with `MilestoneProofClient` TypeScript SDK

```typescript
import { MilestoneProofClient } from '../src/sdk/MilestoneProofClient.ts';

const client = new MilestoneProofClient({
  baseUrl: 'http://localhost:3000/api/v1',
});

// 1. Authenticate as Client and create + authorize a PayPal Order (intent: AUTHORIZE)
await client.switchDemoPersona({ userId: 'client_01' });
const { transaction: orderTx } = await client.createPayPalOrder('ms_seed_01', 'idemp_order_001');
const { transaction: authTx } = await client.authorizePayPalOrder('ms_seed_01', 'idemp_auth_001');

// 2. Inspect Bryntum Gantt Schedule & AI Schedule-Risk Proposals
const schedule = await client.getContractSchedule('contract_seed_01');
console.log('Critical Path Tasks:', schedule.criticalPathTaskIds);

// 3. Approve milestone as Reviewer and execute idempotent PayPal Capture
await client.switchDemoPersona({ userId: 'reviewer_01' });
const { evaluation } = await client.evaluateMilestoneEvidence('ms_seed_01');
await client.submitHumanReview('ms_seed_01', {
  evaluationId: evaluation.id,
  decision: 'APPROVE',
  approvedAmountCents: evaluation.policyCalculation.permittedAmountCents,
  justification: 'Verified all acceptance criteria and CI tests.',
});
const { transaction: captureTx } = await client.capturePayPalAuthorization('ms_seed_01', 'idemp_capture_001');
console.log('Captured Settlement:', captureTx.paypalCaptureId, captureTx.capturedAmountCents);
```
