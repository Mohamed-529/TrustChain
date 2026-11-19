import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AppDatabase } from '../repositories/Database.ts';
import {
  ContractRepository,
  MilestoneRepository,
  UserRepository,
} from '../repositories/DomainRepositories.ts';
import { ContractService } from '../services/ContractService.ts';
import { AuditService } from '../services/AuditService.ts';
import type { User } from '../../types/domain.ts';

describe('Stage 1 — Dynamic Project Creation and Developer Assignment', () => {
  it('1. Allows Elena Vance (Client) to create Flight Booking System and assign Marcus Chen (Developer) dynamically', () => {
    const testDbPath = path.resolve(os.tmpdir(), `stage1_test_${Date.now()}.sqlite`);
    try {
      const db = new AppDatabase(testDbPath);
      const userRepo = new UserRepository(db.raw);
      const milestoneRepo = new MilestoneRepository(db.raw);
      const contractRepo = new ContractRepository(db.raw, milestoneRepo);
      const auditService = new AuditService(db.raw);
      const contractService = new ContractService(db, userRepo, contractRepo, milestoneRepo, auditService);

      // Verify seed contract exists and is preserved
      const initialContracts = contractService.listContracts();
      assert.ok(initialContracts.some((c) => c.id === 'contract_seed_01'), 'contract_seed_01 must be preserved');

      // Actor: Elena Vance (Client)
      const elenaClient: User = {
        id: 'client_01',
        name: 'Elena Vance',
        email: 'elena.client@acmefintech.example',
        role: 'CLIENT',
        isActive: true,
        isDemoAccount: true,
        createdAt: new Date().toISOString(),
      };

      // 1. Create Flight Booking System project assigned to Marcus Chen (dev_01)
      const createdContract = contractService.createContract(elenaClient, {
        title: 'Flight Booking System',
        description: 'React Native & Expo mobile flight booking system with seat reservation and payment authorization.',
        totalBudgetCents: 550000,
        currency: 'USD',
        developerId: 'dev_01', // Marcus Chen
        // reviewerId omitted -> defaults to elenaClient.id
        policyRules: {
          requirePassingCi: true,
          requireSecurityScan: true,
          maxAllowedCriticalVulns: 0,
          maxAllowedHighVulns: 0,
          allowPartialPayout: true,
          latePenaltyDailyBps: 100,
        },
        milestones: [
          {
            sequenceOrder: 1,
            title: 'Milestone 1: Flight Search & Storefront UI',
            description: 'Expo & React Native flight search, filters, and airport selection state.',
            agreedAmountCents: 250000,
            deadlineIso: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            acceptanceCriteria: [
              {
                id: 'AC-1',
                title: 'Flight Search Screen & Airport Selector',
                description: 'Interactive airport selection and seat availability layout in App.tsx.',
                requiredProofType: 'PULL_REQUEST',
              },
            ],
          },
          {
            sequenceOrder: 2,
            title: 'Milestone 2: Seat Reservation & State Engine',
            description: 'Itinerary state machine and payment authorization integration.',
            agreedAmountCents: 300000,
            deadlineIso: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
            acceptanceCriteria: [
              {
                id: 'AC-2',
                title: 'Itinerary State Machine & Zero CVEs',
                description: 'Clean dependency tree with passing test suite and zero critical CVEs.',
                requiredProofType: 'CI_TESTS',
              },
            ],
          },
        ],
      });

      assert.ok(createdContract.id.startsWith('contract_'), 'Contract ID must be a generated contract UUID');
      assert.notEqual(createdContract.id, 'contract_seed_01', 'Must not fall back to contract_seed_01');
      assert.equal(createdContract.title, 'Flight Booking System');
      assert.equal(createdContract.clientId, 'client_01');
      assert.equal(createdContract.developerId, 'dev_01');
      assert.equal(createdContract.reviewerId, 'client_01', 'Fiduciary reviewer defaults to Client (Elena Vance)');
      assert.equal(createdContract.totalBudgetCents, 550000);
      assert.equal(createdContract.status, 'DRAFT');
      assert.equal(createdContract.milestones?.length, 2);

      // 2. Activate the contract
      const activatedContract = contractService.activateContract(elenaClient, createdContract.id);
      assert.equal(activatedContract.status, 'ACTIVE');

      // 3. Verify Marcus Chen (Developer) sees the assigned contract
      const allContracts = contractService.listContracts();
      const marcusAssignedContracts = allContracts.filter((c) => c.developerId === 'dev_01');
      assert.ok(
        marcusAssignedContracts.some((c) => c.id === createdContract.id && c.title === 'Flight Booking System'),
        'Marcus Chen must see the newly assigned Flight Booking System contract'
      );

      // 4. Verify separation of duties: Marcus cannot assign himself as reviewer or client
      assert.throws(
        () => {
          contractService.createContract(elenaClient, {
            title: 'Invalid Self-Review Contract',
            totalBudgetCents: 100000,
            currency: 'USD',
            developerId: 'dev_01',
            reviewerId: 'dev_01', // Self-dealing attempt
            policyRules: createdContract.policyRules,
            milestones: [
              {
                sequenceOrder: 1,
                title: 'M1',
                description: 'M1',
                agreedAmountCents: 100000,
                deadlineIso: new Date().toISOString(),
                acceptanceCriteria: [],
              },
            ],
          });
        },
        /(SEPARATION_OF_DUTIES_VIOLATION|The assigned Developer cannot be)/,
        'Developer cannot be the financial reviewer'
      );

      // 5. Test persistence across backend database restart
      db.close();

      // Reopen fresh database instance
      const reopenedDb = new AppDatabase(testDbPath);
      const reopenedMilestoneRepo = new MilestoneRepository(reopenedDb.raw);
      const reopenedContractRepo = new ContractRepository(reopenedDb.raw, reopenedMilestoneRepo);
      const persisted = reopenedContractRepo.findById(createdContract.id);

      assert.ok(persisted !== null, 'Created contract must survive database close & restart');
      assert.equal(persisted?.title, 'Flight Booking System');
      assert.equal(persisted?.developerId, 'dev_01');
      assert.equal(persisted?.clientId, 'client_01');
      assert.equal(persisted?.status, 'ACTIVE');
      assert.equal(persisted?.totalBudgetCents, 550000);

      // Verify seed data is also completely intact
      const seedContract = reopenedContractRepo.findById('contract_seed_01');
      assert.ok(seedContract !== null, 'Existing seed contract must remain intact');
      assert.equal(seedContract?.id, 'contract_seed_01');

      reopenedDb.close();
    } finally {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // cleanup
      }
    }
  });
});
