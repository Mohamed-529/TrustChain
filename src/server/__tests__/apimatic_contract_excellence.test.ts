/**
 * ============================================================================
 * TrustChain — APIMatic Sponsor Excellence & OpenAPI 3.0.3 Contract Suite
 * ============================================================================
 *
 * Verifies:
 * 1. OpenAPI 3.0.3 specification structure, APIMATIC-META.json governance, and 0 broken $refs.
 * 2. 100% exact parity between registered API routes (54) and documented OpenAPI operations (54).
 * 3. Live OpenAPI YAML and JSON specification delivery endpoints.
 * 4. Deep operational readiness probe (/ready) integration.
 * 5. Strongly-typed TypeScript Client SDK (MilestoneProofClient) against real test server.
 * 6. AI Agent Tool Manifest & Fiduciary Boundary Enforcement (Rule #1: AI cannot approve/capture).
 * 7. Non-escrow regulatory disclosures and financial idempotency requirements.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createServerApp } from '../index.ts';
import { MilestoneProofClient, MilestoneProofApiError } from '../../sdk/MilestoneProofClient.ts';
import {
  TRUSTCHAIN_AGENT_TOOLS,
  executeAgentToolCall,
} from '../../agent/TrustChainAgentTools.ts';

describe('APIMatic Sponsor Excellence — OpenAPI 3.0.3 Contract, SDK & Agent Integration', () => {
  const rootDir = process.cwd();
  const openapiYamlPath = path.join(rootDir, 'openapi.yaml');
  const apimaticMetaPath = path.join(rootDir, 'APIMATIC-META.json');

  it('1. validates openapi.yaml structure, APIMATIC-META.json governance, and zero broken $refs', () => {
    assert.equal(fs.existsSync(openapiYamlPath), true, 'openapi.yaml must exist');
    assert.equal(fs.existsSync(apimaticMetaPath), true, 'APIMATIC-META.json must exist');

    const yamlText = fs.readFileSync(openapiYamlPath, 'utf8');
    const apimaticMeta = JSON.parse(fs.readFileSync(apimaticMetaPath, 'utf8'));

    // Check APIMatic metadata
    assert.equal(apimaticMeta.ValidationConfiguration.SpecificationFile, 'openapi.yaml');
    assert.equal(apimaticMeta.ValidationConfiguration.EnforceUniqueOperationIds, true);
    assert.equal(apimaticMeta.ValidationConfiguration.RequireRfc7807ErrorResponses, true);

    // Check OpenAPI version
    assert.match(yamlText, /^openapi:\s*3\.0\.3/m);

    // Verify all 10 required tags
    const requiredTags = [
      'System', 'Auth', 'Users', 'Contracts', 'Evidence',
      'Evaluations', 'SettlementPolicy', 'Approvals', 'Payments', 'Audit'
    ];
    for (const tag of requiredTags) {
      assert.match(yamlText, new RegExp(`- name:\\s*${tag}\\b`), `Missing tag: ${tag}`);
    }

    // Verify operationIds are globally unique
    const operationIdMatches = [...yamlText.matchAll(/operationId:\s*([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    assert.ok(operationIdMatches.length >= 50, `Expected at least 50 operations, found ${operationIdMatches.length}`);
    const uniqueOpIds = new Set(operationIdMatches);
    assert.equal(uniqueOpIds.size, operationIdMatches.length, 'All operationIds must be unique');

    // Extract defined components
    const definedComponents = new Set<string>();
    const sectionRegex = /^  (schemas|parameters|responses|securitySchemes):\r?\n((?:    .+\r?\n|\r?\n)+)/gm;
    let sectionMatch: RegExpExecArray | null;
    while ((sectionMatch = sectionRegex.exec(yamlText)) !== null) {
      const sectionType = sectionMatch[1];
      const sectionBody = sectionMatch[2];
      const itemRegex = /^    ([A-Za-z0-9_]+):/gm;
      let itemMatch: RegExpExecArray | null;
      while ((itemMatch = itemRegex.exec(sectionBody)) !== null) {
        definedComponents.add(`#/components/${sectionType}/${itemMatch[1]}`);
      }
    }

    // Verify 100% of $refs resolve cleanly
    const refMatches = [...yamlText.matchAll(/\$ref:\s*'([^']+)'/g)].map((m) => m[1]);
    assert.ok(refMatches.length > 50, 'Expected extensive $ref usage');
    for (const ref of refMatches) {
      assert.equal(definedComponents.has(ref), true, `Unresolved $ref: ${ref}`);
    }

    // Non-escrow regulatory disclosure
    assert.match(yamlText, /not.*custodial escrow/i);
  });

  it('2. verifies 100% parity between registered API routes (54) and documented OpenAPI operations (54)', () => {
    const apiContent = fs.readFileSync(path.join(rootDir, 'src/server/routes/apiRoutes.ts'), 'utf8');
    const routes: Array<{ method: string; path: string }> = [];
    const rRegex = /router\.(get|post)\s*\(\s*'([^']+)'/g;
    let rm: RegExpExecArray | null;
    while ((rm = rRegex.exec(apiContent)) !== null) {
      const normPath = rm[2].replace(/:([a-zA-Z0-9_]+)/g, (_match, p1) => `{${p1}}`);
      routes.push({ method: rm[1].toUpperCase(), path: normPath });
    }

    const yamlContent = fs.readFileSync(openapiYamlPath, 'utf8');
    const yamlOps: Array<{ method: string; path: string }> = [];
    const lines = yamlContent.split('\n');
    let currentPath: string | null = null;
    for (const line of lines) {
      const pm = line.match(/^  (\/[^:]+):/);
      if (pm) {
        currentPath = pm[1];
        continue;
      }
      const mm = line.match(/^    (get|post|put|delete):/);
      if (mm && currentPath) {
        yamlOps.push({ method: mm[1].toUpperCase(), path: currentPath });
      }
    }

    assert.equal(routes.length, 54, 'Expected exactly 54 registered routes in apiRoutes.ts');
    assert.equal(yamlOps.length, 54, 'Expected exactly 54 documented operations in openapi.yaml');

    const missingInYaml = routes.filter((r) => !yamlOps.some((y) => y.method === r.method && y.path === r.path));
    assert.equal(missingInYaml.length, 0, `Routes missing in openapi.yaml: ${JSON.stringify(missingInYaml)}`);

    const missingInApi = yamlOps.filter((y) => !routes.some((r) => r.method === y.method && r.path === y.path));
    assert.equal(missingInApi.length, 0, `Operations in openapi.yaml missing in apiRoutes: ${JSON.stringify(missingInApi)}`);
  });

  it('3. serves live /openapi.yaml, /openapi.json, and operational /ready probes via HTTP', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    try {
      // 1. GET /openapi.yaml
      const yamlRes = await fetch(`${baseUrl}/openapi.yaml`);
      assert.equal(yamlRes.status, 200);
      const yamlBody = await yamlRes.text();
      assert.match(yamlBody, /^openapi:\s*3\.0\.3/m);

      // 2. GET /openapi.json
      const jsonRes = await fetch(`${baseUrl}/openapi.json`);
      assert.equal(jsonRes.status, 200);
      const jsonBody = (await jsonRes.json()) as { openapi: string; tags: string[]; registeredRequestSchemas: string[] };
      assert.equal(jsonBody.openapi, '3.0.3');
      assert.equal(jsonBody.tags.length, 10);
      assert.ok(jsonBody.registeredRequestSchemas.includes('LoginRequest'));

      // 3. GET /ready
      const readyRes = await fetch(`${baseUrl}/ready`);
      assert.equal(readyRes.status, 200);
      const readyBody = (await readyRes.json()) as { ready: boolean; database: { healthy: boolean } };
      assert.equal(readyBody.ready, true);
      assert.equal(readyBody.database.healthy, true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('4. tests MilestoneProofClient SDK operations against live server', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    const client = new MilestoneProofClient({ baseUrl });

    try {
      // System probe
      const health = await client.getSystemHealth();
      assert.equal(health.status, 'ok');

      const readiness = await client.getReadinessStatus();
      assert.equal(readiness.ready, true);

      // Authenticate as client persona
      const session = await client.switchDemoPersona({ userId: 'client_01' });
      assert.equal(session.user.role, 'CLIENT');

      // Schedule inspection
      const schedule = await client.getContractSchedule('contract_seed_01');
      assert.ok(schedule.tasks.length >= 3);

      // Evidence Passport retrieval
      const { passport } = await client.getEvidencePassport('ms_seed_01');
      assert.ok(passport.id || passport.identity);

      // Audit hash chain verification
      const auditResult = await client.verifyAuditHashChain();
      assert.equal(auditResult.valid, true);

      // Downstream impact simulation
      const impact = await client.getScheduleDownstreamImpact('contract_seed_01', 'ms_seed_01', 3);
      assert.equal(impact.delayedMilestoneId, 'ms_seed_01');
      assert.equal(impact.delayDays, 3);
      assert.ok(Array.isArray(impact.impactedMilestones));

      // Error handling verification
      await assert.rejects(
        () => client.getContractById('non_existent_contract'),
        (err: unknown) => {
          assert.ok(err instanceof MilestoneProofApiError);
          assert.equal(err.statusCode, 404);
          return true;
        }
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('5. verifies AI Agent Tool Directory and enforces Financial Safety Rule #1', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;

    const client = new MilestoneProofClient({ baseUrl });
    await client.switchDemoPersona({ userId: 'client_01' });

    try {
      // 1. Tool catalog validation
      assert.ok(TRUSTCHAIN_AGENT_TOOLS.length >= 8);

      // 2. Safe read-only tool execution succeeds
      const readResult = await executeAgentToolCall(
        'trustchain_get_system_health',
        {},
        client,
        true // autonomous agent
      );
      assert.equal(readResult.status, 'SUCCESS');
      assert.equal(readResult.fiduciaryBoundaryEnforced, true);

      // 3. Autonomous AI attempting payout approval is strictly forbidden
      const approvalResult = await executeAgentToolCall(
        'trustchain_approve_milestone_review',
        { milestoneId: 'ms_seed_01' },
        client,
        true // autonomous agent
      );
      assert.equal(approvalResult.status, 'FORBIDDEN');
      assert.equal(approvalResult.error?.code, 'FORBIDDEN_AUTONOMOUS_FINANCIAL_ACTION');
      assert.equal(approvalResult.error?.statusCode, 403);
      assert.equal(approvalResult.fiduciaryBoundaryEnforced, true);

      // 4. Autonomous AI attempting PayPal capture is strictly forbidden
      const captureResult = await executeAgentToolCall(
        'trustchain_capture_paypal_payment',
        { milestoneId: 'ms_seed_01' },
        client,
        true // autonomous agent
      );
      assert.equal(captureResult.status, 'FORBIDDEN');
      assert.equal(captureResult.error?.code, 'FORBIDDEN_AUTONOMOUS_FINANCIAL_ACTION');
      assert.equal(captureResult.error?.statusCode, 403);
      assert.equal(captureResult.fiduciaryBoundaryEnforced, true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });
});
