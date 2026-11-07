import type { DatabaseSync } from 'node:sqlite';
import type {
  AcceptanceCriterion,
  AuthSessionRecord,
  CiExecutionReport,
  Contract,
  ContractPolicyRules,
  ContractStatus,
  EvaluationRun,
  EvidenceAnalysis,
  EvidenceReference,
  EvidenceSubmission,
  Milestone,
  MilestoneStatus,
  PaymentStatus,
  PolicyCalculationResult,
  ReviewSynthesis,
  RiskAssessment,
  SecurityScanReport,
  User,
  UserRole,
  UserWithPasswordRow,
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
    return {
      id: String(row.id),
      contractId: String(row.contract_id),
      sequenceOrder: Number(row.sequence_order),
      title: String(row.title),
      description: String(row.description),
      agreedAmountCents: Number(row.agreed_amount_cents),
      deadlineIso: String(row.deadline_iso),
      dependencyMilestoneIds: JSON.parse(String(row.dependency_milestone_ids_json)) as string[],
      acceptanceCriteria: JSON.parse(String(row.acceptance_criteria_json)) as AcceptanceCriterion[],
      status: String(row.status) as MilestoneStatus,
      paymentStatus: String(row.payment_status) as PaymentStatus,
      createdAt: String(row.created_at),
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
    this.rawDb
      .prepare(
        `INSERT INTO milestones (
          id, contract_id, sequence_order, title, description,
          agreed_amount_cents, deadline_iso, dependency_milestone_ids_json,
          acceptance_criteria_json, status, payment_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        milestone.id,
        milestone.contractId,
        milestone.sequenceOrder,
        milestone.title,
        milestone.description,
        milestone.agreedAmountCents,
        milestone.deadlineIso,
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

export class EvidenceRepository {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  private mapRow(row: Record<string, unknown>): EvidenceSubmission {
    const id = String(row.id);
    const repoUrl = String(row.repo_url);
    const branch = String(row.branch);
    const commitSha = String(row.commit_sha);
    const prUrl = String(row.pr_url);
    const prStatus = String(row.pr_status) as 'MERGED' | 'OPEN' | 'CLOSED';
    const ciReport = JSON.parse(String(row.ci_report_json)) as CiExecutionReport;
    const securityScan = JSON.parse(String(row.security_scan_json)) as SecurityScanReport;

    return {
      id,
      milestoneId: String(row.milestone_id),
      attemptNumber: Number(row.attempt_number),
      submittedBy: String(row.submitted_by),
      repoUrl,
      branch,
      commitSha,
      prUrl,
      prStatus,
      ciReport,
      securityScan,
      developerNotes: String(row.developer_notes ?? ''),
      submittedAt: String(row.submitted_at),
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

  public getNextAttemptNumber(milestoneId: string): number {
    const row = this.rawDb
      .prepare(
        'SELECT COALESCE(MAX(attempt_number), 0) as max_attempt FROM evidence_submissions WHERE milestone_id = ?'
      )
      .get(milestoneId) as { max_attempt: number };
    return Number(row.max_attempt) + 1;
  }

  public insert(submission: EvidenceSubmission): void {
    this.rawDb
      .prepare(
        `INSERT INTO evidence_submissions (
          id, milestone_id, attempt_number, submitted_by, repo_url, branch,
          commit_sha, pr_url, pr_status, ci_report_json, security_scan_json,
          developer_notes, submitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        submission.submittedAt
      );
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
