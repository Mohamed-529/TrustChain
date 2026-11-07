import crypto from 'node:crypto';
import type {
  EvidenceSubmission,
  SubmitEvidenceInput,
  User,
} from '../../types/domain.ts';
import type { AppDatabase } from '../repositories/Database.ts';
import {
  buildCanonicalEvidenceReferences,
  computeEvidencePayloadSha256,
  type ContractRepository,
  type EvidenceRepository,
  type MilestoneRepository,
} from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import {
  DEMO_EVIDENCE_FIXTURES,
  getDemoFixtureForMilestone,
  type DemoFixtureKey,
} from './DemoEvidenceFixtures.ts';
import {
  OPENAPI_REQUEST_SCHEMAS,
  validatePayloadAgainstSchema,
} from '../middleware/validateRequest.ts';
import { AppError } from '../middleware/errorHandler.ts';

const GITHUB_REPO_URL_REGEX = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/;
const GITHUB_PR_URL_REGEX =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/([0-9]+)\/?$/;
const GIT_COMMIT_SHA_REGEX = /^[0-9a-fA-F]{7,40}$/;

export function parseGitHubRepoOwnerAndName(url: string): { owner: string; repo: string } | null {
  const repoMatch = GITHUB_REPO_URL_REGEX.exec(url.trim());
  if (repoMatch) {
    return {
      owner: repoMatch[1].toLowerCase(),
      repo: repoMatch[2].replace(/\.git$/i, '').toLowerCase(),
    };
  }
  const prMatch = GITHUB_PR_URL_REGEX.exec(url.trim());
  if (prMatch) {
    return {
      owner: prMatch[1].toLowerCase(),
      repo: prMatch[2].replace(/\.git$/i, '').toLowerCase(),
    };
  }
  return null;
}

export class EvidenceService {
  private readonly db: AppDatabase;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly evidenceRepo: EvidenceRepository;
  private readonly auditService: AuditService;

  constructor(
    db: AppDatabase,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    evidenceRepo: EvidenceRepository,
    auditService: AuditService
  ) {
    this.db = db;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.evidenceRepo = evidenceRepo;
    this.auditService = auditService;
  }

  public submitEvidence(
    actor: User,
    milestoneId: string,
    rawPayload: unknown
  ): EvidenceSubmission {
    if (actor.role !== 'DEVELOPER') {
      throw new AppError(
        403,
        'FORBIDDEN_ROLE',
        'Only users with the DEVELOPER role may submit milestone delivery evidence.'
      );
    }

    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }

    const contract = this.contractRepo.findById(milestone.contractId);
    if (!contract) {
      throw new AppError(
        404,
        'CONTRACT_NOT_FOUND',
        `Parent contract '${milestone.contractId}' was not found.`
      );
    }

    if (contract.status !== 'ACTIVE') {
      throw new AppError(
        409,
        'CONTRACT_NOT_ACTIVE',
        `Cannot submit evidence for milestone '${milestoneId}' because contract '${contract.id}' is in '${contract.status}' status.`
      );
    }

    if (contract.developerId !== actor.id) {
      throw new AppError(
        403,
        'FORBIDDEN_NOT_ASSIGNED_DEVELOPER',
        `Developer '${actor.id}' is not the assigned contractor ('${contract.developerId}') for contract '${contract.id}'.`
      );
    }

    if (
      milestone.status === 'APPROVED' ||
      milestone.status === 'SETTLED' ||
      milestone.status === 'REJECTED'
    ) {
      throw new AppError(
        409,
        'MILESTONE_ALREADY_FINALIZED',
        `Cannot submit new evidence for milestone '${milestoneId}' in terminal '${milestone.status}' state.`
      );
    }

    if (milestone.status === 'EVALUATING') {
      throw new AppError(
        409,
        'EVALUATION_IN_PROGRESS',
        `Cannot submit new evidence while milestone '${milestoneId}' is currently being evaluated.`
      );
    }

    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
      throw new AppError(400, 'INVALID_EVIDENCE_PAYLOAD', 'Evidence payload must be a JSON object.');
    }

    const input = rawPayload as SubmitEvidenceInput;

    // Explicit GitHub URL, Commit SHA, and PR URL validation
    if (typeof input.repoUrl !== 'string' || !GITHUB_REPO_URL_REGEX.test(input.repoUrl)) {
      throw new AppError(
        400,
        'INVALID_GITHUB_REPO_URL',
        'Repository URL must be a valid HTTPS GitHub repository URL (https://github.com/<owner>/<repo>).'
      );
    }
    if (typeof input.commitSha !== 'string' || !GIT_COMMIT_SHA_REGEX.test(input.commitSha)) {
      throw new AppError(
        400,
        'INVALID_COMMIT_SHA',
        'Commit SHA must be a valid 7-to-40 character hexadecimal Git commit hash.'
      );
    }
    if (typeof input.prUrl !== 'string' || !GITHUB_PR_URL_REGEX.test(input.prUrl)) {
      throw new AppError(
        400,
        'INVALID_PULL_REQUEST_URL',
        'Pull Request URL must be a valid GitHub PR URL (https://github.com/<owner>/<repo>/pull/<number>).'
      );
    }

    // Validate full payload against OpenAPI 3.0.3 SubmitEvidenceRequest schema
    const schemaCheck = validatePayloadAgainstSchema(
      rawPayload,
      OPENAPI_REQUEST_SCHEMAS.SubmitEvidenceRequest
    );
    if (!schemaCheck.valid) {
      throw new AppError(
        400,
        'INVALID_EVIDENCE_PAYLOAD',
        `Evidence submission failed validation: ${schemaCheck.violations[0]}`,
        { violations: schemaCheck.violations }
      );
    }

    const now = new Date().toISOString();

    return this.db.withTransaction(() => {
      const attemptNumber = this.evidenceRepo.getNextAttemptNumber(milestone.id);
      const submissionId = `ev_sub_${crypto.randomUUID().slice(0, 12)}`;

      const changedFiles = Array.isArray(input.ciReport.changedFiles)
        ? input.ciReport.changedFiles.map((f) => String(f).trim()).filter(Boolean)
        : [];

      const ciReport = {
        provider: input.ciReport.provider.trim(),
        runUrl: input.ciReport.runUrl ? input.ciReport.runUrl.trim() : undefined,
        status: input.ciReport.status,
        totalTests: Number(input.ciReport.totalTests),
        passedTests: Number(input.ciReport.passedTests),
        failedTests: Number(input.ciReport.failedTests),
        coveragePct: Number(input.ciReport.coveragePct),
        changedFiles,
        logSummary: input.ciReport.logSummary,
      };

      const securityScan = {
        scanner: input.securityScan.scanner.trim(),
        scannerVersion: input.securityScan.scannerVersion.trim(),
        status: input.securityScan.status,
        findings: input.securityScan.findings.map((f) => ({
          id: f.id.trim(),
          packageName: f.packageName.trim(),
          severity: f.severity,
          cvssScore: Number(f.cvssScore),
          description: f.description,
        })),
      };

      const developerNotes = (input.developerNotes ?? '').trim();
      const payloadSha256 = computeEvidencePayloadSha256({
        milestoneId: milestone.id,
        attemptNumber,
        submittedBy: actor.id,
        repoUrl: input.repoUrl.trim(),
        branch: input.branch.trim(),
        commitSha: input.commitSha.trim().toLowerCase(),
        prUrl: input.prUrl.trim(),
        prStatus: input.prStatus,
        ciReport,
        securityScan,
        developerNotes,
      });

      const submission: EvidenceSubmission = {
        id: submissionId,
        milestoneId: milestone.id,
        attemptNumber,
        submittedBy: actor.id,
        repoUrl: input.repoUrl.trim(),
        branch: input.branch.trim(),
        commitSha: input.commitSha.trim().toLowerCase(),
        prUrl: input.prUrl.trim(),
        prStatus: input.prStatus,
        ciReport,
        securityScan,
        developerNotes,
        submittedAt: now,
        payloadSha256,
        provenanceStatus: 'UNVERIFIED_UNAVAILABLE',
        canonicalReferences: buildCanonicalEvidenceReferences({
          id: submissionId,
          repoUrl: input.repoUrl.trim(),
          branch: input.branch.trim(),
          commitSha: input.commitSha.trim().toLowerCase(),
          prUrl: input.prUrl.trim(),
          prStatus: input.prStatus,
          ciReport,
          securityScan,
        }),
      };

      this.evidenceRepo.insert(submission);
      this.milestoneRepo.updateStatus(milestone.id, 'SUBMITTED', now);

      this.auditService.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action: 'EVIDENCE_SUBMITTED',
        entityType: 'EVIDENCE',
        entityId: submission.id,
        contractId: contract.id,
        milestoneId: milestone.id,
        previousState: milestone.status,
        newState: 'SUBMITTED',
        payload: {
          attemptNumber,
          repoUrl: submission.repoUrl,
          branch: submission.branch,
          commitSha: submission.commitSha,
          prUrl: submission.prUrl,
          prStatus: submission.prStatus,
          changedFileCount: changedFiles.length,
          ciStatus: submission.ciReport.status,
          securityScannerStatus: submission.securityScan.status,
          payloadSha256,
          provenanceStatus: submission.provenanceStatus,
          canonicalEvidenceIds: (submission.canonicalReferences ?? []).map((r) => r.evidenceId),
        },
        timestamp: now,
      });

      return submission;
    });
  }

  public listEvidenceForMilestone(milestoneId: string): EvidenceSubmission[] {
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(404, 'MILESTONE_NOT_FOUND', `Milestone '${milestoneId}' was not found.`);
    }
    return this.evidenceRepo.listByMilestoneId(milestoneId);
  }

  /**
   * Deterministic demo evidence loader using realistic fixtures without requiring a live GitHub token.
   */
  public submitDemoFixture(
    actor: User,
    milestoneId: string,
    fixtureKey?: DemoFixtureKey
  ): EvidenceSubmission {
    const fixture = fixtureKey
      ? DEMO_EVIDENCE_FIXTURES[fixtureKey]
      : getDemoFixtureForMilestone(milestoneId);

    if (!fixture) {
      throw new AppError(
        404,
        'DEMO_FIXTURE_NOT_FOUND',
        `No deterministic demo fixture found for milestone '${milestoneId}'.`
      );
    }

    return this.submitEvidence(actor, milestoneId, fixture.payload);
  }
}
