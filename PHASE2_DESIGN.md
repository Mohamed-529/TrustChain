# Phase 2 Design — Independent Phase 1 Audit, OpenAPI 3.0.3 Contract & APIMatic Governance

## 1. Trusted Reference Standards Applied

This review and API contract design selectively incorporates patterns from the following trusted open-source and standards references (verified for MIT / Apache-2.0 / CC-BY-SA-4.0 compatibility with zero unnecessary package installations):

| Reference | URL | License | Specific Patterns Applied to MilestoneProof AI |
| :--- | :--- | :--- | :--- |
| **OWASP ASVS v4.0.3** | https://github.com/OWASP/ASVS | CC-BY-SA-4.0 | **V2 (Authentication):** Async `crypto.scrypt` password verification. **V3 (Session Management):** Server-side `auth_sessions` (`jti`) registry with logout revocation. **V4 (Access Control):** Server-authoritative DB role lookup & separation of duties (`developerId != reviewerId`). **V13 (API Verification):** Strict JSON schema validation (`additionalProperties: false`). |
| **Semgrep Rules** | https://github.com/semgrep/semgrep-rules | LGPL-2.1 (Reference Only) | Checked against Node.js/TypeScript security anti-patterns: timing-safe HMAC comparison (`crypto.timingSafeEqual`), 100% parameterized SQLite prepared statements (`?` placeholders), zero `eval`/`child_process` on untrusted evidence, and production fail-fast secret checks. |
| **OpenAPI Specification** | https://github.com/OAI/OpenAPI-Specification | Apache-2.0 | Normative OpenAPI `3.0.3` specification (`openapi.yaml`) with reusable `components/schemas`, `components/parameters`, `components/responses`, and `securitySchemes`. |
| **APIMatic Documentation** | https://docs.apimatic.io/ | Documentation | APIMatic SDK & Portal readiness rules (`APIMATIC-META.json`): globally unique `operationId`s across all 25 operations, explicit tag grouping, named component schemas (avoiding anonymous inline polymorphism), integer-cent monetary types, and `Idempotency-Key` / `PayPal-Request-Id` headers. |
| **Claude Skills** | https://github.com/alirezarezvani/claude-skills | MIT | Structured architectural review checklist, API contract completeness verification, and financial state-machine boundary auditing. |
| **shadcn/ui** | https://github.com/shadcn-ui/ui | MIT | Accessible, high-contrast UI primitive patterns (`Card`, `Badge`, `Dialog`, `Tabs`, `Alert`) for the Forensic Institutional Ledger without replacing **AG Grid Community** or **Bryntum Gantt**. |

---

## 2. Independent Phase 1 Quality & Security Check

We inspected `PROJECT_STATUS.md`, `src/server/index.ts`, `src/server/services/AuthService.ts`, `src/server/services/AuditService.ts`, `src/server/services/ContractService.ts`, `src/server/middleware/authMiddleware.ts`, `src/server/repositories/Database.ts`, and `src/server/repositories/DomainRepositories.ts`, using the verified `7 / 7` passing test suites as baseline evidence.

### Summary of Findings by Severity

| Severity | Count | Finding ID & Summary | Status / Disposition |
| :--- | :---: | :--- | :--- |
| **Critical** | **0** | None. | All critical auth, RBAC, transaction, and audit requirements are met. |
| **High** | **0** | None. | Async `scrypt`, `PRAGMA synchronous = FULL`, and `audit_logs` SQLite triggers (`BEFORE UPDATE` / `BEFORE DELETE`) are active and verified. |
| **Medium** | **3** | **M-1:** Standalone `tsc --noEmit` CLI binary pending `npm install` (`node_modules` not installed).<br>**M-2:** Local SQLite single-writer lock & persistent volume requirement.<br>**M-3:** In-database SHA-256 hash chain is tamper-evident, not tamper-proof against a privileged OS root user who drops triggers and rewrites the file. | **Documented & Tracked** in `PROJECT_STATUS.md` and `PHASE1_SECURITY_AND_PERSISTENCE_REVIEW.md`. |
| **Low** | **2** | **L-1:** Node.js `v24.14.0` emits an `ExperimentalWarning` when importing `node:sqlite`.<br>**L-2:** Login endpoint (`/api/v1/auth/login`) does not yet have an IP-based rate limiter for public internet deployment. | **Documented & Tracked** as non-blocking MVP limitations. |

---

## 3. Phase 2 — Complete Endpoint Inventory (10 API Groups, 26 Operations)

All endpoints are defined in [openapi.yaml](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/openapi.yaml) under base path `/api/v1`:

### Group 1: Authentication and Sessions (`Auth`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /auth/login` | `loginUser` | Public | `LoginRequest` (`email`, `password`; `additionalProperties: false`) | `200 AuthSessionResponse` | Rejects client-supplied `role` (`400 ROLE_SELECTION_FORBIDDEN`); async `scrypt` check (`401 INVALID_CREDENTIALS`). |
| `POST /auth/demo-switch` | `switchDemoPersona` | Public (Dev/Demo Only) | `DemoSwitchRequest` (`userId`; `additionalProperties: false`) | `200 AuthSessionResponse` | Disabled in prod (`403 DEMO_MODE_DISABLED`); requires `is_demo_account=1` (`404 DEMO_USER_NOT_FOUND`). |
| `GET /auth/me` | `getCurrentSession` | Bearer (`ALL`) | None | `200 CurrentSessionResponse` | Verifies HMAC-SHA256 sig, `iss`, `aud`, `exp`, and `revoked_at IS NULL` (`401`). |
| `POST /auth/logout` | `logoutSession` | Bearer (`ALL`) | None | `200 LogoutResponse` | Revokes active `jti` in `auth_sessions` and logs `AUTH_LOGOUT` in same SQLite transaction. |

### Group 2: Users and Role Permissions (`Users`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /users` | `listUsers` | Bearer (`ALL`) | None | `200 UserListResponse` | Excludes `password_hash`; returns `id`, `name`, `email`, `role`, `isActive`, `isDemoAccount`. |

### Group 3: Contracts and Milestones (`Contracts`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /contracts` | `listContracts` | Bearer (`ALL`) | None | `200 ContractListResponse` | Returns contracts ordered by `createdAt DESC` with embedded `milestones[]`. |
| `POST /contracts` | `createContract` | Bearer (`CLIENT`) | `CreateContractRequest` | `201 ContractResponse` | Optional `Idempotency-Key`. Validates integer cents, `sum(agreedAmountCents) == totalBudgetCents` (`400 BUDGET_MISMATCH`), `developerId != reviewerId` (`400 SEPARATION_OF_DUTIES_VIOLATION`), and role (`403 FORBIDDEN_ROLE`). |
| `GET /contracts/{id}` | `getContractById` | Bearer (`ALL`) | Path `id` | `200 ContractResponse` | `404 CONTRACT_NOT_FOUND` if missing. |
| `POST /contracts/{id}/activate` | `activateContract` | Bearer (`CLIENT` owner) | Path `id` | `200 ContractResponse` | Transitions `DRAFT -> ACTIVE`, increments `version`. Rejects re-activation (`409 CONTRACT_ALREADY_ACTIVE`). |
| `GET /contracts/{id}/schedule` | `getContractSchedule` | Bearer (`ALL`) | Path `id` | `200 ContractScheduleResponse` | Formats milestones into Bryntum Gantt `tasks`, `dependencies`, `baselineEndDate`, and `lateDays`. |

### Group 4: Evidence Submission and Retrieval (`Evidence`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /milestones/{id}/evidence` | `submitMilestoneEvidence` | Bearer (`DEVELOPER`) | `SubmitEvidenceRequest` | `201 EvidenceSubmissionResponse` | Optional `Idempotency-Key`. Validates GitHub HTTPS URL regex, 7–40 hex `commitSha`, `ciReport`, and `securityScan`. Wraps untrusted text in `<untrusted_evidence>`. |
| `GET /milestones/{id}/evidence` | `listMilestoneEvidence` | Bearer (`ALL`) | Path `id` | `200 EvidenceSubmissionListResponse` | Returns immutable historical submission attempts (`attemptNumber = 1..N`). |

### Group 5: AI Evaluation Results (`Evaluations`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /milestones/{id}/evaluate` | `evaluateMilestoneEvidence` | Bearer (`ALL`) | Path `id` | `200 EvaluationResultResponse` | Optional `Idempotency-Key`. Runs `EvidenceAgent`, `RiskAgent`, `ArbitratorAgent` (advisory only) + `SettlementPolicyEngine`. Blocks concurrent runs (`409 EVALUATION_ALREADY_RUNNING`). |
| `GET /milestones/{id}/evaluations` | `listMilestoneEvaluations` | Bearer (`ALL`) | Path `id` | `200 EvaluationListResponse` | Returns historical and latest AI evaluations + policy calculations. |

### Group 6: Deterministic Settlement Policy & Ledger (`SettlementPolicy`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /milestones/{id}/policy-preview` | `previewSettlementPolicy` | Bearer (`ALL`) | `PolicyPreviewRequest` | `200 PolicyCalculationResponse` | Pure deterministic integer-cent calculation (`SettlementPolicyEngine`) with zero AI or payment side effects. |
| `GET /ledger` | `getFinancialDecisionLedger` | Bearer (`ALL`) | None | `200 FinancialLedgerResponse` | Returns flattened AG Grid Community rows (`agreedAmountCents`, `permittedAmountCents`, `approvedAmountCents`, `riskSeverity`, `aiRecommendation`, `paymentStatus`). |

### Group 7: Human Approval and Rejection (`Approvals`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /milestones/{id}/review` | `submitHumanReview` | Bearer (`REVIEWER`, `CLIENT`) | `SubmitReviewRequest` | `200 HumanApprovalResponse` | Optional `Idempotency-Key`. Enforces `actor.id != contract.developerId` (`403`) and `approvedAmountCents <= permittedAmountCents` (`400 POLICY_CAP_EXCEEDED`). |

### Group 8: PayPal Authorization and Capture (`Payments`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST /milestones/{id}/paypal/order` | `createPayPalOrder` | Bearer (`CLIENT`) | Path `id` | `201 PayPalTransactionResponse` | **Mandatory `PayPal-Request-Id` header.** Creates PayPal Orders API v2 order (`intent: "AUTHORIZE"` — non-escrow delayed capture). |
| `POST /milestones/{id}/paypal/authorize` | `authorizePayPalOrder` | Bearer (`CLIENT`) | `AuthorizePayPalOrderRequest` | `200 PayPalTransactionResponse` | **Mandatory `PayPal-Request-Id` header.** Stores `paypalAuthorizationId` and 29-day `authExpiresAt`. |
| `POST /milestones/{id}/paypal/capture` | `capturePayPalAuthorization` | Bearer (`REVIEWER`, `CLIENT`) | Path `id` | `200 PayPalTransactionResponse` | **Mandatory `PayPal-Request-Id` header.** Requires persisted `HUMAN_APPROVAL` (`decision=APPROVE`) and `approvedAmountCents <= permittedAmountCents <= authorizedAmountCents`. |
| `POST /webhooks/paypal` | `handlePayPalWebhook` | PayPal Signature Headers | `PayPalWebhookEvent` | `200 WebhookAckResponse` | Verifies `PAYPAL-TRANSMISSION-SIG` before updating transaction status. |

### Group 9: Audit Logs (`Audit`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /audit` | `listAuditLogs` | Bearer (`ALL`) | Query `contractId`, `milestoneId`, `entityId` | `200 AuditLogListResponse` | Lists append-only SHA-256 hash-chained records ordered by `seq ASC`. |
| `GET /audit/verify` | `verifyAuditHashChain` | Bearer (`ALL`) | None | `200 AuditChainVerificationResponse` | Verifies `AUDIT_GENESIS_HASH`, contiguous `seq`, `previousHash` links, and canonical JSON SHA-256 digests. |

### Group 10: Health, OpenAPI Spec & System Status (`System`)
| Method & Path | `operationId` | Auth / RBAC | Request Schema | Response Schema | Idempotency / Validation & Errors |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /health` | `getSystemHealth` | Public | None | `200 HealthResponse` | Reports runtime version and capability flags. |
| `GET /openapi.yaml` | `getOpenApiYaml` | Public | None | `200 text/yaml` | Serves the normative `openapi.yaml` contract specification. |
| `GET /openapi.json` | `getOpenApiJson` | Public | None | `200 application/json` | Serves the JSON OpenAPI discovery metadata and registered request schema names. |

---

## 4. APIMatic Validation Status & Governance Rules

- **External `apimatic` CLI Status:** Checked via command execution (`apimatic --version` -> `APIMATIC_CLI_NOT_FOUND`). Because the external `apimatic` CLI binary and cloud API key are not installed in this offline workspace, cloud APIMatic CLI validation is marked **NOT EXECUTED (External CLI Not Installed)** in accordance with `AGENTS.md` Section 6 (*"Do not claim an APIMatic feature is integrated unless it has been tested"*).
- **Local Programmatic OpenAPI 3.0.3 & APIMatic Governance Validation (Executed):**
  We authored [APIMATIC-META.json](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/APIMATIC-META.json), [src/server/middleware/validateRequest.ts](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/middleware/validateRequest.ts), and [src/server/__tests__/phase2.test.ts](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/server/__tests__/phase2.test.ts) to programmatically verify:
  1. All 10 required API groups (`System`, `Auth`, `Users`, `Contracts`, `Evidence`, `Evaluations`, `SettlementPolicy`, `Approvals`, `Payments`, `Audit`) and 26 operations exist in `openapi.yaml`.
  2. Every operation has a globally unique `operationId` (required by APIMatic SDK generators).
  3. Every `$ref` pointer (`#/components/schemas/...`, `#/components/parameters/...`, `#/components/responses/...`) resolves to an existing component definition in `openapi.yaml` with **zero broken references**.
  4. All monetary properties (`totalBudgetCents`, `agreedAmountCents`, `permittedAmountCents`, `approvedAmountCents`, `authorizedAmountCents`, `capturedAmountCents`, `latePenaltyCents`) use `type: integer` (cents) rather than floating-point numbers.
  5. PayPal mutation endpoints (`createPayPalOrder`, `authorizePayPalOrder`, `capturePayPalAuthorization`) require the `PayPal-Request-Id` idempotency header parameter.
  6. Runtime validation middleware (`validateRequestSchema`) accurately rejects unknown extra properties (`additionalProperties: false`), invalid types, regex mismatches, and out-of-range integers with RFC 7807 `400 SCHEMA_VALIDATION_ERROR`.

---

## 5. UI/UX Quality Direction ("Forensic Institutional Ledger")

Consistent with `OPEN_SOURCE_RESEARCH.md` and `AGENTS.md`:
- **Aesthetic:** High-contrast institutional financial governance dashboard (`bg-slate-950`, `bg-slate-900`, `border-slate-800` hairlines, `tabular-nums` for cent-exact currency columns, `font-mono` badges for 40-char commit SHAs, `jti`, and `entryHash`).
- **Component Discipline:** Selective `shadcn/ui` primitives (`Card`, `Badge`, `Dialog`, `Tabs`, `Alert`) paired with **AG Grid Community** for the Financial Decision Intelligence Ledger and **Bryntum Gantt** for Milestone Scheduling. Zero competing table/chart libraries or decorative 3D/gradient bloat.
