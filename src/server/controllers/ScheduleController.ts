import type { ScheduleControlTowerService } from '../services/ScheduleControlTowerService.ts';
import type { EvidenceService } from '../services/EvidenceService.ts';
import type { EvaluationService } from '../services/EvaluationService.ts';
import type { HumanReviewService } from '../services/HumanReviewService.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
} from '../middleware/errorHandler.ts';

export class ScheduleController {
  private readonly scheduleService: ScheduleControlTowerService;
  private readonly evidenceService: EvidenceService;
  private readonly evaluationService: EvaluationService;
  private readonly humanReviewService: HumanReviewService;

  constructor(
    scheduleService: ScheduleControlTowerService,
    evidenceService: EvidenceService,
    evaluationService: EvaluationService,
    humanReviewService: HumanReviewService
  ) {
    this.scheduleService = scheduleService;
    this.evidenceService = evidenceService;
    this.evaluationService = evaluationService;
    this.humanReviewService = humanReviewService;
  }

  public getContractSchedule = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      const referenceTimeIso =
        typeof req.query.referenceTimeIso === 'string'
          ? req.query.referenceTimeIso
          : undefined;
      const schedule = this.scheduleService.getContractSchedule(
        req.params.id,
        referenceTimeIso
      );
      res.status(200).json(schedule);
    } catch (err) {
      next(err);
    }
  };

  public analyzeScheduleRisk = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {};
      const milestoneId =
        typeof body.milestoneId === 'string' ? body.milestoneId : undefined;
      const recoveryDays =
        typeof body.recoveryDays === 'number' ? body.recoveryDays : undefined;
      const referenceTimeIso =
        typeof body.referenceTimeIso === 'string'
          ? body.referenceTimeIso
          : undefined;

      const result = this.scheduleService.analyzeScheduleRiskAndProposeRecovery(
        req.actor,
        req.params.id,
        { milestoneId, recoveryDays, referenceTimeIso }
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public reviewProposal = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {};
      const decision = String(body.decision ?? '').trim() as 'APPROVE' | 'REJECT';
      const reason = String(body.reason ?? body.justification ?? '').trim();
      const referenceTimeIso =
        typeof body.referenceTimeIso === 'string'
          ? body.referenceTimeIso
          : undefined;

      const result = this.scheduleService.reviewScheduleProposal(
        req.actor,
        req.params.id,
        req.params.proposalId,
        { decision, reason, referenceTimeIso }
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public loadDemoScenario = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const result = await this.scheduleService.loadControlTowerDemoScenario({
        contractId: req.params.id,
        evidenceService: this.evidenceService,
        evaluationService: this.evaluationService,
        humanReviewService: this.humanReviewService,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public captureBaseline = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {};
      const label = typeof body.label === 'string' ? body.label : undefined;
      const result = this.scheduleService.captureScheduleBaseline(
        req.actor,
        req.params.id,
        label
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getDownstreamImpact = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      const milestoneId = String(req.query.milestoneId || req.query.delayedMilestoneId || '');
      const delayDays = parseInt(String(req.query.delayDays || '7'), 10);
      if (!milestoneId) {
        throw new AppError(400, 'PARAM_REQUIRED', 'Query parameter milestoneId is required.');
      }
      const result = this.scheduleService.analyzeDownstreamDelayImpact(
        req.params.id,
        milestoneId,
        Number.isNaN(delayDays) ? 7 : delayDays
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public validateDependencies = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      const body =
        req.body && typeof req.body === 'object'
          ? (req.body as Record<string, unknown>)
          : {};
      const dependencies = Array.isArray(body.dependencies) ? body.dependencies : [];
      const schedule = this.scheduleService.getContractSchedule(req.params.id);
      const milestones = schedule.tasks.map((t) => ({
        id: t.milestoneId,
        title: t.name,
      })) as any;
      const result = this.scheduleService.validateDependencies(milestones, dependencies);
      if (!result.valid) {
        throw new AppError(400, 'CIRCULAR_DEPENDENCY_DETECTED', result.error || 'Invalid dependencies.');
      }
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
