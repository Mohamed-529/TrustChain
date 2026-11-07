import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServerApp } from '../index.ts';

test('Phase 8.2 & 8.3 — Real Backend-to-Bryntum Integration, UI States & Invariants', async (t) => {
  const tempDbPath = path.resolve(process.cwd(), `test_p8_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sqlite`);
  const container = createServerApp({ dbPath: tempDbPath });
  const {
    db: appDb,
    userRepo,
    contractRepo,
    milestoneRepo,
    proposalRepo,
    contractService,
    scheduleControlTowerService: scheduleService,
    evidenceService,
    evaluationService,
    humanReviewService,
  } = container;

  const clientUser = userRepo.findById('client_01')!;
  const devUser = userRepo.findById('dev_01')!;
  const reviewerUser = userRepo.findById('reviewer_01')!;

  const validPolicyRules = {
    requirePassingCi: true,
    requireSecurityScan: true,
    maxAllowedCriticalVulns: 0,
    maxAllowedHighVulns: 2,
    allowPartialPayout: true,
    latePenaltyDailyBps: 200,
  };

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

  await t.test('1. Backend-to-Bryntum Data Mapping: produces valid TaskModel, DependencyModel, Baselines & Critical Path', async () => {
    // 1. Create a 2-milestone contract with future deadlines
    const contract = contractService.createContract(
      clientUser,
      {
        title: 'Phase 8 Bryntum Integration Test Contract',
        description: 'Verifies real backend delivery schedule mapping to Bryntum Gantt models',
        totalBudgetCents: 1500000,
        currency: 'USD',
        developerId: devUser.id,
        reviewerId: reviewerUser.id,
        policyRules: validPolicyRules,
        milestones: [
          {
            sequenceOrder: 1,
            title: 'M1: Backend Architecture Specification',
            description: 'Core models and OpenAPI schemas',
            agreedAmountCents: 500000,
            deadlineIso: '2027-11-10T12:00:00Z',
            acceptanceCriteria: [
              {
                id: 'crit_1_1',
                title: 'OpenAPI Specification',
                description: 'OpenAPI specification verified',
                requiredProofType: 'CI_TESTS',
              },
            ],
          },
          {
            sequenceOrder: 2,
            title: 'M2: Core Settlement & Escrow Engine',
            description: 'Policy engine and hash chain',
            agreedAmountCents: 1000000,
            deadlineIso: '2027-11-20T12:00:00Z',
            dependencyMilestoneIds: [],
            acceptanceCriteria: [
              {
                id: 'crit_2_1',
                title: 'Full Test Pass',
                description: 'Full automated test pass',
                requiredProofType: 'CI_TESTS',
              },
            ],
          },
        ],
      }
    );

    // Retrieve initial schedule
    const schedule = scheduleService.getContractSchedule(contract.id);
    assert.equal(schedule.contractId, contract.id);
    assert.equal(schedule.tasks.length, 2);

    // Verify Bryntum TaskModel properties
    const task1 = schedule.tasks[0];
    assert.equal(task1.id, contract.milestones![0].id);
    assert.ok(task1.name.includes('M1: Backend Architecture'));
    assert.ok(task1.startDate);
    assert.ok(task1.endDate);
    assert.ok(task1.duration > 0);
    assert.equal(task1.durationUnit, 'day');
    assert.equal(task1.percentDone, 0);
    assert.equal(task1.scheduleHealth, 'ON_TRACK');
    assert.equal(task1.agreedAmountCents, 500000);

    // Verify Bryntum BaselineModel
    assert.ok(Array.isArray(task1.baselines));
    assert.ok(task1.baselines.length > 0);
    assert.ok(task1.baselines[0].label.includes('Baseline'));
    assert.ok(task1.baselines[0].startDate);
    assert.ok(task1.baselines[0].endDate);
  });

  await t.test('2. Finish-to-Start Dependencies & Critical Path: propagates blockers and links', async () => {
    // Load the 3-milestone scenario on seeded contract
    const demoResult = await scheduleService.loadControlTowerDemoScenario({
      contractId: 'contract_seed_01',
      evidenceService,
      evaluationService,
      humanReviewService,
    });
    const schedule = demoResult.schedule;

    assert.equal(schedule.tasks.length, 3);
    assert.equal(schedule.summary.totalMilestones, 3);
    assert.equal(schedule.summary.completedCount, 1); // M1 is APPROVED
    assert.equal(schedule.summary.overdueCount, 1); // M2 failed CI and is overdue
    assert.equal(schedule.summary.blockedByDependencyCount, 1); // M3 blocked by M2

    // Verify dependencies
    assert.ok(schedule.dependencies.length >= 2);
    for (const dep of schedule.dependencies) {
      assert.equal(dep.type, 2, 'Dependencies must be Finish-to-Start (type=2) for Bryntum');
      assert.equal(dep.lag, 0);
      assert.equal(dep.lagUnit, 'day');
      assert.ok(dep.fromEvent, 'Must specify fromEvent');
      assert.ok(dep.toEvent, 'Must specify toEvent');
    }

    // Verify Critical Path task detection
    assert.ok(Array.isArray(schedule.criticalPathTaskIds));
    assert.ok(schedule.criticalPathTaskIds.length > 0);
    assert.ok(schedule.summary.criticalPathCount > 0);

    // Verify that M2 has generated AI Schedule Recovery Proposal
    assert.ok(schedule.proposals.length > 0);
    const prop = schedule.proposals[0];
    assert.ok(prop.delayDays > 0);
    assert.ok(prop.aiRationale.length > 0);
    assert.ok(Array.isArray(prop.supportingEvidenceIds));
  });

  await t.test('3. Financial Invariant: Date Cascading strictly preserves agreedAmountCents', async () => {
    const proposals = proposalRepo.listByContractId('contract_seed_01');
    const pendingProp = proposals.find((p) => p.status === 'PENDING')!;

    assert.ok(pendingProp, 'Pending proposal must exist');
    const milestoneBefore = milestoneRepo.findById(pendingProp.milestoneId)!;
    const initialAgreedAmountCents = milestoneBefore.agreedAmountCents;

    // Rejecting proposal from DEVELOPER role must be forbidden
    assert.throws(
      () => {
        scheduleService.reviewScheduleProposal(
          devUser,
          'contract_seed_01',
          pendingProp.id,
          { decision: 'APPROVE', reason: 'Developer approving own schedule extension' }
        );
      },
      (err: any) => err.statusCode === 403 && err.code === 'SCHEDULE_APPROVAL_FORBIDDEN_FOR_DEVELOPER'
    );

    // Review proposal by CLIENT user
    const reviewRes = scheduleService.reviewScheduleProposal(
      clientUser,
      'contract_seed_01',
      pendingProp.id,
      { decision: 'APPROVE', reason: 'Fiduciary client approval for critical path recovery' }
    );

    assert.equal(reviewRes.proposal.status, 'APPROVED');
    assert.equal(reviewRes.proposal.preservesContractualAmountCents, initialAgreedAmountCents);

    // Verify database state: deadline was extended, but agreedAmountCents is strictly immutable
    const milestoneAfter = milestoneRepo.findById(pendingProp.milestoneId)!;
    assert.equal(
      milestoneAfter.agreedAmountCents,
      initialAgreedAmountCents,
      'Contractual agreed amount MUST NOT change during schedule cascading'
    );
    assert.notEqual(milestoneAfter.deadlineIso, milestoneBefore.deadlineIso, 'Deadline was extended');
  });

  await t.test('4. Empty Schedule & Boundary Handling: handles zero milestones gracefully without crash', async () => {
    // Create contract with 0 milestones (DRAFT state)
    contractRepo.insert({
      id: 'cnt_empty_01',
      title: 'Empty Contract',
      description: 'Zero milestones',
      totalBudgetCents: 100000,
      currency: 'USD',
      clientId: clientUser.id,
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      status: 'DRAFT',
      version: 1,
      policyRules: validPolicyRules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const emptySchedule = scheduleService.getContractSchedule('cnt_empty_01');
    assert.equal(emptySchedule.tasks.length, 0);
    assert.equal(emptySchedule.dependencies.length, 0);
    assert.equal(emptySchedule.criticalPathTaskIds.length, 0);
    assert.equal(emptySchedule.summary.totalMilestones, 0);
    assert.equal(emptySchedule.summary.completedCount, 0);
  });

  await t.test('5. Bryntum Component Source Verification: verifies readOnly, custom columns, and theme styling', () => {
    const compPath = path.resolve(process.cwd(), 'src', 'components', 'BryntumGanttViewer.tsx');
    assert.ok(fs.existsSync(compPath));
    const compSource = fs.readFileSync(compPath, 'utf8');

    // Read-only invariant check
    assert.ok(compSource.includes('readOnly={readOnly}'));
    assert.ok(compSource.includes('readOnly = true'));

    // Custom columns check
    assert.ok(compSource.includes("field: 'scheduleHealth'"), 'Must include Health column');
    assert.ok(compSource.includes("field: 'agreedAmountCents'"), 'Must include Agreed Budget column');
    assert.ok(compSource.includes("field: 'baselineVarianceDays'"), 'Must include Baseline Variance column');

    // Theme and features check
    assert.ok(compSource.includes("import '@bryntum/gantt/gantt.css';"));
    assert.ok(compSource.includes("import '@bryntum/gantt/stockholm-light.css';"));
    assert.ok(compSource.includes('baselinesFeature={{ disabled: false }}'));
    assert.ok(compSource.includes('dependenciesFeature={{ disabled: false }}'));
    assert.ok(compSource.includes('criticalPathsFeature={{ disabled: false }}'));
  });
});
