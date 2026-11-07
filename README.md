# MilestoneProof AI — Multi-Agent Evidence-to-Settlement Orchestrator

MilestoneProof AI is an evidence-to-settlement orchestration platform for milestone-governed software development contracts. It verifies software delivery artifacts (GitHub commits, pull requests, CI/CD test telemetry, and dependency security scans), runs a 3-stage advisory AI evaluation pipeline (`EvidenceAnalyst`, `RiskAnalyst`, `ReviewSynthesizer`), enforces deterministic integer-cent settlement policies, requires human reviewer sign-off, and records every state transition in a tamper-evident SHA-256 hash-chained SQLite audit trail.

**Repository:** [https://github.com/Mohamed-529/TrustChain](https://github.com/Mohamed-529/TrustChain)

---

## Core Architecture & Features

- **Phase 1 — Backend Foundation, Auth/RBAC & Hash-Chained Audit Trail:**
  - Native Node.js HTTP server (`node:http`) + Vite SPA middleware integration.
  - Non-blocking asynchronous `crypto.scrypt()` authentication, server-side role resolution (`CLIENT`, `DEVELOPER`, `REVIEWER`), and HMAC-SHA256 signed Bearer sessions backed by SQLite revocation (`auth_sessions`).
  - Native `node:sqlite` (`WAL` mode + `PRAGMA synchronous = FULL`) ACID transactions with `BEFORE UPDATE` and `BEFORE DELETE` immutability triggers on `audit_logs`.
- **Phase 2 — OpenAPI 3.0.3 Contract & APIMatic Governance:**
  - Complete OpenAPI 3.0.3 specification (`openapi.yaml`) across 10 API groups and 26 operations, paired with `APIMATIC-META.json` and runtime request schema validation (`src/server/middleware/validateRequest.ts`).
  - Live specification discovery endpoints at `GET /api/v1/openapi.yaml` and `GET /api/v1/openapi.json`.
- **Phase 3 — Evidence Intelligence Engine & Financial Safety Boundary:**
  - Validates GitHub HTTPS repository URLs, 7–40 hex commit SHAs, PR URLs/statuses, changed-file summaries, CI reports, and vulnerability scans.
  - Isolates untrusted repository text inside `<untrusted_evidence>` delimiters and detects adversarial prompt-injection attempts.
  - Advisory-only multi-agent evaluation (`PASS`, `NEEDS_HUMAN_REVIEW`, `FAIL`) paired with the deterministic `SettlementPolicyEngine` (`permittedAmountCents`). AI can never approve milestones, set final payable amounts, or trigger payments.

---

## Prerequisites & Local Setup

- **Runtime:** Node.js `v22.5.0+` or `v24.x` (`v24.14.0` recommended for native `node:sqlite` and TypeScript execution).

1. **Configure Environment Variables (Optional for Local Demo):**
   Copy `.env.example` to `.env` if you want to configure a live `GEMINI_API_KEY` or custom `AUTH_TOKEN_SECRET`. When `GEMINI_API_KEY` is omitted, the server automatically runs the labeled `DeterministicMockEvaluator` (`mock-deterministic-v1`).

2. **Install Frontend Dependencies (Optional for Backend/API Tests):**
   ```bash
   npm install
   ```

3. **Run the Server:**
   ```bash
   npm run dev
   ```
   - API Health Check: `http://localhost:3000/api/v1/health`
   - OpenAPI 3.0.3 YAML Spec: `http://localhost:3000/api/v1/openapi.yaml`
   - OpenAPI 3.0.3 JSON Discovery: `http://localhost:3000/api/v1/openapi.json`

4. **Run the Automated Test Suites (Phase 1, Phase 2 & Phase 3):**
   ```bash
   npm test
   ```

---

## Architecture & Design Documentation

- [AGENTS.md](./AGENTS.md) — Engineering, Security & Financial Safety Rules
- [HLD.md](./HLD.md) — High-Level System Design
- [LLD.md](./LLD.md) — Low-Level Component & Schema Design
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) — System Architecture & Sponsor Integrations
- [openapi.yaml](./openapi.yaml) — Normative OpenAPI 3.0.3 Specification
- [PHASE1_SECURITY_AND_PERSISTENCE_REVIEW.md](./PHASE1_SECURITY_AND_PERSISTENCE_REVIEW.md) — Auth, RBAC, SQLite Durability & Hash-Chain Specification
- [PHASE2_DESIGN.md](./PHASE2_DESIGN.md) — OpenAPI 3.0.3 & APIMatic Governance Design
- [PHASE3_DESIGN.md](./PHASE3_DESIGN.md) — Evidence Intelligence Engine & Multi-Agent Evaluation Design
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) — Current Implementation & Verification Status
