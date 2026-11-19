# Veridex — Proposed Architecture & Technical Specification

> **Autonomous Evidence-to-Settlement Orchestration & Two-Sided Trust Infrastructure for Software Contracts**

---

## 1. Executive Summary

Veridex bridges the trust gap between software buyers (Clients) and engineering talent (Developers). Instead of subjective 5-star ratings, speculative deliverables, and biased human arbitration, Veridex enforces **verifiable telemetry, mathematical escrow settlement, and two-sided cryptographic reputation**.

---

## 2. Client-Side Architecture (5 Layers)

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: Client Experience (Simple & Technical Modes)         │
│ • Idea-based prompt -> AI Requirement Engineering (Gemini)   │
│ • Technical mode: OpenAPI 3.0, PRD, CI coverage targets      │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Marketplace & Matching                              │
│ • Developer discovery with Proof Scores (0-100)              │
│ • Cryptographically verified skill matching & portfolios     │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Project Governance                                  │
│ • Fixed-price contracts, sequence-ordered milestones         │
│ • Hard acceptance criteria (AC-1: PR, AC-2: CI, AC-3: Sec)   │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Veridex Trust Engine (Preserved Core)               │
│ • Evidence Agent · Risk Agent · Arbitrator Agent             │
│ • Deterministic Policy Engine (Pure Math & Rules)            │
│ • Human Fiduciary Reviewer signoff                           │
│ • Non-Custodial 29-day bank authorization hold               │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: Reputation & Analytics                              │
│ • Client Trust Score (Escrow funding rate, dispute history)  │
│ • Milestone burn-up, budget variance, vendor ROI             │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Developer-Side Architecture (6 Layers)

```
┌──────────────────────────────────────────────────────────────┐
│ Layer 1: Developer Profile & Onboarding                      │
│ • Cryptographic identity & GitHub telemetry integration      │
│ • Verified tech stack & past Evidence Passports              │
├──────────────────────────────────────────────────────────────┤
│ Layer 2: Project Discovery & Matching                        │
│ • AI-matched projects fitting tech stack & capacity          │
│ • Transparent budget, criteria, and deadline previews        │
├──────────────────────────────────────────────────────────────┤
│ Layer 3: Contract & Commitment Management                    │
│ • Fixed-price confirmation with zero ambiguity               │
│ • Immutable payment authorization status visibility          │
├──────────────────────────────────────────────────────────────┤
│ Layer 4: Development & Delivery Workspace                    │
│ • Milestone telemetry tracking & Git commit submission       │
│ • Automated CI/CD test evidence ingestion                    │
├──────────────────────────────────────────────────────────────┤
│ Layer 5: Verification & Payment Transparency                 │
│ • Evidence Agent, Risk Agent, and Arbitrator breakdown       │
│ • NO BLIND REJECTIONS: Exact failed criteria & remedies      │
│ • Real-time payment lifecycle (Hold -> Cap -> Disbursed)     │
├──────────────────────────────────────────────────────────────┤
│ Layer 6: Reputation & Growth                                 │
│ • Tamper-proof SLSA Level 2 Evidence Passports               │
│ • Developer Proof Score (CI pass rate, on-time velocity)     │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. The Three Mandatory Developer-Side Rules

1. **Rule 1 — No Unilateral Price Changes:**
   * Once a contract is digitally signed and the pre-authorization hold is active, neither party can unilaterally alter milestone pricing.
   * Any scope change requires a mutually signed Contract Change Request (CCR) with adjusted escrow authorization.
2. **Rule 2 — No Blind AI Rejection:**
   * If automated evaluation fails, the developer is never left guessing.
   * The platform provides the exact line numbers, failed test names, or security CVE IDs, along with a structured 1-click Resubmission & Correction pipeline.
3. **Rule 3 — Complete Payment Transparency:**
   * The developer has real-time visibility into the banking authorization hold balance, permitted payout cap, pending capture status, and settlement timestamps.

---

## 5. Shared Project Workspace & Trust Engine

```
[Client]                                                    [Developer]
Creates Spec & Locks Escrow                                 Accepts Scope & Delivers Code
         │                                                            │
         ▼                                                            ▼
    ┌──────────────────────────────────────────────────────────────────────┐
    │                 Shared Veridex Project Workspace                     │
    │  • Agreed Scope & Versioning     • Milestone Deadlines & ACs         │
    │  • Immutable Git Ingestion       • Two-Sided Communication Stream    │
    └──────────────────────────────────┬───────────────────────────────────┘
                                       │
                                       ▼
    ┌──────────────────────────────────────────────────────────────────────┐
    │                      Shared Veridex Trust Engine                     │
    │  [Evidence Agent]       [Risk Agent]        [Arbitrator Agent]       │
    │         │                     │                     │                │
    │         └─────────────────────┼─────────────────────┘                │
    │                               ▼                                      │
    │             [Deterministic Settlement Policy Engine]                 │
    │             Math verification: Capped Permitted Amount               │
    │                               │                                      │
    │                               ▼                                      │
    │                   [Human Fiduciary Approval]                         │
    │                               │                                      │
    │                               ▼                                      │
    │        [Instant Payout] + [Cryptographic Evidence Passport]          │
    └──────────────────────────────────────────────────────────────────────┘
```
