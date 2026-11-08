# Evidence Passport Security Review — TrustChain (MilestoneProof AI)

**Phase / Deliverable:** Prompt 2/8 — Evidence Passport Security Review  
**Workspace:** Google Antigravity  
**Repository:** `Mohamed-529/TrustChain`  
**Review Status:** Approved, Hardened & Audited  

---

## 1. Threat Modeling & Scope

The Evidence Passport aggregates engineering evidence from external and potentially untrusted sources (developer commit logs, GitHub Actions workflows, third-party URLs, build artifacts). 

The security boundaries evaluated include:
1. **Server-Side Request Forgery (SSRF) via Runtime Validation URLs & Redirect Targets**
2. **Untrusted Commit & Contributor Identity Spoofing**
3. **CI/CD Execution Spoofing & Foreign Commit Execution**
4. **Adversarial Prompt Injection in Evidence Metadata**
5. **Post-Submission Evidence & Passport Tampering (SQLite)**
6. **Authorization & RBAC Enforcement on Passport Endpoints**
7. **Financial Authority Boundary Violations**

---

## 2. Threat Analysis & Implemented Mitigations

### 2.1 Server-Side Request Forgery (SSRF) Mitigations

*Threat:* A malicious developer submits a preview URL pointing to internal infrastructure (e.g. `http://169.254.169.254/latest/meta-data/` or `http://127.0.0.1:8080/internal-admin`) or uses an external server that issues an HTTP 302 redirect to an internal IP address to extract cloud credentials or probe backend services.

*Mitigation:*
- All preview URLs are filtered prior to HTTP request initiation by `isPrivateOrBlockedIp(ipOrHost)`.
- Explicit IP address ranges and internal identifiers blocked:
  - IPv4 Loopback (`127.0.0.0/8`, `0.0.0.0/8`)
  - IPv6 Loopback (`::1`, `fe80::/10`, `fc00::/7`)
  - RFC 1918 Private Ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Carrier Grade NAT (`100.64.0.0/10`)
  - Link-Local Subnet (`169.254.0.0/16`)
  - Cloud Metadata Endpoints (`169.254.169.254`, `metadata.google.internal`)
  - Local hostnames (`localhost`, `*.local`, `*.internal`)
- Non-HTTP(S) protocols (`file:`, `ftp:`, `gopher:`, `data:`) are rejected immediately.
- Redirect hops are constrained with `redirect: 'manual'` (native automatic redirect following is disabled).
- Every redirect destination `Location` header is parsed and submitted to full DNS resolution and `isPrivateOrBlockedIp` inspection before being processed.
- Enforced request timeout (3,000 ms) and manual abort signals prevent slowloris attacks.

### 2.2 Endpoint Authorization & RBAC Enforcement

*Threat:* An authenticated user belonging to Contract A queries the Evidence Passport or triggers runtime validation smoke tests against Contract B, accessing private repository telemetry or internal URLs.

*Mitigation:*
- Both `getEvidencePassport` and `validateRuntime` in `EvidenceController` enforce contract-party RBAC checks (`FORBIDDEN_NOT_CONTRACT_PARTY`).
- Only users who match the contract's `clientId`, `developerId`, or `reviewerId` are permitted to retrieve the passport or execute runtime checks.
- Unassigned actors or callers referencing invalid contract/milestone pairs receive HTTP 403 or 404 respectively.

### 2.3 Post-Submission Tampering & Immutable Audit Anchoring

*Threat:* An attacker with database access alters passport JSON data in SQLite (e.g. modifying an evidence node in `graph.nodes`, forging an edge, or altering criteria mapping status from FAILED to VERIFIED).

*Mitigation:*
- Every generated passport is anchored to the immutable SQLite audit chain with an `EVIDENCE_PASSPORT_GENERATED` event entry inside an atomic SQLite `withTransaction` block.
- The resulting `entry_hash` is recorded in `passport.settlementAuditTrace.auditEventReferences`.
- The top-level canonical digest (`passportDigestSha256`) commits to all passport payload fields.
- Upon retrieval, `getPassport` invokes `verifyPassportIntegrity(passport, storedDigest)`. If any node, edge, criterion, or hash column has been modified, `isCryptographicallyValid` is set to `false` and `overallStatus` becomes `FAILED`.

### 2.4 CI/CD Telemetry Integrity & Foreign Commit Guard

*Threat:* A developer triggers a CI run on a dummy branch or benign commit, then submits the successful workflow run URL alongside a different, unverified commit.

*Mitigation:*
- The Evidence Passport compares `ciReport.runCommitSha` directly against `submission.commitSha`.
- If the workflow ran on a foreign commit, `ciCd.commitMatchesSource` is set to `false`, `ciCd.verificationStatus` becomes `FAILED`, and the overall passport status is flagged as `FAILED`.

### 2.5 Commit Signature Semantics & Limitations

*Threat:* A committer claims a commit is trusted merely because it possesses a valid GPG/SSH signature.

*Mitigation:*
- The Evidence Passport clearly distinguishes:
  - `VERIFIED`: Signature was verified by GitHub against a known key.
  - `UNVERIFIED`: Normal unsigned commit (permitted by default, but visibly flagged).
  - `INVALID`: Key expired, revoked, or signature corrupted.
  - `UNSUPPORTED`: Unrecognized algorithm.
  - `UNAVAILABLE`: Signature service unreachable.
- Security Limitation Notice: The UI and passport explicitly document that commit signatures attest solely to *author identity* (key possession), not code safety, quality, or lack of backdoors.

### 2.6 Financial Invariants & Read-Only Safety

*Threat:* Generation or validation of the Evidence Passport triggers automated payment capture, void, or settlement.

*Mitigation:*
- Evidence Passport generation is 100% read-only with zero database mutations on contracts, milestones, or payments.
- AI agents and Evidence Passport services have no access to PayPal payment execution APIs.
- Human approval is mandatory before any settlement transaction can be executed by the client.

---

## 3. Residual Risks & Production Hardening Recommendations

1. **DNS Rebinding (TOCTOU) Socket Pinning:** In production cloud deployments where untrusted external URLs are queried, perform DNS resolution prior to socket connection and pin the TCP socket directly to the validated IP address (via a custom Node.js `http.Agent.createConnection` or an egress proxy) to completely eliminate time-of-check to time-of-use DNS rebinding.
2. **Egress Network Segmentation:** For runtime smoke tests against developer-provided preview URLs, dispatch HTTP requests from an egress-isolated worker container with no route to the TrustChain private VPC or internal databases.
3. **Key Transparency & Sigstore Integration:** For production release verification, integrate Sigstore / Rekor transparency log queries to provide keyless cryptographic attestations of developer identity.
