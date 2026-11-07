import crypto from 'node:crypto';
import type {
  EvidenceIntegrityVerification,
  EvidenceProvenanceStatus,
  EvidenceProvenanceVerificationRecord,
  EvidenceSubmission,
  EvidenceVerificationResultItem,
  GitHubCommitVerification,
  GitHubPullRequestVerification,
  GitHubRepositoryVerification,
  GitHubWebhookEventRecord,
  GitHubWebhookSignatureStatus,
  GitHubWorkflowRunVerification,
  User,
  VerificationResultStatus,
} from '../../types/domain.ts';
import type { AppDatabase } from '../repositories/Database.ts';
import {
  computeEvidencePayloadSha256,
  EVIDENCE_CANONICALIZATION_VERSION,
  EVIDENCE_HASH_ALGORITHM,
  type ContractRepository,
  type EvidenceProvenanceRepository,
  type EvidenceRepository,
  type GitHubWebhookEventRepository,
  type MilestoneRepository,
} from '../repositories/DomainRepositories.ts';
import type { AuditService } from './AuditService.ts';
import { AppError } from '../middleware/errorHandler.ts';

const GITHUB_REPO_PARSE_REGEX =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/;
const GITHUB_PR_PARSE_REGEX =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)\/pull\/([0-9]+)\/?$/;
const GITHUB_ACTIONS_RUN_PARSE_REGEX =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)\/actions\/runs\/([0-9]+)\/?$/;

export interface GitHubVerificationServiceOptions {
  fetchImpl?: typeof fetch;
  githubToken?: string;
  githubWebhookSecret?: string;
  githubApiBaseUrl?: string;
  requestTimeoutMs?: number;
  allowUnauthenticatedPublicCalls?: boolean;
  beforeWebhookProcessHook?: (deliveryId: string, eventType: string) => void;
}

interface GitHubApiCallOutcome<T> {
  status: 'OK' | 'NOT_FOUND' | 'UNAVAILABLE';
  httpStatus: number | null;
  data: T | null;
  errorMessage: string | null;
}

/**
 * Phase 7 — Independent GitHub Evidence Provenance & Webhook Verification Service.
 *
 * Uses GitHub's official REST API (`https://api.github.com`) to independently verify:
 * 1. Repository existence, canonical full name, visibility, and default branch (`GET /repos/{owner}/{repo}`).
 * 2. Commit existence in that repository, canonical 40-char SHA, author/committer metadata,
 *    and changed file list (`GET /repos/{owner}/{repo}/commits/{ref}`).
 * 3. Pull Request existence in that repository, state (`open`/`closed`), `merged` flag,
 *    and whether `head.sha` or `merge_commit_sha` references the submitted commit (`GET /repos/{owner}/{repo}/pulls/{pull_number}`).
 * 4. GitHub Actions Workflow Run existence, `status`, `conclusion`, and whether `head_sha`
 *    matches the submitted commit (`GET /repos/{owner}/{repo}/actions/runs/{run_id}`).
 * 5. Submitted evidence payload tamper detection (`payloadSha256` comparison).
 * 6. Authentic GitHub Webhooks (`X-Hub-Signature-256` HMAC-SHA256 constant-time verification
 *    and `X-GitHub-Delivery` persistent idempotency).
 *
 * CRITICAL FINANCIAL BOUNDARY:
 * GitHub verification NEVER directly approves a milestone (`APPROVED`), alters contractual budgets,
 * or triggers PayPal payment operations. It only produces an auditable provenance verification record
 * that informs downstream evaluation and human fiduciary review.
 */
export class GitHubVerificationService {
  private readonly db: AppDatabase;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo: MilestoneRepository;
  private readonly evidenceRepo: EvidenceRepository;
  private readonly provenanceRepo: EvidenceProvenanceRepository;
  private readonly githubWebhookRepo: GitHubWebhookEventRepository;
  private readonly auditService: AuditService;
  private readonly options?: GitHubVerificationServiceOptions;
  private readonly activeWebhookLocks = new Set<string>();

  constructor(
    db: AppDatabase,
    contractRepo: ContractRepository,
    milestoneRepo: MilestoneRepository,
    evidenceRepo: EvidenceRepository,
    provenanceRepo: EvidenceProvenanceRepository,
    githubWebhookRepo: GitHubWebhookEventRepository,
    auditService: AuditService,
    options?: GitHubVerificationServiceOptions
  ) {
    this.db = db;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
    this.evidenceRepo = evidenceRepo;
    this.provenanceRepo = provenanceRepo;
    this.githubWebhookRepo = githubWebhookRepo;
    this.auditService = auditService;
    this.options = options;
  }

  private getFetch(): typeof fetch {
    return this.options?.fetchImpl ?? fetch;
  }

  private getGitHubToken(): string | undefined {
    const raw = this.options?.githubToken ?? process.env.GITHUB_TOKEN;
    if (!raw || raw.trim() === '' || raw === 'YOUR_GITHUB_TOKEN') {
      return undefined;
    }
    return raw.trim();
  }

  private getWebhookSecret(): string | undefined {
    const raw =
      this.options?.githubWebhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET;
    if (!raw || raw.trim() === '' || raw === 'YOUR_GITHUB_WEBHOOK_SECRET') {
      return undefined;
    }
    return raw.trim();
  }

  private getApiBaseUrl(): string {
    return (
      this.options?.githubApiBaseUrl ??
      process.env.GITHUB_API_BASE_URL ??
      'https://api.github.com'
    ).replace(/\/$/, '');
  }

  private getTimeoutMs(): number {
    return this.options?.requestTimeoutMs ?? 10_000;
  }

  public isGitHubApiConfigured(): boolean {
    return Boolean(
      this.getGitHubToken() ||
        this.options?.fetchImpl ||
        this.options?.allowUnauthenticatedPublicCalls
    );
  }

  public isWebhookSecretConfigured(): boolean {
    return Boolean(this.getWebhookSecret());
  }

  private async callGitHubApi<T = Record<string, unknown>>(
    apiPath: string
  ): Promise<GitHubApiCallOutcome<T>> {
    if (!this.isGitHubApiConfigured()) {
      return {
        status: 'UNAVAILABLE',
        httpStatus: null,
        data: null,
        errorMessage:
          'GitHub API verification is unconfigured (GITHUB_TOKEN is not set and live unauthenticated probing is disabled).',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.getTimeoutMs());

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'MilestoneProof-AI-Verifier/2.0',
    };
    const token = this.getGitHubToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const res = await this.getFetch()(`${this.getApiBaseUrl()}${apiPath}`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (res.status === 404) {
        return {
          status: 'NOT_FOUND',
          httpStatus: 404,
          data: null,
          errorMessage: `GitHub resource '${apiPath}' returned HTTP 404 Not Found.`,
        };
      }

      if (!res.ok) {
        return {
          status: 'UNAVAILABLE',
          httpStatus: res.status,
          data: null,
          errorMessage: `GitHub API '${apiPath}' returned HTTP ${res.status}.`,
        };
      }

      const json = (await res.json()) as T;
      if (!json || typeof json !== 'object') {
        return {
          status: 'UNAVAILABLE',
          httpStatus: res.status,
          data: null,
          errorMessage: `GitHub API '${apiPath}' returned non-object JSON.`,
        };
      }

      return {
        status: 'OK',
        httpStatus: res.status,
        data: json,
        errorMessage: null,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: 'UNAVAILABLE',
        httpStatus: null,
        data: null,
        errorMessage: `GitHub API request '${apiPath}' failed: ${msg}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Computes and compares the canonical SHA-256 digest of the stored evidence submission
   * against its persisted `payloadSha256` to detect any post-submission tampering.
   */
  public verifyEvidencePayloadIntegrity(
    submission: EvidenceSubmission
  ): EvidenceIntegrityVerification {
    const actualHash = computeEvidencePayloadSha256({
      milestoneId: submission.milestoneId,
      attemptNumber: submission.attemptNumber,
      submittedBy: submission.submittedBy,
      repoUrl: submission.repoUrl,
      branch: submission.branch,
      commitSha: submission.commitSha,
      prUrl: submission.prUrl,
      prStatus: submission.prStatus,
      ciReport: submission.ciReport,
      securityScan: submission.securityScan,
      developerNotes: submission.developerNotes,
    });
    const expectedHash = submission.payloadSha256 ?? actualHash;
    const matches = expectedHash === actualHash;

    return {
      payloadHashMatches: matches,
      expectedPayloadSha256: expectedHash,
      actualPayloadSha256: actualHash,
      hashAlgorithm: submission.payloadHashAlgorithm ?? EVIDENCE_HASH_ALGORITHM,
      canonicalizationVersion:
        submission.canonicalizationVersion ?? EVIDENCE_CANONICALIZATION_VERSION,
      hashedAt: submission.payloadHashedAt ?? submission.submittedAt,
      details: matches
        ? `Evidence payload SHA-256 digest (${actualHash.slice(0, 16)}…) matches the immutable submission digest (${EVIDENCE_CANONICALIZATION_VERSION}).`
        : `TAMPER DETECTED: Stored evidence payload SHA-256 (${actualHash.slice(0, 16)}…) does not match original submission digest (${expectedHash.slice(0, 16)}…).`,
    };
  }

  /**
   * Independently verifies a milestone's latest (or specified) evidence submission against
   * GitHub's official REST API (`GET /repos/{owner}/{repo}`, `/commits/{sha}`, `/pulls/{number}`, `/actions/runs/{id}`).
   *
   * Never directly approves a milestone or releases payment.
   */
  public async verifyMilestoneEvidenceProvenance(
    actor: User,
    milestoneId: string,
    submissionId?: string
  ): Promise<EvidenceProvenanceVerificationRecord> {
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(
        404,
        'MILESTONE_NOT_FOUND',
        `Milestone '${milestoneId}' was not found.`
      );
    }

    const contract = this.contractRepo.findById(milestone.contractId);
    if (!contract) {
      throw new AppError(
        404,
        'CONTRACT_NOT_FOUND',
        `Contract '${milestone.contractId}' was not found.`
      );
    }

    const submission = submissionId
      ? this.evidenceRepo.findById(submissionId)
      : this.evidenceRepo.findLatestByMilestoneId(milestoneId);

    if (!submission || submission.milestoneId !== milestoneId) {
      throw new AppError(
        404,
        'EVIDENCE_SUBMISSION_NOT_FOUND',
        `No evidence submission found for milestone '${milestoneId}'.`
      );
    }

    // 1. Check payload tamper integrity first
    const integrity = this.verifyEvidencePayloadIntegrity(submission);
    const blockingReasons: string[] = [];
    const discrepancies: string[] = [];

    if (!integrity.payloadHashMatches) {
      blockingReasons.push(integrity.details);
      discrepancies.push(integrity.details);
    }

    // Parse repository owner/name from repoUrl
    const repoMatch = GITHUB_REPO_PARSE_REGEX.exec(submission.repoUrl.trim());
    const expectedOwner = repoMatch ? repoMatch[1] : '';
    const expectedRepo = repoMatch ? repoMatch[2] : '';

    // Parse PR coordinates from prUrl
    const prMatch = GITHUB_PR_PARSE_REGEX.exec(submission.prUrl.trim());
    const prOwner = prMatch ? prMatch[1] : '';
    const prRepo = prMatch ? prMatch[2] : '';
    const prNumber = prMatch ? Number(prMatch[3]) : null;

    // Parse GitHub Actions run coordinates if runUrl is a GitHub Actions URL
    const runUrl = submission.ciReport.runUrl?.trim() ?? '';
    const runMatch = runUrl ? GITHUB_ACTIONS_RUN_PARSE_REGEX.exec(runUrl) : null;
    const runOwner = runMatch ? runMatch[1] : '';
    const runRepo = runMatch ? runMatch[2] : '';
    const runId = runMatch ? Number(runMatch[3]) : null;

    const isConfigured = this.isGitHubApiConfigured();

    // 2. Verify Repository (`GET /repos/{owner}/{repo}`)
    let repositoryVerification: GitHubRepositoryVerification;
    if (!expectedOwner || !expectedRepo) {
      repositoryVerification = {
        status: 'MISMATCH',
        owner: expectedOwner,
        repo: expectedRepo,
        canonicalFullName: null,
        repositoryId: null,
        visibility: null,
        defaultBranch: null,
        htmlUrl: null,
        details: `Invalid GitHub repository URL '${submission.repoUrl}'.`,
      };
      discrepancies.push(repositoryVerification.details);
      blockingReasons.push(repositoryVerification.details);
    } else {
      const repoRes = await this.callGitHubApi<Record<string, unknown>>(
        `/repos/${encodeURIComponent(expectedOwner)}/${encodeURIComponent(expectedRepo)}`
      );
      if (repoRes.status === 'UNAVAILABLE') {
        repositoryVerification = {
          status: 'UNAVAILABLE',
          owner: expectedOwner,
          repo: expectedRepo,
          canonicalFullName: null,
          repositoryId: null,
          visibility: null,
          defaultBranch: null,
          htmlUrl: null,
          details: repoRes.errorMessage ?? 'GitHub repository verification unavailable.',
        };
      } else if (repoRes.status === 'NOT_FOUND' || !repoRes.data) {
        repositoryVerification = {
          status: 'NOT_FOUND',
          owner: expectedOwner,
          repo: expectedRepo,
          canonicalFullName: null,
          repositoryId: null,
          visibility: null,
          defaultBranch: null,
          htmlUrl: null,
          details: `GitHub repository '${expectedOwner}/${expectedRepo}' does not exist (404 Not Found).`,
        };
        discrepancies.push(repositoryVerification.details);
        blockingReasons.push(repositoryVerification.details);
      } else {
        const d = repoRes.data;
        const fullName = typeof d.full_name === 'string' ? d.full_name : `${expectedOwner}/${expectedRepo}`;
        const repoId = typeof d.id === 'number' ? d.id : null;
        const visibility =
          typeof d.visibility === 'string'
            ? d.visibility
            : d.private === true
              ? 'private'
              : 'public';
        const defaultBranch =
          typeof d.default_branch === 'string' ? d.default_branch : null;
        const htmlUrl = typeof d.html_url === 'string' ? d.html_url : submission.repoUrl;

        repositoryVerification = {
          status: 'VERIFIED',
          owner: expectedOwner,
          repo: expectedRepo,
          canonicalFullName: fullName,
          repositoryId: repoId,
          visibility,
          defaultBranch,
          htmlUrl,
          details: `Verified GitHub repository '${fullName}' (id: ${repoId ?? 'n/a'}, visibility: ${visibility}, default_branch: ${defaultBranch ?? 'main'}).`,
        };
      }
    }

    // 3. Verify Commit (`GET /repos/{owner}/{repo}/commits/{ref}`)
    let commitVerification: GitHubCommitVerification;
    if (repositoryVerification.status === 'NOT_FOUND' || repositoryVerification.status === 'MISMATCH') {
      commitVerification = {
        status: 'NOT_FOUND',
        submittedSha: submission.commitSha,
        canonicalSha: null,
        belongsToRepository: false,
        authorLogin: null,
        committerDate: null,
        messageHeadline: null,
        changedFiles: [],
        changedFilesMatchSubmitted: false,
        htmlUrl: null,
        details: `Cannot verify commit '${submission.commitSha}' because repository '${expectedOwner}/${expectedRepo}' was not found.`,
      };
    } else if (repositoryVerification.status === 'UNAVAILABLE') {
      commitVerification = {
        status: 'UNAVAILABLE',
        submittedSha: submission.commitSha,
        canonicalSha: null,
        belongsToRepository: false,
        authorLogin: null,
        committerDate: null,
        messageHeadline: null,
        changedFiles: [],
        changedFilesMatchSubmitted: false,
        htmlUrl: null,
        details: 'GitHub commit verification unavailable because repository API was unreachable.',
      };
    } else {
      const commitRes = await this.callGitHubApi<Record<string, unknown>>(
        `/repos/${encodeURIComponent(expectedOwner)}/${encodeURIComponent(expectedRepo)}/commits/${encodeURIComponent(submission.commitSha)}`
      );
      if (commitRes.status === 'UNAVAILABLE') {
        commitVerification = {
          status: 'UNAVAILABLE',
          submittedSha: submission.commitSha,
          canonicalSha: null,
          belongsToRepository: false,
          authorLogin: null,
          committerDate: null,
          messageHeadline: null,
          changedFiles: [],
          changedFilesMatchSubmitted: false,
          htmlUrl: null,
          details: commitRes.errorMessage ?? 'GitHub commit verification unavailable.',
        };
      } else if (commitRes.status === 'NOT_FOUND' || !commitRes.data) {
        commitVerification = {
          status: 'NOT_FOUND',
          submittedSha: submission.commitSha,
          canonicalSha: null,
          belongsToRepository: false,
          authorLogin: null,
          committerDate: null,
          messageHeadline: null,
          changedFiles: [],
          changedFilesMatchSubmitted: false,
          htmlUrl: null,
          details: `Commit '${submission.commitSha}' does not exist in repository '${expectedOwner}/${expectedRepo}'.`,
        };
        discrepancies.push(commitVerification.details);
        blockingReasons.push(commitVerification.details);
      } else {
        const cd = commitRes.data;
        const canonicalSha =
          typeof cd.sha === 'string' ? cd.sha.toLowerCase() : submission.commitSha;
        const shaPrefixMatch = canonicalSha.startsWith(submission.commitSha.toLowerCase());
        const authorObj =
          cd.author && typeof cd.author === 'object'
            ? (cd.author as Record<string, unknown>)
            : null;
        const commitInner =
          cd.commit && typeof cd.commit === 'object'
            ? (cd.commit as Record<string, unknown>)
            : null;
        const committerInner =
          commitInner?.committer && typeof commitInner.committer === 'object'
            ? (commitInner.committer as Record<string, unknown>)
            : null;
        const authorLogin =
          typeof authorObj?.login === 'string' ? authorObj.login : null;
        const committerDate =
          typeof committerInner?.date === 'string' ? committerInner.date : null;
        const rawMessage =
          typeof commitInner?.message === 'string' ? commitInner.message : '';
        const messageHeadline = rawMessage ? rawMessage.split('\n')[0].trim() : null;
        const filesArr = Array.isArray(cd.files) ? cd.files : [];
        const githubChangedFiles = filesArr
          .map((f) =>
            f && typeof f === 'object' && typeof (f as Record<string, unknown>).filename === 'string'
              ? String((f as Record<string, unknown>).filename)
              : ''
          )
          .filter(Boolean);

        const submittedFiles = submission.ciReport.changedFiles ?? [];
        const githubFileSet = new Set(githubChangedFiles);
        const changedFilesMatch =
          githubChangedFiles.length === 0 ||
          (submittedFiles.length > 0 &&
            submittedFiles.every((sf) => githubFileSet.has(sf)));

        if (!shaPrefixMatch) {
          const msg = `Commit SHA mismatch: submitted '${submission.commitSha}', GitHub returned '${canonicalSha}'.`;
          discrepancies.push(msg);
          blockingReasons.push(msg);
        } else if (!changedFilesMatch) {
          const msg = `Commit changed files mismatch: developer claimed [${submittedFiles.join(', ')}], but GitHub commit '${canonicalSha.slice(0, 12)}' modified [${githubChangedFiles.join(', ')}].`;
          discrepancies.push(msg);
        }

        commitVerification = {
          status: shaPrefixMatch && changedFilesMatch ? 'VERIFIED' : 'MISMATCH',
          submittedSha: submission.commitSha,
          canonicalSha,
          belongsToRepository: shaPrefixMatch,
          authorLogin,
          committerDate,
          messageHeadline,
          changedFiles: githubChangedFiles,
          changedFilesMatchSubmitted: changedFilesMatch,
          htmlUrl: typeof cd.html_url === 'string' ? cd.html_url : null,
          details:
            shaPrefixMatch && changedFilesMatch
              ? `Verified commit '${canonicalSha.slice(0, 12)}' in '${expectedOwner}/${expectedRepo}' (${githubChangedFiles.length} changed files).`
              : `Commit verification detected discrepancies for '${submission.commitSha}'.`,
        };
      }
    }

    // 4. Verify Pull Request (`GET /repos/{owner}/{repo}/pulls/{pull_number}`)
    let prVerification: GitHubPullRequestVerification;
    const prRepoMatchesSubmittedRepo =
      Boolean(prOwner && prRepo && prNumber !== null) &&
      prOwner.toLowerCase() === expectedOwner.toLowerCase() &&
      prRepo.toLowerCase() === expectedRepo.toLowerCase();

    if (!prMatch || prNumber === null) {
      prVerification = {
        status: 'MISMATCH',
        prNumber: null,
        belongsToRepository: false,
        state: null,
        merged: null,
        actualPrStatus: null,
        statusMatchesSubmitted: false,
        headSha: null,
        mergeCommitSha: null,
        referencesSubmittedCommit: false,
        baseRef: null,
        headRef: null,
        htmlUrl: null,
        details: `Invalid Pull Request URL '${submission.prUrl}'.`,
      };
      discrepancies.push(prVerification.details);
      blockingReasons.push(prVerification.details);
    } else if (!prRepoMatchesSubmittedRepo) {
      const msg = `Pull Request '${submission.prUrl}' belongs to '${prOwner}/${prRepo}', which does not match target repository '${expectedOwner}/${expectedRepo}'.`;
      prVerification = {
        status: 'MISMATCH',
        prNumber,
        belongsToRepository: false,
        state: null,
        merged: null,
        actualPrStatus: null,
        statusMatchesSubmitted: false,
        headSha: null,
        mergeCommitSha: null,
        referencesSubmittedCommit: false,
        baseRef: null,
        headRef: null,
        htmlUrl: submission.prUrl,
        details: msg,
      };
      discrepancies.push(msg);
      blockingReasons.push(msg);
    } else if (repositoryVerification.status === 'UNAVAILABLE') {
      prVerification = {
        status: 'UNAVAILABLE',
        prNumber,
        belongsToRepository: true,
        state: null,
        merged: null,
        actualPrStatus: null,
        statusMatchesSubmitted: false,
        headSha: null,
        mergeCommitSha: null,
        referencesSubmittedCommit: false,
        baseRef: null,
        headRef: null,
        htmlUrl: submission.prUrl,
        details: 'GitHub Pull Request verification unavailable because GitHub API is unreachable.',
      };
    } else if (repositoryVerification.status === 'NOT_FOUND') {
      prVerification = {
        status: 'NOT_FOUND',
        prNumber,
        belongsToRepository: false,
        state: null,
        merged: null,
        actualPrStatus: null,
        statusMatchesSubmitted: false,
        headSha: null,
        mergeCommitSha: null,
        referencesSubmittedCommit: false,
        baseRef: null,
        headRef: null,
        htmlUrl: submission.prUrl,
        details: `Cannot verify Pull Request #${prNumber} because repository '${expectedOwner}/${expectedRepo}' was not found.`,
      };
    } else {
      const prRes = await this.callGitHubApi<Record<string, unknown>>(
        `/repos/${encodeURIComponent(expectedOwner)}/${encodeURIComponent(expectedRepo)}/pulls/${prNumber}`
      );
      if (prRes.status === 'UNAVAILABLE') {
        prVerification = {
          status: 'UNAVAILABLE',
          prNumber,
          belongsToRepository: true,
          state: null,
          merged: null,
          actualPrStatus: null,
          statusMatchesSubmitted: false,
          headSha: null,
          mergeCommitSha: null,
          referencesSubmittedCommit: false,
          baseRef: null,
          headRef: null,
          htmlUrl: submission.prUrl,
          details: prRes.errorMessage ?? 'GitHub Pull Request verification unavailable.',
        };
      } else if (prRes.status === 'NOT_FOUND' || !prRes.data) {
        const msg = `Pull Request #${prNumber} does not exist in '${expectedOwner}/${expectedRepo}'.`;
        prVerification = {
          status: 'NOT_FOUND',
          prNumber,
          belongsToRepository: false,
          state: null,
          merged: null,
          actualPrStatus: null,
          statusMatchesSubmitted: false,
          headSha: null,
          mergeCommitSha: null,
          referencesSubmittedCommit: false,
          baseRef: null,
          headRef: null,
          htmlUrl: submission.prUrl,
          details: msg,
        };
        discrepancies.push(msg);
        blockingReasons.push(msg);
      } else {
        const pd = prRes.data;
        const state = pd.state === 'open' ? 'open' : 'closed';
        const merged = Boolean(pd.merged === true || pd.merged_at);
        const actualPrStatus: 'MERGED' | 'OPEN' | 'CLOSED' = merged
          ? 'MERGED'
          : state === 'open'
            ? 'OPEN'
            : 'CLOSED';
        const statusMatches = actualPrStatus === submission.prStatus;

        const headObj =
          pd.head && typeof pd.head === 'object' ? (pd.head as Record<string, unknown>) : null;
        const baseObj =
          pd.base && typeof pd.base === 'object' ? (pd.base as Record<string, unknown>) : null;
        const headSha =
          typeof headObj?.sha === 'string' ? headObj.sha.toLowerCase() : null;
        const mergeCommitSha =
          typeof pd.merge_commit_sha === 'string' ? pd.merge_commit_sha.toLowerCase() : null;
        const baseRef = typeof baseObj?.ref === 'string' ? baseObj.ref : null;
        const headRef = typeof headObj?.ref === 'string' ? headObj.ref : null;

        const subShaLower = submission.commitSha.toLowerCase();
        const referencesCommit = Boolean(
          (headSha && headSha.startsWith(subShaLower)) ||
            (mergeCommitSha && mergeCommitSha.startsWith(subShaLower))
        );

        if (!statusMatches) {
          const msg = `PR #${prNumber} status mismatch: developer claimed '${submission.prStatus}', but GitHub reports '${actualPrStatus}'.`;
          discrepancies.push(msg);
          blockingReasons.push(msg);
        }
        if (!referencesCommit) {
          const msg = `PR #${prNumber} commit mismatch: neither head.sha ('${headSha ?? 'none'}') nor merge_commit_sha ('${mergeCommitSha ?? 'none'}') matches submitted commit '${submission.commitSha}'.`;
          discrepancies.push(msg);
          blockingReasons.push(msg);
        }

        const prVerified = statusMatches && referencesCommit;
        prVerification = {
          status: prVerified ? 'VERIFIED' : 'MISMATCH',
          prNumber,
          belongsToRepository: true,
          state,
          merged,
          actualPrStatus,
          statusMatchesSubmitted: statusMatches,
          headSha,
          mergeCommitSha,
          referencesSubmittedCommit: referencesCommit,
          baseRef,
          headRef,
          htmlUrl: typeof pd.html_url === 'string' ? pd.html_url : submission.prUrl,
          details: prVerified
            ? `Verified PR #${prNumber} in '${expectedOwner}/${expectedRepo}' (status: ${actualPrStatus}, headSha: ${headSha?.slice(0, 12)}).`
            : `PR #${prNumber} failed provenance verification (actual status: ${actualPrStatus}, referencesCommit: ${referencesCommit}).`,
        };
      }
    }

    // 5. Verify GitHub Actions Workflow Run (`GET /repos/{owner}/{repo}/actions/runs/{run_id}`)
    let workflowVerification: GitHubWorkflowRunVerification;
    if (!runUrl) {
      workflowVerification = {
        status: 'NOT_APPLICABLE',
        runId: null,
        workflowName: null,
        runStatus: null,
        conclusion: null,
        headSha: null,
        headBranch: null,
        eventType: null,
        createdAt: null,
        updatedAt: null,
        matchesSubmittedCommit: false,
        statusMatchesSubmittedCi: false,
        htmlUrl: null,
        details: 'No GitHub Actions runUrl was provided in ciReport.',
      };
    } else if (!runMatch || runId === null) {
      workflowVerification = {
        status: 'MISMATCH',
        runId: null,
        workflowName: null,
        runStatus: null,
        conclusion: null,
        headSha: null,
        headBranch: null,
        eventType: null,
        createdAt: null,
        updatedAt: null,
        matchesSubmittedCommit: false,
        statusMatchesSubmittedCi: false,
        htmlUrl: runUrl,
        details: `CI runUrl '${runUrl}' is not a valid GitHub Actions run URL.`,
      };
      discrepancies.push(workflowVerification.details);
    } else if (
      runOwner.toLowerCase() !== expectedOwner.toLowerCase() ||
      runRepo.toLowerCase() !== expectedRepo.toLowerCase()
    ) {
      const msg = `GitHub Actions run '${runUrl}' belongs to '${runOwner}/${runRepo}', which does not match target repository '${expectedOwner}/${expectedRepo}'.`;
      workflowVerification = {
        status: 'MISMATCH',
        runId,
        workflowName: null,
        runStatus: null,
        conclusion: null,
        headSha: null,
        headBranch: null,
        eventType: null,
        createdAt: null,
        updatedAt: null,
        matchesSubmittedCommit: false,
        statusMatchesSubmittedCi: false,
        htmlUrl: runUrl,
        details: msg,
      };
      discrepancies.push(msg);
      blockingReasons.push(msg);
    } else if (repositoryVerification.status === 'UNAVAILABLE') {
      workflowVerification = {
        status: 'UNAVAILABLE',
        runId,
        workflowName: null,
        runStatus: null,
        conclusion: null,
        headSha: null,
        headBranch: null,
        eventType: null,
        createdAt: null,
        updatedAt: null,
        matchesSubmittedCommit: false,
        statusMatchesSubmittedCi: false,
        htmlUrl: runUrl,
        details: 'GitHub Actions workflow verification unavailable because GitHub API is unreachable.',
      };
    } else if (repositoryVerification.status === 'NOT_FOUND') {
      workflowVerification = {
        status: 'NOT_FOUND',
        runId,
        workflowName: null,
        runStatus: null,
        conclusion: null,
        headSha: null,
        headBranch: null,
        eventType: null,
        createdAt: null,
        updatedAt: null,
        matchesSubmittedCommit: false,
        statusMatchesSubmittedCi: false,
        htmlUrl: runUrl,
        details: `Cannot verify GitHub Actions run #${runId} because repository '${expectedOwner}/${expectedRepo}' was not found.`,
      };
    } else {
      const runRes = await this.callGitHubApi<Record<string, unknown>>(
        `/repos/${encodeURIComponent(expectedOwner)}/${encodeURIComponent(expectedRepo)}/actions/runs/${runId}`
      );
      if (runRes.status === 'UNAVAILABLE') {
        workflowVerification = {
          status: 'UNAVAILABLE',
          runId,
          workflowName: null,
          runStatus: null,
          conclusion: null,
          headSha: null,
          headBranch: null,
          eventType: null,
          createdAt: null,
          updatedAt: null,
          matchesSubmittedCommit: false,
          statusMatchesSubmittedCi: false,
          htmlUrl: runUrl,
          details: runRes.errorMessage ?? 'GitHub Actions workflow verification unavailable.',
        };
      } else if (runRes.status === 'NOT_FOUND' || !runRes.data) {
        const msg = `GitHub Actions workflow run #${runId} does not exist in '${expectedOwner}/${expectedRepo}'.`;
        workflowVerification = {
          status: 'NOT_FOUND',
          runId,
          workflowName: null,
          runStatus: null,
          conclusion: null,
          headSha: null,
          headBranch: null,
          eventType: null,
          createdAt: null,
          updatedAt: null,
          matchesSubmittedCommit: false,
          statusMatchesSubmittedCi: false,
          htmlUrl: runUrl,
          details: msg,
        };
        discrepancies.push(msg);
        blockingReasons.push(msg);
      } else {
        const wd = runRes.data;
        const workflowName =
          typeof wd.name === 'string'
            ? wd.name
            : typeof wd.path === 'string'
              ? wd.path
              : 'CI Workflow';
        const runStatus = typeof wd.status === 'string' ? wd.status : null;
        const conclusion = typeof wd.conclusion === 'string' ? wd.conclusion : null;
        const headSha =
          typeof wd.head_sha === 'string' ? wd.head_sha.toLowerCase() : null;
        const headBranch =
          typeof wd.head_branch === 'string' ? wd.head_branch : null;
        const eventType =
          typeof wd.event === 'string' ? wd.event : null;
        const createdAt =
          typeof wd.created_at === 'string' ? wd.created_at : null;
        const updatedAt =
          typeof wd.updated_at === 'string' ? wd.updated_at : null;

        const matchesCommit = Boolean(
          headSha && headSha.startsWith(submission.commitSha.toLowerCase())
        );

        const isStillRunning =
          runStatus === 'in_progress' ||
          runStatus === 'queued' ||
          runStatus === 'waiting' ||
          runStatus === 'requested' ||
          runStatus === 'pending';

        const actualSucceeded =
          runStatus === 'completed' && conclusion === 'success';
        const claimedSucceeded = submission.ciReport.status === 'SUCCESS';
        const statusMatchesCi = isStillRunning
          ? false
          : actualSucceeded === claimedSucceeded;

        if (!matchesCommit) {
          const msg = `Workflow run #${runId} head_sha ('${headSha ?? 'none'}') does not match submitted commit '${submission.commitSha}'.`;
          discrepancies.push(msg);
          blockingReasons.push(msg);
        } else if (isStillRunning) {
          const msg = `Workflow run #${runId} is still '${runStatus}' (conclusion pending). Settlement eligibility remains PENDING until completion.`;
          blockingReasons.push(msg);
        } else if (!statusMatchesCi) {
          const msg = `Workflow run #${runId} conclusion mismatch: developer claimed CI status '${submission.ciReport.status}', but GitHub Actions reported status='${runStatus}', conclusion='${conclusion}'.`;
          discrepancies.push(msg);
          blockingReasons.push(msg);
        }

        const wfVerified = matchesCommit && !isStillRunning && statusMatchesCi;
        const wfStatus = !matchesCommit
          ? 'MISMATCH'
          : isStillRunning
            ? 'PENDING'
            : wfVerified
              ? 'VERIFIED'
              : 'MISMATCH';

        workflowVerification = {
          status: wfStatus,
          runId,
          workflowName,
          runStatus,
          conclusion,
          headSha,
          headBranch,
          eventType,
          createdAt,
          updatedAt,
          matchesSubmittedCommit: matchesCommit,
          statusMatchesSubmittedCi: statusMatchesCi,
          htmlUrl: typeof wd.html_url === 'string' ? wd.html_url : runUrl,
          details:
            wfStatus === 'VERIFIED'
              ? `Verified GitHub Actions run #${runId} ('${workflowName}', status: ${runStatus}, conclusion: ${conclusion}, head_sha: ${headSha?.slice(0, 12)}).`
              : wfStatus === 'PENDING'
                ? `GitHub Actions run #${runId} ('${workflowName}') is still '${runStatus}' for commit '${headSha?.slice(0, 12)}'.`
                : `GitHub Actions run #${runId} failed provenance verification (status: ${runStatus}, conclusion: ${conclusion}, matchesCommit: ${matchesCommit}).`,
        };
      }
    }

    // 6. Compute Overall Provenance Status
    let overallStatus: EvidenceProvenanceStatus;
    const anyMismatchOrNotFound =
      repositoryVerification.status === 'MISMATCH' ||
      repositoryVerification.status === 'NOT_FOUND' ||
      commitVerification.status === 'MISMATCH' ||
      commitVerification.status === 'NOT_FOUND' ||
      prVerification.status === 'MISMATCH' ||
      prVerification.status === 'NOT_FOUND' ||
      workflowVerification.status === 'MISMATCH' ||
      workflowVerification.status === 'NOT_FOUND';

    const anyPending = workflowVerification.status === 'PENDING';

    const allVerified =
      repositoryVerification.status === 'VERIFIED' &&
      commitVerification.status === 'VERIFIED' &&
      prVerification.status === 'VERIFIED' &&
      (workflowVerification.status === 'VERIFIED' ||
        workflowVerification.status === 'NOT_APPLICABLE');

    if (!integrity.payloadHashMatches) {
      overallStatus = 'TAMPERED_PAYLOAD';
    } else if (anyMismatchOrNotFound) {
      overallStatus = 'MISMATCH_DETECTED';
    } else if (anyPending) {
      overallStatus = 'PENDING';
    } else if (allVerified) {
      overallStatus = 'VERIFIED';
    } else if (
      repositoryVerification.status === 'VERIFIED' ||
      commitVerification.status === 'VERIFIED' ||
      prVerification.status === 'VERIFIED'
    ) {
      overallStatus = 'PARTIALLY_VERIFIED';
    } else {
      overallStatus = 'UNVERIFIED_UNAVAILABLE';
    }

    const verificationStatus: VerificationResultStatus =
      overallStatus === 'VERIFIED'
        ? 'VERIFIED'
        : overallStatus === 'TAMPERED_PAYLOAD' || overallStatus === 'MISMATCH_DETECTED'
          ? 'FAILED'
          : overallStatus === 'PENDING'
            ? 'PENDING'
            : 'UNAVAILABLE';

    const eligibleForBoundaryReview =
      overallStatus !== 'TAMPERED_PAYLOAD' &&
      overallStatus !== 'MISMATCH_DETECTED' &&
      overallStatus !== 'PENDING';

    const nowIso = new Date().toISOString();
    const attemptId = `prov_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const toResultStatus = (
      s: string
    ): VerificationResultStatus => {
      if (s === 'VERIFIED' || s === 'NOT_APPLICABLE') return 'VERIFIED';
      if (s === 'PENDING') return 'PENDING';
      if (s === 'UNAVAILABLE') return 'UNAVAILABLE';
      return 'FAILED';
    };

    const results: EvidenceVerificationResultItem[] = [
      {
        attemptId,
        evidenceId: submission.id,
        verificationType: 'PAYLOAD_INTEGRITY',
        provider: 'INTERNAL_CANONICAL_HASH',
        status: integrity.payloadHashMatches ? 'VERIFIED' : 'FAILED',
        reason: integrity.details,
        errorCode: integrity.payloadHashMatches ? null : 'TAMPERED_PAYLOAD',
        resourceId: submission.id,
        expectedCommitSha: submission.commitSha,
        actualCommitSha: submission.commitSha,
        providerTimestamp: integrity.hashedAt ?? submission.submittedAt,
        verifiedAt: nowIso,
        evidenceContentHash: integrity.actualPayloadSha256,
      },
      {
        attemptId,
        evidenceId: submission.id,
        verificationType: 'REPOSITORY',
        provider: 'GITHUB',
        status: toResultStatus(repositoryVerification.status),
        reason: repositoryVerification.details,
        errorCode:
          repositoryVerification.status === 'VERIFIED'
            ? null
            : `GITHUB_REPO_${repositoryVerification.status}`,
        resourceId:
          repositoryVerification.canonicalFullName ??
          (expectedOwner && expectedRepo ? `${expectedOwner}/${expectedRepo}` : submission.repoUrl),
        expectedCommitSha: submission.commitSha,
        actualCommitSha: commitVerification.canonicalSha,
        providerTimestamp: null,
        verifiedAt: nowIso,
        evidenceContentHash: integrity.actualPayloadSha256,
      },
      {
        attemptId,
        evidenceId: submission.id,
        verificationType: 'COMMIT',
        provider: 'GITHUB',
        status: toResultStatus(commitVerification.status),
        reason: commitVerification.details,
        errorCode:
          commitVerification.status === 'VERIFIED'
            ? null
            : `GITHUB_COMMIT_${commitVerification.status}`,
        resourceId: commitVerification.canonicalSha ?? submission.commitSha,
        expectedCommitSha: submission.commitSha,
        actualCommitSha: commitVerification.canonicalSha,
        providerTimestamp: commitVerification.committerDate,
        verifiedAt: nowIso,
        evidenceContentHash: integrity.actualPayloadSha256,
      },
      {
        attemptId,
        evidenceId: submission.id,
        verificationType: 'PULL_REQUEST',
        provider: 'GITHUB',
        status: toResultStatus(prVerification.status),
        reason: prVerification.details,
        errorCode:
          prVerification.status === 'VERIFIED'
            ? null
            : `GITHUB_PR_${prVerification.status}`,
        resourceId:
          prVerification.prNumber !== null
            ? `PR#${prVerification.prNumber}`
            : submission.prUrl,
        expectedCommitSha: submission.commitSha,
        actualCommitSha: prVerification.headSha ?? prVerification.mergeCommitSha,
        providerTimestamp: null,
        verifiedAt: nowIso,
        evidenceContentHash: integrity.actualPayloadSha256,
      },
      {
        attemptId,
        evidenceId: submission.id,
        verificationType: 'WORKFLOW_RUN',
        provider: 'GITHUB',
        status: toResultStatus(workflowVerification.status),
        reason: workflowVerification.details,
        errorCode:
          workflowVerification.status === 'VERIFIED' ||
          workflowVerification.status === 'NOT_APPLICABLE'
            ? null
            : `GITHUB_WORKFLOW_${workflowVerification.status}`,
        resourceId:
          workflowVerification.runId !== null
            ? `run#${workflowVerification.runId}`
            : runUrl || null,
        expectedCommitSha: submission.commitSha,
        actualCommitSha: workflowVerification.headSha,
        providerTimestamp:
          workflowVerification.updatedAt ?? workflowVerification.createdAt ?? null,
        verifiedAt: nowIso,
        evidenceContentHash: integrity.actualPayloadSha256,
      },
    ];

    const record: EvidenceProvenanceVerificationRecord = {
      id: attemptId,
      submissionId: submission.id,
      milestoneId: milestone.id,
      contractId: contract.id,
      verificationMode: isConfigured ? 'GITHUB_REST_API' : 'UNCONFIGURED_UNAVAILABLE',
      overallStatus,
      verificationStatus,
      eligibleForBoundaryReview,
      blockingReasons,
      discrepancies,
      integrity,
      repository: repositoryVerification,
      commit: commitVerification,
      pullRequest: prVerification,
      workflowRun: workflowVerification,
      results,
      verifiedBy: actor.id,
      verifiedAt: nowIso,
    };

    return this.db.withTransaction(() => {
      this.provenanceRepo.insert(record);
      this.evidenceRepo.updateProvenanceStatus(submission.id, overallStatus);

      this.auditService.appendWithinTx({
        actorId: actor.id,
        actorRole: actor.role,
        action:
          overallStatus === 'VERIFIED'
            ? 'GITHUB_EVIDENCE_PROVENANCE_VERIFIED'
            : overallStatus === 'MISMATCH_DETECTED' || overallStatus === 'TAMPERED_PAYLOAD'
              ? 'GITHUB_EVIDENCE_PROVENANCE_MISMATCH'
              : 'GITHUB_EVIDENCE_PROVENANCE_UNAVAILABLE',
        entityType: 'EVIDENCE',
        entityId: submission.id,
        contractId: contract.id,
        milestoneId: milestone.id,
        previousState: submission.provenanceStatus ?? 'UNVERIFIED_UNAVAILABLE',
        newState: overallStatus,
        payload: {
          provenanceId: record.id,
          submissionId: submission.id,
          verificationMode: record.verificationMode,
          overallStatus,
          eligibleForBoundaryReview,
          repositoryStatus: repositoryVerification.status,
          commitStatus: commitVerification.status,
          pullRequestStatus: prVerification.status,
          workflowRunStatus: workflowVerification.status,
          payloadHashMatches: integrity.payloadHashMatches,
          discrepancyCount: discrepancies.length,
          discrepancies,
        },
        timestamp: nowIso,
      });

      return record;
    });
  }

  public getLatestProvenance(
    milestoneId: string
  ): EvidenceProvenanceVerificationRecord | null {
    return this.getLatestProvenanceForMilestone(milestoneId);
  }

  public getLatestProvenanceForMilestone(
    milestoneId: string
  ): EvidenceProvenanceVerificationRecord | null {
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(
        404,
        'MILESTONE_NOT_FOUND',
        `Milestone '${milestoneId}' was not found.`
      );
    }

    const latestSub = this.evidenceRepo.findLatestByMilestoneId(milestoneId);
    if (!latestSub) {
      return null;
    }

    const existing = this.provenanceRepo.findLatestBySubmissionId(latestSub.id);
    if (!existing) {
      return null;
    }

    // Re-verify payload hash dynamically on read so any direct DB tampering after verification is immediately exposed!
    const liveIntegrity = this.verifyEvidencePayloadIntegrity(latestSub);
    if (!liveIntegrity.payloadHashMatches && existing.overallStatus !== 'TAMPERED_PAYLOAD') {
      return {
        ...existing,
        overallStatus: 'TAMPERED_PAYLOAD',
        verificationStatus: 'FAILED',
        eligibleForBoundaryReview: false,
        integrity: liveIntegrity,
        blockingReasons: [liveIntegrity.details, ...existing.blockingReasons],
        discrepancies: [liveIntegrity.details, ...existing.discrepancies],
      };
    }

    return existing;
  }

  public listProvenanceForMilestone(
    milestoneId: string
  ): EvidenceProvenanceVerificationRecord[] {
    const milestone = this.milestoneRepo.findById(milestoneId);
    if (!milestone) {
      throw new AppError(
        404,
        'MILESTONE_NOT_FOUND',
        `Milestone '${milestoneId}' was not found.`
      );
    }
    return this.provenanceRepo.listByMilestoneId(milestoneId);
  }

  /**
   * Verifies and processes incoming GitHub Webhooks (`POST /api/v1/webhooks/github`).
   *
   * Security & Idempotency Rules:
   * - Requires `X-GitHub-Delivery`, `X-GitHub-Event`, and `X-Hub-Signature-256` headers.
   * - Fails closed (`503 GITHUB_WEBHOOK_VERIFICATION_UNAVAILABLE`) when `GITHUB_WEBHOOK_SECRET` is not configured.
   * - Verifies HMAC-SHA256 signature (`sha256=<hex>`) using `crypto.timingSafeEqual`.
   * - Rejects invalid signatures (`401 INVALID_GITHUB_WEBHOOK_SIGNATURE`) and records `REJECTED` in `github_webhook_events` and audit logs.
   * - Enforces persistent delivery idempotency on `X-GitHub-Delivery` (`delivery_id TEXT PRIMARY KEY`) + in-memory concurrency lock.
   * - Never directly approves a milestone or releases payment.
   */
  public async handleGitHubWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: unknown,
    rawBodyString?: string
  ): Promise<{
    verified: boolean;
    deliveryId: string;
    eventType: string;
    status: string;
    duplicate: boolean;
    matchedSubmissionId: string | null;
  }> {
    const getHeader = (name: string): string => {
      const lower = name.toLowerCase();
      const val =
        headers[lower] ??
        headers[name] ??
        headers[name.toUpperCase()];
      return Array.isArray(val) ? String(val[0] ?? '') : String(val ?? '');
    };

    const deliveryId = getHeader('x-github-delivery').trim();
    const eventType = getHeader('x-github-event').trim();
    const signatureHeader = getHeader('x-hub-signature-256').trim();

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw new AppError(
        400,
        'INVALID_GITHUB_WEBHOOK_PAYLOAD',
        'GitHub webhook body must be a JSON object.'
      );
    }

    const bodyObj = rawBody as Record<string, unknown>;
    const rawBodySerialized =
      typeof rawBodyString === 'string' && rawBodyString.length > 0
        ? rawBodyString
        : JSON.stringify(bodyObj);
    const payloadSha256 = crypto
      .createHash('sha256')
      .update(rawBodySerialized)
      .digest('hex');

    const action = typeof bodyObj.action === 'string' ? bodyObj.action : null;
    const repoObj =
      bodyObj.repository && typeof bodyObj.repository === 'object'
        ? (bodyObj.repository as Record<string, unknown>)
        : null;
    const repositoryFullName =
      typeof repoObj?.full_name === 'string' ? repoObj.full_name : null;

    // Extract commit SHA and providerTimestamp from push, pull_request, or workflow_run webhook payload
    let commitSha: string | null = null;
    let providerTimestamp: string | null = null;
    if (typeof bodyObj.after === 'string' && bodyObj.after.trim()) {
      commitSha = bodyObj.after.trim().toLowerCase();
      const headCommitObj =
        bodyObj.head_commit && typeof bodyObj.head_commit === 'object'
          ? (bodyObj.head_commit as Record<string, unknown>)
          : null;
      if (typeof headCommitObj?.timestamp === 'string') {
        providerTimestamp = headCommitObj.timestamp;
      }
    } else if (
      bodyObj.pull_request &&
      typeof bodyObj.pull_request === 'object'
    ) {
      const pr = bodyObj.pull_request as Record<string, unknown>;
      const head =
        pr.head && typeof pr.head === 'object' ? (pr.head as Record<string, unknown>) : null;
      if (typeof head?.sha === 'string') {
        commitSha = head.sha.toLowerCase();
      }
      if (typeof pr.updated_at === 'string') {
        providerTimestamp = pr.updated_at;
      } else if (typeof pr.created_at === 'string') {
        providerTimestamp = pr.created_at;
      }
    } else if (
      bodyObj.workflow_run &&
      typeof bodyObj.workflow_run === 'object'
    ) {
      const wf = bodyObj.workflow_run as Record<string, unknown>;
      if (typeof wf.head_sha === 'string') {
        commitSha = wf.head_sha.toLowerCase();
      }
      if (typeof wf.updated_at === 'string') {
        providerTimestamp = wf.updated_at;
      } else if (typeof wf.created_at === 'string') {
        providerTimestamp = wf.created_at;
      }
    }

    if (!deliveryId || !eventType) {
      throw new AppError(
        400,
        'MISSING_GITHUB_WEBHOOK_HEADERS',
        'Missing mandatory GitHub webhook headers (X-GitHub-Delivery, X-GitHub-Event).'
      );
    }

    const recordRejectedWebhook = (
      signatureStatus: GitHubWebhookSignatureStatus,
      reasonCode: string,
      errorMessage: string
    ): void => {
      const nowIso = new Date().toISOString();
      this.db.withTransaction(() => {
        const existing = this.githubWebhookRepo.findByDeliveryId(deliveryId);
        if (!existing) {
          this.githubWebhookRepo.create({
            deliveryId,
            eventType,
            action,
            repositoryFullName,
            commitSha,
            providerTimestamp,
            signatureStatus,
            processingStatus: 'REJECTED',
            processingResult: reasonCode,
            matchedSubmissionId: null,
            payloadSha256,
            errorMessage,
            receivedAt: nowIso,
            updatedAt: nowIso,
          });
        } else if (existing.processingStatus !== 'PROCESSED') {
          this.githubWebhookRepo.update({
            ...existing,
            providerTimestamp: providerTimestamp ?? existing.providerTimestamp ?? null,
            signatureStatus,
            processingStatus: 'REJECTED',
            processingResult: reasonCode,
            errorMessage,
            updatedAt: nowIso,
          });
        }

        this.auditService.appendWithinTx({
          actorId: 'client_01',
          actorRole: 'SYSTEM',
          action: 'GITHUB_WEBHOOK_REJECTED',
          entityType: 'EVIDENCE',
          entityId: deliveryId,
          contractId: null,
          milestoneId: null,
          previousState: null,
          newState: reasonCode,
          payload: {
            deliveryId,
            eventType,
            action,
            repositoryFullName,
            signatureStatus,
            reasonCode,
            errorMessage,
          },
          timestamp: nowIso,
        });
      });
    };

    // Fail closed if GITHUB_WEBHOOK_SECRET is not configured
    const secret = this.getWebhookSecret();
    if (!secret) {
      recordRejectedWebhook(
        'UNVERIFIED',
        'GITHUB_WEBHOOK_VERIFICATION_UNAVAILABLE',
        'GITHUB_WEBHOOK_SECRET is not configured. Failing closed.'
      );
      throw new AppError(
        503,
        'GITHUB_WEBHOOK_VERIFICATION_UNAVAILABLE',
        'GitHub webhook verification is unavailable because GITHUB_WEBHOOK_SECRET is not configured. Failing closed.'
      );
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      recordRejectedWebhook(
        'FAILURE',
        'MISSING_GITHUB_WEBHOOK_SIGNATURE',
        'Missing or malformed X-Hub-Signature-256 header.'
      );
      throw new AppError(
        401,
        'MISSING_GITHUB_WEBHOOK_SIGNATURE',
        'Missing or malformed X-Hub-Signature-256 header (expected sha256=<hex>).'
      );
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBodySerialized)
      .digest('hex')}`;

    const sigBuf = Buffer.from(signatureHeader, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const signatureValid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    if (!signatureValid) {
      recordRejectedWebhook(
        'FAILURE',
        'INVALID_GITHUB_WEBHOOK_SIGNATURE',
        'X-Hub-Signature-256 HMAC-SHA256 verification failed.'
      );
      throw new AppError(
        401,
        'INVALID_GITHUB_WEBHOOK_SIGNATURE',
        'GitHub webhook cryptographic HMAC-SHA256 signature verification failed.'
      );
    }

    // Concurrency guard for duplicate in-flight delivery IDs
    if (this.activeWebhookLocks.has(deliveryId)) {
      const nowIso = new Date().toISOString();
      this.db.withTransaction(() => {
        this.auditService.appendWithinTx({
          actorId: 'client_01',
          actorRole: 'SYSTEM',
          action: 'GITHUB_WEBHOOK_DUPLICATE_IGNORED',
          entityType: 'EVIDENCE',
          entityId: deliveryId,
          contractId: null,
          milestoneId: null,
          previousState: 'PROCESSING',
          newState: 'DUPLICATE_CONCURRENT_IGNORED',
          payload: {
            deliveryId,
            eventType,
            repositoryFullName,
          },
          timestamp: nowIso,
        });
      });
      return {
        verified: true,
        deliveryId,
        eventType,
        status: 'DUPLICATE_IGNORED',
        duplicate: true,
        matchedSubmissionId: null,
      };
    }

    this.activeWebhookLocks.add(deliveryId);
    try {
      const existingEvent = this.githubWebhookRepo.findByDeliveryId(deliveryId);
      if (existingEvent && existingEvent.processingStatus === 'PROCESSED') {
        const nowIso = new Date().toISOString();
        this.db.withTransaction(() => {
          this.auditService.appendWithinTx({
            actorId: 'client_01',
            actorRole: 'SYSTEM',
            action: 'GITHUB_WEBHOOK_DUPLICATE_IGNORED',
            entityType: 'EVIDENCE',
            entityId: existingEvent.matchedSubmissionId ?? deliveryId,
            contractId: null,
            milestoneId: null,
            previousState: existingEvent.processingResult,
            newState: 'DUPLICATE_IGNORED',
            payload: {
              deliveryId,
              eventType,
              repositoryFullName,
              matchedSubmissionId: existingEvent.matchedSubmissionId,
            },
            timestamp: nowIso,
          });
        });
        return {
          verified: true,
          deliveryId,
          eventType,
          status: 'DUPLICATE_IGNORED',
          duplicate: true,
          matchedSubmissionId: existingEvent.matchedSubmissionId,
        };
      }

      const markIso = new Date().toISOString();
      this.db.withTransaction(() => {
        if (!existingEvent) {
          this.githubWebhookRepo.create({
            deliveryId,
            eventType,
            action,
            repositoryFullName,
            commitSha,
            providerTimestamp,
            signatureStatus: 'SUCCESS',
            processingStatus: 'PROCESSING',
            processingResult: null,
            matchedSubmissionId: null,
            payloadSha256,
            errorMessage: null,
            receivedAt: markIso,
            updatedAt: markIso,
          });
        } else {
          this.githubWebhookRepo.update({
            ...existingEvent,
            eventType,
            action,
            repositoryFullName,
            commitSha,
            providerTimestamp,
            signatureStatus: 'SUCCESS',
            processingStatus: 'PROCESSING',
            payloadSha256,
            errorMessage: null,
            updatedAt: markIso,
          });
        }
      });

      try {
        return this.db.withTransaction(() => {
          const nowIso = new Date().toISOString();
          if (this.options?.beforeWebhookProcessHook) {
            this.options.beforeWebhookProcessHook(deliveryId, eventType);
          }

          let matchedSubmission: EvidenceSubmission | null = null;
          if (commitSha) {
            matchedSubmission = this.evidenceRepo.findByCommitSha(commitSha);
          }

          let processingResult = 'WEBHOOK_VERIFIED_LOGGED';

          if (matchedSubmission) {
            // Out-of-order protection: ensure older provider events do not overwrite newer verified state
            let isStaleOutOfOrderEvent = false;
            if (providerTimestamp) {
              const incomingEpochMs = Date.parse(providerTimestamp);
              if (Number.isFinite(incomingEpochMs)) {
                const priorProcessedEvents = this.githubWebhookRepo
                  .listRecent(100)
                  .filter(
                    (ev) =>
                      ev.deliveryId !== deliveryId &&
                      ev.matchedSubmissionId === matchedSubmission?.id &&
                      ev.processingStatus === 'PROCESSED' &&
                      ev.providerTimestamp
                  );
                for (const priorEv of priorProcessedEvents) {
                  const priorEpochMs = Date.parse(String(priorEv.providerTimestamp));
                  if (Number.isFinite(priorEpochMs) && priorEpochMs > incomingEpochMs) {
                    isStaleOutOfOrderEvent = true;
                    break;
                  }
                }
              }
            }

            if (isStaleOutOfOrderEvent) {
              processingResult = 'IGNORED_OUT_OF_ORDER_STALE_EVENT';
            } else if (
              eventType === 'workflow_run' &&
              bodyObj.workflow_run &&
              typeof bodyObj.workflow_run === 'object'
            ) {
              const wf = bodyObj.workflow_run as Record<string, unknown>;
              const wfStatus = typeof wf.status === 'string' ? wf.status : null;
              const conclusion = typeof wf.conclusion === 'string' ? wf.conclusion : null;
              if (
                wfStatus === 'in_progress' ||
                wfStatus === 'queued' ||
                wfStatus === 'waiting' ||
                wfStatus === 'pending'
              ) {
                if (
                  matchedSubmission.provenanceStatus !== 'MISMATCH_DETECTED' &&
                  matchedSubmission.provenanceStatus !== 'TAMPERED_PAYLOAD'
                ) {
                  this.evidenceRepo.updateProvenanceStatus(
                    matchedSubmission.id,
                    'PENDING'
                  );
                }
                processingResult = 'RECONCILED_WORKFLOW_PENDING';
              } else if (conclusion === 'failure' && matchedSubmission.ciReport.status === 'SUCCESS') {
                this.evidenceRepo.updateProvenanceStatus(
                  matchedSubmission.id,
                  'MISMATCH_DETECTED'
                );
                processingResult = 'RECONCILED_PROVENANCE_MISMATCH';
              } else if (wfStatus === 'completed' && conclusion === 'success') {
                if (matchedSubmission.provenanceStatus === 'PENDING') {
                  this.evidenceRepo.updateProvenanceStatus(
                    matchedSubmission.id,
                    'VERIFIED'
                  );
                }
                processingResult = 'RECONCILED_WORKFLOW_RUN';
              } else {
                processingResult = 'RECONCILED_WORKFLOW_RUN';
              }
            } else if (
              eventType === 'pull_request' &&
              bodyObj.pull_request &&
              typeof bodyObj.pull_request === 'object'
            ) {
              const pr = bodyObj.pull_request as Record<string, unknown>;
              const merged = Boolean(pr.merged === true || pr.merged_at);
              const state = pr.state === 'open' ? 'OPEN' : merged ? 'MERGED' : 'CLOSED';
              if (state !== matchedSubmission.prStatus) {
                this.evidenceRepo.updateProvenanceStatus(
                  matchedSubmission.id,
                  'MISMATCH_DETECTED'
                );
                processingResult = 'RECONCILED_PROVENANCE_MISMATCH';
              } else {
                processingResult = 'RECONCILED_PULL_REQUEST';
              }
            } else {
              processingResult = 'RECONCILED_COMMIT_EVENT';
            }
          }

          const currentRec = this.githubWebhookRepo.findByDeliveryId(deliveryId);
          if (currentRec) {
            this.githubWebhookRepo.update({
              ...currentRec,
              providerTimestamp,
              signatureStatus: 'SUCCESS',
              processingStatus: 'PROCESSED',
              processingResult,
              matchedSubmissionId: matchedSubmission?.id ?? null,
              errorMessage: null,
              updatedAt: nowIso,
            });
          }

          const milestone = matchedSubmission
            ? this.milestoneRepo.findById(matchedSubmission.milestoneId)
            : null;

          this.auditService.appendWithinTx({
            actorId: 'client_01',
            actorRole: 'SYSTEM',
            action: 'GITHUB_WEBHOOK_VERIFIED',
            entityType: 'EVIDENCE',
            entityId: matchedSubmission?.id ?? deliveryId,
            contractId: milestone?.contractId ?? null,
            milestoneId: matchedSubmission?.milestoneId ?? null,
            previousState: null,
            newState: processingResult,
            payload: {
              deliveryId,
              eventType,
              action,
              repositoryFullName,
              commitSha,
              matchedSubmissionId: matchedSubmission?.id ?? null,
              payloadSha256,
            },
            timestamp: nowIso,
          });

          return {
            verified: true,
            deliveryId,
            eventType,
            status: processingResult,
            duplicate: false,
            matchedSubmissionId: matchedSubmission?.id ?? null,
          };
        });
      } catch (procErr) {
        const failIso = new Date().toISOString();
        const errMsg = procErr instanceof Error ? procErr.message : String(procErr);
        this.db.withTransaction(() => {
          const currentRec = this.githubWebhookRepo.findByDeliveryId(deliveryId);
          if (currentRec) {
            this.githubWebhookRepo.update({
              ...currentRec,
              processingStatus: 'FAILED',
              errorMessage: errMsg,
              updatedAt: failIso,
            });
          }
          this.auditService.appendWithinTx({
            actorId: 'client_01',
            actorRole: 'SYSTEM',
            action: 'GITHUB_WEBHOOK_PROCESSING_FAILED',
            entityType: 'EVIDENCE',
            entityId: deliveryId,
            contractId: null,
            milestoneId: null,
            previousState: 'PROCESSING',
            newState: 'FAILED',
            payload: {
              deliveryId,
              eventType,
              errorMessage: errMsg,
            },
            timestamp: failIso,
          });
        });
        throw procErr;
      }
    } finally {
      this.activeWebhookLocks.delete(deliveryId);
    }
  }
}
