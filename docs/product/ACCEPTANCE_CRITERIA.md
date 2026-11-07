# ACCEPTANCE CRITERIA — MilestoneProof AI

## 1. Purpose

This document defines measurable conditions for accepting each MVP feature.

A feature must not be marked complete merely because code has been generated.

The implementation must satisfy the relevant criteria and pass its tests.

## 2. Contract Management

- An authorized client can create a contract.
- Contract title, description, currency and total amount are validated.
- A contract can contain multiple milestones.
- Each milestone contains deliverables and acceptance criteria.
- Milestone payment allocations are validated against the contract total.
- Invalid dates and invalid amounts are rejected.
- Contract changes are versioned and auditable.

## 3. Milestone Scheduling — Bryntum

- Contract milestones appear in the Gantt timeline.
- Start dates and deadlines are displayed correctly.
- Dependencies between milestones are represented.
- Planned and actual progress can be distinguished.
- Delayed and blocked milestones are identifiable.
- Timeline edits follow authorized business rules.
- Signed contractual terms cannot be silently modified.
- Timeline data is loaded from the backend, not permanently hardcoded.

## 4. Evidence Submission

- Developer can submit evidence for an assigned milestone.
- Repository and commit references are validated.
- Commit SHA is preserved.
- Submission timestamp is recorded.
- Evidence is linked to the correct contract and milestone.
- Duplicate submissions are handled safely.
- Untrusted external content is not treated as executable instructions.

## 5. Evidence Agent

- Evidence Agent receives validated structured input.
- It identifies evidence supporting each acceptance criterion.
- It identifies unsupported requirements.
- It references the actual evidence used.
- It distinguishes verified evidence from unverified claims.
- It never invents commits, tests or CI results.
- Invalid agent output is rejected or marked failed.

## 6. Risk Agent

- Risk Agent accepts actual scanner outputs.
- Finding IDs and scanner references are preserved.
- Severity and source are recorded.
- Missing scanner results are marked unavailable.
- It never invents vulnerabilities.
- Its output follows a validated structured schema.

## 7. Arbitrator Agent

- It receives validated Evidence and Risk outputs.
- It evaluates requirements against the contract.
- It explains satisfied requirements.
- It explains failed or unsupported requirements.
- It references supporting evidence.
- It provides a structured recommendation.
- It cannot directly authorize payments.
- It cannot independently change contract payment terms.

## 8. Settlement Policy Engine

- The engine uses the contract's agreed payment formula.
- Monetary calculations use decimal-safe arithmetic.
- Negative amounts are rejected.
- Amounts above the permitted authorization are rejected.
- Risk and acceptance gates are applied deterministically.
- The calculation result includes an explanation.
- The same input and policy version produce the same result.
- AI-generated amounts are never accepted without policy validation.

## 9. Human Approval

- Authorized reviewers can inspect pending recommendations.
- Unauthorized users cannot approve.
- Reviewer identity is obtained from authenticated backend context.
- Approve, Reject and Request Evidence actions are supported.
- Overrides require an explanation.
- Approved amounts are validated server-side.
- Every decision is recorded with reviewer and timestamp.

## 10. Financial Decision Ledger — AG Grid

- Contract and milestone records are displayed.
- Evidence completion is visible.
- Risk severity is visible.
- AI recommendation is visible.
- Policy-calculated amount is visible.
- Human-approved amount is visible.
- PayPal transaction status is visible.
- Sorting and filtering work correctly.
- Opening a record displays its supporting details.
- Data comes from actual backend APIs.
- No fabricated payment status is displayed as real.

## 11. APIMatic Integration

- OpenAPI specifications describe the implemented APIs.
- API definitions pass the configured APIMatic validation workflow.
- API documentation is available.
- Request and response structures are consistent with backend models.
- Validation errors are resolved or explicitly documented.
- SDK generation or Context Plugin usage is only claimed when actually completed and verified.

## 12. PayPal Sandbox

- Credentials are stored securely.
- Backend handles PayPal authentication.
- Buyer approval flow works where required.
- Authorization and capture follow the supported PayPal API workflow.
- Capture amount is validated against available authorization.
- Human approval is mandatory before capture.
- Duplicate payment requests are protected by idempotency.
- PayPal errors are handled correctly.
- Transaction references and final statuses are stored.
- No fake successful payment response is presented as a real transaction.

## 13. Audit History

- Contract creation is recorded.
- Evidence submissions are recorded.
- Agent evaluation events are recorded.
- Policy calculations are recorded.
- Human decisions are recorded.
- Payment operations are recorded.
- Previous evaluation history is retained.
- Audit records are accessible to authorized users.

## 14. Integration and End-to-End Testing

- Client can create a complete contract.
- Developer can submit evidence.
- Agents can evaluate the evidence.
- Policy engine calculates a permitted amount.
- Reviewer can approve the recommendation.
- PayPal Sandbox executes the permitted payment operation.
- Audit history records the complete workflow.
- A failed or incomplete milestone can be held without an unauthorized payment.
- The complete demonstration can be repeated reliably.

## 15. Definition of Done

A feature can be marked COMPLETE only when:

1. Implementation exists.
2. Relevant acceptance criteria pass.
3. Relevant automated tests pass.
4. Failure cases have been considered.
5. No critical security or financial safety violation exists.
6. Documentation is updated.
7. Known limitations are disclosed.

If some criteria cannot be verified, mark the feature PARTIALLY COMPLETE or BLOCKED.

Never mark a feature complete based only on successful code generation.
