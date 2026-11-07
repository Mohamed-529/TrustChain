# USER FLOWS — MilestoneProof AI

## 1. Purpose

This document defines the end-to-end interactions between the Client, Developer and Reviewer.

Every frontend screen and backend API should support one or more of these user journeys.

## 2. User Roles

### Client

Creates contracts, defines milestones and payment conditions, and reviews delivery progress.

### Developer

Receives milestones and submits delivery evidence.

### Reviewer

Reviews evidence, AI recommendations and settlement calculations, then makes the final approval decision.

## 3. Flow A — Client Creates a Contract

1. Client logs into the application.
2. Client opens the contract dashboard.
3. Client selects Create Contract.
4. Client enters:
   - Contract title.
   - Project description.
   - Developer information.
   - Total contract value.
   - Currency.
   - Contract start and end dates.
5. Client creates milestones.
6. For each milestone, client specifies:
   - Milestone name.
   - Description.
   - Deliverables.
   - Acceptance criteria.
   - Deadline.
   - Agreed payment amount or percentage.
   - Dependencies, if applicable.
7. Client reviews the contract.
8. Client confirms the contract terms.
9. System stores the contract and its version.

Expected result:
A contract with clearly defined milestones, acceptance criteria and payment conditions.

Business rules:

- Milestone payment allocations must follow the agreed contract total.
- Contract changes must be versioned.
- Signed contractual conditions must not be silently modified.

## 4. Flow B — Developer Submits Evidence

1. Developer logs in.
2. Developer views assigned contracts.
3. Developer opens a milestone.
4. Developer submits:
   - GitHub repository reference.
   - Commit SHA.
   - Pull request reference.
   - CI/CD report reference.
   - Additional supporting evidence.
5. Backend validates submitted references.
6. System stores the evidence submission.
7. Milestone status changes to Evidence Submitted.

Expected result:
A traceable evidence submission linked to a specific contract and milestone.

Business rules:

- Preserve immutable commit SHAs.
- Record submission timestamps.
- Treat external evidence as untrusted.
- Do not accept unsupported evidence as verified evidence.

## 5. Flow C — AI Evidence Evaluation

1. Workflow Orchestrator receives a valid evidence submission.
2. Evidence Agent inspects available delivery evidence.
3. Evidence Agent maps evidence to contractual acceptance criteria.
4. Risk Agent inspects available scanner findings and risk evidence.
5. Both agents return structured outputs.
6. Workflow Orchestrator validates their outputs.
7. Arbitrator Agent interprets the evidence and risk results.
8. Arbitrator generates a structured recommendation.
9. Settlement Policy Engine calculates the permitted amount.
10. System stores the complete evaluation.

Expected result:
An explainable evaluation linked to actual evidence.

Possible outcomes:

- Requirements satisfied.
- Partially satisfied.
- Insufficient evidence.
- Failed requirements.
- High-risk findings.
- Evaluation failed and requires retry.

## 6. Flow D — Human Review

1. Reviewer logs in.
2. Reviewer opens the review dashboard.
3. Reviewer views pending milestone evaluations.
4. Reviewer opens the financial decision ledger.
5. Reviewer inspects:
   - Contract requirements.
   - Submitted evidence.
   - AI recommendation.
   - Risk findings.
   - Policy calculation.
   - Proposed settlement amount.
6. Reviewer selects:
   - Approve.
   - Reject.
   - Request additional evidence.
7. Backend validates reviewer authorization.
8. System records reviewer identity, timestamp and decision.
9. If approved, the settlement becomes eligible for payment processing.

Expected result:
A traceable human decision.

Business rules:

- Unauthorized reviewers cannot approve.
- AI recommendations are not approvals.
- Reviewer overrides require a reason.
- Approved amounts must satisfy the deterministic financial policy and authorization limits.

## 7. Flow E — PayPal Settlement

1. System checks the approval record.
2. System validates the payment authorization state.
3. System validates currency and amount.
4. System checks idempotency.
5. PayPal adapter executes the permitted operation.
6. System retrieves or verifies the transaction result.
7. Audit service records the payment event.
8. Financial ledger displays the settlement status.

Possible states:

- Awaiting buyer approval.
- Created.
- Authorized.
- Capture pending.
- Captured.
- Voided.
- Failed.

Expected result:
A verifiable PayPal Sandbox settlement linked to the contract and approved milestone.

Important:
The exact PayPal operation must follow the supported API flow and account eligibility. Do not treat a capture as an automatic payout to an unrelated developer.

## 8. Flow F — Request Additional Evidence

1. Reviewer identifies missing or unclear evidence.
2. Reviewer requests additional evidence.
3. System records the request and reason.
4. Developer receives the request.
5. Developer submits additional evidence.
6. System starts a new evaluation.
7. Previous evaluation remains available in the audit history.

Expected result:
An auditable re-evaluation without deleting the previous decision history.

## 9. Flow G — Failure Handling

### Evidence retrieval failure

- Mark evidence retrieval as failed or incomplete.
- Preserve the failure reason.
- Allow a controlled retry.

### Risk scanner unavailable

- Mark risk evaluation as unavailable.
- Do not invent a clean security result.
- Apply the contract's configured policy for unavailable checks.

### AI agent failure

- Record the failed execution.
- Retry only where safe.
- Do not proceed with an invalid or missing recommendation.

### Payment failure

- Preserve the failed payment attempt.
- Retrieve the actual PayPal status before retrying.
- Use idempotency protection.
- Do not assume a failed response means the payment was not processed.

## 10. Main Workflow States

Contract:

- Draft
- Active
- Completed
- Cancelled

Milestone:

- Not Started
- In Progress
- Evidence Submitted
- Under Evaluation
- Needs More Evidence
- Approved
- Rejected
- Settled

Evaluation:

- Pending
- Running
- Completed
- Failed

Approval:

- Pending
- Approved
- Rejected
- Revision Requested

Settlement:

- Not Ready
- Awaiting Buyer Approval
- Authorized
- Capture Pending
- Captured
- Voided
- Failed

All state transitions must be validated by backend business logic.

## 11. Audit Requirements

Record:

- Actor.
- Action.
- Contract ID.
- Milestone ID.
- Related evidence ID.
- Previous state.
- New state.
- Timestamp.
- Relevant reason or reference.
- Payment transaction reference where applicable.

Audit records must not be silently overwritten when a new evaluation occurs.
