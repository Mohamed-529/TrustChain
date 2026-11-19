import crypto from 'node:crypto';
import zlib from 'node:zlib';
import type { AppDatabase } from '../repositories/Database.ts';
import type {
  ContractRepository,
  MilestoneRepository,
  UserRepository,
} from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import type {
  AcceptanceCriterion,
  Contract,
  ContractPolicyRules,
  CreateContractInput,
  CreateMilestoneInput,
  Milestone,
  RequiredProofType,
  User,
  ParseSpecInput,
  ParsedContractSpec,
  ParsedMilestoneSpec,
} from '../../types/domain.ts';
import { AppError } from '../middleware/errorHandler.ts';

const VALID_PROOF_TYPES: RequiredProofType[] = [
  'CODE_COMMIT',
  'PULL_REQUEST',
  'CI_TESTS',
  'SECURITY_SCAN',
  'API_DOCS',
];

function isPositiveInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val > 0;
}

function isNonNegativeInteger(val: unknown): val is number {
  return typeof val === 'number' && Number.isInteger(val) && val >= 0;
}

function isValidIsoDateString(val: unknown): val is string {
  if (typeof val !== 'string' || !val.trim()) {
    return false;
  }
  const parsed = Date.parse(val);
  return !Number.isNaN(parsed);
}

export class ContractService {
  private readonly db: AppDatabase;
  private readonly userRepo: UserRepository;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly auditSvc: AuditService;

  constructor(
    db: AppDatabase,
    userRepo: UserRepository,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    auditSvc: AuditService
  ) {
    this.db = db;
    this.userRepo = userRepo;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.auditSvc = auditSvc;
  }

  public listContracts(): Contract[] {
    return this.contractRepo.listAll();
  }

  public getContractById(id: string): Contract {
    const contract = this.contractRepo.findById(id);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${id}' was not found.`);
    }
    return contract;
  }

  private validatePolicyRules(rules: unknown): ContractPolicyRules {
    if (!rules || typeof rules !== 'object') {
      throw new AppError(400, 'INVALID_POLICY_RULES', 'Contract policyRules object is required.');
    }
    const r = rules as Record<string, unknown>;
    if (
      typeof r.requirePassingCi !== 'boolean' ||
      typeof r.requireSecurityScan !== 'boolean' ||
      typeof r.allowPartialPayout !== 'boolean' ||
      !isNonNegativeInteger(r.maxAllowedCriticalVulns) ||
      !isNonNegativeInteger(r.maxAllowedHighVulns) ||
      !isNonNegativeInteger(r.latePenaltyDailyBps) ||
      r.latePenaltyDailyBps > 5000
    ) {
      throw new AppError(
        400,
        'INVALID_POLICY_RULES',
        'policyRules must specify valid boolean gates and non-negative integer thresholds (latePenaltyDailyBps <= 5000).'
      );
    }

    return {
      requirePassingCi: r.requirePassingCi,
      requireSecurityScan: r.requireSecurityScan,
      maxAllowedCriticalVulns: r.maxAllowedCriticalVulns,
      maxAllowedHighVulns: r.maxAllowedHighVulns,
      allowPartialPayout: r.allowPartialPayout,
      latePenaltyDailyBps: r.latePenaltyDailyBps,
    };
  }

  private validateMilestones(
    milestonesInput: unknown,
    totalBudgetCents: number
  ): CreateMilestoneInput[] {
    if (!Array.isArray(milestonesInput) || milestonesInput.length === 0) {
      throw new AppError(
        400,
        'MISSING_MILESTONES',
        'A contract must define at least one milestone.'
      );
    }

    let allocatedCentsSum = 0;
    const seenOrders = new Set<number>();
    const validatedMilestones: CreateMilestoneInput[] = [];

    for (let i = 0; i < milestonesInput.length; i++) {
      const m = milestonesInput[i] as Record<string, unknown>;
      if (!m || typeof m !== 'object') {
        throw new AppError(400, 'INVALID_MILESTONE', `Milestone at index ${i} is invalid.`);
      }

      if (typeof m.title !== 'string' || !m.title.trim()) {
        throw new AppError(400, 'INVALID_MILESTONE_TITLE', `Milestone #${i + 1} requires a title.`);
      }

      if (!isPositiveInteger(m.sequenceOrder)) {
        throw new AppError(
          400,
          'INVALID_MILESTONE_SEQUENCE',
          `Milestone '${m.title}' must have a positive integer sequenceOrder.`
        );
      }

      if (seenOrders.has(m.sequenceOrder)) {
        throw new AppError(
          400,
          'DUPLICATE_MILESTONE_SEQUENCE',
          `Duplicate milestone sequenceOrder ${m.sequenceOrder}.`
        );
      }
      seenOrders.add(m.sequenceOrder);

      if (!isPositiveInteger(m.agreedAmountCents)) {
        throw new AppError(
          400,
          'INVALID_MONETARY_AMOUNT',
          `Milestone '${m.title}' agreedAmountCents must be a positive integer in cents.`
        );
      }

      if (!isValidIsoDateString(m.deadlineIso)) {
        throw new AppError(
          400,
          'INVALID_DEADLINE_DATE',
          `Milestone '${m.title}' deadlineIso must be a valid ISO-8601 date string.`
        );
      }

      if (!Array.isArray(m.acceptanceCriteria) || m.acceptanceCriteria.length === 0) {
        throw new AppError(
          400,
          'MISSING_ACCEPTANCE_CRITERIA',
          `Milestone '${m.title}' must contain at least one acceptance criterion.`
        );
      }

      const criteria: AcceptanceCriterion[] = [];
      for (const rawCrit of m.acceptanceCriteria) {
        const c = rawCrit as Record<string, unknown>;
        if (
          !c ||
          typeof c.id !== 'string' ||
          !c.id.trim() ||
          typeof c.title !== 'string' ||
          !c.title.trim() ||
          typeof c.description !== 'string' ||
          !VALID_PROOF_TYPES.includes(c.requiredProofType as RequiredProofType)
        ) {
          throw new AppError(
            400,
            'INVALID_ACCEPTANCE_CRITERION',
            `Milestone '${m.title}' has an invalid acceptance criterion definition.`
          );
        }
        criteria.push({
          id: c.id.trim(),
          title: c.title.trim(),
          description: c.description.trim(),
          requiredProofType: c.requiredProofType as RequiredProofType,
        });
      }

      allocatedCentsSum += m.agreedAmountCents;
      validatedMilestones.push({
        sequenceOrder: m.sequenceOrder,
        title: m.title.trim(),
        description: typeof m.description === 'string' ? m.description.trim() : '',
        agreedAmountCents: m.agreedAmountCents,
        deadlineIso: m.deadlineIso,
        dependencyMilestoneIds: Array.isArray(m.dependencyMilestoneIds)
          ? m.dependencyMilestoneIds.map(String)
          : [],
        acceptanceCriteria: criteria,
      });
    }

    if (allocatedCentsSum !== totalBudgetCents) {
      throw new AppError(
        400,
        'BUDGET_MISMATCH',
        `Sum of milestone amounts (${allocatedCentsSum} cents) must equal totalBudgetCents (${totalBudgetCents} cents).`,
        { allocatedCentsSum, totalBudgetCents }
      );
    }

    return validatedMilestones;
  }

  /**
   * Creates a new contract and its milestones inside a single atomic SQLite transaction,
   * appending hash-chained audit logs in the same transaction.
   */
  public createContract(actor: User, rawInput: unknown): Contract {
    if (actor.role !== 'CLIENT') {
      throw new AppError(
        403,
        'FORBIDDEN_ROLE',
        'Only an authenticated CLIENT can create a contract.'
      );
    }

    if (!rawInput || typeof rawInput !== 'object') {
      throw new AppError(400, 'INVALID_CONTRACT_PAYLOAD', 'Contract request body is required.');
    }

    const input = rawInput as Partial<CreateContractInput>;
    if (typeof input.title !== 'string' || !input.title.trim()) {
      throw new AppError(400, 'INVALID_CONTRACT_TITLE', 'Contract title is required.');
    }

    if (input.currency !== 'USD') {
      throw new AppError(400, 'INVALID_CURRENCY', 'Contract currency must be USD.');
    }

    if (!isPositiveInteger(input.totalBudgetCents)) {
      throw new AppError(
        400,
        'INVALID_MONETARY_AMOUNT',
        'totalBudgetCents must be a positive integer in cents.'
      );
    }

    if (typeof input.developerId !== 'string' || !input.developerId.trim()) {
      throw new AppError(
        400,
        'INVALID_PARTICIPANTS',
        'developerId must be specified.'
      );
    }

    const developerId = input.developerId.trim();
    // Default reviewerId to the contract Client (actor.id) if omitted
    const reviewerId =
      typeof input.reviewerId === 'string' && input.reviewerId.trim()
        ? input.reviewerId.trim()
        : actor.id;

    if (developerId === reviewerId || developerId === actor.id) {
      throw new AppError(
        400,
        'SEPARATION_OF_DUTIES_VIOLATION',
        'The assigned Developer cannot be the Client or the Financial Reviewer for the same contract.',
        { clientId: actor.id, developerId, reviewerId }
      );
    }

    const devUser = this.userRepo.findById(developerId);
    if (!devUser || devUser.role !== 'DEVELOPER') {
      throw new AppError(
        400,
        'INVALID_DEVELOPER_USER',
        `User '${developerId}' is not a valid active DEVELOPER.`
      );
    }

    const revUser = this.userRepo.findById(reviewerId);
    if (!revUser || (revUser.role !== 'REVIEWER' && revUser.role !== 'CLIENT')) {
      throw new AppError(
        400,
        'INVALID_REVIEWER_USER',
        `User '${reviewerId}' is not a valid active REVIEWER or CLIENT.`
      );
    }

    const policyRules = this.validatePolicyRules(input.policyRules);
    const totalBudgetCents = input.totalBudgetCents;
    const validatedMilestones = this.validateMilestones(input.milestones, totalBudgetCents);

    const nowIso = new Date().toISOString();
    const contractId = `contract_${crypto.randomUUID()}`;
    const title = input.title.trim();
    const description = typeof input.description === 'string' ? input.description.trim() : '';

    return this.db.withTransaction(() => {
      const contractHeader: Omit<Contract, 'milestones'> = {
        id: contractId,
        title,
        description,
        totalBudgetCents,
        currency: 'USD',
        clientId: actor.id,
        developerId,
        reviewerId,
        policyRules,
        status: 'DRAFT',
        version: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      this.contractRepo.insert(contractHeader);

      const createdMilestones: Milestone[] = [];
      for (const mInput of validatedMilestones) {
        const milestoneId = `ms_${crypto.randomUUID()}`;
        const milestone: Milestone = {
          id: milestoneId,
          contractId,
          sequenceOrder: mInput.sequenceOrder,
          title: mInput.title,
          description: mInput.description,
          agreedAmountCents: mInput.agreedAmountCents,
          deadlineIso: mInput.deadlineIso,
          dependencyMilestoneIds: mInput.dependencyMilestoneIds ?? [],
          acceptanceCriteria: mInput.acceptanceCriteria,
          status: 'DRAFT',
          paymentStatus: 'NOT_READY',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        this.milestoneRepo.insert(milestone);
        createdMilestones.push(milestone);
      }

      this.auditSvc.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CONTRACT_CREATED',
        entityType: 'CONTRACT',
        entityId: contractId,
        contractId,
        previousState: null,
        newState: 'DRAFT',
        payload: {
          title,
          totalBudgetCents,
          currency: 'USD',
          developerId,
          reviewerId,
          milestoneCount: createdMilestones.length,
        },
        timestamp: nowIso,
      });

      return {
        ...contractHeader,
        milestones: createdMilestones,
      };
    });
  }

  /**
   * Transitions a contract and its milestones from DRAFT to ACTIVE inside an atomic
   * SQLite transaction. Once ACTIVE, contractual terms are immutable without a formal amendment.
   */
  public activateContract(actor: User, contractId: string): Contract {
    if (actor.role !== 'CLIENT') {
      throw new AppError(
        403,
        'FORBIDDEN_ROLE',
        'Only an authenticated CLIENT can activate a contract.'
      );
    }

    const existing = this.getContractById(contractId);
    if (existing.clientId !== actor.id) {
      throw new AppError(
        403,
        'NOT_CONTRACT_OWNER',
        'Only the Client who owns this contract can activate it.'
      );
    }

    if (existing.status !== 'DRAFT') {
      throw new AppError(
        409,
        'CONTRACT_ALREADY_ACTIVE',
        `Contract '${contractId}' is in state '${existing.status}' and cannot be activated again.`
      );
    }

    const nowIso = new Date().toISOString();

    return this.db.withTransaction(() => {
      const updated = this.contractRepo.updateStatusAndIncrementVersion(
        contractId,
        existing.version,
        'ACTIVE',
        nowIso
      );
      if (!updated) {
        throw new AppError(
          409,
          'CONCURRENT_MODIFICATION',
          'Contract version changed concurrently; please retry.'
        );
      }

      this.milestoneRepo.updateStatusByContractId(contractId, 'ACTIVE', nowIso);

      this.auditSvc.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'CONTRACT_ACTIVATED',
        entityType: 'CONTRACT',
        entityId: contractId,
        contractId,
        previousState: 'DRAFT',
        newState: 'ACTIVE',
        payload: {
          previousVersion: existing.version,
          newVersion: existing.version + 1,
          totalBudgetCents: existing.totalBudgetCents,
        },
        timestamp: nowIso,
      });

      return this.getContractById(contractId);
    });
  }

  /**
   * Resets demo contract state (specifically contract_seed_01) back to fresh clean state.
   * Safe for demo reproducibility; only allowed for demo seed contracts in non-production environments.
   */
  public resetDemoContract(actor: User, contractId: string): Contract {
    if (contractId !== 'contract_seed_01') {
      throw new AppError(400, 'CANNOT_RESET_NON_DEMO_CONTRACT', 'Only the demo seed contract (contract_seed_01) can be reset.');
    }

    const now = new Date().toISOString();
    return this.db.withTransaction(() => {
      // 1. Delete transactions, approvals, evaluations, and evidence submissions for ms_seed_01, ms_seed_02, ms_seed_03
      const milestoneIds = ['ms_seed_01', 'ms_seed_02', 'ms_seed_03'];
      for (const msId of milestoneIds) {
        this.db.raw.prepare('DELETE FROM payment_transactions WHERE milestone_id = ?').run(msId);
        this.db.raw.prepare('DELETE FROM human_approvals WHERE milestone_id = ?').run(msId);
        this.db.raw.prepare('DELETE FROM ai_evaluations WHERE milestone_id = ?').run(msId);
        this.db.raw.prepare('DELETE FROM evidence_provenance_verifications WHERE milestone_id = ?').run(msId);
        this.db.raw.prepare('DELETE FROM evidence_submissions WHERE milestone_id = ?').run(msId);
        this.db.raw.prepare('DELETE FROM evidence_passports WHERE milestone_id = ?').run(msId);
        this.db.raw.prepare('DELETE FROM dispute_evidence_packs WHERE milestone_id = ?').run(msId);
      }

      // 2. Reset milestones back to ACTIVE / NOT_READY
      this.db.raw.prepare(`
        UPDATE milestones
        SET status = 'ACTIVE', payment_status = 'NOT_READY', updated_at = ?
        WHERE contract_id = ?
      `).run(now, contractId);

      // 3. Reset contract status
      this.db.raw.prepare(`
        UPDATE contracts
        SET status = 'ACTIVE', updated_at = ?
        WHERE id = ?
      `).run(now, contractId);

      this.auditSvc.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'DEMO_CONTRACT_RESET',
        entityType: 'CONTRACT',
        entityId: contractId,
        contractId,
        previousState: 'VARIOUS',
        newState: 'ACTIVE',
        payload: {
          resetBy: actor.id,
          resetAt: now,
          contractId,
        },
        timestamp: now,
      });

      return this.getContractById(contractId);
    });
  }

  /**
   * Multi-Modal Requirement Intake Parser
   * Parses uploaded documents (.pdf, .md, .txt) and reference links into structured milestones.
   * Supports Google Gemini with mandatory deterministic offline fallback and prompt injection defense.
   */
  public async parseSpec(input: ParseSpecInput): Promise<ParsedContractSpec> {
    let rawText = (input.rawText ?? '').trim();
    const content = (input.content ?? '').trim();
    const prompt = (input.prompt ?? '').trim();
    const fileName = (input.fileName ?? '').trim();
    const fileType = (input.fileType ?? '').trim().toLowerCase();

    // 1. Extract text from uploaded file if provided
    if (content.length > 0) {
      const isPdf =
        fileName.toLowerCase().endsWith('.pdf') ||
        fileType === 'application/pdf' ||
        content.startsWith('%PDF-') ||
        content.startsWith('data:application/pdf;base64,');

      if (isPdf) {
        let base64Clean = content;
        if (content.includes(';base64,')) {
          base64Clean = content.split(';base64,')[1];
        }
        try {
          const buf = Buffer.from(base64Clean, 'base64');
          const pdfExtracted = this.extractTextFromPdfBuffer(buf);
          rawText = (rawText ? rawText + '\n\n' : '') + pdfExtracted;
        } catch {
          rawText = (rawText ? rawText + '\n\n' : '') + content;
        }
      } else {
        let textContent = content;
        if (content.startsWith('data:') && content.includes(';base64,')) {
          try {
            textContent = Buffer.from(content.split(';base64,')[1], 'base64').toString('utf8');
          } catch {
            textContent = content;
          }
        }
        rawText = (rawText ? rawText + '\n\n' : '') + textContent;
      }
    }

    if (prompt.length > 0) {
      rawText = (rawText ? rawText + '\n\n' : '') + prompt;
    }

    // 2. Synthesize text from references if rawText is minimal
    const hasRefs = Boolean(
      input.figmaUrl?.trim() ||
      input.referenceWebsiteUrl?.trim() ||
      input.githubRepoOrIssueUrl?.trim()
    );

    if (rawText.length < 5) {
      if (hasRefs) {
        rawText = `Contract derived from design and technical references: ${[
          input.figmaUrl?.trim() ? `Figma (${input.figmaUrl.trim()})` : null,
          input.referenceWebsiteUrl?.trim() ? `Reference App (${input.referenceWebsiteUrl.trim()})` : null,
          input.githubRepoOrIssueUrl?.trim() ? `GitHub Target (${input.githubRepoOrIssueUrl.trim()})` : null,
        ]
          .filter(Boolean)
          .join(', ')}`;
      } else {
        throw new AppError(
          400,
          'EMPTY_SPEC_CONTENT',
          'Specification content, document, or prompt is required.'
        );
      }
    }

    // 3. Prompt-injection defense and sanitization
    const injectionAnalysis = this.detectAndSanitizePromptInjection(rawText);
    const sanitizedText = injectionAnalysis.sanitizedText;

    // 4. Try Google Gemini if configured
    const apiKey = process.env.GEMINI_API_KEY;
    const isGeminiAvailable = Boolean(apiKey && apiKey.trim().length > 0 && apiKey !== 'MY_GEMINI_API_KEY');

    if (isGeminiAvailable && apiKey) {
      try {
        const geminiResult = await this.callGeminiSpecParser(apiKey, sanitizedText, input);
        if (geminiResult) {
          return {
            ...geminiResult,
            metadata: {
              sourceType: content ? 'FILE_UPLOAD' : prompt ? 'AI_QUICK_SPEC' : 'MANUAL_SPEC',
              fileName: fileName || undefined,
              promptInjectionDetected: injectionAnalysis.promptInjectionDetected,
              referenceUrls: {
                figmaUrl: input.figmaUrl?.trim() || undefined,
                referenceWebsiteUrl: input.referenceWebsiteUrl?.trim() || undefined,
                githubRepoOrIssueUrl: input.githubRepoOrIssueUrl?.trim() || undefined,
              },
              modelUsed: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
            },
          };
        }
      } catch {
        // Fall back gracefully to deterministic parsing
      }
    }

    // 5. Mandatory Deterministic Fallback Parser
    const fallbackSpec = this.parseSpecDeterministically(sanitizedText, input);
    return {
      ...fallbackSpec,
      metadata: {
        sourceType: content ? 'FILE_UPLOAD' : prompt ? 'AI_QUICK_SPEC' : 'MANUAL_SPEC',
        fileName: fileName || undefined,
        promptInjectionDetected: injectionAnalysis.promptInjectionDetected,
        referenceUrls: {
          figmaUrl: input.figmaUrl?.trim() || undefined,
          referenceWebsiteUrl: input.referenceWebsiteUrl?.trim() || undefined,
          githubRepoOrIssueUrl: input.githubRepoOrIssueUrl?.trim() || undefined,
        },
        modelUsed: 'deterministic-offline-fallback',
      },
    };
  }

  private extractTextFromPdfBuffer(buffer: Buffer): string {
    const str = buffer.toString('latin1');
    let extractedText = '';

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(str)) !== null) {
      let streamBytes = Buffer.from(match[1], 'latin1');
      try {
        streamBytes = zlib.inflateSync(streamBytes);
      } catch {
        // uncompressed stream or already raw
      }
      const decoded = streamBytes.toString('latin1');

      const tjRegex = /\(([^)]+)\)\s*Tj/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(decoded)) !== null) {
        extractedText += tjMatch[1] + ' ';
      }

      const tjaRegex = /\[(.*?)\]\s*TJ/g;
      let tjaMatch: RegExpExecArray | null;
      while ((tjaMatch = tjaRegex.exec(decoded)) !== null) {
        const innerTj = /\(([^)]+)\)/g;
        let innerMatch: RegExpExecArray | null;
        while ((innerMatch = innerTj.exec(tjaMatch[1])) !== null) {
          extractedText += innerMatch[1] + ' ';
        }
      }
    }

    const rawAsciiWords = str.match(/[A-Za-z0-9\s.,;:!?'"#-]{4,}/g) || [];
    const filteredAscii = rawAsciiWords
      .filter((w) => !w.includes('ObjStm') && !w.includes('endobj') && !w.includes('FlateDecode') && !w.includes('XObject'))
      .join(' ');

    const combined = (extractedText + ' ' + filteredAscii).replace(/\s+/g, ' ').trim();
    return combined || 'Uploaded Document Specification';
  }

  private detectAndSanitizePromptInjection(text: string): { promptInjectionDetected: boolean; sanitizedText: string } {
    const patterns: RegExp[] = [
      /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions/i,
      /(system\s+override|you\s+are\s+now\s+the\s+admin|act\s+as\s+settlement\s+bot)/i,
      /<\/?untrusted_evidence>/i,
      /(set\s+milestoneStatus\s*=\s*["']?APPROVED|bypass\s+human\s+(review|approval)|recommendedOutcome\s*=\s*["']?PASS["']?)/i,
      /(approvedAmountCents\s*=|call\s+paypal|release\s+\$?[0-9,]+(\.[0-9]{2})?\s+via\s+paypal|capture\s+immediately)/i,
      /(transfer|disburse|pay|send)\s+\$?[0-9,]+(\.[0-9]{2})?\s+(to|into)\s+/i,
      /(approve\s+all\s+(milestones|payments)|hacker\s+account|drain\s+funds)/i,
    ];

    let detected = false;
    let sanitized = text;

    for (const pat of patterns) {
      if (pat.test(sanitized)) {
        detected = true;
        sanitized = sanitized.replace(pat, '[ESCAPED_INJECTION_PATTERN]');
      }
    }

    return { promptInjectionDetected: detected, sanitizedText: sanitized };
  }

  private async callGeminiSpecParser(
    apiKey: string,
    sanitizedText: string,
    input: ParseSpecInput
  ): Promise<Omit<ParsedContractSpec, 'metadata'> | null> {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const systemInstruction = `You are an expert full-stack software architect. Parse the provided software specification / PRD into structured contract milestones with acceptance criteria.
Return ONLY valid JSON matching this structure:
{
  "title": "string (project title)",
  "description": "string (executive summary of scope)",
  "totalBudgetCents": integer (e.g. 550000 for $5,500.00),
  "milestones": [
    {
      "sequenceOrder": 1,
      "title": "string",
      "description": "string",
      "agreedAmountCents": integer,
      "estimatedDays": integer,
      "acceptanceCriteria": [
        {
          "id": "AC-1",
          "title": "string",
          "description": "string",
          "requiredProofType": "PULL_REQUEST" | "CI_TESTS" | "SECURITY_SCAN" | "CODE_COMMIT" | "API_DOCS"
        }
      ]
    }
  ]
}
Ensure sum of milestone agreedAmountCents equals totalBudgetCents. Generate 2 to 3 testable milestones.`;

    const userPrompt = `Requirements Document:\n${sanitizedText.slice(0, 15000)}\n\nOptional References:\nFigma: ${input.figmaUrl ?? 'none'}\nReference Site: ${input.referenceWebsiteUrl ?? 'none'}\nGitHub: ${input.githubRepoOrIssueUrl ?? 'none'}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) return null;

    const parsed = JSON.parse(textOut);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
      return null;
    }

    const now = Date.now();
    let calculatedTotal = 0;
    const validatedMilestones: ParsedMilestoneSpec[] = parsed.milestones.map((m: any, idx: number) => {
      const amount = isPositiveInteger(m.agreedAmountCents) ? m.agreedAmountCents : 250000;
      calculatedTotal += amount;
      const days = isPositiveInteger(m.estimatedDays) ? m.estimatedDays : (idx + 1) * 14;
      const criteria: AcceptanceCriterion[] = Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria.length > 0
        ? m.acceptanceCriteria.map((c: any, cIdx: number) => ({
            id: typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `AC-${cIdx + 1}`,
            title: typeof c.title === 'string' && c.title.trim() ? c.title.trim() : `Criterion ${cIdx + 1}`,
            description: typeof c.description === 'string' ? c.description.trim() : 'Deliverable verification criterion.',
            requiredProofType: VALID_PROOF_TYPES.includes(c.requiredProofType) ? c.requiredProofType : 'PULL_REQUEST',
          }))
        : [
            {
              id: 'AC-1',
              title: 'Source Code Implementation',
              description: 'Merge pull request with passing test suite.',
              requiredProofType: 'PULL_REQUEST',
            },
          ];

      return {
        sequenceOrder: idx + 1,
        title: typeof m.title === 'string' && m.title.trim() ? m.title.trim() : `Milestone ${idx + 1}`,
        description: typeof m.description === 'string' ? m.description.trim() : 'Software deliverable milestone.',
        agreedAmountCents: amount,
        deadlineIso: new Date(now + days * 24 * 60 * 60 * 1000).toISOString(),
        acceptanceCriteria: criteria,
      };
    });

    const totalCents = isPositiveInteger(parsed.totalBudgetCents) ? parsed.totalBudgetCents : calculatedTotal;
    if (calculatedTotal !== totalCents && validatedMilestones.length > 0) {
      validatedMilestones[0].agreedAmountCents += totalCents - calculatedTotal;
    }

    return {
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Software Delivery Contract',
      description: typeof parsed.description === 'string' && parsed.description.trim() ? parsed.description.trim() : sanitizedText.slice(0, 300),
      totalBudgetCents: totalCents,
      currency: 'USD',
      policyRules: {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: true,
        latePenaltyDailyBps: 100,
      },
      milestones: validatedMilestones,
    };
  }

  private parseSpecDeterministically(
    sanitizedText: string,
    input: ParseSpecInput
  ): Omit<ParsedContractSpec, 'metadata'> {
    // 1. Derive Title
    let title = '';
    const titleMatch = sanitizedText.match(/^(?:#|Title:?|Project:?)\s*([^\r\n]+)/im);
    if (titleMatch && titleMatch[1].trim().length > 3) {
      title = titleMatch[1].trim().replace(/^#+\s*/, '');
    } else if (input.fileName) {
      title = input.fileName
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } else {
      const firstLine = sanitizedText.split('\n').find((l) => l.trim().length > 4);
      title = firstLine ? firstLine.trim().slice(0, 80).replace(/^#+\s*/, '') : 'Software Delivery Contract';
    }

    // 2. Append references to description
    let description = sanitizedText.slice(0, 600).replace(/^#+[^\n]+\n?/, '').trim();
    if (!description) {
      description = 'Software delivery contract with verified milestones and deterministic settlement.';
    }

    const refLines: string[] = [];
    if (input.figmaUrl?.trim()) refLines.push(`• Figma: ${input.figmaUrl.trim()}`);
    if (input.referenceWebsiteUrl?.trim()) refLines.push(`• Reference Site: ${input.referenceWebsiteUrl.trim()}`);
    if (input.githubRepoOrIssueUrl?.trim()) refLines.push(`• GitHub Target: ${input.githubRepoOrIssueUrl.trim()}`);
    if (refLines.length > 0) {
      description += `\n\n[Design & Technical References]\n${refLines.join('\n')}`;
    }

    // 3. Extract budget if mentioned
    let totalBudgetCents = 550000; // $5,500.00 default
    const budgetMatch =
      sanitizedText.match(/(?:Total\s*Budget|Budget|Cost|Price)[:\s]*\$([0-9,]+(?:\.[0-9]{2})?)/i) ||
      sanitizedText.match(/\$([0-9,]+(?:\.[0-9]{2})?)/);
    if (budgetMatch) {
      const parsedNum = parseFloat(budgetMatch[1].replace(/,/g, ''));
      if (!Number.isNaN(parsedNum) && parsedNum >= 100) {
        totalBudgetCents = Math.round(parsedNum * 100);
      }
    }

    // 4. Extract section milestones
    const lines = sanitizedText.split('\n');
    const milestoneBlocks: Array<{ title: string; bullets: string[]; explicitAmountCents?: number }> = [];
    let currentBlock: { title: string; bullets: string[]; explicitAmountCents?: number } | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const headingMatch = line.match(/^(?:##|###|\*\*|Milestone\s+\d+|Phase\s+\d+)\s*[:.-]?\s*(.+)/i);
      if (headingMatch) {
        if (currentBlock) milestoneBlocks.push(currentBlock);
        currentBlock = {
          title: headingMatch[1].replace(/\*\*$/, '').trim(),
          bullets: [],
        };
      } else if (currentBlock) {
        const amountMatch = line.match(/^(?:Budget|Amount)[:\s]*\$([0-9,]+(?:\.[0-9]{2})?)/i);
        if (amountMatch) {
          const parsed = parseFloat(amountMatch[1].replace(/,/g, ''));
          if (!Number.isNaN(parsed) && parsed > 0) {
            currentBlock.explicitAmountCents = Math.round(parsed * 100);
          }
          continue;
        }

        if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
          const bulletText = line.replace(/^[-*]|\d+\.\s*/, '').trim();
          if (bulletText.length > 3) {
            currentBlock.bullets.push(bulletText);
          }
        }
      }
    }
    if (currentBlock) milestoneBlocks.push(currentBlock);

    const now = Date.now();
    let milestones: ParsedMilestoneSpec[] = [];

    if (milestoneBlocks.length >= 2) {
      const selected = milestoneBlocks.slice(0, 4);
      const count = selected.length;
      const allHaveExplicit = selected.every((b) => typeof b.explicitAmountCents === 'number');

      if (allHaveExplicit) {
        let sum = 0;
        milestones = selected.map((block, idx) => {
          const amount = block.explicitAmountCents!;
          sum += amount;
          return {
            sequenceOrder: idx + 1,
            title: `Milestone ${idx + 1}: ${block.title}`,
            description: block.bullets.join('. ') || 'Core deliverable implementation.',
            agreedAmountCents: amount,
            deadlineIso: new Date(now + (idx + 1) * 14 * 24 * 60 * 60 * 1000).toISOString(),
            acceptanceCriteria: this.buildCriteriaFromBullets(block.bullets),
          };
        });
        totalBudgetCents = sum;
      } else {
        const baseShare = Math.floor(totalBudgetCents / count);
        let allocated = 0;

        milestones = selected.map((block, idx) => {
          const isLast = idx === count - 1;
          const amount = typeof block.explicitAmountCents === 'number'
            ? block.explicitAmountCents
            : isLast
            ? totalBudgetCents - allocated
            : baseShare;
          allocated += amount;

          return {
            sequenceOrder: idx + 1,
            title: `Milestone ${idx + 1}: ${block.title}`,
            description: block.bullets.join('. ') || 'Core deliverable implementation.',
            agreedAmountCents: amount,
            deadlineIso: new Date(now + (idx + 1) * 14 * 24 * 60 * 60 * 1000).toISOString(),
            acceptanceCriteria: this.buildCriteriaFromBullets(block.bullets),
          };
        });
      }
    } else {
      // Standard 2-milestone split
      const m1Amount = Math.round(totalBudgetCents * 0.55);
      const m2Amount = totalBudgetCents - m1Amount;

      milestones = [
        {
          sequenceOrder: 1,
          title: 'Milestone 1: Core Architecture, API Contract & Implementation',
          description: 'Deliver core system implementation with passing unit tests and merged pull request.',
          agreedAmountCents: m1Amount,
          deadlineIso: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
          acceptanceCriteria: [
            {
              id: 'AC-1',
              title: 'Source Code Implementation',
              description: 'Merge feature PR with unit tests.',
              requiredProofType: 'PULL_REQUEST',
            },
            {
              id: 'AC-2',
              title: 'Automated CI Test Suite',
              description: 'Passing automated test run with zero critical vulnerabilities.',
              requiredProofType: 'CI_TESTS',
            },
          ],
        },
        {
          sequenceOrder: 2,
          title: 'Milestone 2: Security Hardening, Verification & Production Readiness',
          description: 'Production hardening, security scans, and deployment smoke test verification.',
          agreedAmountCents: m2Amount,
          deadlineIso: new Date(now + 28 * 24 * 60 * 60 * 1000).toISOString(),
          acceptanceCriteria: [
            {
              id: 'AC-1',
              title: 'OpenAPI Documentation & Security Scan',
              description: 'Deliver API specification and vulnerability audit report.',
              requiredProofType: 'SECURITY_SCAN',
            },
            {
              id: 'AC-2',
              title: 'API Engine Specification',
              description: 'Verified OpenAPI 3.0.3 contract and schema documentation.',
              requiredProofType: 'API_DOCS',
            },
          ],
        },
      ];
    }

    return {
      title,
      description,
      totalBudgetCents,
      currency: 'USD',
      policyRules: {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: true,
        latePenaltyDailyBps: 100,
      },
      milestones,
    };
  }

  private buildCriteriaFromBullets(bullets: string[]): AcceptanceCriterion[] {
    return bullets.length > 0
      ? bullets.slice(0, 4).map((b, bIdx) => {
          const lower = b.toLowerCase();
          let proofType: RequiredProofType = 'PULL_REQUEST';
          if (lower.includes('ci_tests') || lower.includes('test') || lower.includes('coverage') || lower.includes('ci')) {
            proofType = 'CI_TESTS';
          } else if (lower.includes('security_scan') || lower.includes('security') || lower.includes('cve') || lower.includes('audit') || lower.includes('slither')) {
            proofType = 'SECURITY_SCAN';
          } else if (lower.includes('api_docs') || lower.includes('api') || lower.includes('spec') || lower.includes('docs')) {
            proofType = 'API_DOCS';
          }
          return {
            id: `AC-${bIdx + 1}`,
            title: b.slice(0, 60),
            description: b,
            requiredProofType: proofType,
          };
        })
      : [
          {
            id: 'AC-1',
            title: 'Deliverable Implementation',
            description: 'Complete feature pull request merged into main.',
            requiredProofType: 'PULL_REQUEST',
          },
          {
            id: 'AC-2',
            title: 'Automated CI Test Suite',
            description: 'Passing automated tests with zero security vulnerabilities.',
            requiredProofType: 'CI_TESTS',
          },
        ];
  }
}
