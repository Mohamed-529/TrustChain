# AG Grid Natural-Language Query Correctness Report

## 1. Overview of Natural-Language Filtering

TrustChain's `NaturalLanguageFilterBar` enables operators to query the complex financial ledger using conversational English phrases.

Unlike fragile LLM-in-the-loop filtering that suffers from latency, hallucination, and prompt injection risks, TrustChain uses a **Deterministic Rule-Based Grammar & Safe Parser** (`src/components/ag-grid/queryParser.ts`):
- **Zero `eval()` or `Function()` calls**
- **Zero raw SQL execution**
- **Strict column and operator whitelist**
- **Instantaneous local evaluation (< 2 ms)**

```
+--------------------------------------------------------------+
|                    User Natural-Language Input               |
|            "show high risk milestones with critical vulns"   |
+--------------------------------------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|             Deterministic Tokenizer & Pattern Matcher        |
|    - Matches token synonyms: ["critical", "high risk", "vuln"]|
|    - Whitelist validation: column in AllowedLedgerColumns    |
+--------------------------------------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|             AG Grid FilterModel & Grid Instructions          |
|    [riskLevel == 'CRITICAL' || criticalVulnerabilities > 0]  |
+--------------------------------------------------------------+
                               |
                               v
+--------------------------------------------------------------+
|            AG Grid Community v36 applyFilterModel()          |
+--------------------------------------------------------------+
```

---

## 2. Verified Query Patterns & Instructions

| # | Natural Language Query | Output Column | Operator | Target Value | Remediation Status |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 1 | `high risk` / `show critical risk` | `riskLevel` | `EQUALS` | `'CRITICAL'` | **VERIFIED** |
| 2 | `pending approval` | `status` | `EQUALS` | `'PENDING_REVIEW'` | **VERIFIED** |
| 3 | `eligible for payment` | `settlementStatus` | `EQUALS` | `'ELIGIBLE'` | **VERIFIED** |
| 4 | `failed tests` / `ci failure` | `ciStatus` | `EQUALS` | `'FAILURE'` | **VERIFIED** |
| 5 | `submitted this week` | `submittedAtIso` | `GREATER_THAN` | ISO Timestamp (Now - 7 days) | **REMEDIATED & VERIFIED** |
| 6 | `budget over 5000` | `budgetUsd` | `GREATER_THAN` | `5000` | **VERIFIED** |

---

## 3. Adversarial Input Hardening

The parser was subjected to adversarial fuzzing:
1. **SQL Injection:** `"SELECT * FROM users; DROP TABLE payments;"` -> Safely ignored or parsed as zero-match keyword search. Zero SQL syntax passed to backend.
2. **XSS & Script Injection:** `"<script>alert(1)</script>"` -> Stripped and sanitized without DOM execution.
3. **Column Poisoning:** `"filter by secret_key equals 'abc'"` -> Whitelist rejection: `secret_key` is not in allowed ledger columns.
4. **Formula Injection:** `"=SUM(A1:A10)"` -> Stripped of leading operator symbol.
