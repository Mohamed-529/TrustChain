import type { DisputeEvidencePackService } from '../services/DisputeEvidencePackService.ts';
import type {
  ContractRepository,
  MilestoneRepository,
} from '../repositories/DomainRepositories.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
} from '../middleware/errorHandler.ts';

export class DisputeController {
  private readonly disputeEvidencePackService: DisputeEvidencePackService;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;

  constructor(
    disputeEvidencePackService: DisputeEvidencePackService,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository
  ) {
    this.disputeEvidencePackService = disputeEvidencePackService;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
  }

  /**
   * Helper to ensure caller is an authenticated actor belonging to the contract.
   */
  private assertContractParty(actorId: string, contractId: string) {
    const contract = this.contractRepo.findById(contractId);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${contractId}' not found.`);
    }

    const isParty =
      actorId === contract.clientId ||
      actorId === contract.developerId ||
      actorId === contract.reviewerId;
    if (!isParty) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_CONTRACT_PARTY',
        'Only contract participants (Client, Developer, or Reviewer) may access Dispute Evidence Packs.'
      );
    }

    return contract;
  }

  public generateDisputePack = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }

      const contractId = req.params.contractId;
      const milestoneId = req.params.milestoneId;
      if (!contractId || !milestoneId) {
        throw new AppError(400, 'BAD_REQUEST', 'contractId and milestoneId are required.');
      }

      this.assertContractParty(req.actor.id, contractId);

      const milestone = this.milestoneRepo.findById(milestoneId);
      if (!milestone || milestone.contractId !== contractId) {
        throw new AppError(
          404,
          'MILESTONE_NOT_FOUND',
          `Milestone '${milestoneId}' not found in contract '${contractId}'.`
        );
      }

      const bodyObj =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const reason = typeof bodyObj.reason === 'string' ? bodyObj.reason : undefined;
      const notes = typeof bodyObj.notes === 'string' ? bodyObj.notes : undefined;

      const disputePack = await this.disputeEvidencePackService.generateDisputePack(
        contractId,
        milestoneId,
        req.actor.id,
        { reason, notes }
      );

      res.status(201).json({ disputePack });
    } catch (err) {
      next(err);
    }
  };

  public getDisputePack = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }

      const contractId = req.params.contractId;
      const packId = req.params.packId;
      if (!contractId || !packId) {
        throw new AppError(400, 'BAD_REQUEST', 'contractId and packId are required.');
      }

      this.assertContractParty(req.actor.id, contractId);

      const disputePack = this.disputeEvidencePackService.getDisputePack(contractId, packId);
      res.status(200).json({ disputePack });
    } catch (err) {
      next(err);
    }
  };

  public verifyDisputePack = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }

      const contractId = req.params.contractId;
      const packId = req.params.packId;
      if (!contractId || !packId) {
        throw new AppError(400, 'BAD_REQUEST', 'contractId and packId are required.');
      }

      this.assertContractParty(req.actor.id, contractId);

      const verification = this.disputeEvidencePackService.verifyDisputePack(contractId, packId);
      res.status(200).json({ verification });
    } catch (err) {
      next(err);
    }
  };

  public exportDisputePack = async (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }

      const contractId = req.params.contractId;
      const packId = req.params.packId;
      if (!contractId || !packId) {
        throw new AppError(400, 'BAD_REQUEST', 'contractId and packId are required.');
      }

      this.assertContractParty(req.actor.id, contractId);

      const exportResult = this.disputeEvidencePackService.exportDisputePack(contractId, packId);
      res.status(200).json({ export: exportResult });
    } catch (err) {
      next(err);
    }
  };
}
