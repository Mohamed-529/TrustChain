import type {
  ContractPolicyRules,
  EvaluationRun,
  Milestone,
  PolicyCalculationResult,
} from '../../types/domain.ts';
import type { ContractRepository, MilestoneRepository } from '../repositories/DomainRepositories.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const POLICY_ENGINE_VERSION = 'policy-engine-v1.1.0';

export interface SettlementPolicyInput {
  agreedAmountCents: number;
  deadlineIso: string;
  submittedAtIso: string;
  policyRules: ContractPolicyRules;
  verifiedCriteriaCount: number;
  totalCriteriaCount: number;
  missingEvidenceCount?: number;
  ciBuildPassed: boolean;
  criticalVulnCount: number;
  highVulnCount: number;
  scannerStatus: 'AVAILABLE' | 'UNAVAILABLE';
  promptInjectionDetected?: boolean;
}

/**
 * Dedicated Deterministic Settlement Policy Engine (`SettlementPolicyService`).
 *
 * Financial Safety Rules:
 * - Pure deterministic integer-cent arithmetic (`Math.floor` / `Math.trunc`).
 * - Never accepts or trusts AI recommendation strings (`PASS`, `FAIL`, `RECOMMEND_APPROVAL`).
 * - Blocks payment when mandatory evidence, CI gates, or security gates fail.
 * - Rejects any amount exceeding the milestone budget (`agreedAmountCents`) or permitted cap (`permittedAmountCents`).
 */
export class SettlementPolicyService {
  private readonly contractRepo?: ContractRepository;
  private readonly milestoneRepo?: MilestoneRepository;

  constructor(contractRepo?: ContractRepository, milestoneRepo?: MilestoneRepository) {
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
  }

  public calculatePolicy(input: SettlementPolicyInput): PolicyCalculationResult {
    const {
      agreedAmountCents,
      deadlineIso,
      submittedAtIso,
      policyRules,
      verifiedCriteriaCount,
      totalCriteriaCount,
      missingEvidenceCount = 0,
      ciBuildPassed,
      criticalVulnCount,
      highVulnCount,
      scannerStatus,
      promptInjectionDetected = false,
    } = input;

    if (!Number.isInteger(agreedAmountCents) || agreedAmountCents <= 0) {
      throw new AppError(
        400,
        'INVALID_MILESTONE_BUDGET_CENTS',
        'Milestone agreedAmountCents must be a positive integer in cents.'
      );
    }

    if (!Number.isInteger(totalCriteriaCount) || totalCriteriaCount < 1) {
      throw new AppError(
        400,
        'INVALID_CRITERIA_COUNT',
        'totalCriteriaCount must be a positive integer >= 1.'
      );
    }

    if (
      !Number.isInteger(verifiedCriteriaCount) ||
      verifiedCriteriaCount < 0 ||
      verifiedCriteriaCount > totalCriteriaCount
    ) {
      throw new AppError(
        400,
        'INVALID_VERIFIED_CRITERIA_COUNT',
        `verifiedCriteriaCount (${verifiedCriteriaCount}) must be an integer between 0 and totalCriteriaCount (${totalCriteriaCount}).`
      );
    }

    const safeTotal = totalCriteriaCount;
    const safeVerified = verifiedCriteriaCount;
    const verifiedCriteriaRatio = Number((safeVerified / safeTotal).toFixed(4));

    const gatesTripped: string[] = [];

    if (promptInjectionDetected) {
      gatesTripped.push(
        'GATE_PROMPT_INJECTION_DETECTED: Adversarial prompt injection detected in submitted evidence.'
      );
    }

    if (policyRules.requirePassingCi && !ciBuildPassed) {
      gatesTripped.push('GATE_CI_BUILD_FAILED: Mandatory passing CI build requirement was not met.');
    }

    if (policyRules.requireSecurityScan && scannerStatus !== 'AVAILABLE') {
      gatesTripped.push(
        'GATE_SECURITY_SCANNER_UNAVAILABLE: Mandatory dependency security scan artifact is missing or unavailable.'
      );
    }

    if (criticalVulnCount > policyRules.maxAllowedCriticalVulns) {
      gatesTripped.push(
        `GATE_CRITICAL_VULNS_EXCEEDED: Critical vulnerabilities (${criticalVulnCount}) exceed contractual limit (${policyRules.maxAllowedCriticalVulns}).`
      );
    }

    if (highVulnCount > policyRules.maxAllowedHighVulns) {
      gatesTripped.push(
        `GATE_HIGH_VULNS_EXCEEDED: High vulnerabilities (${highVulnCount}) exceed contractual limit (${policyRules.maxAllowedHighVulns}).`
      );
    }

    if (!policyRules.allowPartialPayout && (safeVerified < safeTotal || missingEvidenceCount > 0)) {
      gatesTripped.push(
        `GATE_PARTIAL_DELIVERY_DISALLOWED: Contract requires 100% acceptance criteria completion (${safeVerified}/${safeTotal} verified, ${missingEvidenceCount} missing evidence items).`
      );
    }

    if (safeVerified === 0) {
      gatesTripped.push(
        `GATE_MANDATORY_EVIDENCE_MISSING: Zero acceptance criteria verified (0/${safeTotal}).`
      );
    }

    const deadlineMs = Date.parse(deadlineIso);
    const submittedMs = Date.parse(submittedAtIso);
    let lateDays = 0;
    if (!Number.isNaN(deadlineMs) && !Number.isNaN(submittedMs) && submittedMs > deadlineMs) {
      lateDays = Math.ceil((submittedMs - deadlineMs) / (1000 * 60 * 60 * 24));
    }

    const gateBlocked = gatesTripped.length > 0;
    const grossEligibleCents = Math.floor((agreedAmountCents * safeVerified) / safeTotal);
    const unverifiedDeductionCents = agreedAmountCents - grossEligibleCents;

    const rawPenaltyCents = Math.floor(
      (agreedAmountCents * lateDays * policyRules.latePenaltyDailyBps) / 10000
    );
    const latePenaltyCents = gateBlocked ? 0 : Math.min(grossEligibleCents, rawPenaltyCents);

    const permittedAmountCents = gateBlocked
      ? 0
      : Math.max(0, Math.min(agreedAmountCents, grossEligibleCents - latePenaltyCents));

    const deductionCents = agreedAmountCents - permittedAmountCents;

    const formulaExplanation = gateBlocked
      ? `Blocked ($0.00 permitted): Mandatory policy gate(s) tripped [${gatesTripped.join(' | ')}].`
      : `Agreed ${agreedAmountCents}c * (${safeVerified}/${safeTotal} verified) = ${grossEligibleCents}c gross (-${unverifiedDeductionCents}c unverified deduction) - ${latePenaltyCents}c late penalty (${lateDays}d @ ${policyRules.latePenaltyDailyBps} bps/day) = ${permittedAmountCents}c permitted maximum.`;

    return {
      engineVersion: POLICY_ENGINE_VERSION,
      agreedAmountCents,
      verifiedCriteriaRatio,
      grossEligibleCents,
      deductionCents,
      gatesTripped,
      blockingReasons: [...gatesTripped],
      gateBlocked,
      lateDays,
      latePenaltyCents,
      permittedAmountCents,
      currency: 'USD',
      formulaExplanation,
    };
  }

  /**
   * Validates a proposed human-approved payout amount against both the milestone budget
   * and the deterministic policy calculation.
   */
  public validateApprovedAmount(params: {
    milestone: Milestone;
    policyCalculation: PolicyCalculationResult;
    approvedAmountCents: number;
  }): void {
    const { milestone, policyCalculation, approvedAmountCents } = params;

    if (!Number.isInteger(approvedAmountCents)) {
      throw new AppError(
        400,
        'NON_INTEGER_AMOUNT_CENTS',
        'Approved amount must be an exact integer in cents (no floating-point decimals).'
      );
    }

    if (approvedAmountCents <= 0) {
      throw new AppError(
        400,
        'INVALID_APPROVAL_AMOUNT',
        'Approved amount for an APPROVE decision must be greater than 0 cents.'
      );
    }

    if (approvedAmountCents > milestone.agreedAmountCents) {
      throw new AppError(
        400,
        'AMOUNT_EXCEEDS_MILESTONE_BUDGET',
        `Approved amount (${approvedAmountCents} cents) exceeds milestone agreed budget (${milestone.agreedAmountCents} cents).`
      );
    }

    if (policyCalculation.gateBlocked || policyCalculation.permittedAmountCents === 0) {
      throw new AppError(
        422,
        'POLICY_GATE_BLOCKED',
        `Cannot approve payment because contractual policy gates are blocked: ${(
          policyCalculation.blockingReasons ?? policyCalculation.gatesTripped
        ).join(' | ')}`,
        {
          gatesTripped: policyCalculation.gatesTripped,
          permittedAmountCents: policyCalculation.permittedAmountCents,
        }
      );
    }

    if (approvedAmountCents > policyCalculation.permittedAmountCents) {
      throw new AppError(
        400,
        'AMOUNT_EXCEEDS_PERMITTED_CAP',
        `Approved amount (${approvedAmountCents} cents) exceeds the deterministic policy permitted cap (${policyCalculation.permittedAmountCents} cents).`,
        {
          approvedAmountCents,
          permittedAmountCents: policyCalculation.permittedAmountCents,
          agreedAmountCents: milestone.agreedAmountCents,
        }
      );
    }
  }

  /**
   * Re-calculates and verifies the authoritative policy cap directly from a milestone,
   * its parent contract, and its latest completed evaluation run.
   */
  public evaluateMilestonePolicy(
    milestone: Milestone,
    policyRules: ContractPolicyRules,
    evaluation: EvaluationRun,
    submittedAtIso: string
  ): PolicyCalculationResult {
    return this.calculatePolicy({
      agreedAmountCents: milestone.agreedAmountCents,
      deadlineIso: milestone.deadlineIso,
      submittedAtIso,
      policyRules,
      verifiedCriteriaCount: evaluation.evidenceAnalysis.verifiedCount,
      totalCriteriaCount: evaluation.evidenceAnalysis.totalCount,
      missingEvidenceCount: evaluation.evidenceAnalysis.missingEvidence.length,
      ciBuildPassed: evaluation.riskAnalysis.ciBuildPassed,
      criticalVulnCount: evaluation.riskAnalysis.criticalVulnCount,
      highVulnCount: evaluation.riskAnalysis.highVulnCount,
      scannerStatus: evaluation.riskAnalysis.scannerStatus,
      promptInjectionDetected: evaluation.riskAnalysis.promptInjectionDetected,
    });
  }

  public previewForMilestone(
    milestoneId: string,
    input: {
      verifiedCriteriaCount: number;
      totalCriteriaCount: number;
      ciBuildPassed: boolean;
      criticalVulnCount: number;
      highVulnCount: number;
      scannerStatus: 'AVAILABLE' | 'UNAVAILABLE';
      submittedAtIso?: string;
    }
  ): PolicyCalculationResult {
    if (!this.milestoneRepo || !this.contractRepo) {
      throw new AppError(
        500,
        'POLICY_REPOS_NOT_CONFIGURED',
        'SettlementPolicyService requires milestoneRepo and contractRepo for previewForMilestone.'
      );
    }
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }
    const contract = this.contractRepo.findById(milestone.contractId);
    if (!contract) {
      throw new AppError(
        404,
        'CONTRACT_NOT_FOUND',
        `Contract '${milestone.contractId}' was not found.`
      );
    }

    return this.calculatePolicy({
      agreedAmountCents: milestone.agreedAmountCents,
      deadlineIso: milestone.deadlineIso,
      submittedAtIso: input.submittedAtIso ?? new Date().toISOString(),
      policyRules: contract.policyRules,
      verifiedCriteriaCount: input.verifiedCriteriaCount,
      totalCriteriaCount: input.totalCriteriaCount,
      ciBuildPassed: input.ciBuildPassed,
      criticalVulnCount: input.criticalVulnCount,
      highVulnCount: input.highVulnCount,
      scannerStatus: input.scannerStatus,
    });
  }
}
