# GUIDED_ONBOARDING_IMPLEMENTATION.md — Guided Onboarding Tour Architecture

## 1. Overview & Objectives

The Guided Onboarding Tour introduces first-time users and evaluators to TrustChain's evidence-to-settlement lifecycle without overwhelming them. It operates both as an automatic prompt on first visit and as an on-demand modal accessible anytime via the navigation bar (`Product Tour` / `Guided Tour` button) or the `/onboarding` route.

---

## 2. Tour Step Contract & Visual Narrative

| Step | Title | Category | Accent Color | Primary Invariant / Concept Explained |
|---|---|---|---|---|
| **1** | Welcome to TrustChain | Platform Overview | Emerald | Multi-agent evidence-to-settlement orchestration replacing opaque escrow. |
| **2** | Bryntum Delivery Timeline | Timeline Control | Sapphire | Finish-to-Start dependency tracking and AI schedule proposals that preserve contract budgets. |
| **3** | AG Grid Intelligence Control Room | Decision Intelligence | Amber | Enterprise milestone investigation grid with natural language filtering and Master/Detail telemetry. |
| **4** | Cryptographic Evidence Passport | Cryptographic Trust | Cyan | SHA-256 sealed criteria mappings, GitHub API provenance, and SSRF-guarded runtime validation. |
| **5** | Multi-Agent Fiduciary Review | Multi-Agent Synthesis | Purple | Evidence Agent, Risk Agent, and Arbitrator Agent collaboration with non-autonomous advisory boundaries. |
| **6** | Deterministic PayPal Settlement | Non-Escrow Settlement | Emerald | Server-side policy engine caps payouts; mandatory human approval triggers PayPal Orders API v2 capture. |

---

## 3. Implementation Details

### State Management & Persistence
- **Storage Key:** `tc_onboarding_completed_v1` in `localStorage`.
- **First-Visit Detection:** When `localStorage.getItem('tc_onboarding_completed_v1')` is null, the tour modal automatically opens upon loading `/`.
- **Explicit Dismissal:** Users can click `Skip Tour` or `Finish Tour`, which sets `tc_onboarding_completed_v1` to `'true'`.
- **Tour Reset & Replay:** Users can restart the tour from the navigation bar or from the `/settings` page at any time.

### UI & Interaction Features
- **Visual Progress Bar:** Smoothly transitions from 17% (Step 1) to 100% (Step 6).
- **Step Indicators:** Clickable step pills for direct jump navigation.
- **Deep-Link Integration:** Each step provides a direct action link (e.g., `Jump to Timeline`, `Jump to AG Grid`) that routes the user to the relevant page.
- **Keyboard & Focus Accessibility:** Fully modal with `Escape` key close listener and trapped focus.
