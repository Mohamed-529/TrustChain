import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createServerApp } from '../index.ts';
import {
  OPENAPI_REQUEST_SCHEMAS,
  validatePayloadAgainstSchema,
} from '../middleware/validateRequest.ts';

describe('Phase 2 — OpenAPI 3.0.3 Contract, APIMatic Governance & Runtime Schema Validation', () => {
  const rootDir = process.cwd();
  const openapiYamlPath = path.join(rootDir, 'openapi.yaml');
  const apimaticMetaPath = path.join(rootDir, 'APIMATIC-META.json');

  it('1. validates openapi.yaml structure, 10 API groups, unique operationIds, and zero broken $refs', () => {
    assert.equal(fs.existsSync(openapiYamlPath), true, 'openapi.yaml must exist at project root');
    assert.equal(
      fs.existsSync(apimaticMetaPath),
      true,
      'APIMATIC-META.json must exist at project root'
    );

    const yamlText = fs.readFileSync(openapiYamlPath, 'utf8');
    const apimaticMeta = JSON.parse(fs.readFileSync(apimaticMetaPath, 'utf8')) as {
      ValidationConfiguration: { SpecificationFile: string };
    };
    assert.equal(apimaticMeta.ValidationConfiguration.SpecificationFile, 'openapi.yaml');

    // Verify OpenAPI version header
    assert.match(yamlText, /^openapi:\s*3\.0\.3/m);

    // Verify all 10 required API tag groups are declared
    const requiredTags = [
      'System',
      'Auth',
      'Users',
      'Contracts',
      'Evidence',
      'Evaluations',
      'SettlementPolicy',
      'Approvals',
      'Payments',
      'Audit',
    ];
    for (const tag of requiredTags) {
      assert.match(
        yamlText,
        new RegExp(`- name:\\s*${tag}\\b`),
        `Missing required OpenAPI tag: ${tag}`
      );
    }

    // Extract all operationIds and verify global uniqueness
    const operationIdMatches = [...yamlText.matchAll(/operationId:\s*([A-Za-z0-9_]+)/g)].map(
      (m) => m[1]
    );
    assert.ok(
      operationIdMatches.length >= 26,
      `Expected at least 26 operations across the 10 API groups, found ${operationIdMatches.length}`
    );
    const uniqueOperationIds = new Set(operationIdMatches);
    assert.equal(
      uniqueOperationIds.size,
      operationIdMatches.length,
      'Every operationId in openapi.yaml must be globally unique for APIMatic SDK generation'
    );

    // Extract all component definitions under schemas, parameters, responses, securitySchemes
    const definedComponents = new Set<string>();
    const sectionRegex =
      /^  (schemas|parameters|responses|securitySchemes):\r?\n((?:    .+\r?\n|\r?\n)+)/gm;
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

    // Extract all $ref pointers and verify 100% resolve to defined components
    const refMatches = [...yamlText.matchAll(/\$ref:\s*'(#\/components\/[^']+)'/g)].map(
      (m) => m[1]
    );
    assert.ok(refMatches.length > 40, 'Expected at least 40 component $ref pointers');
    for (const ref of refMatches) {
      assert.equal(
        definedComponents.has(ref),
        true,
        `Unresolved OpenAPI $ref pointer detected: ${ref}`
      );
    }

    // Verify PayPal mutation endpoints require PayPalRequestIdHeader
    assert.match(yamlText, /\/milestones\/\{id\}\/paypal\/order:[\s\S]*?PayPalRequestIdHeader/);
    assert.match(yamlText, /\/milestones\/\{id\}\/paypal\/authorize:[\s\S]*?PayPalRequestIdHeader/);
    assert.match(yamlText, /\/milestones\/\{id\}\/paypal\/capture:[\s\S]*?PayPalRequestIdHeader/);

    // Verify non-escrow disclosure is explicitly present in the OpenAPI contract
    assert.match(yamlText, /not.*custodial escrow/i);
  });

  it('2. serves live /api/v1/openapi.yaml and /api/v1/openapi.json discovery endpoints', async () => {
    const container = createServerApp({
      dbPath: ':memory:',
      authOptions: { enableDemoImpersonation: true },
    });

    const server = http.createServer(container.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      server.close();
      container.db.close();
      throw new Error('Failed to bind ephemeral port');
    }

    try {
      const yamlRes = await fetch(`http://127.0.0.1:${addr.port}/api/v1/openapi.yaml`);
      assert.equal(yamlRes.status, 200);
      assert.match(yamlRes.headers.get('content-type') ?? '', /text\/yaml/);
      const yamlBody = await yamlRes.text();
      assert.match(yamlBody, /^openapi:\s*3\.0\.3/m);

      const jsonRes = await fetch(`http://127.0.0.1:${addr.port}/api/v1/openapi.json`);
      assert.equal(jsonRes.status, 200);
      const jsonBody = (await jsonRes.json()) as {
        openapi: string;
        tags: string[];
        registeredRequestSchemas: string[];
      };
      assert.equal(jsonBody.openapi, '3.0.3');
      assert.equal(jsonBody.tags.length, 10);
      assert.ok(jsonBody.registeredRequestSchemas.includes('CreateContractRequest'));
      assert.ok(jsonBody.registeredRequestSchemas.includes('SubmitEvidenceRequest'));
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      container.db.close();
    }
  });

  it('3. validates request payloads against OpenAPI 3.0.3 schemas and rejects invalid or extra fields', () => {
    // 3a. LoginRequest rejects client-supplied role (additionalProperties: false)
    const badLogin = validatePayloadAgainstSchema(
      {
        email: 'dev@example.com',
        password: 'ValidPassword123',
        role: 'REVIEWER',
      },
      OPENAPI_REQUEST_SCHEMAS.LoginRequest
    );
    assert.equal(badLogin.valid, false);
    assert.ok(badLogin.violations.some((v) => v.includes("unexpected additional property 'role'")));

    // 3b. SubmitEvidenceRequest validates GitHub HTTPS URL, 40-char hex SHA, CI report, and security scan
    const validEvidence = validatePayloadAgainstSchema(
      {
        repoUrl: 'https://github.com/acme-fintech/payment-service',
        branch: 'main',
        commitSha: '8f4b2c9e1a7d6f3b5c0e9a2d4b6f8a1c3e5d7f9b',
        prUrl: 'https://github.com/acme-fintech/payment-service/pull/42',
        prStatus: 'MERGED',
        ciReport: {
          provider: 'GitHub Actions',
          status: 'SUCCESS',
          totalTests: 48,
          passedTests: 48,
          failedTests: 0,
          coveragePct: 88.4,
          logSummary: '48 passing (2.1s)',
        },
        securityScan: {
          scanner: 'Trivy',
          scannerVersion: '0.50.0',
          status: 'COMPLETED',
          findings: [],
        },
      },
      OPENAPI_REQUEST_SCHEMAS.SubmitEvidenceRequest
    );
    assert.equal(validEvidence.valid, true);
    assert.equal(validEvidence.violations.length, 0);

    // 3c. SubmitEvidenceRequest rejects non-GitHub URL and invalid commit SHA
    const badEvidence = validatePayloadAgainstSchema(
      {
        repoUrl: 'http://evil.example.com/repo',
        branch: 'main',
        commitSha: 'not-a-valid-hex-sha!',
        prUrl: 'https://github.com/acme-fintech/payment-service/pull/42',
        prStatus: 'MERGED',
        ciReport: {
          provider: 'GitHub Actions',
          status: 'SUCCESS',
          totalTests: 10,
          passedTests: 10,
          failedTests: 0,
          coveragePct: 90,
          logSummary: 'ok',
        },
        securityScan: {
          scanner: 'Trivy',
          scannerVersion: '0.50.0',
          status: 'COMPLETED',
          findings: [],
        },
      },
      OPENAPI_REQUEST_SCHEMAS.SubmitEvidenceRequest
    );
    assert.equal(badEvidence.valid, false);
    assert.equal(badEvidence.violations.length, 2);

    // 3d. SubmitReviewRequest rejects floating-point cents or short justification
    const badReview = validatePayloadAgainstSchema(
      {
        evaluationId: 'eval_01',
        decision: 'APPROVE',
        approvedAmountCents: 2500.55,
        justification: 'ok',
      },
      OPENAPI_REQUEST_SCHEMAS.SubmitReviewRequest
    );
    assert.equal(badReview.valid, false);
    assert.ok(badReview.violations.some((v) => v.includes('expected integer')));
    assert.ok(badReview.violations.some((v) => v.includes('string length must be >= 5')));
  });
});
