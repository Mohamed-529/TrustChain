import crypto from 'node:crypto';
import type {
  ContractScheduleAssignment,
  ContractScheduleDependency,
  ContractScheduleResource,
  ContractScheduleResponse,
  ContractScheduleTask,
  Milestone,
  ScheduleDownstreamCascade,
  ScheduleHealthStatus,
  ScheduleRecoveryProposal,
  SubmitEvidenceInput,
  User,
} from '../../types/domain.ts';
import type { AppDatabase } from '../repositories/Database.ts';
import type {
  ContractRepository,
  EvaluationRepository,
  EvidenceRepository,
  HumanApprovalRepository,
  MilestoneRepository,
  ScheduleProposalRepository,
  UserRepository,
} from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import type { EvidenceService } from './EvidenceService.ts';
import type { EvaluationService } from './EvaluationService.ts';
import type { HumanReviewService } from './HumanReviewService.ts';
import { AppError } from '../middleware/errorHandler.ts';

function addDaysIso(isoStr: string, days: number): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) {
    return isoStr;
  }
  const shifted = new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
  return shifted.toISOString();
}

function diffDaysCeil(startIso: string, endIso: string): number {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) {
    return 1;
  }
  return Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
}

/**
 * Primary Sponsor Integration A — Bryntum Gantt:
 * Evidence-Aware Software Delivery Control Tower & Human-Controlled Schedule Recovery Service.
 *
 * Key Guarantees:
 * 1. Connects every Bryntum Gantt task directly to persisted backend `milestone.id`,
 *    `evidence_submissions`, `ai_evaluations`, and `human_approvals`.
 * 2. Computes `percentDone` deterministically from persisted milestone state and verified
 *    criteria counts—NEVER invents progress percentages from unstructured AI prose.
 * 3. Computes critical path across Finish-to-Start (`type: 2`) dependency chains,
 *    identifies overdue/at-risk tasks, and detects downstream tasks blocked by dependencies.
 * 4. Generates AI Schedule-Risk Recovery Proposals citing canonical `evidenceId`s and dates.
 * 5. Enforces Human-Controlled Schedule Recovery: ONLY authorized `CLIENT` or `REVIEWER`
 *    actors can approve schedule modifications, which persist updated schedule dates,
 *    recalculate downstream Finish-to-Start dependencies, preserve baseline dates for
 *    Baseline vs. Actual comparison, and NEVER alter `agreedAmountCents` or `acceptanceCriteria`.
 */
export class ScheduleControlTowerService {
  private readonly db: AppDatabase;
  private readonly userRepo: UserRepository;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly evidenceRepo: EvidenceRepository;
  private readonly evaluationRepo: EvaluationRepository;
  private readonly approvalRepo: HumanApprovalRepository;
  private readonly proposalRepo: ScheduleProposalRepository;
  private readonly auditService: AuditService;

  constructor(
    db: AppDatabase,
    userRepo: UserRepository,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    evidenceRepo: EvidenceRepository,
    evaluationRepo: EvaluationRepository,
    approvalRepo: HumanApprovalRepository,
    proposalRepo: ScheduleProposalRepository,
    auditService: AuditService
  ) {
    this.db = db;
    this.userRepo = userRepo;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.evidenceRepo = evidenceRepo;
    this.evaluationRepo = evaluationRepo;
    this.approvalRepo = approvalRepo;
    this.proposalRepo = proposalRepo;
    this.auditService = auditService;
  }

  /**
   * Computes the longest Finish-to-Start dependency chain (Critical Path) across contract milestones.
   */
  private computeCriticalPathIds(milestones: Milestone[]): Set<string> {
    if (milestones.length === 0) {
      return new Set();
    }

    const byId = new Map<string, Milestone>();
    for (const m of milestones) {
      byId.set(m.id, m);
    }

    const memoDuration = new Map<string, { totalDays: number; path: string[] }>();

    const dfs = (id: string, visiting = new Set<string>()): { totalDays: number; path: string[] } => {
      if (memoDuration.has(id)) {
        return memoDuration.get(id)!;
      }
      const m = byId.get(id);
      if (!m || visiting.has(id)) {
        return { totalDays: 0, path: [] };
      }
      visiting.add(id);

      const startIso = m.startDateIso ?? m.createdAt;
      const ownDays = diffDaysCeil(startIso, m.deadlineIso);

      let bestPred: { totalDays: number; path: string[] } = { totalDays: 0, path: [] };
      for (const depId of m.dependencyMilestoneIds) {
        if (byId.has(depId)) {
          const cand = dfs(depId, new Set(visiting));
          if (cand.totalDays > bestPred.totalDays) {
            bestPred = cand;
          }
        }
      }

      const result = {
        totalDays: bestPred.totalDays + ownDays,
        path: [...bestPred.path, id],
      };
      memoDuration.set(id, result);
      return result;
    };

    let longest: { totalDays: number; path: string[] } = { totalDays: 0, path: [] };
    for (const m of milestones) {
      const res = dfs(m.id);
      if (res.totalDays >= longest.totalDays) {
        longest = res;
      }
    }

    return new Set(longest.path);
  }

  /**
   * Builds the full Bryntum Gantt Project/Task/Dependency/Baseline/Resource model
   * synchronized with persisted backend evidence, AI evaluations, and human approvals.
   */
  public getContractSchedule(
    contractId: string,
    referenceTimeIso?: string
  ): ContractScheduleResponse {
    const contract = this.contractRepo.findById(contractId);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${contractId}' was not found.`);
    }

    const milestones = this.milestoneRepo.listByContractId(contractId);
    const refTimeIso = referenceTimeIso ?? '2026-11-22T12:00:00.000Z';
    const refMs = new Date(refTimeIso).getTime();

    const developer = this.userRepo.findById(contract.developerId);
    const reviewer = this.userRepo.findById(contract.reviewerId);
    const client = this.userRepo.findById(contract.clientId);

    const resources: ContractScheduleResource[] = [
      ...(developer
        ? [{ id: developer.id, name: developer.name, role: developer.role }]
        : []),
      ...(reviewer ? [{ id: reviewer.id, name: reviewer.name, role: reviewer.role }] : []),
      ...(client ? [{ id: client.id, name: client.name, role: client.role }] : []),
    ];

    const assignments: ContractScheduleAssignment[] = [];
    const dependencies: ContractScheduleDependency[] = [];
    const criticalIds = this.computeCriticalPathIds(milestones);

    // First pass: determine completion & risk states per milestone
    const milestoneStateMap = new Map<
      string,
      {
        isComplete: boolean;
        isFailedOrAtRisk: boolean;
        isOverdue: boolean;
      }
    >();

    for (const m of milestones) {
      const latestSub = this.evidenceRepo.findLatestByMilestoneId(m.id);
      const latestEval = this.evaluationRepo.findLatestByMilestoneId(m.id);
      const isComplete = m.status === 'APPROVED' || m.status === 'SETTLED';
      const deadlineMs = new Date(m.deadlineIso).getTime();
      const subMs = latestSub ? new Date(latestSub.submittedAt).getTime() : 0;
      const compareMs = isComplete && subMs > 0 ? subMs : Math.max(subMs, refMs);
      const isOverdue = !isComplete && !Number.isNaN(deadlineMs) && compareMs > deadlineMs;

      const ciFailed = latestSub?.ciReport.status === 'FAILURE';
      const evalBlocked = Boolean(latestEval && latestEval.policyCalculation.gateBlocked);
      const highRisk = Boolean(
        latestEval &&
          (latestEval.riskAnalysis.overallRiskSeverity === 'CRITICAL' ||
            latestEval.riskAnalysis.overallRiskSeverity === 'HIGH')
      );
      const isFailedOrAtRisk =
        !isComplete &&
        (ciFailed ||
          evalBlocked ||
          highRisk ||
          m.status === 'REVISION_REQUESTED' ||
          m.status === 'REJECTED');

      milestoneStateMap.set(m.id, {
        isComplete,
        isFailedOrAtRisk,
        isOverdue,
      });
    }

    const tasks: ContractScheduleTask[] = milestones.map((m, idx) => {
      const prevMilestone = idx > 0 ? milestones[idx - 1] : null;
      const startDate =
        m.startDateIso ?? (prevMilestone ? prevMilestone.deadlineIso : contract.createdAt);
      const endDate = m.deadlineIso;
      const baselineStartDate = m.baselineStartIso ?? startDate;
      const baselineEndDate = m.baselineEndIso ?? endDate;
      const duration = diffDaysCeil(startDate, endDate);

      const latestSub = this.evidenceRepo.findLatestByMilestoneId(m.id);
      const latestEval = this.evaluationRepo.findLatestByMilestoneId(m.id);
      const latestApproval = this.approvalRepo.findLatestByMilestoneId(m.id);

      // Compute lateDays relative to baseline/current deadline
      const isComplete = m.status === 'APPROVED' || m.status === 'SETTLED';
      const deadlineMs = new Date(endDate).getTime();
      const subMs = latestSub ? new Date(latestSub.submittedAt).getTime() : 0;
      const compareMs = isComplete && subMs > 0 ? subMs : Math.max(subMs, refMs);
      const rawLateDays =
        !Number.isNaN(deadlineMs) && !Number.isNaN(compareMs) && compareMs > deadlineMs
          ? Math.ceil((compareMs - deadlineMs) / (1000 * 60 * 60 * 24))
          : 0;
      const lateDays = isComplete ? (latestEval?.policyCalculation.lateDays ?? 0) : rawLateDays;

      // Determine blocking dependencies: any dependency that is not yet APPROVED or SETTLED
      const blockingMilestoneIds: string[] = [];
      for (const depId of m.dependencyMilestoneIds) {
        const depState = milestoneStateMap.get(depId);
        if (depState && !depState.isComplete) {
          blockingMilestoneIds.push(depId);
        }

        dependencies.push({
          id: `dep_${depId}_${m.id}`,
          fromTask: depId,
          toTask: m.id,
          fromEvent: depId,
          toEvent: m.id,
          type: 2, // Finish-to-Start (FS)
          lag: 0,
          lagUnit: 'day',
          isBlocking: Boolean(depState && !depState.isComplete),
        });
      }

      const isBlockedByDependency = !isComplete && blockingMilestoneIds.length > 0;
      const ownState = milestoneStateMap.get(m.id)!;
      const isOverdue = !isComplete && lateDays > 0;
      const isAtRisk = !isComplete && (ownState.isFailedOrAtRisk || isOverdue);

      let scheduleHealth: ScheduleHealthStatus = 'ON_TRACK';
      if (isComplete) {
        scheduleHealth = 'COMPLETED';
      } else if (isOverdue && ownState.isFailedOrAtRisk) {
        scheduleHealth = 'OVERDUE';
      } else if (isBlockedByDependency && !latestSub) {
        scheduleHealth = 'BLOCKED_BY_DEPENDENCY';
      } else if (isOverdue) {
        scheduleHealth = 'OVERDUE';
      } else if (isAtRisk) {
        scheduleHealth = 'AT_RISK';
      } else if (isBlockedByDependency) {
        scheduleHealth = 'BLOCKED_BY_DEPENDENCY';
      }

      // Deterministic percentDone calculation from persisted status & verified criteria count
      let percentDone = 0;
      if (isComplete) {
        percentDone = 100;
      } else if (latestEval && latestEval.status === 'COMPLETED') {
        const ratio =
          latestEval.evidenceAnalysis.totalCount > 0
            ? latestEval.evidenceAnalysis.verifiedCount / latestEval.evidenceAnalysis.totalCount
            : 0;
        // Cap unapproved milestones at 85% so 100% is strictly reserved for human-approved completion
        percentDone = Math.min(85, Math.round(ratio * 85));
      } else if (latestSub) {
        percentDone = 25;
      }

      let evidenceStatus: ContractScheduleTask['evidenceStatus'] = 'NONE';
      if (latestSub) {
        if (
          latestEval &&
          latestEval.evidenceAnalysis.verifiedCount === latestEval.evidenceAnalysis.totalCount &&
          latestSub.ciReport.status === 'SUCCESS'
        ) {
          evidenceStatus = 'VERIFIED';
        } else if (
          latestSub.ciReport.status === 'FAILURE' ||
          (latestEval && latestEval.policyCalculation.gateBlocked)
        ) {
          evidenceStatus = 'CONTRADICTED_OR_INCOMPLETE';
        } else {
          evidenceStatus = 'SUBMITTED';
        }
      }

      const ciStatus: ContractScheduleTask['ciStatus'] = latestSub
        ? latestSub.ciReport.status
        : 'NONE';

      const evaluationStatus: ContractScheduleTask['evaluationStatus'] = latestEval
        ? latestEval.status
        : 'NONE';

      const riskSeverity: ContractScheduleTask['riskSeverity'] = latestEval
        ? latestEval.riskAnalysis.overallRiskSeverity
        : 'NONE';

      const evidenceReferences = (latestSub?.canonicalReferences ?? []).map((r) => r.evidenceId);

      // Build human-readable, evidence-cited schedule risk explanation
      const explanationParts: string[] = [];
      if (isComplete) {
        explanationParts.push(
          `Completed and approved (${m.status}). Verified ${latestEval?.evidenceAnalysis.verifiedCount ?? m.acceptanceCriteria.length}/${m.acceptanceCriteria.length} acceptance criteria.`
        );
      } else {
        if (isOverdue) {
          explanationParts.push(
            `OVERDUE by ${lateDays} day(s) past deadline ${endDate.slice(0, 10)}.`
          );
        }
        if (latestSub && latestSub.ciReport.status === 'FAILURE') {
          explanationParts.push(
            `CI build FAILED (${latestSub.ciReport.passedTests}/${latestSub.ciReport.totalTests} passed, ${latestSub.ciReport.failedTests} failed; ref: ev_ci_${latestSub.id}).`
          );
        }
        if (latestEval && latestEval.policyCalculation.gateBlocked) {
          explanationParts.push(
            `Settlement Policy Gate Blocked: ${latestEval.policyCalculation.gatesTripped.join('; ')}.`
          );
        }
        if (isBlockedByDependency) {
          explanationParts.push(
            `BLOCKED by upstream Finish-to-Start dependency: [${blockingMilestoneIds.join(', ')}] is not yet completed.`
          );
        }
        if (explanationParts.length === 0) {
          explanationParts.push('Scheduled and on track within contractual baseline window.');
        }
      }

      if (developer) {
        assignments.push({
          id: `asgn_${m.id}_${developer.id}`,
          event: m.id,
          resource: developer.id,
          units: 100,
        });
      }

      return {
        id: m.id,
        milestoneId: m.id,
        sequenceOrder: m.sequenceOrder,
        name: m.title,
        startDate,
        endDate,
        duration,
        durationUnit: 'day',
        percentDone,
        baselineStartDate,
        baselineEndDate,
        baselines: [
          {
            startDate: baselineStartDate,
            endDate: baselineEndDate,
            label: 'Signed Contract Baseline',
          },
        ],
        actualSubmittedAt: latestSub?.submittedAt ?? null,
        status: m.status,
        paymentStatus: m.paymentStatus,
        scheduleHealth,
        critical: criticalIds.has(m.id),
        isOverdue,
        isAtRisk,
        isBlockedByDependency,
        blockingMilestoneIds,
        lateDays,
        agreedAmountCents: m.agreedAmountCents,
        permittedAmountCents: latestEval ? latestEval.policyCalculation.permittedAmountCents : null,
        approvedAmountCents:
          latestApproval && latestApproval.decision === 'APPROVE'
            ? latestApproval.approvedAmountCents
            : null,
        assignedDeveloperId: developer?.id ?? contract.developerId,
        assignedDeveloperName: developer?.name ?? contract.developerId,
        evidenceStatus,
        ciStatus,
        evaluationStatus,
        riskSeverity,
        evidenceReferences,
        riskExplanation: explanationParts.join(' '),
      };
    });

    const proposals = this.proposalRepo.listByContractId(contractId);

    return {
      contractId,
      contractTitle: contract.title,
      referenceTimeIso: refTimeIso,
      tasks,
      dependencies,
      resources,
      assignments,
      criticalPathTaskIds: Array.from(criticalIds),
      proposals,
      summary: {
        totalMilestones: tasks.length,
        completedCount: tasks.filter((t) => t.scheduleHealth === 'COMPLETED').length,
        overdueCount: tasks.filter((t) => t.isOverdue).length,
        atRiskCount: tasks.filter((t) => t.isAtRisk).length,
        blockedByDependencyCount: tasks.filter((t) => t.isBlockedByDependency).length,
        criticalPathCount: tasks.filter((t) => t.critical).length,
        pendingProposalsCount: proposals.filter((p) => p.status === 'PENDING').length,
      },
    };
  }

  /**
   * AI Schedule-Risk Intelligence:
   * Inspects the contract schedule, detects overdue/at-risk milestones and blocked downstream
   * dependencies, and creates a structured `ScheduleRecoveryProposal` with supporting evidence IDs
   * and downstream Finish-to-Start cascade calculations.
   *
   * Never modifies milestone dates or payment terms directly—human approval is required.
   */
  public analyzeScheduleRiskAndProposeRecovery(
    actor: User,
    contractId: string,
    options?: {
      milestoneId?: string;
      recoveryDays?: number;
      referenceTimeIso?: string;
    }
  ): {
    schedule: ContractScheduleResponse;
    createdProposals: ScheduleRecoveryProposal[];
  } {
    const schedule = this.getContractSchedule(contractId, options?.referenceTimeIso);
    const milestones = this.milestoneRepo.listByContractId(contractId);
    const byId = new Map(milestones.map((m) => [m.id, m]));

    // Identify target at-risk / overdue tasks
    const targetTasks = schedule.tasks.filter((t) => {
      if (options?.milestoneId) {
        return t.milestoneId === options.milestoneId;
      }
      return (
        t.scheduleHealth !== 'COMPLETED' &&
        (t.isOverdue || t.isAtRisk || t.ciStatus === 'FAILURE')
      );
    });

    const recoveryDays =
      options?.recoveryDays && options.recoveryDays > 0 ? Math.floor(options.recoveryDays) : 7;

    const createdProposals: ScheduleRecoveryProposal[] = [];

    this.db.withTransaction(() => {
      for (const task of targetTasks) {
        // Check if there is already a PENDING proposal for this milestone
        const existingPending = this.proposalRepo.findPendingByMilestoneId(task.milestoneId);
        if (existingPending) {
          createdProposals.push(existingPending);
          continue;
        }

        const milestone = byId.get(task.milestoneId);
        if (!milestone) {
          continue;
        }

        const shiftDays = Math.max(recoveryDays, task.lateDays + 5);
        const proposedStartDate = task.startDate;
        const proposedEndDate = addDaysIso(task.endDate, shiftDays);

        // Compute downstream Finish-to-Start dependency cascades
        const downstreamCascades: ScheduleDownstreamCascade[] = [];
        const visitedDownstream = new Set<string>([task.milestoneId]);
        let currentParentEndMap = new Map<string, string>([[task.milestoneId, proposedEndDate]]);

        // Traverse milestones in sequence order to cascade Finish-to-Start shifts
        for (const cand of schedule.tasks) {
          if (visitedDownstream.has(cand.milestoneId) || cand.scheduleHealth === 'COMPLETED') {
            continue;
          }
          const matchingDepId = milestone
            ? cand.blockingMilestoneIds.find((depId) => currentParentEndMap.has(depId)) ??
              (byId.get(cand.milestoneId)?.dependencyMilestoneIds ?? []).find((depId) =>
                currentParentEndMap.has(depId)
              )
            : undefined;

          if (matchingDepId) {
            const upstreamProposedEnd = currentParentEndMap.get(matchingDepId)!;
            const candDurationDays = diffDaysCeil(cand.startDate, cand.endDate);
            const newCandStart = addDaysIso(upstreamProposedEnd, 1);
            const newCandEnd = addDaysIso(newCandStart, candDurationDays);

            downstreamCascades.push({
              milestoneId: cand.milestoneId,
              milestoneTitle: cand.name,
              previousStartDate: cand.startDate,
              previousEndDate: cand.endDate,
              proposedStartDate: newCandStart,
              proposedEndDate: newCandEnd,
              shiftDays,
            });

            visitedDownstream.add(cand.milestoneId);
            currentParentEndMap.set(cand.milestoneId, newCandEnd);
          }
        }

        const nowIso = new Date().toISOString();
        const proposal: ScheduleRecoveryProposal = {
          id: `sprop_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
          contractId,
          milestoneId: task.milestoneId,
          milestoneTitle: task.name,
          proposedBy: actor.id,
          status: 'PENDING',
          currentStartDate: task.startDate,
          currentEndDate: task.endDate,
          baselineStartDate: task.baselineStartDate,
          baselineEndDate: task.baselineEndDate,
          proposedStartDate,
          proposedEndDate,
          delayDays: shiftDays,
          riskSummary: task.riskExplanation,
          aiRationale: `AI Schedule-Risk Advisor detected ${task.scheduleHealth} status on '${task.name}' (${
            task.evidenceReferences.length > 0
              ? `citing evidence [${task.evidenceReferences.join(', ')}]`
              : 'no passing evidence uploaded prior to deadline'
          }). Proposing a +${shiftDays}-day recovery window (${task.endDate.slice(
            0,
            10
          )} -> ${proposedEndDate.slice(0, 10)}) with automatic Finish-to-Start cascade across ${
            downstreamCascades.length
          } downstream milestone(s) [${downstreamCascades
            .map((d) => d.milestoneId)
            .join(', ')}]. Original baseline (${task.baselineEndDate.slice(
            0,
            10
          )}) and contractual budget ($${(milestone.agreedAmountCents / 100).toFixed(
            2
          )}) remain strictly unchanged.`,
          supportingEvidenceIds: task.evidenceReferences,
          downstreamCascades,
          preservesContractualAmountCents: milestone.agreedAmountCents,
          decidedBy: null,
          decidedByRole: null,
          decidedAt: null,
          decisionReason: null,
          createdAt: nowIso,
        };

        this.proposalRepo.insert(proposal);
        createdProposals.push(proposal);

        this.auditService.appendWithinTx({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'SCHEDULE_RECOVERY_PROPOSED',
          entityType: 'MILESTONE',
          entityId: task.milestoneId,
          contractId,
          milestoneId: task.milestoneId,
          previousState: task.endDate,
          newState: proposedEndDate,
          payload: {
            proposalId: proposal.id,
            delayDays: shiftDays,
            supportingEvidenceIds: proposal.supportingEvidenceIds,
            downstreamCascadeCount: downstreamCascades.length,
            preservesContractualAmountCents: milestone.agreedAmountCents,
          },
          timestamp: nowIso,
        });
      }
    });

    return {
      schedule: this.getContractSchedule(contractId, options?.referenceTimeIso),
      createdProposals,
    };
  }

  /**
   * Human-Controlled Schedule Recovery Decision:
   * Only authorized `CLIENT` or `REVIEWER` roles (`actor.id !== contract.developerId`)
   * may approve or reject material schedule changes.
   *
   * When `decision === 'APPROVE'`:
   * - Updates the target milestone's `deadline_iso` while preserving `baseline_end_iso`.
   * - Cascades Finish-to-Start dependency shifts to all downstream dependent milestones.
   * - Strictly preserves `agreed_amount_cents` and `acceptance_criteria_json`.
   * - Appends a tamper-evident `SCHEDULE_RECOVERY_APPROVED` audit log entry.
   */
  public reviewScheduleProposal(
    actor: User,
    contractId: string,
    proposalId: string,
    input: {
      decision: 'APPROVE' | 'REJECT';
      reason: string;
      referenceTimeIso?: string;
    }
  ): {
    proposal: ScheduleRecoveryProposal;
    schedule: ContractScheduleResponse;
  } {
    const contract = this.contractRepo.findById(contractId);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${contractId}' was not found.`);
    }

    // Enforce Separation of Duties: Developer cannot approve their own schedule extension
    if (actor.role === 'DEVELOPER' || actor.id === contract.developerId) {
      throw new AppError(
        403,
        'SCHEDULE_APPROVAL_FORBIDDEN_FOR_DEVELOPER',
        `Separation-of-duties violation: Developer '${actor.id}' cannot approve or reject contractual schedule changes.`
      );
    }

    if (actor.role !== 'CLIENT' && actor.role !== 'REVIEWER') {
      throw new AppError(
        403,
        'FORBIDDEN_ROLE',
        'Only authorized CLIENT or REVIEWER actors may approve or reject schedule recovery proposals.'
      );
    }

    if (actor.id !== contract.clientId && actor.id !== contract.reviewerId) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_CONTRACT_FIDUCIARY',
        `Actor '${actor.id}' is not authorized for contract '${contractId}'.`
      );
    }

    const reason = String(input.reason ?? '').trim();
    if (reason.length < 5) {
      throw new AppError(
        400,
        'DECISION_REASON_REQUIRED',
        'A decision reason of at least 5 characters is required to approve or reject a schedule proposal.'
      );
    }

    if (input.decision !== 'APPROVE' && input.decision !== 'REJECT') {
      throw new AppError(
        400,
        'INVALID_SCHEDULE_DECISION',
        "Schedule proposal decision must be 'APPROVE' or 'REJECT'."
      );
    }

    this.db.withTransaction(() => {
      const proposal = this.proposalRepo.findById(proposalId);
      if (!proposal || proposal.contractId !== contractId) {
        throw new AppError(
          404,
          'SCHEDULE_PROPOSAL_NOT_FOUND',
          `Schedule proposal '${proposalId}' was not found for contract '${contractId}'.`
        );
      }

      if (proposal.status !== 'PENDING') {
        throw new AppError(
          409,
          'SCHEDULE_PROPOSAL_ALREADY_DECIDED',
          `Schedule proposal '${proposalId}' is already in '${proposal.status}' state.`
        );
      }

      const milestone = this.milestoneRepo.findById(proposal.milestoneId);
      if (!milestone) {
        throw new AppError(
          404,
          'MILESTONE_NOT_FOUND',
          `Milestone '${proposal.milestoneId}' was not found.`
        );
      }

      const nowIso = new Date().toISOString();
      const newStatus = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

      this.proposalRepo.updateDecision({
        id: proposal.id,
        status: newStatus,
        decidedBy: actor.id,
        decidedByRole: actor.role,
        decidedAt: nowIso,
        decisionReason: reason,
      });

      if (input.decision === 'APPROVE') {
        // 1. Update target milestone schedule dates (preserving baseline_start_iso, baseline_end_iso, agreed_amount_cents, acceptance_criteria_json)
        this.milestoneRepo.updateScheduleDates(
          proposal.milestoneId,
          proposal.proposedStartDate,
          proposal.proposedEndDate,
          nowIso
        );

        // 2. Cascade Finish-to-Start dependency shifts to downstream dependent milestones
        for (const cascade of proposal.downstreamCascades) {
          this.milestoneRepo.updateScheduleDates(
            cascade.milestoneId,
            cascade.proposedStartDate,
            cascade.proposedEndDate,
            nowIso
          );
        }
      }

      this.auditService.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action:
          input.decision === 'APPROVE'
            ? 'SCHEDULE_RECOVERY_APPROVED'
            : 'SCHEDULE_RECOVERY_REJECTED',
        entityType: 'MILESTONE',
        entityId: proposal.milestoneId,
        contractId,
        milestoneId: proposal.milestoneId,
        previousState: proposal.currentEndDate,
        newState:
          input.decision === 'APPROVE' ? proposal.proposedEndDate : proposal.currentEndDate,
        payload: {
          proposalId: proposal.id,
          decision: input.decision,
          reason,
          proposedStartDate: proposal.proposedStartDate,
          proposedEndDate: proposal.proposedEndDate,
          baselineEndDatePreserved: proposal.baselineEndDate,
          downstreamCascadesApplied:
            input.decision === 'APPROVE' ? proposal.downstreamCascades : [],
          agreedAmountCentsUnchanged: milestone.agreedAmountCents,
        },
        timestamp: nowIso,
      });
    });

    const updatedProposal = this.proposalRepo.findById(proposalId)!;
    return {
      proposal: updatedProposal,
      schedule: this.getContractSchedule(contractId, input.referenceTimeIso),
    };
  }

  /**
   * Deterministic Demo Scenario Loader for Bryntum Control Tower:
   * Sets up the realistic 3-milestone software delivery scenario on `contract_seed_01`
   * (or specified contract):
   * - Milestone 1 (Authentication / OAuth2): Completed (`100%`, `APPROVED`).
   * - Milestone 2 (Payment Integration / Webhook Engine): Failed CI and delayed (`OVERDUE` / `AT_RISK`).
   * - Milestone 3 (Production Deployment & Reconciliation): Blocked by Milestone 2 dependency (`BLOCKED_BY_DEPENDENCY`).
   * - Automatically runs AI schedule-risk detection to propose human-controlled schedule recovery.
   */
  public async loadControlTowerDemoScenario(params: {
    contractId: string;
    evidenceService: EvidenceService;
    evaluationService: EvaluationService;
    humanReviewService: HumanReviewService;
  }): Promise<{
    schedule: ContractScheduleResponse;
    createdProposals: ScheduleRecoveryProposal[];
  }> {
    const { contractId, evidenceService, evaluationService, humanReviewService } = params;
    const contract = this.contractRepo.findById(contractId);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${contractId}' was not found.`);
    }

    const developer = this.userRepo.findById(contract.developerId);
    const reviewer = this.userRepo.findById(contract.reviewerId);
    if (!developer || !reviewer) {
      throw new AppError(500, 'DEMO_ACTORS_MISSING', 'Seeded demo actors are missing.');
    }

    const milestones = this.milestoneRepo.listByContractId(contractId);
    const m1 = milestones[0];
    const m2 = milestones[1];

    // 1. Ensure Milestone 1 (Authentication) is completed & human-approved (100%)
    if (m1 && m1.status !== 'APPROVED' && m1.status !== 'SETTLED') {
      const existingSub1 = this.evidenceRepo.findLatestByMilestoneId(m1.id);
      if (!existingSub1) {
        evidenceService.submitDemoFixture(developer, m1.id, 'SUCCESSFUL_SUBMISSION');
      }
      const eval1 = await evaluationService.evaluateMilestone(reviewer, m1.id);
      const refreshedM1 = this.milestoneRepo.findById(m1.id);
      if (refreshedM1 && refreshedM1.status !== 'APPROVED') {
        humanReviewService.submitReview(reviewer, m1.id, {
          evaluationId: eval1.id,
          decision: 'APPROVE',
          approvedAmountCents: eval1.policyCalculation.permittedAmountCents,
          justification:
            'Milestone 1 OAuth2 Authentication verified with 64/64 passing CI tests and 0 CVEs.',
        });
      }
    }

    // 2. Ensure Milestone 2 (Payment Integration / Webhook Engine) has failed CI & is overdue
    if (m2 && m2.status === 'ACTIVE') {
      const failedCiPaymentSubmission: SubmitEvidenceInput = {
        repoUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway',
        branch: 'feature/milestone-2-paypal-orders-v2',
        commitSha: 'b91e72c4d88a103f5542190de7654321fedcba98',
        prUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway/pull/57',
        prStatus: 'OPEN',
        ciReport: {
          provider: 'github-actions',
          runUrl: 'https://github.com/cloudbuilders/acme-oauth-gateway/actions/runs/9112',
          status: 'FAILURE',
          totalTests: 32,
          passedTests: 27,
          failedTests: 5,
          coveragePct: 71.0,
          changedFiles: [
            'openapi.yaml',
            'src/server/services/PayPalService.ts',
            'src/server/controllers/PaymentController.ts',
          ],
          logSummary:
            'GitHub Actions Run #9112 FAILED: 5/32 webhook signature retry integration tests failed due to sandbox timeout. PR #57 remains OPEN.',
        },
        securityScan: {
          scanner: 'osv-scanner',
          scannerVersion: '1.8.2',
          status: 'COMPLETED',
          findings: [],
        },
        developerNotes:
          'Delivered OpenAPI 3.0 spec (AC-1) and initial PayPal webhook handler, but 5 CI integration tests failed under retry load.',
      };

      evidenceService.submitEvidence(developer, m2.id, failedCiPaymentSubmission);
      await evaluationService.evaluateMilestone(reviewer, m2.id);
    }

    // 3. Milestone 3 (Deployment & Reconciliation) remains unsubmitted and BLOCKED by Milestone 2 dependency.
    // Run AI Schedule-Risk Intelligence at reference date 2026-11-23 (3 days after Milestone 2's 2026-11-20 deadline)
    return this.analyzeScheduleRiskAndProposeRecovery(reviewer, contractId, {
      referenceTimeIso: '2026-11-23T12:00:00.000Z',
      recoveryDays: 7,
    });
  }
}
