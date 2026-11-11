# React Bits — TrustChain Page-by-Page Design Proposals
**Document ID:** `TC-REACT-BITS-PROPOSALS-002`  
**Status:** Design Proposal (Pending User Review)  
**Target Project:** TrustChain (MilestoneProof AI)  
**Author:** Google Antigravity (Principal Full-Stack Architect & Fiduciary Engineer)  

---

## 1. Unified Design Language: "Obsidian Cyber-Fiduciary"

TrustChain requires a distinct visual identity that balances **cinematic high-tech spectacle** on public-facing pages with **uncompromising precision and clarity** on fiduciary operational pages:
- **Palette:** Deep Obsidian Charcoal (`#09090b`), Emerald Jade (`#10b981`), Amber Gold (`#f59e0b`), and Cyan Laser (`#06b6d4`).
- **Typography:** Plus Jakarta Sans for UI controls, JetBrains Mono / SF Mono for hashes, currency amounts, and code blocks.
- **Glass Surfaces:** Specular border highlights (`border-zinc-800`), backdrop blurs (`backdrop-blur-md`), and radial cursor spotlights (`SpotlightCard`).
- **Pacing & Timing:** Snappy micro-interactions (150ms–250ms spring transitions) for operational actions; fluid ambient motion (10s–20s sinusoidal waves) for background shaders.

---

## 2. Route-by-Route Blueprint

### 2.1 Route `/` — Cinematic Landing & Product Reveal
- **Visual Personality:** Immersive, 3D, Hollywood-grade product launch.
- **Key Components:**
  1. **Background:** `Aurora` combined with drifting `Particles` creating an endless celestial depth.
  2. **Hero Typography:** `SplitText` animating *"Multi-Agent Evidence-to-Settlement Orchestration"* letter-by-letter with spring physics.
  3. **CTA Button:** `StarBorder` button with traveling stardust around *"Launch Application"*.
  4. **Product Framing:** `Center Stage` 3D glass laptop frame showcasing the live Review Workbench.
  5. **Feature Navigation:** `FlowingMenu` letting visitors inspect the 4 fiduciary pillars (Evidence, Risk, Arbitrator, PayPal).

---

### 2.2 Route `/onboarding` — First-Visit Guided Tour
- **Visual Personality:** Welcoming, guided, tactile, and clear.
- **Key Components:**
  1. **Step Deck:** `Stack` interactive card deck allowing users to click or swipe through the 6 tour stages.
  2. **Persona Selector:** `SpotlightCard` for the Client (`client_01`), Developer (`dev_01`), and Reviewer (`reviewer_01`) cards.
  3. **Headline:** `BlurText` fading in *"Select Your Fiduciary Persona"*.
  4. **Interactive Controls:** `ElasticSlider` to preview how milestone budgets scale dynamically.

---

### 2.3 Route `/dashboard` — Executive Portfolio Overview
- **Visual Personality:** Premium financial command center, high data density, zero lag.
- **Key Components:**
  1. **Metric Telemetry:** `CountUp` numbers animating `$8,500.00 Total Budget`, `3 Seed Milestones`, and `0 Critical CVEs`.
  2. **Active Contracts:** `BorderTrail` orbiting the perimeter of the primary seeded contract card.
  3. **Canvas Atmosphere:** Subdued `DotGrid` providing subtle engineering texture without reducing readability.
  4. **Action Triggers:** `Magnet` hover pull on "New Contract" and "Export Ledger".

---

### 2.4 Route `/intelligence` & `/ledger` — AG Grid Intelligence Control Room
- **Visual Personality:** Highly analytical, forensic, dense financial intelligence.
- **Key Components:**
  1. **Query Bar:** `StarBorder` pulsing around the `NaturalLanguageFilterBar` to highlight AI query capability.
  2. **Interactive Grid:** `ClickSpark` subtle particle burst on clicking rows or quick-filter tags (`submitted this week`, `unmerged prs`).
  3. **Header Accent:** `ShinyText` with a gentle silver sweep over *"AG Grid Community v36 Financial Decision Ledger"*.
  4. **Detail Card:** `SpotlightCard` on the Master/Detail expansion drawer showing evidence provenance telemetry.

---

### 2.5 Route `/timeline` — Bryntum Gantt Contract Execution Schedule
- **Visual Personality:** Mission control timeline, aerospace precision, clear dependencies.
- **Key Components:**
  1. **Precision HUD:** `Crosshair` reticle providing coordinate alignment across time axes and milestone bars.
  2. **Scenario Header:** `TrueFocus` bracket frame locking onto the active scenario title (*"Schedule Risk & Recovery Simulation"*).
  3. **Toolbar Interactions:** `Magnet` micro-interactions on the Bryntum toolbar buttons (Critical Path, Zoom, Baseline).

---

### 2.6 Route `/reviews` — Milestone Review & Payment Workbench
- **Visual Personality:** Trustworthy, decisive, hyper-legible, zero distraction near financial triggers.
- **Key Components:**
  1. **4-Stage Columns:** `SpotlightCard` on each column (1. Evidence, 2. AI Advisory, 3. Policy & Approval, 4. PayPal Settlement).
  2. **Cipher Decryption:** `DecryptedText` animating canonical Git commit SHAs (`a8f4c219e0`) when evidence is submitted or verified.
  3. **AI Evaluation State:** `PixelTransition` smoothly swapping the AI panel from "Pending" to `⚡ LIVE GEMINI` recommendation.
  4. **Settlement Approval:** `ClickSpark` firing upon human reviewer approval (`reviewer_01`), followed by the subtle `Settlement Completion Chime`.

---

### 2.7 Route `/trust` — Evidence Passport & Cryptographic Graph
- **Visual Personality:** Cryptographic vault, forensic immutability, mathematical authority.
- **Key Components:**
  1. **Passport Header Badge:** `TiltedCard` rendering a 3D holographic physical "Passport Card" with glare that reacts to mouse tilt.
  2. **Hash Stream:** `DecryptedText` dynamically ciphering SHA-256 Merkle root digests and SLSA provenance signatures.
  3. **Verification Scan:** `GridScan` subtle horizontal sweep behind the cryptographic verification checklist.

---

### 2.8 Route `/disputes` — Dispute Evidence Pack
- **Visual Personality:** Legal brief meets technical audit, structured, chronological, tamper-evident.
- **Key Components:**
  1. **Audit Timeline:** `AnimatedList` with smooth staggered sequence entrance for all historical contract events.
  2. **Integrity Check:** `DecryptedText` revealing the non-circular SHA-256 package digest.
  3. **Export CTA:** `StarBorder` button around *"Export Sanitized Dispute Pack (JSON)"*.

---

### 2.9 Route `/developers` — APIMatic Developer Portal & SDKs
- **Visual Personality:** Technical documentation, developer-first, dark terminal aesthetic.
- **Key Components:**
  1. **Quick Navigation Dock:** `Dock` pinned to the bottom allowing instant jumping between OpenAPI tags.
  2. **Code Samples:** `CodeBlock` with glowing active tab indicators for TypeScript SDK, Python SDK, and cURL commands.
  3. **Header Badge:** `ShinyText` on the APIMatic OpenAPI 3.0.3 compliance badge.

---

### 2.10 Route `/settings` — Fiduciary System Settings
- **Visual Personality:** Clean, utilitarian, secure configuration console.
- **Key Components:**
  1. **Section Cards:** `SpotlightCard` highlighting SQLite database metrics, PayPal sandbox config, and Gemini API keys.
  2. **Status Badges:** `BorderTrail` around live connection status pills (SQLite WAL, PayPal Webhook, Gemini 3.5 Flash Lite).

---

## 3. Global Shell & Navigation (`AppShell.tsx`)
- **Navigation Bar:** `GooeyNav` liquid pill smoothly morphing across the 9 primary routes.
- **Audio HUD:** Floating audio controller (`Sound Lab` sound effects toggle with volume and mute).
- **Reduced-Motion Detection:** Automatic CSS/JS override disabling all heavy shaders when `prefers-reduced-motion: reduce` is detected.
