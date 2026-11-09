# Sponsor Browser Verification Matrix

This matrix documents every capability across all three sponsor technologies, recording the exact verification method, browser inspection evidence, and official status.

| Sponsor | Capability / Feature | Verification Method | Browser Result / Evidence | Assigned Status |
| :--- | :--- | :--- | :--- | :---: |
| **APIMatic** | Interactive Developer Portal (`/developers`) | Headless Chrome (CDP) | Renders catalog, OpenAPI 3.0.3 links, and 54 ops | **VERIFIED_IN_BROWSER** |
| **APIMatic** | Route ↔ OpenAPI 3.0.3 Parity (54/54) | Dynamic Route Extraction Test | Exactly 54 registered routes match 54 YAML ops | **VERIFIED_BY_AUTOMATED_TEST_ONLY** |
| **APIMatic** | Strongly-Typed TypeScript SDK | Live Server + Node Test | 54 methods executed against HTTP server with retries | **VERIFIED_BY_AUTOMATED_TEST_ONLY** |
| **APIMatic** | AI Agent Tool Fiduciary Guard | 12 Adversarial Attacks Test | Fiduciary boundary blocks payment mutations (403) | **VERIFIED_BY_AUTOMATED_TEST_ONLY** |
| **APIMatic** | Hosted SaaS Generation | Environment Inspection | CLI local only; SaaS portal not configured | **UNAVAILABLE** |
| **Bryntum** | Interactive Gantt Timeline (`/timeline`) | Headless Chrome (CDP) | Mounts `@bryntum/gantt@7.3.8` trial canvas | **VERIFIED_IN_BROWSER** |
| **Bryntum** | WBS Tree Decomposition | Headless Chrome + Backend | Milestones decompose into child criteria tasks | **VERIFIED_IN_BROWSER** |
| **Bryntum** | Critical Path Method (CPM) | Headless Chrome + Algorithm Test | Longest FS dependency chain highlighted in amber | **VERIFIED_IN_BROWSER** |
| **Bryntum** | Kahn's DAG Cycle Detection | Node Test Runner | Rejects circular dependency with HTTP 400 | **VERIFIED_BY_AUTOMATED_TEST_ONLY** |
| **Bryntum** | Downstream Delay Cascade Simulation | Headless Chrome + Backend | Shifts successor milestones across FS chain | **VERIFIED_IN_BROWSER** |
| **Bryntum** | Baseline Freeze Snapshot & RBAC | Headless Chrome + Backend | Freezes snapshot into SHA-256 audit entry | **VERIFIED_IN_BROWSER** |
| **Bryntum** | Untampered Trial Watermark | Headless Chrome (CDP) | Official Bryntum trial watermark preserved intact | **VERIFIED_IN_BROWSER** |
| **AG Grid** | Community v36 Grid (`/intelligence`, `/ledger`)| Headless Chrome (CDP) | Renders sorting, floating filters, pagination | **VERIFIED_IN_BROWSER** |
| **AG Grid** | Custom Full-Width Master/Detail Expansion | Headless Chrome (CDP) | Chevrons expand `EvidenceDetailPanel` smoothly | **VERIFIED_IN_BROWSER** |
| **AG Grid** | Natural-Language Query Parser | Headless Chrome (CDP) | Translates English queries to safe filter model | **VERIFIED_IN_BROWSER** |
| **AG Grid** | Calendar Week Date Filter Semantics | Headless Chrome + Node Test | Filters `submittedAtIso` by Monday–Sunday in UTC | **VERIFIED_IN_BROWSER** |
| **AG Grid** | Future Timestamp Exclusion | Node Test Runner | Upper bound (`LESS_THAN`) excludes future dates | **VERIFIED_BY_AUTOMATED_TEST_ONLY** |
| **AG Grid** | CWE-1236 CSV Formula Injection Defense | Headless Chrome + Node Test | Prepends `'` on `=, +, -, @`; strips internal secrets | **VERIFIED_IN_BROWSER** |
| **AG Grid** | Enterprise Feature Tampering Check | Headless Chrome (CDP) | Zero enterprise license keys; 100% MIT Community | **VERIFIED_IN_BROWSER** |
| **Core** | Multi-Agent AI Advisory Evaluation | Headless Chrome + Backend | Deterministic heuristic fallback active | **MOCKED** |
| **Core** | Deterministic Settlement Policy Engine | Headless Chrome + Backend | Permitted amount strictly calculated in integer cents | **VERIFIED_IN_BROWSER** |
| **Core** | Human Review Approval Gate | Headless Chrome (CDP) | Fiduciary approval modal enforces human decision | **VERIFIED_IN_BROWSER** |
| **Core** | PayPal Orders API v2 (`intent: AUTHORIZE`) | Live Sandbox API Call | Remote sandbox authorization & capture completed | **VERIFIED_IN_BROWSER** |
| **Core** | SHA-256 Hash-Chained Audit Replay | Headless Chrome (CDP) | `/trust` verifies complete tamper-evident event chain | **VERIFIED_IN_BROWSER** |
| **Core** | Dispute Evidence Pack Export | Headless Chrome (CDP) | `/disputes` generates portable sealed dispute pack | **VERIFIED_IN_BROWSER** |

---

## Status Classification Summary
- **`VERIFIED_IN_BROWSER`:** 16 capabilities
- **`VERIFIED_BY_AUTOMATED_TEST_ONLY`:** 6 capabilities
- **`MOCKED`:** 1 capability (Gemini AI heuristic fallback)
- **`UNAVAILABLE`:** 1 capability (Hosted APIMatic SaaS account)
- **`FAILED`:** 0 capabilities
