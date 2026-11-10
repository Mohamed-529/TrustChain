import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  AcceptanceCriterion,
  AuthSessionRecord,
  CiExecutionReport,
  Contract,
  ContractPolicyRules,
  ContractStatus,
  DisputeEvidencePack,
  EvaluationRun,
  EvidenceAnalysis,
  EvidenceIntegrityVerification,
  EvidencePassport,
  EvidenceProvenanceStatus,
  EvidenceProvenanceVerificationRecord,
  EvidenceReference,
  EvidenceSubmission,
  EvidenceVerificationResultItem,
  GitHubCommitVerification,
  GitHubPullRequestVerification,
  GitHubRepositoryVerification,
  GitHubWebhookEventRecord,
  GitHubWebhookProcessingStatus,
  GitHubWebhookSignatureStatus,
  GitHubWorkflowRunVerification,
  HumanApprovalRecord,
  HumanReviewDecision,
  Milestone,
  MilestoneStatus,
  PaymentStatus,
  PayPalTransactionRecord,
  PayPalTransactionStatus,
  PayPalWebhookEventRecord,
  PayPalWebhookProcessingStatus,
  PayPalWebhookVerificationStatus,
  PolicyCalculationResult,
  ReviewSynthesis,
  RiskAssessment,
  ScheduleDownstreamCascade,
  ScheduleProposalStatus,
  ScheduleRecoveryProposal,
  SecurityScanReport,
  User,
  UserRole,
  UserWithPasswordRow,
  VerificationResultStatus,
} from '../../types/domain.ts';

export class UserRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapUserRow(row: Record<string, unknown>): User {
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role) as UserRole,
      isActive: Number(row.is_active) === 1,
      isDemoAccount: Number(row.is_demo_account) === 1,
      createdAt: String(row.created_at),
    };
  }

  public findById(id: string): User | null {
    const row = this.rawDb
      .prepare(
        'SELECT id, name, email, role, is_active, is_demo_account, created_at FROM users WHERE id = ?'
      )
      .get(id);
    return row ? this.mapUserRow(row) : null;
  }

  public findByEmailWithPassword(email: string): UserWithPasswordRow | null {
    const row = this.rawDb
      .prepare(
        'SELECT id, name, email, password_hash, role, is_active, is_demo_account, created_at FROM users WHERE lower(email) = lower(?)'
      )
      .get(email);
    if (!row) {
      return null;
    }
    return {
      ...this.mapUserRow(row),
      passwordHash: String(row.password_hash),
    };
  }

  public listAll(): User[] {
    const rows = this.rawDb
      .prepare(
        'SELECT id, name, email, role, is_active, is_demo_account, created_at FROM users ORDER BY id ASC'
      )
      .all();
    return rows.map((r) => this.mapUserRow(r));
  }
}

export class SessionRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  public createSession(session: {
    jti: string;
    userId: string;
    role: UserRole;
    issuedAt: number;
    expiresAt: number;
  }): void {
    this.rawDb
      .prepare(
        `INSERT INTO auth_sessions (jti, user_id, role, issued_at, expires_at, revoked_at, revoke_reason)
         VALUES (?, ?, ?, ?, ?, NULL, NULL)`
      )
      .run(session.jti, session.userId, session.role, session.issuedAt, session.expiresAt);
  }

  public findByJti(jti: string): AuthSessionRecord | null {
    const row = this.rawDb
      .prepare('SELECT * FROM auth_sessions WHERE jti = ?')
      .get(jti);
    if (!row) {
      return null;
    }
    return {
      jti: String(row.jti),
      userId: String(row.user_id),
      role: String(row.role) as UserRole,
      issuedAt: Number(row.issued_at),
      expiresAt: Number(row.expires_at),
      revokedAt: row.revoked_at !== null ? String(row.revoked_at) : null,
      revokeReason: row.revoke_reason !== null ? String(row.revoke_reason) : null,
    };
  }

  public revokeByJti(jti: string, reason = 'USER_LOGOUT', revokedAt = new Date().toISOString()): boolean {
    const res = this.rawDb
      .prepare(
        'UPDATE auth_sessions SET revoked_at = ?, revoke_reason = ? WHERE jti = ? AND revoked_at IS NULL'
      )
      .run(revokedAt, reason, jti);
    return Number(res.changes) > 0;
  }

  public revokeAllForUser(userId: string, reason = 'REVOKE_ALL', revokedAt = new Date().toISOString()): number {
    const res = this.rawDb
      .prepare(
        'UPDATE auth_sessions SET revoked_at = ?, revoke_reason = ? WHERE user_id = ? AND revoked_at IS NULL'
      )
      .run(revokedAt, reason, userId);
    return Number(res.changes);
  }
}

export class MilestoneRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): Milestone {
    const deadlineIso = String(row.deadline_iso);
    const createdAt = String(row.created_at);
    return {
      id: String(row.id),
      contractId: String(row.contract_id),
      sequenceOrder: Number(row.sequence_order),
      title: String(row.title),
      description: String(row.description),
      agreedAmountCents: Number(row.agreed_amount_cents),
      startDateIso: row.start_date_iso ? String(row.start_date_iso) : createdAt,
      deadlineIso,
      baselineStartIso: row.baseline_start_iso ? String(row.baseline_start_iso) : (row.start_date_iso ? String(row.start_date_iso) : createdAt),
      baselineEndIso: row.baseline_end_iso ? String(row.baseline_end_iso) : deadlineIso,
      dependencyMilestoneIds: JSON.parse(String(row.dependency_milestone_ids_json)) as string[],
      acceptanceCriteria: JSON.parse(String(row.acceptance_criteria_json)) as AcceptanceCriterion[],
      status: String(row.status) as MilestoneStatus,
      paymentStatus: String(row.payment_status) as PaymentStatus,
      createdAt,
      updatedAt: String(row.updated_at),
    };
  }

  public listByContractId(contractId: string): Milestone[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM milestones WHERE contract_id = ? ORDER BY sequence_order ASC')
      .all(contractId);
    return rows.map((r) => this.mapRow(r));
  }

  public findById(id: string): Milestone | null {
    const row = this.rawDb.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  public insert(milestone: Milestone): void {
    const startDateIso = milestone.startDateIso ?? milestone.createdAt;
    const baselineStartIso = milestone.baselineStartIso ?? startDateIso;
    const baselineEndIso = milestone.baselineEndIso ?? milestone.deadlineIso;
    this.rawDb
      .prepare(
        `INSERT INTO milestones (
          id, contract_id, sequence_order, title, description,
          agreed_amount_cents, start_date_iso, deadline_iso,
          baseline_start_iso, baseline_end_iso, dependency_milestone_ids_json,
          acceptance_criteria_json, status, payment_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        milestone.id,
        milestone.contractId,
        milestone.sequenceOrder,
        milestone.title,
        milestone.description,
        milestone.agreedAmountCents,
        startDateIso,
        milestone.deadlineIso,
        baselineStartIso,
        baselineEndIso,
        JSON.stringify(milestone.dependencyMilestoneIds),
        JSON.stringify(milestone.acceptanceCriteria),
        milestone.status,
        milestone.paymentStatus,
        milestone.createdAt,
        milestone.updatedAt
      );
  }

  public updateStatusByContractId(
    contractId: string,
    newStatus: MilestoneStatus,
    updatedAt: string
  ): void {
    this.rawDb
      .prepare('UPDATE milestones SET status = ?, updated_at = ? WHERE contract_id = ?')
      .run(newStatus, updatedAt, contractId);
  }

  public updateStatus(
    milestoneId: string,
    newStatus: MilestoneStatus,
    updatedAt: string
  ): void {
    this.rawDb
      .prepare('UPDATE milestones SET status = ?, updated_at = ? WHERE id = ?')
      .run(newStatus, updatedAt, milestoneId);
  }

  public updatePaymentStatus(
    milestoneId: string,
    newPaymentStatus: PaymentStatus,
    newStatus: MilestoneStatus | null,
    updatedAt: string
  ): void {
    if (newStatus) {
      this.rawDb
        .prepare(
          'UPDATE milestones SET payment_status = ?, status = ?, updated_at = ? WHERE id = ?'
        )
        .run(newPaymentStatus, newStatus, updatedAt, milestoneId);
    } else {
      this.rawDb
        .prepare('UPDATE milestones SET payment_status = ?, updated_at = ? WHERE id = ?')
        .run(newPaymentStatus, updatedAt, milestoneId);
    }
  }

  public updateScheduleDates(
    milestoneId: string,
    startDateIso: string,
    deadlineIso: string,
    updatedAt: string
  ): void {
    this.rawDb
      .prepare(
        'UPDATE milestones SET start_date_iso = ?, deadline_iso = ?, updated_at = ? WHERE id = ?'
      )
      .run(startDateIso, deadlineIso, updatedAt, milestoneId);
  }

  public updateDependencies(
    milestoneId: string,
    dependencyMilestoneIds: string[],
    updatedAt: string
  ): void {
    this.rawDb
      .prepare(
        'UPDATE milestones SET dependency_milestone_ids_json = ?, updated_at = ? WHERE id = ?'
      )
      .run(JSON.stringify(dependencyMilestoneIds), updatedAt, milestoneId);
  }

  public updateBaselines(
    milestoneId: string,
    baselineStartIso: string,
    baselineEndIso: string,
    updatedAt: string
  ): void {
    this.rawDb
      .prepare(
        'UPDATE milestones SET baseline_start_iso = ?, baseline_end_iso = ?, updated_at = ? WHERE id = ?'
      )
      .run(baselineStartIso, baselineEndIso, updatedAt, milestoneId);
  }
}

export class ContractRepository {
  private readonly rawDb: DatabaseSync;
  private readonly milestoneRepo: MilestoneRepository;

  constructor(rawDb: DatabaseSync, milestoneRepo: MilestoneRepository) {
    this.rawDb = rawDb;
    this.milestoneRepo = milestoneRepo;
  }

  private mapRow(row: Record<string, unknown>, includeMilestones = true): Contract {
    const id = String(row.id);
    return {
      id,
      title: String(row.title),
      description: String(row.description),
      totalBudgetCents: Number(row.total_budget_cents),
      currency: String(row.currency) as 'USD',
      clientId: String(row.client_id),
      developerId: String(row.developer_id),
      reviewerId: String(row.reviewer_id),
      policyRules: JSON.parse(String(row.policy_rules_json)) as ContractPolicyRules,
      status: String(row.status) as ContractStatus,
      version: Number(row.version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      milestones: includeMilestones ? this.milestoneRepo.listByContractId(id) : undefined,
    };
  }

  public listAll(): Contract[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM contracts ORDER BY created_at DESC')
      .all();
    return rows.map((r) => this.mapRow(r, true));
  }

  public findById(id: string): Contract | null {
    const row = this.rawDb.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
    return row ? this.mapRow(row, true) : null;
  }

  public insert(contract: Omit<Contract, 'milestones'>): void {
    this.rawDb
      .prepare(
        `INSERT INTO contracts (
          id, title, description, total_budget_cents, currency,
          client_id, developer_id, reviewer_id, policy_rules_json,
          status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        contract.id,
        contract.title,
        contract.description,
        contract.totalBudgetCents,
        contract.currency,
        contract.clientId,
        contract.developerId,
        contract.reviewerId,
        JSON.stringify(contract.policyRules),
        contract.status,
        contract.version,
        contract.createdAt,
        contract.updatedAt
      );
  }

  public updateStatusAndIncrementVersion(
    id: string,
    expectedCurrentVersion: number,
    newStatus: ContractStatus,
    updatedAt: string
  ): boolean {
    const res = this.rawDb
      .prepare(
        `UPDATE contracts
         SET status = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`
      )
      .run(newStatus, updatedAt, id, expectedCurrentVersion);
    return Number(res.changes) === 1;
  }
}

export function buildCanonicalEvidenceReferences(submission: {
  id: string;
  repoUrl: string;
  branch: string;
  commitSha: string;
  prUrl: string;
  prStatus: 'MERGED' | 'OPEN' | 'CLOSED';
  ciReport: CiExecutionReport;
  securityScan: SecurityScanReport;
}): EvidenceReference[] {
  const cleanRepo = submission.repoUrl.replace(/\/$/, '');
  return [
    {
      evidenceId: `ev_commit_${submission.id}`,
      sourceType: 'COMMIT',
      label: `Commit ${submission.commitSha.slice(0, 12)} on branch ${submission.branch}`,
      verifiedUrl: `${cleanRepo}/commit/${submission.commitSha}`,
      excerpt: `Changed files (${(submission.ciReport.changedFiles ?? []).length}): ${(submission.ciReport.changedFiles ?? []).join(', ') || 'none listed'}`,
    },
    {
      evidenceId: `ev_pr_${submission.id}`,
      sourceType: 'PULL_REQUEST',
      label: `Pull Request (${submission.prStatus})`,
      verifiedUrl: submission.prUrl,
      excerpt: `PR URL: ${submission.prUrl} | Status: ${submission.prStatus}`,
    },
    {
      evidenceId: `ev_ci_${submission.id}`,
      sourceType: 'CI_REPORT',
      label: `CI Report (${submission.ciReport.provider}: ${submission.ciReport.status})`,
      verifiedUrl: submission.ciReport.runUrl,
      excerpt: `Tests: ${submission.ciReport.passedTests}/${submission.ciReport.totalTests} passed (${submission.ciReport.failedTests} failed), Coverage: ${submission.ciReport.coveragePct}%`,
    },
    {
      evidenceId: `ev_sec_${submission.id}`,
      sourceType: 'SECURITY_SCAN',
      label: `Security Scan (${submission.securityScan.scanner} ${submission.securityScan.scannerVersion}: ${submission.securityScan.status})`,
      excerpt: `Findings count: ${submission.securityScan.findings.length}`,
    },
  ];
}

export const EVIDENCE_HASH_ALGORITHM = 'SHA-256' as const;
export const EVIDENCE_CANONICALIZATION_VERSION = 'mpai-evidence-canon-v1' as const;

/**
 * Recursively canonicalizes an arbitrary JSON value according to `mpai-evidence-canon-v1`:
 * - Object keys are sorted lexicographically (`Object.keys(obj).sort()`).
 * - Object keys whose values are `undefined` are omitted.
 * - `null` values are preserved as `null`.
 * - Arrays preserve element order while recursively canonicalizing each element (`undefined` array elements become `null`).
 * - Numbers are normalized via `Number(val)` (preventing `-0`).
 */
export function canonicalizeJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Object.is(value, -0) ? 0 : Number(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : canonicalizeJsonValue(item)));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const propVal = obj[key];
      if (propVal !== undefined) {
        out[key] = canonicalizeJsonValue(propVal);
      }
    }
    return out;
  }
  return String(value);
}

/**
 * Serializes an evidence submission payload into a deterministic canonical JSON string
 * (`mpai-evidence-canon-v1`). Equivalent payloads with differently ordered object keys,
 * whitespace around URLs/branches/SHAs, uppercase vs lowercase hex SHAs, or omitted vs `undefined`
 * optional fields produce identical canonical JSON strings.
 */
export function canonicalizeEvidencePayload(submission: {
  milestoneId: string;
  attemptNumber: number;
  submittedBy: string;
  repoUrl: string;
  branch: string;
  commitSha: string;
  prUrl: string;
  prStatus: 'MERGED' | 'OPEN' | 'CLOSED';
  ciReport: CiExecutionReport;
  securityScan: SecurityScanReport;
  developerNotes?: string | null;
}): string {
  const normalizedPayload = {
    attemptNumber: Number(submission.attemptNumber),
    branch: String(submission.branch ?? '').trim(),
    ciReport: {
      changedFiles: Array.isArray(submission.ciReport?.changedFiles)
        ? submission.ciReport.changedFiles.map((f) => String(f).trim())
        : [],
      coveragePct: Number(submission.ciReport?.coveragePct ?? 0),
      failedTests: Number(submission.ciReport?.failedTests ?? 0),
      logSummary: String(submission.ciReport?.logSummary ?? ''),
      passedTests: Number(submission.ciReport?.passedTests ?? 0),
      provider: String(submission.ciReport?.provider ?? '').trim(),
      runUrl:
        submission.ciReport?.runUrl !== undefined &&
        submission.ciReport?.runUrl !== null &&
        String(submission.ciReport.runUrl).trim() !== ''
          ? String(submission.ciReport.runUrl).trim()
          : null,
      status: submission.ciReport?.status ?? 'FAILURE',
      totalTests: Number(submission.ciReport?.totalTests ?? 0),
    },
    commitSha: String(submission.commitSha ?? '')
      .trim()
      .toLowerCase(),
    developerNotes:
      submission.developerNotes !== undefined && submission.developerNotes !== null
        ? String(submission.developerNotes).trim()
        : '',
    milestoneId: String(submission.milestoneId ?? '').trim(),
    prStatus: submission.prStatus,
    prUrl: String(submission.prUrl ?? '').trim(),
    repoUrl: String(submission.repoUrl ?? '').trim().replace(/\/+$/, ''),
    securityScan: {
      findings: Array.isArray(submission.securityScan?.findings)
        ? submission.securityScan.findings.map((f) => ({
            cvssScore: Number(f.cvssScore ?? 0),
            description: String(f.description ?? ''),
            id: String(f.id ?? ''),
            packageName: String(f.packageName ?? ''),
            severity: f.severity,
          }))
        : [],
      scanner: String(submission.securityScan?.scanner ?? '').trim(),
      scannerVersion: String(submission.securityScan?.scannerVersion ?? '').trim(),
      status: submission.securityScan?.status ?? 'UNAVAILABLE',
    },
    submittedBy: String(submission.submittedBy ?? '').trim(),
  };

  return JSON.stringify(canonicalizeJsonValue(normalizedPayload));
}

export function computeEvidencePayloadSha256(submission: {
  milestoneId: string;
  attemptNumber: number;
  submittedBy: string;
  repoUrl: string;
  branch: string;
  commitSha: string;
  prUrl: string;
  prStatus: 'MERGED' | 'OPEN' | 'CLOSED';
  ciReport: CiExecutionReport;
  securityScan: SecurityScanReport;
  developerNotes?: string | null;
}): string {
  const canonicalJson = canonicalizeEvidencePayload(submission);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

export class EvidenceRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): EvidenceSubmission {
    const id = String(row.id);
    const milestoneId = String(row.milestone_id);
    const attemptNumber = Number(row.attempt_number);
    const submittedBy = String(row.submitted_by);
    const repoUrl = String(row.repo_url);
    const branch = String(row.branch);
    const commitSha = String(row.commit_sha);
    const prUrl = String(row.pr_url);
    const prStatus = String(row.pr_status) as 'MERGED' | 'OPEN' | 'CLOSED';
    const ciReport = JSON.parse(String(row.ci_report_json)) as CiExecutionReport;
    const securityScan = JSON.parse(String(row.security_scan_json)) as SecurityScanReport;
    const developerNotes = String(row.developer_notes ?? '');
    const storedHash =
      row.payload_sha256 && String(row.payload_sha256).trim().length > 0
        ? String(row.payload_sha256)
        : computeEvidencePayloadSha256({
            milestoneId,
            attemptNumber,
            submittedBy,
            repoUrl,
            branch,
            commitSha,
            prUrl,
            prStatus,
            ciReport,
            securityScan,
            developerNotes,
          });
    const provenanceStatus = (row.provenance_status
      ? String(row.provenance_status)
      : 'UNVERIFIED_UNAVAILABLE') as EvidenceProvenanceStatus;

    return {
      id,
      milestoneId,
      attemptNumber,
      submittedBy,
      repoUrl,
      branch,
      commitSha,
      prUrl,
      prStatus,
      ciReport,
      securityScan,
      developerNotes,
      submittedAt: String(row.submitted_at),
      payloadSha256: storedHash,
      payloadHashAlgorithm: EVIDENCE_HASH_ALGORITHM,
      canonicalizationVersion: row.canonicalization_version
        ? String(row.canonicalization_version)
        : EVIDENCE_CANONICALIZATION_VERSION,
      payloadHashedAt: row.payload_hashed_at
        ? String(row.payload_hashed_at)
        : String(row.submitted_at),
      provenanceStatus,
      canonicalReferences: buildCanonicalEvidenceReferences({
        id,
        repoUrl,
        branch,
        commitSha,
        prUrl,
        prStatus,
        ciReport,
        securityScan,
      }),
    };
  }

  public listByMilestoneId(milestoneId: string): EvidenceSubmission[] {
    const rows = this.rawDb
      .prepare(
        'SELECT * FROM evidence_submissions WHERE milestone_id = ? ORDER BY attempt_number ASC'
      )
      .all(milestoneId);
    return rows.map((r) => this.mapRow(r));
  }

  public findLatestByMilestoneId(milestoneId: string): EvidenceSubmission | null {
    const row = this.rawDb
      .prepare(
        'SELECT * FROM evidence_submissions WHERE milestone_id = ? ORDER BY attempt_number DESC LIMIT 1'
      )
      .get(milestoneId);
    return row ? this.mapRow(row) : null;
  }

  public findById(id: string): EvidenceSubmission | null {
    const row = this.rawDb
      .prepare('SELECT * FROM evidence_submissions WHERE id = ?')
      .get(id);
    return row ? this.mapRow(row) : null;
  }

  public findByCommitSha(commitSha: string): EvidenceSubmission | null {
    const normalized = commitSha.trim().toLowerCase();
    const row = this.rawDb
      .prepare(
        'SELECT * FROM evidence_submissions WHERE lower(commit_sha) = ? ORDER BY submitted_at DESC LIMIT 1'
      )
      .get(normalized);
    return row ? this.mapRow(row) : null;
  }

  public getNextAttemptNumber(milestoneId: string): number {
    const row = this.rawDb
      .prepare(
        'SELECT COALESCE(MAX(attempt_number), 0) as max_attempt FROM evidence_submissions WHERE milestone_id = ?'
      )
      .get(milestoneId) as { max_attempt: number };
    return Number(row.max_attempt) + 1;
  }

  public insert(submission: EvidenceSubmission): void {
    const payloadSha256 =
      submission.payloadSha256 ??
      computeEvidencePayloadSha256({
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
    const payloadHashAlgorithm = submission.payloadHashAlgorithm ?? EVIDENCE_HASH_ALGORITHM;
    const canonicalizationVersion =
      submission.canonicalizationVersion ?? EVIDENCE_CANONICALIZATION_VERSION;
    const payloadHashedAt = submission.payloadHashedAt ?? submission.submittedAt;
    const provenanceStatus = submission.provenanceStatus ?? 'UNVERIFIED_UNAVAILABLE';

    this.rawDb
      .prepare(
        `INSERT INTO evidence_submissions (
          id, milestone_id, attempt_number, submitted_by, repo_url, branch,
          commit_sha, pr_url, pr_status, ci_report_json, security_scan_json,
          developer_notes, submitted_at, payload_sha256, payload_hash_algorithm,
          canonicalization_version, payload_hashed_at, provenance_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        submission.id,
        submission.milestoneId,
        submission.attemptNumber,
        submission.submittedBy,
        submission.repoUrl,
        submission.branch,
        submission.commitSha,
        submission.prUrl,
        submission.prStatus,
        JSON.stringify(submission.ciReport),
        JSON.stringify(submission.securityScan),
        submission.developerNotes,
        submission.submittedAt,
        payloadSha256,
        payloadHashAlgorithm,
        canonicalizationVersion,
        payloadHashedAt,
        provenanceStatus
      );
  }

  public updateProvenanceStatus(
    submissionId: string,
    provenanceStatus: EvidenceProvenanceStatus
  ): void {
    this.rawDb
      .prepare('UPDATE evidence_submissions SET provenance_status = ? WHERE id = ?')
      .run(provenanceStatus, submissionId);
  }
}

export class EvaluationRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): EvaluationRun {
    const evidenceAnalysis = JSON.parse(String(row.evidence_analysis_json)) as EvidenceAnalysis;
    const riskAnalysis = JSON.parse(String(row.risk_analysis_json)) as RiskAssessment;
    const arbitratorRecommendation = JSON.parse(
      String(row.arbitrator_recommendation_json)
    ) as ReviewSynthesis;
    const policyCalculation = JSON.parse(
      String(row.policy_calculation_json)
    ) as PolicyCalculationResult;

    const isMockEvaluation = Boolean(
      evidenceAnalysis.isMock || riskAnalysis.isMock || arbitratorRecommendation.isMock
    );

    return {
      id: String(row.id),
      milestoneId: String(row.milestone_id),
      submissionId: String(row.submission_id),
      status: String(row.status) as 'RUNNING' | 'COMPLETED' | 'FAILED',
      evaluationMode: isMockEvaluation ? 'DETERMINISTIC_MOCK' : 'LIVE_GEMINI',
      isMockEvaluation,
      evidenceAnalysis,
      riskAnalysis,
      arbitratorRecommendation,
      policyCalculation,
      evaluatedAt: String(row.evaluated_at),
    };
  }

  public listByMilestoneId(milestoneId: string): EvaluationRun[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM ai_evaluations WHERE milestone_id = ? ORDER BY evaluated_at DESC')
      .all(milestoneId);
    return rows.map((r) => this.mapRow(r));
  }

  public findLatestByMilestoneId(milestoneId: string): EvaluationRun | null {
    const row = this.rawDb
      .prepare(
        'SELECT * FROM ai_evaluations WHERE milestone_id = ? ORDER BY evaluated_at DESC LIMIT 1'
      )
      .get(milestoneId);
    return row ? this.mapRow(row) : null;
  }

  public findById(id: string): EvaluationRun | null {
    const row = this.rawDb
      .prepare('SELECT * FROM ai_evaluations WHERE id = ?')
      .get(id);
    return row ? this.mapRow(row) : null;
  }

  public findRunningByMilestoneId(milestoneId: string): EvaluationRun | null {
    const row = this.rawDb
      .prepare(
        "SELECT * FROM ai_evaluations WHERE milestone_id = ? AND status = 'RUNNING' LIMIT 1"
      )
      .get(milestoneId);
    return row ? this.mapRow(row) : null;
  }

  public insert(evaluation: EvaluationRun): void {
    this.rawDb
      .prepare(
        `INSERT INTO ai_evaluations (
          id, milestone_id, submission_id, status,
          evidence_analysis_json, risk_analysis_json,
          arbitrator_recommendation_json, policy_calculation_json, evaluated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        evaluation.id,
        evaluation.milestoneId,
        evaluation.submissionId,
        evaluation.status,
        JSON.stringify(evaluation.evidenceAnalysis),
        JSON.stringify(evaluation.riskAnalysis),
        JSON.stringify(evaluation.arbitratorRecommendation),
        JSON.stringify(evaluation.policyCalculation),
        evaluation.evaluatedAt
      );
  }
}

export class HumanApprovalRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): HumanApprovalRecord {
    return {
      id: String(row.id),
      milestoneId: String(row.milestone_id),
      evaluationId: String(row.evaluation_id),
      reviewerId: String(row.reviewer_id),
      decision: String(row.decision) as HumanReviewDecision,
      approvedAmountCents: Number(row.approved_amount_cents),
      isOverride: Number(row.is_override) === 1,
      justification: String(row.justification),
      decidedAt: String(row.decided_at),
    };
  }

  public listByMilestoneId(milestoneId: string): HumanApprovalRecord[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM human_approvals WHERE milestone_id = ? ORDER BY decided_at DESC')
      .all(milestoneId);
    return rows.map((r) => this.mapRow(r));
  }

  public findLatestByMilestoneId(milestoneId: string): HumanApprovalRecord | null {
    const row = this.rawDb
      .prepare(
        'SELECT * FROM human_approvals WHERE milestone_id = ? ORDER BY decided_at DESC LIMIT 1'
      )
      .get(milestoneId);
    return row ? this.mapRow(row) : null;
  }

  public insert(approval: HumanApprovalRecord): void {
    this.rawDb
      .prepare(
        `INSERT INTO human_approvals (
          id, milestone_id, evaluation_id, reviewer_id, decision,
          approved_amount_cents, is_override, justification, decided_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        approval.id,
        approval.milestoneId,
        approval.evaluationId,
        approval.reviewerId,
        approval.decision,
        approval.approvedAmountCents,
        approval.isOverride ? 1 : 0,
        approval.justification,
        approval.decidedAt
      );
  }
}

export class ScheduleProposalRepository {
  private readonly rawDb: DatabaseSync;
  private readonly milestoneRepo: MilestoneRepository;

  constructor(rawDb: DatabaseSync, milestoneRepo: MilestoneRepository) {
    this.rawDb = rawDb;
    this.milestoneRepo = milestoneRepo;
  }

  private mapRow(row: Record<string, unknown>): ScheduleRecoveryProposal {
    const milestoneId = String(row.milestone_id);
    const milestone = this.milestoneRepo.findById(milestoneId);
    return {
      id: String(row.id),
      contractId: String(row.contract_id),
      milestoneId,
      milestoneTitle: milestone?.title ?? milestoneId,
      proposedBy: String(row.proposed_by),
      status: String(row.status) as ScheduleProposalStatus,
      currentStartDate: String(row.current_start_date),
      currentEndDate: String(row.current_end_date),
      baselineStartDate: String(row.baseline_start_date),
      baselineEndDate: String(row.baseline_end_date),
      proposedStartDate: String(row.proposed_start_date),
      proposedEndDate: String(row.proposed_end_date),
      delayDays: Number(row.delay_days),
      riskSummary: String(row.risk_summary),
      aiRationale: String(row.ai_rationale),
      supportingEvidenceIds: JSON.parse(String(row.supporting_evidence_ids_json)) as string[],
      downstreamCascades: JSON.parse(
        String(row.downstream_cascades_json)
      ) as ScheduleDownstreamCascade[],
      preservesContractualAmountCents: Number(row.preserves_contractual_amount_cents),
      decidedBy: row.decided_by !== null ? String(row.decided_by) : null,
      decidedByRole: row.decided_by_role !== null ? (String(row.decided_by_role) as UserRole) : null,
      decidedAt: row.decided_at !== null ? String(row.decided_at) : null,
      decisionReason: row.decision_reason !== null ? String(row.decision_reason) : null,
      createdAt: String(row.created_at),
    };
  }

  public listByContractId(contractId: string): ScheduleRecoveryProposal[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM schedule_proposals WHERE contract_id = ? ORDER BY created_at DESC')
      .all(contractId);
    return rows.map((r) => this.mapRow(r));
  }

  public findById(id: string): ScheduleRecoveryProposal | null {
    const row = this.rawDb.prepare('SELECT * FROM schedule_proposals WHERE id = ?').get(id);
    return row ? this.mapRow(row) : null;
  }

  public findPendingByMilestoneId(milestoneId: string): ScheduleRecoveryProposal | null {
    const row = this.rawDb
      .prepare(
        "SELECT * FROM schedule_proposals WHERE milestone_id = ? AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1"
      )
      .get(milestoneId);
    return row ? this.mapRow(row) : null;
  }

  public insert(proposal: ScheduleRecoveryProposal): void {
    this.rawDb
      .prepare(
        `INSERT INTO schedule_proposals (
          id, contract_id, milestone_id, proposed_by, status,
          current_start_date, current_end_date, baseline_start_date, baseline_end_date,
          proposed_start_date, proposed_end_date, delay_days,
          risk_summary, ai_rationale, supporting_evidence_ids_json,
          downstream_cascades_json, preserves_contractual_amount_cents,
          decided_by, decided_by_role, decided_at, decision_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        proposal.id,
        proposal.contractId,
        proposal.milestoneId,
        proposal.proposedBy,
        proposal.status,
        proposal.currentStartDate,
        proposal.currentEndDate,
        proposal.baselineStartDate,
        proposal.baselineEndDate,
        proposal.proposedStartDate,
        proposal.proposedEndDate,
        proposal.delayDays,
        proposal.riskSummary,
        proposal.aiRationale,
        JSON.stringify(proposal.supportingEvidenceIds),
        JSON.stringify(proposal.downstreamCascades),
        proposal.preservesContractualAmountCents,
        proposal.decidedBy,
        proposal.decidedByRole,
        proposal.decidedAt,
        proposal.decisionReason,
        proposal.createdAt
      );
  }

  public updateDecision(params: {
    id: string;
    status: 'APPROVED' | 'REJECTED';
    decidedBy: string;
    decidedByRole: UserRole;
    decidedAt: string;
    decisionReason: string;
  }): void {
    this.rawDb
      .prepare(
        `UPDATE schedule_proposals
         SET status = ?, decided_by = ?, decided_by_role = ?, decided_at = ?, decision_reason = ?
         WHERE id = ?`
      )
      .run(
        params.status,
        params.decidedBy,
        params.decidedByRole,
        params.decidedAt,
        params.decisionReason,
        params.id
      );
  }
}

export class PaymentTransactionRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): PayPalTransactionRecord {
    const rawResp = JSON.parse(String(row.raw_paypal_response_json ?? '{}')) as Record<
      string,
      unknown
    >;
    const executionMode =
      rawResp.executionMode === 'PAYPAL_SANDBOX' ||
      rawResp.executionMode === 'LIVE_PAYPAL_SANDBOX'
        ? 'PAYPAL_SANDBOX'
        : 'SANDBOX_SIMULATION';

    return {
      id: String(row.id),
      milestoneId: String(row.milestone_id),
      approvalId: row.approval_id !== null ? String(row.approval_id) : null,
      paypalOrderId: row.paypal_order_id !== null ? String(row.paypal_order_id) : null,
      paypalAuthorizationId:
        row.paypal_authorization_id !== null ? String(row.paypal_authorization_id) : null,
      paypalCaptureId: row.paypal_capture_id !== null ? String(row.paypal_capture_id) : null,
      idempotencyKey: String(row.idempotency_key),
      authorizedAmountCents: Number(row.authorized_amount_cents),
      capturedAmountCents: Number(row.captured_amount_cents),
      currency: String(row.currency) as 'USD',
      status: String(row.status) as PayPalTransactionStatus,
      executionMode,
      nonEscrowDisclosure:
        'PayPal Orders API v2 intent: AUTHORIZE places a temporary payment hold (29-day maximum validity window) and is NOT custodial escrow.',
      authExpiresAt: row.auth_expires_at !== null ? String(row.auth_expires_at) : null,
      rawPaypalResponse: rawResp,
      updatedAt: String(row.updated_at),
    };
  }

  public findByIdempotencyKey(idempotencyKey: string): PayPalTransactionRecord | null {
    const row = this.rawDb
      .prepare('SELECT * FROM payment_transactions WHERE idempotency_key = ?')
      .get(idempotencyKey);
    return row ? this.mapRow(row) : null;
  }

  public findLatestByMilestoneId(milestoneId: string): PayPalTransactionRecord | null {
    const row = this.rawDb
      .prepare(
        'SELECT * FROM payment_transactions WHERE milestone_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT 1'
      )
      .get(milestoneId);
    return row ? this.mapRow(row) : null;
  }

  public listByMilestoneId(milestoneId: string): PayPalTransactionRecord[] {
    const rows = this.rawDb
      .prepare(
        'SELECT * FROM payment_transactions WHERE milestone_id = ? ORDER BY updated_at DESC, rowid DESC'
      )
      .all(milestoneId);
    return rows.map((r) => this.mapRow(r));
  }

  public findByPaypalAuthorizationId(authId: string): PayPalTransactionRecord | null {
    const row = this.rawDb
      .prepare('SELECT * FROM payment_transactions WHERE paypal_authorization_id = ? LIMIT 1')
      .get(authId);
    return row ? this.mapRow(row) : null;
  }

  public findByPaypalOrderId(orderId: string): PayPalTransactionRecord | null {
    const row = this.rawDb
      .prepare('SELECT * FROM payment_transactions WHERE paypal_order_id = ? LIMIT 1')
      .get(orderId);
    return row ? this.mapRow(row) : null;
  }

  public findByPaypalCaptureId(captureId: string, excludeTxId?: string): PayPalTransactionRecord | null {
    if (excludeTxId) {
      const row = this.rawDb
        .prepare('SELECT * FROM payment_transactions WHERE paypal_capture_id = ? AND id != ? LIMIT 1')
        .get(captureId, excludeTxId);
      return row ? this.mapRow(row) : null;
    }
    const row = this.rawDb
      .prepare('SELECT * FROM payment_transactions WHERE paypal_capture_id = ? LIMIT 1')
      .get(captureId);
    return row ? this.mapRow(row) : null;
  }

  public insert(tx: PayPalTransactionRecord): void {
    this.rawDb
      .prepare(
        `INSERT INTO payment_transactions (
          id, milestone_id, approval_id, paypal_order_id,
          paypal_authorization_id, paypal_capture_id, idempotency_key,
          authorized_amount_cents, captured_amount_cents, currency,
          status, auth_expires_at, raw_paypal_response_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        tx.id,
        tx.milestoneId,
        tx.approvalId ?? null,
        tx.paypalOrderId ?? null,
        tx.paypalAuthorizationId ?? null,
        tx.paypalCaptureId ?? null,
        tx.idempotencyKey ?? null,
        tx.authorizedAmountCents ?? 0,
        tx.capturedAmountCents ?? 0,
        tx.currency ?? 'USD',
        tx.status,
        tx.authExpiresAt ?? null,
        JSON.stringify({
          ...(tx.rawPaypalResponse ?? {}),
          executionMode: tx.executionMode ?? 'PAYPAL_SANDBOX',
        }),
        tx.updatedAt ?? new Date().toISOString()
      );
  }

  public update(tx: PayPalTransactionRecord): void {
    this.rawDb
      .prepare(
        `UPDATE payment_transactions
         SET approval_id = ?, paypal_order_id = ?, paypal_authorization_id = ?,
             paypal_capture_id = ?, idempotency_key = ?, authorized_amount_cents = ?,
             captured_amount_cents = ?, status = ?, auth_expires_at = ?,
             raw_paypal_response_json = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        tx.approvalId,
        tx.paypalOrderId,
        tx.paypalAuthorizationId,
        tx.paypalCaptureId,
        tx.idempotencyKey,
        tx.authorizedAmountCents,
        tx.capturedAmountCents,
        tx.status,
        tx.authExpiresAt,
        JSON.stringify({
          ...tx.rawPaypalResponse,
          executionMode: tx.executionMode,
        }),
        tx.updatedAt,
        tx.id
      );
  }
}

export class WebhookEventRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): PayPalWebhookEventRecord {
    return {
      eventId: String(row.event_id),
      eventType: String(row.event_type),
      transmissionId: row.transmission_id ? String(row.transmission_id) : null,
      verificationStatus: String(row.verification_status) as PayPalWebhookVerificationStatus,
      processingStatus: String(row.processing_status) as PayPalWebhookProcessingStatus,
      processingResult: row.processing_result ? String(row.processing_result) : null,
      reconciledTransactionId: row.reconciled_transaction_id
        ? String(row.reconciled_transaction_id)
        : null,
      errorMessage: row.error_message ? String(row.error_message) : null,
      receivedAt: String(row.received_at),
      updatedAt: String(row.updated_at),
    };
  }

  public findByEventId(eventId: string): PayPalWebhookEventRecord | null {
    const row = this.rawDb
      .prepare('SELECT * FROM paypal_webhook_events WHERE event_id = ?')
      .get(eventId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public listAll(): PayPalWebhookEventRecord[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM paypal_webhook_events ORDER BY received_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public create(record: PayPalWebhookEventRecord): void {
    this.rawDb
      .prepare(
        `
        INSERT INTO paypal_webhook_events (
          event_id, event_type, transmission_id, verification_status,
          processing_status, processing_result, reconciled_transaction_id,
          error_message, received_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        record.eventId,
        record.eventType,
        record.transmissionId,
        record.verificationStatus,
        record.processingStatus,
        record.processingResult,
        record.reconciledTransactionId,
        record.errorMessage,
        record.receivedAt,
        record.updatedAt
      );
  }

  public update(record: PayPalWebhookEventRecord): void {
    this.rawDb
      .prepare(
        `
        UPDATE paypal_webhook_events SET
          event_type = ?,
          transmission_id = ?,
          verification_status = ?,
          processing_status = ?,
          processing_result = ?,
          reconciled_transaction_id = ?,
          error_message = ?,
          updated_at = ?
        WHERE event_id = ?
      `
      )
      .run(
        record.eventType,
        record.transmissionId,
        record.verificationStatus,
        record.processingStatus,
        record.processingResult,
        record.reconciledTransactionId,
        record.errorMessage,
        record.updatedAt,
        record.eventId
      );
  }
}

export class EvidenceProvenanceRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): EvidenceProvenanceVerificationRecord {
    const overallStatus = String(row.overall_status) as EvidenceProvenanceStatus;
    const verificationStatus: VerificationResultStatus = row.verification_status
      ? (String(row.verification_status) as VerificationResultStatus)
      : overallStatus === 'VERIFIED'
        ? 'VERIFIED'
        : overallStatus === 'PENDING'
          ? 'PENDING'
          : overallStatus === 'UNVERIFIED_UNAVAILABLE'
            ? 'UNAVAILABLE'
            : 'FAILED';

    return {
      id: String(row.id),
      submissionId: String(row.submission_id),
      milestoneId: String(row.milestone_id),
      contractId: String(row.contract_id),
      verificationMode: String(row.verification_mode) as
        | 'GITHUB_REST_API'
        | 'UNCONFIGURED_UNAVAILABLE',
      overallStatus,
      verificationStatus,
      eligibleForBoundaryReview: Number(row.eligible_for_boundary_review) === 1,
      blockingReasons: JSON.parse(String(row.blocking_reasons_json ?? '[]')) as string[],
      discrepancies: JSON.parse(String(row.discrepancies_json ?? '[]')) as string[],
      integrity: JSON.parse(String(row.integrity_json)) as EvidenceIntegrityVerification,
      repository: JSON.parse(String(row.repository_json)) as GitHubRepositoryVerification,
      commit: JSON.parse(String(row.commit_json)) as GitHubCommitVerification,
      pullRequest: JSON.parse(String(row.pull_request_json)) as GitHubPullRequestVerification,
      workflowRun: JSON.parse(String(row.workflow_run_json)) as GitHubWorkflowRunVerification,
      results: row.results_json
        ? (JSON.parse(String(row.results_json)) as EvidenceVerificationResultItem[])
        : [],
      verifiedBy: String(row.verified_by),
      verifiedAt: String(row.verified_at),
    };
  }

  public findLatestBySubmissionId(
    submissionId: string
  ): EvidenceProvenanceVerificationRecord | null {
    const row = this.rawDb
      .prepare(
        'SELECT * FROM evidence_provenance_verifications WHERE submission_id = ? ORDER BY verified_at DESC LIMIT 1'
      )
      .get(submissionId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public findLatestByMilestoneId(
    milestoneId: string
  ): EvidenceProvenanceVerificationRecord | null {
    const row = this.rawDb
      .prepare(
        'SELECT * FROM evidence_provenance_verifications WHERE milestone_id = ? ORDER BY verified_at DESC LIMIT 1'
      )
      .get(milestoneId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public listByMilestoneId(milestoneId: string): EvidenceProvenanceVerificationRecord[] {
    const rows = this.rawDb
      .prepare(
        'SELECT * FROM evidence_provenance_verifications WHERE milestone_id = ? ORDER BY verified_at DESC'
      )
      .all(milestoneId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public insert(record: EvidenceProvenanceVerificationRecord): void {
    const verificationStatus: VerificationResultStatus =
      record.verificationStatus ??
      (record.overallStatus === 'VERIFIED'
        ? 'VERIFIED'
        : record.overallStatus === 'PENDING'
          ? 'PENDING'
          : record.overallStatus === 'UNVERIFIED_UNAVAILABLE'
            ? 'UNAVAILABLE'
            : 'FAILED');

    this.rawDb
      .prepare(
        `INSERT INTO evidence_provenance_verifications (
          id, submission_id, milestone_id, contract_id, verification_mode,
          overall_status, verification_status, eligible_for_boundary_review,
          blocking_reasons_json, discrepancies_json, integrity_json,
          repository_json, commit_json, pull_request_json, workflow_run_json,
          results_json, verified_by, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.submissionId,
        record.milestoneId,
        record.contractId,
        record.verificationMode,
        record.overallStatus,
        verificationStatus,
        record.eligibleForBoundaryReview ? 1 : 0,
        JSON.stringify(record.blockingReasons),
        JSON.stringify(record.discrepancies),
        JSON.stringify(record.integrity),
        JSON.stringify(record.repository),
        JSON.stringify(record.commit),
        JSON.stringify(record.pullRequest),
        JSON.stringify(record.workflowRun),
        JSON.stringify(record.results ?? []),
        record.verifiedBy,
        record.verifiedAt
      );
  }
}

export class GitHubWebhookEventRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): GitHubWebhookEventRecord {
    return {
      deliveryId: String(row.delivery_id),
      eventType: String(row.event_type),
      action: row.action ? String(row.action) : null,
      repositoryFullName: row.repository_full_name ? String(row.repository_full_name) : null,
      commitSha: row.commit_sha ? String(row.commit_sha) : null,
      providerTimestamp: row.provider_timestamp ? String(row.provider_timestamp) : null,
      signatureStatus: String(row.signature_status) as GitHubWebhookSignatureStatus,
      processingStatus: String(row.processing_status) as GitHubWebhookProcessingStatus,
      processingResult: row.processing_result ? String(row.processing_result) : null,
      matchedSubmissionId: row.matched_submission_id ? String(row.matched_submission_id) : null,
      payloadSha256: String(row.payload_sha256),
      errorMessage: row.error_message ? String(row.error_message) : null,
      receivedAt: String(row.received_at),
      updatedAt: String(row.updated_at),
    };
  }

  public findByDeliveryId(deliveryId: string): GitHubWebhookEventRecord | null {
    const row = this.rawDb
      .prepare('SELECT * FROM github_webhook_events WHERE delivery_id = ?')
      .get(deliveryId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public findLatestProcessedBySubmissionId(
    submissionId: string
  ): GitHubWebhookEventRecord | null {
    const row = this.rawDb
      .prepare(
        `SELECT * FROM github_webhook_events
         WHERE matched_submission_id = ? AND processing_status = 'PROCESSED'
         ORDER BY COALESCE(provider_timestamp, received_at) DESC LIMIT 1`
      )
      .get(submissionId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  public listRecent(limit = 100): GitHubWebhookEventRecord[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM github_webhook_events ORDER BY received_at DESC LIMIT ?')
      .all(limit) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public listAll(): GitHubWebhookEventRecord[] {
    const rows = this.rawDb
      .prepare('SELECT * FROM github_webhook_events ORDER BY received_at DESC')
      .all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public create(record: GitHubWebhookEventRecord): void {
    this.rawDb
      .prepare(
        `INSERT INTO github_webhook_events (
          delivery_id, event_type, action, repository_full_name, commit_sha,
          provider_timestamp, signature_status, processing_status, processing_result,
          matched_submission_id, payload_sha256, error_message, received_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.deliveryId,
        record.eventType,
        record.action,
        record.repositoryFullName,
        record.commitSha,
        record.providerTimestamp ?? null,
        record.signatureStatus,
        record.processingStatus,
        record.processingResult,
        record.matchedSubmissionId,
        record.payloadSha256,
        record.errorMessage,
        record.receivedAt,
        record.updatedAt
      );
  }

  public update(record: GitHubWebhookEventRecord): void {
    this.rawDb
      .prepare(
        `UPDATE github_webhook_events SET
          event_type = ?,
          action = ?,
          repository_full_name = ?,
          commit_sha = ?,
          provider_timestamp = ?,
          signature_status = ?,
          processing_status = ?,
          processing_result = ?,
          matched_submission_id = ?,
          payload_sha256 = ?,
          error_message = ?,
          updated_at = ?
        WHERE delivery_id = ?`
      )
      .run(
        record.eventType,
        record.action,
        record.repositoryFullName,
        record.commitSha,
        record.providerTimestamp ?? null,
        record.signatureStatus,
        record.processingStatus,
        record.processingResult,
        record.matchedSubmissionId,
        record.payloadSha256,
        record.errorMessage,
        record.updatedAt,
        record.deliveryId
      );
  }
}

export class EvidencePassportRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  public save(passport: EvidencePassport): void {
    this.rawDb
      .prepare(
        `INSERT OR REPLACE INTO evidence_passports (
          id, milestone_id, contract_id, submission_id,
          passport_digest, overall_status, criteria_summary_json,
          passport_data_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        passport.id,
        passport.identity.milestoneId,
        passport.identity.contractId,
        passport.sourceIdentity.commitSha || passport.id,
        passport.passportDigestSha256,
        passport.identity.overallStatus,
        JSON.stringify(passport.criteriaSummary),
        JSON.stringify(passport),
        passport.identity.createdAt,
        passport.identity.evaluatedAt ?? passport.identity.createdAt
      );
  }

  public findWithDigestByMilestoneId(
    milestoneId: string
  ): { passport: EvidencePassport; storedDigest: string } | null {
    const row = this.rawDb
      .prepare(
        'SELECT passport_data_json, passport_digest FROM evidence_passports WHERE milestone_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(milestoneId) as { passport_data_json: string; passport_digest: string } | undefined;
    if (!row) return null;
    try {
      return {
        passport: JSON.parse(row.passport_data_json) as EvidencePassport,
        storedDigest: String(row.passport_digest),
      };
    } catch {
      return null;
    }
  }

  public findByMilestoneId(milestoneId: string): EvidencePassport | null {
    const row = this.rawDb
      .prepare(
        'SELECT passport_data_json FROM evidence_passports WHERE milestone_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(milestoneId) as { passport_data_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.passport_data_json) as EvidencePassport;
    } catch {
      return null;
    }
  }

  public findById(id: string): EvidencePassport | null {
    const row = this.rawDb
      .prepare('SELECT passport_data_json FROM evidence_passports WHERE id = ?')
      .get(id) as { passport_data_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.passport_data_json) as EvidencePassport;
    } catch {
      return null;
    }
  }
}

export class DisputeEvidencePackRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  public save(pack: DisputeEvidencePack): void {
    const now = new Date().toISOString();
    this.rawDb
      .prepare(
        `INSERT OR REPLACE INTO dispute_evidence_packs (
          id, contract_id, milestone_id, pack_digest,
          schema_version, dispute_status, pack_data_json,
          generated_by, generated_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        pack.id,
        pack.contractId,
        pack.milestoneId,
        pack.integrity.packDigestSha256,
        pack.schemaVersion,
        pack.disputeStatus,
        JSON.stringify(pack),
        pack.integrity.generatedBy,
        pack.integrity.generatedAt,
        now
      );
  }

  public findById(id: string): DisputeEvidencePack | null {
    const row = this.rawDb
      .prepare('SELECT pack_data_json FROM dispute_evidence_packs WHERE id = ?')
      .get(id) as { pack_data_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.pack_data_json) as DisputeEvidencePack;
    } catch {
      return null;
    }
  }

  public findWithDigestById(
    id: string
  ): { pack: DisputeEvidencePack; storedDigest: string } | null {
    const row = this.rawDb
      .prepare(
        'SELECT pack_data_json, pack_digest FROM dispute_evidence_packs WHERE id = ?'
      )
      .get(id) as { pack_data_json: string; pack_digest: string } | undefined;
    if (!row) return null;
    try {
      return {
        pack: JSON.parse(row.pack_data_json) as DisputeEvidencePack,
        storedDigest: String(row.pack_digest),
      };
    } catch {
      return null;
    }
  }

  public findLatestByMilestoneId(milestoneId: string): DisputeEvidencePack | null {
    const row = this.rawDb
      .prepare(
        'SELECT pack_data_json FROM dispute_evidence_packs WHERE milestone_id = ? ORDER BY generated_at DESC LIMIT 1'
      )
      .get(milestoneId) as { pack_data_json: string } | undefined;
    if (!row) return null;
    try {
      return JSON.parse(row.pack_data_json) as DisputeEvidencePack;
    } catch {
      return null;
    }
  }

  public listByContractId(contractId: string): DisputeEvidencePack[] {
    const rows = this.rawDb
      .prepare(
        'SELECT pack_data_json FROM dispute_evidence_packs WHERE contract_id = ? ORDER BY generated_at DESC'
      )
      .all(contractId) as Array<{ pack_data_json: string }>;
    const packs: DisputeEvidencePack[] = [];
    for (const r of rows) {
      try {
        packs.push(JSON.parse(r.pack_data_json) as DisputeEvidencePack);
      } catch {
        // Skip unparseable records gracefully
      }
    }
    return packs;
  }
}




