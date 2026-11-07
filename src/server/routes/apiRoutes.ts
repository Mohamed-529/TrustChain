import fs from 'node:fs';
import path from 'node:path';
import type { AuthService } from '../services/AuthService.ts';
import type { AuthController } from '../controllers/AuthController.ts';
import type { ContractController } from '../controllers/ContractController.ts';
import type { EvidenceController } from '../controllers/EvidenceController.ts';
import type { ReviewController } from '../controllers/ReviewController.ts';
import { createAuthMiddleware, requireRole } from '../middleware/authMiddleware.ts';
import { OPENAPI_REQUEST_SCHEMAS, validateRequestSchema } from '../middleware/validateRequest.ts';
import type { RequestHandler } from '../middleware/errorHandler.ts';

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  pattern: string;
  handlers: RequestHandler[];
}

export class ApiRouter {
  public readonly routes: RouteDefinition[] = [];

  public get(pattern: string, ...handlers: RequestHandler[]): void {
    this.routes.push({ method: 'GET', pattern, handlers });
  }

  public post(pattern: string, ...handlers: RequestHandler[]): void {
    this.routes.push({ method: 'POST', pattern, handlers });
  }
}

export function createApiRouter(params: {
  authService: AuthService;
  authController: AuthController;
  contractController: ContractController;
  evidenceController: EvidenceController;
  reviewController: ReviewController;
}): ApiRouter {
  const router = new ApiRouter();
  const {
    authService,
    authController,
    contractController,
    evidenceController,
    reviewController,
  } = params;
  const authenticate = createAuthMiddleware(authService);

  // Public health check
  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'milestoneproof-ai-api',
      version: '1.0.0',
      runtime: process.version,
      capabilities: {
        sqlitePersistence: true,
        hmacSessionAuth: true,
        hashChainedAudit: true,
        demoImpersonationEnabled: authService.isDemoModeAllowed(),
        geminiConfigured: Boolean(
          process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        ),
        paypalConfigured: Boolean(
          process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
        ),
      },
    });
  });

  // Public OpenAPI 3.0.3 contract discovery endpoints (YAML & JSON)
  router.get('/openapi.yaml', (_req, res) => {
    const yamlPath = path.resolve(process.cwd(), 'openapi.yaml');
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    if (res.sendText) {
      res.status(200).sendText(yamlContent, 'text/yaml; charset=utf-8');
    } else {
      res.status(200).json({ openapiYaml: yamlContent });
    }
  });

  router.get('/openapi.json', (_req, res) => {
    res.status(200).json({
      openapi: '3.0.3',
      info: {
        title: 'MilestoneProof AI — Evidence-to-Settlement Orchestration API',
        version: '1.0.0',
      },
      specificationFile: '/api/v1/openapi.yaml',
      registeredRequestSchemas: Object.keys(OPENAPI_REQUEST_SCHEMAS),
      tags: [
        'System',
        'Auth',
        'Users',
        'Contracts',
        'Evidence',
        'Evaluations',
        'SettlementPolicy',
        'Approvals',
        'Payments',
        'Audit',
      ],
    });
  });

  // Public authentication endpoints
  router.post('/auth/login', authController.login);
  router.post('/auth/demo-switch', authController.demoSwitch);

  // Protected authentication endpoints
  router.get('/auth/me', authenticate, authController.me);
  router.post('/auth/logout', authenticate, authController.logout);

  // Protected domain endpoints
  router.get('/users', authenticate, contractController.listUsers);
  router.get('/contracts', authenticate, contractController.listContracts);
  router.get('/contracts/:id', authenticate, contractController.getContract);
  router.post(
    '/contracts',
    authenticate,
    requireRole(['CLIENT']),
    contractController.createContract
  );
  router.post(
    '/contracts/:id/activate',
    authenticate,
    requireRole(['CLIENT']),
    contractController.activateContract
  );

  // Protected Phase 3 Evidence Ingestion & Multi-Agent AI Evaluation endpoints
  router.post(
    '/milestones/:id/evidence',
    authenticate,
    requireRole(['DEVELOPER']),
    evidenceController.submitEvidence
  );
  router.get('/milestones/:id/evidence', authenticate, evidenceController.listEvidence);
  router.post('/milestones/:id/evaluate', authenticate, evidenceController.evaluateMilestone);
  router.get('/milestones/:id/evaluations', authenticate, evidenceController.listEvaluations);
  router.post(
    '/milestones/:id/policy-preview',
    authenticate,
    validateRequestSchema('PolicyPreviewRequest'),
    evidenceController.previewPolicy
  );

  // Protected Phase 4 Human Review Workflow & Financial Decision Ledger endpoints
  router.get('/milestones/:id/review', authenticate, reviewController.getReviewDetails);
  router.post('/milestones/:id/review', authenticate, reviewController.submitReview);
  router.post(
    '/milestones/:id/review/approve',
    authenticate,
    reviewController.approveMilestone
  );
  router.post(
    '/milestones/:id/review/reject',
    authenticate,
    reviewController.rejectMilestone
  );
  router.post(
    '/milestones/:id/review/request-changes',
    authenticate,
    reviewController.requestChanges
  );
  router.get('/ledger', authenticate, reviewController.getLedger);

  // Protected tamper-evident audit endpoints
  router.get('/audit', authenticate, contractController.listAuditLogs);
  router.get('/audit/verify', authenticate, contractController.verifyAuditChain);

  return router;
}
