import crypto from 'node:crypto';
import type { AppDatabase } from '../repositories/Database.ts';
import type {
  ContractRepository,
  DisputeEvidencePackRepository,
  EvaluationRepository,
  EvidencePassportRepository,
  EvidenceProvenanceRepository,
  EvidenceRepository,
  HumanApprovalRepository,
  MilestoneRepository,
  PaymentTransactionRepository,
} from '../repositories/DomainRepositories.ts';
import { canonicalizeJson, type AuditService } from './AuditService.ts';
import type { AuditReplayService } from './AuditReplayService.ts';
import type { EvidencePassportService } from './EvidencePassportService.ts';
import type {
  AcceptanceCriterion,
  AuditActorRole,
  AuditLogEntry,
  DisputeEvidencePack,
  DisputePackStatus,
  DisputePackVerificationResult,
  DisputeTimelineEvent,
  DisputeTimelineEventCategory,
  EvidenceSubmission,
  HumanApprovalRecord,
  PayPalTransactionRecord,
} from '../../types/domain.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface GenerateDisputePackOptions {
  reason?: string;
  notes?: string;
}

export class DisputeEvidencePackService {
  private readonly db: AppDatabase;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly evidenceRepo: EvidenceRepository;
  private readonly provenanceRepo: EvidenceProvenanceRepository;
  private readonly evidencePassportService: EvidencePassportService;
  private readonly passportRepo: EvidencePassportRepository;
  private readonly evaluationRepo: EvaluationRepository;
  private readonly approvalRepo: HumanApprovalRepository;
  private readonly paymentRepo: PaymentTransactionRepository;
  private readonly auditService: AuditService;
  private readonly auditReplayService: AuditReplayService;
  private readonly disputePackRepo: DisputeEvidencePackRepository;

  constructor(
    db: AppDatabase,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    evidenceRepo: EvidenceRepository,
    provenanceRepo: EvidenceProvenanceRepository,
    evidencePassportService: EvidencePassportService,
    passportRepo: EvidencePassportRepository,
    evaluationRepo: EvaluationRepository,
    approvalRepo: HumanApprovalRepository,
    paymentRepo: PaymentTransactionRepository,
    auditService: AuditService,
    auditReplayService: AuditReplayService,
    disputePackRepo: DisputeEvidencePackRepository
  ) {
    this.db = db;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.evidenceRepo = evidenceRepo;
    this.provenanceRepo = provenanceRepo;
    this.evidencePassportService = evidencePassportService;
    this.passportRepo = passportRepo;
    this.evaluationRepo = evaluationRepo;
    this.approvalRepo = approvalRepo;
    this.paymentRepo = paymentRepo;
    this.auditService = auditService;
    this.auditReplayService = auditReplayService;
    this.disputePackRepo = disputePackRepo;
  }

  /**
   * Computes deterministic SHA-256 digest over a canonicalized dispute pack payload.
   */
  public computeDigest(payload: unknown): string {
    const canonicalStr = canonicalizeJson(payload);
    return crypto.createHash('sha256').update(canonicalStr, 'utf8').digest('hex');
  }

  /**
   * Generates a tamper-evident, multi-record Dispute Evidence Pack for a given milestone.
   * Strict invariant: Read-only regarding financial state. Zero payment authority.
   */
  public async generateDisputePack(
    contractId: string,
    milestoneId: string,
    requestedByUserId: string,
    options?: GenerateDisputePackOptions
  ): Promise<DisputeEvidencePack> {
    // 1. Validate contract existence
    const contract = this.contractRepo.findById(contractId);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${contractId}' not found.`);
    }

    // 2. Validate milestone existence and contract association
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone || milestone.contractId !== contract.id) {
      throw new AppError(
        404,
        'MILESTONE_NOT_FOUND',
        `Milestone '${milestoneId}' not found in contract '${contractId}'.`
      );
    }

    // 3. Retrieve evidence submissions
    const submissions = this.evidenceRepo.listByMilestoneId(milestoneId);
    const latestSubmission = submissions.length > 0 ? submissions[0] : null;

    // 4. Retrieve latest provenance verification record
    const latestProvenance = this.provenanceRepo.findLatestByMilestoneId(milestoneId);

    // 5. Retrieve Evidence Passport (or check if one exists)
    const storedPassportData = this.passportRepo.findWithDigestByMilestoneId(milestoneId);
    let passportSummary: DisputeEvidencePack['passportSummary'] = {
      available: false,
    };

    let passportDigestValid = true;
    if (storedPassportData) {
      const { passport, storedDigest } = storedPassportData;
      // Verify passport digest
      const payloadWithoutDigest = {
        id: passport.id,
        identity: passport.identity,
        sourceIdentity: passport.sourceIdentity,
        ciCd: passport.ciCd,
        buildProvenance: passport.buildProvenance,
        runtimeValidation: passport.runtimeValidation,
        criteriaMapping: passport.criteriaMapping,
        criteriaSummary: passport.criteriaSummary,
        graph: passport.graph,
        aiSummary: passport.aiSummary,
        settlementAuditTrace: passport.settlementAuditTrace,
      };
      const recomputedPassportDigest = crypto
        .createHash('sha256')
        .update(canonicalizeJson(payloadWithoutDigest))
        .digest('hex');

      passportDigestValid =
        recomputedPassportDigest === storedDigest &&
        recomputedPassportDigest === passport.passportDigestSha256;

      passportSummary = {
        available: true,
        passportId: passport.id,
        overallStatus: passport.identity.overallStatus,
        passportDigestSha256: storedDigest,
        isCryptographicallyValid: passportDigestValid,
        criteriaSummary: passport.criteriaSummary,
        graphNodesCount: passport.graph.nodes.length,
        graphEdgesCount: passport.graph.edges.length,
      };
    }

    // 6. Run deterministic Audit Replay
    const auditReplay = this.auditReplayService.replayContractAudit({
      contractId,
      mode: 'FULL',
    });

    const auditReplaySummary: DisputeEvidencePack['auditReplaySummary'] = {
      replayed: true,
      isCryptographicallyValid: auditReplay.isCryptographicallyValid,
      isLogicallyConsistent: auditReplay.isLogicallyConsistent,
      totalEventsInspected: auditReplay.totalEventsProcessed,
      replayStatus: auditReplay.status,
      findingsCount: auditReplay.findings.length,
      findings: auditReplay.findings.map((f) => ({
        category: f.category,
        severity: f.severity,
        code: f.code,
        message: f.message,
      })),
    };

    // 7. Retrieve latest AI evaluation run (Strictly Advisory)
    const latestEvaluation = this.evaluationRepo.findLatestByMilestoneId(milestoneId);
    const aiAdvisoryAssessment: DisputeEvidencePack['aiAdvisoryAssessment'] = {
      available: Boolean(latestEvaluation),
      isAdvisory: true as const,
      advisoryDisclaimer:
        'NOTICE: Multi-agent AI evaluations are strictly advisory tools to assist human contract review. AI models cannot approve milestones, authorize disbursements, modify contract terms, or render binding dispute resolutions.',
      evidenceAgentFindings: latestEvaluation
        ? {
            model: latestEvaluation.evidenceAnalysis.model,
            verifiedCount: latestEvaluation.evidenceAnalysis.verifiedCount,
            totalCount: latestEvaluation.evidenceAnalysis.totalCount,
            missingEvidence: latestEvaluation.evidenceAnalysis.missingEvidence,
          }
        : undefined,
      riskAgentFindings: latestEvaluation
        ? {
            model: latestEvaluation.riskAnalysis.model,
            overallRiskSeverity: latestEvaluation.riskAnalysis.overallRiskSeverity,
            promptInjectionDetected: latestEvaluation.riskAnalysis.promptInjectionDetected,
            suspiciousSignals: latestEvaluation.riskAnalysis.suspiciousSignals,
          }
        : undefined,
      reviewSynthesizerRecommendation: latestEvaluation
        ? {
            model: latestEvaluation.arbitratorRecommendation.model,
            recommendedOutcome: latestEvaluation.arbitratorRecommendation.recommendedOutcome,
            disagreements: latestEvaluation.arbitratorRecommendation.disagreements ?? [],
            reasoning: latestEvaluation.arbitratorRecommendation.reasoningSummary,
          }
        : undefined,
    };

    // 8. Deterministic Settlement Policy Outcome
    const settlementOutcome: DisputeEvidencePack['settlementOutcome'] = {
      evaluated: Boolean(latestEvaluation?.policyCalculation),
      permittedAmountCents: latestEvaluation?.policyCalculation?.permittedAmountCents ?? 0,
      penaltyCents: latestEvaluation?.policyCalculation?.latePenaltyCents ?? 0,
      gateBlocked: latestEvaluation?.policyCalculation?.gateBlocked ?? true,
      blockingReasons: latestEvaluation?.policyCalculation?.blockingReasons ?? [
        'No completed evaluation on file',
      ],
      calculationTimestamp: latestEvaluation?.evaluatedAt,
    };

    // 9. Human Review Approvals History
    const approvalRecords = this.approvalRepo.listByMilestoneId(milestoneId);
    const latestApproval = approvalRecords.length > 0 ? approvalRecords[0] : null;
    const humanApprovalHistory: DisputeEvidencePack['humanApprovalHistory'] = {
      recorded: approvalRecords.length > 0,
      latestDecision: latestApproval?.decision,
      approvedAmountCents: latestApproval?.approvedAmountCents,
      reviewerId: latestApproval?.reviewerId,
      decidedAt: latestApproval?.decidedAt,
      justification: latestApproval?.justification,
      isOverride: latestApproval?.isOverride,
      allDecisions: approvalRecords.map((a) => ({
        id: a.id,
        decision: a.decision,
        approvedAmountCents: a.approvedAmountCents,
        reviewerId: a.reviewerId,
        decidedAt: a.decidedAt,
        justification: a.justification,
      })),
    };

    // 10. PayPal Transaction Lifecycle History
    const paymentRecords = this.paymentRepo.listByMilestoneId(milestoneId);
    const latestPayment = paymentRecords.length > 0 ? paymentRecords[0] : null;
    const paymentLifecycleHistory: DisputeEvidencePack['paymentLifecycleHistory'] = {
      recorded: paymentRecords.length > 0,
      latestStatus: latestPayment?.status,
      transactions: paymentRecords.map((tx) => ({
        id: tx.id,
        paypalOrderId: tx.paypalOrderId,
        paypalAuthorizationId: tx.paypalAuthorizationId,
        paypalCaptureId: tx.paypalCaptureId,
        authorizedAmountCents: tx.authorizedAmountCents,
        capturedAmountCents: tx.capturedAmountCents,
        currency: tx.currency,
        status: tx.status,
        executionMode: tx.executionMode,
        updatedAt: tx.updatedAt,
      })),
    };

    // 11. Deterministic Chronological Timeline Reconstruction
    const allAuditLogs = this.auditService.listLogs({ contractId });
    const timeline = this.buildTimeline({
      milestoneId,
      auditLogs: allAuditLogs,
      submissions,
      approvals: approvalRecords,
      payments: paymentRecords,
    });

    // 12. Evaluate overall dispute pack completeness status
    let disputeStatus: DisputePackStatus = 'COMPLETE';
    if (!auditReplay.isCryptographicallyValid || !passportDigestValid) {
      disputeStatus = 'CORRUPTED_INTEGRITY';
    } else if (submissions.length === 0 || !storedPassportData) {
      disputeStatus = 'INCOMPLETE_EVIDENCE';
    }

    const packId = `pack_${contractId}_${milestoneId}_${Date.now()}`;
    const generatedAt = new Date().toISOString();

    // 13. Two-Stage Non-Circular Hash Construction
    const preAuditPayload = {
      id: packId,
      schemaVersion: 'mpai-dispute-pack-v1' as const,
      contractId,
      milestoneId,
      disputeStatus,
      contractSummary: {
        title: contract.title,
        description: contract.description,
        clientId: contract.clientId,
        developerId: contract.developerId,
        reviewerId: contract.reviewerId,
        totalBudgetCents: contract.totalBudgetCents,
        currency: contract.currency,
        status: contract.status,
        version: contract.version,
      },
      milestoneSummary: {
        sequenceOrder: milestone.sequenceOrder,
        title: milestone.title,
        description: milestone.description,
        agreedAmountCents: milestone.agreedAmountCents,
        deadlineIso: milestone.deadlineIso,
        status: milestone.status,
        paymentStatus: milestone.paymentStatus,
        acceptanceCriteria: milestone.acceptanceCriteria,
      },
      evidenceSubmissions: {
        totalSubmissions: submissions.length,
        latestSubmission,
        submissionHistory: submissions.map((s) => ({
          id: s.id,
          attemptNumber: s.attemptNumber,
          submittedAt: s.submittedAt,
          commitSha: s.commitSha,
          branch: s.branch,
          prUrl: s.prUrl,
          prStatus: s.prStatus,
          payloadSha256: s.payloadSha256 || '',
          ciStatus: s.ciReport.status,
          securityFindingsCount: s.securityScan.findings.length,
        })),
      },
      provenanceAndVerification: {
        provenanceStatus: latestProvenance?.overallStatus ?? 'UNVERIFIED_UNAVAILABLE',
        commitVerified: latestProvenance ? latestProvenance.commit.belongsToRepository : false,
        commitSigner: latestProvenance?.commit.authorLogin ?? null,
        ciWorkflowValid: latestProvenance?.workflowRun.conclusion === 'success',
        ciRunUrl: latestProvenance?.workflowRun.htmlUrl ?? null,
        provenanceRecordId: latestProvenance?.id ?? null,
      },
      passportSummary,
      auditReplaySummary,
      aiAdvisoryAssessment,
      settlementOutcome,
      humanApprovalHistory,
      paymentLifecycleHistory,
      timeline,
    };

    // Stage 1 Digest: Pre-audit content hash
    const packContentDigestSha256 = this.computeDigest(preAuditPayload);

    // Determine actor role
    let actorRole: AuditActorRole = 'CLIENT';
    if (requestedByUserId === contract.developerId) actorRole = 'DEVELOPER';
    else if (requestedByUserId === contract.reviewerId) actorRole = 'REVIEWER';
    else if (requestedByUserId === 'system' || requestedByUserId.startsWith('sys_'))
      actorRole = 'SYSTEM';

    // Stage 2: Transactional audit log appending and atomic snapshot persistence
    const savedPack: DisputeEvidencePack = this.db.withTransaction(() => {
      const auditEntry = this.auditService.appendWithinTx({
        actorId: requestedByUserId,
        actorRole,
        action: 'DISPUTE_PACK_GENERATED',
        entityType: 'MILESTONE',
        entityId: milestoneId,
        contractId,
        milestoneId,
        newState: disputeStatus,
        payload: {
          packId,
          packContentDigestSha256,
          disputeStatus,
          schemaVersion: 'mpai-dispute-pack-v1',
          requestedBy: requestedByUserId,
          reason: options?.reason ?? null,
        },
      });

      const auditEventReferences = [auditEntry.entryHash];

      // Assemble final payload with audit references
      const finalPayloadWithoutDigest = {
        ...preAuditPayload,
        integrity: {
          packContentDigestSha256,
          auditEventReferences,
          generatedAt,
          generatedBy: requestedByUserId,
        },
      };

      // Stage 2 Digest: Final outer pack digest
      const packDigestSha256 = this.computeDigest(finalPayloadWithoutDigest);

      const completePack: DisputeEvidencePack = {
        ...preAuditPayload,
        integrity: {
          packContentDigestSha256,
          auditEventReferences,
          packDigestSha256,
          isCryptographicallyValid: true,
          generatedAt,
          generatedBy: requestedByUserId,
        },
      };

      this.disputePackRepo.save(completePack);
      return completePack;
    });

    return savedPack;
  }

  /**
   * Retrieves an existing dispute pack and verifies its cryptographic integrity.
   */
  public getDisputePack(contractId: string, packId: string): DisputeEvidencePack {
    const pack = this.disputePackRepo.findById(packId);
    if (!pack || pack.contractId !== contractId) {
      throw new AppError(
        404,
        'DISPUTE_PACK_NOT_FOUND',
        `Dispute evidence pack '${packId}' not found for contract '${contractId}'.`
      );
    }

    // Verify integrity upon retrieval
    const isCryptoValid = this.verifyPackIntegrity(pack);
    return {
      ...pack,
      integrity: {
        ...pack.integrity,
        isCryptographicallyValid: isCryptoValid,
      },
    };
  }

  /**
   * Performs an independent, comprehensive verification check on an existing dispute pack.
   */
  public verifyDisputePack(contractId: string, packId: string): DisputePackVerificationResult {
    const packWithDigest = this.disputePackRepo.findWithDigestById(packId);
    if (!packWithDigest || packWithDigest.pack.contractId !== contractId) {
      throw new AppError(
        404,
        'DISPUTE_PACK_NOT_FOUND',
        `Dispute evidence pack '${packId}' not found for contract '${contractId}'.`
      );
    }

    const { pack, storedDigest } = packWithDigest;
    const finalPayloadWithoutDigest = {
      id: pack.id,
      schemaVersion: pack.schemaVersion,
      contractId: pack.contractId,
      milestoneId: pack.milestoneId,
      disputeStatus: pack.disputeStatus,
      contractSummary: pack.contractSummary,
      milestoneSummary: pack.milestoneSummary,
      evidenceSubmissions: pack.evidenceSubmissions,
      provenanceAndVerification: pack.provenanceAndVerification,
      passportSummary: pack.passportSummary,
      auditReplaySummary: pack.auditReplaySummary,
      aiAdvisoryAssessment: pack.aiAdvisoryAssessment,
      settlementOutcome: pack.settlementOutcome,
      humanApprovalHistory: pack.humanApprovalHistory,
      paymentLifecycleHistory: pack.paymentLifecycleHistory,
      timeline: pack.timeline,
      integrity: {
        packContentDigestSha256: pack.integrity.packContentDigestSha256,
        auditEventReferences: pack.integrity.auditEventReferences,
        generatedAt: pack.integrity.generatedAt,
        generatedBy: pack.integrity.generatedBy,
      },
    };

    const computedDigest = this.computeDigest(finalPayloadWithoutDigest);
    const isDigestValid = computedDigest === storedDigest;

    // Check audit anchor reference
    const anchorHash = pack.integrity.auditEventReferences[0];
    let isAuditAnchored = false;
    if (anchorHash) {
      const allAudit = this.auditService.listLogs({ contractId: pack.contractId });
      isAuditAnchored = allAudit.some((l) => l.entryHash === anchorHash);
    }

    return {
      packId: pack.id,
      contractId: pack.contractId,
      milestoneId: pack.milestoneId,
      schemaVersion: pack.schemaVersion,
      disputeStatus: pack.disputeStatus,
      storedDigest,
      computedDigest,
      isDigestValid,
      isAuditAnchored,
      auditAnchorEntryHash: anchorHash,
      isPassportValid: pack.passportSummary.available
        ? Boolean(pack.passportSummary.isCryptographicallyValid)
        : true,
      isAuditReplayValid: pack.auditReplaySummary.isCryptographicallyValid,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Sanitizes and exports the Dispute Evidence Pack as portable JSON with an integrity checksum.
   */
  public exportDisputePack(
    contractId: string,
    packId: string
  ): {
    pack: DisputeEvidencePack;
    exportedAt: string;
    exportSha256: string;
    sanitized: boolean;
  } {
    const pack = this.getDisputePack(contractId, packId);

    // Sanitize any remaining internal secrets
    const sanitizedPack: DisputeEvidencePack = JSON.parse(JSON.stringify(pack));
    // Verify no secret leakage
    if (sanitizedPack.paymentLifecycleHistory?.transactions) {
      for (const tx of sanitizedPack.paymentLifecycleHistory.transactions) {
        // Ensure no raw token/credential fields
        delete (tx as Record<string, unknown>)['rawPaypalResponse'];
        delete (tx as Record<string, unknown>)['accessToken'];
        delete (tx as Record<string, unknown>)['clientSecret'];
      }
    }

    const exportedAt = new Date().toISOString();
    const exportSha256 = this.computeDigest({
      pack: sanitizedPack,
      exportedAt,
    });

    return {
      pack: sanitizedPack,
      exportedAt,
      exportSha256,
      sanitized: true,
    };
  }

  /**
   * Verifies the cryptographic digest of a DisputeEvidencePack instance.
   */
  public verifyPackIntegrity(pack: DisputeEvidencePack): boolean {
    const payloadWithoutDigest = {
      id: pack.id,
      schemaVersion: pack.schemaVersion,
      contractId: pack.contractId,
      milestoneId: pack.milestoneId,
      disputeStatus: pack.disputeStatus,
      contractSummary: pack.contractSummary,
      milestoneSummary: pack.milestoneSummary,
      evidenceSubmissions: pack.evidenceSubmissions,
      provenanceAndVerification: pack.provenanceAndVerification,
      passportSummary: pack.passportSummary,
      auditReplaySummary: pack.auditReplaySummary,
      aiAdvisoryAssessment: pack.aiAdvisoryAssessment,
      settlementOutcome: pack.settlementOutcome,
      humanApprovalHistory: pack.humanApprovalHistory,
      paymentLifecycleHistory: pack.paymentLifecycleHistory,
      timeline: pack.timeline,
      integrity: {
        packContentDigestSha256: pack.integrity.packContentDigestSha256,
        auditEventReferences: pack.integrity.auditEventReferences,
        generatedAt: pack.integrity.generatedAt,
        generatedBy: pack.integrity.generatedBy,
      },
    };

    const recomputed = this.computeDigest(payloadWithoutDigest);
    return recomputed === pack.integrity.packDigestSha256;
  }

  /**
   * Deterministically reconstructs the chronological event timeline for the milestone.
   */
  public buildTimeline(params: {
    milestoneId: string;
    auditLogs: AuditLogEntry[];
    submissions: EvidenceSubmission[];
    approvals: HumanApprovalRecord[];
    payments: PayPalTransactionRecord[];
  }): DisputeTimelineEvent[] {
    const events: DisputeTimelineEvent[] = [];

    // Filter audit logs for this milestone or contract
    for (const log of params.auditLogs) {
      if (log.milestoneId === params.milestoneId || log.entityId === params.milestoneId) {
        let category: DisputeTimelineEventCategory = 'AUDIT_ANCHOR';
        if (log.action.includes('SUBMITTED') || log.action.includes('EVIDENCE')) {
          category = 'SUBMISSION';
        } else if (log.action.includes('EVALUATION')) {
          category = 'AI_ADVISORY';
        } else if (log.action.includes('PASSPORT')) {
          category = 'VERIFICATION';
        } else if (log.action.includes('HUMAN_REVIEW')) {
          category = 'HUMAN_DECISION';
        } else if (log.action.includes('PAYPAL')) {
          category = 'PAYMENT';
        } else if (log.action.includes('DISPUTE')) {
          category = 'DISPUTE';
        }

        events.push({
          id: `audit_${log.seq}_${log.id}`,
          seq: log.seq,
          timestamp: log.timestamp,
          category,
          action: log.action,
          actorId: log.actorId,
          actorRole: log.actorRole,
          summary: `${log.action} on ${log.entityType} ${log.entityId}`,
          referenceId: log.entryHash,
          details: log.payload,
        });
      }
    }

    // Add explicit evidence submission events if not already present
    for (const sub of params.submissions) {
      const alreadyHas = events.some(
        (e) => e.action === 'EVIDENCE_SUBMITTED' && e.referenceId === sub.payloadSha256
      );
      if (!alreadyHas) {
        events.push({
          id: `sub_${sub.id}`,
          timestamp: sub.submittedAt,
          category: 'SUBMISSION',
          action: 'EVIDENCE_SUBMITTED',
          actorId: sub.submittedBy,
          actorRole: 'DEVELOPER',
          summary: `Evidence attempt #${sub.attemptNumber} submitted for commit ${sub.commitSha.slice(0, 8)}`,
          referenceId: sub.payloadSha256,
          details: {
            commitSha: sub.commitSha,
            branch: sub.branch,
            prUrl: sub.prUrl,
            ciStatus: sub.ciReport.status,
          },
        });
      }
    }

    // Add human approval events if not already covered
    for (const app of params.approvals) {
      const alreadyHas = events.some(
        (e) => e.category === 'HUMAN_DECISION' && e.timestamp === app.decidedAt
      );
      if (!alreadyHas) {
        events.push({
          id: `approval_${app.id}`,
          timestamp: app.decidedAt,
          category: 'HUMAN_DECISION',
          action: `HUMAN_REVIEW_${app.decision}`,
          actorId: app.reviewerId,
          actorRole: 'REVIEWER',
          summary: `Human review decision: ${app.decision} ($${(app.approvedAmountCents / 100).toFixed(2)})`,
          referenceId: app.id,
          details: {
            decision: app.decision,
            approvedAmountCents: app.approvedAmountCents,
            isOverride: app.isOverride,
            justification: app.justification,
          },
        });
      }
    }

    // Add payments events if not already covered
    for (const tx of params.payments) {
      const alreadyHas = events.some(
        (e) => e.category === 'PAYMENT' && e.timestamp === tx.updatedAt
      );
      if (!alreadyHas) {
        events.push({
          id: `payment_${tx.id}`,
          timestamp: tx.updatedAt,
          category: 'PAYMENT',
          action: `PAYPAL_${tx.status}`,
          actorId: 'system',
          actorRole: 'SYSTEM',
          summary: `Payment transaction ${tx.status}: authorized $${(tx.authorizedAmountCents / 100).toFixed(2)}, captured $${(tx.capturedAmountCents / 100).toFixed(2)}`,
          referenceId: tx.paypalCaptureId || tx.paypalAuthorizationId || tx.paypalOrderId || tx.id,
          details: {
            paypalOrderId: tx.paypalOrderId,
            paypalAuthorizationId: tx.paypalAuthorizationId,
            paypalCaptureId: tx.paypalCaptureId,
            status: tx.status,
            executionMode: tx.executionMode,
          },
        });
      }
    }

    // Deterministic sort:
    // Primary: timestamp ASC (normalized)
    // Secondary tie-breaker: seq ASC if available, else id ASC
    events.sort((a, b) => {
      const timeDiff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.seq !== undefined && b.seq !== undefined) {
        return a.seq - b.seq;
      }
      return a.id.localeCompare(b.id);
    });

    return events;
  }
}
