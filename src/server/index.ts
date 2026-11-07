import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppDatabase } from './repositories/Database.ts';
import {
  ContractRepository,
  EvaluationRepository,
  EvidenceRepository,
  HumanApprovalRepository,
  MilestoneRepository,
  PaymentTransactionRepository,
  ScheduleProposalRepository,
  SessionRepository,
  UserRepository,
  WebhookEventRepository,
} from './repositories/DomainRepositories.ts';
import { AuditService } from './services/AuditService.ts';
import { AuthService, type AuthServiceOptions } from './services/AuthService.ts';
import { ContractService } from './services/ContractService.ts';
import { EvidenceService } from './services/EvidenceService.ts';
import {
  EvaluationService,
  type MultiAgentEvaluatorProvider,
} from './services/EvaluationService.ts';
import { SettlementPolicyService } from './services/SettlementPolicyService.ts';
import { HumanReviewService } from './services/HumanReviewService.ts';
import { ScheduleControlTowerService } from './services/ScheduleControlTowerService.ts';
import { PayPalService, type PayPalServiceOptions } from './services/PayPalService.ts';
import { AuthController } from './controllers/AuthController.ts';
import { ContractController } from './controllers/ContractController.ts';
import { EvidenceController } from './controllers/EvidenceController.ts';
import { ReviewController } from './controllers/ReviewController.ts';
import { ScheduleController } from './controllers/ScheduleController.ts';
import { PaymentController } from './controllers/PaymentController.ts';
import { createApiRouter, type RouteDefinition } from './routes/apiRoutes.ts';
import {
  AppError,
  errorHandler,
  type ApiRequest,
  type ApiResponse,
} from './middleware/errorHandler.ts';

// Load .env file using Node.js v24 native process.loadEnvFile if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
} catch {
  // Ignore .env load error if not present
}

export type HttpAppListener = (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => void;

export interface HttpApp extends HttpAppListener {
  useFallback(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): void;
}

function matchRoutePattern(
  routePattern: string,
  actualPath: string
): Record<string, string> | null {
  const routeParts = routePattern.split('/').filter(Boolean);
  const pathParts = actualPath.split('/').filter(Boolean);
  if (routeParts.length !== pathParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    const rPart = routeParts[i];
    const pPart = pathParts[i];
    if (rPart.startsWith(':')) {
      params[rPart.slice(1)] = decodeURIComponent(pPart);
    } else if (rPart !== pPart) {
      return null;
    }
  }
  return params;
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const maxBytes = 512 * 1024; // 512 KB

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request payload exceeds 512KB limit.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const rawText = Buffer.concat(chunks).toString('utf8').trim();
      if (!rawText) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(rawText));
      } catch {
        reject(new AppError(400, 'INVALID_JSON_BODY', 'Request body is not valid JSON.'));
      }
    });

    req.on('error', (err) => reject(err));
  });
}

function createMountedHttpApp(prefix: string, routes: RouteDefinition[]): HttpApp {
  let fallbackHandler: ((req: http.IncomingMessage, res: http.ServerResponse) => void) | null =
    null;

  const listener = async (
    rawReq: http.IncomingMessage,
    rawRes: http.ServerResponse
  ): Promise<void> => {
    const method = (rawReq.method ?? 'GET').toUpperCase();
    const originalUrl = rawReq.url ?? '/';
    const parsedUrl = new URL(originalUrl, 'http://localhost');
    const pathname = parsedUrl.pathname;

    if (!pathname.startsWith(prefix)) {
      if (fallbackHandler) {
        fallbackHandler(rawReq, rawRes);
        return;
      }
      rawRes.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      rawRes.end(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: `Resource '${pathname}' not found.`,
            details: {},
            timestamp: new Date().toISOString(),
          },
        })
      );
      return;
    }

    const subPath = pathname.slice(prefix.length) || '/';
    const query: Record<string, string | undefined> = {};
    for (const [k, v] of parsedUrl.searchParams.entries()) {
      query[k] = v;
    }

    let statusCode = 200;
    const apiRes: ApiResponse = {
      headersSent: false,
      status(code: number) {
        statusCode = code;
        return apiRes;
      },
      json(payload: unknown) {
        if (apiRes.headersSent || rawRes.writableEnded) {
          return;
        }
        apiRes.headersSent = true;
        const bodyStr = JSON.stringify(payload);
        rawRes.writeHead(statusCode, {
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(bodyStr),
        });
        rawRes.end(bodyStr);
      },
      sendText(body: string, contentType = 'text/plain; charset=utf-8') {
        if (apiRes.headersSent || rawRes.writableEnded) {
          return;
        }
        apiRes.headersSent = true;
        rawRes.writeHead(statusCode, {
          'content-type': contentType,
          'content-length': Buffer.byteLength(body),
        });
        rawRes.end(body);
      },
    };

    const apiReq: ApiRequest = {
      method,
      url: originalUrl,
      originalUrl,
      path: pathname,
      headers: rawReq.headers as Record<string, string | string[] | undefined>,
      params: {},
      query,
      body: {},
    };

    // Match route
    let matchedRoute: RouteDefinition | null = null;
    let matchedParams: Record<string, string> = {};
    for (const route of routes) {
      if (route.method === method) {
        const params = matchRoutePattern(route.pattern, subPath);
        if (params !== null) {
          matchedRoute = route;
          matchedParams = params;
          break;
        }
      }
    }

    if (!matchedRoute) {
      apiRes.status(404).json({
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: `API endpoint '${method} ${originalUrl}' does not exist.`,
          details: {},
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    apiReq.params = matchedParams;

    try {
      if (method === 'POST' || method === 'PUT') {
        apiReq.body = await readJsonBody(rawReq);
      }

      const handlers = matchedRoute.handlers;
      let idx = 0;

      const next = (err?: unknown): void => {
        if (err !== undefined) {
          errorHandler(err, apiReq, apiRes, () => {});
          return;
        }
        if (idx >= handlers.length || apiRes.headersSent) {
          return;
        }
        const currentHandler = handlers[idx++];
        try {
          const maybePromise = currentHandler(apiReq, apiRes, next);
          if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
            (maybePromise as Promise<void>).catch((asyncErr) => {
              errorHandler(asyncErr, apiReq, apiRes, () => {});
            });
          }
        } catch (syncErr) {
          errorHandler(syncErr, apiReq, apiRes, () => {});
        }
      };

      next();
    } catch (err) {
      errorHandler(err, apiReq, apiRes, () => {});
    }
  };

  const app = ((req: http.IncomingMessage, res: http.ServerResponse) => {
    void listener(req, res);
  }) as HttpApp;

  app.useFallback = (handler) => {
    fallbackHandler = handler;
  };

  return app;
}

export interface ServerContainer {
  app: HttpApp;
  db: AppDatabase;
  userRepo: UserRepository;
  sessionRepo: SessionRepository;
  contractRepo: ContractRepository;
  milestoneRepo: MilestoneRepository;
  evidenceRepo: EvidenceRepository;
  evaluationRepo: EvaluationRepository;
  approvalRepo: HumanApprovalRepository;
  proposalRepo: ScheduleProposalRepository;
  paymentRepo: PaymentTransactionRepository;
  webhookEventRepo: WebhookEventRepository;
  auditService: AuditService;
  authService: AuthService;
  contractService: ContractService;
  evidenceService: EvidenceService;
  evaluationService: EvaluationService;
  settlementPolicyService: SettlementPolicyService;
  humanReviewService: HumanReviewService;
  scheduleControlTowerService: ScheduleControlTowerService;
  paypalService: PayPalService;
}

export function createServerApp(options?: {
  dbPath?: string;
  authOptions?: AuthServiceOptions;
  evaluatorProvider?: MultiAgentEvaluatorProvider;
  paypalOptions?: PayPalServiceOptions;
}): ServerContainer {
  const db = new AppDatabase(options?.dbPath);
  const userRepo = new UserRepository(db.raw);
  const sessionRepo = new SessionRepository(db.raw);
  const milestoneRepo = new MilestoneRepository(db.raw);
  const contractRepo = new ContractRepository(db.raw, milestoneRepo);
  const evidenceRepo = new EvidenceRepository(db.raw);
  const evaluationRepo = new EvaluationRepository(db.raw);
  const approvalRepo = new HumanApprovalRepository(db.raw);
  const proposalRepo = new ScheduleProposalRepository(db.raw, milestoneRepo);
  const paymentRepo = new PaymentTransactionRepository(db.raw);
  const webhookEventRepo = new WebhookEventRepository(db.raw);
  const auditService = new AuditService(db.raw);

  const authService = new AuthService(
    db,
    userRepo,
    sessionRepo,
    auditService,
    options?.authOptions
  );

  const contractService = new ContractService(
    db,
    userRepo,
    contractRepo,
    milestoneRepo,
    auditService
  );

  const evidenceService = new EvidenceService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    auditService
  );

  const evaluationService = new EvaluationService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    evaluationRepo,
    auditService,
    options?.evaluatorProvider
  );

  const settlementPolicyService = new SettlementPolicyService(
    contractRepo,
    milestoneRepo
  );

  const humanReviewService = new HumanReviewService(
    db,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    evaluationRepo,
    approvalRepo,
    settlementPolicyService,
    auditService,
    paymentRepo
  );

  const scheduleControlTowerService = new ScheduleControlTowerService(
    db,
    userRepo,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    evaluationRepo,
    approvalRepo,
    proposalRepo,
    auditService
  );

  const paypalService = new PayPalService(
    db,
    contractRepo,
    milestoneRepo,
    evaluationRepo,
    approvalRepo,
    paymentRepo,
    settlementPolicyService,
    auditService,
    {
      webhookEventRepo,
      ...options?.paypalOptions,
    }
  );

  const authController = new AuthController(authService);
  const contractController = new ContractController(
    contractService,
    userRepo,
    auditService
  );
  const evidenceController = new EvidenceController(
    evidenceService,
    evaluationService
  );
  const reviewController = new ReviewController(humanReviewService);
  const scheduleController = new ScheduleController(
    scheduleControlTowerService,
    evidenceService,
    evaluationService,
    humanReviewService
  );
  const paymentController = new PaymentController(paypalService);

  const apiRouter = createApiRouter({
    authService,
    authController,
    contractController,
    evidenceController,
    reviewController,
    scheduleController,
    paymentController,
  });

  const app = createMountedHttpApp('/api/v1', apiRouter.routes);

  return {
    app,
    db,
    userRepo,
    sessionRepo,
    contractRepo,
    milestoneRepo,
    evidenceRepo,
    evaluationRepo,
    approvalRepo,
    proposalRepo,
    paymentRepo,
    webhookEventRepo,
    auditService,
    authService,
    contractService,
    evidenceService,
    evaluationService,
    settlementPolicyService,
    humanReviewService,
    scheduleControlTowerService,
    paypalService,
  };
}

async function startDevOrProdServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';
  const { app } = createServerApp({
    authOptions: {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      enableDemoImpersonation:
        process.env.ENABLE_DEMO_IMPERSONATION !== undefined
          ? process.env.ENABLE_DEMO_IMPERSONATION === 'true'
          : !isProd,
    },
  });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(__dirname, '../..');

  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.useFallback((req, res) => {
        vite.middlewares(req, res);
      });
    } catch {
      // When node_modules/vite is not yet installed, serve index.html on root requests
      app.useFallback((req, res) => {
        const indexHtmlPath = path.join(rootDir, 'index.html');
        if ((req.url === '/' || req.url === '/index.html') && fs.existsSync(indexHtmlPath)) {
          const html = fs.readFileSync(indexHtmlPath, 'utf8');
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end(html);
          return;
        }
        res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            error: {
              code: 'FRONTEND_ASSET_NOT_BUILT',
              message: `Vite middleware unavailable (node_modules not installed) for path '${req.url}'.`,
            },
          })
        );
      });
    }
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.useFallback((req, res) => {
      const indexHtmlPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        const html = fs.readFileSync(indexHtmlPath, 'utf8');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: `Not found: ${req.url}` } }));
    });
  }

  const server = http.createServer(app);
  server.listen(port, '0.0.0.0', () => {
    console.log(`MilestoneProof AI server listening on http://localhost:${port}`);
  });
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  startDevOrProdServer().catch((err) => {
    console.error('Failed to start MilestoneProof AI server:', err);
    process.exit(1);
  });
}
