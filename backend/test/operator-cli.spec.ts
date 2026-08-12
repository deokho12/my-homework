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
 * 그래서 이 테스트는 세 가지를 확인한다.
 *
 *   1. CLI 가 실제로 DB 를 바꾼다 (프로세스를 그대로 띄워서 확인한다 — 로직만 import 하면
 *      "npm 스크립트가 실제로 동작하는가" 는 검증되지 않는다)
 *   2. HTTP 로는 어떤 경로로도 역할이 바뀌지 않는다
 *   3. ★ **`--actor` 없이는 실행 자체가 안 된다.** 승격이 기록 없이 성공할 수 있으면
 *      감사가 막으려던 상태 그 자체다. 그래서 exit 2 이고, `users.role` 은 그대로다
 */
const BACKEND_DIR = path.resolve(__dirname, '..');
const SCRIPT = path.join('src', 'scripts', 'operator-role.ts');
const TEMP_EMAIL = 'cli-candidate@operator-spec.example';
const TEMP_ID = 'test-cli-candidate';

/** 기본 행위자. 실행하는 직원의 계정이며 **operator 일 필요는 없다** (아래 부트스트랩 테스트). */
const ACTOR = SEED_ACCOUNTS.operator;
const ACTOR_ARG = `--actor=${ACTOR}`;

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
async function runCliWithEnv(env: Record<string, string>, ...args: string[]): Promise<CliResult> {
  const tsxCli = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [tsxCli, SCRIPT, ...args], {
      cwd: BACKEND_DIR,
      env: { ...process.env, ...env },
    });

    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };

    return { code: failure.code ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

async function runCli(...args: string[]): Promise<CliResult> {
  return runCliWithEnv({}, ...args);
}

/**
 * 성공 출력에서 `audit_logs` 행 id 를 뽑는다. 이 줄이 없으면 감사 기록 없이 성공한 것이므로
 * 곧바로 실패시킨다 (정규식이 곧 출력 계약이다).
 */
function auditIdFrom(stdout: string): string {
  const match = /audit_logs 에 기록했습니다 \(id=([^,]+), actor=([^)]+)\)/.exec(stdout);

  if (!match) {
    throw new Error(`감사 기록 줄이 stdout 에 없습니다:\n${stdout}`);
  }

  return match[1];
}

describe('운영자 부트스트랩 CLI', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  /** `--actor` 이메일에 대응하는 users.id — 감사 행의 actor_user_id 가 이 값이어야 한다 */
  let actorId: string;

  async function roleOf(email: string): Promise<string | undefined> {
    const row = await prisma.user.findUnique({ where: { email }, select: { role: true } });

    return row?.role;
  }

  /** 이 테스트가 만든 감사 행 수 */
  async function auditCount(): Promise<number> {
    return prisma.auditLog.count({ where: { targetId: TEMP_ID } });
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    actorId = (
      await prisma.user.findUniqueOrThrow({ where: { email: ACTOR }, select: { id: true } })
    ).id;

    await prisma.auditLog.deleteMany({ where: { targetId: TEMP_ID } });
    await prisma.user.deleteMany({ where: { email: TEMP_EMAIL } });
    await prisma.user.create({
      data: {
        id: TEMP_ID,
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
    // 이 테스트가 만든 감사 행만 지운다 (audit-log.spec 과 같은 방식 — 개발용 DB 를 쓴다)
    await prisma.auditLog.deleteMany({ where: { targetId: TEMP_ID } });
    await prisma.user.deleteMany({ where: { email: TEMP_EMAIL } });
    // 시드 운영자 계정을 원상복구한다 (마지막 운영자 보호 테스트가 잠시 내려놓는다)
    await prisma.user.update({ where: { email: SEED_ACCOUNTS.operator }, data: { role: 'operator' } });
    await app?.close();
  });

  it('없는 이메일이면 명확히 실패한다 (exit 1)', async () => {
    const result = await runCli('grant', 'nobody@nowhere.example', ACTOR_ARG);

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

  it('★ --actor 가 없으면 실행 자체가 안 된다 (exit 2) — 역할은 그대로다', async () => {
    // 운영자 승격은 이 시스템의 최고 권한 행위다. 기록 없이 성공할 수 있으면 감사가
    // 막으려던 상태 그 자체이므로, 인자 검사를 **DB 를 건드리기 전에** 둔다.
    const auditBefore = await auditCount();

    const blockedGrant = await runCli('grant', TEMP_EMAIL);

    expect(blockedGrant.code).toBe(2);
    expect(blockedGrant.stderr).toContain('--actor=<email> 은 필수입니다');
    expect(blockedGrant.stderr).toContain('사용법');
    // ★ 부분 적용이 없다 — 역할이 바뀌고 감사만 빠지는 상태를 만들지 않는다
    expect(await roleOf(TEMP_EMAIL)).toBe('user');

    // 빈 값(`--actor=`)도 없는 것과 같다. 플래그만(`--actor`) 준 경우도 같다
    expect((await runCli('grant', TEMP_EMAIL, '--actor=')).code).toBe(2);
    expect((await runCli('grant', TEMP_EMAIL, '--actor')).code).toBe(2);
    expect(await roleOf(TEMP_EMAIL)).toBe('user');

    // revoke 도 같다. 대상이 **실제로 operator 인 상태**에서 확인한다 —
    // 인자 검사가 대상 상태보다 먼저이고, 회수도 기록 없이는 되지 않는다
    expect((await runCli('grant', TEMP_EMAIL, ACTOR_ARG)).code).toBe(0);

    const blockedRevoke = await runCli('revoke', TEMP_EMAIL);

    expect(blockedRevoke.code).toBe(2);
    expect(blockedRevoke.stderr).toContain('--actor=<email> 은 필수입니다');
    expect(await roleOf(TEMP_EMAIL)).toBe('operator');

    // 원래 상태로 되돌린다
    expect((await runCli('revoke', TEMP_EMAIL, ACTOR_ARG)).code).toBe(0);
    expect(await roleOf(TEMP_EMAIL)).toBe('user');

    // exit 2 로 막힌 4번은 감사 행을 만들지 않았다. 성공한 grant·revoke 2건만 늘었다
    expect(await auditCount()).toBe(auditBefore + 2);
  });

  it('★ --actor 를 환경변수로 우회할 수 없다 (기본값이 있으면 필수의 의미가 없다)', async () => {
    // 나중에 누가 `.env` 기본값을 붙이면 이 테스트가 막는다.
    const result = await runCliWithEnv(
      { OPERATOR_ACTOR: ACTOR, OPERATOR_ACTOR_EMAIL: ACTOR, ACTOR_EMAIL: ACTOR, AUDIT_ACTOR: ACTOR },
      'grant',
      TEMP_EMAIL,
    );

    expect(result.code).toBe(2);
    expect(await roleOf(TEMP_EMAIL)).toBe('user');
  });

  it('grant 가 기존 계정을 operator 로 올린다 + audit_logs 에 행위자가 남는다', async () => {
    // 대소문자·공백이 섞여도 같은 계정을 찾는다
    const result = await runCli('grant', `  ${TEMP_EMAIL.toUpperCase()}  `, ACTOR_ARG);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('operator 로 올렸습니다');
    expect(result.stdout).toContain('[AUDIT]');
    expect(result.stdout).toContain('action=user.role_grant_operator');
    expect(result.stdout).toContain(`target_user_id=${TEMP_ID}`);
    // 계정 행위자와 OS 사용자가 **둘 다** stdout 줄에 남는다
    expect(result.stdout).toContain(`actor=${ACTOR}`);
    expect(result.stdout).toMatch(/actor_os_user=\S+@\S+/);
    // 실행 중인 서버의 세션 처리 결과가 함께 나온다
    expect(result.stdout).toContain('다시 로그인');

    expect(await roleOf(TEMP_EMAIL)).toBe('operator');

    // ★ audit_logs 에 행이 남고 actor_user_id 가 --actor 로 준 그 사람이다
    const row = await prisma.auditLog.findUniqueOrThrow({ where: { id: auditIdFrom(result.stdout) } });

    expect(row).toMatchObject({
      actorUserId: actorId,
      actorRole: 'operator',
      action: 'user.role_grant_operator',
      targetType: 'user',
      targetId: TEMP_ID,
      hospitalId: null,
      // 대상 계정의 이메일·이름을 마스킹 없이 보고 실행한다
      piiMasked: false,
      beforeValue: 'user',
      afterValue: 'operator',
      ip: null,
    });
    // OS 사용자·호스트는 user_agent 스냅샷으로 남는다 — "누구 계정으로, 어느 머신에서"
    expect(row.userAgent).toMatch(/^cli:operator-role os=\S+@\S+$/);
    // HTTP 요청이 아니라는 것이 requestId 접두어로 구분된다
    expect(row.requestId).toMatch(/^cli-/);
  });

  it('이미 operator 면 아무것도 바꾸지 않고 성공한다 (멱등 — 감사 행도 늘지 않는다)', async () => {
    const auditBefore = await auditCount();
    const result = await runCli('grant', TEMP_EMAIL, ACTOR_ARG);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('이미 operator');
    expect(await roleOf(TEMP_EMAIL)).toBe('operator');
    // 바뀐 것이 없으면 기록할 행위도 없다
    expect(await auditCount()).toBe(auditBefore);
  });

  it('병원 담당자는 operator 로 올리지 않는다 — 역할 분리가 무너진다', async () => {
    const result = await runCli('grant', SEED_ACCOUNTS.adminH1, ACTOR_ARG);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('병원 담당자');
    expect(result.stderr).toContain('h1');
    expect(await roleOf(SEED_ACCOUNTS.adminH1)).toBe('hospital_admin');
  });

  it('마지막 운영자는 --force 없이 회수되지 않는다', async () => {
    // 지금 운영자는 시드 계정과 CLI 대상 2명이다. 시드 계정을 잠시 내려 CLI 대상을
    // "마지막 운영자" 로 만든다.
    // (그 시드 계정이 --actor 이기도 하다 — 행위자는 operator 일 필요가 없으므로 그대로 통한다)
    await prisma.user.update({ where: { email: SEED_ACCOUNTS.operator }, data: { role: 'user' } });

    try {
      const blocked = await runCli('revoke', TEMP_EMAIL, ACTOR_ARG);

      expect(blocked.code).toBe(1);
      expect(blocked.stderr).toContain('마지막 운영자');
      expect(await roleOf(TEMP_EMAIL)).toBe('operator');

      const forced = await runCli('revoke', TEMP_EMAIL, ACTOR_ARG, '--force');

      expect(forced.code).toBe(0);
      expect(forced.stdout).toContain('남은 운영자가 0명');
      expect(await roleOf(TEMP_EMAIL)).toBe('user');
    } finally {
      await prisma.user.update({ where: { email: SEED_ACCOUNTS.operator }, data: { role: 'operator' } });
    }
  });

  it('operator 가 아닌 계정을 revoke 하면 실패한다', async () => {
    const result = await runCli('revoke', SEED_ACCOUNTS.user, ACTOR_ARG);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('operator 가 아닙니다');
    expect(await roleOf(SEED_ACCOUNTS.user)).toBe('user');
  });

  it('grant → revoke 왕복 후 역할이 user 로 돌아오고 감사 행이 2개 남는다', async () => {
    const auditBefore = await auditCount();

    expect((await runCli('grant', TEMP_EMAIL, ACTOR_ARG)).code).toBe(0);
    expect(await roleOf(TEMP_EMAIL)).toBe('operator');

    const revoked = await runCli('revoke', TEMP_EMAIL, ACTOR_ARG);

    expect(revoked.code).toBe(0);
    expect(revoked.stdout).toContain('operator → user');
    expect(await roleOf(TEMP_EMAIL)).toBe('user');

    // 회수도 승격과 같은 무게의 행위다 — before/after 가 뒤집혀 남는다
    const row = await prisma.auditLog.findUniqueOrThrow({ where: { id: auditIdFrom(revoked.stdout) } });

    expect(row).toMatchObject({
      actorUserId: actorId,
      action: 'user.role_revoke_operator',
      targetId: TEMP_ID,
      beforeValue: 'operator',
      afterValue: 'user',
    });
    expect(await auditCount()).toBe(auditBefore + 2);
  });

  it('--actor 로 없는 계정을 주면 실패하고 역할을 바꾸지 않는다 (exit 1)', async () => {
    // audit_logs.actor_user_id 는 NOT NULL + FK 라서 존재하지 않는 행위자를 남길 수 없다.
    // 그것을 INSERT 시점에 터뜨리는 대신 미리 막고, 역할 변경도 하지 않는다.
    const auditBefore = await auditCount();
    const result = await runCli('grant', TEMP_EMAIL, '--actor=nobody@nowhere.example');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('--actor');
    expect(await roleOf(TEMP_EMAIL)).toBe('user');
    expect(await auditCount()).toBe(auditBefore);
  });

  it('★ --actor 는 operator 가 아니어도 된다 — 운영자 0명 부트스트랩에서 실행된다', async () => {
    // 첫 운영자를 만들 때는 승격을 지시할 operator 가 아직 없다. 그래서 행위자 검사는
    // 권한 판정이 아니라 "실재하는 계정인가" 다 (이 CLI 를 돌릴 수 있는 사람은 이미
    // DB 자격증명을 가졌다). 실행하는 직원이 자기 계정을 넘기면 된다.
    const plainUser = await prisma.user.findUniqueOrThrow({
      where: { email: SEED_ACCOUNTS.user },
      select: { id: true, role: true },
    });

    expect(plainUser.role).toBe('user');

    const granted = await runCli('grant', TEMP_EMAIL, `--actor=${SEED_ACCOUNTS.user}`);

    expect(granted.code).toBe(0);
    expect(await roleOf(TEMP_EMAIL)).toBe('operator');

    const row = await prisma.auditLog.findUniqueOrThrow({ where: { id: auditIdFrom(granted.stdout) } });

    expect(row.actorUserId).toBe(plainUser.id);
    // 행위 시점의 역할 스냅샷이다 (users.role 을 나중에 조인하지 않는다)
    expect(row.actorRole).toBe('user');

    // 원래 상태(user)로 되돌린다
    expect((await runCli('revoke', TEMP_EMAIL, `--actor=${SEED_ACCOUNTS.user}`)).code).toBe(0);
    expect(await roleOf(TEMP_EMAIL)).toBe('user');
  });

  it('★ HTTP 로는 역할을 바꿀 수 없다 — 승격 엔드포인트가 존재하지 않는다', async () => {
    const session = await logIn(app, SEED_ACCOUNTS.user);
    const probes: Array<[string, string]> = [
      ['post', '/api/v1/auth/promote'],
      ['post', '/api/v1/users/promote'],
      ['patch', '/api/v1/auth/me'],
      ['put', `/api/v1/users/${session.user.id}/role`],
      ['post', '/api/v1/operators'],
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
