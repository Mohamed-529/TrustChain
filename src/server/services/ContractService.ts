import crypto from 'node:crypto';
import type { AppDatabase } from '../repositories/Database.ts';
import type {
  ContractRepository,
  MilestoneRepository,
  UserRepository,
} from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import type {
  AcceptanceCriterion,
  Contract,
  ContractPolicyRules,
  CreateContractInput,
  CreateMilestoneInput,
  Milestone,
  RequiredProofType,
  User,
} from '../../types/domain.ts';
import { AppError } from '../middleware/errorHandler.ts';

const VALID_PROOF_TYPES: RequiredProofType[] = [
  'CODE_COMMIT',
  'PULL_REQUEST',
  'CI_TESTS',
  'SECURITY_SCAN',
  'API_DOCS',
];

function isPositiveInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val > 0;
}

function isNonNegativeInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0;
}

function isValidIsoDateString(val: unknown): val is string {
  if (typeof val !== 'string' || !val.trim()) {
    return false;
  }
  const parsed = Date.parse(val);
  return !Number.isNaN(parsed);
}

export class ContractService {
  private readonly db: AppDatabase;
  private readonly userRepo: UserRepository;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly auditSvc: AuditService;

  constructor(
    db: AppDatabase,
    userRepo: UserRepository,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    auditSvc: AuditService
  ) {
    this.db = db;
    this.userRepo = userRepo;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.auditSvc = auditSvc;
  }

  public listContracts(): Contract[] {
    return this.contractRepo.listAll();
  }

  public getContractById(id: string): Contract {
    const contract = this.contractRepo.findById(id);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${id}' was not found.`);
    }
    return contract;
  }

  private validatePolicyRules(rules: unknown): ContractPolicyRules {
    if (!rules || typeof rules !== 'object') {
      throw new AppError(400, 'INVALID_POLICY_RULES', 'Contract policyRules object is required.');
    }
    const r = rules as Record<string, unknown>;
    if (
      typeof r.requirePassingCi !== 'boolean' ||
      typeof r.requireSecurityScan !== 'boolean' ||
      typeof r.allowPartialPayout !== 'boolean' ||
      !isNonNegativeInteger(r.maxAllowedCriticalVulns) ||
      !isNonNegativeInteger(r.maxAllowedHighVulns) ||
      !isNonNegativeInteger(r.latePenaltyDailyBps) ||
      r.latePenaltyDailyBps > 5000
    ) {
      throw new AppError(
        400,
        'INVALID_POLICY_RULES',
        'policyRules must specify valid boolean gates and non-negative integer thresholds (latePenaltyDailyBps <= 5000).'
      );
    }

    return {
      requirePassingCi: r.requirePassingCi,
      requireSecurityScan: r.requireSecurityScan,
      maxAllowedCriticalVulns: r.maxAllowedCriticalVulns,
      maxAllowedHighVulns: r.maxAllowedHighVulns,
      allowPartialPayout: r.allowPartialPayout,
      latePenaltyDailyBps: r.latePenaltyDailyBps,
    };
  }

  private validateMilestones(
    milestonesInput: unknown,
    totalBudgetCents: number
  ): CreateMilestoneInput[] {
    if (!Array.isArray(milestonesInput) || milestonesInput.length === 0) {
      throw new AppError(
        400,
        'MISSING_MILESTONES',
        'A contract must define at least one milestone.'
      );
    }

    let allocatedCentsSum = 0;
    const seenOrders = new Set<number>();
    const validatedMilestones: CreateMilestoneInput[] = [];

    for (let i = 0; i < milestonesInput.length; i++) {
      const m = milestonesInput[i] as Record<string, unknown>;
      if (!m || typeof m !== 'object') {
        throw new AppError(400, 'INVALID_MILESTONE', `Milestone at index ${i} is invalid.`);
      }

      if (typeof m.title !== 'string' || !m.title.trim()) {
        throw new AppError(400, 'INVALID_MILESTONE_TITLE', `Milestone #${i + 1} requires a title.`);
      }

      if (!isPositiveInteger(m.sequenceOrder)) {
        throw new AppError(
          400,
          'INVALID_MILESTONE_SEQUENCE',
          `Milestone '${m.title}' must have a positive integer sequenceOrder.`
        );
      }

      if (seenOrders.has(m.sequenceOrder)) {
        throw new AppError(
          400,
          'DUPLICATE_MILESTONE_SEQUENCE',
          `Duplicate milestone sequenceOrder ${m.sequenceOrder}.`
        );
      }
      seenOrders.add(m.sequenceOrder);

      if (!isPositiveInteger(m.agreedAmountCents)) {
        throw new AppError(
          400,
          'INVALID_MONETARY_AMOUNT',
          `Milestone '${m.title}' agreedAmountCents must be a positive integer in cents.`
        );
      }

      if (!isValidIsoDateString(m.deadlineIso)) {
        throw new AppError(
          400,
          'INVALID_DEADLINE_DATE',
          `Milestone '${m.title}' deadlineIso must be a valid ISO-8601 date string.`
        );
      }

      if (!Array.isArray(m.acceptanceCriteria) || m.acceptanceCriteria.length === 0) {
        throw new AppError(
          400,
          'MISSING_ACCEPTANCE_CRITERIA',
          `Milestone '${m.title}' must contain at least one acceptance criterion.`
        );
      }

      const criteria: AcceptanceCriterion[] = [];
      for (const rawCrit of m.acceptanceCriteria) {
        const c = rawCrit as Record<string, unknown>;
        if (
          !c ||
          typeof c.id !== 'string' ||
          !c.id.trim() ||
          typeof c.title !== 'string' ||
          !c.title.trim() ||
          typeof c.description !== 'string' ||
          !VALID_PROOF_TYPES.includes(c.requiredProofType as RequiredProofType)
        ) {
          throw new AppError(
            400,
            'INVALID_ACCEPTANCE_CRITERION',
            `Milestone '${m.title}' has an invalid acceptance criterion definition.`
          );
        }
        criteria.push({
          id: c.id.trim(),
          title: c.title.trim(),
          description: c.description.trim(),
          requiredProofType: c.requiredProofType as RequiredProofType,
        });
      }

      allocatedCentsSum += m.agreedAmountCents;
      validatedMilestones.push({
        sequenceOrder: m.sequenceOrder,
        title: m.title.trim(),
        description: typeof m.description === 'string' ? m.description.trim() : '',
        agreedAmountCents: m.agreedAmountCents,
        deadlineIso: m.deadlineIso,
        dependencyMilestoneIds: Array.isArray(m.dependencyMilestoneIds)
          ? m.dependencyMilestoneIds.map(String)
          : [],
        acceptanceCriteria: criteria,
      });
    }

    if (allocatedCentsSum !== totalBudgetCents) {
      throw new AppError(
        400,
        'BUDGET_MISMATCH',
        `Sum of milestone amounts (${allocatedCentsSum} cents) must equal totalBudgetCents (${totalBudgetCents} cents).`,
        { allocatedCentsSum, totalBudgetCents }
      );
    }

    return validatedMilestones;
  }

  /**
   * Creates a new contract and its milestones inside a single atomic SQLite transaction,
   * appending hash-chained audit logs in the same transaction.
   */
  public createContract(actor: User, rawInput: unknown): Contract {
    if (actor.role !== 'CLIENT') {
      throw new AppError(
        403,
        'FORBIDDEN_ROLE',
        'Only an authenticated CLIENT can create a contract.'
      );
    }

    if (!rawInput || typeof rawInput !== 'object') {
      throw new AppError(400, 'INVALID_CONTRACT_PAYLOAD', 'Contract request body is required.');
    }

    const input = rawInput as Partial<CreateContractInput>;
    if (typeof input.title !== 'string' || !input.title.trim()) {
      throw new AppError(400, 'INVALID_CONTRACT_TITLE', 'Contract title is required.');
    }

    if (input.currency !== 'USD') {
      throw new AppError(400, 'INVALID_CURRENCY', 'Contract currency must be USD.');
    }

    if (!isPositiveInteger(input.totalBudgetCents)) {
      throw new AppError(
        400,
        'INVALID_MONETARY_AMOUNT',
        'totalBudgetCents must be a positive integer in cents.'
      );
    }

    if (typeof input.developerId !== 'string' || typeof input.reviewerId !== 'string') {
      throw new AppError(
        400,
        'INVALID_PARTICIPANTS',
        'Both developerId and reviewerId must be specified.'
      );
    }

    const developerId = input.developerId.trim();
    const reviewerId = input.reviewerId.trim();

    if (developerId === reviewerId || developerId === actor.id) {
      throw new AppError(
        400,
        'SEPARATION_OF_DUTIES_VIOLATION',
        'The assigned Developer cannot be the Client or the Financial Reviewer for the same contract.',
        { clientId: actor.id, developerId, reviewerId }
      );
    }

    const devUser = this.userRepo.findById(developerId);
    if (!devUser || devUser.role !== 'DEVELOPER') {
      throw new AppError(
        400,
        'INVALID_DEVELOPER_USER',
        `User '${developerId}' is not a valid active DEVELOPER.`
      );
    }

    const revUser = this.userRepo.findById(reviewerId);
    if (!revUser || (revUser.role !== 'REVIEWER' && revUser.role !== 'CLIENT')) {
      throw new AppError(
        400,
        'INVALID_REVIEWER_USER',
        `User '${reviewerId}' is not a valid active REVIEWER or CLIENT.`
      );
    }

    const policyRules = this.validatePolicyRules(input.policyRules);
    const totalBudgetCents = input.totalBudgetCents;
    const validatedMilestones = this.validateMilestones(input.milestones, totalBudgetCents);

    const nowIso = new Date().toISOString();
    const contractId = `contract_${crypto.randomUUID()}`;
    const title = input.title.trim();
    const description = typeof input.description === 'string' ? input.description.trim() : '';

    return this.db.withTransaction(() => {
      const contractHeader: Omit<Contract, 'milestones'> = {
        id: contractId,
        title,
        description,
        totalBudgetCents,
        currency: 'USD',
        clientId: actor.id,
        developerId,
        reviewerId,
        policyRules,
        status: 'DRAFT',
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      this.contractRepo.insert(contractHeader);

      const createdMilestones: Milestone[] = [];
      for (const mInput of validatedMilestones) {
        const milestoneId = `ms_${crypto.randomUUID()}`;
        const milestone: Milestone = {
          id: milestoneId,
          contractId,
          sequenceOrder: mInput.sequenceOrder,
          title: mInput.title,
          description: mInput.description,
          agreedAmountCents: mInput.agreedAmountCents,
          deadlineIso: mInput.deadlineIso,
          dependencyMilestoneIds: mInput.dependencyMilestoneIds ?? [],
          acceptanceCriteria: mInput.acceptanceCriteria,
          status: 'DRAFT',
          paymentStatus: 'NOT_READY',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        this.milestoneRepo.insert(milestone);
        createdMilestones.push(milestone);
      }

      this.auditSvc.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CONTRACT_CREATED',
        entityType: 'CONTRACT',
        entityId: contractId,
        contractId,
        previousState: null,
        newState: 'DRAFT',
        payload: {
          title,
          totalBudgetCents,
          currency: 'USD',
          developerId,
          reviewerId,
          milestoneCount: createdMilestones.length,
        },
        timestamp: nowIso,
      });

      return {
        ...contractHeader,
        milestones: createdMilestones,
      };
    });
  }

  /**
   * Transitions a contract and its milestones from DRAFT to ACTIVE inside an atomic
   * SQLite transaction. Once ACTIVE, contractual terms are immutable without a formal amendment.
   */
  public activateContract(actor: User, contractId: string): Contract {
    if (actor.role !== 'CLIENT') {
      throw new AppError(
        403,
        'FORBIDDEN_ROLE',
        'Only an authenticated CLIENT can activate a contract.'
      );
    }

    const existing = this.getContractById(contractId);
    if (existing.clientId !== actor.id) {
      throw new AppError(
        403,
        'NOT_CONTRACT_OWNER',
        'Only the Client who owns this contract can activate it.'
      );
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError(
        409,
        'CONTRACT_ALREADY_ACTIVE',
        `Contract '${contractId}' is in state '${existing.status}' and cannot be activated again.`
      );
    }

    const nowIso = new Date().toISOString();

    return this.db.withTransaction(() => {
      const updated = this.contractRepo.updateStatusAndIncrementVersion(
        contractId,
        existing.version,
        'ACTIVE',
        nowIso
      );
      if (!updated) {
        throw new AppError(
          409,
          'CONCURRENT_MODIFICATION',
          'Contract version changed concurrently; please retry.'
        );
      }

      this.milestoneRepo.updateStatusByContractId(contractId, 'ACTIVE', nowIso);

      this.auditSvc.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CONTRACT_ACTIVATED',
        entityType: 'CONTRACT',
        entityId: contractId,
        contractId,
        previousState: 'DRAFT',
        newState: 'ACTIVE',
        payload: {
          previousVersion: existing.version,
          newVersion: existing.version + 1,
          totalBudgetCents: existing.totalBudgetCents,
        },
        timestamp: nowIso,
      });

      return this.getContractById(contractId);
    });
  }
}
