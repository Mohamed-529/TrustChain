import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { AppDatabase } from '../repositories/Database.ts';
import { SessionRepository, UserRepository } from '../repositories/DomainRepositories.ts';
import { AuditService } from '../services/AuditService.ts';
import { AuthService } from '../services/AuthService.ts';

test('Auth registration enforces password policy, rejects duplicates, and authenticates on subsequent sign-in', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'veridex-auth-test-'));
  const dbPath = path.join(tmpDir, 'test.sqlite');
  const db = new AppDatabase(dbPath);
  const userRepo = new UserRepository(db.raw);
  const sessionRepo = new SessionRepository(db.raw);
  const auditSvc = new AuditService(db.raw);
  const authService = new AuthService(db, userRepo, sessionRepo, auditSvc, {
    nodeEnv: 'test',
    enableDemoImpersonation: true,
  });

  try {
    // 1. Reject weak password
    await assert.rejects(
      () =>
        authService.register({
          name: 'Mohamed Test',
          email: 'mohamed.new@example.com',
          password: 'short',
          role: 'CLIENT',
        }),
      /(WEAK_PASSWORD|at least 15 characters|at least 8 characters)/
    );

    // 2. Register valid new user
    const regResult = await authService.register({
      name: 'Mohamed Test',
      email: 'Mohamed.New@Example.com',
      password: 'veridex2026',
      role: 'CLIENT',
    });
    assert.equal(regResult.user.email, 'mohamed.new@example.com');
    assert.equal(regResult.user.role, 'CLIENT');
    assert.equal(regResult.user.name, 'Mohamed Test');

    // 3. Reject duplicate email registration
    await assert.rejects(
      () =>
        authService.register({
          name: 'Duplicate User',
          email: 'mohamed.new@example.com',
          password: 'veridex2026',
          role: 'DEVELOPER',
        }),
      /(EMAIL_ALREADY_EXISTS|already exists)/
    );

    // 4. Reject login with wrong password
    await assert.rejects(
      () =>
        authService.login({
          email: 'mohamed.new@example.com',
          password: 'wrongpassword1',
        }),
      /(INVALID_CREDENTIALS|Invalid email or password)/
    );

    // 5. Authenticate cleanly on Sign In with mixed-case email
    const loginResult = await authService.login({
      email: 'MOHAMED.NEW@EXAMPLE.COM',
      password: 'veridex2026',
    });
    assert.equal(loginResult.user.id, regResult.user.id);
    assert.equal(loginResult.user.role, 'CLIENT');
    assert.ok(loginResult.token.split('.').length === 3);
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
