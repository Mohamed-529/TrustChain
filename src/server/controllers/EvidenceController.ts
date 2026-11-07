import type { EvidenceService } from '../services/EvidenceService.ts';
import type { EvaluationService } from '../services/EvaluationService.ts';
import type { GitHubVerificationService } from '../services/GitHubVerificationService.ts';
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
  private readonly githubVerificationService?: GitHubVerificationService;

  constructor(
    evidenceService: EvidenceService,
    evaluationService: EvaluationService,
    githubVerificationService?: GitHubVerificationService
  ) {
    this.evidenceService = evidenceService;
    this.evaluationService = evaluationService;
    this.githubVerificationService = githubVerificationService;
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

  public verifyProvenance = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      if (!this.githubVerificationService) {
        throw new AppError(
          503,
          'GITHUB_VERIFICATION_SERVICE_UNAVAILABLE',
          'GitHub verification service is not initialized.'
        );
      }

      const bodyObj =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const submissionId =
        typeof bodyObj.submissionId === 'string' && bodyObj.submissionId.trim().length > 0
          ? bodyObj.submissionId.trim()
          : undefined;

      const provenance =
        await this.githubVerificationService.verifyMilestoneEvidenceProvenance(
          req.actor,
          req.params.id,
          submissionId
        );
      res.status(200).json({ provenance });
    } catch (err) {
      next(err);
    }
  };

  public getProvenance = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!this.githubVerificationService) {
        throw new AppError(
          503,
          'GITHUB_VERIFICATION_SERVICE_UNAVAILABLE',
          'GitHub verification service is not initialized.'
        );
      }

      const latestProvenance = this.githubVerificationService.getLatestProvenance(
        req.params.id
      );
      const provenanceHistory = this.githubVerificationService.listProvenanceForMilestone(
        req.params.id
      );
      res.status(200).json({
        latestProvenance,
        provenanceHistory,
      });
    } catch (err) {
      next(err);
    }
  };

  public handleGitHubWebhook = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.githubVerificationService) {
        throw new AppError(
          503,
          'GITHUB_VERIFICATION_SERVICE_UNAVAILABLE',
          'GitHub verification service is not initialized.'
        );
      }

      const result = await this.githubVerificationService.handleGitHubWebhook(
        req.headers,
        req.body,
        req.rawBody
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
