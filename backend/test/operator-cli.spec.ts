import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, logIn, SEED_ACCOUNTS } from './support/app';

const execFileAsync = promisify(execFile);

/**
 * =============================================================================
 * 부트스트랩 CLI — `npm run operator:grant` / `operator:revoke`
 * =============================================================================
 *
 * docs/decisions/0001-roles-and-pii.md 결정 4: **운영자 승격은 HTTP 로 불가능해야 한다.**
 * 그래서 이 테스트는 두 가지를 확인한다.
 *
 *   1. CLI 가 실제로 DB 를 바꾼다 (프로세스를 그대로 띄워서 확인한다 — 로직만 import 하면
 *      "npm 스크립트가 실제로 동작하는가" 는 검증되지 않는다)
 *   2. HTTP 로는 어떤 경로로도 역할이 바뀌지 않는다
 */
const BACKEND_DIR = path.resolve(__dirname, '..');
const SCRIPT = path.join('src', 'scripts', 'operator-role.ts');
const TEMP_EMAIL = 'cli-candidate@operator-spec.example';

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * `npm run operator:grant -- <email>` 과 같은 명령을 실행한다.
 *
 * `node_modules/.bin/tsx` 대신 tsx 의 JS 진입점을 node 로 직접 부른다 —
 * 윈도우에서 `.cmd` 래퍼를 쓰려면 `shell: true` 가 필요하고, 그러면 인자가
 * 이스케이프되지 않은 채 셸을 거친다(이 테스트는 공백이 든 이메일을 넘긴다).
 */
async function runCli(...args: string[]): Promise<CliResult> {
  const tsxCli = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [tsxCli, SCRIPT, ...args], {
      cwd: BACKEND_DIR,
    });

    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };

    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

describe('운영자 부트스트랩 CLI', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function roleOf(email: string): Promise<string | undefined> {
    const row = await prisma.user.findUnique({ where: { email }, select: { role: true } });

    return row?.role;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({ where: { email: TEMP_EMAIL } });
    await prisma.user.create({
      data: {
        id: 'test-cli-candidate',
        email: TEMP_EMAIL,
        name: 'CLI 승격 대상',
        provider: 'email',
        role: 'user',
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEMP_EMAIL } });
    // 시드 운영자 계정을 원상복구한다 (마지막 운영자 보호 테스트가 잠시 내려놓는다)
    await prisma.user.update({ where: { email: SEED_ACCOUNTS.operator }, data: { role: 'operator' } });
    await app?.close();
  });

  it('없는 이메일이면 명확히 실패한다 (exit 1)', async () => {
    const result = await runCli('grant', 'nobody@nowhere.example');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('가입된 계정이 없습니다');
    // 다음 행동을 알려준다
    expect(result.stderr).toContain('회원가입');
  });

  it('이메일을 빼먹으면 사용법을 보여주고 실패한다 (exit 2)', async () => {
    const result = await runCli('grant');

    expect(result.code).toBe(2);
    expect(result.stderr).toContain('사용법');
  });

  it('grant 가 기존 계정을 operator 로 올린다 + 감사 줄을 남긴다', async () => {
    // 대소문자·공백이 섞여도 같은 계정을 찾는다
    const result = await runCli('grant', `  ${TEMP_EMAIL.toUpperCase()}  `);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('operator 로 올렸습니다');
    expect(result.stdout).toContain('[AUDIT]');
    expect(result.stdout).toContain('action=user.role_grant_operator');
    expect(result.stdout).toContain('target_user_id=test-cli-candidate');
    // 실행 중인 서버의 토큰을 폐기할 수 없다는 경고가 함께 나온다
    expect(result.stdout).toContain('다시 로그인');

    expect(await roleOf(TEMP_EMAIL)).toBe('operator');
  });

  it('이미 operator 면 아무것도 바꾸지 않고 성공한다 (멱등)', async () => {
    const result = await runCli('grant', TEMP_EMAIL);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('이미 operator');
    expect(await roleOf(TEMP_EMAIL)).toBe('operator');
  });

  it('병원 담당자는 operator 로 올리지 않는다 — 역할 분리가 무너진다', async () => {
    const result = await runCli('grant', SEED_ACCOUNTS.adminH1);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('병원 담당자');
    expect(result.stderr).toContain('h1');
    expect(await roleOf(SEED_ACCOUNTS.adminH1)).toBe('hospital_admin');
  });

  it('마지막 운영자는 --force 없이 회수되지 않는다', async () => {
    // 지금 운영자는 시드 계정과 CLI 대상 2명이다. 시드 계정을 잠시 내려 CLI 대상을
    // "마지막 운영자" 로 만든다.
    await prisma.user.update({ where: { email: SEED_ACCOUNTS.operator }, data: { role: 'user' } });

    try {
      const blocked = await runCli('revoke', TEMP_EMAIL);

      expect(blocked.code).toBe(1);
      expect(blocked.stderr).toContain('마지막 운영자');
      expect(await roleOf(TEMP_EMAIL)).toBe('operator');

      const forced = await runCli('revoke', TEMP_EMAIL, '--force');

      expect(forced.code).toBe(0);
      expect(forced.stdout).toContain('남은 운영자가 0명');
      expect(await roleOf(TEMP_EMAIL)).toBe('user');
    } finally {
      await prisma.user.update({ where: { email: SEED_ACCOUNTS.operator }, data: { role: 'operator' } });
    }
  });

  it('operator 가 아닌 계정을 revoke 하면 실패한다', async () => {
    const result = await runCli('revoke', SEED_ACCOUNTS.user);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('operator 가 아닙니다');
    expect(await roleOf(SEED_ACCOUNTS.user)).toBe('user');
  });

  it('grant → revoke 왕복 후 역할이 user 로 돌아온다', async () => {
    expect((await runCli('grant', TEMP_EMAIL)).code).toBe(0);
    expect(await roleOf(TEMP_EMAIL)).toBe('operator');

    const revoked = await runCli('revoke', TEMP_EMAIL);

    expect(revoked.code).toBe(0);
    expect(revoked.stdout).toContain('operator → user');
    expect(await roleOf(TEMP_EMAIL)).toBe('user');
  });

  it('--actor 로 없는 계정을 주면 실패하고 역할을 바꾸지 않는다', async () => {
    // audit_logs.actor_user_id 는 NOT NULL + FK 라서 존재하지 않는 행위자를 남길 수 없다.
    // 그것을 INSERT 시점에 터뜨리는 대신 미리 막고, 역할 변경도 하지 않는다.
    const result = await runCli('grant', TEMP_EMAIL, '--actor=nobody@nowhere.example');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--actor');
    expect(await roleOf(TEMP_EMAIL)).toBe('user');
  });

  it('★ --actor 가 없으면 audit_logs 에 남기지 않고 그 사실을 알린다', async () => {
    // OS 사용자를 행위자로 넣을 수 없다는 것이 스키마의 제약이다 (보고서 항목).
    // 조용히 넘기지 않고 "기록하지 않았다" 를 출력한다 — stdout [AUDIT] 줄은 그대로 남는다.
    const before = await prisma.auditLog.count({ where: { targetId: 'test-cli-candidate' } });

    const granted = await runCli('grant', TEMP_EMAIL);

    expect(granted.code).toBe(0);
    expect(granted.stdout).toContain('audit_logs 에는 기록하지 않았습니다');
    expect(granted.stdout).toContain('[AUDIT]');
    expect(await prisma.auditLog.count({ where: { targetId: 'test-cli-candidate' } })).toBe(before);

    // 원래 상태(user)로 되돌린다
    expect((await runCli('revoke', TEMP_EMAIL)).code).toBe(0);
    expect(await roleOf(TEMP_EMAIL)).toBe('user');
  });

  it('★ HTTP 로는 역할을 바꿀 수 없다 — 승격 엔드포인트가 존재하지 않는다', async () => {
    const session = await logIn(app, SEED_ACCOUNTS.user);
    const probes: Array<[string, string]> = [
      ['post', '/api/auth/promote'],
      ['post', '/api/users/promote'],
      ['patch', '/api/auth/me'],
      ['put', `/api/users/${session.user.id}/role`],
      ['post', '/api/operators'],
    ];

    for (const [method, url] of probes) {
      const agent = request(app.getHttpServer());
      const response = await agent[method as 'post'](url)
        .set('Authorization', bearer(session.accessToken))
        .send({ role: 'operator' });

      // 라우트 자체가 없다 (404). 405 나 2xx 가 나오면 승격 표면이 생긴 것이다.
      expect(response.status).toBe(404);
    }

    expect(await roleOf(SEED_ACCOUNTS.user)).toBe('user');
  });
});
