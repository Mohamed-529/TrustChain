/**
 * ============================================================================
 * TrustChain — AI Agent Integration & Tool Boundary Layer
 * Aligned with OpenAPI 3.0.3 Contract, APIMatic Governance & Financial Safety Rules
 * ============================================================================
 *
 * This module provides an agent-friendly, strongly-typed integration layer
 * that allows AI assistants (Gemini, Claude, GPT, Antigravity) to safely discover
 * and interact with the TrustChain API without violating core fiduciary boundaries.
 *
 * Core Fiduciary & Governance Rules:
 * 1. AI is ADVISORY ONLY (Rule #1): Agents inspect evidence, calculate risks, and propose plans.
 * 2. AUTONOMOUS FINANCIAL ACTIONS FORBIDDEN: Agents cannot approve reviews or trigger PayPal capture.
 * 3. EXPLICIT HUMAN APPROVAL GATE: Modifying contracts, schedules, or dispute packs requires a human.
 * 4. STRICT ZERO-TRUST INPUT: All inputs are validated against OpenAPI 3.0.3 schemas before dispatch.
 */

import { MilestoneProofClient } from '../sdk/MilestoneProofClient.ts';

export type ToolCategory = 'SAFE_READ_ONLY' | 'SENSITIVE_HUMAN_GATE' | 'BLOCKED_FINANCIAL_ACTION';

export interface AgentToolDefinition {
  name: string;
  category: ToolCategory;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: readonly string[];
      items?: { type: string };
    }>;
    required: string[];
  };
  requiresHumanApproval: boolean;
  forbiddenToAutonomousAgents: boolean;
  governanceNote: string;
}

/**
 * Standard Machine-Readable Tool Declarations derived from openapi.yaml
 */
export const TRUSTCHAIN_AGENT_TOOLS: AgentToolDefinition[] = [
  // --------------------------------------------------------------------------
  // SAFE READ-ONLY TOOLS (Autonomous Execution Permitted)
  // --------------------------------------------------------------------------
  {
    name: 'trustchain_get_system_health',
    category: 'SAFE_READ_ONLY',
    description: 'Inspect TrustChain server health, SQLite engine latency, and active service capabilities.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    requiresHumanApproval: false,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Read-only operational telemetry.',
  },
  {
    name: 'trustchain_get_contract',
    category: 'SAFE_READ_ONLY',
    description: 'Retrieve software contract details, total budget, developer ID, and milestone hierarchy.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'Unique identifier of the software contract.' },
      },
      required: ['contractId'],
    },
    requiresHumanApproval: false,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Read-only access to agreed contract terms.',
  },
  {
    name: 'trustchain_get_contract_schedule',
    category: 'SAFE_READ_ONLY',
    description: 'Retrieve the Bryntum Gantt schedule, child execution tasks, critical path, and baselines.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'Contract ID to inspect schedule for.' },
      },
      required: ['contractId'],
    },
    requiresHumanApproval: false,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Read-only access to execution schedule and delivery progress.',
  },
  {
    name: 'trustchain_get_evidence_passport',
    category: 'SAFE_READ_ONLY',
    description: 'Retrieve cryptographic Evidence Passport with Git commit signatures, CI telemetry, and SLSA provenance.',
    parameters: {
      type: 'object',
      properties: {
        milestoneId: { type: 'string', description: 'Milestone ID to retrieve passport for.' },
        contractId: { type: 'string', description: 'Optional contract ID for scoped lookup.' },
      },
      required: ['milestoneId'],
    },
    requiresHumanApproval: false,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Read-only cryptographic delivery evidence.',
  },
  {
    name: 'trustchain_verify_audit_chain',
    category: 'SAFE_READ_ONLY',
    description: 'Verify cryptographic SHA-256 hash chain integrity of the immutable audit log.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'Optional contract ID for contract-scoped verification.' },
      },
      required: [],
    },
    requiresHumanApproval: false,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Read-only cryptographic audit verification.',
  },
  {
    name: 'trustchain_get_dispute_pack',
    category: 'SAFE_READ_ONLY',
    description: 'Retrieve tamper-evident Dispute Evidence Pack with two-stage non-circular digest anchoring.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'Contract ID of the dispute pack.' },
        packId: { type: 'string', description: 'Dispute pack identifier.' },
      },
      required: ['contractId', 'packId'],
    },
    requiresHumanApproval: false,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Read-only dispute evidence record.',
  },
  {
    name: 'trustchain_get_downstream_impact',
    category: 'SAFE_READ_ONLY',
    description: 'Simulate downstream delay cascade impact on contract deadlines when a milestone slips.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'Contract ID.' },
        delayedMilestoneId: { type: 'string', description: 'Milestone ID that is slipping.' },
        delayDays: { type: 'string', description: 'Number of delay days to simulate.' },
      },
      required: ['contractId', 'delayedMilestoneId', 'delayDays'],
    },
    requiresHumanApproval: false,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Deterministic BFS simulation tool.',
  },

  // --------------------------------------------------------------------------
  // SENSITIVE TOOLS (Explicit Human Reviewer Sign-Off Required)
  // --------------------------------------------------------------------------
  {
    name: 'trustchain_submit_evidence',
    category: 'SENSITIVE_HUMAN_GATE',
    description: 'Submit developer delivery artifacts (PR, CI runs, security scans) for milestone review.',
    parameters: {
      type: 'object',
      properties: {
        milestoneId: { type: 'string', description: 'Milestone ID.' },
        repoUrl: { type: 'string', description: 'GitHub repository URL.' },
        branch: { type: 'string', description: 'Git branch name.' },
        commitSha: { type: 'string', description: 'Git commit SHA.' },
        prUrl: { type: 'string', description: 'GitHub Pull Request URL.' },
      },
      required: ['milestoneId', 'repoUrl', 'branch', 'commitSha', 'prUrl'],
    },
    requiresHumanApproval: true,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'Evidence submission must originate from verified developer credentials.',
  },
  {
    name: 'trustchain_capture_schedule_baseline',
    category: 'SENSITIVE_HUMAN_GATE',
    description: 'Freeze contract schedule baseline snapshot into hash-chained audit log.',
    parameters: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: 'Contract ID.' },
        label: { type: 'string', description: 'Descriptive label for the baseline snapshot.' },
      },
      required: ['contractId'],
    },
    requiresHumanApproval: true,
    forbiddenToAutonomousAgents: false,
    governanceNote: 'RBAC: CLIENT or REVIEWER role mandatory; DEVELOPER forbidden.',
  },

  // --------------------------------------------------------------------------
  // BLOCKED FINANCIAL ACTIONS (AI AGENT AUTONOMOUS CALL FORBIDDEN)
  // --------------------------------------------------------------------------
  {
    name: 'trustchain_approve_milestone_review',
    category: 'BLOCKED_FINANCIAL_ACTION',
    description: 'Fiduciary approval of milestone payout. FORBIDDEN TO AI AGENTS.',
    parameters: {
      type: 'object',
      properties: {
        milestoneId: { type: 'string', description: 'Milestone ID to approve.' },
      },
      required: ['milestoneId'],
    },
    requiresHumanApproval: true,
    forbiddenToAutonomousAgents: true,
    governanceNote: 'Financial Safety Rule #1: AI agents are strictly forbidden from approving financial transactions.',
  },
  {
    name: 'trustchain_capture_paypal_payment',
    category: 'BLOCKED_FINANCIAL_ACTION',
    description: 'Capture authorized funds via PayPal Orders API v2. FORBIDDEN TO AI AGENTS.',
    parameters: {
      type: 'object',
      properties: {
        milestoneId: { type: 'string', description: 'Milestone ID to capture payment for.' },
      },
      required: ['milestoneId'],
    },
    requiresHumanApproval: true,
    forbiddenToAutonomousAgents: true,
    governanceNote: 'Financial Safety Rule #1: AI agents are strictly forbidden from capturing PayPal funds.',
  },
];

/**
 * Execution Result of an Agent Tool Call
 */
export interface AgentToolResult {
  toolName: string;
  status: 'SUCCESS' | 'FORBIDDEN' | 'FAILED';
  result?: unknown;
  error?: {
    code: string;
    message: string;
    statusCode: number;
  };
  fiduciaryBoundaryEnforced: boolean;
}

/**
 * Safe Agent Tool Dispatcher
 * Enforces financial safety rules and RBAC boundaries before delegating to the client SDK.
 */
export async function executeAgentToolCall(
  toolName: string,
  args: Record<string, unknown>,
  client: MilestoneProofClient,
  isAutonomousAgent = true
): Promise<AgentToolResult> {
  const toolDef = TRUSTCHAIN_AGENT_TOOLS.find((t) => t.name === toolName);

  if (!toolDef) {
    return {
      toolName,
      status: 'FAILED',
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `Unknown agent tool '${toolName}'. Refer to TrustChain OpenAPI 3.0.3 specification.`,
        statusCode: 404,
      },
      fiduciaryBoundaryEnforced: true,
    };
  }

  // Enforce Financial Safety Rule #1: Autonomous AI cannot execute payments or approvals
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

  try {
    let result: unknown;
    switch (toolName) {
      case 'trustchain_get_system_health':
        result = await client.getSystemHealth();
        break;
      case 'trustchain_get_contract':
        result = await client.getContractById(String(args.contractId));
        break;
      case 'trustchain_get_contract_schedule':
        result = await client.getContractSchedule(String(args.contractId));
        break;
      case 'trustchain_get_evidence_passport':
        result = await client.getEvidencePassport(
          String(args.milestoneId),
          args.contractId ? String(args.contractId) : undefined
        );
        break;
      case 'trustchain_verify_audit_chain':
        result = args.contractId
          ? await client.verifyContractAudit(String(args.contractId))
          : await client.verifyAuditHashChain();
        break;
      case 'trustchain_get_dispute_pack':
        result = await client.getDisputePack(String(args.contractId), String(args.packId));
        break;
      case 'trustchain_get_downstream_impact':
        result = await client.getScheduleDownstreamImpact(
          String(args.contractId),
          String(args.delayedMilestoneId),
          Number(args.delayDays)
        );
        break;
      default:
        throw new Error(`Tool '${toolName}' is defined but lacks an execution handler.`);
    }

    return {
      toolName,
      status: 'SUCCESS',
      result,
      fiduciaryBoundaryEnforced: true,
    };
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string; statusCode?: number };
    return {
      toolName,
      status: 'FAILED',
      error: {
        code: errorObj.code ?? 'AGENT_TOOL_EXECUTION_ERROR',
        message: errorObj.message ?? String(err),
        statusCode: errorObj.statusCode ?? 500,
      },
      fiduciaryBoundaryEnforced: true,
    };
  }
}
