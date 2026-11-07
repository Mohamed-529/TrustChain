import type { EvidenceService } from '../services/EvidenceService.ts';
import type { EvaluationService } from '../services/EvaluationService.ts';
import type { DemoFixtureKey } from '../services/DemoEvidenceFixtures.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
} from '../middleware/errorHandler.ts';

export class EvidenceController {
  private readonly evidenceService: EvidenceService;
  private readonly evaluationService: EvaluationService;

  constructor(evidenceService: EvidenceService, evaluationService: EvaluationService) {
    this.evidenceService = evidenceService;
    this.evaluationService = evaluationService;
  }

  public submitEvidence = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }

      const bodyObj =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

      // Support deterministic demo fixture loader if `{ demoFixtureKey }` is explicitly requested
      if (
        typeof bodyObj.demoFixtureKey === 'string' &&
        Object.keys(bodyObj).length === 1
      ) {
        const submission = this.evidenceService.submitDemoFixture(
          req.actor,
          req.params.id,
          bodyObj.demoFixtureKey as DemoFixtureKey
        );
        res.status(201).json({ submission });
        return;
      }

      const submission = this.evidenceService.submitEvidence(
        req.actor,
        req.params.id,
        req.body
      );
      res.status(201).json({ submission });
    } catch (err) {
      next(err);
    }
  };

  public listEvidence = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const submissions = this.evidenceService.listEvidenceForMilestone(req.params.id);
      res.status(200).json({ submissions });
    } catch (err) {
      next(err);
    }
  };

  public evaluateMilestone = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const evaluation = await this.evaluationService.evaluateMilestone(
        req.actor,
        req.params.id
      );
      res.status(200).json({ evaluation });
    } catch (err) {
      next(err);
    }
  };

  public listEvaluations = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const evaluations = this.evaluationService.listEvaluationsForMilestone(req.params.id);
      res.status(200).json({ evaluations });
    } catch (err) {
      next(err);
    }
  };

  public previewPolicy = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const body = req.body as {
        verifiedCriteriaCount: number;
        totalCriteriaCount: number;
        ciBuildPassed: boolean;
        criticalVulnCount: number;
        highVulnCount: number;
        scannerStatus: 'AVAILABLE' | 'UNAVAILABLE';
        submittedAtIso?: string;
      };
      const policyCalculation = this.evaluationService.previewSettlementPolicy(
        req.params.id,
        body
      );
      res.status(200).json({ policyCalculation });
    } catch (err) {
      next(err);
    }
  };
}
