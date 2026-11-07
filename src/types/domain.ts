/**
 * Shared Domain Models & Data Transfer Objects (DTOs) — MilestoneProof AI
 * All monetary amounts are represented in integer cents (e.g., $2,500.00 = 250000)
 * to guarantee decimal-safe financial arithmetic.
 */

export type UserRole = 'CLIENT' | 'DEVELOPER' | 'REVIEWER';
export type AuditActorRole = UserRole | 'SYSTEM';

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type MilestoneStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SUBMITTED'
  | 'EVALUATING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REVISION_REQUESTED'
  | 'REJECTED'
  | 'SETTLED'
  | 'PAY_FAILED';

export type PaymentStatus =
  | 'NOT_READY'
  | 'ORDER_CREATED'
  | 'AUTHORIZED'
  | 'CAPTURE_PENDING'
  | 'CAPTURED'
  | 'VOIDED'
  | 'FAILED'
  | 'EXPIRED';

export type RequiredProofType = 'CODE_COMMIT' | 'PULL_REQUEST' | 'CI_TESTS' | 'SECURITY_SCAN' | 'API_DOCS';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isDemoAccount: boolean;
  createdAt: string;
}

export interface UserWithPasswordRow extends User {
  passwordHash: string;
}

export interface SessionTokenClaims {
  jti: string;
  sub: string;
  role: UserRole;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface AuthSessionRecord {
  jti: string;
  userId: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface ContractPolicyRules {
  requirePassingCi: boolean;
  requireSecurityScan: boolean;
  maxAllowedCriticalVulns: number;
  maxAllowedHighVulns: number;
  allowPartialPayout: boolean;
  latePenaltyDailyBps: number; // Basis points per day (e.g., 100 bps = 1.00% per late day)
}

export interface AcceptanceCriterion {
  id: string;
  title: string;
  description: string;
  requiredProofType: RequiredProofType;
}

export interface Milestone {
  id: string;
  contractId: string;
  sequenceOrder: number;
  title: string;
  description: string;
  agreedAmountCents: number;
  deadlineIso: string;
  dependencyMilestoneIds: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  status: MilestoneStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  title: string;
  description: string;
  totalBudgetCents: number;
  currency: 'USD';
  clientId: string;
  developerId: string;
  reviewerId: string;
  policyRules: ContractPolicyRules;
  status: ContractStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  milestones?: Milestone[];
}

export interface CreateMilestoneInput {
  sequenceOrder: number;
  title: string;
  description: string;
  agreedAmountCents: number;
  deadlineIso: string;
  dependencyMilestoneIds?: string[];
  acceptanceCriteria: AcceptanceCriterion[];
}

export interface CreateContractInput {
  title: string;
  description: string;
  totalBudgetCents: number;
  currency: 'USD';
  developerId: string;
  reviewerId: string;
  policyRules: ContractPolicyRules;
  milestones: CreateMilestoneInput[];
}

export interface AuditLogEntry {
  seq: number;
  id: string;
  timestamp: string;
  actorId: string;
  actorRole: AuditActorRole;
  action: string;
  entityType: 'CONTRACT' | 'MILESTONE' | 'EVIDENCE' | 'EVALUATION' | 'APPROVAL' | 'PAYMENT' | 'AUTH_SESSION' | 'SYSTEM';
  entityId: string;
  contractId: string | null;
  milestoneId: string | null;
  previousState: string | null;
  newState: string | null;
  payload: Record<string, unknown>;
  previousHash: string;
  entryHash: string;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  verifiedCount: number;
  genesisHash: string;
  headHash: string;
  failedSeq?: number;
  reason?:
    | 'MISSING_GENESIS_ENTRY'
    | 'INVALID_GENESIS_PREVIOUS_HASH'
    | 'SEQUENCE_GAP_DETECTED'
    | 'BROKEN_PREVIOUS_HASH_LINK'
    | 'ENTRY_HASH_MISMATCH'
    | 'INVALID_PAYLOAD_JSON';
  details?: string;
}

/**
 * ============================================================================
 * PHASE 3 — Evidence Intelligence Engine & Multi-Agent Evaluation Schemas
 * ============================================================================
 */

export interface CiExecutionReport {
  provider: string;
  runUrl?: string;
  status: 'SUCCESS' | 'FAILURE' | 'UNAVAILABLE';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coveragePct: number;
  changedFiles?: string[];
  logSummary: string;
}

export interface SecurityFindingItem {
  id: string;
  packageName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  cvssScore: number;
  description: string;
}

export interface SecurityScanReport {
  scanner: string;
  scannerVersion: string;
  status: 'COMPLETED' | 'UNAVAILABLE';
  findings: SecurityFindingItem[];
}

export interface SubmitEvidenceInput {
  repoUrl: string;
  branch: string;
  commitSha: string;
  prUrl: string;
  prStatus: 'MERGED' | 'OPEN' | 'CLOSED';
  ciReport: CiExecutionReport;
  securityScan: SecurityScanReport;
  developerNotes?: string;
}

export interface EvidenceReference {
  evidenceId: string;
  sourceType: 'COMMIT' | 'PULL_REQUEST' | 'CI_REPORT' | 'SECURITY_SCAN';
  label: string;
  verifiedUrl?: string;
  excerpt: string;
}

export interface EvidenceSubmission {
  id: string;
  milestoneId: string;
  attemptNumber: number;
  submittedBy: string;
  repoUrl: string;
  branch: string;
  commitSha: string;
  prUrl: string;
  prStatus: 'MERGED' | 'OPEN' | 'CLOSED';
  ciReport: CiExecutionReport;
  securityScan: SecurityScanReport;
  developerNotes: string;
  submittedAt: string;
  canonicalReferences?: EvidenceReference[];
}

export interface CriterionVerificationResult {
  criterionId: string;
  status: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'CONTRADICTED';
  confidence: number;
  evidenceCitations: string[];
  explanation: string;
}

export interface EvidenceAnalysis {
  agentName: 'EvidenceAgent';
  model: string;
  isMock: boolean;
  criteriaResults: CriterionVerificationResult[];
  verifiedCount: number;
  totalCount: number;
  missingEvidence: string[];
  factualObservations: string[];
  evidenceReferences: EvidenceReference[];
}

export interface RiskAssessment {
  agentName: 'RiskAgent';
  model: string;
  isMock: boolean;
  scannerStatus: 'AVAILABLE' | 'UNAVAILABLE';
  overallRiskSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  criticalVulnCount: number;
  highVulnCount: number;
  ciBuildPassed: boolean;
  findings: SecurityFindingItem[];
  suspiciousSignals: string[];
  contradictions: string[];
  missingTestSignals: string[];
  promptInjectionDetected: boolean;
  promptInjectionIndicators: string[];
  summary: string;
}

export type ReviewRecommendedOutcome = 'PASS' | 'FAIL' | 'NEEDS_HUMAN_REVIEW';
export type ArbitratorRecommendationCode =
  | 'RECOMMEND_APPROVAL'
  | 'RECOMMEND_HOLD'
  | 'RECOMMEND_REJECTION';

export interface ReviewSynthesis {
  agentName: 'ArbitratorAgent';
  model: string;
  isMock: boolean;
  recommendedOutcome: ReviewRecommendedOutcome;
  recommendation: ArbitratorRecommendationCode;
  disagreements: string[];
  rationale: string;
  advisoryNotice: string;
  isAdvisoryOnly: true;
}

export interface PolicyCalculationResult {
  engineVersion: string;
  agreedAmountCents: number;
  verifiedCriteriaRatio: number;
  grossEligibleCents?: number;
  deductionCents?: number;
  gatesTripped: string[];
  blockingReasons?: string[];
  gateBlocked: boolean;
  lateDays: number;
  latePenaltyCents: number;
  permittedAmountCents: number;
  currency: 'USD';
  formulaExplanation: string;
}

export interface EvaluationRun {
  id: string;
  milestoneId: string;
  submissionId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  evaluationMode: 'LIVE_GEMINI' | 'DETERMINISTIC_MOCK';
  isMockEvaluation: boolean;
  evidenceAnalysis: EvidenceAnalysis;
  riskAnalysis: RiskAssessment;
  arbitratorRecommendation: ReviewSynthesis;
  policyCalculation: PolicyCalculationResult;
  evaluatedAt: string;
}

/**
 * ============================================================================
 * PHASE 4 — Settlement Policy Engine, Human Review & Financial Decision Ledger
 * ============================================================================
 */

export type HumanReviewDecision = 'APPROVE' | 'REQUEST_REVISIONS' | 'REJECT';
export type HumanReviewActionInputDecision =
  | 'APPROVE'
  | 'REQUEST_REVISIONS'
  | 'NEEDS_CHANGES'
  | 'REJECT';

export interface HumanApprovalRecord {
  id: string;
  milestoneId: string;
  evaluationId: string;
  reviewerId: string;
  reviewerRole?: UserRole;
  decision: HumanReviewDecision;
  approvedAmountCents: number;
  isOverride: boolean;
  justification: string;
  policyEngineVersion?: string;
  decidedAt: string;
}

export interface SubmitReviewInput {
  evaluationId?: string;
  decision: HumanReviewActionInputDecision;
  approvedAmountCents?: number;
  justification: string;
}

export interface MilestoneReviewDetails {
  contract: Omit<Contract, 'milestones'>;
  milestone: Milestone;
  stateMachineStatus: MilestoneStatus | 'NEEDS_CHANGES';
  latestSubmission: EvidenceSubmission | null;
  latestEvaluation: EvaluationRun | null;
  policyCalculation: PolicyCalculationResult | null;
  approvals: HumanApprovalRecord[];
  allowedActions: {
    canApprove: boolean;
    canReject: boolean;
    canRequestChanges: boolean;
    maxPermittedAmountCents: number;
    blockingReasons: string[];
  };
}

export interface FinancialLedgerRow {
  milestoneId: string;
  contractId: string;
  contractTitle: string;
  milestoneTitle: string;
  sequenceOrder: number;
  milestoneStatus: MilestoneStatus;
  stateMachineStatus: MilestoneStatus | 'NEEDS_CHANGES';
  submissionId: string | null;
  attemptNumber: number | null;
  evaluationId: string | null;
  verifiedRatioPct: number;
  riskSeverity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNAVAILABLE';
  aiRecommendation: ArbitratorRecommendationCode | 'PENDING';
  policyEngineVersion: string | null;
  gateBlocked: boolean;
  blockingReasons: string[];
  agreedAmountCents: number;
  permittedAmountCents: number | null;
  approvedAmountCents: number | null;
  approvalId: string | null;
  reviewerId: string | null;
  reviewerDecision: HumanReviewDecision | null;
  decidedAt: string | null;
  paymentEligible: boolean;
  paymentStatus: PaymentStatus;
  auditEventCount: number;
  auditTrailIds: string[];
  latestAuditEntryHash: string | null;
  updatedAt: string;
}


