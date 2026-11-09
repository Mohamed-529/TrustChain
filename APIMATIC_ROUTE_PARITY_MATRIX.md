# APIMatic Route Parity Matrix — 100% Contract Verification

This matrix documents all **54 effective HTTP routes** in TrustChain, mapping each Express endpoint to its corresponding OpenAPI 3.0.3 operation in `openapi.yaml`.

| # | HTTP Method | Path Pattern | Operation ID | Tag / Domain | Security Scheme | Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | `GET` | `/ready` | `getReadinessStatus` | Health & Probes | None (Public) | **VERIFIED** |
| 2 | `GET` | `/openapi.yaml` | `getOpenApiSpecYaml` | Developer Documentation | None (Public) | **VERIFIED** |
| 3 | `GET` | `/openapi.json` | `getOpenApiSpecJson` | Developer Documentation | None (Public) | **VERIFIED** |
| 4 | `POST` | `/auth/register` | `registerUser` | Authentication | None (Public) | **VERIFIED** |
| 5 | `POST` | `/auth/login` | `loginUser` | Authentication | None (Public) | **VERIFIED** |
| 6 | `POST` | `/auth/demo-switch` | `switchDemoPersona` | Authentication | None (Public) | **VERIFIED** |
| 7 | `GET` | `/auth/me` | `getCurrentSession` | Authentication | BearerAuth | **VERIFIED** |
| 8 | `POST` | `/auth/logout` | `logoutSession` | Authentication | BearerAuth | **VERIFIED** |
| 9 | `GET` | `/users` | `listUsers` | Users | BearerAuth | **VERIFIED** |
| 10 | `GET` | `/contracts` | `listContracts` | Contracts | BearerAuth | **VERIFIED** |
| 11 | `POST` | `/contracts` | `createContract` | Contracts | BearerAuth | **VERIFIED** |
| 12 | `GET` | `/contracts/{id}` | `getContractById` | Contracts | BearerAuth | **VERIFIED** |
| 13 | `POST` | `/contracts/{id}/activate` | `activateContract` | Contracts | BearerAuth | **VERIFIED** |
| 14 | `GET` | `/contracts/{id}/audit/replay` | `replayContractAudit` | Audit & Replay | BearerAuth | **VERIFIED** |
| 15 | `GET` | `/contracts/{id}/audit/verify` | `verifyContractAudit` | Audit & Replay | BearerAuth | **VERIFIED** |
| 16 | `GET` | `/contracts/{id}/schedule` | `getContractSchedule` | Schedule Control Tower | BearerAuth | **VERIFIED** |
| 17 | `POST` | `/contracts/{id}/schedule/analyze-risk` | `analyzeContractScheduleRisk` | Schedule Control Tower | BearerAuth | **VERIFIED** |
| 18 | `POST` | `/contracts/{id}/schedule/proposals/{proposalId}/review` | `reviewScheduleProposal` | Schedule Control Tower | BearerAuth | **VERIFIED** |
| 19 | `POST` | `/contracts/{id}/schedule/demo-scenario` | `loadContractScheduleDemoScenario` | Schedule Control Tower | BearerAuth | **VERIFIED** |
| 20 | `POST` | `/contracts/{id}/schedule/baseline` | `captureScheduleBaseline` | Schedule Control Tower | BearerAuth | **VERIFIED** |
| 21 | `GET` | `/contracts/{id}/schedule/downstream-impact` | `getScheduleDownstreamImpact` | Schedule Control Tower | BearerAuth | **VERIFIED** |
| 22 | `POST` | `/contracts/{id}/schedule/dependencies/validate` | `validateScheduleDependencies` | Schedule Control Tower | BearerAuth | **VERIFIED** |
| 23 | `GET` | `/contracts/{id}/milestones` | `listContractMilestones` | Milestones | BearerAuth | **VERIFIED** |
| 24 | `POST` | `/contracts/{id}/milestones` | `createMilestone` | Milestones | BearerAuth | **VERIFIED** |
| 25 | `GET` | `/milestones/{id}` | `getMilestoneById` | Milestones | BearerAuth | **VERIFIED** |
| 26 | `POST` | `/milestones/{id}/evidence` | `submitMilestoneEvidence` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 27 | `GET` | `/milestones/{id}/evidence` | `listMilestoneEvidence` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 28 | `GET` | `/milestones/{id}/evidence/{evidenceId}` | `getMilestoneEvidenceById` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 29 | `POST` | `/milestones/{id}/evidence/{evidenceId}/verify` | `verifyMilestoneEvidenceItem` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 30 | `GET` | `/milestones/{id}/evidence/provenance` | `getMilestoneEvidenceProvenance` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 31 | `GET` | `/milestones/{id}/evidence-passport` | `getMilestoneEvidencePassport` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 32 | `GET` | `/contracts/{contractId}/milestones/{milestoneId}/evidence-passport` | `getContractMilestoneEvidencePassport` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 33 | `POST` | `/evidence/validate-preview` | `validateRuntimePreview` | Evidence & Verification | BearerAuth | **VERIFIED** |
| 34 | `POST` | `/milestones/{id}/evaluate` | `evaluateMilestone` | AI Advisory Workflow | BearerAuth | **VERIFIED** |
| 35 | `GET` | `/milestones/{id}/evaluations` | `listMilestoneEvaluations` | AI Advisory Workflow | BearerAuth | **VERIFIED** |
| 36 | `GET` | `/milestones/{id}/latest-evaluation` | `getLatestMilestoneEvaluation` | AI Advisory Workflow | BearerAuth | **VERIFIED** |
| 37 | `POST` | `/milestones/{id}/review` | `submitHumanReview` | Review & Settlement | BearerAuth | **VERIFIED** |
| 38 | `GET` | `/milestones/{id}/reviews` | `listMilestoneReviews` | Review & Settlement | BearerAuth | **VERIFIED** |
| 39 | `GET` | `/milestones/{id}/settlement-eligibility` | `calculateSettlementEligibility` | Review & Settlement | BearerAuth | **VERIFIED** |
| 40 | `POST` | `/milestones/{id}/paypal/orders` | `createPayPalOrder` | PayPal Integration | BearerAuth | **VERIFIED** |
| 41 | `POST` | `/milestones/{id}/paypal/orders/{orderId}/authorize` | `authorizePayPalOrder` | PayPal Integration | BearerAuth | **VERIFIED** |
| 42 | `POST` | `/milestones/{id}/paypal/authorizations/{authorizationId}/capture` | `capturePayPalAuthorization` | PayPal Integration | BearerAuth | **VERIFIED** |
| 43 | `POST` | `/milestones/{id}/paypal/authorizations/{authorizationId}/void` | `voidPayPalAuthorization` | PayPal Integration | BearerAuth | **VERIFIED** |
| 44 | `POST` | `/milestones/{id}/paypal/orders/{orderId}/simulate-approve` | `simulatePayPalOrderApprove` | PayPal Integration | BearerAuth | **VERIFIED** |
| 45 | `POST` | `/milestones/{id}/paypal/authorizations/{authorizationId}/simulate-capture` | `simulatePayPalAuthorizationCapture` | PayPal Integration | BearerAuth | **VERIFIED** |
| 46 | `POST` | `/milestones/{id}/paypal/authorizations/{authorizationId}/simulate-void` | `simulatePayPalAuthorizationVoid` | PayPal Integration | BearerAuth | **VERIFIED** |
| 47 | `GET` | `/milestones/{id}/payment-transactions` | `listMilestonePaymentTransactions` | PayPal Integration | BearerAuth | **VERIFIED** |
| 48 | `GET` | `/ledger/financial-decisions` | `getFinancialDecisionLedger` | Financial Ledger | BearerAuth | **VERIFIED** |
| 49 | `GET` | `/contracts/{id}/dispute-pack` | `getContractDisputePack` | Dispute Resolution | BearerAuth | **VERIFIED** |
| 50 | `GET` | `/audit/logs` | `listAuditLogs` | Audit & Replay | BearerAuth | **VERIFIED** |
| 51 | `GET` | `/audit/verify` | `verifyAuditHashChain` | Audit & Replay | BearerAuth | **VERIFIED** |
| 52 | `POST` | `/webhooks/github` | `handleGitHubWebhook` | Inbound Webhooks | GitHub-Hmac (Public) | **VERIFIED** |
| 53 | `POST` | `/webhooks/paypal` | `handlePayPalWebhook` | Inbound Webhooks | PayPal-Auth-Algo (Public) | **VERIFIED** |
| 54 | `GET` | `/analytics/overview` | `getAnalyticsOverview` | Analytics | BearerAuth | **VERIFIED** |

**Total Registered Operations:** 54  
**Total Documented in openapi.yaml:** 54  
**Parity Score:** 100.0%  
**Verdict:** **VERIFIED**
