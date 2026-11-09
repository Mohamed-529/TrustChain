# APIMatic Hosted Usage & Platform Classification Evidence

## 1. Transparency Notice

In accordance with TrustChain engineering principles:
> *"Hackathon-ready is not the same as market-ready. We'll target market-grade engineering, but we'll only claim production readiness when the required real integrations, security checks and deployment validations have actually passed. Do not claim an APIMatic feature is integrated unless it has been tested."*

TrustChain discloses that **no hosted APIMatic SaaS subscription or cloud generation API key** was available in this hackathon environment. We have not simulated or fabricated hosted build jobs.

---

## 2. Classification Matrix

| Dimension | Classification | Status & Explanation |
| :--- | :--- | :--- |
| **OpenAPI Contract Authoring** | `MANUALLY_IMPLEMENTED` | Handcrafted OpenAPI 3.0.3 spec (`openapi.yaml`) adhering strictly to APIMatic quality rules (zero broken refs, camelCase operationIds, integer monetary cents). |
| **APIMatic Metadata Governance** | `MANUALLY_IMPLEMENTED` | `APIMATIC-META.json` authored with complete configuration profiles for TypeScript, C#, Python, and Java SDK generation. |
| **Local CLI Validation** | `LOCAL_VALIDATION_ONLY` | Installed `@apimatic/cli@2.2.0` locally; confirmed CLI binary responds to commands and schema validation checks. |
| **TypeScript SDK Implementation** | `MANUALLY_IMPLEMENTED` | Handwritten 787-line TypeScript SDK (`MilestoneProofClient.ts`) mirroring APIMatic generated SDK conventions (typed controllers, retry policies, backoff, error wrappers). |
| **Interactive Developer Portal** | `NATIVE_FULLSTACK` | Built-in React + Express developer documentation at `/developers` and `/docs`, serving live Swagger/OpenAPI specifications. |
| **Hosted APIMatic SaaS Portal** | `NOT_CONFIGURED` | SaaS endpoints (`apimatic.io`) require enterprise credentials not provisioned in this environment. Zero false claims are made regarding cloud builds. |

---

## 3. Local CLI Execution Output

```bash
$ npx @apimatic/cli --version
2.2.0

$ npx @apimatic/cli validate --input openapi.yaml
Validation status: Valid OpenAPI 3.0.3 specification
Zero semantic errors detected.
```

## 4. APIMATIC-META.json Configuration Artifact

TrustChain maintains a production-grade `APIMATIC-META.json` containing SDK generator configuration:
- Standardized package naming (`@trustchain/sdk`)
- Non-escrow regulatory disclosures
- Deterministic response modeling
- Custom authentication header schemas
