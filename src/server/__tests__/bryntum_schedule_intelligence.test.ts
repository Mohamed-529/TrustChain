import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServerApp } from '../index.ts';
import type { ContractScheduleDependency } from '../../types/domain.ts';

test('Bryntum Sponsor Excellence — Intelligent Contract Execution Timeline', async (t) => {
  const tempDbPath = path.resolve(
    process.cwd(),
    `test_bryntum_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sqlite`
  );
  const container = createServerApp({ dbPath: tempDbPath });
  const {
    db: appDb,
    userRepo,
    contractService,
    contractRepo,
    milestoneRepo,
    scheduleControlTowerService: scheduleService,
    auditService,
  } = container;

  const clientUser = userRepo.findById('client_01')!;
  const devUser = userRepo.findById('dev_01')!;
  const reviewerUser = userRepo.findById('reviewer_01')!;

  t.after(() => {
    try {
      appDb.close();
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      const wal = `${tempDbPath}-wal`;
      const shm = `${tempDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {
      // Best effort cleanup
    }
  });

  // --------------------------------------------------------------------------
  // TEST 1: Package Resolution & Licensing Baseline
  // --------------------------------------------------------------------------
  await t.test('1. Bryntum package resolution, version verification, and trial licensing check', () => {
    const ganttPkgPath = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt', 'package.json');
    assert.ok(fs.existsSync(ganttPkgPath), '@bryntum/gantt package.json must exist');
    const ganttPkg = JSON.parse(fs.readFileSync(ganttPkgPath, 'utf8'));
    assert.equal(ganttPkg.name, '@bryntum/gantt-trial', 'Package is genuine @bryntum/gantt-trial');
    assert.equal(ganttPkg.version, '7.3.8', 'Installed version must be 7.3.8');

    const ganttReactPkgPath = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt-react', 'package.json');
    assert.ok(fs.existsSync(ganttReactPkgPath), '@bryntum/gantt-react package.json must exist');
    const ganttReactPkg = JSON.parse(fs.readFileSync(ganttReactPkgPath, 'utf8'));
    assert.equal(ganttReactPkg.version, '7.3.8', 'Installed react wrapper must be 7.3.8');

    // Verify Bryntum CSS stylesheets
    const ganttCss = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt', 'gantt.css');
    const themeCss = path.resolve(process.cwd(), 'node_modules', '@bryntum', 'gantt', 'stockholm-light.css');
    assert.ok(fs.existsSync(ganttCss), 'gantt.css must exist');
    assert.ok(fs.existsSync(themeCss), 'stockholm-light.css must exist');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Contract-to-Milestone-to-Task Tree Decomposition (Feature A)
  // --------------------------------------------------------------------------
  await t.test('2. Contract-to-Execution Planning: decomposes milestones into child tasks from acceptance criteria', () => {
    const contract = contractService.createContract(clientUser, {
      title: 'Bryntum Multi-Task Contract',
      description: 'Verifying task tree hierarchy',
      totalBudgetCents: 300000,
      currency: 'USD',
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      policyRules: {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 1,
        allowPartialPayout: false,
        latePenaltyDailyBps: 100,
      },
      milestones: [
        {
          sequenceOrder: 1,
          title: 'Milestone 1: Backend Foundation',
          description: 'Core persistence and schema',
          agreedAmountCents: 150000,
          deadlineIso: '2026-12-01T00:00:00.000Z',
          acceptanceCriteria: [
            {
              id: 'crit_schema',
              title: 'SQLite Schema Migration',
              description: 'Run migrations cleanly with WAL enabled',
              requiredProofType: 'CI_TESTS',
            },
            {
              id: 'crit_auth',
              title: 'Scrypt Password Verification',
              description: 'Async scrypt authentication tests',
              requiredProofType: 'CODE_COMMIT',
            },
          ],
        },
        {
          sequenceOrder: 2,
          title: 'Milestone 2: Timeline Visualization',
          description: 'Bryntum Gantt UI',
          agreedAmountCents: 150000,
          deadlineIso: '2026-12-15T00:00:00.000Z',
          acceptanceCriteria: [
            {
              id: 'crit_gantt',
              title: 'Bryntum Gantt Component',
              description: 'Render timeline with dependencies',
              requiredProofType: 'CI_TESTS',
            },
          ],
        },
      ],
    });

    const schedule = scheduleService.getContractSchedule(contract.id);
    assert.equal(schedule.tasks.length, 2, 'Must have 2 root milestone tasks');

    const m1Task = schedule.tasks[0];
    assert.equal(m1Task.leaf, false, 'Parent milestone task must NOT be a leaf');
    assert.equal(m1Task.expanded, true, 'Parent milestone task must be expanded');
    assert.ok(m1Task.children && m1Task.children.length === 2, 'M1 must have 2 child execution tasks');

    const sub1 = m1Task.children![0];
    assert.equal(sub1.parentId, m1Task.id);
    assert.equal(sub1.leaf, true);
    assert.equal(sub1.acceptanceCriterionId, 'crit_schema');
    assert.ok(sub1.name.includes('SQLite Schema Migration'));
    assert.equal(sub1.requiredProofType, 'CI_TESTS');

    const sub2 = m1Task.children![1];
    assert.equal(sub2.parentId, m1Task.id);
    assert.equal(sub2.leaf, true);
    assert.equal(sub2.acceptanceCriterionId, 'crit_auth');
    assert.ok(sub2.name.includes('Scrypt Password Verification'));
    assert.equal(sub2.requiredProofType, 'CODE_COMMIT');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Dependency Validation & Circular Dependency Rejection (Feature B)
  // --------------------------------------------------------------------------
  await t.test('3. Dependency Intelligence: validates dependency graph and rejects circular references', () => {
    const milestones = [
      { id: 'm_1', title: 'Phase 1' },
      { id: 'm_2', title: 'Phase 2' },
      { id: 'm_3', title: 'Phase 3' },
    ] as any;

    // Valid Finish-to-Start chain: m_1 -> m_2 -> m_3
    const validDeps: ContractScheduleDependency[] = [
      { id: 'd1', fromTask: 'm_1', toTask: 'm_2', fromEvent: 'm_1', toEvent: 'm_2', type: 2, lag: 0, lagUnit: 'day', isBlocking: true },
      { id: 'd2', fromTask: 'm_2', toTask: 'm_3', fromEvent: 'm_2', toEvent: 'm_3', type: 2, lag: 1, lagUnit: 'day', isBlocking: true },
    ];
    const validCheck = scheduleService.validateDependencies(milestones, validDeps);
    assert.equal(validCheck.valid, true, 'Linear dependency chain must be valid');

    // Self-referential dependency: m_1 -> m_1
    const selfDep: ContractScheduleDependency[] = [
      { id: 'd_self', fromTask: 'm_1', toTask: 'm_1', fromEvent: 'm_1', toEvent: 'm_1', type: 2, lag: 0, lagUnit: 'day', isBlocking: true },
    ];
    const selfCheck = scheduleService.validateDependencies(milestones, selfDep);
    assert.equal(selfCheck.valid, false, 'Self-dependency must be rejected');
    assert.ok(selfCheck.error?.includes('Self-referential'));

    // Circular dependency: m_1 -> m_2 -> m_3 -> m_1
    const circularDeps: ContractScheduleDependency[] = [
      { id: 'd1', fromTask: 'm_1', toTask: 'm_2', fromEvent: 'm_1', toEvent: 'm_2', type: 2, lag: 0, lagUnit: 'day', isBlocking: true },
      { id: 'd2', fromTask: 'm_2', toTask: 'm_3', fromEvent: 'm_2', toEvent: 'm_3', type: 2, lag: 0, lagUnit: 'day', isBlocking: true },
      { id: 'd3', fromTask: 'm_3', toTask: 'm_1', fromEvent: 'm_3', toEvent: 'm_1', type: 2, lag: 0, lagUnit: 'day', isBlocking: true },
    ];
    const cycleCheck = scheduleService.validateDependencies(milestones, circularDeps);
    assert.equal(cycleCheck.valid, false, 'Circular dependency cycle must be rejected');
    assert.ok(cycleCheck.error?.includes('Circular dependency detected'));

    // Non-existent task reference
    const missingDep: ContractScheduleDependency[] = [
      { id: 'd_miss', fromTask: 'm_1', toTask: 'm_ghost', fromEvent: 'm_1', toEvent: 'm_ghost', type: 2, lag: 0, lagUnit: 'day', isBlocking: true },
    ];
    const missingCheck = scheduleService.validateDependencies(milestones, missingDep);
    assert.equal(missingCheck.valid, false, 'Non-existent task reference must be rejected');
    assert.ok(missingCheck.error?.includes('non-existent successor'));
  });

  // --------------------------------------------------------------------------
  // TEST 4: Downstream Delay Impact Analysis (Feature B & E)
  // --------------------------------------------------------------------------
  await t.test('4. Downstream Delay Impact Analysis calculates cascading delays across Finish-to-Start graph', () => {
    const contract = contractService.createContract(clientUser, {
      title: 'Cascading Delay Contract',
      description: 'Testing delay ripple',
      totalBudgetCents: 300000,
      currency: 'USD',
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      policyRules: {
        requirePassingCi: false,
        requireSecurityScan: false,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: false,
        latePenaltyDailyBps: 0,
      },
      milestones: [
        { sequenceOrder: 1, title: 'Sprint 1', description: 'Sprint 1', agreedAmountCents: 100000, deadlineIso: '2026-11-10T00:00:00.000Z', acceptanceCriteria: [{ id: 'c1', title: 'Task 1', description: 'd', requiredProofType: 'CI_TESTS' }] },
        { sequenceOrder: 2, title: 'Sprint 2', description: 'Sprint 2', agreedAmountCents: 100000, deadlineIso: '2026-11-20T00:00:00.000Z', acceptanceCriteria: [{ id: 'c2', title: 'Task 2', description: 'd', requiredProofType: 'CI_TESTS' }] },
        { sequenceOrder: 3, title: 'Sprint 3', description: 'Sprint 3', agreedAmountCents: 100000, deadlineIso: '2026-11-30T00:00:00.000Z', acceptanceCriteria: [{ id: 'c3', title: 'Task 3', description: 'd', requiredProofType: 'CI_TESTS' }] },
      ],
    });

    const mList = milestoneRepo.listByContractId(contract.id);
    const now = new Date().toISOString();
    milestoneRepo.updateDependencies(mList[1].id, [mList[0].id], now);
    milestoneRepo.updateDependencies(mList[2].id, [mList[1].id], now);

    // Simulate 5 days delay on Sprint 1
    const impact = scheduleService.analyzeDownstreamDelayImpact(contract.id, mList[0].id, 5);
    assert.equal(impact.delayedMilestoneId, mList[0].id);
    assert.equal(impact.delayDays, 5);
    assert.equal(impact.impactedMilestones.length, 2, 'Sprint 2 and Sprint 3 must both be impacted');
    assert.equal(impact.impactedMilestones[0].milestoneId, mList[1].id);
    assert.equal(impact.impactedMilestones[1].milestoneId, mList[2].id);
    assert.equal(impact.contractDeadlineExceeded, true, 'Final milestone delay exceeds contractual finish date');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Baseline Capture & Immutability (Feature C)
  // --------------------------------------------------------------------------
  await t.test('5. Baseline vs Actual: captures baseline snapshot in SQLite and records hash-chained audit event', () => {
    const contract = contractService.createContract(clientUser, {
      title: 'Baseline Test Contract',
      description: 'Testing baseline freeze',
      totalBudgetCents: 100000,
      currency: 'USD',
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      policyRules: {
        requirePassingCi: false,
        requireSecurityScan: false,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: false,
        latePenaltyDailyBps: 0,
      },
      milestones: [
        { sequenceOrder: 1, title: 'Baseline M1', description: 'M1', agreedAmountCents: 100000, deadlineIso: '2026-12-05T00:00:00.000Z', acceptanceCriteria: [{ id: 'c_base', title: 'Init Criteria', description: 'd', requiredProofType: 'CI_TESTS' }] },
      ],
    });

    // 1. DEVELOPER cannot capture baseline (RBAC)
    assert.throws(
      () => scheduleService.captureScheduleBaseline(devUser, contract.id, 'Developer Baseline'),
      /is not authorized to freeze or capture schedule baselines/
    );

    // 2. CLIENT can capture baseline
    const baselineResult = scheduleService.captureScheduleBaseline(clientUser, contract.id, 'Official Kickoff Baseline');
    assert.equal(baselineResult.contractId, contract.id);
    assert.equal(baselineResult.baselineMilestoneCount, 1);
    assert.ok(baselineResult.auditEntryHash.length === 64, 'Must return SHA-256 audit entry hash');

    // 3. Verify audit log entry exists
    const contractAudit = auditService.listLogs({ contractId: contract.id });
    const baselineEvent = contractAudit.find((e) => e.action === 'SCHEDULE_BASELINE_SNAPSHOT');
    assert.ok(baselineEvent, 'Audit log must record SCHEDULE_BASELINE_CAPTURED event');
    assert.equal(baselineEvent!.actorId, clientUser.id);
    assert.equal(baselineEvent!.newState, 'BASELINE_FROZEN');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Payment-Aware Visualization & Financial Safety Invariants (Feature D)
  // --------------------------------------------------------------------------
  await t.test('6. Payment-Aware Execution: reflects PayPal payment status without triggering financial operations', () => {
    const contract = contractService.createContract(clientUser, {
      title: 'Payment Schedule Contract',
      description: 'Testing payment status mapping',
      totalBudgetCents: 100000,
      currency: 'USD',
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      policyRules: {
        requirePassingCi: false,
        requireSecurityScan: false,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: false,
        latePenaltyDailyBps: 0,
      },
      milestones: [
        { sequenceOrder: 1, title: 'Authorized Milestone', description: 'M1', agreedAmountCents: 100000, deadlineIso: '2026-12-01T00:00:00.000Z', acceptanceCriteria: [{ id: 'c_pay', title: 'Pay Criteria', description: 'd', requiredProofType: 'CI_TESTS' }] },
      ],
    });

    const mList = milestoneRepo.listByContractId(contract.id);
    milestoneRepo.updatePaymentStatus(mList[0].id, 'AUTHORIZED', null, new Date().toISOString());

    const schedule = scheduleService.getContractSchedule(contract.id);
    assert.equal(schedule.tasks[0].paymentStatus, 'AUTHORIZED', 'Gantt task must reflect authoritative payment status');

    // Financial Safety: verify Bryntum viewer source does NOT call capture endpoints
    const viewerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'components', 'BryntumGanttViewer.tsx'),
      'utf8'
    );
    assert.ok(!viewerSource.includes('/api/v1/paypal/capture'), 'BryntumGanttViewer must never call PayPal capture');
    assert.ok(!viewerSource.includes('/api/v1/paypal/authorize'), 'BryntumGanttViewer must never call PayPal authorize');
    assert.ok(viewerSource.includes('Payment Status'), 'Viewer must display Payment Status column');
  });

  // --------------------------------------------------------------------------
  // TEST 7: AI Schedule Recovery Proposals & Human Approval Gate (Feature E)
  // --------------------------------------------------------------------------
  await t.test('7. AI Schedule Recovery: generates proposal and enforces human approval gate', () => {
    const contract = contractService.createContract(clientUser, {
      title: 'AI Recovery Contract',
      description: 'Testing AI recovery flow',
      totalBudgetCents: 200000,
      currency: 'USD',
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      policyRules: {
        requirePassingCi: false,
        requireSecurityScan: false,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: false,
        latePenaltyDailyBps: 0,
      },
      milestones: [
        { sequenceOrder: 1, title: 'Overdue Sprint 1', description: 'M1', agreedAmountCents: 100000, deadlineIso: '2026-11-01T00:00:00.000Z', acceptanceCriteria: [{ id: 'c_s1', title: 'Sprint 1 Criteria', description: 'd', requiredProofType: 'CI_TESTS' }] },
        { sequenceOrder: 2, title: 'Downstream Sprint 2', description: 'M2', agreedAmountCents: 100000, deadlineIso: '2026-11-15T00:00:00.000Z', acceptanceCriteria: [{ id: 'c_s2', title: 'Sprint 2 Criteria', description: 'd', requiredProofType: 'CI_TESTS' }] },
      ],
    });

    const mList = milestoneRepo.listByContractId(contract.id);
    milestoneRepo.updateDependencies(mList[1].id, [mList[0].id], new Date().toISOString());

    // Generate AI Proposal
    const proposalResult = scheduleService.analyzeScheduleRiskAndProposeRecovery(clientUser, contract.id, {
      referenceTimeIso: '2026-11-10T12:00:00.000Z',
    });
    assert.ok(proposalResult.createdProposals.length >= 1, 'Must generate AI proposal for overdue milestone');
    const prop = proposalResult.createdProposals[0];
    assert.equal(prop.status, 'PENDING');
    assert.ok(prop.delayDays > 0);
    assert.equal(prop.preservesContractualAmountCents, 100000, 'Must preserve agreed budget unchanged');

    // Reject DEVELOPER self-approval
    assert.throws(
      () => scheduleService.reviewScheduleProposal(devUser, contract.id, prop.id, { decision: 'APPROVE', reason: 'Self approval' }),
      /Separation-of-duties violation/
    );

    // Allow CLIENT approval
    const approved = scheduleService.reviewScheduleProposal(clientUser, contract.id, prop.id, {
      decision: 'APPROVE',
      reason: 'Fiduciary approval of recovery timeline',
    });
    assert.equal(approved.proposal.status, 'APPROVED');

    // Verify schedule dates updated
    const updatedSchedule = scheduleService.getContractSchedule(contract.id);
    const updatedM1 = updatedSchedule.tasks.find((t) => t.milestoneId === mList[0].id);
    assert.equal(updatedM1?.endDate.slice(0, 10), prop.proposedEndDate.slice(0, 10));
  });

  // --------------------------------------------------------------------------
  // TEST 8: Representative Performance Benchmark (< 15ms Schedule Synthesis)
  // --------------------------------------------------------------------------
  await t.test('8. Performance Validation: contract schedule synthesis executes in sub-15ms', () => {
    const contracts = contractRepo.listAll();
    assert.ok(contracts.length > 0, 'Contracts must exist for benchmark');
    const contract = contracts[0];

    const start = process.hrtime.bigint();
    const ITERATIONS = 20;
    for (let i = 0; i < ITERATIONS; i++) {
      scheduleService.getContractSchedule(contract.id);
    }
    const end = process.hrtime.bigint();
    const totalMs = Number(end - start) / 1_000_000;
    const avgMs = totalMs / ITERATIONS;

    assert.ok(avgMs < 15, `Average schedule resolution must be < 15ms, actual: ${avgMs.toFixed(2)}ms`);
  });
});
