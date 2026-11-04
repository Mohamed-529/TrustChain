# MilestoneProof AI — MVP Scope & Feature Prioritization

This document details the prioritized product backlog, categorizing capabilities into P0 (Must Have), P1 (Important Improvements), P2 (Future Scope), alongside explicit exclusions and the Definition of Done (DoD).

---

## 1. Prioritization Framework

- **P0 (Must Have):** Core requirements essential for the end-to-end evidence-to-settlement demonstration. If any P0 feature is absent, the product cannot prove its primary value proposition.
- **P1 (Important Improvements):** Value-add enhancements that elevate user trust, speed up review, or enhance UX polish without blocking the core lifecycle.
- **P2 (Future Scope):** Enterprise or advanced capabilities intentionally deferred beyond the hackathon MVP.

---

## 2. Feature Breakdown

### 2.1 P0 — Must Have (Core MVP Scope)

| Feature | Component | Justification |
| :--- | :--- | :--- |
| **Contract & Milestone Setup** | Backend + UI | Contract terms, agreed amounts, deadlines, and acceptance criteria must be defined to establish the baseline for verification. |
| **Delivery Evidence Ingestion** | Backend + UI | Developers must be able to submit Git commits, PR links, CI logs, and security scan outputs as verifiable proof. |
| **Evidence Agent** | AI Engine | Analyzes PR diffs, commit SHAs, and test artifacts against specific acceptance criteria. Replaces subjective human inspection with factual verification. |
| **Risk Agent** | AI Engine | Ingests vulnerability scans and CI results to flag critical security risks or broken builds without inventing synthetic scores. |
| **Arbitrator Agent** | AI Engine | Synthesizes findings from Evidence and Risk agents into an explainable recommendation citing concrete evidence. |
| **Deterministic Settlement Policy Engine** | Pure Logic Engine | Calculates permitted payout caps and applies gate rules (e.g. Critical CVE gate = $0.00 permitted). Crucial separation between AI advice and financial authority. |
| **Human Reviewer Sign-off** | UI + Auth Check | Enforces that no payment can be captured or released without explicit human sign-off; prevents autonomous runaway AI payouts. |
| **PayPal Sandbox Integration** | Backend Payments | Real API integration for payment order creation, authorization, and capture in PayPal Sandbox. Proves real-world financial settlement viability. |
| **AG Grid Financial Ledger** | Frontend Sponsor | Provides an operational grid for financial controllers to sort, filter, and inspect verified criteria, risk flags, and payment states. |
| **Bryntum Gantt Milestone Timeline** | Frontend Sponsor | Visualizes milestone schedule, dependencies, baseline vs. actual submission dates, and delivery delays. |
| **APIMatic OpenAPI Contract Spec** | API Architecture | Defines pristine OpenAPI 3.0 specs ensuring API contract quality across endpoints and powering developer portal docs. |
| **Immutable Audit Trail** | Backend + UI | Logs every event (submission, agent analysis, policy gate check, approval, PayPal capture) with actor attribution and timestamps. |

### 2.2 P1 — Important Improvements (Post-Core Enhancements)

| Feature | Component | Justification |
| :--- | :--- | :--- |
| **Interactive Evidence Diff Viewer** | Frontend UI | Side-by-side visualization of submitted PR diffs and commit messages within the review modal. |
| **Automated GitHub Webhook Ingestion** | Integrations | Ingests PR status and commit hashes directly from GitHub webhooks rather than manual submission form. |
| **Revision Request Flow with Targeted Feedback**| Workflow Engine | Allows reviewers to send back itemized checklists to developers for targeted fixes. |
| **Real-time Evaluation Progress Stepper** | Frontend UX | Visual feedback showing Evidence Agent -> Risk Agent -> Arbitrator Agent stages completing sequentially. |
| **Audit Log Export (JSON/CSV)** | Reporting | Enables finance teams to export compliance reports for bookkeeping. |

### 2.3 P2 — Future Scope (Post-Hackathon)

| Feature | Component | Justification |
| :--- | :--- | :--- |
| **Multi-Provider Payments (Stripe, Escrow.com, Wise)**| Payments | Expands payment rail options beyond PayPal Sandbox. |
| **Automated Legal Dispute Arbitration** | Legal/AI | Submits cryptographic evidence bundles to formal arbitration bodies (e.g. AAA or JAMS). |
| **Enterprise RBAC & SSO (SAML/Okta)** | Enterprise Auth | Multi-tier corporate hierarchy and organizational permission boundaries. |
| **Dynamic Sandbox Container Execution** | Security / Sandbox | Running submitted code inside ephemeral firewalled gVisor containers to verify runtime behavior live. |
| **Multi-Currency Hedging & Milestone Escrow Pools**| Financial Ops | Treasury management and foreign exchange risk hedging for cross-border contracts. |

---

## 3. Explicitly Excluded from MVP

1. **Autonomous AI Money Movement:** Under no condition will an AI agent autonomously trigger a PayPal capture without human reviewer approval.
2. **Server-side Arbitrary Code Execution:** The platform will not compile or run untrusted JavaScript/Python code directly inside its host containers. It relies on trusted CI/CD reports and static analysis artifacts.
3. **Complex Multi-Vendor Payout Splitting:** Payouts are modeled strictly between buyer authorization and milestone settlement; marketplace payout splitting across multiple sub-vendors is excluded due to PayPal Marketplace licensing constraints.
4. **Legally Binding Custodial Escrow Claims:** The app provides technical verification and payment authorization/capture workflows; it is not a licensed financial institution or state-regulated escrow agent.

---

## 4. Definition of Done (DoD) for MVP

A milestone or feature is considered "Done" when:
1. **Contract Integrity:** The feature complies with the documented OpenAPI specification.
2. **Agent Grounding:** AI agent outputs are grounded exclusively in submitted evidence; zero hallucinated commits or scan results.
3. **Deterministic Math:** Payment policy calculations execute purely in deterministic TypeScript/Node.js logic with 100% predictable outcomes across edge cases (full pass, partial pass, gate block, late penalty).
4. **Role Separation:** Developer accounts cannot approve their own milestone settlements; Reviewer sign-off is mandatory.
5. **Real Sandbox Execution:** PayPal Sandbox calls execute against live PayPal Sandbox endpoints with valid credentials, returning real capture IDs (no mock strings in final integrated mode).
6. **Sponsor Technology Verification:**
   - AG Grid displays and filters live contract milestone data.
   - Bryntum Gantt displays project milestones, dependencies, and baseline variances.
   - APIMatic OpenAPI specification validates all core platform endpoints.
7. **Audit Record:** Every completed action produces an immutable audit log entry.
