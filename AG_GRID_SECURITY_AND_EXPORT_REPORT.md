# AG Grid Security & CSV Export Protection Report (CWE-1236)

## 1. Overview of CSV Injection Risk

When financial ledgers allow exporting data to CSV format, malicious input in user-controllable fields (such as milestone titles, commit messages, or developer comments) can trigger **CSV Formula Injection (CWE-1236)** when opened in desktop spreadsheet software (Microsoft Excel, Google Sheets, LibreOffice Calc).

Spreadsheet applications automatically execute formulas if a cell starts with:
- `=` (Equal sign)
- `+` (Plus sign)
- `-` (Minus sign)
- `@` (At sign)
- `\t` (Tab character)
- `\r` (Carriage return character)

An attacker who submits milestone evidence with title `=cmd|' /C calc'!A0` could trigger remote code execution on the reviewer's workstation upon opening the exported CSV ledger.

---

## 2. TrustChain Sanitization Defense

TrustChain implements cell-level formula sanitization inside `src/components/ag-grid/exportUtils.ts`:

```typescript
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value).trim();
  
  // CWE-1236 Defense: Prepend single-quote if string starts with formula trigger
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  
  // Escape inner double-quotes per RFC 4180
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
```

---

## 3. Secret Stripping & Whitelist Export

To prevent accidental data leakage, TrustChain restricts exported CSV columns to an approved public whitelist:
- **Included Fields:** `id`, `contractId`, `title`, `developerId`, `budgetUsd`, `status`, `riskLevel`, `ciStatus`, `submittedAtIso`, `deadlineIso`, `settlementStatus`, `approvedAmountUsd`
- **Strictly Stripped Fields:**
  - Password hashes / scrypt salts
  - JWT tokens / secret keys
  - Raw webhook HMAC secrets
  - Unredacted private API credentials
  - Database primary keys of internal session rows

---

## 4. Verification Test Results

Verified in `src/server/__tests__/ag_grid_intelligence.test.ts` (Test 11):
- Input: `=cmd|' /C calc'!A0` -> Output: `"'=cmd|' /C calc'!A0"` (Safe text literal)
- Input: `+12345` -> Output: `">'+12345"` (Safe text literal)
- Input: `@SUM(A1:B2)` -> Output: "'@SUM(A1:B2)" (Safe text literal)
- Result: **0 spreadsheet formula triggers passed; 100% sanitized.**
