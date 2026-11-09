# Demo Limitations, Mocks & Platform Classification Disclosures

In accordance with TrustChain engineering principles:
> *"Hackathon-ready is not the same as market-ready. We'll target market-grade engineering, but we'll only claim production readiness when the required real integrations, security checks and deployment validations have actually passed. Do not use fake data as proof of a real integration."*

This document discloses every mock, simulated capability, and licensing limitation in the application.

---

## 1. Mocks & Simulation Disclosures

| Component / Service | Operational State | Reason for Mock / Simulation | Security & Invariant Impact |
| :--- | :---: | :--- | :--- |
| **Gemini AI Advisory Workflow** | `MOCKED` | No `GEMINI_API_KEY` was configured in `.env`. TrustChain automatically used its built-in deterministic heuristic evaluation engine. | **Zero financial impact.** AI advisory output is strictly non-binding and non-fiduciary under Financial Safety Rule #1. |
| **Hosted APIMatic SaaS Portal** | `UNAVAILABLE` | Enterprise SaaS API keys for hosted builds (`apimatic.io`) were not provisioned. | **Zero code impact.** Handcrafted OpenAPI 3.0.3 spec, metadata, and TypeScript SDK adhere 100% to APIMatic standards and were locally verified. |
| **PayPal Sandbox Simulation Mode** | `AVAILABLE` | In addition to live sandbox REST calls, a deterministic sandbox simulation mode exists for offline verification without internet access. | **Preserved.** Integer cents, idempotency, human approval gates, and non-escrow notices are enforced identically in both live and simulation modes. |

---

## 2. Sponsor Licensing Disclosures

| Sponsor | Package & Version | License Type | Compliance Notes |
| :--- | :--- | :--- | :--- |
| **AG Grid** | `ag-grid-community@36.3.0` | MIT Open Source | 100% free and compliant. Zero Enterprise license keys used. Master/Detail expansion is built using Community extension points (`fullWidthCellRenderer`). |
| **Bryntum** | `@bryntum/gantt@7.3.8` (trial) | 45-day Trial / Evaluation | Official trial package installed from npm registry. Trial watermark and license notices are **100% untampered** with zero CSS hiding. |
| **APIMatic** | `@apimatic/cli@2.2.0` | Evaluation / CLI | Local CLI installed. Spec generation and validation executed locally. |

---

## 3. Production Readiness Upgrade Path

To transition TrustChain from hackathon demonstration to live enterprise production:
1. **Bryntum:** Purchase commercial license and configure private npm registry token in `.npmrc`.
2. **APIMatic:** Provision hosted APIMatic portal workspace to enable cloud SDK generation across Java, C#, and Python.
3. **Gemini:** Add production `GEMINI_API_KEY` into secure secrets manager (AWS Secrets Manager / Vault) to activate live LLM function calling.
4. **PayPal:** Switch `PAYPAL_ENV=production` and register live merchant webhook URL.
