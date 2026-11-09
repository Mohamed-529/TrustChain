# PROMPT 7/8 — TrustChain Failure Recovery Matrix & Disaster Playbook

**Repository:** `Mohamed-529/TrustChain`  
**Working Directory:** `C:/Users/ADMIN/Downloads/milestoneproof-ai`  
**Branch:** `main`  
**Execution Date:** 2026-11-09  

---

## 1. Failure Scenarios & Recovery Procedures

This matrix provides operational playbooks and architectural guardrails for handling systemic failures, network anomalies, and edge cases in production.

| Failure Mode | Root Cause | Immediate System Behavior | Automated Recovery Action | Manual Operator Playbook |
| :--- | :--- | :--- | :--- | :--- |
| **PayPal Gateway Capture Timeout** | Network latency or PayPal internal outage during capture HTTP call | Server catches timeout; sets status to `REQUIRES_RECONCILIATION`; sets `requiresReconciliation = true`; blocks duplicate capture attempts. | Re-capture is strictly disabled to prevent double-charging. System awaits authoritative reconciliation query. | Operator clicks "Reconcile Payment" or calls `POST /api/v1/milestones/:id/paypal/reconcile`. Backend queries PayPal for remote status and resolves state to `CAPTURED` or `FAILED`. |
| **Duplicate Webhook Ingestion** | PayPal retries delivery or webhook replay attack | First request locks event ID in memory and database; second request detects existing record in `paypal_webhook_events`. | Second request returns `DUPLICATE_IGNORED` or `ALREADY_PROCESSED` with HTTP 200 without repeating financial side effects. | No operator intervention required. Audit log contains canonical record of both delivery attempts. |
| **Out-of-Order Webhook Delivery** | `AUTHORIZATION.VOIDED` webhook arrives after payment has already been `CAPTURED` | State-machine validation detects terminal `CAPTURED` status. | Protects terminal state; emits `TERMINAL_STATE_PRESERVED`; ignores rollback to `VOIDED`. | No operator intervention required. Terminal financial state remains immutable. |
| **Expired 29-Day Authorization Hold** | Human approval delayed past PayPal's 29-day authorization validity window | Capture handler checks `latestTx.authExpiresAt <= now`. | Throws HTTP 422 `PAYPAL_AUTHORIZATION_EXPIRED`; marks milestone payment status as `EXPIRED`. | Client must initiate a fresh PayPal authorization order (`POST /api/v1/milestones/:id/paypal/create-order`). |
| **Unsolicited External Capture on Hold** | Third party captures funds directly on PayPal dashboard without TrustChain approval | Inbound webhook verifies signature but finds milestone lacking human `APPROVE` decision. | Flags transaction as `UNSOLICITED_REMOTE_CAPTURE_FLAGGED`; quarantines funds; refuses to mark milestone `SETTLED`. | Reviewer investigates outside capture in dispute center. If legitimate, human review decision can be recorded. |
| **Abrupt Node.js Process Crash / SIGTERM** | Host reboot, OOM, or container re-deployment | Operating system signal triggers graceful shutdown handler. | `server.close()` stops traffic; `db.checkpointWal('TRUNCATE')` flushes WAL to SQLite disk; `db.close()` terminates cleanly. | Container orchestrator restarts service. Readiness probe `/api/v1/ready` verifies DB integrity before routing traffic. |
| **SQLite Lock Contention (`SQLITE_BUSY`)** | Multiple heavy background writes occur simultaneously | Engine holds connection for up to 5,000ms (`PRAGMA busy_timeout = 5000`). | In-flight transactions complete sequentially. Zero unhandled aborts. | If contention persists, check for long-running manual DB operations. |
| **Cryptographic Audit Ledger Corruption** | Malicious DB row update or disk bit-rot altering audit log | Replay verification computes SHA-256 hash mismatch. | Replay engine reports `valid: false` with exact sequence number of the corrupted row; blocks further automatic transitions. | Forensically inspect corrupted sequence row against disk backups and git commit audit logs. |

---

## 2. Disaster Recovery & Backup Runbook

### 2.1 Online SQLite Backup
To back up TrustChain without taking the application offline:
```bash
# Execute safe VACUUM INTO backup while SQLite is running in WAL mode
sqlite3 data/milestoneproof.sqlite "VACUUM INTO 'backups/milestoneproof_backup_$(date +%Y%m%d_%H%M%S).sqlite';"
```

### 2.2 WAL Checkpoint Verification
To verify Write-Ahead Log status and execute an explicit flush:
```bash
sqlite3 data/milestoneproof.sqlite "PRAGMA wal_checkpoint(TRUNCATE);"
```

### 2.3 Ledger Cryptographic Verification
To verify the complete cryptographic integrity of the ledger:
```bash
curl -X GET http://localhost:3000/api/v1/audit/verify \
  -H "Authorization: Bearer <TOKEN>"
# Expected output: {"valid": true, "totalRecords": 91, "chainHead": "..."}
```

---

## 3. Resiliency Guarantee

With these playbooks and automated invariants in place, TrustChain satisfies the highest standards of financial determinism, operational survivability, and explainable audit recovery.
