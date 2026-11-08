# Evidence Passport Security Review — TrustChain (MilestoneProof AI)

**Phase / Deliverable:** Prompt 2/8 — Evidence Passport Adversarial Security Review & Hardening  
**Workspace:** Google Antigravity  
**Repository:** `Mohamed-529/TrustChain`  
**Review Status:** Approved, Adversarially Hardened & Cryptographically Verified  

---

## 1. Adversarial Security Findings & Classifications

| ID | Severity | Category | Description | Mitigation Status |
|:---|:---|:---|:---|:---|
| **SEC-01** | **Medium** | SSRF Filter Bypass | Hex-encoded IPv4-mapped IPv6 addresses (e.g. `::ffff:7f00:1`, `::ffff:a00:1`) bypassed string/quad IPv4 filters. | **RESOLVED** (`parseIpv4MappedIpv6` parses both dotted-quad and hex words into standard octets before validation). |
| **SEC-02** | **Low** | SSRF Fall-Through | Empty DNS resolution response (`[]`) fell through without explicit rejection. | **RESOLVED** (Explicit DNS empty-answer guard added, marking validation as `FAILED` under `DNS_RESOLUTION_CHECK`). |
| **SEC-03** | **Low** | Resource Hygiene | HTTP/HTTPS custom agent sockets lacked explicit `agent.destroy()` on completion/timeout. | **RESOLVED** (`keepAlive: false` enforced and `agent.destroy()` invoked on `end`, `error`, `timeout`, and `close`). |
| **SEC-04** | **Medium** | Redirect Protocol Abuse | Redirect target schemes beyond HTTP/HTTPS (e.g. `file:`, `gopher:`) or malformed location headers could trigger undefined client behaviors. | **RESOLVED** (Strict scheme whitelist `['http:', 'https:']` and malformed URL parsing guards added to redirect handler). |
| **SEC-05** | **Low** | Cryptographic Ordering | Audit anchoring circular dependency risk between passport digest and audit entry hash. | **RESOLVED** (Deterministic 2-stage hashing: `passportContentDigestSha256` anchored in immutable audit payload, followed by final `passportDigestSha256` committing to complete record). |

---

## 2. Threat Modeling & Scope

The Evidence Passport aggregates engineering evidence from external and potentially untrusted sources (developer commit logs, GitHub Actions workflows, third-party preview URLs, build artifacts). 

The security boundaries evaluated and verified include:
1. **Server-Side Request Forgery (SSRF) & DNS Rebinding (TOCTOU) via Runtime Validation**
2. **Passport Digest & Audit Reference Ordering (Circular Dependency Prevention)**
3. **Post-Submission Evidence & Passport Graph Tampering (SQLite)**
4. **Endpoint Authorization & RBAC Enforcement on Passport Endpoints**
5. **Untrusted Commit & Contributor Identity Spoofing**
6. **CI/CD Execution Spoofing & Foreign Commit Execution**
7. **Financial Authority Boundary Violations**

---

## 3. Threat Analysis & Implemented Mitigations

### 3.1 Server-Side Request Forgery (SSRF) & DNS Rebinding (TOCTOU) Mitigations

*Threat:* A malicious developer configures a domain with zero TTL (`TTL=0`) pointing to a public IP on initial DNS check, which immediately switches to an internal IP (e.g. `127.0.0.1` or `169.254.169.254`) on HTTP connect, or issues an HTTP 302 redirect to internal cloud metadata or non-HTTP protocols.

*Verified Mitigation:*
1. **Socket-Level IP-Pinning:**
   Runtime validation executes via an IP-pinned socket dispatcher (`executeSafePinnedHttpRequest`):
   - Pre-flight DNS resolution inspects all resolved records (`dns.promises.lookup(hostname, { all: true })`).
   - If any resolved IP belongs to a private, loopback, or cloud-metadata range, the request is immediately blocked.
   - The first validated IP is pinned (`pinnedIp`).
   - The custom socket lookup agent (`createPinnedLookup(pinnedIp)`) forces the TCP connection to connect strictly to `pinnedIp`. The OS/runtime never executes a second DNS query at connect time, eliminating the TOCTOU / DNS rebinding window.
2. **Hex-Encoded IPv4-Mapped IPv6 Parser:**
   - Both dotted-quad (`::ffff:127.0.0.1`) and hex-word (`::ffff:7f00:1`, `::ffff:a00:1`, `::ffff:a9fe:a9fe`) formats are parsed into 4 decimal octets.
   - Any address in loopback, RFC 1918, RFC 3927, or cloud metadata is strictly rejected.
3. **TLS Hostname & Certificate Integrity:**
   - Server Name Indication (`servername: targetUrl.hostname`) is preserved.
   - Node.js default TLS certificate validation (`checkServerIdentity` against `targetUrl.hostname`, not the IP) is strictly enforced.
   - Mismatched or forged certificates are rejected by TLS verification.
4. **Redirect Destination Pre-Validation & Scheme Whitelisting:**
   - Automatic redirect following is disabled (`redirect: 'manual'`).
   - Every redirect destination `Location` header is parsed and inspected:
     - Disallowed protocols (`file:`, `gopher:`, `ftp:`) are rejected.
     - Blocked hostnames (`localhost`, `metadata.google.internal`, `*.local`, `*.internal`) are rejected.
     - Destination hostname undergoes DNS resolution; if any resolved IP is in restricted address space, the redirect is blocked.
5. **Explicit IP Address Ranges Blocked:**
   - IPv4 Loopback (`127.0.0.0/8`, `0.0.0.0/8`)
   - IPv6 Loopback (`::1`, `fe80::/10`, `fc00::/7`)
   - IPv4-mapped & IPv4-compatible IPv6 in dotted and hex formats
   - RFC 1918 Private Ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
   - Carrier Grade NAT (`100.64.0.0/10`)
   - Link-Local & Cloud Metadata (`169.254.0.0/16`, `169.254.169.254`)

### 3.2 Passport Digest & Audit Reference Ordering (Zero Circular Hashing)

*Threat:* A circular dependency between passport digest calculation and audit event logging leading to inconsistent or unverified state.

*Verified Mitigation:*
1. **Step 1 — Content Digest (`passportContentDigestSha256`):**
   A deterministic SHA-256 digest is calculated over all evidence nodes, criteria mappings, CI/CD telemetry, build provenance, runtime checks, and prior milestone audit references.
2. **Step 2 — Atomic Audit Anchoring:**
   An immutable audit record (`action: 'EVIDENCE_PASSPORT_GENERATED'`) is appended inside an atomic SQLite `withTransaction` block. The audit payload commits to `passportContentDigestSha256`.
3. **Step 3 — Audit Linkage:**
   The newly generated `auditEntry.entry_hash` is appended to `settlementAuditTrace.auditEventReferences`.
4. **Step 4 — Final Passport Digest (`passportDigestSha256`):**
   The final canonical digest commits to the complete passport (including the newly anchored audit entry hash).
5. **Step 5 — Tamper Detection on Retrieval:**
   On retrieval from SQLite, `getPassport` invokes `verifyPassportIntegrity(passport, storedDigest)`.
   - If any graph node, edge, criterion, or audit hash is altered in SQLite, the recomputed digest mismatches.
   - `isCryptographicallyValid` is marked `false`, and `overallStatus` becomes `FAILED`.
   - **Verified by Regression Tests 28 & 31:** Confirms that altering graph relationships or node labels in SQLite directly invalidates the passport upon retrieval.

### 3.3 Endpoint Authorization & RBAC Enforcement

*Threat:* An authenticated user belonging to Contract A queries the Evidence Passport or triggers runtime validation smoke tests against Contract B.

*Verified Mitigation:*
- Both `getEvidencePassport` and `validateRuntime` in `EvidenceController` enforce contract-party RBAC checks (`FORBIDDEN_NOT_CONTRACT_PARTY`).
- Only users matching `clientId`, `developerId`, or `reviewerId` can access the passport or execute runtime checks.
- Outsiders are rejected with HTTP 403 (verified by Tests 24 & 26).

### 3.4 Financial Invariants & Read-Only Safety

*Threat:* Evidence Passport generation or runtime validation triggers unauthorized payment capture, void, or settlement.

*Verified Mitigation:*
- Evidence Passport operations are 100% read-only with zero database mutations on contracts, milestones, or payments.
- AI agents and passport services have zero direct access to PayPal payment execution APIs.
- Human approval is mandatory before any settlement transaction can be executed by the client.

---

## 4. Skills Utilized & Applied Discipline

- **`systematic-debugging`:** Applied the 4-phase investigation protocol (reproduce, hypothesize, isolate, verify) to identify the hex-encoded IPv4-mapped IPv6 filter bypass (`::ffff:7f00:1`) and empty DNS lookup fall-through.
- **`test-driven-development`:** Added regression tests 32–35 in `evidence_passport.test.ts` to assert that all IPv4-mapped formats, mixed DNS resolutions, empty resolutions, and redirect scheme violations are blocked before finalizing code changes.

---

## 5. Residual Risks & Production Hardening Recommendations

1. **Defense-in-Depth Network Egress Isolation:**
   While socket-level IP-pinning completely prevents application-level DNS rebinding and private IP access, production multi-tenant deployments should additionally employ network-level egress security groups or an egress forward-proxy to prevent kernel-level or sub-process network escapes.
2. **Cryptographic Key Transparency:**
   Commit signatures currently attest to key possession. Integrating Sigstore / Rekor transparency logs in future phases will provide keyless cryptographic attestations of developer identity.
