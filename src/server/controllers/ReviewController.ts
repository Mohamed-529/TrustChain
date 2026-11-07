import type { HumanReviewService } from '../services/HumanReviewService.ts';
import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
} from '../middleware/errorHandler.ts';

export class ReviewController {
  private readonly humanReviewService: HumanReviewService;

  constructor(humanReviewService: HumanReviewService) {
    this.humanReviewService = humanReviewService;
  }

  public getReviewDetails = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      const details = this.humanReviewService.getMilestoneReviewDetails(req.params.id);
      res.status(200).json(details);
    } catch (err) {
      next(err);
    }
  };

  public submitReview = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const result = this.humanReviewService.submitReview(
        req.actor,
        req.params.id,
        req.body
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public approveMilestone = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const bodyObj =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const result = this.humanReviewService.submitReview(req.actor, req.params.id, {
        ...bodyObj,
        decision: 'APPROVE',
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public rejectMilestone = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const bodyObj =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const result = this.humanReviewService.submitReview(req.actor, req.params.id, {
        ...bodyObj,
        decision: 'REJECT',
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public requestChanges = (
    req: ApiRequest,
    res: ApiResponse,
    next: NextFunction
  ): void => {
    try {
      if (!req.actor) {
        throw new AppError(401, 'AUTH_TOKEN_REQUIRED', 'Authentication required.');
      }
      const bodyObj =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const result = this.humanReviewService.submitReview(req.actor, req.params.id, {
        ...bodyObj,
        decision: 'NEEDS_CHANGES',
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  public getLedger = (_req: ApiRequest, res: ApiResponse, next: NextFunction): void => {
    try {
      const rows = this.humanReviewService.getFinancialDecisionLedger();
      res.status(200).json({ rows });
    } catch (err) {
      next(err);
    }
  };
}
