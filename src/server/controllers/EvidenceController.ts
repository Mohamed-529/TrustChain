import type { EvidenceService } from '../services/EvidenceService.ts';
import type { EvaluationService } from '../services/EvaluationService.ts';
import type { GitHubVerificationService } from '../services/GitHubVerificationService.ts';
import type { EvidencePassportService } from '../services/EvidencePassportService.ts';
import type { ContractRepository } from '../repositories/DomainRepositories.ts';
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
  private readonly evidencePassportService?: EvidencePassportService;
  private readonly contractRepo?: ContractRepository;

  constructor(
    evidenceService: EvidenceService,
    evaluationService: EvaluationService,
    githubVerificationService?: GitHubVerificationService,
    evidencePassportService?: EvidencePassportService,
    contractRepo?: ContractRepository
  ) {
    this.evidenceService = evidenceService;
    this.evaluationService = evaluationService;
    this.githubVerificationService = githubVerificationService;
    this.evidencePassportService = evidencePassportService;
    this.contractRepo = contractRepo;
  }

  public submitEvidence = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }

      const bodyObj =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};

      // Support deterministic demo fixture loader if `{ demoFixtureKey }` is explicitly requested
      if (typeof bodyObj.demoFixtureKey === 'string') {
        const { demoFixtureKey, ...overrideFields } = bodyObj;
        const submission = this.evidenceService.submitDemoFixture(
          req.actor,
          req.params.id,
          demoFixtureKey as DemoFixtureKey,
          Object.keys(overrideFields).length > 0 ? (overrideFields as any) : undefined
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

  public getEvidencePassport = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      if (!this.evidencePassportService) {
        throw new AppError(
          503,
          'PASSPORT_SERVICE_UNAVAILABLE',
          'Evidence Passport service is not initialized.'
        );
      }

      const contractId = req.params.contractId || req.params.id;
      const milestoneId = req.params.milestoneId || req.params.id;
      if (!contractId || !milestoneId) {
        throw new AppError(400, 'BAD_REQUEST', 'contractId and milestoneId are required.');
      }

      // RBAC check: verify actor is part of the contract
      if (this.contractRepo) {
        const contract = this.contractRepo.findById(contractId);
        if (!contract) {
          throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${contractId}' not found.`);
        }

        const isParty =
          req.actor.id === contract.clientId ||
          req.actor.id === contract.developerId ||
          req.actor.id === contract.reviewerId;
        if (!isParty) {
          throw new AppError(
            403,
            'FORBIDDEN_NOT_CONTRACT_PARTY',
            'Only contract participants (Client, Developer, or Reviewer) may access the Evidence Passport.'
          );
        }
      }

      const previewUrl = typeof req.query.previewUrl === 'string' ? req.query.previewUrl : undefined;
      const healthEndpoint = typeof req.query.healthEndpoint === 'string' ? req.query.healthEndpoint : undefined;
      const artifactDigest = typeof req.query.artifactDigest === 'string' ? req.query.artifactDigest : undefined;

      const passport = await this.evidencePassportService.generatePassport(contractId, milestoneId, {
        previewUrl,
        healthEndpoint,
        artifactDigestSha256: artifactDigest,
      });

      res.status(200).json({ passport });
    } catch (err) {
      next(err);
    }
  };

  public validateRuntime = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      if (!this.evidencePassportService) {
        throw new AppError(
          503,
          'PASSPORT_SERVICE_UNAVAILABLE',
          'Evidence Passport service is not initialized.'
        );
      }

      const bodyObj = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const previewUrl = typeof bodyObj.previewUrl === 'string' ? bodyObj.previewUrl : undefined;
      const healthEndpoint = typeof bodyObj.healthEndpoint === 'string' ? bodyObj.healthEndpoint : undefined;

      const runtimeValidation = await this.evidencePassportService.executeRuntimeValidation(
        previewUrl,
        healthEndpoint,
        true
      );

      res.status(200).json({ runtimeValidation });
    } catch (err) {
      next(err);
    }
  };
}
