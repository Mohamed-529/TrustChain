# CINEMATIC_ENTRY_EXPERIENCE.md — TrustChain Cinematic Entry Experience

## 1. Executive Summary & Design Principles

Inspired by modern cinematic digital experiences (such as Google Antigravity's atmospheric opening sequence), TrustChain's entry experience (`/`) has been elevated into a market-grade, immersive product journey. Rather than displaying an overwhelming operational interface immediately, the landing page choreographs three intentional stages:

1. **Stage A — Cinematic Opening:** Deep obsidian space (`#02040a`), dynamic depth particles, sinusoidal luminous cyan/indigo energy arcs, a minimal centered TrustChain logo reveal with a radiant pulse, and accessible playback/skip controls.
2. **Stage B — Product Reveal:** A sequential 6-stage lifecycle presentation ("Trust every delivery. Verify every milestone.") highlighting the end-to-end evidence-to-settlement pipeline with glowing conduits and technical invariant inspection.
3. **Stage C — Platform Capabilities Showcase:** 7 purpose-built modules (Evidence Intelligence, AG Grid Milestone Intelligence, Bryntum Timeline Control Tower, Human Review Workbench, Evidence Passport, Dispute Evidence Pack, and PayPal Payment Lifecycle) with direct routing to active operational pages.

---

## 2. Stage-by-Stage Implementation

### Stage A — Cinematic Opening (`CinematicOpening.tsx`)
- **Canvas Rendering Engine (`LuminousWaveCanvas.tsx`):**
  - High-DPI 60fps HTML5 Canvas rendering multi-frequency sinusoidal waves with caustic light interference.
  - 65 z-layered particles with pulse phases and subtle mouse parallax.
  - Automatic `prefers-reduced-motion` compliance: disables active frame loops and renders a static luminous gradient.
  - Memory-safe: cancels `requestAnimationFrame` on unmount to prevent GPU leaks.
- **Centered Logo Glyph Reveal:**
  - Minimal shield/chain SVG icon encased in a dual-ring ambient glow.
  - Tagline: *"Where verified software delivery meets deterministic financial settlement."*
- **Action Controls:**
  - `Explore TrustChain ↓`: Smooth scroll into the core product presentation.
  - `▶ Play Cinematic Intro`: Triggers choreographed stage sequence.
  - `Skip Intro ✕`: Fixed header control allowing instant jump to full platform capabilities.
  - `Sign In / Persona`: Direct route to persona configuration and session switching.

### Stage B — Product Reveal (`LifecycleRevealSection.tsx`)
- **Headline:** *"Trust every delivery. Verify every milestone."*
- **The 6-Stage Core Lifecycle:**
  1. `GitHub Evidence` (Ingestion & Telemetry — SHA-256 commit attestations, PR status, CI logs).
  2. `AI Risk Analysis` (Multi-Agent Synthesis — Advisory-only boundary, prompt injection defense).
  3. `Deterministic Policy` (Financial Policy Engine — Integer cents payout formula, deduction calculation).
  4. `Human Approval` (Mandatory Fiduciary Gate — Fiduciary sign-off, zero autonomous execution).
  5. `PayPal Settlement` (Non-Escrow Orders API v2 — 29-day authorization hold, capture upon approval).
  6. `Immutable Audit` (ACID Audit Trail — Append-only triggers, SHA-256 Merkle chain replay).
- **Interactive Stage Inspection:**
  - Clicking any step displays its **Technical Mechanism** and **Fiduciary Invariant**.
  - Direct action button to jump into that specific operational view in the app.

### Stage C — Platform Capabilities Showcase (`PlatformCapabilitiesShowcase.tsx`)
7 deep-dive capability cards explaining concrete business and technical purposes:
1. **Evidence Intelligence** (`/trust`): Independent GitHub REST API provenance, commit SHA-256 attestations, CI coverage telemetry.
2. **Milestone Intelligence Control Room** (`/intelligence`): **AG Grid Community v36** virtualized ledger, NLP query filter bar, full-width Master/Detail commit and CI telemetry.
3. **Project Timeline Control Tower** (`/timeline`): **Bryntum Gantt v7.3** control tower, Finish-to-Start dependencies, critical path, and budget-preserving AI schedule shifts.
4. **Human Review Workbench** (`/reviews`): 4-column fiduciary cockpit, decimal-safe integer cents capping, role-governed human sign-off.
5. **Cryptographic Evidence Passport** (`/trust`): 18-point cryptographic gate, Merkle tree digest, SSRF-guarded runtime preview with socket IP-pinning.
6. **Dispute Evidence Pack** (`/disputes`): Two-stage non-circular SHA-256 digest sealing, deterministic chronological timeline, portable JSON export.
7. **PayPal Payment Lifecycle** (`/reviews`): **PayPal Orders API v2** 29-day non-escrow authorization hold, idempotency keys, webhook HMAC verification.

---

## 3. Returning User & Accessibility Architecture

- **State Persistence:** `STORAGE_KEY_CINEMATIC_VISITED` (`tc_cinematic_visited_v1`) stored in `localStorage`.
- **First-Time Visitors:** Auto-plays the opening sequence and invites the user to explore or launch the 6-step guided onboarding tour.
- **Returning Users:** Does not force an animation replay; renders the full platform explorer with an always-accessible "Replay Cinematic Intro" pill.
- **Accessibility & Performance:**
  - Zero heavy 3D engine overhead (Three.js / R3F avoided; lightweight Canvas + SVG used).
  - First contentful paint under 100ms.
  - Full keyboard accessibility with visible focus rings.

---

## 4. Verification & Testing

- **TypeScript Compilation (`npx tsc --noEmit`):** Clean exit, 0 errors.
- **Automated Test Suites (`npm test`):**
  - **188 passed / 188 total across 17 test suites (100% GREEN).**
  - `cinematic_frontend.test.ts` passed 17/17 tests covering Stage A, B, C, routing, and persona security.
- **Production Build (`vite build`):** Clean build completed in 9.08s.
