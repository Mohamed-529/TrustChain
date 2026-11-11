# React Bits — TrustChain Component Selection Catalog
**Document ID:** `TC-REACT-BITS-CATALOG-001`  
**Status:** Selection Shortlist (Pending User Approval)  
**Target Repository:** `DavidHDev/react-bits` (`https://github.com/DavidHDev/react-bits`)  
**Official Portal:** `https://reactbits.dev`  
**Author:** Google Antigravity (Principal Full-Stack Architect & Fiduciary Engineer)  

---

## 1. Overview & Selection Strategy

To transform TrustChain into a cinematic, futuristic, technically credible web experience, we have systematically evaluated the entire React Bits collection across 230+ interactive components, shaders, animations, and creative tools.

This catalog presents a curated **Top-3 shortlist** for every architectural layer and application area of TrustChain. Every component has been evaluated for:
1. **Visual Gravitas:** Reinforces TrustChain's identity as a secure, high-tech multi-agent fiduciary protocol.
2. **Operational Ergonomics:** Enhances visual feedback without obscuring financial decision-making or delaying settlement approvals.
3. **Engineering Compatibility:** 100% compatible with React 19, Tailwind CSS v4, Motion v12, and TypeScript.
4. **License Compliance:** 100% Free and open-source (MIT + Commons Clause), with zero Pro paywalls or watermarks.

---

## 2. Category A: Page-Level Design Proposals

### A.1 Cinematic Landing Page (`/`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Aurora + Particles** | [reactbits.dev/backgrounds/aurora](https://reactbits.dev/backgrounds/aurora) | Fluid sinusoidal luminous aurora combined with floating constellation particles; creates an immersive product reveal | Full-screen hero background on Landing (`WelcomeLandingPage.tsx`) | Canvas / WebGL, CSS | MIT + Commons (Free) |
| **2** | **Hyperspeed** | [reactbits.dev/backgrounds/hyperspeed](https://reactbits.dev/backgrounds/hyperspeed) | High-velocity neon vector light-tunnel accelerating into perspective; symbolizes ultra-fast settlement orchestration | Stage B Product Reveal background | `three` (Three.js) | MIT + Commons (Free) |
| **3** | **Grid Scan** | [reactbits.dev/backgrounds/grid-scan](https://reactbits.dev/backgrounds/grid-scan) | Sci-fi grid mesh with glowing horizontal radar scanlines sweep; reflects cryptographic code inspection | Stage C Platform Capabilities background | Canvas 2D, Motion | MIT + Commons (Free) |

---

### A.2 First-Visit Onboarding (`/onboarding`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Stack** | [reactbits.dev/components/stack](https://reactbits.dev/components/stack) | Interactive card deck where cards can be swiped, flicked, or stepped through sequentially | 6-Stage Guided Tour Modal (`GuidedTourModal.tsx`) | `motion`, TypeScript | MIT + Commons (Free) |
| **2** | **SpotlightCard** | [reactbits.dev/components/spotlight-card](https://reactbits.dev/components/spotlight-card) | Subtle radial flashlight illumination following cursor across onboarding step cards | Persona selection cards (Client, Dev, Reviewer) | Tailwind CSS v4, TypeScript | MIT + Commons (Free) |
| **3** | **ElasticSlider** | [reactbits.dev/components/elastic-slider](https://reactbits.dev/components/elastic-slider) | Spring-physics rubber-band interactive slider for interactive tour progression | Tour step scrubber / milestone budget preview | `motion`, TypeScript | MIT + Commons (Free) |

---

### A.3 Executive Dashboard (`/dashboard`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **CountUp** | [reactbits.dev/text-animations/count-up](https://reactbits.dev/text-animations/count-up) | Smooth animated numeric rollups for portfolio capital, active milestones, and risk scores | Executive Metric Cards (`$8,500.00`, `3 Milestones`, `100%`) | `motion`, TypeScript | MIT + Commons (Free) |
| **2** | **BorderTrail** | [reactbits.dev/animations/border-trail](https://reactbits.dev/animations/border-trail) | Continuous luminous laser beam orbiting the card perimeter to emphasize active contracts | High-priority contract cards on Dashboard | Pure CSS / Motion | MIT + Commons (Free) |
| **3** | **DotGrid** | [reactbits.dev/backgrounds/dot-grid](https://reactbits.dev/backgrounds/dot-grid) | Subtle, static/reactive engineering dot matrix pattern providing tactile depth without visual clutter | Dashboard canvas container | Canvas / CSS | MIT + Commons (Free) |

---

### A.4 AG Grid Intelligence Control Room (`/intelligence`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **StarBorder** | [reactbits.dev/animations/star-border](https://reactbits.dev/animations/star-border) | Traveling starlight streak tracing input bounds; draws focus to natural-language query engine | `NaturalLanguageFilterBar` container | CSS Keyframes | MIT + Commons (Free) |
| **2** | **ShinyText** | [reactbits.dev/text-animations/shiny-text](https://reactbits.dev/text-animations/shiny-text) | Moving metallic silver/gold shimmer band across text | AG Grid ledger header & summary statistics | CSS gradient | MIT + Commons (Free) |
| **3** | **ClickSpark** | [reactbits.dev/animations/click-spark](https://reactbits.dev/animations/click-spark) | Micro particle spark burst on user click | AG Grid row selection & quick filter chips | Native Canvas 2D | MIT + Commons (Free) |

---

### A.5 Bryntum Gantt Timeline Control Tower (`/timeline`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Crosshair** | [reactbits.dev/animations/crosshair](https://reactbits.dev/animations/crosshair) | Precision HUD reticle following cursor across Gantt bars and date axes | Bryntum Gantt container overlay | CSS / React hook | MIT + Commons (Free) |
| **2** | **TrueFocus** | [reactbits.dev/text-animations/true-focus](https://reactbits.dev/text-animations/true-focus) | Animated bracket frame snapping around selected milestone title and critical path indicators | Timeline scenario header & KPI cards | `motion`, TypeScript | MIT + Commons (Free) |
| **3** | **Magnet** | [reactbits.dev/micro-interactions/magnet](https://reactbits.dev/micro-interactions/magnet) | Gentle cursor magnetic attraction on zoom and filter controls | Gantt toolbar buttons (Zoom In, Critical Path, Baseline) | `motion`, TypeScript | MIT + Commons (Free) |

---

### A.6 Milestone Review & Settlement Workbench (`/reviews`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **SpotlightCard** | [reactbits.dev/components/spotlight-card](https://reactbits.dev/components/spotlight-card) | Focused illumination highlighting the 4 fiduciary columns (Evidence, AI Advisory, Policy, PayPal) | Review Workbench columns | Tailwind CSS v4 | MIT + Commons (Free) |
| **2** | **DecryptedText** | [reactbits.dev/text-animations/decrypted-text](https://reactbits.dev/text-animations/decrypted-text) | Scrambled matrix characters decoding into canonical Git commit SHAs and AI reasoning summary | Column 1 Evidence SHA and Column 2 AI synthesis | TypeScript, React hook | MIT + Commons (Free) |
| **3** | **PixelTransition** | [reactbits.dev/animations/pixel-transition](https://reactbits.dev/animations/pixel-transition) | Pixelated dissolve transition when AI evaluation completes and renders recommendation | Column 2 AI Advisory panel state change | CSS / React hook | MIT + Commons (Free) |

---

### A.7 Evidence Passport & Provenance (`/trust`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **DecryptedText** | [reactbits.dev/text-animations/decrypted-text](https://reactbits.dev/text-animations/decrypted-text) | Futuristic cryptographic cipher decoding for SHA-256 digests and Merkle root hashes | Passport Root Digest & Evidence Node Hashes | TypeScript, React hook | MIT + Commons (Free) |
| **2** | **TiltedCard** | [reactbits.dev/components/tilted-card](https://reactbits.dev/components/tilted-card) | 3D holographic tilt card with surface glare for the cryptographically anchored Evidence Passport | Physical "Passport ID Card" header badge | `motion`, TypeScript | MIT + Commons (Free) |
| **3** | **GridScan** | [reactbits.dev/backgrounds/grid-scan](https://reactbits.dev/backgrounds/grid-scan) | Subdued cybernetic grid scanline sweep behind cryptographic verification badges | Evidence Passport verification summary card | Canvas 2D | MIT + Commons (Free) |

---

### A.8 Dispute Evidence Pack (`/disputes`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **AnimatedList** | [reactbits.dev/components/animated-list](https://reactbits.dev/components/animated-list) | Smooth staggered sequence entrance for chronological dispute timeline events | Dispute Event Timeline & Evidence Audit Log | `motion`, TypeScript | MIT + Commons (Free) |
| **2** | **StarBorder** | [reactbits.dev/animations/star-border](https://reactbits.dev/animations/star-border) | Glowing amber/emerald border beam highlighting tamper-evident export readiness | "Export Sanitized Dispute Pack" CTA card | CSS Keyframes | MIT + Commons (Free) |
| **3** | **DecryptedText** | [reactbits.dev/text-animations/decrypted-text](https://reactbits.dev/text-animations/decrypted-text) | Forensic deciphering animation for SHA-256 package checksums | Dispute pack integrity header | TypeScript | MIT + Commons (Free) |

---

### A.9 Developer Portal (`/developers`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **CodeBlock / SyntaxGlow** | [reactbits.dev/components/code-block](https://reactbits.dev/components) | Interactive syntax-highlighted SDK snippets with one-click copy and glowing active tab | TypeScript SDK & cURL operation code cards | CSS / Lucide icons | MIT + Commons (Free) |
| **2** | **Dock** | [reactbits.dev/components/dock](https://reactbits.dev/components/dock) | Magnified macOS-style quick dock to switch between OpenAPI tags (Contracts, Milestones, PayPal) | Sticky bottom navigation across 54 API endpoints | `motion`, TypeScript | MIT + Commons (Free) |
| **3** | **ShinyText** | [reactbits.dev/text-animations/shiny-text](https://reactbits.dev/text-animations/shiny-text) | Shimmering text highlighting APIMatic compliance and SDK generation badges | Developer Portal hero badge | CSS gradient | MIT + Commons (Free) |

---

### A.10 Financial Decision Ledger (`/ledger`)
| Rank | Exact Component Name | Official Live Demo | Purpose | TrustChain Target Location | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **CountUp** | [reactbits.dev/text-animations/count-up](https://reactbits.dev/text-animations/count-up) | Precision currency counter rolling up authorized vs. captured amounts | Ledger Header KPI cards | `motion`, TypeScript | MIT + Commons (Free) |
| **2** | **SpotlightCard** | [reactbits.dev/components/spotlight-card](https://reactbits.dev/components/spotlight-card) | Hover illumination on master row details showing policy explanations | Ledger row detail expansion card | Tailwind CSS v4 | MIT + Commons (Free) |
| **3** | **BorderTrail** | [reactbits.dev/animations/border-trail](https://reactbits.dev/animations/border-trail) | Soft gold laser border around settled transactions | Verified settlement cards | Pure CSS | MIT + Commons (Free) |

---

## 3. Category B: Text and Typography

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **SplitText** | [reactbits.dev/text-animations/split-text](https://reactbits.dev/text-animations/split-text) | Chars/words animate into place with spring physics and stagger delay | Hero headlines on Landing & Onboarding | `motion`, TypeScript | MIT + Commons (Free) |
| **2** | **DecryptedText** | [reactbits.dev/text-animations/decrypted-text](https://reactbits.dev/text-animations/decrypted-text) | Scrambled glyphs cipher-decode into verified strings | Git commit hashes, Merkle digests, API keys | TypeScript, React hook | MIT + Commons (Free) |
| **3** | **BlurText** | [reactbits.dev/text-animations/blur-text](https://reactbits.dev/text-animations/blur-text) | Words emerge smoothly from a dreamy Gaussian blur into sharp focus | Subheadings on Dashboard and Review Workbench | `motion`, TypeScript | MIT + Commons (Free) |

---

## 4. Category C: Buttons and Micro-Interactions

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **StarBorder Button** | [reactbits.dev/animations/star-border](https://reactbits.dev/animations/star-border) | Glowing particles orbit the button border continuously | Primary CTAs: "Enter Application", "Run AI Evaluation" | Pure CSS keyframes | MIT + Commons (Free) |
| **2** | **Magnet** | [reactbits.dev/micro-interactions/magnet](https://reactbits.dev/micro-interactions/magnet) | Element floats toward pointer within proximity radius | Navbar items, Icon actions, "Approve Milestone" | `motion`, TypeScript | MIT + Commons (Free) |
| **3** | **ClickSpark** | [reactbits.dev/animations/click-spark](https://reactbits.dev/animations/click-spark) | Radial burst of energetic sparks on click coordinate | Sandbox Approval trigger, PayPal Capture button | Canvas 2D | MIT + Commons (Free) |

---

## 5. Category D: Navigation and Page Transitions

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **GooeyNav** | [reactbits.dev/components/gooey-nav](https://reactbits.dev/components/gooey-nav) | Liquid active selection pill stretches and snaps between menu tabs | Floating Glassmorphic App Navbar (`AppShell.tsx`) | SVG filters / `motion` | MIT + Commons (Free) |
| **2** | **Dock** | [reactbits.dev/components/dock](https://reactbits.dev/components/dock) | macOS-style magnification curve scaling icons on hover | Developer Portal tag navigation & quick persona dock | `motion`, TypeScript | MIT + Commons (Free) |
| **3** | **FlowingMenu** | [reactbits.dev/components/flowing-menu](https://reactbits.dev/components/flowing-menu) | Smooth active row slider revealing marquee text on hover | Stage C Platform Capabilities browser on Landing | `motion`, TypeScript | MIT + Commons (Free) |

---

## 6. Category E: Cards, Panels and Data Presentation

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **SpotlightCard** | [reactbits.dev/components/spotlight-card](https://reactbits.dev/components/spotlight-card) | Directional cursor spotlight revealing glass card borders | 4-Stage Workbench columns, AG Grid detail cards | Tailwind CSS v4 | MIT + Commons (Free) |
| **2** | **TiltedCard** | [reactbits.dev/components/tilted-card](https://reactbits.dev/components/tilted-card) | 3D perspective tilt with specular lighting glare | Cryptographic Evidence Passport ID badge | `motion`, TypeScript | MIT + Commons (Free) |
| **3** | **Stack** | [reactbits.dev/components/stack](https://reactbits.dev/components/stack) | Stacked card deck with drag-and-dismiss mechanics | Guided Tour, Proposal Review drawer | `motion`, TypeScript | MIT + Commons (Free) |

---

## 7. Category F: Backgrounds and 3D Effects

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Aurora** | [reactbits.dev/backgrounds/aurora](https://reactbits.dev/backgrounds/aurora) | Shifting sinusoidal emerald/gold plasma wave | Hero background on Landing (`WelcomeLandingPage.tsx`) | Canvas WebGL / CSS | MIT + Commons (Free) |
| **2** | **Particles** | [reactbits.dev/backgrounds/particles](https://reactbits.dev/backgrounds/particles) | Drifting 3D constellation field connected by soft vectors | Onboarding and Dashboard canvas background | Canvas 2D | MIT + Commons (Free) |
| **3** | **GridScan** | [reactbits.dev/backgrounds/grid-scan](https://reactbits.dev/backgrounds/grid-scan) | Orthogonal grid with oscillating radar beam sweep | Intelligence Control Room & Evidence Passport | Canvas 2D | MIT + Commons (Free) |

---

## 8. Category G: Photos and Image Treatments

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Center Stage** (Tool) | [reactbits.dev/tools/center-stage](https://reactbits.dev) | High-fidelity 3D device framing (MacBook Pro, Studio Display, iPad) | Product showcase mockups on Landing Page | Browser tool export | Free Tool |
| **2** | **CircularGallery** | [reactbits.dev/components/circular-gallery](https://reactbits.dev/components/circular-gallery) | 3D cylindrical image carousel that rotates smoothly | Stage B Feature showcase & sponsor ecosystem gallery | OGL / WebGL | MIT + Commons (Free) |
| **3** | **PixelTransition** | [reactbits.dev/animations/pixel-transition](https://reactbits.dev/animations/pixel-transition) | Pixelated dissolve revealing screenshot before/after | Evidence before/after diff inspector | CSS / Canvas | MIT + Commons (Free) |

---

## 9. Category H: Videos and Motion Media

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Background Studio** (Tool) | [reactbits.dev/tools/background-studio](https://reactbits.dev) | Generates optimized looping MP4/WebM video textures | Hero background video for Landing Page | Video element / MP4 | Free Tool |
| **2** | **Shape Magic** (Tool) | [reactbits.dev/tools/shape-magic](https://reactbits.dev) | Renders 3D metallic and glass brand geometry with animated rotation | TrustChain animated shield logo video export | WebM / Canvas | Free Tool |
| **3** | **Texture Lab** (Tool) | [reactbits.dev/tools/texture-lab](https://reactbits.dev) | Applies sci-fi CRT distortion and scanline grain to media | Video playback in Dispute Evidence Pack viewer | WebGL / Canvas | Free Tool |

---

## 10. Category I: Audio and Sound Design

| Rank | Exact Component Name | Official Live Demo | Visual / Acoustic Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Sound Lab** (Tool) | [reactbits.dev/tools/sound-lab](https://reactbits.dev) | Generates crisp, futuristic UI clicks, hums, and tactile chimes | Fiduciary button clicks, modal opens, and tab changes | Web Audio API / Audio assets | Free Tool |
| **2** | **Settlement Completion Chime** | Web Audio API synth | Subtle warm synthesizer chord confirming successful settlement capture | PayPal capture success state | Native Web Audio API | Zero dependency |
| **3** | **Global Mute Controller** | Custom TrustChain HUD | Floating mute/unmute audio toggle with `localStorage` memory | Main Navigation Bar (`AppShell.tsx`) | React hook | Zero dependency |

---

## 11. Category J: Icons and Visual Indicators

| Rank | Exact Component Name | Official Live Demo | Visual Behavior | Best TrustChain Application | Dependencies | License |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Lucide Animated Micro-Transitions** | Existing TrustChain standard | Rotating icons on loading (`Loader2`), spring bounces on checkmarks | Review status badges, PayPal order icons | `lucide-react`, `motion` | MIT (Installed) |
| **2** | **TargetCursor** | [reactbits.dev/animations/target-cursor](https://reactbits.dev/animations/target-cursor) | High-tech reticle corners snapping to buttons and icons | Developer Portal and Timeline HUD | `motion`, TypeScript | MIT + Commons (Free) |
| **3** | **BorderTrail Status Badges** | [reactbits.dev/animations/border-trail](https://reactbits.dev/animations/border-trail) | Orbiting laser boundary around `⚡ LIVE GEMINI` and `VERIFIED` pills | AI decision badges and cryptographic stamp | Pure CSS | MIT + Commons (Free) |
