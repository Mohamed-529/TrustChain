# CINEMATIC_EXPERIENCE_ARCHITECTURE.md — TrustChain Cinematic Frontend Architecture

## 1. Executive Summary & Design Philosophy

TrustChain delivers a market-grade, cinematic product experience for multi-agent evidence-to-settlement orchestration. Instead of a monolithic 5,600-pixel continuous vertical stack, TrustChain now features a dedicated multi-page route architecture, rich interactive 3D lifecycle visualizer, atmospheric lighting tokens, and an interactive 6-step guided tour.

The visual direction embodies institutional fintech reliability and cryptographic certainty:
- **Atmospheric Palette:** Deep obsidian navy (`#020617`, `#0f172a`), emerald settlement accents (`#10b981`), sapphire provenance glow (`#38bdf8`), and amber review alerts (`#f59e0b`).
- **Interactive 3D Lifecycle Visualizer:** A 6-stage canvas-drawn visualizer rendering real-time interconnected nodes with orbital geometry, pulsating data packets, responsive node inspection, and accessible reduced-motion support.
- **Strict Role-Aware Architecture:** Client, Developer, and Reviewer personas navigate dedicated operational views with real-time backend synchronization and cryptographic audit replay.

---

## 2. Information Architecture & Navigation Shell

### Unified Application Shell (`AppShell`)
The application shell wraps every route, providing:
1. **Header Navigation:** Active route highlighting with subtle glow indicators, clear page identity, and quick shortcuts.
2. **Interactive Persona Switcher:** Instant role-switching (Client, Developer, Reviewer) with session token regeneration and permission updates.
3. **Interactive Tour Launcher:** One-click activation of the 6-stage guided product tour.
4. **Real-Time Notification Banner:** System alerts for PayPal orders, verification events, and policy calculations.
5. **Breadcrumb & Context Ribbon:** Displays the active contract (`contract_seed_01`), active milestone, and currency denomination (`USD`).

---

## 3. Dedicated Route Architecture

| Route | View Component | Core Purpose | Sponsor / Domain Integration |
|---|---|---|---|
| `/` | `WelcomeLandingPage` | Cinematic first impression, hero storytelling, 3D trust visualizer | Interactive Canvas, Sponsor Tech Matrix |
| `/onboarding` | `GuidedTourModal` | Full-screen interactive guided walkthrough | Progress stepper, localStorage persistence |
| `/dashboard` | `DashboardPage` | Executive portfolio KPIs, risk distributions, settlement summaries | SVG distribution charts, financial aggregates |
| `/intelligence` | `IntelligencePage` | AG Grid investigation cockpit & natural-language filter | **AG Grid Community v36**, Full-Width Master/Detail |
| `/timeline` | `TimelinePage` | Software delivery schedule, dependencies & critical path | **Bryntum Gantt v7.3**, Baseline comparisons |
| `/reviews` | `ReviewsPage` | 4-column multi-agent review workbench & PayPal action center | **PayPal Orders API v2**, Multi-Agent Synthesis |
| `/trust` | `TrustPage` | Cryptographic evidence passport & independent GitHub provenance | SHA-256 Merkle tree, GitHub REST API, SSRF guard |
| `/disputes` | `DisputesPage` | Dispute Evidence Pack & tamper-evident export suite | Portable JSON export, independent verification |
| `/settings` | `SettingsPage` | User preferences, persona switching, cryptographic audit logs | SQLite audit ledger, tour reset |

---

## 4. Interactive 3D Trust Lifecycle Visualizer (`TrustLifecycle3D`)

The visualizer illustrates TrustChain's 6-stage evidence-to-settlement lifecycle:

```
[1. GitHub Telemetry]  ──>  [2. Risk Agent]  ──>  [3. Evidence Passport]
         │                          │                         │
         v                          v                         v
[4. Arbitrator Agent]  ──>  [5. Settlement Policy] ──> [6. Human Approval & PayPal]
```

### Technical Implementation:
- **Canvas Rendering Engine:** 60fps high-DPI rendering using HTML5 Canvas with dual-ring glowing orbital nodes and animated particle bezier curves.
- **Node Contract Inspector:** Clicking any lifecycle stage displays its data contract, verified cryptographic invariants, and fiduciary boundaries.
- **Accessibility & Performance:** Checks `window.matchMedia('(prefers-reduced-motion: reduce)')` to disable continuous rotation and particle emission for motion-sensitive users.

---

## 5. Security & Financial Invariants

1. **AI Agents are Strictly Advisory:** The Arbitrator Agent cannot mutate contractual payment terms or execute payment operations.
2. **Mandatory Human Review Gate:** Human fiduciary approval is required before any PayPal capture is permitted.
3. **Deterministic Settlement Calculation:** Payout caps are computed server-side via integer cents arithmetic.
4. **Zero Client-Side Financial Authority:** Grid interactions, route changes, and tour progression are strictly read-only and cannot mutate financial states.
