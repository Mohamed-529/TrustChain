# Phase 2 Implementation Plan — OpenAPI 3.0.3 Contract, APIMatic Metadata & Runtime Schema Validation

## 1. Objective

Establish the complete, APIMatic-ready OpenAPI 3.0.3 API contract (`openapi.yaml`), APIMatic code-generation/validation configuration (`APIMATIC-META.json`), runtime request schema validation middleware (`src/server/middleware/validateRequest.ts`), live specification discovery endpoints (`GET /api/v1/openapi.yaml` and `GET /api/v1/openapi.json`), and the automated Phase 2 contract verification test suite (`src/server/__tests__/phase2.test.ts`).

---

## 2. Files Created & Modified in Phase 2

### New Files Created (6 Files):
1. `openapi.yaml` — Normative OpenAPI 3.0.3 specification covering all 10 API groups and 26 operations, reusable component schemas, security schemes (`bearerAuth`), idempotency headers (`Idempotency-Key`, `PayPal-Request-Id`), and RFC 7807 `ErrorResponse` definitions.
2. `APIMATIC-META.json` — APIMatic validation and SDK generation metadata configuration.
3. `src/server/middleware/validateRequest.ts` — Zero-dependency runtime request schema validator enforcing `openapi.yaml` request schemas (`LoginRequest`, `DemoSwitchRequest`, `CreateContractRequest`, `SubmitEvidenceRequest`, `SubmitReviewRequest`).
4. `PHASE2_DESIGN.md` — Independent Phase 1 quality review, trusted reference mapping, 10-group endpoint inventory, and APIMatic validation architecture.
5. `PHASE2_IMPLEMENTATION_PLAN.md` — Ordered Phase 2 implementation and verification plan.
6. `src/server/__tests__/phase2.test.ts` — Automated Phase 2 OpenAPI 3.0.3 structural linter (`operationId` uniqueness, `$ref` resolution, integer-cent monetary field check, idempotency header check), live `/api/v1/openapi.yaml` & `/api/v1/openapi.json` endpoint tests, and runtime schema validation tests.

### Existing Files Modified (4 Files):
1. `src/server/middleware/errorHandler.ts` — Added optional `sendText(body, contentType)` method to `ApiResponse` for serving `text/yaml`.
2. `src/server/index.ts` — Implemented `sendText` on `apiRes` to serve `openapi.yaml` with `content-type: text/yaml; charset=utf-8`.
3. `src/server/routes/apiRoutes.ts` — Mounted `GET /api/v1/openapi.yaml` and `GET /api/v1/openapi.json`.
4. `package.json` & `PROJECT_STATUS.md` — Updated `"test"` script to run both `phase1.test.ts` and `phase2.test.ts`, and updated project status.

---

## 3. Ordered Verification Steps

1. **Verify `openapi.yaml` Structural & Reference Integrity:**
   - Parse `openapi.yaml` and verify all 10 required tags and 26 operations exist.
   - Verify every `operationId` is globally unique.
   - Verify every `$ref` (`#/components/schemas/...`, `#/components/parameters/...`, `#/components/responses/...`) resolves to a defined component in `openapi.yaml`.
   - Verify all monetary fields end in `Cents` and declare `type: integer`.
   - Verify PayPal order/authorize/capture endpoints include `$ref: '#/components/parameters/PayPalRequestIdHeader'`.
2. **Verify Runtime Schema Validation (`validateRequest.ts`):**
   - Test valid payloads pass cleanly.
   - Test payloads with unexpected extra properties (`additionalProperties: false`), invalid GitHub URLs, non-hex commit SHAs, floating-point cent amounts, or missing required fields are rejected with `400 SCHEMA_VALIDATION_ERROR`.
3. **Verify Live API Contract Discovery Endpoints:**
   - Probe `GET /api/v1/openapi.yaml` (`200 OK`, `text/yaml`) and `GET /api/v1/openapi.json` (`200 OK`, `application/json`).
4. **Run Full Phase 1 + Phase 2 Regression Test Suite:**
   - Execute `node --test src/server/__tests__/phase1.test.ts src/server/__tests__/phase2.test.ts` and confirm 100% pass rate with zero regressions.
