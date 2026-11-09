# APIMATIC AI AGENT INTEGRATION & FIDUCIARY BOUNDARIES REPORT
**Platform:** TrustChain  
**Component:** AI Agent Integration Layer & Tool Guard (`src/agent/TrustChainAgentTools.ts`)  
**Specification Alignment:** OpenAPI 3.0.3 & `APIMATIC-META.json`  
**Date:** November 9, 2026  

---

## 1. Executive Summary

As AI coding assistants and autonomous agents (Gemini, Claude, GPT, Antigravity) increasingly interact with enterprise APIs, traditional OpenAPI specifications must be augmented with **machine-readable tool manifests** and **fiduciary governance boundaries**.

Exposing an API directly to an autonomous agent without access boundaries is dangerous in a financial settlement workflow. TrustChain introduces a dedicated **AI Agent Integration Layer** ([`src/agent/TrustChainAgentTools.ts`](file:///c:/Users/ADMIN/Downloads/milestoneproof-ai/src/agent/TrustChainAgentTools.ts)) derived directly from the OpenAPI 3.0.3 contract.

---

## 2. Three-Tier Tool Classification Matrix

Every TrustChain API capability is classified into one of three strict governance tiers:

```
+-----------------------------------------------------------------------------------+
|                        TRUSTCHAIN AGENT TOOL GOVERNANCE                           |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ TIER 1: SAFE READ-ONLY TOOLS ]                                                 |
|  - Autonomous AI invocation: PERMITTED                                            |
|  - Examples: trustchain_get_contract, trustchain_get_schedule,                     |
|              trustchain_get_evidence_passport, trustchain_verify_audit_chain,     |
|              trustchain_get_dispute_pack, trustchain_get_downstream_impact         |
|                                                                                   |
|  [ TIER 2: SENSITIVE HUMAN GATES ]                                                |
|  - Autonomous AI invocation: REQUIRES HUMAN CREDENTIALS                           |
|  - Examples: trustchain_submit_evidence (Developer role required),                |
|              trustchain_capture_schedule_baseline (Client role required)          |
|                                                                                   |
|  [ TIER 3: BLOCKED FINANCIAL ACTIONS ]                                            |
|  - Autonomous AI invocation: STRICTLY FORBIDDEN (Rule #1)                        |
|  - Examples: trustchain_approve_milestone_review,                                 |
|              trustchain_capture_paypal_payment,                                    |
|              trustchain_authorize_paypal                                          |
|  - Result: Programmatic 403 Forbidden with zero database mutation                |
+-----------------------------------------------------------------------------------+
```

---

## 3. Financial Safety Rule #1 Enforcement

In strict accordance with `AGENTS.md`:
> *"No AI agent may directly capture, transfer or void payments. Human approval is mandatory before capture."*

The tool dispatcher enforces this rule programmatically before any network request or database operation can occur:

```typescript
// Enforced in executeAgentToolCall()
if (isAutonomousAgent && toolDef.forbiddenToAutonomousAgents) {
  return {
    toolName,
    status: 'FORBIDDEN',
    error: {
      code: 'FORBIDDEN_AUTONOMOUS_FINANCIAL_ACTION',
      message: `AI Agent Tool Call Rejected: '${toolName}' is a restricted fiduciary action. ${toolDef.governanceNote}`,
      statusCode: 403,
    },
    fiduciaryBoundaryEnforced: true,
  };
}
```

---

## 4. Machine-Readable Function Calling Schemas

Tools are structured for direct consumption by Gemini, Anthropic Claude, and OpenAI tool APIs. Example schema for `trustchain_get_evidence_passport`:

```json
{
  "name": "trustchain_get_evidence_passport",
  "category": "SAFE_READ_ONLY",
  "description": "Retrieve cryptographic Evidence Passport with Git commit signatures, CI telemetry, and SLSA provenance.",
  "parameters": {
    "type": "object",
    "properties": {
      "milestoneId": {
        "type": "string",
        "description": "Milestone ID to retrieve passport for."
      },
      "contractId": {
        "type": "string",
        "description": "Optional contract ID for scoped lookup."
      }
    },
    "required": ["milestoneId"]
  },
  "requiresHumanApproval": false,
  "forbiddenToAutonomousAgents": false,
  "governanceNote": "Read-only cryptographic delivery evidence."
}
```

---

## 5. Automated Verification Evidence

The agent integration layer was tested under adversarial conditions in `src/server/__tests__/apimatic_contract_excellence.test.ts` (Test 5):
1. **Catalog Integrity:** `assert.ok(TRUSTCHAIN_AGENT_TOOLS.length >= 8)` — Passed.
2. **Safe Read Execution:** `executeAgentToolCall('trustchain_get_system_health', {}, client, true)` returned `status: 'SUCCESS'` with `fiduciaryBoundaryEnforced: true`.
3. **Autonomous Approval Block:** `executeAgentToolCall('trustchain_approve_milestone_review', { milestoneId: 'ms_seed_01' }, client, true)` returned `status: 'FORBIDDEN'`, code `FORBIDDEN_AUTONOMOUS_FINANCIAL_ACTION`, HTTP status `403`.
4. **Autonomous Capture Block:** `executeAgentToolCall('trustchain_capture_paypal_payment', { milestoneId: 'ms_seed_01' }, client, true)` returned `status: 'FORBIDDEN'`, code `FORBIDDEN_AUTONOMOUS_FINANCIAL_ACTION`, HTTP status `403`.

---

## 6. Conclusion

TrustChain sets a new standard for AI-agent-ready API integration. By combining APIMatic's rigorous OpenAPI contract standards with explicit fiduciary boundaries, TrustChain enables autonomous AI inspection without relinquishing financial safety.
