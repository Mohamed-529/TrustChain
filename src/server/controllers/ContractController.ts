import type { ContractService } from '../services/ContractService.ts';
import type { AuditService } from '../services/AuditService.ts';
import type { AuditReplayService } from '../services/AuditReplayService.ts';
import type { UserRepository } from '../repositories/DomainRepositories.ts';
import type { ReplayMode } from '../../types/domain.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
} from '../middleware/errorHandler.ts';

export class ContractController {
  private readonly contractService: ContractService;
  private readonly userRepo: UserRepository;
  private readonly auditService: AuditService;
  private readonly auditReplayService?: AuditReplayService;

  constructor(
    contractService: ContractService,
    userRepo: UserRepository,
    auditService: AuditService,
    auditReplayService?: AuditReplayService
  ) {
    this.contractService = contractService;
    this.userRepo = userRepo;
    this.auditService = auditService;
    this.auditReplayService = auditReplayService;
  }

  public listUsers = (_req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      res.status(200).json({ users: this.userRepo.listAll() });
    } catch (err) {
      next(err);
    }
  };

  public listContracts = (_req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      res.status(200).json({ contracts: this.contractService.listContracts() });
    } catch (err) {
      next(err);
    }
  };

  public getContract = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const contract = this.contractService.getContractById(req.params.id);
      res.status(200).json({ contract });
    } catch (err) {
      next(err);
    }
  };

  public createContract = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const contract = this.contractService.createContract(req.actor, req.body);
      res.status(201).json({ contract });
    } catch (err) {
      next(err);
    }
  };

  public activateContract = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const contract = this.contractService.activateContract(req.actor, req.params.id);
      res.status(200).json({ contract });
    } catch (err) {
      next(err);
    }
  };

  public listAuditLogs = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const contractId =
        typeof req.query.contractId === 'string' ? req.query.contractId : undefined;
      const milestoneId =
        typeof req.query.milestoneId === 'string' ? req.query.milestoneId : undefined;
      const entityId =
        typeof req.query.entityId === 'string' ? req.query.entityId : undefined;

      const logs = this.auditService.listLogs({ contractId, milestoneId, entityId });
      res.status(200).json({ logs });
    } catch (err) {
      next(err);
    }
  };

  public verifyAuditChain = (_req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const verification = this.auditService.verifyChain();
      res.status(200).json(verification);
    } catch (err) {
      next(err);
    }
  };

  public replayContractAudit = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      if (!this.auditReplayService) {
        throw new AppError(500, 'AUDIT_REPLAY_SERVICE_UNAVAILABLE', 'AuditReplayService not configured.');
      }
      const contract = this.contractService.getContractById(req.params.id);
      if (
        req.actor.id !== contract.clientId &&
        req.actor.id !== contract.developerId &&
        req.actor.id !== contract.reviewerId
      ) {
        throw new AppError(
          403,
          'FORBIDDEN_NOT_CONTRACT_PARTY',
          `Actor '${req.actor.id}' is not an authorized party to contract '${contract.id}'.`
        );
      }

      const mode = typeof req.query.mode === 'string' ? (req.query.mode as ReplayMode) : 'FULL';
      if (mode !== 'FULL' && mode !== 'PARTIAL' && mode !== 'VERIFY_ONLY') {
        throw new AppError(400, 'INVALID_PARAMETER', "mode must be 'FULL', 'PARTIAL', or 'VERIFY_ONLY'.");
      }

      const upToSeq = req.query.upToSeq !== undefined ? Number(req.query.upToSeq) : undefined;
      const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;

      const result = this.auditReplayService.replayContractAudit({
        contractId: contract.id,
        mode,
        upToSeq,
        limit,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public verifyContractAudit = (req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      if (!this.auditReplayService) {
        throw new AppError(500, 'AUDIT_REPLAY_SERVICE_UNAVAILABLE', 'AuditReplayService not configured.');
      }
      const contract = this.contractService.getContractById(req.params.id);
      if (
        req.actor.id !== contract.clientId &&
        req.actor.id !== contract.developerId &&
        req.actor.id !== contract.reviewerId
      ) {
        throw new AppError(
          403,
          'FORBIDDEN_NOT_CONTRACT_PARTY',
          `Actor '${req.actor.id}' is not an authorized party to contract '${contract.id}'.`
        );
      }

      const result = this.auditReplayService.verifyContractAudit(contract.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
