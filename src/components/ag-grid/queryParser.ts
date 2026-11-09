export interface GridFilterInstruction {
  column: string;
  columnLabel: string;
  operator: 'EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN' | 'IN';
  value: string | number;
  description: string;
}

export interface InterpretedQueryPlan {
  originalQuery: string;
  instructions: GridFilterInstruction[];
  sortInstruction?: {
    column: string;
    columnLabel: string;
    direction: 'asc' | 'desc';
  };
  rationale: string;
}

export const WHITELISTED_COLUMNS: Record<
  string,
  { label: string; type: 'text' | 'number' | 'enum' | 'currency'; validEnums?: string[] }
> = {
  milestoneTitle: { label: 'Milestone Title', type: 'text' },
  contractTitle: { label: 'Contract Title', type: 'text' },
  riskSeverity: {
    label: 'Risk Severity',
    type: 'enum',
    validEnums: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE', 'UNAVAILABLE'],
  },
  stateMachineStatus: {
    label: 'Delivery State',
    type: 'enum',
    validEnums: [
      'ACTIVE',
      'IN_REVIEW',
      'APPROVED',
      'REJECTED',
      'REVISION_REQUESTED',
      'NEEDS_CHANGES',
      'COMPLETED',
      'SETTLED',
    ],
  },
  paymentStatus: {
    label: 'Payment Status',
    type: 'enum',
    validEnums: [
      'NOT_READY',
      'ORDER_CREATED',
      'AUTHORIZED',
      'CAPTURED',
      'REQUIRES_RECONCILIATION',
      'TIMEOUT',
    ],
  },
  aiRecommendation: {
    label: 'AI Recommendation',
    type: 'enum',
    validEnums: ['APPROVED', 'REJECTED', 'PASS', 'FAIL', 'HOLD', 'PENDING'],
  },
  agreedAmountCents: { label: 'Agreed Budget', type: 'currency' },
  permittedAmountCents: { label: 'Permitted Cap', type: 'currency' },
  approvedAmountCents: { label: 'Approved Amount', type: 'currency' },
  verifiedRatioPct: { label: 'Verified Evidence Ratio', type: 'number' },
  auditEventCount: { label: 'Audit Event Count', type: 'number' },
  deadlineIso: { label: 'Deadline Date', type: 'text' },
  developerId: { label: 'Developer', type: 'text' },
  evidenceType: {
    label: 'Evidence Type',
    type: 'enum',
    validEnums: ['CODE_COMMIT', 'PULL_REQUEST', 'CI_TESTS', 'SECURITY_SCAN', 'NONE'],
  },
  submittedAtIso: { label: 'Submitted At', type: 'text' },
  provenanceStatus: {
    label: 'Provenance Verification',
    type: 'enum',
    validEnums: [
      'VERIFIED',
      'MISMATCH_DETECTED',
      'TAMPERED_PAYLOAD',
      'UNVERIFIED_UNAVAILABLE',
      'FAILED',
    ],
  },
};

export interface DateRangeUtc {
  startDateIso: string;
  endDateIso: string;
  timezone: 'UTC';
  isCalendarWeek: boolean;
}

/**
 * Calculates start (Monday 00:00:00.000Z) and end (Sunday 23:59:59.999Z) of the calendar week in UTC.
 * Ensures future timestamps are excluded via the endDateIso upper bound (next Monday 00:00:00.000Z).
 */
export function getCalendarWeekRangeUtc(referenceDate: Date = new Date()): DateRangeUtc {
  const d = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const utcDay = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diffToMonday, 0, 0, 0, 0));
  const nextMonday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 7, 0, 0, 0, 0));

  return {
    startDateIso: monday.toISOString().slice(0, 10),
    endDateIso: nextMonday.toISOString().slice(0, 10),
    timezone: 'UTC',
    isCalendarWeek: true,
  };
}

/**
 * Calculates rolling 7-day lookback window: [refDate - 7 days, refDate + 1 day] in UTC.
 * Upper bound ensures future timestamps are excluded.
 */
export function getRollingSevenDaysRangeUtc(referenceDate: Date = new Date()): DateRangeUtc {
  const d = referenceDate instanceof Date && !isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const start = new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  return {
    startDateIso: start.toISOString().slice(0, 10),
    endDateIso: tomorrow.toISOString().slice(0, 10),
    timezone: 'UTC',
    isCalendarWeek: false,
  };
}

/**
 * Deterministic Natural-Language Query Parser.
 * Strictly validates against the explicit whitelist of supported columns and operations.
 * Never executes dynamic code or SQL expressions.
 */
export function interpretNaturalLanguageQuery(
  query: string,
  referenceDate?: Date
): InterpretedQueryPlan {
  if (!query || typeof query !== 'string') {
    return {
      originalQuery: String(query || ''),
      instructions: [],
      rationale: 'Empty or invalid natural-language query provided.',
    };
  }

  const normalized = query.trim().toLowerCase();
  const instructions: GridFilterInstruction[] = [];
  let sortInstruction: InterpretedQueryPlan['sortInstruction'] | undefined;
  const rationaleParts: string[] = [];

  // Priority Sponsor Patterns: Human Review, High Risk, Weekly Evidence, Verification Failures
  if (
    normalized.includes('requiring human review') ||
    normalized.includes('human review') ||
    normalized.includes('pending review') ||
    normalized.includes('needs changes')
  ) {
    instructions.push({
      column: 'stateMachineStatus',
      columnLabel: WHITELISTED_COLUMNS.stateMachineStatus.label,
      operator: 'IN',
      value: 'IN_REVIEW,SUBMITTED,NEEDS_CHANGES',
      description: 'Filter by Delivery State in [IN_REVIEW, SUBMITTED, NEEDS_CHANGES]',
    });
    rationaleParts.push('Isolated submissions requiring human review');
  }

  if (
    normalized.includes('failed verification') ||
    normalized.includes('failed') ||
    normalized.includes('mismatch') ||
    normalized.includes('tampered')
  ) {
    instructions.push({
      column: 'provenanceStatus',
      columnLabel: WHITELISTED_COLUMNS.provenanceStatus.label,
      operator: 'IN',
      value: 'MISMATCH_DETECTED,TAMPERED_PAYLOAD,FAILED',
      description: 'Filter by Provenance Status in [MISMATCH_DETECTED, TAMPERED_PAYLOAD, FAILED]',
    });
    rationaleParts.push('Isolated submissions with failed cryptographic provenance');
  }

  if (
    normalized.includes('this week') ||
    normalized.includes('calendar week') ||
    normalized.includes('current week')
  ) {
    // Explicit Calendar Week Semantics: Monday 00:00:00.000Z to Sunday 23:59:59.999Z in UTC
    const range = getCalendarWeekRangeUtc(referenceDate);
    instructions.push({
      column: 'submittedAtIso',
      columnLabel: WHITELISTED_COLUMNS.submittedAtIso.label,
      operator: 'GREATER_THAN',
      value: range.startDateIso,
      description: `Filter by Submitted At calendar week start (on or after ${range.startDateIso} 00:00:00 UTC)`,
    });
    instructions.push({
      column: 'submittedAtIso',
      columnLabel: WHITELISTED_COLUMNS.submittedAtIso.label,
      operator: 'LESS_THAN',
      value: range.endDateIso,
      description: `Filter by Submitted At calendar week end (before ${range.endDateIso} 00:00:00 UTC, excluding future dates)`,
    });
    rationaleParts.push(
      `Filtered for submissions in the current calendar week (Monday ${range.startDateIso} to Sunday in UTC; future timestamps excluded)`
    );
  } else if (
    normalized.includes('last 7 days') ||
    normalized.includes('past 7 days') ||
    normalized.includes('rolling week') ||
    normalized.includes('recent evidence') ||
    normalized.includes('recent submissions') ||
    normalized.includes('submitted recently')
  ) {
    // Explicit Rolling 7-Day Window Semantics in UTC
    const range = getRollingSevenDaysRangeUtc(referenceDate);
    instructions.push({
      column: 'submittedAtIso',
      columnLabel: WHITELISTED_COLUMNS.submittedAtIso.label,
      operator: 'GREATER_THAN',
      value: range.startDateIso,
      description: `Filter by Submitted At rolling 7-day window (on or after ${range.startDateIso} UTC)`,
    });
    instructions.push({
      column: 'submittedAtIso',
      columnLabel: WHITELISTED_COLUMNS.submittedAtIso.label,
      operator: 'LESS_THAN',
      value: range.endDateIso,
      description: `Filter by Submitted At upper bound (before ${range.endDateIso} UTC, excluding future dates)`,
    });
    rationaleParts.push(
      `Filtered for submissions in the rolling past 7 days (>= ${range.startDateIso} UTC; future timestamps excluded)`
    );
  }

  // 1. Risk Severity filters
  if (/\bcritical\b/.test(normalized)) {
    instructions.push({
      column: 'riskSeverity',
      columnLabel: WHITELISTED_COLUMNS.riskSeverity.label,
      operator: 'EQUALS',
      value: 'CRITICAL',
      description: 'Filter by Risk Severity equals CRITICAL',
    });
    rationaleParts.push('Isolated CRITICAL risk milestones');
  } else if (/\bhigh\b/.test(normalized)) {
    instructions.push({
      column: 'riskSeverity',
      columnLabel: WHITELISTED_COLUMNS.riskSeverity.label,
      operator: 'EQUALS',
      value: 'HIGH',
      description: 'Filter by Risk Severity equals HIGH',
    });
    rationaleParts.push('Isolated HIGH risk milestones');
  } else if (/\blow\s*risk\b/.test(normalized) || (/\blow\b/.test(normalized) && !/\bbelow\b/.test(normalized))) {
    instructions.push({
      column: 'riskSeverity',
      columnLabel: WHITELISTED_COLUMNS.riskSeverity.label,
      operator: 'EQUALS',
      value: 'LOW',
      description: 'Filter by Risk Severity equals LOW',
    });
    rationaleParts.push('Isolated LOW risk milestones');
  }

  // 2. Delivery / State Machine Status
  if (normalized.includes('approved') && !normalized.includes('not approved')) {
    instructions.push({
      column: 'stateMachineStatus',
      columnLabel: WHITELISTED_COLUMNS.stateMachineStatus.label,
      operator: 'EQUALS',
      value: 'APPROVED',
      description: 'Filter by Delivery State equals APPROVED',
    });
    rationaleParts.push('Filtered for milestones approved by human fiduciary');
  } else if (normalized.includes('rejected')) {
    instructions.push({
      column: 'stateMachineStatus',
      columnLabel: WHITELISTED_COLUMNS.stateMachineStatus.label,
      operator: 'EQUALS',
      value: 'REJECTED',
      description: 'Filter by Delivery State equals REJECTED',
    });
    rationaleParts.push('Filtered for rejected milestones');
  } else if (normalized.includes('active') || normalized.includes('in progress')) {
    instructions.push({
      column: 'stateMachineStatus',
      columnLabel: WHITELISTED_COLUMNS.stateMachineStatus.label,
      operator: 'EQUALS',
      value: 'ACTIVE',
      description: 'Filter by Delivery State equals ACTIVE',
    });
    rationaleParts.push('Filtered for currently active milestones');
  }

  // 3. Monetary Amount filters (e.g. > $1,000 or above $2,500)
  const amountMatch = normalized.match(
    /(?:above|greater than|>|exceeding|\$)\s*\$?([0-9,]+(?:\.[0-9]{2})?)/i
  );
  if (amountMatch) {
    const rawVal = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(rawVal)) {
      const cents = Math.round(rawVal * 100);
      instructions.push({
        column: 'agreedAmountCents',
        columnLabel: WHITELISTED_COLUMNS.agreedAmountCents.label,
        operator: 'GREATER_THAN',
        value: cents,
        description: `Filter by Agreed Budget > $${rawVal.toLocaleString()}`,
      });
      rationaleParts.push(`Constrained budget > $${rawVal.toLocaleString()}`);
    }
  }

  // 4. Evidence completeness / verification ratio (e.g. below 80% or unverified)
  const ratioMatch = normalized.match(/(?:below|less than|<)\s*([0-9]+)%/i);
  if (ratioMatch) {
    const ratioVal = parseInt(ratioMatch[1], 10);
    if (!isNaN(ratioVal)) {
      instructions.push({
        column: 'verifiedRatioPct',
        columnLabel: WHITELISTED_COLUMNS.verifiedRatioPct.label,
        operator: 'LESS_THAN',
        value: ratioVal,
        description: `Filter by Verified Evidence Ratio < ${ratioVal}%`,
      });
      rationaleParts.push(`Constrained verified ratio < ${ratioVal}%`);
    }
  } else if (normalized.includes('unverified') || normalized.includes('incomplete')) {
    instructions.push({
      column: 'verifiedRatioPct',
      columnLabel: WHITELISTED_COLUMNS.verifiedRatioPct.label,
      operator: 'LESS_THAN',
      value: 100,
      description: 'Filter by Verified Evidence Ratio < 100%',
    });
    rationaleParts.push('Isolated milestones with incomplete verification');
  }

  // 5. Payment lifecycle status
  if (normalized.includes('captured') || normalized.includes('settled')) {
    instructions.push({
      column: 'paymentStatus',
      columnLabel: WHITELISTED_COLUMNS.paymentStatus.label,
      operator: 'EQUALS',
      value: 'CAPTURED',
      description: 'Filter by Payment Status equals CAPTURED',
    });
    rationaleParts.push('Filtered for captured/settled payments');
  } else if (normalized.includes('authorized') || normalized.includes('hold')) {
    instructions.push({
      column: 'paymentStatus',
      columnLabel: WHITELISTED_COLUMNS.paymentStatus.label,
      operator: 'EQUALS',
      value: 'AUTHORIZED',
      description: 'Filter by Payment Status equals AUTHORIZED',
    });
    rationaleParts.push('Filtered for authorized escrow holds');
  }

  // 6. Sorting requests
  if (normalized.includes('sort by budget') || normalized.includes('highest budget')) {
    sortInstruction = {
      column: 'agreedAmountCents',
      columnLabel: 'Agreed Budget',
      direction: 'desc',
    };
  } else if (normalized.includes('sort by risk') || normalized.includes('highest risk')) {
    sortInstruction = {
      column: 'riskSeverity',
      columnLabel: 'Risk Severity',
      direction: 'desc',
    };
  } else if (normalized.includes('sort by deadline') || normalized.includes('due date')) {
    sortInstruction = {
      column: 'deadlineIso',
      columnLabel: 'Deadline Date',
      direction: 'asc',
    };
  }

  return {
    originalQuery: query,
    instructions,
    sortInstruction,
    rationale:
      rationaleParts.length > 0
        ? rationaleParts.join('; ')
        : 'Interpreted as broad milestone search against whitelisted columns.',
  };
}

/**
 * Sanitizes a cell value for safe CSV export.
 * Neutralizes Excel/CSV Formula Injection (CWE-1236) by prefixing dangerous characters with a single quote.
 * Dangerous leading characters: =, +, -, @, \t, \r
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);

  // Check if cell starts with a formula trigger
  if (/^[=+\-@\t\r]/.test(str)) {
    // Neutralize formula injection
    str = `'${str}`;
  }

  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Strips secret tokens, credentials, and internal private keys from any dataset before export.
 */
export function sanitizeExportData<T extends Record<string, any>>(rows: T[]): Partial<T>[] {
  const SENSITIVE_KEYS = new Set([
    'clientSecret',
    'privateKey',
    'token',
    'passwordHash',
    'authorizationHeader',
    'apiKey',
    'webhookSecret',
    'encryptedPayload',
  ]);

  return rows.map((row) => {
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!SENSITIVE_KEYS.has(k)) {
        sanitized[k] = v;
      }
    }
    return sanitized as Partial<T>;
  });
}

/**
 * Strict validator for AI Confidence score.
 * Clamps or rejects non-numeric or out-of-range values [0.0, 1.0].
 */
export function validateAiConfidence(confidence: unknown): {
  valid: boolean;
  score: number;
  error?: string;
} {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return {
      valid: false,
      score: 0.0,
      error: 'Confidence score must be a valid non-NaN number.',
    };
  }

  if (confidence < 0.0 || confidence > 1.0) {
    return {
      valid: false,
      score: Math.max(0.0, Math.min(1.0, confidence)),
      error: `Confidence score ${confidence} is outside permissible range [0.0, 1.0].`,
    };
  }

  return {
    valid: true,
    score: confidence,
  };
}
