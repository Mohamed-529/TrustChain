# PHASE 7 — EVIDENCE PROVENANCE & INDEPENDENT GITHUB VERIFICATION REPORT

## 1. Executive Summary

Phase 7 transforms MilestoneProof AI's evidence verification from format-only input validation into **independently verifiable evidence provenance** backed by GitHub's official REST API (`https://api.github.com`), cryptographic SHA-256 payload tamper detection, and fail-closed GitHub webhook authenticity (`X-Hub-Signature-256`) + persistent delivery idempotency (`X-GitHub-Delivery`).

---

## 2. How the 10 Phase 7 Provenance Questions Are Answered

| # | Provenance Question | Implementation & Verification Mechanism |
|---|---|---|
| 1 | **Does the submitted GitHub repository actually exist?** | Calls `GET /repos/{owner}/{repo}` via `GitHubVerificationService`. Verifies HTTP `200`, canonical `full_name`, `id`, `visibility`, and `default_branch`. Returns `status: 'NOT_FOUND'` and `overallStatus: 'MISMATCH_DETECTED'` on HTTP `404`. |
| 2 | **Does the submitted commit SHA belong to that repository?** | Calls `GET /repos/{owner}/{repo}/commits/{ref}`. Verifies the commit exists in the target repository, matches the submitted SHA prefix, and compares the actual modified file list (`files[].filename`) against `ciReport.changedFiles`. |
| 3 | **Does the submitted pull request exist and belong to that repository?** | Parses the PR URL (`https://github.com/{owner}/{repo}/pull/{number}`), verifies repository coordinates match `repoUrl`, and calls `GET /repos/{owner}/{repo}/pulls/{pull_number}`. |
| 4 | **Does the PR reference the expected commit and match claimed PR state?** | Inspects `head.sha` and `merge_commit_sha` from GitHub's PR response to confirm the PR references `submission.commitSha`, and compares GitHub's `merged`/`state` against `submission.prStatus` (`MERGED`/`OPEN`/`CLOSED`). |
| 5 | **Did the claimed GitHub Actions workflow actually run?** | Parses the workflow run ID from `ciReport.runUrl` (`https://github.com/{owner}/{repo}/actions/runs/{run_id}`) and calls `GET /repos/{owner}/{repo}/actions/runs/{run_id}`. |
| 6 | **Does the workflow run correspond to the submitted commit?** | Compares `workflow_run.head_sha` returned by GitHub Actions against `submission.commitSha` (`matchesSubmittedCommit`). |
| 7 | **Did the workflow complete successfully?** | Verifies `workflow_run.status === 'completed'` and compares `workflow_run.conclusion` (`success` vs `failure`/`cancelled`) against `submission.ciReport.status` (`statusMatchesSubmittedCi`). |
| 8 | **Has the evidence payload changed since it was submitted?** | At submission time, `computeEvidencePayloadSha256()` computes a canonical SHA-256 digest over all submission fields and stores `payload_sha256` in `evidence_submissions`. On read, evaluation, and review, the hash is recomputed; any discrepancy immediately flags `TAMPERED_PAYLOAD`. |
| 9 | **Is the GitHub webhook authentic?** | `POST /api/v1/webhooks/github` verifies `X-Hub-Signature-256` (`sha256=<hex>`) against the raw request body using `GITHUB_WEBHOOK_SECRET` and `crypto.timingSafeEqual`. Fails closed (`503 GITHUB_WEBHOOK_VERIFICATION_UNAVAILABLE`) when secret is unconfigured and rejects invalid signatures (`401 INVALID_GITHUB_WEBHOOK_SIGNATURE`). |
| 10 | **Has the same GitHub webhook event already been processed?** | Persists `X-GitHub-Delivery` as primary key in `github_webhook_events` (`PROCESSING`, `PROCESSED`, `FAILED`, `REJECTED`) with an in-memory lock (`activeWebhookLocks`). Duplicate or concurrent duplicate deliveries return `status: 'DUPLICATE_IGNORED'`, while `FAILED` deliveries can be safely retried. |

---

## 3. Critical Financial & Architectural Boundaries Enforced

1. **GitHub Verification Never Approves Milestones or Releases Payment:**
   - `GitHubVerificationService.verifyMilestoneEvidenceProvenance()` and `handleGitHubWebhook()` **never** transition a milestone to `APPROVED` or `SETTLED`, **never** create a `HumanApprovalRecord`, and **never** invoke `PayPalService`.
   - Permitted workflow:
     `GitHub Evidence Submission → Independent GitHub Provenance Verification → Multi-Agent AI Evaluation → Deterministic Settlement Policy Engine → Authorized Human Review (CLIENT/REVIEWER) → PayPal Sandbox Authorization/Capture`.
2. **Explicit Separation Between Genuine Verification and Unavailable Verification:**
   - When `GITHUB_TOKEN` is unconfigured and no test `fetchImpl` is injected, `verificationMode` is `'UNCONFIGURED_UNAVAILABLE'` and `overallStatus` is `'UNVERIFIED_UNAVAILABLE'` (never falsely reported as `'VERIFIED'`).
   - When `overallStatus` is `'MISMATCH_DETECTED'` or `'TAMPERED_PAYLOAD'`:
     - `EvaluationService.evaluateMilestone()` forces `verifiedCount = 0`, `overallRiskSeverity = 'CRITICAL'`, `recommendedOutcome = 'FAIL'`, `policyCalculation.gateBlocked = true`, and `policyCalculation.permittedAmountCents = 0`.
     - `HumanReviewService.getMilestoneReviewDetails()` sets `canApprove = false` and `maxPermittedAmountCents = 0`.
     - `HumanReviewService.submitReview()` blocks any `APPROVE` decision with `409 EVIDENCE_PROVENANCE_MISMATCH_BLOCKS_APPROVAL`.
3. **Zero Credential Exposure:**
   - `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` remain strictly server-side and are never returned in API responses or written to audit logs.

---

## 4. Database Schema Additions (Migration `004`)

- `evidence_submissions`:
  - `payload_sha256 TEXT NOT NULL DEFAULT ''`
  - `provenance_status TEXT NOT NULL DEFAULT 'UNVERIFIED_UNAVAILABLE'`
- `evidence_provenance_verifications`:
  - Stores structured `repository_json`, `commit_json`, `pull_request_json`, `workflow_run_json`, `integrity_json`, `blocking_reasons_json`, `discrepancies_json`, `verification_mode`, `overall_status`, and `eligible_for_boundary_review`.
- `github_webhook_events`:
  - Stores `delivery_id TEXT PRIMARY KEY`, `event_type`, `action`, `repository_full_name`, `commit_sha`, `signature_status`, `processing_status`, `processing_result`, `matched_submission_id`, `payload_sha256`, and `error_message`.

---

## 5. Automated Test Verification (`30/30` Passing)

Executed via `npm test`:
- **Phase 1 Suite:** `7 / 7` passed
- **Phase 2 Suite:** `3 / 3` passed
- **Phase 3 Suite:** `4 / 4` passed
- **Phase 4 Suite:** `4 / 4` passed
- **Phase 5 Suite:** `4 / 4` passed
- **Phase 6 Suite:** `4 / 4` passed
- **Phase 7 Suite (`src/server/__tests__/phase7.test.ts`):** `4 / 4` passed
  1. `Independent GitHub REST API Provenance Verification & Financial Boundary` — **PASSED**
  2. `Provenance Mismatch Detection (fake repo 404, fake commit 404, unmerged/mismatched PR, failed workflow run)` — **PASSED**
  3. `Unavailable Verification vs. Genuine Verification & Post-Submission Payload Tamper Detection` — **PASSED**
  4. `GitHub Webhook Authenticity (X-Hub-Signature-256), Idempotency (X-GitHub-Delivery), Concurrency & Retry Recovery` — **PASSED**

> **Note on Mocked vs. Live GitHub Testing:** Automated tests in `phase7.test.ts` use dependency-injected `fetchImpl` mocks simulating GitHub REST API v3 responses (`200`, `404`, `503`) and real `crypto.createHmac('sha256', secret)` webhook signatures. Live calls against `https://api.github.com` are supported automatically whenever `GITHUB_TOKEN` is configured in `.env`.
