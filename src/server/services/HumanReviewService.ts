import crypto from 'node:crypto';
import type {
  FinancialLedgerRow,
  HumanApprovalRecord,
  HumanReviewActionInputDecision,
  HumanReviewDecision,
  MilestoneReviewDetails,
  MilestoneStatus,
  User,
} from '../../types/domain.ts';
import type { AppDatabase } from '../repositories/Database.ts';
import type {
  ContractRepository,
  EvaluationRepository,
  EvidenceRepository,
  HumanApprovalRepository,
  MilestoneRepository,
  PaymentTransactionRepository,
} from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import {
  POLICY_ENGINE_VERSION,
  SettlementPolicyService,
} from './SettlementPolicyService.ts';
import { AppError } from '../middleware/errorHandler.ts';

export class HumanReviewService {
  private readonly db: AppDatabase;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly evidenceRepo: EvidenceRepository;
  private readonly evaluationRepo: EvaluationRepository;
  private readonly approvalRepo: HumanApprovalRepository;
  private readonly settlementPolicyService: SettlementPolicyService;
  private readonly auditService: AuditService;
  private readonly paymentRepo?: PaymentTransactionRepository;
  private readonly activeReviewLocks = new Set<string>();

  constructor(
    db: AppDatabase,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    evidenceRepo: EvidenceRepository,
    evaluationRepo: EvaluationRepository,
    approvalRepo: HumanApprovalRepository,
    settlementPolicyService: SettlementPolicyService,
    auditService: AuditService,
    paymentRepo?: PaymentTransactionRepository
  ) {
    this.db = db;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.evidenceRepo = evidenceRepo;
    this.evaluationRepo = evaluationRepo;
    this.approvalRepo = approvalRepo;
    this.settlementPolicyService = settlementPolicyService;
    this.auditService = auditService;
    this.paymentRepo = paymentRepo;
  }

  private toStateMachineStatus(status: MilestoneStatus): MilestoneStatus | 'NEEDS_CHANGES' {
    return status === 'REVISION_REQUESTED' ? 'NEEDS_CHANGES' : status;
  }

  public getMilestoneReviewDetails(milestoneId: string): MilestoneReviewDetails {
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }

    const fullContract = this.contractRepo.findById(milestone.contractId);
    if (!fullContract) {
      throw new AppError(
        404,
        'CONTRACT_NOT_FOUND',
        `Contract '${milestone.contractId}' was not found.`
      );
    }

    const { milestones: _omittedMilestones, ...contract } = fullContract;
    const latestSubmission = this.evidenceRepo.findLatestByMilestoneId(milestoneId);
    const latestEvaluation = this.evaluationRepo.findLatestByMilestoneId(milestoneId);
    const approvals = this.approvalRepo.listByMilestoneId(milestoneId);

    const hasValidEvaluationForLatestSubmission = Boolean(
      latestSubmission &&
        latestEvaluation &&
        latestEvaluation.status === 'COMPLETED' &&
        latestEvaluation.submissionId === latestSubmission.id
    );

    const policyCalculation =
      hasValidEvaluationForLatestSubmission && latestEvaluation && latestSubmission
        ? this.settlementPolicyService.evaluateMilestonePolicy(
            milestone,
            contract.policyRules,
            latestEvaluation,
            latestSubmission.submittedAt
          )
        : null;

    const blockingReasons: string[] = [];
    if (milestone.status === 'APPROVED' || milestone.status === 'SETTLED') {
      blockingReasons.push(`Milestone is already finalized in '${milestone.status}' state.`);
    } else if (milestone.status === 'REJECTED') {
      blockingReasons.push('Milestone has been permanently REJECTED.');
    } else if (milestone.status !== 'PENDING_REVIEW' || !hasValidEvaluationForLatestSubmission) {
      blockingReasons.push(
        'Milestone requires a completed multi-agent evaluation on the latest evidence submission before human review.'
      );
    } else if (policyCalculation && policyCalculation.gateBlocked) {
      blockingReasons.push(...policyCalculation.gatesTripped);
    }

    const isReviewableState =
      milestone.status === 'PENDING_REVIEW' && hasValidEvaluationForLatestSubmission;

    const canApprove = Boolean(
      isReviewableState &&
        policyCalculation &&
        !policyCalculation.gateBlocked &&
        policyCalculation.permittedAmountCents > 0
    );

    return {
      contract,
      milestone,
      stateMachineStatus: this.toStateMachineStatus(milestone.status),
      latestSubmission,
      latestEvaluation,
      policyCalculation,
      approvals,
      allowedActions: {
        canApprove,
        canReject: isReviewableState,
        canRequestChanges: isReviewableState,
        maxPermittedAmountCents: policyCalculation?.permittedAmountCents ?? 0,
        blockingReasons,
      },
    };
  }

  public submitReview(
    actor: User,
    milestoneId: string,
    rawInput: unknown
  ): {
    approval: HumanApprovalRecord;
    milestoneStatus: MilestoneStatus;
    stateMachineStatus: MilestoneStatus | 'NEEDS_CHANGES';
  } {
    if (this.activeReviewLocks.has(milestoneId)) {
      throw new AppError(
        409,
        'CONCURRENT_REVIEW_IN_PROGRESS',
        `Another review operation is already in progress for milestone '${milestoneId}'.`
      );
    }

    this.activeReviewLocks.add(milestoneId);

    try {
      return this.db.withTransaction(() => {
        const milestone = this.milestoneRepo.findById(milestoneId);
        if (!milestone) {
          throw new AppError(
            404,
            'MILESTONE_NOT_FOUND',
            `Milestone '${milestoneId}' was not found.`
          );
        }

        const contract = this.contractRepo.findById(milestone.contractId);
        if (!contract) {
          throw new AppError(
            404,
            'CONTRACT_NOT_FOUND',
            `Contract '${milestone.contractId}' was not found.`
          );
        }

        // 1. Separation of Duties: Developer can NEVER approve or review their own work
        if (actor.id === contract.developerId || actor.role === 'DEVELOPER') {
          throw new AppError(
            403,
            'SELF_APPROVAL_FORBIDDEN',
            `Separation-of-duties violation: Developer '${actor.id}' cannot review or approve milestone '${milestoneId}'.`
          );
        }

        // 2. Role & Contract Authorization Check
        if (actor.role !== 'REVIEWER' && actor.role !== 'CLIENT') {
          throw new AppError(
            403,
            'FORBIDDEN_ROLE',
            `Only authorized REVIEWER or CLIENT roles may submit human review decisions.`
          );
        }

        if (actor.id !== contract.reviewerId && actor.id !== contract.clientId) {
          throw new AppError(
            403,
            'FORBIDDEN_NOT_AUTHORIZED_REVIEWER',
            `Actor '${actor.id}' is neither the designated reviewer ('${contract.reviewerId}') nor the client ('${contract.clientId}') for contract '${contract.id}'.`
          );
        }

        // 3. Validate input payload structure
        if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
          throw new AppError(400, 'INVALID_REVIEW_PAYLOAD', 'Review payload must be a JSON object.');
        }

        const inputObj = rawInput as Record<string, unknown>;
        const rawDecision = String(inputObj.decision ?? '').trim() as HumanReviewActionInputDecision;
        const validDecisions = new Set([
          'APPROVE',
          'REQUEST_REVISIONS',
          'NEEDS_CHANGES',
          'REJECT',
        ]);
        if (!validDecisions.has(rawDecision)) {
          throw new AppError(
            400,
            'INVALID_REVIEW_DECISION',
            `Review decision '${rawDecision}' must be APPROVE, REJECT, REQUEST_REVISIONS, or NEEDS_CHANGES.`
          );
        }

        const normalizedDecision: HumanReviewDecision =
          rawDecision === 'NEEDS_CHANGES' ? 'REQUEST_REVISIONS' : rawDecision;

        const justification =
          typeof inputObj.justification === 'string'
            ? inputObj.justification.trim()
            : typeof inputObj.reason === 'string'
              ? inputObj.reason.trim()
              : '';

        if (justification.length < 5) {
          throw new AppError(
            400,
            'REVIEW_REASON_REQUIRED',
            'A meaningful review reason/justification of at least 5 characters is mandatory for all review decisions.'
          );
        }

        // 4. Enforce State Machine Guards
        if (milestone.status === 'APPROVED' || milestone.status === 'SETTLED') {
          throw new AppError(
            409,
            'DUPLICATE_APPROVAL_FORBIDDEN',
            `Milestone '${milestoneId}' is already in '${milestone.status}' state; duplicate approvals or reviews are prohibited.`
          );
        }

        if (milestone.status === 'REJECTED') {
          throw new AppError(
            409,
            'REVIEW_LOCKED_AFTER_REJECTION',
            `Milestone '${milestoneId}' has been REJECTED and cannot be approved or modified.`
          );
        }

        const latestSubmission = this.evidenceRepo.findLatestByMilestoneId(milestoneId);
        const latestEvaluation = this.evaluationRepo.findLatestByMilestoneId(milestoneId);

        if (
          milestone.status !== 'PENDING_REVIEW' ||
          !latestSubmission ||
          !latestEvaluation ||
          latestEvaluation.status !== 'COMPLETED' ||
          latestEvaluation.submissionId !== latestSubmission.id
        ) {
          throw new AppError(
            409,
            'EVALUATION_REQUIRED_BEFORE_REVIEW',
            `Milestone '${milestoneId}' (current status: '${milestone.status}') requires a completed AI evaluation on the latest evidence submission before human review.`
          );
        }

        if (
          typeof inputObj.evaluationId === 'string' &&
          inputObj.evaluationId.trim().length > 0 &&
          inputObj.evaluationId.trim() !== latestEvaluation.id
        ) {
          throw new AppError(
            409,
            'STALE_EVALUATION_ID',
            `Provided evaluationId '${inputObj.evaluationId}' does not match the latest completed evaluation '${latestEvaluation.id}'.`
          );
        }

        // 5. Re-calculate authoritative deterministic policy cap server-side
        const authoritativePolicy = this.settlementPolicyService.evaluateMilestonePolicy(
          milestone,
          contract.policyRules,
          latestEvaluation,
          latestSubmission.submittedAt
        );

        let approvedAmountCents = 0;
        let newMilestoneStatus: MilestoneStatus;
        let auditAction: string;

        if (normalizedDecision === 'APPROVE') {
          const requestedAmount =
            inputObj.approvedAmountCents !== undefined
              ? Number(inputObj.approvedAmountCents)
              : authoritativePolicy.permittedAmountCents;

          this.settlementPolicyService.validateApprovedAmount({
            milestone,
            policyCalculation: authoritativePolicy,
            approvedAmountCents: requestedAmount,
          });

          approvedAmountCents = requestedAmount;
          newMilestoneStatus = 'APPROVED';
          auditAction = 'HUMAN_REVIEW_APPROVED';
        } else if (normalizedDecision === 'REJECT') {
          approvedAmountCents = 0;
          newMilestoneStatus = 'REJECTED';
          auditAction = 'HUMAN_REVIEW_REJECTED';
        } else {
          // REQUEST_REVISIONS / NEEDS_CHANGES
          approvedAmountCents = 0;
          newMilestoneStatus = 'REVISION_REQUESTED';
          auditAction = 'HUMAN_REVIEW_CHANGES_REQUESTED';
        }

        const aiRecommendedOutcome =
          latestEvaluation.arbitratorRecommendation.recommendedOutcome;
        const isOverride =
          (normalizedDecision === 'APPROVE' &&
            (aiRecommendedOutcome !== 'PASS' ||
              approvedAmountCents < authoritativePolicy.permittedAmountCents)) ||
          (normalizedDecision === 'REJECT' && aiRecommendedOutcome === 'PASS');

        const decidedAt = new Date().toISOString();
        const approval: HumanApprovalRecord = {
          id: `rev_${crypto.randomUUID().slice(0, 12)}`,
          milestoneId: milestone.id,
          evaluationId: latestEvaluation.id,
          reviewerId: actor.id,
          reviewerRole: actor.role,
          decision: normalizedDecision,
          approvedAmountCents,
          isOverride,
          justification,
          policyEngineVersion: POLICY_ENGINE_VERSION,
          decidedAt,
        };

        this.approvalRepo.insert(approval);
        this.milestoneRepo.updateStatus(milestone.id, newMilestoneStatus, decidedAt);

        this.auditService.appendWithinTx({
          actorId: actor.id,
          actorRole: actor.role,
          action: auditAction,
          entityType: 'APPROVAL',
          entityId: approval.id,
          contractId: contract.id,
          milestoneId: milestone.id,
          previousState: milestone.status,
          newState: newMilestoneStatus,
          payload: {
            evaluationId: latestEvaluation.id,
            submissionId: latestSubmission.id,
            policyEngineVersion: authoritativePolicy.engineVersion,
            decision: normalizedDecision,
            stateMachineStatus: this.toStateMachineStatus(newMilestoneStatus),
            agreedAmountCents: milestone.agreedAmountCents,
            permittedAmountCents: authoritativePolicy.permittedAmountCents,
            approvedAmountCents,
            isOverride,
            justification,
            reviewerRole: actor.role,
          },
          timestamp: decidedAt,
        });

        return {
          approval,
          milestoneStatus: newMilestoneStatus,
          stateMachineStatus: this.toStateMachineStatus(newMilestoneStatus),
        };
      });
    } finally {
      this.activeReviewLocks.delete(milestoneId);
    }
  }

  /**
   * Generates the read-only Financial Decision Intelligence Ledger across all contracts and milestones.
   * Every row is directly traceable to its evidence submission, AI evaluation, deterministic policy
   * calculation, human review decision, and hash-chained audit events.
   */
  public getFinancialDecisionLedger(): FinancialLedgerRow[] {
    const contracts = this.contractRepo.listAll();
    const rows: FinancialLedgerRow[] = [];

    for (const contract of contracts) {
      const milestones = contract.milestones ?? [];
      for (const milestone of milestones) {
        const latestSubmission = this.evidenceRepo.findLatestByMilestoneId(milestone.id);
        const latestEvaluation = this.evaluationRepo.findLatestByMilestoneId(milestone.id);
        const latestApproval = this.approvalRepo.findLatestByMilestoneId(milestone.id);
        const milestoneAuditLogs = this.auditService.listLogs({ milestoneId: milestone.id });
        const contractAuditLogs =
          milestoneAuditLogs.length > 0
            ? milestoneAuditLogs
            : this.auditService.listLogs({ contractId: contract.id });

        const hasCompletedEval = Boolean(
          latestSubmission &&
            latestEvaluation &&
            latestEvaluation.status === 'COMPLETED' &&
            latestEvaluation.submissionId === latestSubmission.id
        );

        const policyCalculation =
          hasCompletedEval && latestEvaluation && latestSubmission
            ? this.settlementPolicyService.evaluateMilestonePolicy(
                milestone,
                contract.policyRules,
                latestEvaluation,
                latestSubmission.submittedAt
              )
            : latestEvaluation?.policyCalculation ?? null;

        const verifiedRatioPct = latestEvaluation
          ? Number(
              (
                (latestEvaluation.evidenceAnalysis.verifiedCount /
                  Math.max(1, latestEvaluation.evidenceAnalysis.totalCount)) *
                100
              ).toFixed(1)
            )
          : 0;

        const approvedAmountCents =
          latestApproval && latestApproval.decision === 'APPROVE'
            ? latestApproval.approvedAmountCents
            : latestApproval
              ? 0
              : null;

        const paymentEligible = Boolean(
          milestone.status === 'APPROVED' &&
            latestApproval &&
            latestApproval.decision === 'APPROVE' &&
            latestApproval.approvedAmountCents > 0 &&
            policyCalculation &&
            !policyCalculation.gateBlocked &&
            latestApproval.approvedAmountCents <= policyCalculation.permittedAmountCents
        );

        const latestAudit =
          contractAuditLogs.length > 0
            ? contractAuditLogs[contractAuditLogs.length - 1]
            : null;
        const latestPaymentTx = this.paymentRepo?.findLatestByMilestoneId(milestone.id) ?? null;
        const paymentExecutionMode = latestPaymentTx
          ? latestPaymentTx.executionMode
          : milestone.paymentStatus.startsWith('SIMULATED_')
            ? 'SANDBOX_SIMULATION'
            : milestone.paymentStatus !== 'NOT_READY'
              ? 'PAYPAL_SANDBOX'
              : 'NONE';

        rows.push({
          milestoneId: milestone.id,
          contractId: contract.id,
          contractTitle: contract.title,
          milestoneTitle: milestone.title,
          sequenceOrder: milestone.sequenceOrder,
          milestoneStatus: milestone.status,
          stateMachineStatus: this.toStateMachineStatus(milestone.status),
          submissionId: latestSubmission?.id ?? null,
          attemptNumber: latestSubmission?.attemptNumber ?? null,
          evaluationId: latestEvaluation?.id ?? null,
          verifiedRatioPct,
          riskSeverity: latestEvaluation?.riskAnalysis.overallRiskSeverity ?? 'UNAVAILABLE',
          aiRecommendation:
            latestEvaluation?.arbitratorRecommendation.recommendation ?? 'PENDING',
          policyEngineVersion: policyCalculation?.engineVersion ?? null,
          gateBlocked: policyCalculation?.gateBlocked ?? true,
          blockingReasons: policyCalculation?.gatesTripped ?? [],
          agreedAmountCents: milestone.agreedAmountCents,
          permittedAmountCents: policyCalculation?.permittedAmountCents ?? null,
          approvedAmountCents,
          approvalId: latestApproval?.id ?? null,
          reviewerId: latestApproval?.reviewerId ?? null,
          reviewerDecision: latestApproval?.decision ?? null,
          decidedAt: latestApproval?.decidedAt ?? null,
          paymentEligible,
          paymentStatus: milestone.paymentStatus,
          paymentExecutionMode,
          auditEventCount: contractAuditLogs.length,
          auditTrailIds: contractAuditLogs.map((l) => l.id),
          latestAuditEntryHash: latestAudit?.entryHash ?? null,
          updatedAt: milestone.updatedAt,
        });
      }
    }

    return rows;
  }
}
