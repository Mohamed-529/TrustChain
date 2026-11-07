import {
  AppError,
  type ApiRequest,
  type ApiResponse,
  type NextFunction,
  type RequestHandler,
} from './errorHandler.ts';

/**
 * Declarative JSON Schema / OpenAPI 3.0.3 schema subset used for zero-dependency
 * runtime request validation in MilestoneProof AI.
 */
export interface OpenApiPropertyRule {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: RegExp;
  enum?: readonly (string | number)[];
  minItems?: number;
  additionalProperties?: boolean;
  properties?: Record<string, OpenApiPropertyRule>;
  items?: OpenApiPropertyRule;
}

export interface OpenApiObjectSchema {
  schemaName: string;
  additionalProperties: boolean;
  properties: Record<string, OpenApiPropertyRule>;
}

/**
 * Runtime OpenAPI 3.0.3 Request Schemas matching `openapi.yaml` component schemas.
 */
export const OPENAPI_REQUEST_SCHEMAS: Record<string, OpenApiObjectSchema> = {
  LoginRequest: {
    schemaName: 'LoginRequest',
    additionalProperties: false,
    properties: {
      email: {
        type: 'string',
        required: true,
        minLength: 3,
        maxLength: 254,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      password: {
        type: 'string',
        required: true,
        minLength: 6,
        maxLength: 256,
      },
    },
  },
  DemoSwitchRequest: {
    schemaName: 'DemoSwitchRequest',
    additionalProperties: false,
    properties: {
      userId: {
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 64,
      },
    },
  },
  CreateContractRequest: {
    schemaName: 'CreateContractRequest',
    additionalProperties: false,
    properties: {
      title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
      description: { type: 'string', required: true, maxLength: 4000 },
      totalBudgetCents: { type: 'integer', required: true, minimum: 1 },
      currency: { type: 'string', required: true, enum: ['USD'] },
      developerId: { type: 'string', required: true, minLength: 1 },
      reviewerId: { type: 'string', required: true, minLength: 1 },
      policyRules: {
        type: 'object',
        required: true,
        additionalProperties: false,
        properties: {
          requirePassingCi: { type: 'boolean', required: true },
          requireSecurityScan: { type: 'boolean', required: true },
          maxAllowedCriticalVulns: { type: 'integer', required: true, minimum: 0 },
          maxAllowedHighVulns: { type: 'integer', required: true, minimum: 0 },
          allowPartialPayout: { type: 'boolean', required: true },
          latePenaltyDailyBps: { type: 'integer', required: true, minimum: 0, maximum: 5000 },
        },
      },
      milestones: {
        type: 'array',
        required: true,
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sequenceOrder: { type: 'integer', required: true, minimum: 1 },
            title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
            description: { type: 'string', required: true, maxLength: 2000 },
            agreedAmountCents: { type: 'integer', required: true, minimum: 1 },
            deadlineIso: { type: 'string', required: true, minLength: 10 },
            dependencyMilestoneIds: {
              type: 'array',
              required: false,
              items: { type: 'string' },
            },
            acceptanceCriteria: {
              type: 'array',
              required: true,
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string', required: true, minLength: 1, maxLength: 32 },
                  title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
                  description: { type: 'string', required: true, minLength: 1, maxLength: 1000 },
                  requiredProofType: {
                    type: 'string',
                    required: true,
                    enum: [
                      'CODE_COMMIT',
                      'PULL_REQUEST',
                      'CI_TESTS',
                      'SECURITY_SCAN',
                      'API_DOCS',
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  SubmitEvidenceRequest: {
    schemaName: 'SubmitEvidenceRequest',
    additionalProperties: false,
    properties: {
      repoUrl: {
        type: 'string',
        required: true,
        pattern: /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/,
      },
      branch: { type: 'string', required: true, minLength: 1, maxLength: 128 },
      commitSha: { type: 'string', required: true, pattern: /^[0-9a-fA-F]{7,40}$/ },
      prUrl: {
        type: 'string',
        required: true,
        pattern: /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/[0-9]+\/?$/,
      },
      prStatus: { type: 'string', required: true, enum: ['MERGED', 'OPEN', 'CLOSED'] },
      ciReport: {
        type: 'object',
        required: true,
        additionalProperties: false,
        properties: {
          provider: { type: 'string', required: true, minLength: 1 },
          runUrl: { type: 'string', required: false },
          status: { type: 'string', required: true, enum: ['SUCCESS', 'FAILURE', 'UNAVAILABLE'] },
          totalTests: { type: 'integer', required: true, minimum: 0 },
          passedTests: { type: 'integer', required: true, minimum: 0 },
          failedTests: { type: 'integer', required: true, minimum: 0 },
          coveragePct: { type: 'number', required: true, minimum: 0, maximum: 100 },
          changedFiles: { type: 'array', required: false, items: { type: 'string' } },
          logSummary: { type: 'string', required: true, maxLength: 32768 },
        },
      },
      securityScan: {
        type: 'object',
        required: true,
        additionalProperties: false,
        properties: {
          scanner: { type: 'string', required: true, minLength: 1 },
          scannerVersion: { type: 'string', required: true, minLength: 1 },
          status: { type: 'string', required: true, enum: ['COMPLETED', 'UNAVAILABLE'] },
          findings: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true, minLength: 1 },
                packageName: { type: 'string', required: true, minLength: 1 },
                severity: {
                  type: 'string',
                  required: true,
                  enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
                },
                cvssScore: { type: 'number', required: true, minimum: 0, maximum: 10 },
                description: { type: 'string', required: true },
              },
            },
          },
        },
      },
      developerNotes: { type: 'string', required: false, maxLength: 4000 },
    },
  },
  SubmitReviewRequest: {
    schemaName: 'SubmitReviewRequest',
    additionalProperties: false,
    properties: {
      evaluationId: { type: 'string', required: true, minLength: 1 },
      decision: {
        type: 'string',
        required: true,
        enum: ['APPROVE', 'REQUEST_REVISIONS', 'REJECT'],
      },
      approvedAmountCents: { type: 'integer', required: true, minimum: 0 },
      justification: { type: 'string', required: true, minLength: 5, maxLength: 2000 },
    },
  },
  PolicyPreviewRequest: {
    schemaName: 'PolicyPreviewRequest',
    additionalProperties: false,
    properties: {
      verifiedCriteriaCount: { type: 'integer', required: true, minimum: 0 },
      totalCriteriaCount: { type: 'integer', required: true, minimum: 1 },
      ciBuildPassed: { type: 'boolean', required: true },
      criticalVulnCount: { type: 'integer', required: true, minimum: 0 },
      highVulnCount: { type: 'integer', required: true, minimum: 0 },
      scannerStatus: {
        type: 'string',
        required: true,
        enum: ['AVAILABLE', 'UNAVAILABLE'],
      },
      submittedAtIso: { type: 'string', required: false, minLength: 10 },
    },
  },
};

export function validateValueAgainstRule(
  value: unknown,
  rule: OpenApiPropertyRule,
  fieldPath: string
): string[] {
  const violations: string[] = [];

  if (rule.type === 'string') {
    if (typeof value !== 'string') {
      violations.push(`${fieldPath}: expected string.`);
      return violations;
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      violations.push(`${fieldPath}: string length must be >= ${rule.minLength}.`);
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      violations.push(`${fieldPath}: string length must be <= ${rule.maxLength}.`);
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      violations.push(`${fieldPath}: string does not match required pattern.`);
    }
    if (rule.enum && !rule.enum.includes(value)) {
      violations.push(`${fieldPath}: value '${value}' must be one of [${rule.enum.join(', ')}].`);
    }
    return violations;
  }

  if (rule.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      violations.push(`${fieldPath}: expected integer.`);
      return violations;
    }
    if (rule.minimum !== undefined && value < rule.minimum) {
      violations.push(`${fieldPath}: integer must be >= ${rule.minimum}.`);
    }
    if (rule.maximum !== undefined && value > rule.maximum) {
      violations.push(`${fieldPath}: integer must be <= ${rule.maximum}.`);
    }
    return violations;
  }

  if (rule.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      violations.push(`${fieldPath}: expected number.`);
      return violations;
    }
    if (rule.minimum !== undefined && value < rule.minimum) {
      violations.push(`${fieldPath}: number must be >= ${rule.minimum}.`);
    }
    if (rule.maximum !== undefined && value > rule.maximum) {
      violations.push(`${fieldPath}: number must be <= ${rule.maximum}.`);
    }
    return violations;
  }

  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') {
      violations.push(`${fieldPath}: expected boolean.`);
    }
    return violations;
  }

  if (rule.type === 'array') {
    if (!Array.isArray(value)) {
      violations.push(`${fieldPath}: expected array.`);
      return violations;
    }
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      violations.push(`${fieldPath}: array must contain at least ${rule.minItems} item(s).`);
    }
    if (rule.items) {
      for (let i = 0; i < value.length; i++) {
        violations.push(...validateValueAgainstRule(value[i], rule.items, `${fieldPath}[${i}]`));
      }
    }
    return violations;
  }

  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      violations.push(`${fieldPath}: expected object.`);
      return violations;
    }
    const obj = value as Record<string, unknown>;
    const props = rule.properties ?? {};
    if (rule.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in props)) {
          violations.push(`${fieldPath}.${key}: unexpected additional property '${key}'.`);
        }
      }
    }
    for (const [propKey, propRule] of Object.entries(props)) {
      const propVal = obj[propKey];
      if (propVal === undefined || propVal === null) {
        if (propRule.required) {
          violations.push(`${fieldPath}.${propKey}: required property is missing.`);
        }
        continue;
      }
      violations.push(
        ...validateValueAgainstRule(propVal, propRule, `${fieldPath}.${propKey}`)
      );
    }
  }

  return violations;
}

export function validatePayloadAgainstSchema(
  payload: unknown,
  schema: OpenApiObjectSchema
): { valid: boolean; violations: string[] } {
  const rootRule: OpenApiPropertyRule = {
    type: 'object',
    additionalProperties: schema.additionalProperties,
    properties: schema.properties,
  };
  const violations = validateValueAgainstRule(payload, rootRule, schema.schemaName);
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Express-compatible middleware that validates `req.body` against a named OpenAPI 3.0.3 schema.
 */
export function validateRequestSchema(schemaName: keyof typeof OPENAPI_REQUEST_SCHEMAS): RequestHandler {
  const schema = OPENAPI_REQUEST_SCHEMAS[schemaName];
  return function schemaValidatorMiddleware(
    req: ApiRequest,
    _res: ApiResponse,
    next: NextFunction
  ): void {
    const { valid, violations } = validatePayloadAgainstSchema(req.body, schema);
    if (!valid) {
      next(
        new AppError(
          400,
          'SCHEMA_VALIDATION_ERROR',
          `Request body failed OpenAPI schema validation for '${schemaName}'.`,
          { schemaName, violations }
        )
      );
      return;
    }
    next();
  };
}
