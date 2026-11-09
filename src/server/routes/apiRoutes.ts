import fs from 'node:fs';
import path from 'node:path';
import type { AuthService } from '../services/AuthService.ts';
import type { AuthController } from '../controllers/AuthController.ts';
import type { ContractController } from '../controllers/ContractController.ts';
import type { EvidenceController } from '../controllers/EvidenceController.ts';
import type { ReviewController } from '../controllers/ReviewController.ts';
import type { ScheduleController } from '../controllers/ScheduleController.ts';
import type { PaymentController } from '../controllers/PaymentController.ts';
import type { DisputeController } from '../controllers/DisputeController.ts';
import type { AppDatabase } from '../repositories/Database.ts';
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
  scheduleController: ScheduleController;
  paymentController: PaymentController;
  disputeController: DisputeController;
  db?: AppDatabase;
}): ApiRouter {
  const router = new ApiRouter();
  const {
    authService,
    authController,
    contractController,
    evidenceController,
    reviewController,
    scheduleController,
    paymentController,
    disputeController,
    db,
  } = params;
  const authenticate = createAuthMiddleware(authService);

  // Public health check with engine latency
  router.get('/health', (_req, res) => {
    let pingLatencyMs = 0;
    try {
      if (db) {
        pingLatencyMs = db.ping().latencyMs;
      }
    } catch {
      // Ignore ping failure in liveness check
    }

    res.status(200).json({
      status: 'ok',
      service: 'milestoneproof-ai-api',
      version: '1.0.0',
      runtime: process.version,
      databaseLatencyMs: pingLatencyMs,
      capabilities: {
        sqlitePersistence: true,
        hmacSessionAuth: true,
        hashChainedAudit: true,
        demoImpersonationEnabled: authService.isDemoModeAllowed(),
        geminiConfigured: Boolean(
          process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        ),
        paypalConfigured: Boolean(
          (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) ||
          (process.env.PAYPAL_ACCESS_TOKEN && process.env.PAYPAL_ACCESS_TOKEN.trim().length > 0)
        ),
        paypalWebhookConfigured: Boolean(
          process.env.PAYPAL_WEBHOOK_ID &&
            process.env.PAYPAL_WEBHOOK_ID.trim().length > 0 &&
            process.env.PAYPAL_WEBHOOK_ID !== 'YOUR_PAYPAL_WEBHOOK_ID'
        ),
        githubConfigured: Boolean(
          process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN !== 'MY_GITHUB_TOKEN'
        ),
        githubWebhookConfigured: Boolean(
          process.env.GITHUB_WEBHOOK_SECRET &&
            process.env.GITHUB_WEBHOOK_SECRET !== 'MY_GITHUB_WEBHOOK_SECRET'
        ),
      },
    });
  });

  // Public deep operational readiness probe
  router.get('/ready', (_req, res) => {
    let dbStatus = { ok: true, latencyMs: 0 };
    let migrationVersion = 0;
    try {
      if (db) {
        dbStatus = db.ping();
        const row = db.raw.prepare('SELECT MAX(version) as v FROM schema_migrations;').get() as { v?: number };
        migrationVersion = row?.v ?? 0;
      }
    } catch (dbErr) {
      res.status(503).json({
        status: 'not_ready',
        service: 'milestoneproof-ai-api',
        ready: false,
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const mem = process.memoryUsage();
    res.status(200).json({
      status: 'ready',
      service: 'milestoneproof-ai-api',
      ready: true,
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        engine: 'node:sqlite',
        pingLatencyMs: dbStatus.latencyMs,
        migrationVersion,
        healthy: dbStatus.ok,
      },
      memory: {
        rssMb: Number((mem.rss / 1024 / 1024).toFixed(1)),
        heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(1)),
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Public OpenAPI 3.0.3 contract discovery endpoints (YAML & JSON)
  router.get('/openapi.yaml', (_req, res) => {
    const yamlPath = path.resolve(process.cwd(), 'openapi.yaml');
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    if (res.sendText) {
      res.status(200);
      res.sendText(yamlContent, 'text/yaml; charset=utf-8');
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
  router.get(
    '/contracts/:id/audit/replay',
    authenticate,
    contractController.replayContractAudit
  );
  router.get(
    '/contracts/:id/audit/verify',
    authenticate,
    contractController.verifyContractAudit
  );

  // Protected Phase 5 Bryntum Gantt Evidence-Aware Software Delivery Control Tower endpoints
  router.get('/contracts/:id/schedule', authenticate, scheduleController.getContractSchedule);
  router.post(
    '/contracts/:id/schedule/analyze-risk',
    authenticate,
    scheduleController.analyzeScheduleRisk
  );
  router.post(
    '/contracts/:id/schedule/proposals/:proposalId/review',
    authenticate,
    scheduleController.reviewProposal
  );
  router.post(
    '/contracts/:id/schedule/demo-scenario',
    authenticate,
    scheduleController.loadDemoScenario
  );

  // Protected Phase 3 Evidence Ingestion & Multi-Agent AI Evaluation endpoints
  router.post(
    '/milestones/:id/evidence',
    authenticate,
    requireRole(['DEVELOPER']),
    evidenceController.submitEvidence
  );
  router.get('/milestones/:id/evidence', authenticate, evidenceController.listEvidence);
  router.post(
    '/milestones/:id/evidence/verify',
    authenticate,
    evidenceController.verifyProvenance
  );
  router.get(
    '/milestones/:id/evidence/provenance',
    authenticate,
    evidenceController.getProvenance
  );
  router.post('/milestones/:id/evaluate', authenticate, evidenceController.evaluateMilestone);
  router.get('/milestones/:id/evaluations', authenticate, evidenceController.listEvaluations);
  router.post(
    '/milestones/:id/policy-preview',
    authenticate,
    validateRequestSchema('PolicyPreviewRequest'),
    evidenceController.previewPolicy
  );

  // Protected Evidence Passport endpoints
  router.get(
    '/contracts/:contractId/milestones/:milestoneId/evidence-passport',
    authenticate,
    evidenceController.getEvidencePassport
  );
  router.get(
    '/milestones/:milestoneId/evidence-passport',
    authenticate,
    evidenceController.getEvidencePassport
  );
  router.post(
    '/contracts/:contractId/milestones/:milestoneId/evidence-passport/runtime-validate',
    authenticate,
    evidenceController.validateRuntime
  );
  router.post(
    '/milestones/:milestoneId/evidence-passport/runtime-validate',
    authenticate,
    evidenceController.validateRuntime
  );

  // Protected Dispute Evidence Pack endpoints
  router.post(
    '/contracts/:contractId/milestones/:milestoneId/dispute-pack',
    authenticate,
    disputeController.generateDisputePack
  );
  router.get(
    '/contracts/:contractId/dispute-packs/:packId',
    authenticate,
    disputeController.getDisputePack
  );
  router.get(
    '/contracts/:contractId/dispute-packs/:packId/verify',
    authenticate,
    disputeController.verifyDisputePack
  );
  router.get(
    '/contracts/:contractId/dispute-packs/:packId/export',
    authenticate,
    disputeController.exportDisputePack
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

  // Protected Phase 5 PayPal Orders API v2 Settlement Engine endpoints
  router.post(
    '/milestones/:id/paypal/order',
    authenticate,
    paymentController.createOrder
  );
  router.post(
    '/milestones/:id/paypal/authorize',
    authenticate,
    paymentController.authorizeOrder
  );
  router.post(
    '/milestones/:id/paypal/capture',
    authenticate,
    paymentController.captureAuthorization
  );
  router.get(
    '/milestones/:id/paypal/transactions',
    authenticate,
    paymentController.listTransactions
  );
  router.get(
    '/milestones/:id/paypal/order-details',
    authenticate,
    paymentController.getOrderDetails
  );
  router.get(
    '/milestones/:id/paypal/reconcile',
    authenticate,
    paymentController.reconcilePayment
  );
  router.post(
    '/milestones/:id/paypal/reconcile',
    authenticate,
    paymentController.reconcilePayment
  );

  // Public (signature-verified) PayPal Sandbox & GitHub Webhook Notification endpoints
  router.post('/webhooks/paypal', paymentController.handleWebhook);
  router.post('/webhooks/github', evidenceController.handleGitHubWebhook);

  // Protected tamper-evident audit endpoints
  router.get('/audit', authenticate, contractController.listAuditLogs);
  router.get('/audit/verify', authenticate, contractController.verifyAuditChain);

  return router;
}
