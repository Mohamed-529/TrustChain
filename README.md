# ◈ Veridex — Autonomous AI-Fiduciary Software Escrow & Verification Engine

[![Live on Embarko](https://img.shields.io/badge/Live%20Demo-veridex.embarko.app-2f7a50?style=for-the-badge&logo=googlechrome&logoColor=white)](https://veridex.embarko.app)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B%20(Native%20SQLite)-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.1%20%2B%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash%20(Tri--Agent)-8E75C2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Pre-Auth Escrow](https://img.shields.io/badge/Smart%20Escrow-Non--Custodial%20Pre--Auth-00457C?style=for-the-badge&logo=shield&logoColor=white)](https://veridex.embarko.app)
[![OpenAPI 3.0.3](https://img.shields.io/badge/OpenAPI-3.0.3%20Governed%20Contract-007ACC?style=for-the-badge&logo=openapiinitiative&logoColor=white)](https://github.com/Mohamed-529/TrustChain)
[![Tests Passing](https://img.shields.io/badge/Tests-Passing%20(100%25)-success?style=for-the-badge&logo=checkmarx&logoColor=white)](https://github.com/Mohamed-529/TrustChain)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **Veridex** solves the **$100B+ freelance, agency, and software delivery milestone dispute crisis**. Clients fear paying upfront for broken deliverables or AI-hallucinated code; developers fear spending weeks implementing features only to be ghosted or denied payment.
>
> Veridex is the world's first **autonomous, non-custodial software escrow and verification engine**. It bridges git repositories, automated test telemetry, and PayPal payment pre-authorization holds. A tri-agent AI verification mesh evaluates deliverables against contractual acceptance criteria, autonomously validates proof, and coordinates programmatic escrow settlement.

---

## 🌐 Live Deployment & Interactive Demo

- **Live Application (Embarko):** [https://veridex.embarko.app](https://veridex.embarko.app)
- **GitHub Repository:** [https://github.com/Mohamed-529/TrustChain](https://github.com/Mohamed-529/TrustChain)
- **Local Interactive Demo:** `http://localhost:3000` (Clone & run `npm start`)

---

## 👥 Streamlined Role Experience (Client & Developer)

Veridex eliminates cumbersome multi-user bottlenecks by pairing a clean, role-tailored interface with an **Autonomous AI Fiduciary Mesh**:

| Persona | Role | Quick Access | Responsibilities & Capabilities |
| :--- | :--- | :--- | :--- |
| **Elena Vance** | `CLIENT` | 1-Click Sandbox on Login | Creates projects, defines milestone acceptance criteria, authorizes 29-day bank escrow hold, releases approved disbursements. |
| **Marcus Chen** | `DEVELOPER` | 1-Click Sandbox on Login | Accepts contracts, submits deliverable telemetry (commit SHA, PRs, CI test suites), inspects AI evaluation passport, receives funds. |
| **Tri-Agent Mesh** | `AUTONOMOUS AI` | Automated Background Engine | Replaces manual reviewer friction. Automatically validates commits, scans for CVE vulnerabilities, synthesizes acceptance criteria, and verifies fiduciary gates. |

### 🧭 Role-Based Navigation
- **Client View:** `Create Project (AI Spec)` • `My Contracts` • `Escrow & Settle (Bank Hold)`
- **Developer View:** `Developer Workspace` • `Submit Delivery (Get Paid)` • `Evidence Passport (Proof)`

---

## ⚡ The Core Problem & Veridex's Solution

```
Traditional Freelance / Agency Contracts:
[Client Promises Payment] ---> [Developer Submits Code] ---> [Subjective Disputes / Ghosting]
                                                                        ❌ Payment Withheld

Veridex Deterministic Fiduciary Flow:
[Client Pre-Authorizes 29-Day PayPal Escrow Hold]
        │
        ▼
[Developer Submits PR, Commit SHA & CI/CD Telemetry]
        │
        ▼
[Tri-Agent AI Advisory Synthesis (Evidence + Risk + Arbitrator)]
        │
        ▼
[Deterministic Settlement Policy (Calculates Permitted Amount & Penalties)]
        │
        ▼
[Automated Fiduciary Gate Approval (Verified Criteria & Integrity)]
        │
        ▼
[1-Click Programmatic PayPal Settlement Capture ($2,275.00 Released)]
        │
        ▼
[Cryptographic Evidence Passport Issued & SHA-256 Ledger Sealed]
```

---

## 🎬 4-Step Live Demo Runbook

You can experience the complete client-to-developer settlement lifecycle in under 60 seconds on [veridex.embarko.app](https://veridex.embarko.app):

1. **Client Sign In:**
   - On the full-screen landing page, click **`👔 Elena Vance (Client)`** for instant sandbox access.
2. **Open Escrow Workbench:**
   - From the clean 3-tab navigation bar, click **`Escrow & Settle`** (`/reviews`).
3. **Submit Evidence & Run Autonomous AI Verification:**
   - In Column 1, click **`Submit Demo Evidence`** (ingests commit SHA, merged PR, and 64/64 passing test suite).
   - In Column 1, click **`Run AI Evaluation`**.
   - Column 2 immediately displays Tri-Agent Consensus (`PASS`, `⚡ LIVE GEMINI`, 3/3 criteria verified, 0 CVE risk).
   - Column 3 immediately displays **`✓ Milestone Approved by AI Arbitrator & Fiduciary Gate`** with the deterministic permitted cap ($2,275.00).
4. **Authorize Escrow Hold & Release Funds:**
   - In Column 4, click **`2. Authorize Hold (29 Days)`** (locks pre-authorization hold).
   - Click the green highlighted **`3. Capture Settlement & Release Funds →`** button.
   - Instantly releases $2,275.00 to developer Marcus Chen with badge **`✓ Funds Released ($2,275.00 Settled)`**!

---

## 🏛️ System Architecture & Engineering Principles

### 1. Tri-Agent AI Advisory Synthesis (`Google Gemini 2.5 Flash`)
- **Evidence Agent:** Extracts git commit trees, verifies PR merge status, and parses CI/CD execution artifacts.
- **Risk Agent:** Audits dependency trees for CVE advisories and defends against prompt injection attacks embedded inside untrusted repository descriptions or commit messages.
- **Arbitrator Agent:** Evaluates ingested evidence against contractual acceptance criteria (AC-1, AC-2, AC-3) and generates structured advisory outcomes (`PASS` / `REVISE_REQUIREMENTS`).
- **Strict Advisory Boundary:** AI agents never take custody of funds, never hold private credentials, and cannot independently alter contractual formulas.

### 2. Deterministic Settlement Policy Engine
- Pure mathematical calculation running strictly in integer cents (preventing floating-point errors).
- Enforces contractual formulas, verified criteria ratios, and SLA late penalties:
  $$\text{Permitted Amount} = \min(\text{Agreed Amount} - \text{Late Penalty}, \text{Authorized Hold})$$
- Prevents negative transfers or over-disbursements.

### 3. Non-Custodial Bank Escrow Model (`PayPal Orders API v2`)
- Eliminates traditional custodial crypto or unregulated third-party escrow risks.
- Client authorizes a standard 29-day payment hold via PayPal Orders API v2 (`intent: "AUTHORIZE"`).
- Veridex never takes custody of funds. Capital remains safely pre-authorized in PayPal's banking rail and captures directly to the contractor upon delivery verification.

### 4. Cryptographic SQLite Audit Ledger (`node:sqlite`)
- Engineered with Node.js 22 built-in `node:sqlite` in WAL mode (`PRAGMA synchronous = FULL`).
- Every lifecycle event is sealed into an immutable block with SHA-256 hash chaining:
  $$\text{Block Hash} = \text{SHA256}(\text{Index} \parallel \text{PrevHash} \parallel \text{Timestamp} \parallel \text{Payload})$$
- Any modification to historical records triggers instant tamper detection during audit replay.

---

## 🛠️ Local Development & Quick Start

### Prerequisites
- Node.js `v22.5.0` or higher (`v24.x` supported)
- npm `v10.x` or higher

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/Mohamed-529/TrustChain.git
cd TrustChain

# 2. Install dependencies
npm install

# 3. Build frontend assets
npm run build

# 4. Start production full-stack server
npm start
# Server listens on http://localhost:3000
```

### Running Automated Tests

```bash
npm test
```

---

## 🚀 Cloud Deployment

### 1. Deploy on Embarko (Embarko.ai Challenge #DeployWithEmbarko)
1. Sign up on [Embarko.ai](https://embarko.ai) and click **Create Project**.
2. Connect your GitHub repository: `https://github.com/Mohamed-529/TrustChain`.
3. Set Build & Run Commands:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** `PORT=3000`, `NODE_ENV=production`
4. Deploy live with instant SSL at `https://veridex.embarko.app`.

### 2. Deploy on Render (Full-Stack Blueprint)
TrustChain includes a pre-configured `render.yaml` blueprint:
1. Log into [Render.com](https://render.com) and click **New > Blueprint**.
2. Select the repository and deploy with standard Node.js runtime.

### 3. Deploy on Vercel (Edge SPA)
Configured via `vercel.json` with framework preset **Vite** and output directory `dist`.

---

## 📜 Environment Variables

Copy `.env.example` to `.env` to configure live credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
AUTH_TOKEN_SECRET=your-random-hmac-sha256-secret

# Google Gemini AI (Optional - falls back to DeterministicMockEvaluator if omitted)
GEMINI_API_KEY=your-gemini-api-key

# PayPal Orders API v2 (Optional - falls back to SANDBOX_SIMULATION if omitted)
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your-paypal-sandbox-client-id
PAYPAL_CLIENT_SECRET=your-paypal-sandbox-client-secret
PAYPAL_WEBHOOK_ID=your-paypal-webhook-id

# GitHub Provenance Verification (Optional - falls back to local git tree if omitted)
GITHUB_TOKEN=your-github-personal-access-token
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
