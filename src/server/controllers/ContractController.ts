import type { ContractService } from '../services/ContractService.ts';
import type { AuditService } from '../services/AuditService.ts';
import type { UserRepository } from '../repositories/DomainRepositories.ts';
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

  constructor(
    contractService: ContractService,
    userRepo: UserRepository,
    auditService: AuditService
  ) {
    this.contractService = contractService;
    this.userRepo = userRepo;
    this.auditService = auditService;
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
}
