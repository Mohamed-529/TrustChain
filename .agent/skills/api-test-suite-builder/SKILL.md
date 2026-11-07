---
name: api-test-suite-builder
description: >-
  Comprehensive API test matrix generation and validation workflow for REST endpoints,
  webhooks, and financial interfaces. Use when designing, reviewing, or expanding integration
  and unit tests for OpenAPI endpoints, idempotency headers, RBAC gates, and error contracts.
---

# API Test Suite Builder

Adapted from `wshobson/agents` (MIT License) for MilestoneProof AI.

This skill provides a systematic test engineering checklist and matrix generator for API endpoints, webhook handlers, and financial settlement workflows.

---

## 6-Dimension API Test Matrix

For any API endpoint or webhook handler, ensure test coverage across all 6 dimensions:

```
┌─────────────────────────────────────────────────────────────────┐
│                    API TEST COVERAGE MATRIX                     │
├───────────────────┬─────────────────────────────────────────────┤
│ 1. Happy Path     │ Valid inputs, nominal flow, 200/201/204     │
│ 2. Schema Negatives│ Missing fields, wrong types, unknown props │
│ 3. Boundaries     │ Min/max lengths, negative/overflow amounts   │
│ 4. Auth & RBAC    │ Missing token, expired, tampered, wrong role│
│ 5. Idempotency    │ Replay attack, concurrent duplicate requests│
│ 6. Failure Modes  │ DB rollback, upstream service down, timeout │
└───────────────────┴─────────────────────────────────────────────┘
```

---

## Dimension Breakdown & Assertions Checklist

### 1. Happy Path & Expected Invariants
- Provide valid payload matching OpenAPI schema.
- Assert expected HTTP status code (`200 OK`, `201 Created`).
- Assert response body structure and field values.
- Assert persisted database record matches input.
- Assert hash-chained audit trail logged the state transition.

### 2. Schema Validation & Negative Input Tests
- Test omitted required fields (`400 Bad Request` or `422 Unprocessable Entity`).
- Test invalid data types (e.g., string instead of integer cents).
- Test unexpected extra properties (strict rejection per OpenAPI specification).
- Test malformed UUIDs, non-hexadecimal commit SHAs, or malformed URLs.

### 3. Boundary Conditions & Numerical Safety
- Test zero monetary amounts (`agreedAmountCents = 0`).
- Test negative values (`agreedAmountCents < 0`).
- Test non-integer monetary values (fractions of a cent).
- Test extreme string lengths (overflow / DOS attempts).
- Test boundary dates (past deadlines, leap seconds, invalid ISO timestamps).

### 4. Authentication, Authorization & RBAC Gates
- Test request without `Authorization` header (`401 Unauthorized`).
- Test request with expired or invalidly signed JWT (`401 Unauthorized`).
- Test request with spoofed `X-Actor-Id` or role header (must be ignored or rejected).
- Test request from disallowed role (e.g., `DEVELOPER` attempting review approval -> `403 Forbidden`).
- Test separation of duties (developer cannot review own milestone).

### 5. Idempotency, Concurrency & Replay Protection
- Test initial request with idempotency key (`Idempotency-Key` or `PayPal-Request-Id`).
- Test exact retry of same request with same key (must return identical cached result without duplicate execution).
- Test conflicting request with same key but altered payload (`409 Conflict`).
- Test concurrent duplicate requests (mutex or database atomic lock must permit only one execution).

### 6. Failure Recovery & Upstream Resilience
- Test upstream dependency failure (e.g., PayPal API 500/timeout -> return `503 Service Unavailable` with fail-closed behavior).
- Test database transaction rollback upon mid-flow exception (no partial records left in database).
- Test webhook retry capability after initial transient failure.

---

## Output Standards

When authoring API test cases:
- Use standard Node.js test runner (`node:test` and `node:assert/strict`).
- Name test cases with clear numbered descriptions indicating the scenario and expected outcome.
- Never write tests that depend on execution order or shared mutable state across test cases.
- Always clean up temporary resources or use isolated in-memory/ephemeral databases per test.
