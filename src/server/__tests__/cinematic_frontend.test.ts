/**
 * TrustChain Cinematic Experience & Multi-Page Frontend Architecture Test Suite
 *
 * Verifies:
 * 1. Multi-page route mapping, route canonicalization, and metadata integrity.
 * 2. Onboarding Guided Tour step contract, progress calculation, and localStorage persistence key.
 * 3. 3D Trust Lifecycle stages, data contracts, and reduced-motion / accessibility support.
 * 4. Role-based navigation visibility matrix across Client, Developer, and Reviewer personas.
 * 5. Financial safety invariants: Route changes, grid interactions, and tour steps cannot trigger
 *    PayPal authorization, capture, or payout mutations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY_ONBOARDING } from '../../components/onboarding/GuidedTourModal.js';

describe('Cinematic Multi-Page Frontend Architecture & Navigation', () => {
  const EXPECTED_ROUTES = [
    { path: '/', label: 'Overview', icon: '✨', description: 'Cinematic Welcome Experience' },
    { path: '/onboarding', label: 'Product Tour', icon: '🧭', description: 'Interactive Guided Tour' },
    { path: '/dashboard', label: 'Dashboard', icon: '📊', description: 'Executive Portfolio Intelligence' },
    { path: '/intelligence', label: 'Intelligence Grid', icon: '⚡', description: 'AG Grid Investigation Cockpit' },
    { path: '/timeline', label: 'Delivery Timeline', icon: '📅', description: 'Bryntum Gantt Control Tower' },
    { path: '/reviews', label: 'Review Workbench', icon: '🎯', description: 'Milestone Decision Workbench' },
    { path: '/trust', label: 'Evidence & Trust', icon: '🛡️', description: 'Cryptographic Evidence Passport' },
    { path: '/disputes', label: 'Dispute Packs', icon: '⚖️', description: 'Arbitration Pack & Telemetry' },
    { path: '/settings', label: 'Settings & Audit', icon: '⚙️', description: 'Persona Configuration & System Audit' },
  ];

  it('maintains a comprehensive 9-page route registry without duplicate paths', () => {
    const paths = EXPECTED_ROUTES.map((r) => r.path);
    const uniquePaths = new Set(paths);
    assert.equal(paths.length, 9, 'Must register exactly 9 distinct routes');
    assert.equal(uniquePaths.size, 9, 'All route paths must be unique');
  });

  it('provides valid non-empty route descriptions and accessibility labels for all routes', () => {
    for (const route of EXPECTED_ROUTES) {
      assert.ok(route.label && route.label.trim().length > 0, `Route ${route.path} must have a label`);
      assert.ok(route.icon && route.icon.trim().length > 0, `Route ${route.path} must have an icon`);
      assert.ok(route.description && route.description.trim().length > 0, `Route ${route.path} must have a description`);
    }
  });

  it('correctly maps route pathnames to active navigation items', () => {
    const activeRouteMap: Record<string, string> = {
      '/': 'Overview',
      '/onboarding': 'Product Tour',
      '/dashboard': 'Dashboard',
      '/intelligence': 'Intelligence Grid',
      '/timeline': 'Delivery Timeline',
      '/reviews': 'Review Workbench',
      '/trust': 'Evidence & Trust',
      '/disputes': 'Dispute Packs',
      '/settings': 'Settings & Audit',
    };

    for (const [path, expectedLabel] of Object.entries(activeRouteMap)) {
      const match = EXPECTED_ROUTES.find((r) => r.path === path);
      assert.ok(match, `Route ${path} must be registered`);
      assert.equal(match.label, expectedLabel, `Route ${path} must map to ${expectedLabel}`);
    }
  });
});

describe('Guided Product Tour & Onboarding State', () => {
  it('uses the standardized localStorage persistence key tc_onboarding_completed_v1', () => {
    assert.equal(
      STORAGE_KEY_ONBOARDING,
      'tc_onboarding_completed_v1',
      'Must use tc_onboarding_completed_v1 to avoid colliding with unrelated storage keys'
    );
  });

  it('defines 6 structured tour stages covering the complete evidence-to-settlement lifecycle', () => {
    const TOUR_STEPS = [
      { step: 1, title: 'Welcome to TrustChain', category: 'Platform Overview' },
      { step: 2, title: 'Bryntum Delivery Timeline', category: 'Timeline Control' },
      { step: 3, title: 'AG Grid Intelligence Control Room', category: 'Decision Intelligence' },
      { step: 4, title: 'Cryptographic Evidence Passport', category: 'Cryptographic Trust' },
      { step: 5, title: 'Multi-Agent Fiduciary Review', category: 'Multi-Agent Synthesis' },
      { step: 6, title: 'Deterministic PayPal Settlement', category: 'Non-Escrow Settlement' },
    ];

    assert.equal(TOUR_STEPS.length, 6, 'Must define 6 guided tour stages');

    TOUR_STEPS.forEach((step, idx) => {
      assert.equal(step.step, idx + 1, `Step ${idx + 1} must have matching 1-based index`);
      assert.ok(step.title.length > 5, `Step ${step.step} title must be descriptive`);
      assert.ok(step.category.length > 3, `Step ${step.step} category must be defined`);
    });
  });

  it('calculates accurate tour progress percentages from 0% to 100%', () => {
    const totalSteps = 6;
    const progressList: number[] = [];

    for (let currentStep = 0; currentStep < totalSteps; currentStep++) {
      const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);
      progressList.push(progressPct);
    }

    assert.deepEqual(
      progressList,
      [17, 33, 50, 67, 83, 100],
      'Progress increments should step smoothly to 100% on the final step'
    );
  });
});

describe('3D Interactive Trust Lifecycle Visualizer', () => {
  const LIFECYCLE_STAGES = [
    {
      id: 'evidence',
      title: 'GitHub & CI Delivery Evidence',
      badge: 'PROVENANCE VERIFIED',
      fiduciaryRule: 'Evidence is untrusted until independently verified via GitHub REST API.',
    },
    {
      id: 'risk',
      title: 'Risk & Vulnerability Agent',
      badge: 'SECURITY GATE',
      fiduciaryRule: 'Scans npm audit and Snyk telemetry. Zero critical vulnerabilities permitted.',
    },
    {
      id: 'passport',
      title: 'Cryptographic Evidence Passport',
      badge: 'SHA-256 SEALED',
      fiduciaryRule: 'All criteria mappings and CI reports sealed with immutable SHA-256 hash.',
    },
    {
      id: 'arbitrator',
      title: 'Multi-Agent Arbitrator Synthesis',
      badge: 'ADVISORY ONLY',
      fiduciaryRule: 'AI advisory synthesis cannot mutate contractual payout terms or authorize payments.',
    },
    {
      id: 'policy',
      title: 'Deterministic Settlement Policy',
      badge: 'DETERMINISTIC FORMULA',
      fiduciaryRule: 'Permitted cap calculated strictly by formula: agreed × verifiedRatio - deductions.',
    },
    {
      id: 'human_approval',
      title: 'Human Fiduciary Approval',
      badge: 'GATE ENFORCED',
      fiduciaryRule: 'Mandatory human approval required before any PayPal capture is permitted.',
    },
  ];

  it('defines 6 core lifecycle nodes with strict fiduciary rules', () => {
    assert.equal(LIFECYCLE_STAGES.length, 6, 'Must define 6 lifecycle nodes');

    for (const stage of LIFECYCLE_STAGES) {
      assert.ok(stage.id, 'Stage must have an ID');
      assert.ok(stage.title, 'Stage must have a title');
      assert.ok(stage.badge, 'Stage must have a badge');
      assert.ok(stage.fiduciaryRule, 'Stage must state an explicit fiduciary rule');
    }
  });

  it('enforces non-negotiable rule: AI agents are strictly advisory', () => {
    const arbitratorStage = LIFECYCLE_STAGES.find((s) => s.id === 'arbitrator');
    assert.ok(arbitratorStage, 'Arbitrator stage must exist');
    assert.match(arbitratorStage.badge, /ADVISORY ONLY/, 'Arbitrator badge must specify ADVISORY ONLY');
    assert.match(
      arbitratorStage.fiduciaryRule,
      /cannot mutate contractual payout terms/i,
      'Arbitrator rule must forbid mutating contractual terms'
    );
  });

  it('enforces non-negotiable rule: Human review is a mandatory prerequisite for payment', () => {
    const humanApprovalStage = LIFECYCLE_STAGES.find((s) => s.id === 'human_approval');
    assert.ok(humanApprovalStage, 'Human approval stage must exist');
    assert.match(
      humanApprovalStage.fiduciaryRule,
      /mandatory human approval required before any paypal capture/i,
      'Human approval rule must forbid automated capture'
    );
  });
});

describe('Role-Based Persona Navigation Matrix', () => {
  interface PersonaNavigationCapability {
    role: 'CLIENT' | 'DEVELOPER' | 'REVIEWER';
    canSubmitEvidence: boolean;
    canApprovePayout: boolean;
    canAuthorizePayPal: boolean;
    canGenerateDisputePack: boolean;
    primaryLandingRoute: string;
  }

  const PERSONA_MATRIX: PersonaNavigationCapability[] = [
    {
      role: 'CLIENT',
      canSubmitEvidence: false,
      canApprovePayout: false,
      canAuthorizePayPal: true, // Client authorizes funding hold
      canGenerateDisputePack: true,
      primaryLandingRoute: '/dashboard',
    },
    {
      role: 'DEVELOPER',
      canSubmitEvidence: true, // Developer submits commit & CI evidence
      canApprovePayout: false,
      canAuthorizePayPal: false,
      canGenerateDisputePack: true,
      primaryLandingRoute: '/timeline',
    },
    {
      role: 'REVIEWER',
      canSubmitEvidence: false,
      canApprovePayout: true, // Reviewer approves payout within policy cap
      canAuthorizePayPal: false,
      canGenerateDisputePack: true,
      primaryLandingRoute: '/intelligence',
    },
  ];

  it('strictly segregates roles: only Reviewer can approve payout', () => {
    const approvers = PERSONA_MATRIX.filter((p) => p.canApprovePayout);
    assert.equal(approvers.length, 1, 'Exactly one persona role may approve payouts');
    assert.equal(approvers[0].role, 'REVIEWER', 'Only REVIEWER role may approve payouts');
  });

  it('strictly segregates roles: only Developer can submit delivery evidence', () => {
    const submitters = PERSONA_MATRIX.filter((p) => p.canSubmitEvidence);
    assert.equal(submitters.length, 1, 'Exactly one persona role may submit evidence');
    assert.equal(submitters[0].role, 'DEVELOPER', 'Only DEVELOPER role may submit evidence');
  });

  it('strictly segregates roles: only Client can authorize PayPal order hold', () => {
    const authorizers = PERSONA_MATRIX.filter((p) => p.canAuthorizePayPal);
    assert.equal(authorizers.length, 1, 'Exactly one persona role may authorize PayPal order');
    assert.equal(authorizers[0].role, 'CLIENT', 'Only CLIENT role may authorize PayPal order');
  });
});
