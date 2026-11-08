import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { AuditService } from '../services/AuditService.ts';

/**
 * Generates a deterministic scrypt password hash string (`salt_hex:derived_hex`)
 * for one-time seed initialization of demo accounts.
 * Note: Runtime login password verification in AuthService uses non-blocking
 * asynchronous `crypto.scrypt()`.
 */
function createSeedPasswordHash(password: string, saltHex: string): string {
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return `${saltHex}:${derived.toString('hex')}`;
}

export class AppDatabase {
  public readonly raw: DatabaseSync;
  public readonly filePath: string;
  private inTransaction = false;

  constructor(filePath = path.resolve(process.cwd(), 'data', 'milestoneproof.sqlite')) {
    this.filePath = filePath;
    if (filePath !== ':memory:') {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.raw = new DatabaseSync(filePath);
    this.configurePragmas();
    this.runMigrations();
    this.seedIfEmpty();
  }

  private configurePragmas(): void {
    // WAL mode for concurrency + FULL synchronous mode for financial/audit durability
    this.raw.exec('PRAGMA journal_mode = WAL;');
    this.raw.exec('PRAGMA synchronous = FULL;');
    this.raw.exec('PRAGMA foreign_keys = ON;');
    this.raw.exec('PRAGMA busy_timeout = 5000;');
  }

  /**
   * Executes a synchronous callback inside an atomic SQLite `BEGIN IMMEDIATE` transaction.
   * Supports nested calls via SAVEPOINT so domain mutations and audit log appends
   * always commit or roll back together.
   */
  public withTransaction<T>(fn: () => T): T {
    if (this.inTransaction) {
      const savepoint = `sp_${crypto.randomUUID().replace(/-/g, '')}`;
      this.raw.exec(`SAVEPOINT ${savepoint}`);
      try {
        const result = fn();
        this.raw.exec(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (err) {
        this.raw.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.raw.exec(`RELEASE SAVEPOINT ${savepoint}`);
        throw err;
      }
    }

    this.inTransaction = true;
    this.raw.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        this.raw.exec('ROLLBACK');
      } catch {
        // Ignore rollback error if SQLite already rolled back
      }
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  private runMigrations(): void {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const applied = this.raw
      .prepare('SELECT version FROM schema_migrations WHERE version = 1')
      .get();

    if (applied) {
      this.runPhase5Migrations();
      return;
    }

    this.withTransaction(() => {
      this.raw.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('CLIENT', 'DEVELOPER', 'REVIEWER')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
          is_demo_account INTEGER NOT NULL DEFAULT 0 CHECK (is_demo_account IN (0, 1)),
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
          jti TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          role TEXT NOT NULL CHECK (role IN ('CLIENT', 'DEVELOPER', 'REVIEWER')),
          issued_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          revoked_at TEXT NULL,
          revoke_reason TEXT NULL,
          CHECK (expires_at > issued_at)
        );
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);

        CREATE TABLE IF NOT EXISTS contracts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT NOT NULL,
          total_budget_cents INTEGER NOT NULL CHECK (total_budget_cents > 0),
          currency TEXT NOT NULL CHECK (currency = 'USD'),
          client_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          developer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          policy_rules_json TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
          version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          CHECK (developer_id != reviewer_id),
          CHECK (client_id != developer_id)
        );
        CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
        CREATE INDEX IF NOT EXISTS idx_contracts_developer_id ON contracts(developer_id);
        CREATE INDEX IF NOT EXISTS idx_contracts_reviewer_id ON contracts(reviewer_id);

        CREATE TABLE IF NOT EXISTS milestones (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
          sequence_order INTEGER NOT NULL CHECK (sequence_order >= 1),
          title TEXT NOT NULL CHECK (length(trim(title)) > 0),
          description TEXT NOT NULL,
          agreed_amount_cents INTEGER NOT NULL CHECK (agreed_amount_cents > 0),
          deadline_iso TEXT NOT NULL,
          dependency_milestone_ids_json TEXT NOT NULL DEFAULT '[]',
          acceptance_criteria_json TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN (
            'DRAFT', 'ACTIVE', 'SUBMITTED', 'EVALUATING', 'PENDING_REVIEW',
            'APPROVED', 'REVISION_REQUESTED', 'REJECTED', 'SETTLED', 'PAY_FAILED'
          )),
          payment_status TEXT NOT NULL CHECK (payment_status IN (
            'NOT_READY', 'ORDER_CREATED', 'AUTHORIZED', 'CAPTURE_PENDING',
            'CAPTURED', 'SIMULATED_ORDER_CREATED', 'SIMULATED_AUTHORIZED',
            'SIMULATED_CAPTURED', 'SIMULATED_PARTIALLY_CAPTURED',
            'VOIDED', 'FAILED', 'EXPIRED'
          )),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (contract_id, sequence_order)
        );
        CREATE INDEX IF NOT EXISTS idx_milestones_contract_id ON milestones(contract_id);
        CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);

        CREATE TABLE IF NOT EXISTS evidence_submissions (
          id TEXT PRIMARY KEY,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
          submitted_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          repo_url TEXT NOT NULL,
          branch TEXT NOT NULL,
          commit_sha TEXT NOT NULL,
          pr_url TEXT NOT NULL,
          pr_status TEXT NOT NULL CHECK (pr_status IN ('MERGED', 'OPEN', 'CLOSED')),
          ci_report_json TEXT NOT NULL,
          security_scan_json TEXT NOT NULL,
          developer_notes TEXT NOT NULL DEFAULT '',
          submitted_at TEXT NOT NULL,
          UNIQUE (milestone_id, attempt_number)
        );
        CREATE INDEX IF NOT EXISTS idx_evidence_milestone_id ON evidence_submissions(milestone_id);

        CREATE TABLE IF NOT EXISTS ai_evaluations (
          id TEXT PRIMARY KEY,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          submission_id TEXT NOT NULL REFERENCES evidence_submissions(id) ON DELETE RESTRICT,
          status TEXT NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
          evidence_analysis_json TEXT NOT NULL,
          risk_analysis_json TEXT NOT NULL,
          arbitrator_recommendation_json TEXT NOT NULL,
          policy_calculation_json TEXT NOT NULL,
          evaluated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_evaluations_milestone_id ON ai_evaluations(milestone_id);

        CREATE TABLE IF NOT EXISTS human_approvals (
          id TEXT PRIMARY KEY,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          evaluation_id TEXT NOT NULL REFERENCES ai_evaluations(id) ON DELETE RESTRICT,
          reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'REQUEST_REVISIONS', 'REJECT')),
          approved_amount_cents INTEGER NOT NULL CHECK (approved_amount_cents >= 0),
          is_override INTEGER NOT NULL DEFAULT 0 CHECK (is_override IN (0, 1)),
          justification TEXT NOT NULL,
          decided_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_approvals_milestone_id ON human_approvals(milestone_id);

        CREATE TABLE IF NOT EXISTS payment_transactions (
          id TEXT PRIMARY KEY,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          approval_id TEXT NULL REFERENCES human_approvals(id) ON DELETE RESTRICT,
          paypal_order_id TEXT NULL,
          paypal_authorization_id TEXT NULL,
          paypal_capture_id TEXT NULL,
          idempotency_key TEXT UNIQUE NOT NULL,
          authorized_amount_cents INTEGER NOT NULL CHECK (authorized_amount_cents >= 0),
          captured_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (captured_amount_cents >= 0),
          currency TEXT NOT NULL CHECK (currency = 'USD'),
          status TEXT NOT NULL CHECK (status IN (
            'ORDER_CREATED', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_CAPTURED_VOIDED',
            'SIMULATED_ORDER_CREATED', 'SIMULATED_AUTHORIZED',
            'SIMULATED_CAPTURED', 'SIMULATED_PARTIALLY_CAPTURED',
            'VOIDED', 'FAILED', 'EXPIRED'
          )),
          auth_expires_at TEXT NULL,
          raw_paypal_response_json TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_payments_milestone_id ON payment_transactions(milestone_id);

        CREATE TABLE IF NOT EXISTS audit_logs (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT UNIQUE NOT NULL,
          timestamp TEXT NOT NULL,
          actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          actor_role TEXT NOT NULL CHECK (actor_role IN ('CLIENT', 'DEVELOPER', 'REVIEWER', 'SYSTEM')),
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          contract_id TEXT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
          milestone_id TEXT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          previous_state TEXT NULL,
          new_state TEXT NULL,
          payload_json TEXT NOT NULL,
          previous_hash TEXT NOT NULL CHECK (length(previous_hash) = 64),
          entry_hash TEXT UNIQUE NOT NULL CHECK (length(entry_hash) = 64)
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_contract_id ON audit_logs(contract_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_milestone_id ON audit_logs(milestone_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);

        CREATE TRIGGER IF NOT EXISTS trg_audit_logs_immutable_update
        BEFORE UPDATE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE: UPDATE operations on audit_logs are prohibited');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_audit_logs_immutable_delete
        BEFORE DELETE ON audit_logs
        BEGIN
          SELECT RAISE(ABORT, 'AUDIT_LOG_IMMUTABLE: DELETE operations on audit_logs are prohibited');
        END;
      `);

      this.raw
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(1, '001_initial_phase1_schema', new Date().toISOString());
    });

    this.runPhase5Migrations();
  }

  private runPhase5Migrations(): void {
    const applied2 = this.raw
      .prepare('SELECT version FROM schema_migrations WHERE version = 2')
      .get();

    if (applied2) {
      this.runPhase6WebhookMigrations();
      return;
    }

    this.withTransaction(() => {
      const columns = this.raw
        .prepare('PRAGMA table_info(milestones)')
        .all() as Array<{ name: string }>;
      const colNames = new Set(columns.map((c) => c.name));

      if (!colNames.has('start_date_iso')) {
        this.raw.exec('ALTER TABLE milestones ADD COLUMN start_date_iso TEXT NULL;');
      }
      if (!colNames.has('baseline_start_iso')) {
        this.raw.exec('ALTER TABLE milestones ADD COLUMN baseline_start_iso TEXT NULL;');
      }
      if (!colNames.has('baseline_end_iso')) {
        this.raw.exec('ALTER TABLE milestones ADD COLUMN baseline_end_iso TEXT NULL;');
      }

      this.raw.exec(`
        CREATE TABLE IF NOT EXISTS schedule_proposals (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          proposed_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
          current_start_date TEXT NOT NULL,
          current_end_date TEXT NOT NULL,
          baseline_start_date TEXT NOT NULL,
          baseline_end_date TEXT NOT NULL,
          proposed_start_date TEXT NOT NULL,
          proposed_end_date TEXT NOT NULL,
          delay_days INTEGER NOT NULL CHECK (delay_days >= 0),
          risk_summary TEXT NOT NULL,
          ai_rationale TEXT NOT NULL,
          supporting_evidence_ids_json TEXT NOT NULL DEFAULT '[]',
          downstream_cascades_json TEXT NOT NULL DEFAULT '[]',
          preserves_contractual_amount_cents INTEGER NOT NULL CHECK (preserves_contractual_amount_cents > 0),
          decided_by TEXT NULL REFERENCES users(id) ON DELETE RESTRICT,
          decided_by_role TEXT NULL CHECK (decided_by_role IN ('CLIENT', 'DEVELOPER', 'REVIEWER')),
          decided_at TEXT NULL,
          decision_reason TEXT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_schedule_proposals_contract_id ON schedule_proposals(contract_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_proposals_milestone_id ON schedule_proposals(milestone_id);
      `);

      this.raw
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(2, '002_phase5_bryntum_schedule_and_paypal', new Date().toISOString());
    });

    this.runPhase6WebhookMigrations();
  }

  private runPhase6WebhookMigrations(): void {
    const existingV3 = this.raw
      .prepare('SELECT version FROM schema_migrations WHERE version = 3')
      .get() as { version: number } | undefined;
    if (existingV3) {
      this.runPhase7ProvenanceMigrations();
      return;
    }

    this.withTransaction(() => {
      this.raw.exec(`
        CREATE TABLE IF NOT EXISTS paypal_webhook_events (
          event_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          transmission_id TEXT NULL,
          verification_status TEXT NOT NULL CHECK (
            verification_status IN ('SUCCESS', 'FAILURE', 'UNVERIFIED')
          ),
          processing_status TEXT NOT NULL CHECK (
            processing_status IN ('PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED')
          ),
          processing_result TEXT NULL,
          reconciled_transaction_id TEXT NULL,
          error_message TEXT NULL,
          received_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_status
          ON paypal_webhook_events(processing_status);
      `);

      this.raw
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(3, '003_phase6_paypal_webhook_idempotency', new Date().toISOString());
    });

    this.runPhase7ProvenanceMigrations();
  }

  private runPhase7ProvenanceMigrations(): void {
    const existingV4 = this.raw
      .prepare('SELECT version FROM schema_migrations WHERE version = 4')
      .get() as { version: number } | undefined;
    if (existingV4) {
      this.runPhase10PassportMigrations();
      return;
    }

    this.withTransaction(() => {
      const evCols = this.raw
        .prepare('PRAGMA table_info(evidence_submissions)')
        .all() as Array<{ name: string }>;
      const colNames = new Set(evCols.map((c) => c.name));

      if (!colNames.has('payload_sha256')) {
        this.raw.exec(
          'ALTER TABLE evidence_submissions ADD COLUMN payload_sha256 TEXT NULL;'
        );
      }
      if (!colNames.has('payload_hash_algorithm')) {
        this.raw.exec(
          "ALTER TABLE evidence_submissions ADD COLUMN payload_hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256';"
        );
      }
      if (!colNames.has('canonicalization_version')) {
        this.raw.exec(
          "ALTER TABLE evidence_submissions ADD COLUMN canonicalization_version TEXT NOT NULL DEFAULT 'mpai-evidence-canon-v1';"
        );
      }
      if (!colNames.has('payload_hashed_at')) {
        this.raw.exec(
          'ALTER TABLE evidence_submissions ADD COLUMN payload_hashed_at TEXT NULL;'
        );
      }
      if (!colNames.has('provenance_status')) {
        this.raw.exec(
          "ALTER TABLE evidence_submissions ADD COLUMN provenance_status TEXT NOT NULL DEFAULT 'UNVERIFIED_UNAVAILABLE';"
        );
      }

      this.raw.exec(`
        CREATE TABLE IF NOT EXISTS evidence_provenance_verifications (
          id TEXT PRIMARY KEY,
          submission_id TEXT NOT NULL REFERENCES evidence_submissions(id) ON DELETE RESTRICT,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
          verification_mode TEXT NOT NULL CHECK (
            verification_mode IN ('GITHUB_REST_API', 'UNCONFIGURED_UNAVAILABLE')
          ),
          overall_status TEXT NOT NULL CHECK (
            overall_status IN (
              'VERIFIED',
              'MISMATCH_DETECTED',
              'PARTIALLY_VERIFIED',
              'UNVERIFIED_UNAVAILABLE',
              'TAMPERED_PAYLOAD',
              'PENDING'
            )
          ),
          verification_status TEXT NOT NULL DEFAULT 'UNAVAILABLE' CHECK (
            verification_status IN ('VERIFIED', 'FAILED', 'UNAVAILABLE', 'PENDING')
          ),
          eligible_for_boundary_review INTEGER NOT NULL CHECK (
            eligible_for_boundary_review IN (0, 1)
          ),
          blocking_reasons_json TEXT NOT NULL DEFAULT '[]',
          discrepancies_json TEXT NOT NULL DEFAULT '[]',
          integrity_json TEXT NOT NULL,
          repository_json TEXT NOT NULL,
          commit_json TEXT NOT NULL,
          pull_request_json TEXT NOT NULL,
          workflow_run_json TEXT NOT NULL,
          results_json TEXT NOT NULL DEFAULT '[]',
          verified_by TEXT NOT NULL,
          verified_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_provenance_submission_id
          ON evidence_provenance_verifications(submission_id);
        CREATE INDEX IF NOT EXISTS idx_provenance_milestone_id
          ON evidence_provenance_verifications(milestone_id);

        CREATE TABLE IF NOT EXISTS github_webhook_events (
          delivery_id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          action TEXT NULL,
          repository_full_name TEXT NULL,
          commit_sha TEXT NULL,
          provider_timestamp TEXT NULL,
          signature_status TEXT NOT NULL CHECK (
            signature_status IN ('SUCCESS', 'FAILURE', 'UNVERIFIED')
          ),
          processing_status TEXT NOT NULL CHECK (
            processing_status IN ('PROCESSING', 'PROCESSED', 'FAILED', 'REJECTED')
          ),
          processing_result TEXT NULL,
          matched_submission_id TEXT NULL,
          payload_sha256 TEXT NOT NULL,
          error_message TEXT NULL,
          received_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_github_webhook_events_status
          ON github_webhook_events(processing_status);
      `);

      this.raw
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(4, '004_phase7_evidence_provenance_and_github_verification', new Date().toISOString());
    });

    this.runPhase10PassportMigrations();
  }

  private runPhase10PassportMigrations(): void {
    const existingV5 = this.raw
      .prepare('SELECT version FROM schema_migrations WHERE version = 5')
      .get() as { version: number } | undefined;
    if (existingV5) {
      this.runPhase11DisputePackMigrations();
      return;
    }

    this.withTransaction(() => {
      this.raw.exec(`
        CREATE TABLE IF NOT EXISTS evidence_passports (
          id TEXT PRIMARY KEY,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
          submission_id TEXT NOT NULL,
          passport_digest TEXT NOT NULL CHECK (length(passport_digest) = 64),
          overall_status TEXT NOT NULL,
          criteria_summary_json TEXT NOT NULL DEFAULT '{}',
          passport_data_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_evidence_passports_milestone_id
          ON evidence_passports(milestone_id);
        CREATE INDEX IF NOT EXISTS idx_evidence_passports_contract_id
          ON evidence_passports(contract_id);
      `);

      this.raw
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(5, '005_prompt2_evidence_passport', new Date().toISOString());
    });

    this.runPhase11DisputePackMigrations();
  }

  private runPhase11DisputePackMigrations(): void {
    const existingV6 = this.raw
      .prepare('SELECT version FROM schema_migrations WHERE version = 6')
      .get() as { version: number } | undefined;
    if (existingV6) {
      return;
    }

    this.withTransaction(() => {
      this.raw.exec(`
        CREATE TABLE IF NOT EXISTS dispute_evidence_packs (
          id TEXT PRIMARY KEY,
          contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
          milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
          pack_digest TEXT NOT NULL CHECK (length(pack_digest) = 64),
          schema_version TEXT NOT NULL,
          dispute_status TEXT NOT NULL,
          pack_data_json TEXT NOT NULL,
          generated_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          generated_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dispute_evidence_packs_contract_id
          ON dispute_evidence_packs(contract_id);
        CREATE INDEX IF NOT EXISTS idx_dispute_evidence_packs_milestone_id
          ON dispute_evidence_packs(milestone_id);
      `);

      this.raw
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(6, '006_prompt4_dispute_evidence_pack', new Date().toISOString());
    });
  }

  private seedIfEmpty(): void {
    const countRow = this.raw.prepare('SELECT COUNT(*) as cnt FROM users').get() as {
      cnt: number;
    };
    if (Number(countRow.cnt) > 0) {
      return;
    }

    const now = '2026-11-01T09:00:00.000Z';
    const auditSvc = new AuditService(this.raw);

    this.withTransaction(() => {
      const insertUser = this.raw.prepare(`
        INSERT INTO users (id, name, email, password_hash, role, is_active, is_demo_account, created_at)
        VALUES (?, ?, ?, ?, ?, 1, 1, ?)
      `);

      insertUser.run(
        'client_01',
        'Elena Vance (Acme FinTech Buyer)',
        'elena.client@acmefintech.example',
        createSeedPasswordHash('ClientPass!2026', 'a1b2c3d4e5f60718293a4b5c6d7e8f90'),
        'CLIENT',
        now
      );
      insertUser.run(
        'dev_01',
        'Marcus Chen (Lead Contractor)',
        'marcus.dev@cloudbuilders.example',
        createSeedPasswordHash('DevPass!2026', 'b2c3d4e5f60718293a4b5c6d7e8f90a1'),
        'DEVELOPER',
        now
      );
      insertUser.run(
        'reviewer_01',
        'Sophia Sterling (Fiduciary Controller)',
        'sophia.reviewer@acmefintech.example',
        createSeedPasswordHash('ReviewerPass!2026', 'c3d4e5f60718293a4b5c6d7e8f90a1b2'),
        'REVIEWER',
        now
      );

      const contractId = 'contract_seed_01';
      const policyRules = {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: true,
        latePenaltyDailyBps: 100,
      };

      this.raw
        .prepare(`
          INSERT INTO contracts (
            id, title, description, total_budget_cents, currency,
            client_id, developer_id, reviewer_id, policy_rules_json,
            status, version, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'USD', ?, ?, ?, ?, 'ACTIVE', 1, ?, ?)
        `)
        .run(
          contractId,
          'Core Payment Gateway & OAuth2 Microservice Contract',
          'Milestone-governed software delivery contract for OAuth2 authentication, REST API specification, and payment ledger modules.',
          850000, // $8,500.00 across 3 milestones ($2,500 + $3,500 + $2,500)
          'client_01',
          'dev_01',
          'reviewer_01',
          JSON.stringify(policyRules),
          now,
          now
        );

      const insertMilestone = this.raw.prepare(`
        INSERT INTO milestones (
          id, contract_id, sequence_order, title, description,
          agreed_amount_cents, start_date_iso, deadline_iso,
          baseline_start_iso, baseline_end_iso, dependency_milestone_ids_json,
          acceptance_criteria_json, status, payment_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'NOT_READY', ?, ?)
      `);

      insertMilestone.run(
        'ms_seed_01',
        contractId,
        1,
        'Milestone 1: OAuth2 Service & Unit Test Suite',
        'Implement OAuth2 token exchange with >=80% unit test coverage and zero critical vulnerabilities.',
        250000, // $2,500.00
        '2026-11-01T09:00:00.000Z',
        '2026-11-10T23:59:59.000Z',
        '2026-11-01T09:00:00.000Z',
        '2026-11-10T23:59:59.000Z',
        JSON.stringify([]),
        JSON.stringify([
          {
            id: 'AC-1',
            title: 'OAuth2 Authentication Endpoints',
            description: 'Implement OAuth2 token validation and session management.',
            requiredProofType: 'CODE_COMMIT',
          },
          {
            id: 'AC-2',
            title: 'Automated Unit Tests >= 80% Coverage',
            description: 'CI test suite must pass 100% of unit tests with >= 80% statement coverage.',
            requiredProofType: 'CI_TESTS',
          },
        ]),
        now,
        now
      );

      insertMilestone.run(
        'ms_seed_02',
        contractId,
        2,
        'Milestone 2: OpenAPI 3.0 Spec & Settlement Webhook Engine',
        'Deliver validated OpenAPI 3.0 contract and idempotent webhook processor.',
        350000, // $3,500.00
        '2026-11-11T09:00:00.000Z',
        '2026-11-20T23:59:59.000Z',
        '2026-11-11T09:00:00.000Z',
        '2026-11-20T23:59:59.000Z',
        JSON.stringify(['ms_seed_01']),
        JSON.stringify([
          {
            id: 'AC-1',
            title: 'Validated OpenAPI 3.0 Specification',
            description: 'Provide complete OpenAPI 3.0 JSON schema passing APIMatic validation rules.',
            requiredProofType: 'API_DOCS',
          },
          {
            id: 'AC-2',
            title: 'Zero Critical/High CVEs in Dependencies',
            description: 'Dependency audit scan must report 0 Critical and 0 High vulnerabilities.',
            requiredProofType: 'SECURITY_SCAN',
          },
        ]),
        now,
        now
      );

      insertMilestone.run(
        'ms_seed_03',
        contractId,
        3,
        'Milestone 3: Production Security Hardening & Ledger Reconciliation',
        'Deliver merged reconciliation PR, passing CI tests, and zero critical dependency vulnerabilities.',
        250000, // $2,500.00
        '2026-11-21T09:00:00.000Z',
        '2026-11-30T23:59:59.000Z',
        '2026-11-21T09:00:00.000Z',
        '2026-11-30T23:59:59.000Z',
        JSON.stringify(['ms_seed_02']),
        JSON.stringify([
          {
            id: 'AC-1',
            title: 'Merged Pull Request for Ledger Reconciliation',
            description: 'Pull request must be merged into target repository with ledger reconciliation source files.',
            requiredProofType: 'PULL_REQUEST',
          },
          {
            id: 'AC-2',
            title: 'Passing CI Test Suite & Security Audit',
            description: '100% passing CI tests and 0 Critical CVEs in security scan.',
            requiredProofType: 'CI_TESTS',
          },
        ]),
        now,
        now
      );

      auditSvc.appendWithinTx({
        actorId: 'client_01',
        actorRole: 'CLIENT',
        action: 'CONTRACT_SEED_INITIALIZED',
        entityType: 'CONTRACT',
        entityId: contractId,
        contractId,
        previousState: null,
        newState: 'ACTIVE',
        payload: {
          title: 'Core Payment Gateway & OAuth2 Microservice Contract',
          totalBudgetCents: 850000,
          milestoneCount: 3,
        },
        timestamp: now,
      });
    });
  }

  public close(): void {
    if (this.raw.isOpen) {
      this.raw.close();
    }
  }
}
