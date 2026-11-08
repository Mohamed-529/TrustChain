import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  ContractRepository,
  MilestoneRepository,
} from '../repositories/DomainRepositories.ts';
import {
  AUDIT_GENESIS_HASH,
  canonicalizeJson,
  computeAuditEntryHash,
} from './AuditService.ts';
import type {
  AuditLogEntry,
  AuditReplayResult,
  ContractStatus,
  MilestoneStatus,
  PaymentStatus,
  ReconstructedContractState,
  ReconstructedMilestoneState,
  ReplayEventOutcome,
  ReplayFinding,
  ReplayMode,
  ReplayStatus,
} from '../../types/domain.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface AuditReplayOptions {
  contractId: string;
  mode?: ReplayMode;
  upToSeq?: number;
  limit?: number;
}

const SUPPORTED_AUDIT_ACTIONS = new Set<string>([
  'CONTRACT_CREATED',
  'CONTRACT_SEED_INITIALIZED',
  'CONTRACT_ACTIVATED',
  'EVIDENCE_SUBMITTED',
  'EVALUATION_STARTED',
  'EVALUATION_COMPLETED',
  'EVALUATION_FAILED',
  'HUMAN_REVIEW_APPROVED',
  'HUMAN_REVIEW_REJECTED',
  'HUMAN_REVIEW_CHANGES_REQUESTED',
  'PAYPAL_ORDER_CREATED',
  'PAYPAL_SIMULATED_ORDER_CREATED',
  'PAYPAL_ORDER_AUTHORIZED',
  'PAYPAL_SIMULATED_ORDER_AUTHORIZED',
  'PAYPAL_AUTHORIZATION_CAPTURED',
  'PAYPAL_SIMULATED_CAPTURE_RECORDED',
  'SCHEDULE_RECOVERY_PROPOSED',
  'SCHEDULE_RECOVERY_APPROVED',
  'SCHEDULE_RECOVERY_REJECTED',
  'GITHUB_WEBHOOK_VERIFIED',
  'GITHUB_WEBHOOK_REJECTED',
  'GITHUB_WEBHOOK_DUPLICATE_IGNORED',
  'GITHUB_WEBHOOK_PROCESSING_FAILED',
  'PAYPAL_WEBHOOK_VERIFIED',
  'PAYPAL_WEBHOOK_REJECTED',
  'PAYPAL_WEBHOOK_DUPLICATE_IGNORED',
  'PAYPAL_WEBHOOK_PROCESSING_FAILED',
]);

/**
 * AuditReplayService — Production-minded, deterministic, read-only Audit Replay Engine.
 * Reconstructs contract and milestone lifecycle state purely from the immutable audit log history.
 *
 * STRICT SAFETY INVARIANTS:
 * 1. Read-only: never modifies SQLite tables, audit logs, or financial balances.
 * 2. Zero payment authority: payment events are treated strictly as descriptive historical records.
 * 3. Never invents missing events or repairs history.
 * 4. Distinctly flags cryptographic corruption, logical inconsistency, incomplete history, and unsupported events.
 */
export class AuditReplayService {
  private readonly rawDb: DatabaseSync;
  private readonly contractRepo: ContractRepository;
  private readonly milestoneRepo?: MilestoneRepository;

  constructor(
    rawDb: DatabaseSync,
    contractRepo: ContractRepository,
    milestoneRepo?: MilestoneRepository
  ) {
    this.rawDb = rawDb;
    this.contractRepo = contractRepo;
    this.milestoneRepo = milestoneRepo;
  }

  /**
   * Replays or verifies the audit event stream for a specific contract.
   */
  public replayContractAudit(options: AuditReplayOptions): AuditReplayResult {
    const { contractId } = options;
    const mode: ReplayMode = options.mode ?? 'FULL';
    const upToSeq = options.upToSeq !== undefined ? Number(options.upToSeq) : undefined;
    const limit = options.limit !== undefined ? Math.min(Math.max(1, Number(options.limit)), 1000) : 500;

    if (upToSeq !== undefined && (!Number.isInteger(upToSeq) || upToSeq <= 0)) {
      throw new AppError(400, 'INVALID_PARAMETER', 'upToSeq must be a positive integer.');
    }

    // Step A: Ensure contract exists
    const contract = this.contractRepo.findById(contractId);
    if (!contract) {
      throw new AppError(404, 'CONTRACT_NOT_FOUND', `Contract '${contractId}' was not found.`);
    }

    // Step B: Retrieve contract-associated audit events ordered deterministically by seq ASC
    const queryClauses = ['contract_id = ?'];
    const queryArgs: (string | number)[] = [contractId];

    if (upToSeq !== undefined) {
      queryClauses.push('seq <= ?');
      queryArgs.push(upToSeq);
    }

    const rows = this.rawDb
      .prepare(
        `SELECT * FROM audit_logs WHERE ${queryClauses.join(' AND ')} ORDER BY seq ASC LIMIT ?`
      )
      .all(...queryArgs, limit) as Array<Record<string, unknown>>;

    const findings: ReplayFinding[] = [];
    const warnings: string[] = [];
    const eventOutcomes: ReplayEventOutcome[] = [];

    // Step C: Empty history handling
    if (rows.length === 0) {
      return {
        contractId,
        mode,
        status: 'EMPTY_HISTORY',
        isCryptographicallyValid: true,
        isLogicallyConsistent: true,
        totalEventsProcessed: 0,
        startSeq: null,
        endSeq: null,
        targetSeq: upToSeq,
        verificationSummary: {
          eventsInspected: 0,
          chainValid: true,
          hashErrorsCount: 0,
          lifecycleErrorsCount: 0,
          warningsCount: 0,
        },
        findings: [
          {
            category: 'SEQUENCE_INTEGRITY',
            severity: 'INFO',
            code: 'EMPTY_AUDIT_HISTORY',
            message: `No audit log entries recorded for contract '${contractId}'.`,
          },
        ],
        eventOutcomes: [],
        reconstructedState: mode === 'VERIFY_ONLY' ? undefined : {
          contract: {
            id: contractId,
            status: 'DRAFT',
            totalBudgetCents: contract.totalBudgetCents,
            milestoneCount: 0,
            activeMilestones: 0,
            settledMilestones: 0,
            totalSettledCents: 0,
          },
          milestones: {},
        },
        warnings: [],
      };
    }

    const startSeq = Number(rows[0].seq);
    const endSeq = Number(rows[rows.length - 1].seq);
    let hashErrorsCount = 0;
    let lifecycleErrorsCount = 0;

    // Step D: Cryptographic Hash & Sequence Validation on all retrieved events
    const seenSeqs = new Set<number>();
    const seenEventIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const seq = Number(row.seq);
      const eventId = String(row.id);
      const storedPrevHash = String(row.previous_hash);
      const storedEntryHash = String(row.entry_hash);
      const rowContractId = row.contract_id !== null ? String(row.contract_id) : null;
      const rowMilestoneId = row.milestone_id !== null ? String(row.milestone_id) : null;
      const rawPayloadJson = String(row.payload_json ?? '{}');

      // Check sequence validity
      if (!Number.isInteger(seq) || seq <= 0) {
        hashErrorsCount++;
        findings.push({
          category: 'SEQUENCE_INTEGRITY',
          severity: 'ERROR',
          code: 'INVALID_SEQUENCE_NUMBER',
          message: `Event '${eventId}' has invalid non-positive sequence number: ${seq}`,
          seq,
          entityId: eventId,
        });
      }

      // Check duplicate sequence numbers
      if (seenSeqs.has(seq)) {
        hashErrorsCount++;
        findings.push({
          category: 'SEQUENCE_INTEGRITY',
          severity: 'ERROR',
          code: 'DUPLICATE_SEQUENCE_NUMBER',
          message: `Duplicate sequence number detected: seq=${seq}`,
          seq,
          entityId: eventId,
        });
      }
      seenSeqs.add(seq);

      // Check duplicate event IDs
      if (seenEventIds.has(eventId)) {
        hashErrorsCount++;
        findings.push({
          category: 'SEQUENCE_INTEGRITY',
          severity: 'ERROR',
          code: 'DUPLICATE_EVENT_ID',
          message: `Duplicate audit event ID detected: ${eventId}`,
          seq,
          entityId: eventId,
        });
      }
      seenEventIds.add(eventId);

      // Check cross-contract reference mismatch
      if (rowContractId !== contractId) {
        lifecycleErrorsCount++;
        findings.push({
          category: 'ENTITY_REFERENCE',
          severity: 'ERROR',
          code: 'CROSS_CONTRACT_MISMATCH',
          message: `Audit entry seq=${seq} references foreign contract '${rowContractId}', expected '${contractId}'`,
          seq,
          entityId: eventId,
        });
      }

      // Verify canonical JSON payload
      let parsedPayload: Record<string, unknown> = {};
      let canonicalPayload: string;
      try {
        parsedPayload = JSON.parse(rawPayloadJson);
        canonicalPayload = canonicalizeJson(parsedPayload);
      } catch {
        hashErrorsCount++;
        findings.push({
          category: 'CRYPTOGRAPHIC_INTEGRITY',
          severity: 'ERROR',
          code: 'INVALID_PAYLOAD_JSON',
          message: `Audit entry seq=${seq} contains malformed or unparseable payload JSON.`,
          seq,
          entityId: eventId,
        });
        canonicalPayload = rawPayloadJson;
      }

      if (canonicalPayload !== rawPayloadJson) {
        hashErrorsCount++;
        findings.push({
          category: 'CRYPTOGRAPHIC_INTEGRITY',
          severity: 'ERROR',
          code: 'MODIFIED_PAYLOAD',
          message: `Audit entry seq=${seq} payload JSON is not in canonical form or was altered.`,
          seq,
          entityId: eventId,
        });
      }

      // Recompute and verify entry SHA-256 hash
      const recomputedHash = computeAuditEntryHash({
        seq,
        timestamp: String(row.timestamp),
        actorId: String(row.actor_id),
        actorRole: String(row.actor_role),
        action: String(row.action),
        entityType: String(row.entity_type),
        entityId: String(row.entity_id),
        contractId: rowContractId,
        milestoneId: rowMilestoneId,
        previousState: row.previous_state !== null ? String(row.previous_state) : null,
        newState: row.new_state !== null ? String(row.new_state) : null,
        canonicalPayloadJson: canonicalPayload,
        previousHash: storedPrevHash,
      });

      if (recomputedHash !== storedEntryHash) {
        hashErrorsCount++;
        findings.push({
          category: 'CRYPTOGRAPHIC_INTEGRITY',
          severity: 'ERROR',
          code: 'ENTRY_HASH_MISMATCH',
          message: `Audit entry seq=${seq} recomputed hash does not match stored entry_hash.`,
          seq,
          entityId: eventId,
          details: { storedEntryHash, recomputedHash },
        });
      }

      // Check previous-hash link against preceding row in audit_logs
      if (seq === 1) {
        if (storedPrevHash !== AUDIT_GENESIS_HASH) {
          hashErrorsCount++;
          findings.push({
            category: 'CRYPTOGRAPHIC_INTEGRITY',
            severity: 'ERROR',
            code: 'INVALID_GENESIS_PREVIOUS_HASH',
            message: `Genesis entry seq=1 previous_hash does not match AUDIT_GENESIS_HASH.`,
            seq: 1,
            entityId: eventId,
          });
        }
      } else {
        const priorRow = this.rawDb
          .prepare('SELECT entry_hash FROM audit_logs WHERE seq = ?')
          .get(seq - 1) as { entry_hash: string } | undefined;

        if (!priorRow) {
          hashErrorsCount++;
          findings.push({
            category: 'SEQUENCE_INTEGRITY',
            severity: 'ERROR',
            code: 'SEQUENCE_GAP_DETECTED',
            message: `Missing preceding audit entry with seq=${seq - 1}.`,
            seq,
            entityId: eventId,
          });
        } else if (String(priorRow.entry_hash) !== storedPrevHash) {
          hashErrorsCount++;
          findings.push({
            category: 'CRYPTOGRAPHIC_INTEGRITY',
            severity: 'ERROR',
            code: 'BROKEN_PREVIOUS_HASH_LINK',
            message: `Audit entry seq=${seq} previous_hash does not match entry_hash of seq=${seq - 1}.`,
            seq,
            entityId: eventId,
          });
        }
      }
    }

    // Step E: Verification-Only Mode Early Return
    if (mode === 'VERIFY_ONLY') {
      const isCryptoValid = hashErrorsCount === 0;
      const status: ReplayStatus = isCryptoValid ? 'SUCCESS' : 'CRYPTOGRAPHIC_FAILURE';

      return {
        contractId,
        mode,
        status,
        isCryptographicallyValid: isCryptoValid,
        isLogicallyConsistent: lifecycleErrorsCount === 0,
        totalEventsProcessed: rows.length,
        startSeq,
        endSeq,
        targetSeq: upToSeq,
        verificationSummary: {
          eventsInspected: rows.length,
          chainValid: isCryptoValid,
          hashErrorsCount,
          lifecycleErrorsCount,
          warningsCount: findings.filter((f) => f.severity === 'WARNING').length,
        },
        findings,
        eventOutcomes: [],
        warnings,
      };
    }

    // Step F: Deterministic State Machine Reconstruction
    let reconstructedContract: ReconstructedContractState = {
      id: contractId,
      status: 'DRAFT',
      title: contract.title,
      totalBudgetCents: contract.totalBudgetCents,
      milestoneCount: 0,
      activeMilestones: 0,
      settledMilestones: 0,
      totalSettledCents: 0,
    };

    const reconstructedMilestones = new Map<string, ReconstructedMilestoneState>();
    if (this.milestoneRepo) {
      const dbMilestones = this.milestoneRepo.listByContractId(contractId);
      for (const m of dbMilestones) {
        reconstructedMilestones.set(m.id, {
          id: m.id,
          contractId,
          sequenceOrder: m.sequenceOrder,
          title: m.title,
          agreedAmountCents: m.agreedAmountCents,
          status: 'DRAFT',
          paymentStatus: 'NOT_READY',
          settledAmountCents: 0,
          evidenceSubmissionsCount: 0,
          evaluationsCount: 0,
          approvalsCount: 0,
          historyTransitions: [],
        });
      }
      reconstructedContract.milestoneCount = dbMilestones.length;
    }
    let hasCreationEvent = false;
    let unsupportedEventCount = 0;

    // Track known historical entity IDs to detect missing predecessors
    const knownSubmissions = new Set<string>();
    const knownEvaluations = new Set<string>();
    const knownApprovals = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const seq = Number(row.seq);
      const eventId = String(row.id);
      const timestamp = String(row.timestamp);
      const action = String(row.action);
      const entityType = String(row.entity_type);
      const entityId = String(row.entity_id);
      const milestoneId = row.milestone_id !== null ? String(row.milestone_id) : null;
      const previousState = row.previous_state !== null ? String(row.previous_state) : null;
      const newState = row.new_state !== null ? String(row.new_state) : null;

      let parsedPayload: Record<string, unknown> = {};
      try {
        parsedPayload = JSON.parse(String(row.payload_json ?? '{}'));
      } catch {
        parsedPayload = {};
      }

      const eventFindings: string[] = [];
      let applied = false;

      // 1. Identify Unsupported Event Types without inventing behavior
      if (!SUPPORTED_AUDIT_ACTIONS.has(action)) {
        unsupportedEventCount++;
        const warnMsg = `Unsupported audit event action '${action}' encountered at seq=${seq}; skipping state mutation.`;
        warnings.push(warnMsg);
        eventFindings.push(warnMsg);
        findings.push({
          category: 'UNSUPPORTED_EVENT',
          severity: 'WARNING',
          code: 'UNSUPPORTED_EVENT_TYPE',
          message: warnMsg,
          seq,
          entityId,
          details: { action, entityType },
        });

        eventOutcomes.push({
          seq,
          id: eventId,
          timestamp,
          action,
          entityType,
          entityId,
          applied: false,
          previousState,
          newState,
          findings: eventFindings,
        });
        continue;
      }

      // 2. Process Supported Actions
      switch (action) {
        case 'CONTRACT_CREATED':
        case 'CONTRACT_SEED_INITIALIZED': {
          if (hasCreationEvent) {
            lifecycleErrorsCount++;
            const errMsg = `Duplicate contract creation event at seq=${seq} for contract '${contractId}'.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'LIFECYCLE_TRANSITION',
              severity: 'ERROR',
              code: 'DUPLICATE_EVENT_APPLICATION',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            hasCreationEvent = true;
            applied = true;
            reconstructedContract.status = 'DRAFT';
            if (typeof parsedPayload.title === 'string') {
              reconstructedContract.title = parsedPayload.title;
            }
            if (typeof parsedPayload.totalBudgetCents === 'number') {
              reconstructedContract.totalBudgetCents = parsedPayload.totalBudgetCents;
            }

            // If initial milestones are embedded in payload
            if (Array.isArray(parsedPayload.milestones)) {
              for (const m of parsedPayload.milestones) {
                if (m && typeof m === 'object') {
                  const mObj = m as Record<string, unknown>;
                  const mId = String(mObj.id ?? `ms_${crypto.randomUUID()}`);
                  reconstructedMilestones.set(mId, {
                    id: mId,
                    contractId,
                    sequenceOrder: Number(mObj.sequenceOrder ?? 1),
                    title: String(mObj.title ?? 'Milestone'),
                    agreedAmountCents: Number(mObj.agreedAmountCents ?? 0),
                    status: 'DRAFT',
                    paymentStatus: 'NOT_READY',
                    settledAmountCents: 0,
                    evidenceSubmissionsCount: 0,
                    evaluationsCount: 0,
                    approvalsCount: 0,
                    historyTransitions: [
                      { seq, action, from: null, to: 'DRAFT', timestamp },
                    ],
                  });
                }
              }
              reconstructedContract.milestoneCount = reconstructedMilestones.size;
            }
          }
          break;
        }

        case 'CONTRACT_ACTIVATED': {
          if (!hasCreationEvent) {
            lifecycleErrorsCount++;
            const errMsg = `Contract activation at seq=${seq} missing predecessor CONTRACT_CREATED event.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'PREDECESSOR_DEPENDENCY',
              severity: 'ERROR',
              code: 'MISSING_PREDECESSOR',
              message: errMsg,
              seq,
              entityId,
            });
          } else if (reconstructedContract.status === 'ACTIVE') {
            lifecycleErrorsCount++;
            const errMsg = `Duplicate contract activation at seq=${seq}; contract is already ACTIVE.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'LIFECYCLE_TRANSITION',
              severity: 'ERROR',
              code: 'DUPLICATE_EVENT_APPLICATION',
              message: errMsg,
              seq,
              entityId,
            });
          } else if (reconstructedContract.status !== 'DRAFT') {
            lifecycleErrorsCount++;
            const errMsg = `Invalid contract transition from '${reconstructedContract.status}' to 'ACTIVE' at seq=${seq}.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'LIFECYCLE_TRANSITION',
              severity: 'ERROR',
              code: 'INVALID_CONTRACT_TRANSITION',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            applied = true;
            reconstructedContract.status = 'ACTIVE';
            reconstructedContract.activatedAt = timestamp;

            // Transition all DRAFT milestones to ACTIVE
            for (const ms of reconstructedMilestones.values()) {
              if (ms.status === 'DRAFT') {
                ms.status = 'ACTIVE';
                ms.historyTransitions.push({
                  seq,
                  action,
                  from: 'DRAFT',
                  to: 'ACTIVE',
                  timestamp,
                });
              }
            }
            reconstructedContract.activeMilestones = reconstructedMilestones.size;
          }
          break;
        }

        case 'EVIDENCE_SUBMITTED': {
          if (!milestoneId) {
            lifecycleErrorsCount++;
            const errMsg = `EVIDENCE_SUBMITTED event at seq=${seq} missing milestoneId.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'ENTITY_REFERENCE',
              severity: 'ERROR',
              code: 'MISSING_MILESTONE_REFERENCE',
              message: errMsg,
              seq,
              entityId,
            });
            break;
          }

          let ms = reconstructedMilestones.get(milestoneId);
          if (!ms) {
            // Lazy register milestone if contract didn't list it in payload
            const initialStatus: MilestoneStatus =
              reconstructedContract.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT';
            ms = {
              id: milestoneId,
              contractId,
              sequenceOrder: reconstructedMilestones.size + 1,
              title: `Milestone ${milestoneId}`,
              agreedAmountCents: 0,
              status: initialStatus,
              paymentStatus: 'NOT_READY',
              settledAmountCents: 0,
              evidenceSubmissionsCount: 0,
              evaluationsCount: 0,
              approvalsCount: 0,
              historyTransitions: [],
            };
            reconstructedMilestones.set(milestoneId, ms);
            reconstructedContract.milestoneCount = reconstructedMilestones.size;
          }

          let hasError = false;
          if (reconstructedContract.status !== 'ACTIVE') {
            hasError = true;
            lifecycleErrorsCount++;
            const errMsg = `Cannot submit evidence at seq=${seq}: contract is in '${reconstructedContract.status}' state (must be ACTIVE).`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'EVENT_ORDERING',
              severity: 'ERROR',
              code: 'IMPOSSIBLE_EVENT_ORDERING',
              message: errMsg,
              seq,
              entityId,
            });
          }

          if (ms.status !== 'ACTIVE' && ms.status !== 'REVISION_REQUESTED') {
            hasError = true;
            lifecycleErrorsCount++;
            const errMsg = `Invalid milestone transition from '${ms.status}' to 'SUBMITTED' at seq=${seq}.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'LIFECYCLE_TRANSITION',
              severity: 'ERROR',
              code: 'INVALID_MILESTONE_TRANSITION',
              message: errMsg,
              seq,
              entityId,
            });
          }

          if (!hasError) {
            applied = true;
            const fromState = ms.status;
            ms.status = 'SUBMITTED';
            ms.latestSubmissionId = entityId;
            ms.evidenceSubmissionsCount++;
            knownSubmissions.add(entityId);
            ms.historyTransitions.push({
              seq,
              action,
              from: fromState,
              to: 'SUBMITTED',
              timestamp,
            });
          }
          break;
        }

        case 'EVALUATION_STARTED': {
          if (!milestoneId || !reconstructedMilestones.has(milestoneId)) {
            lifecycleErrorsCount++;
            const errMsg = `EVALUATION_STARTED at seq=${seq} references unknown milestone '${milestoneId}'.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'PREDECESSOR_DEPENDENCY',
              severity: 'ERROR',
              code: 'MISSING_PREDECESSOR',
              message: errMsg,
              seq,
              entityId,
            });
            break;
          }

          const ms = reconstructedMilestones.get(milestoneId)!;
          if (ms.status !== 'SUBMITTED') {
            lifecycleErrorsCount++;
            const errMsg = `Impossible event ordering at seq=${seq}: evaluation started on milestone in '${ms.status}' state (must be SUBMITTED).`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'EVENT_ORDERING',
              severity: 'ERROR',
              code: 'IMPOSSIBLE_EVENT_ORDERING',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            applied = true;
            ms.status = 'EVALUATING';
            ms.historyTransitions.push({
              seq,
              action,
              from: 'SUBMITTED',
              to: 'EVALUATING',
              timestamp,
            });
          }
          break;
        }

        case 'EVALUATION_COMPLETED': {
          if (!milestoneId || !reconstructedMilestones.has(milestoneId)) {
            lifecycleErrorsCount++;
            const errMsg = `EVALUATION_COMPLETED at seq=${seq} references unknown milestone '${milestoneId}'.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'PREDECESSOR_DEPENDENCY',
              severity: 'ERROR',
              code: 'MISSING_PREDECESSOR',
              message: errMsg,
              seq,
              entityId,
            });
            break;
          }

          const ms = reconstructedMilestones.get(milestoneId)!;
          if (ms.status !== 'EVALUATING') {
            lifecycleErrorsCount++;
            const errMsg = `Impossible event ordering at seq=${seq}: evaluation completed on milestone in '${ms.status}' state (must be EVALUATING).`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'EVENT_ORDERING',
              severity: 'ERROR',
              code: 'IMPOSSIBLE_EVENT_ORDERING',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            applied = true;
            ms.status = 'PENDING_REVIEW';
            ms.latestEvaluationId = entityId;
            ms.evaluationsCount++;
            knownEvaluations.add(entityId);
            ms.historyTransitions.push({
              seq,
              action,
              from: 'EVALUATING',
              to: 'PENDING_REVIEW',
              timestamp,
            });
          }
          break;
        }

        case 'EVALUATION_FAILED': {
          if (!milestoneId || !reconstructedMilestones.has(milestoneId)) {
            break;
          }
          const ms = reconstructedMilestones.get(milestoneId)!;
          applied = true;
          ms.status = 'SUBMITTED';
          ms.historyTransitions.push({
            seq,
            action,
            from: 'EVALUATING',
            to: 'SUBMITTED',
            timestamp,
          });
          break;
        }

        case 'HUMAN_REVIEW_APPROVED': {
          if (!milestoneId || !reconstructedMilestones.has(milestoneId)) {
            lifecycleErrorsCount++;
            const errMsg = `HUMAN_REVIEW_APPROVED at seq=${seq} references unknown milestone '${milestoneId}'.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'PREDECESSOR_DEPENDENCY',
              severity: 'ERROR',
              code: 'MISSING_PREDECESSOR',
              message: errMsg,
              seq,
              entityId,
            });
            break;
          }

          const ms = reconstructedMilestones.get(milestoneId)!;
          if (ms.status === 'APPROVED' || ms.status === 'SETTLED') {
            lifecycleErrorsCount++;
            const errMsg = `Duplicate milestone approval at seq=${seq}: milestone is already '${ms.status}'.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'LIFECYCLE_TRANSITION',
              severity: 'ERROR',
              code: 'DUPLICATE_EVENT_APPLICATION',
              message: errMsg,
              seq,
              entityId,
            });
          } else if (ms.status !== 'PENDING_REVIEW') {
            lifecycleErrorsCount++;
            const errMsg = `Impossible event ordering at seq=${seq}: milestone approved from '${ms.status}' state (must be PENDING_REVIEW).`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'EVENT_ORDERING',
              severity: 'ERROR',
              code: 'IMPOSSIBLE_EVENT_ORDERING',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            applied = true;
            ms.status = 'APPROVED';
            ms.latestApprovalId = entityId;
            ms.approvalsCount++;
            knownApprovals.add(entityId);
            ms.historyTransitions.push({
              seq,
              action,
              from: 'PENDING_REVIEW',
              to: 'APPROVED',
              timestamp,
            });
          }
          break;
        }

        case 'HUMAN_REVIEW_REJECTED': {
          if (!milestoneId || !reconstructedMilestones.has(milestoneId)) {
            break;
          }
          const ms = reconstructedMilestones.get(milestoneId)!;
          if (ms.status !== 'PENDING_REVIEW') {
            lifecycleErrorsCount++;
            const errMsg = `Invalid rejection transition at seq=${seq}: milestone is in '${ms.status}' state.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'LIFECYCLE_TRANSITION',
              severity: 'ERROR',
              code: 'INVALID_MILESTONE_TRANSITION',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            applied = true;
            ms.status = 'REJECTED';
            ms.historyTransitions.push({
              seq,
              action,
              from: 'PENDING_REVIEW',
              to: 'REJECTED',
              timestamp,
            });
          }
          break;
        }

        case 'HUMAN_REVIEW_CHANGES_REQUESTED': {
          if (!milestoneId || !reconstructedMilestones.has(milestoneId)) {
            break;
          }
          const ms = reconstructedMilestones.get(milestoneId)!;
          if (ms.status !== 'PENDING_REVIEW') {
            lifecycleErrorsCount++;
            const errMsg = `Invalid changes requested transition at seq=${seq}: milestone is in '${ms.status}' state.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'LIFECYCLE_TRANSITION',
              severity: 'ERROR',
              code: 'INVALID_MILESTONE_TRANSITION',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            applied = true;
            ms.status = 'REVISION_REQUESTED';
            ms.historyTransitions.push({
              seq,
              action,
              from: 'PENDING_REVIEW',
              to: 'REVISION_REQUESTED',
              timestamp,
            });
          }
          break;
        }

        case 'PAYPAL_ORDER_CREATED':
        case 'PAYPAL_SIMULATED_ORDER_CREATED': {
          // Strictly descriptive: does not trigger PayPal
          if (milestoneId && reconstructedMilestones.has(milestoneId)) {
            const ms = reconstructedMilestones.get(milestoneId)!;
            applied = true;
            ms.paymentStatus = action.includes('SIMULATED') ? 'SIMULATED_ORDER_CREATED' : 'ORDER_CREATED';
            if (typeof parsedPayload.paypalOrderId === 'string') {
              ms.paypalOrderId = parsedPayload.paypalOrderId;
            }
          }
          break;
        }

        case 'PAYPAL_ORDER_AUTHORIZED':
        case 'PAYPAL_SIMULATED_ORDER_AUTHORIZED': {
          // Strictly descriptive
          if (milestoneId && reconstructedMilestones.has(milestoneId)) {
            const ms = reconstructedMilestones.get(milestoneId)!;
            applied = true;
            ms.paymentStatus = action.includes('SIMULATED') ? 'SIMULATED_AUTHORIZED' : 'AUTHORIZED';
          }
          break;
        }

        case 'PAYPAL_AUTHORIZATION_CAPTURED':
        case 'PAYPAL_SIMULATED_CAPTURE_RECORDED': {
          // Strictly descriptive: historical event verification only
          if (!milestoneId || !reconstructedMilestones.has(milestoneId)) {
            lifecycleErrorsCount++;
            const errMsg = `Payment capture event at seq=${seq} references unknown milestone '${milestoneId}'.`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'PREDECESSOR_DEPENDENCY',
              severity: 'ERROR',
              code: 'MISSING_PREDECESSOR',
              message: errMsg,
              seq,
              entityId,
            });
            break;
          }

          const ms = reconstructedMilestones.get(milestoneId)!;
          if (ms.status !== 'APPROVED') {
            lifecycleErrorsCount++;
            const errMsg = `Impossible event ordering at seq=${seq}: payment captured on unapproved milestone (status '${ms.status}').`;
            eventFindings.push(errMsg);
            findings.push({
              category: 'EVENT_ORDERING',
              severity: 'ERROR',
              code: 'IMPOSSIBLE_EVENT_ORDERING',
              message: errMsg,
              seq,
              entityId,
            });
          } else {
            applied = true;
            const captureCents = Number(parsedPayload.capturedAmountCents ?? ms.agreedAmountCents ?? 0);
            ms.paymentStatus = action.includes('SIMULATED') ? 'SIMULATED_CAPTURED' : 'CAPTURED';
            ms.status = 'SETTLED';
            ms.settledAmountCents = captureCents;
            reconstructedContract.settledMilestones++;
            reconstructedContract.totalSettledCents += captureCents;

            ms.historyTransitions.push({
              seq,
              action,
              from: 'APPROVED',
              to: 'SETTLED',
              timestamp,
            });

            // Check if all milestones are settled
            const allSettled = Array.from(reconstructedMilestones.values()).every(
              (m) => m.status === 'SETTLED'
            );
            if (allSettled && reconstructedMilestones.size > 0) {
              reconstructedContract.status = 'COMPLETED';
              reconstructedContract.completedAt = timestamp;
            }
          }
          break;
        }

        default: {
          // Informational events: webhooks, schedule proposals, etc.
          applied = true;
          break;
        }
      }

      eventOutcomes.push({
        seq,
        id: eventId,
        timestamp,
        action,
        entityType,
        entityId,
        applied,
        previousState,
        newState,
        findings: eventFindings,
      });
    }

    // Step G: Determine Overall Replay Status
    const isCryptoValid = hashErrorsCount === 0;
    const isLogicValid = lifecycleErrorsCount === 0;

    let finalStatus: ReplayStatus;
    if (!isCryptoValid) {
      finalStatus = 'CRYPTOGRAPHIC_FAILURE';
    } else if (!hasCreationEvent && rows.length > 0) {
      finalStatus = 'INCOMPLETE_HISTORY';
      findings.push({
        category: 'PREDECESSOR_DEPENDENCY',
        severity: 'ERROR',
        code: 'MISSING_INITIAL_STATE',
        message: `Audit history for contract '${contractId}' is incomplete: no CONTRACT_CREATED genesis event found.`,
      });
    } else if (!isLogicValid) {
      finalStatus = 'LIFECYCLE_INCONSISTENCY';
    } else if (unsupportedEventCount > 0) {
      finalStatus = 'UNSUPPORTED_EVENTS_DETECTED';
    } else {
      finalStatus = 'SUCCESS';
    }

    const milestoneRecord: Record<string, ReconstructedMilestoneState> = {};
    for (const [id, ms] of reconstructedMilestones.entries()) {
      milestoneRecord[id] = ms;
    }

    return {
      contractId,
      mode,
      status: finalStatus,
      isCryptographicallyValid: isCryptoValid,
      isLogicallyConsistent: isLogicValid && hasCreationEvent,
      totalEventsProcessed: rows.length,
      startSeq,
      endSeq,
      targetSeq: upToSeq,
      verificationSummary: {
        eventsInspected: rows.length,
        chainValid: isCryptoValid,
        hashErrorsCount,
        lifecycleErrorsCount,
        warningsCount: findings.filter((f) => f.severity === 'WARNING').length,
      },
      findings,
      eventOutcomes,
      reconstructedState: {
        contract: reconstructedContract,
        milestones: milestoneRecord,
      },
      warnings,
    };
  }

  /**
   * Convenience method to run audit verification in VERIFY_ONLY mode.
   */
  public verifyContractAudit(contractId: string): AuditReplayResult {
    return this.replayContractAudit({ contractId, mode: 'VERIFY_ONLY' });
  }
}
