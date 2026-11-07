import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type {
  AuditActorRole,
  AuditChainVerificationResult,
  AuditLogEntry,
} from '../../types/domain.ts';

/**
 * Known deterministic Genesis Hash for the MilestoneProof AI tamper-evident audit chain.
 */
export const AUDIT_GENESIS_HASH = crypto
  .createHash('sha256')
  .update('MILESTONEPROOF_AI_AUDIT_GENESIS_V1', 'utf8')
  .digest('hex');

/**
 * Recursively sorts object keys lexicographically to produce a deterministic
 * canonical JSON string (RFC 8785 style key ordering).
 */
export function canonicalizeJson(value: unknown): string {
  const normalize = (val: unknown): unknown => {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(normalize);
    }
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const propVal = (val as Record<string, unknown>)[key];
      if (propVal !== undefined) {
        result[key] = normalize(propVal);
      }
    }
    return result;
  };

  return JSON.stringify(normalize(value ?? {}));
}

export interface AppendAuditParams {
  actorId: string;
  actorRole: AuditActorRole;
  action: string;
  entityType: AuditLogEntry['entityType'];
  entityId: string;
  contractId?: string | null;
  milestoneId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export function computeAuditEntryHash(params: {
  seq: number;
  timestamp: string;
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  contractId: string | null;
  milestoneId: string | null;
  previousState: string | null;
  newState: string | null;
  canonicalPayloadJson: string;
  previousHash: string;
}): string {
  const preimage = [
    String(params.seq),
    params.timestamp,
    params.actorId,
    params.actorRole,
    params.action,
    params.entityType,
    params.entityId,
    params.contractId ?? '',
    params.milestoneId ?? '',
    params.previousState ?? '',
    params.newState ?? '',
    params.canonicalPayloadJson,
    params.previousHash,
  ].join('|');

  return crypto.createHash('sha256').update(preimage, 'utf8').digest('hex');
}

/**
 * Tamper-evident hash-chained AuditService.
 * Note: Because audit_logs resides in the same SQLite database as application data,
 * this chain is tamper-evident against accidental corruption or single-row edits/deletions,
 * not tamper-proof against a privileged attacker who rewrites the entire SQLite file.
 */
export class AuditService {
  private readonly rawDb: DatabaseSync;

  constructor(rawDb: DatabaseSync) {
    this.rawDb = rawDb;
  }

  /**
   * Appends a hash-chained audit entry. Must be called inside an active
   * BEGIN IMMEDIATE transaction alongside the domain mutation so domain state
   * and audit history commit or roll back atomically.
   */
  public appendWithinTx(params: AppendAuditParams): AuditLogEntry {
    const lastRow = this.rawDb
      .prepare('SELECT seq, entry_hash FROM audit_logs ORDER BY seq DESC LIMIT 1')
      .get() as { seq: number; entry_hash: string } | undefined;

    const nextSeq = lastRow ? Number(lastRow.seq) + 1 : 1;
    const previousHash = lastRow ? String(lastRow.entry_hash) : AUDIT_GENESIS_HASH;
    const id = `aud_${crypto.randomUUID()}`;
    const timestamp = params.timestamp ?? new Date().toISOString();
    const contractId = params.contractId ?? null;
    const milestoneId = params.milestoneId ?? null;
    const previousState = params.previousState ?? null;
    const newState = params.newState ?? null;
    const payload = params.payload ?? {};
    const canonicalPayloadJson = canonicalizeJson(payload);

    const entryHash = computeAuditEntryHash({
      seq: nextSeq,
      timestamp,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      contractId,
      milestoneId,
      previousState,
      newState,
      canonicalPayloadJson,
      previousHash,
    });

    this.rawDb
      .prepare(
        `INSERT INTO audit_logs (
          seq, id, timestamp, actor_id, actor_role, action,
          entity_type, entity_id, contract_id, milestone_id,
          previous_state, new_state, payload_json, previous_hash, entry_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nextSeq,
        id,
        timestamp,
        params.actorId,
        params.actorRole,
        params.action,
        params.entityType,
        params.entityId,
        contractId,
        milestoneId,
        previousState,
        newState,
        canonicalPayloadJson,
        previousHash,
        entryHash
      );

    return {
      seq: nextSeq,
      id,
      timestamp,
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      contractId,
      milestoneId,
      previousState,
      newState,
      payload,
      previousHash,
      entryHash,
    };
  }

  public listLogs(filters?: {
    contractId?: string;
    milestoneId?: string;
    entityId?: string;
  }): AuditLogEntry[] {
    const clauses: string[] = [];
    const args: (string | number)[] = [];

    if (filters?.contractId) {
      clauses.push('contract_id = ?');
      args.push(filters.contractId);
    }
    if (filters?.milestoneId) {
      clauses.push('milestone_id = ?');
      args.push(filters.milestoneId);
    }
    if (filters?.entityId) {
      clauses.push('entity_id = ?');
      args.push(filters.entityId);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.rawDb
      .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY seq ASC`)
      .all(...args);

    return rows.map((r) => ({
      seq: Number(r.seq),
      id: String(r.id),
      timestamp: String(r.timestamp),
      actorId: String(r.actor_id),
      actorRole: String(r.actor_role) as AuditActorRole,
      action: String(r.action),
      entityType: String(r.entity_type) as AuditLogEntry['entityType'],
      entityId: String(r.entity_id),
      contractId: r.contract_id !== null ? String(r.contract_id) : null,
      milestoneId: r.milestone_id !== null ? String(r.milestone_id) : null,
      previousState: r.previous_state !== null ? String(r.previous_state) : null,
      newState: r.new_state !== null ? String(r.new_state) : null,
      payload: JSON.parse(String(r.payload_json)) as Record<string, unknown>,
      previousHash: String(r.previous_hash),
      entryHash: String(r.entry_hash),
    }));
  }

  /**
   * Verifies the entire audit chain from seq=1 through head.
   * Detects missing genesis, sequence gaps (deleted rows), broken hash links (reordered rows),
   * and altered column/payload values.
   */
  public verifyChain(): AuditChainVerificationResult {
    const rows = this.rawDb
      .prepare('SELECT * FROM audit_logs ORDER BY seq ASC')
      .all();

    if (rows.length === 0) {
      return {
        valid: true,
        verifiedCount: 0,
        genesisHash: AUDIT_GENESIS_HASH,
        headHash: AUDIT_GENESIS_HASH,
      };
    }

    let expectedSeq = 1;
    let expectedPreviousHash = AUDIT_GENESIS_HASH;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const seq = Number(row.seq);
      const storedPrevHash = String(row.previous_hash);
      const storedEntryHash = String(row.entry_hash);

      if (i === 0 && seq !== 1) {
        return {
          valid: false,
          verifiedCount: 0,
          genesisHash: AUDIT_GENESIS_HASH,
          headHash: storedEntryHash,
          failedSeq: seq,
          reason: 'MISSING_GENESIS_ENTRY',
          details: `First audit entry has seq=${seq} instead of 1.`,
        };
      }

      if (seq !== expectedSeq) {
        return {
          valid: false,
          verifiedCount: i,
          genesisHash: AUDIT_GENESIS_HASH,
          headHash: storedEntryHash,
          failedSeq: seq,
          reason: 'SEQUENCE_GAP_DETECTED',
          details: `Expected contiguous seq=${expectedSeq} but found seq=${seq} (entry missing or deleted).`,
        };
      }

      if (i === 0 && storedPrevHash !== AUDIT_GENESIS_HASH) {
        return {
          valid: false,
          verifiedCount: 0,
          genesisHash: AUDIT_GENESIS_HASH,
          headHash: storedEntryHash,
          failedSeq: 1,
          reason: 'INVALID_GENESIS_PREVIOUS_HASH',
          details: 'Genesis entry previous_hash does not match AUDIT_GENESIS_HASH.',
        };
      }

      if (storedPrevHash !== expectedPreviousHash) {
        return {
          valid: false,
          verifiedCount: i,
          genesisHash: AUDIT_GENESIS_HASH,
          headHash: storedEntryHash,
          failedSeq: seq,
          reason: 'BROKEN_PREVIOUS_HASH_LINK',
          details: `Entry seq=${seq} previous_hash does not match prior entry_hash (possible reordering or link corruption).`,
        };
      }

      let canonicalPayload: string;
      try {
        const parsed = JSON.parse(String(row.payload_json));
        canonicalPayload = canonicalizeJson(parsed);
      } catch {
        return {
          valid: false,
          verifiedCount: i,
          genesisHash: AUDIT_GENESIS_HASH,
          headHash: storedEntryHash,
          failedSeq: seq,
          reason: 'INVALID_PAYLOAD_JSON',
          details: `Entry seq=${seq} contains malformed payload_json.`,
        };
      }

      if (canonicalPayload !== String(row.payload_json)) {
        return {
          valid: false,
          verifiedCount: i,
          genesisHash: AUDIT_GENESIS_HASH,
          headHash: storedEntryHash,
          failedSeq: seq,
          reason: 'ENTRY_HASH_MISMATCH',
          details: `Entry seq=${seq} payload_json is not in canonical form or was modified.`,
        };
      }

      const recomputedHash = computeAuditEntryHash({
        seq,
        timestamp: String(row.timestamp),
        actorId: String(row.actor_id),
        actorRole: String(row.actor_role),
        action: String(row.action),
        entityType: String(row.entity_type),
        entityId: String(row.entity_id),
        contractId: row.contract_id !== null ? String(row.contract_id) : null,
        milestoneId: row.milestone_id !== null ? String(row.milestone_id) : null,
        previousState: row.previous_state !== null ? String(row.previous_state) : null,
        newState: row.new_state !== null ? String(row.new_state) : null,
        canonicalPayloadJson: canonicalPayload,
        previousHash: storedPrevHash,
      });

      if (recomputedHash !== storedEntryHash) {
        return {
          valid: false,
          verifiedCount: i,
          genesisHash: AUDIT_GENESIS_HASH,
          headHash: storedEntryHash,
          failedSeq: seq,
          reason: 'ENTRY_HASH_MISMATCH',
          details: `Entry seq=${seq} recomputed SHA-256 hash does not match stored entry_hash.`,
        };
      }

      expectedSeq = seq + 1;
      expectedPreviousHash = storedEntryHash;
    }

    return {
      valid: true,
      verifiedCount: rows.length,
      genesisHash: AUDIT_GENESIS_HASH,
      headHash: expectedPreviousHash,
    };
  }
}
