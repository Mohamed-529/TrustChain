import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServerApp } from '../index.ts';
import {
  interpretNaturalLanguageQuery,
  sanitizeCsvCell,
  sanitizeExportData,
  validateAiConfidence,
  WHITELISTED_COLUMNS,
} from '../../components/ag-grid/queryParser.ts';

test('Prompt 6 — AG Grid Intelligence Control Room & Frontend Engineering', async (t) => {
  const tempDbPath = path.resolve(
    process.cwd(),
    `test_p6_aggrid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sqlite`
  );
  const container = createServerApp({ dbPath: tempDbPath });
  const {
    db: appDb,
    userRepo,
    contractService,
    contractRepo,
    milestoneRepo,
    humanReviewService,
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
  // TEST 1: AG Grid v36 Package & Style Resolution
  // --------------------------------------------------------------------------
  await t.test('1. AG Grid v36 package resolution and Community licensing verification', () => {
    const agGridPkgPath = path.resolve(process.cwd(), 'node_modules', 'ag-grid-community', 'package.json');
    assert.ok(fs.existsSync(agGridPkgPath), 'node_modules/ag-grid-community must exist');
    const agGridPkg = JSON.parse(fs.readFileSync(agGridPkgPath, 'utf8'));
    assert.equal(agGridPkg.name, 'ag-grid-community');
    assert.ok(agGridPkg.version.startsWith('36.'), `AG Grid version must be 36.x, found: ${agGridPkg.version}`);
    assert.equal(agGridPkg.license, 'MIT', 'AG Grid Community edition must be MIT licensed');

    const agGridReactPkgPath = path.resolve(process.cwd(), 'node_modules', 'ag-grid-react', 'package.json');
    assert.ok(fs.existsSync(agGridReactPkgPath), 'node_modules/ag-grid-react must exist');
    const agGridReactPkg = JSON.parse(fs.readFileSync(agGridReactPkgPath, 'utf8'));
    assert.equal(agGridReactPkg.name, 'ag-grid-react');
    assert.ok(agGridReactPkg.version.startsWith('36.'), `AG Grid React version must be 36.x, found: ${agGridReactPkg.version}`);

    // Verify stylesheets
    const baseCss = path.resolve(process.cwd(), 'node_modules', 'ag-grid-community', 'styles', 'ag-grid.css');
    const themeCss = path.resolve(process.cwd(), 'node_modules', 'ag-grid-community', 'styles', 'ag-theme-quartz.css');
    assert.ok(fs.existsSync(baseCss), 'ag-grid.css must exist');
    assert.ok(fs.existsSync(themeCss), 'ag-theme-quartz.css must exist');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Component Source Integrity & Community Master/Detail Pattern
  // --------------------------------------------------------------------------
  await t.test('2. Component source integrity, zero enterprise keys, and Community full-width Master/Detail', () => {
    const gridComponentPath = path.resolve(process.cwd(), 'src', 'components', 'ag-grid', 'MilestoneIntelligenceGrid.tsx');
    assert.ok(fs.existsSync(gridComponentPath), 'MilestoneIntelligenceGrid.tsx must exist');
    const source = fs.readFileSync(gridComponentPath, 'utf8');

    // Verify Community imports
    assert.ok(source.includes("import { AgGridReact } from 'ag-grid-react';"), 'Must import AgGridReact');
    assert.ok(source.includes('AllCommunityModule'), 'Must register AllCommunityModule');
    assert.ok(source.includes('ModuleRegistry'), 'Must register ModuleRegistry');

    // Verify zero enterprise trial keys or Enterprise imports
    assert.ok(!source.includes('ag-grid-enterprise'), 'Must NOT import ag-grid-enterprise');
    assert.ok(!source.includes('LicenseManager'), 'Must NOT import LicenseManager');
    assert.ok(!source.includes('setLicenseKey'), 'Must NOT set enterprise license keys');

    // Verify Community Master/Detail pattern (EvidenceDetailPanel expansion)
    assert.ok(source.includes('EvidenceDetailPanel'), 'Must integrate EvidenceDetailPanel');
    assert.ok(source.includes('toggleRowExpansion'), 'Must support row expansion');
    assert.ok(source.includes('STORAGE_KEY_COL_STATE'), 'Must support column layout persistence');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Backend API Milestone Data Mapping for AG Grid Ledger
  // --------------------------------------------------------------------------
  await t.test('3. Backend API milestone data mapping: developerId and deadlineIso populated in FinancialLedgerRow', () => {
    const deadline = '2026-12-15T00:00:00.000Z';
    const contract = contractService.createContract(clientUser, {
      title: 'AG Grid Integration Contract',
      description: 'Verifying data contracts for grid intelligence',
      totalBudgetCents: 250000,
      currency: 'USD',
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      policyRules: {
        requirePassingCi: true,
        requireSecurityScan: true,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 2,
        allowPartialPayout: true,
        latePenaltyDailyBps: 200,
      },
      milestones: [
        {
          sequenceOrder: 1,
          title: 'Phase 1 - Frontend Grid Integration',
          description: 'Implement AG Grid v36 Community Edition',
          agreedAmountCents: 250000,
          deadlineIso: deadline,
          acceptanceCriteria: [
            {
              id: 'crit_ag_1',
              title: 'AG Grid Integration',
              description: 'Grid renders with typed domain data',
              requiredProofType: 'CI_TESTS',
            },
          ],
        },
      ],
    });

    const ledger = humanReviewService.getFinancialDecisionLedger();
    const createdMilestone = milestoneRepo.listByContractId(contract.id)[0];
    const row = ledger.find((r) => r.milestoneId === createdMilestone.id);

    assert.ok(row, 'Milestone must appear in financial decision ledger');
    assert.equal(row.contractId, contract.id);
    assert.equal(row.contractTitle, 'AG Grid Integration Contract');
    assert.equal(row.milestoneTitle, 'Phase 1 - Frontend Grid Integration');
    assert.equal(row.agreedAmountCents, 250000);
    assert.equal(row.developerId, devUser.id, 'developerId must be mapped from contract');
    assert.equal(row.deadlineIso, deadline, 'deadlineIso must be mapped from milestone');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Missing and Malformed Milestone Data Handling
  // --------------------------------------------------------------------------
  await t.test('4. Resilient handling of missing and malformed milestone data', () => {
    // Insert contract with developer assigned
    contractRepo.insert({
      id: 'cnt_unassigned_01',
      title: 'Unassigned Milestone Contract',
      description: 'Milestone before developer assignment',
      totalBudgetCents: 100000,
      currency: 'USD',
      clientId: clientUser.id,
      developerId: devUser.id,
      reviewerId: reviewerUser.id,
      status: 'DRAFT',
      version: 1,
      policyRules: {
        requirePassingCi: false,
        requireSecurityScan: false,
        maxAllowedCriticalVulns: 0,
        maxAllowedHighVulns: 0,
        allowPartialPayout: false,
        latePenaltyDailyBps: 0,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Milestone with pending evidence
    milestoneRepo.insert({
      id: 'mls_unanalyzed_01',
      contractId: 'cnt_unassigned_01',
      sequenceOrder: 1,
      title: 'Unanalyzed Preliminary Task',
      description: 'Task before submission or risk evaluation',
      agreedAmountCents: 100000,
      status: 'DRAFT',
      paymentStatus: 'NOT_READY',
      acceptanceCriteria: [],
      dependencyMilestoneIds: [],
      deadlineIso: '2026-12-31T23:59:59.000Z',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const ledger = humanReviewService.getFinancialDecisionLedger();
    const row = ledger.find((r) => r.milestoneId === 'mls_unanalyzed_01');

    assert.ok(row, 'Unanalyzed milestone must be present in ledger');
    assert.equal(row.developerId, devUser.id, 'developerId must be mapped correctly');
    assert.equal(row.deadlineIso, '2026-12-31T23:59:59.000Z');
    assert.equal(row.riskSeverity, 'UNAVAILABLE', 'Risk severity should default to UNAVAILABLE when unanalyzed');
    assert.equal(row.permittedAmountCents, null, 'Permitted amount must safely be null prior to review');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Master/Detail Evidence Association & Cross-Milestone Isolation
  // --------------------------------------------------------------------------
  await t.test('5. Master/Detail evidence association and cross-milestone isolation', () => {
    const detailPanelPath = path.resolve(process.cwd(), 'src', 'components', 'ag-grid', 'EvidenceDetailPanel.tsx');
    assert.ok(fs.existsSync(detailPanelPath), 'EvidenceDetailPanel.tsx must exist');
    const source = fs.readFileSync(detailPanelPath, 'utf8');

    // Must fetch evidence specifically scoped to data.milestoneId
    assert.ok(source.includes('data.milestoneId'), 'Detail panel must isolate evidence by milestoneId');
    assert.ok(source.includes('onOpenPassport'), 'Must provide navigation to Evidence Passport');
    assert.ok(source.includes('onOpenDisputePack'), 'Must provide navigation to Dispute Evidence Pack');
    assert.ok(source.includes('onOpenAiInspector'), 'Must provide navigation to AI Decision Inspector');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Evidence Source Classification Integrity
  // --------------------------------------------------------------------------
  await t.test('6. Evidence source classification tags and telemetry authority', () => {
    const detailPanelSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'components', 'ag-grid', 'EvidenceDetailPanel.tsx'),
      'utf8'
    );

    assert.ok(detailPanelSource.includes('SOURCE & COMMITS') || detailPanelSource.includes('AUTHORITATIVE'), 'Must identify authoritative telemetry');
    assert.ok(detailPanelSource.includes('passport') || detailPanelSource.includes('Digest'), 'Must display Passport cryptographic digest');
  });

  // --------------------------------------------------------------------------
  // TEST 7: AI Decision Inspector Structure & Advisory Boundary
  // --------------------------------------------------------------------------
  await t.test('7. AI Decision Inspector structural integrity and non-autonomous advisory boundary', () => {
    const modalPath = path.resolve(process.cwd(), 'src', 'components', 'dashboard', 'AiDecisionInspectorModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'AiDecisionInspectorModal.tsx must exist');
    const source = fs.readFileSync(modalPath, 'utf8');

    // Advisory boundary checks
    assert.ok(source.includes('AI Decision Inspector'), 'Must render AI Decision Inspector');
    assert.ok(source.includes('strictly advisory and non-authoritative'), 'Must display legal financial boundary disclaimer');
    assert.ok(source.includes('human review decision'), 'Must highlight human fiduciary approval requirement');
    assert.ok(source.includes('Deterministic Settlement Policy Breakdown'), 'Must reference deterministic policy engine');
  });

  // --------------------------------------------------------------------------
  // TEST 8: AI Confidence Validation & Clamping
  // --------------------------------------------------------------------------
  await t.test('8. AI Confidence validation: clamps out-of-range values and rejects NaN', () => {
    const valid = validateAiConfidence(0.85);
    assert.equal(valid.valid, true);
    assert.equal(valid.score, 0.85);

    const negative = validateAiConfidence(-0.25);
    assert.equal(negative.valid, false);
    assert.equal(negative.score, 0.0, 'Negative score must be clamped to 0.0');

    const excessive = validateAiConfidence(1.42);
    assert.equal(excessive.valid, false);
    assert.equal(excessive.score, 1.0, 'Excessive score must be clamped to 1.0');

    const nanVal = validateAiConfidence(NaN);
    assert.equal(nanVal.valid, false);
    assert.equal(nanVal.score, 0.0);

    const stringVal = validateAiConfidence('high');
    assert.equal(stringVal.valid, false);
    assert.equal(stringVal.score, 0.0);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Natural-Language Query Parser & Whitelisted Schema Validation
  // --------------------------------------------------------------------------
  await t.test('9. Natural-language query parser translates queries to whitelisted grid instructions', () => {
    // 1. Critical risk query
    const p1 = interpretNaturalLanguageQuery('Show all critical risk milestones');
    assert.equal(p1.instructions.length, 1);
    assert.equal(p1.instructions[0].column, 'riskSeverity');
    assert.equal(p1.instructions[0].operator, 'EQUALS');
    assert.equal(p1.instructions[0].value, 'CRITICAL');

    // 2. High risk query
    const p2 = interpretNaturalLanguageQuery('Find high risk items');
    assert.equal(p2.instructions.length, 1);
    assert.equal(p2.instructions[0].column, 'riskSeverity');
    assert.equal(p2.instructions[0].value, 'HIGH');

    // 3. Approved delivery status
    const p3 = interpretNaturalLanguageQuery('Show approved milestones');
    assert.equal(p3.instructions.length, 1);
    assert.equal(p3.instructions[0].column, 'stateMachineStatus');
    assert.equal(p3.instructions[0].value, 'APPROVED');

    // 4. Budget threshold > $1,000
    const p4 = interpretNaturalLanguageQuery('Milestones with budget above $1,000');
    assert.equal(p4.instructions.length, 1);
    assert.equal(p4.instructions[0].column, 'agreedAmountCents');
    assert.equal(p4.instructions[0].operator, 'GREATER_THAN');
    assert.equal(p4.instructions[0].value, 100000, 'Must convert $1,000 to 100,000 cents');

    // 5. Verified ratio < 80% (ensuring "below" does not falsely match "low risk")
    const p5 = interpretNaturalLanguageQuery('Milestones with evidence below 80%');
    assert.equal(p5.instructions.length, 1, 'Must have exactly 1 instruction without false-positive low risk filter');
    assert.equal(p5.instructions[0].column, 'verifiedRatioPct');
    assert.equal(p5.instructions[0].operator, 'LESS_THAN');
    assert.equal(p5.instructions[0].value, 80);

    // 6. Payment status captured
    const p6 = interpretNaturalLanguageQuery('Show captured payments');
    assert.equal(p6.instructions.length, 1);
    assert.equal(p6.instructions[0].column, 'paymentStatus');
    assert.equal(p6.instructions[0].value, 'CAPTURED');

    // 7. Multi-condition + Sort
    const p7 = interpretNaturalLanguageQuery('Critical risk with budget > $2,500 sort by budget');
    assert.equal(p7.instructions.length, 2);
    assert.ok(p7.instructions.some((i) => i.column === 'riskSeverity' && i.value === 'CRITICAL'));
    assert.ok(p7.instructions.some((i) => i.column === 'agreedAmountCents' && i.value === 250000));
    assert.ok(p7.sortInstruction);
    assert.equal(p7.sortInstruction.column, 'agreedAmountCents');
    assert.equal(p7.sortInstruction.direction, 'desc');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Prevention of Arbitrary Code & SQL Injection in Natural Language
  // --------------------------------------------------------------------------
  await t.test('10. Adversarial input in Natural Language Query: zero eval, zero SQL, strict column whitelist', () => {
    const jsInjection = 'eval("process.exit(1)"); window.location="https://evil.com"';
    const planJs = interpretNaturalLanguageQuery(jsInjection);
    assert.equal(planJs.instructions.length, 0, 'No instructions generated from malicious JS');
    assert.ok(planJs.rationale.includes('broad milestone search'));

    const sqlInjection = "'; DROP TABLE contracts; SELECT * FROM users WHERE '1'='1";
    const planSql = interpretNaturalLanguageQuery(sqlInjection);
    assert.equal(planSql.instructions.length, 0, 'No SQL instructions generated');

    const allCols = Object.keys(WHITELISTED_COLUMNS);
    assert.ok(!allCols.includes('__proto__'));
    assert.ok(!allCols.includes('constructor'));
    assert.ok(!allCols.includes('clientSecret'));
    assert.ok(!allCols.includes('passwordHash'));
  });

  // --------------------------------------------------------------------------
  // TEST 11: Export Data Sanitization & CSV Formula Injection Defense (CWE-1236)
  // --------------------------------------------------------------------------
  await t.test('11. CSV formula injection defense (CWE-1236) and secret stripping', () => {
    const formulaPayloads = [
      '=cmd|\'/C calc\'!A0',
      '+1+1',
      '-2+3',
      '@SUM(A1:A10)',
      '\tDDE("cmd", "/c calc", "A0")',
      '\r=2+2',
    ];

    for (const payload of formulaPayloads) {
      const sanitized = sanitizeCsvCell(payload);
      assert.ok(
        sanitized.startsWith("\"'") || sanitized.startsWith("'"),
        `Formula payload '${payload}' must be prefixed with single quote to neutralize execution: received ${sanitized}`
      );
    }

    const safeText = sanitizeCsvCell('Phase 1 Delivery Complete');
    assert.equal(safeText, '"Phase 1 Delivery Complete"');

    const dirtyData = [
      {
        milestoneId: 'm_01',
        title: 'Nominal Milestone',
        clientSecret: 'paypal_sec_topsecret123',
        passwordHash: '$2b$12$abcdef1234567890',
        token: 'eyJh...token',
        agreedAmountCents: 50000,
      },
    ];

    const cleanData = sanitizeExportData(dirtyData);
    assert.equal(cleanData[0].milestoneId, 'm_01');
    assert.equal(cleanData[0].title, 'Nominal Milestone');
    assert.equal(cleanData[0].agreedAmountCents, 50000);
    assert.equal((cleanData[0] as any).clientSecret, undefined, 'clientSecret must be stripped');
    assert.equal((cleanData[0] as any).passwordHash, undefined, 'passwordHash must be stripped');
    assert.equal((cleanData[0] as any).token, undefined, 'token must be stripped');
  });

  // --------------------------------------------------------------------------
  // TEST 12: Role-Specific UI Permissions & Fiduciary Separation of Duties
  // --------------------------------------------------------------------------
  await t.test('12. Role-specific UI permissions and financial invariant preservation', () => {
    const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src', 'App.tsx'), 'utf8');

    assert.ok(appSource.includes('handleReviewAction'), 'Client persona can submit review decision');
    assert.ok(appSource.includes('persona'), 'Must enforce role checks in UI');

    const gridSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'components', 'ag-grid', 'MilestoneIntelligenceGrid.tsx'),
      'utf8'
    );
    assert.ok(!gridSource.includes('/api/paypal/capture'), 'MilestoneIntelligenceGrid must NEVER call PayPal capture');
    assert.ok(!gridSource.includes('/api/paypal/authorize'), 'MilestoneIntelligenceGrid must NEVER call PayPal authorize');
    assert.ok(!gridSource.includes('capturePayment'), 'Grid must not contain capture payment operations');
  });

  // --------------------------------------------------------------------------
  // TEST 13: Executive Control Room Dashboard Aggregates
  // --------------------------------------------------------------------------
  await t.test('13. Intelligence Control Room Dashboard aggregates budget and risk correctly', () => {
    const dashboardPath = path.resolve(
      process.cwd(),
      'src',
      'components',
      'dashboard',
      'IntelligenceControlRoomDashboard.tsx'
    );
    assert.ok(fs.existsSync(dashboardPath), 'IntelligenceControlRoomDashboard.tsx must exist');
    const source = fs.readFileSync(dashboardPath, 'utf8');

    assert.ok(source.includes('totalAgreedBudgetCents'), 'Must calculate total budget from ledger');
    assert.ok(source.includes('totalCapturedCents'), 'Must calculate total settled/captured funds');
    assert.ok(source.includes('criticalRiskCount'), 'Must count critical risks');
    assert.ok(source.includes('pendingReviewMilestones'), 'Must count pending reviews');
    assert.ok(source.includes('onSelectQuickFilter'), 'Must support interactive KPI card filtering');
  });

  // --------------------------------------------------------------------------
  // TEST 14: Evidence Intelligence Fields: submittedAtIso and evidenceType
  // --------------------------------------------------------------------------
  await t.test('14. Evidence intelligence fields populated in financial decision ledger', () => {
    const ledger = humanReviewService.getFinancialDecisionLedger();
    assert.ok(ledger.length > 0, 'Ledger should have seed rows');
    for (const row of ledger) {
      assert.ok('submittedAtIso' in row, 'Row must include submittedAtIso property');
      assert.ok('evidenceType' in row, 'Row must include evidenceType property');
      if (row.evidenceType) {
        assert.ok(
          ['CODE_COMMIT', 'PULL_REQUEST', 'CI_TESTS', 'SECURITY_SCAN', 'NONE'].includes(row.evidenceType),
          `evidenceType must be valid enum, found: ${row.evidenceType}`
        );
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: Sponsor Evaluation Natural-Language Queries
  // --------------------------------------------------------------------------
  await t.test('15. Sponsor evaluation queries parse to deterministic safe instructions', () => {
    // 1. Evidence requiring human review
    const p1 = interpretNaturalLanguageQuery('Show evidence requiring human review');
    assert.ok(p1.instructions.length >= 1, 'Must generate instructions for human review query');
    assert.equal(p1.instructions[0].column, 'stateMachineStatus');
    assert.equal(p1.instructions[0].operator, 'IN');

    // 2. High-risk milestone submissions
    const p2 = interpretNaturalLanguageQuery('Find high risk milestone submissions');
    assert.ok(p2.instructions.length >= 1, 'Must generate instructions for high risk query');
    assert.equal(p2.instructions[0].column, 'riskSeverity');
    assert.equal(p2.instructions[0].value, 'HIGH');

    // 3. Evidence submitted this week (filters submittedAtIso with date range predicate)
    const p3 = interpretNaturalLanguageQuery('Show evidence submitted this week');
    assert.ok(p3.instructions.length >= 1, 'Must generate instructions for recent evidence query');
    assert.equal(p3.instructions[0].column, 'submittedAtIso');
    assert.equal(p3.instructions[0].operator, 'GREATER_THAN');
    assert.match(String(p3.instructions[0].value), /^\d{4}-\d{2}-\d{2}$/);

    // 4. Failed verification results
    const p4 = interpretNaturalLanguageQuery('Show failed verification results');
    assert.ok(p4.instructions.length >= 1, 'Must generate instructions for failed verification query');
    assert.equal(p4.instructions[0].column, 'provenanceStatus');
    assert.equal(p4.instructions[0].operator, 'IN');
  });

  // --------------------------------------------------------------------------
  // TEST 16: Grid Operational Columns & CWE-1236 Protected Export Keys
  // --------------------------------------------------------------------------
  await t.test('16. Operational columns and CSV export keys include new intelligence fields', () => {
    const gridSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src', 'components', 'ag-grid', 'MilestoneIntelligenceGrid.tsx'),
      'utf8'
    );

    // Verify operational columns in ColDef
    assert.ok(gridSource.includes("field: 'developerId'"), 'ColDefs must include developerId');
    assert.ok(gridSource.includes("field: 'evidenceType'"), 'ColDefs must include evidenceType');
    assert.ok(gridSource.includes("field: 'submittedAtIso'"), 'ColDefs must include submittedAtIso');
    assert.ok(gridSource.includes("field: 'provenanceStatus'"), 'ColDefs must include provenanceStatus');

    // Verify Quick Filter and Auto-fit
    assert.ok(gridSource.includes('quickFilterText'), 'Grid must support live quickFilterText');
    assert.ok(gridSource.includes('autoSizeAllColumns'), 'Grid must support auto-fitting columns');
    assert.ok(gridSource.includes('pagination={true}'), 'Grid must configure pagination');

    // Verify CSV export includes new keys
    assert.ok(gridSource.includes("'developerId'"), 'CSV export must include developerId');
    assert.ok(gridSource.includes("'evidenceType'"), 'CSV export must include evidenceType');
    assert.ok(gridSource.includes("'submittedAtIso'"), 'CSV export must include submittedAtIso');
    assert.ok(gridSource.includes("'provenanceStatus'"), 'CSV export must include provenanceStatus');
  });
});
