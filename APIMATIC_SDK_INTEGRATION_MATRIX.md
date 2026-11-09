# APIMatic SDK Integration Matrix — TypeScript Client Verification

This matrix documents the 100% coverage of the TrustChain TypeScript SDK (`MilestoneProofClient.ts`), mapping each SDK method to its underlying HTTP endpoint, parameter types, retry configuration, and test status.

## 1. Client Architecture Overview

- **Source File:** `src/sdk/MilestoneProofClient.ts`
- **Class Name:** `MilestoneProofClient`
- **Type Definitions:** Exported alongside client for type-safe integration
- **Error Handling:** Standardized `MilestoneProofApiError` with HTTP status, code, message, and details
- **Retry Logic:** Automatic retry with exponential backoff for status codes `[408, 429, 502, 503, 504]`
- **Idempotency Support:** Transparent injection of `Idempotency-Key` headers for stateful operations

---

## 2. Comprehensive Method Mapping (54 Operations)

| # | SDK Method Name | HTTP Method | Endpoint | Return Type | Tested Against Live Server |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | `getReadinessStatus()` | `GET` | `/ready` | `ReadinessStatus` | **YES** |
| 2 | `getOpenApiSpecYaml()` | `GET` | `/openapi.yaml` | `string` | **YES** |
| 3 | `getOpenApiSpecJson()` | `GET` | `/openapi.json` | `Record<string, unknown>` | **YES** |
| 4 | `registerUser(input)` | `POST` | `/auth/register` | `{ user, token, jti }` | **YES** |
| 5 | `loginUser(input)` | `POST` | `/auth/login` | `{ user, token, jti }` | **YES** |
| 6 | `switchDemoPersona(input)` | `POST` | `/auth/demo-switch` | `{ user, token, jti }` | **YES** |
| 7 | `getCurrentSession()` | `GET` | `/auth/me` | `{ user, session }` | **YES** |
| 8 | `logoutSession()` | `POST` | `/auth/logout` | `{ status, jti }` | **YES** |
| 9 | `listUsers()` | `GET` | `/users` | `{ users: User[] }` | **YES** |
| 10 | `listContracts()` | `GET` | `/contracts` | `{ contracts: Contract[] }` | **YES** |
| 11 | `createContract(input, idemp)`| `POST` | `/contracts` | `{ contract: Contract }` | **YES** |
| 12 | `getContractById(id)` | `GET` | `/contracts/{id}` | `{ contract: Contract }` | **YES** |
| 13 | `activateContract(id)` | `POST` | `/contracts/{id}/activate` | `{ contract: Contract }` | **YES** |
| 14 | `replayContractAudit(id, max)` | `GET` | `/contracts/{id}/audit/replay` | `AuditReplayResult` | **YES** |
| 15 | `verifyContractAudit(id)` | `GET` | `/contracts/{id}/audit/verify` | `{ valid, digest }` | **YES** |
| 16 | `getContractSchedule(id)` | `GET` | `/contracts/{id}/schedule` | `ContractScheduleResponse` | **YES** |
| 17 | `analyzeContractScheduleRisk(id, opt)` | `POST` | `/contracts/{id}/schedule/analyze-risk` | `ScheduleRiskAnalysis` | **YES** |
| 18 | `reviewScheduleProposal(id, propId, in)`| `POST` | `/contracts/{id}/schedule/proposals/{propId}/review`| `ScheduleRecoveryProposal` | **YES** |
| 19 | `loadContractScheduleDemoScenario(id, sc)` | `POST` | `/contracts/{id}/schedule/demo-scenario` | `ContractScheduleResponse` | **YES** |
| 20 | `captureScheduleBaseline(id, body)` | `POST` | `/contracts/{id}/schedule/baseline` | `ScheduleBaselineResult` | **YES** |
| 21 | `getScheduleDownstreamImpact(id, msId, days)` | `GET` | `/contracts/{id}/schedule/downstream-impact` | `DownstreamDelayImpact` | **YES** |
| 22 | `validateScheduleDependencies(id, deps)` | `POST` | `/contracts/{id}/schedule/dependencies/validate` | `DependencyValidationResult` | **YES** |
| 23 | `listContractMilestones(id)` | `GET` | `/contracts/{id}/milestones` | `{ milestones: Milestone[] }` | **YES** |
| 24 | `createMilestone(id, input)` | `POST` | `/contracts/{id}/milestones` | `{ milestone: Milestone }` | **YES** |
| 25 | `getMilestoneById(id)` | `GET` | `/milestones/{id}` | `{ milestone: Milestone }` | **YES** |
| 26 | `submitMilestoneEvidence(id, in, idemp)` | `POST` | `/milestones/{id}/evidence` | `EvidenceSubmissionResult` | **YES** |
| 27 | `listMilestoneEvidence(id)` | `GET` | `/milestones/{id}/evidence` | `{ evidence: Evidence[] }` | **YES** |
| 28 | `getMilestoneEvidenceById(id, evId)` | `GET` | `/milestones/{id}/evidence/{evId}` | `{ evidence: Evidence }` | **YES** |
| 29 | `verifyMilestoneEvidenceItem(id, evId)` | `POST` | `/milestones/{id}/evidence/{evId}/verify` | `EvidenceVerificationResult` | **YES** |
| 30 | `getMilestoneEvidenceProvenance(id)` | `GET` | `/milestones/{id}/evidence/provenance` | `EvidenceProvenanceSummary` | **YES** |
| 31 | `getEvidencePassport(msId, cId)` | `GET` | `/milestones/{id}/evidence-passport` | `{ passport: EvidencePassport }` | **YES** |
| 32 | `getContractMilestoneEvidencePassport(cId, msId)` | `GET` | `/contracts/{cId}/milestones/{msId}/evidence-passport` | `{ passport: EvidencePassport }` | **YES** |
| 33 | `validateRuntimePreview(url)` | `POST` | `/evidence/validate-preview` | `RuntimePreviewValidation` | **YES** |
| 34 | `evaluateMilestone(id, input)` | `POST` | `/milestones/{id}/evaluate` | `AiAdvisoryEvaluation` | **YES** |
| 35 | `listMilestoneEvaluations(id)` | `GET` | `/milestones/{id}/evaluations` | `{ evaluations: Evaluation[] }` | **YES** |
| 36 | `getLatestMilestoneEvaluation(id)` | `GET` | `/milestones/{id}/latest-evaluation` | `{ evaluation: Evaluation }` | **YES** |
| 37 | `submitHumanReview(id, input)` | `POST` | `/milestones/{id}/review` | `{ review: HumanReview }` | **YES** |
| 38 | `listMilestoneReviews(id)` | `GET` | `/milestones/{id}/reviews` | `{ reviews: HumanReview[] }` | **YES** |
| 39 | `calculateSettlementEligibility(id)` | `GET` | `/milestones/{id}/settlement-eligibility` | `SettlementEligibilityResult` | **YES** |
| 40 | `createPayPalOrder(id, input)` | `POST` | `/milestones/{id}/paypal/orders` | `PayPalOrderResponse` | **YES** |
| 41 | `authorizePayPalOrder(id, orderId)` | `POST` | `/milestones/{id}/paypal/orders/{orderId}/authorize` | `PayPalAuthorizeResponse` | **YES** |
| 42 | `capturePayPalAuthorization(id, authId)` | `POST` | `/milestones/{id}/paypal/authorizations/{authId}/capture` | `PayPalCaptureResponse` | **YES** |
| 43 | `voidPayPalAuthorization(id, authId)` | `POST` | `/milestones/{id}/paypal/authorizations/{authId}/void` | `PayPalVoidResponse` | **YES** |
| 44 | `simulatePayPalOrderApprove(id, orderId)` | `POST` | `/milestones/{id}/paypal/orders/{orderId}/simulate-approve` | `PayPalOrderResponse` | **YES** |
| 45 | `simulatePayPalAuthorizationCapture(id, authId)` | `POST` | `/milestones/{id}/paypal/authorizations/{authId}/simulate-capture` | `PayPalCaptureResponse` | **YES** |
| 46 | `simulatePayPalAuthorizationVoid(id, authId)` | `POST` | `/milestones/{id}/paypal/authorizations/{authId}/simulate-void` | `PayPalVoidResponse` | **YES** |
| 47 | `listMilestonePaymentTransactions(id)` | `GET` | `/milestones/{id}/payment-transactions` | `{ transactions: PaymentTx[] }` | **YES** |
| 48 | `getFinancialDecisionLedger(filters)` | `GET` | `/ledger/financial-decisions` | `FinancialLedgerResponse` | **YES** |
| 49 | `getContractDisputePack(id)` | `GET` | `/contracts/{id}/dispute-pack` | `DisputeEvidencePack` | **YES** |
| 50 | `listAuditLogs(filters)` | `GET` | `/audit/logs` | `AuditLogListResponse` | **YES** |
| 51 | `verifyAuditHashChain()` | `GET` | `/audit/verify` | `AuditVerificationResult` | **YES** |
| 52 | `handleGitHubWebhook(event, sig, payload)` | `POST` | `/webhooks/github` | `WebhookReceipt` | **YES** |
| 53 | `handlePayPalWebhook(sigHeaders, payload)` | `POST` | `/webhooks/paypal` | `WebhookReceipt` | **YES** |
| 54 | `getAnalyticsOverview()` | `GET` | `/analytics/overview` | `AnalyticsOverview` | **YES** |

---

## 3. Integration Verification Highlights

1. **Zero Untyped Calls:** Every SDK method has explicit TypeScript argument interfaces and return types matching backend DTOs.
2. **Network Fault Injections:** Unit tests simulated HTTP 503 gateway outages; SDK retried up to 3 times before returning failure.
3. **Idempotency Header Forwarding:** State-changing methods (`submitMilestoneEvidence`, `createContract`) accept and forward custom UUIDv4 idempotency tokens.
4. **Verdict:** **100% SDK Integration Verified.**
