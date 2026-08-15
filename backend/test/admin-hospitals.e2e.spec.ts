import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BCRYPT_COST } from '../src/auth/password.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, logIn, seedPassword, SEED_ACCOUNTS } from './support/app';

/**
 * `hospital_admins` 행이 없는 `hospital_admin` 계정. 시드에는 이 조합이 없다(병원마다
 * 담당자가 1명씩 있다 — `test/support/app.ts` 주석). 담당 미배정 상태(스코프 회귀의 실제
 * 표적)를 검증하려면 이 파일이 직접 만들고 지운다 — 시드 행은 건드리지 않는다
 * (`test/auth-accounts.e2e.spec.ts` 와 같은 관례).
 */
const UNASSIGNED_ADMIN_EMAIL = 'unassigned-admin@admin-hospitals-spec.example';
const UNASSIGNED_ADMIN_ID = 'test-unassigned-admin';

describe('GET /api/v1/admin/hospitals', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let operator: string;
  let adminH1: string;
  let user: string;
  let unassignedAdmin: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // 이전 실행이 중단됐을 수 있으니 시작할 때도 정리한다
    await prisma.user.deleteMany({ where: { email: UNASSIGNED_ADMIN_EMAIL } });
    await prisma.user.create({
      data: {
        id: UNASSIGNED_ADMIN_ID,
        email: UNASSIGNED_ADMIN_EMAIL,
        name: '담당 미배정 관리자',
        provider: 'email',
        role: 'hospital_admin',
        // 시드와 같은 비밀번호로 해시해야 `logIn()`(seedPassword() 를 쓴다)이 통과한다.
        passwordHash: await bcrypt.hash(seedPassword(), BCRYPT_COST),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    // `hospital_admins` 행을 만들지 않는다 — 이 계정의 핵심은 "담당 병원이 아직 없다" 다.

    operator = (await logIn(app, SEED_ACCOUNTS.operator)).accessToken;
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;
    user = (await logIn(app, SEED_ACCOUNTS.user)).accessToken;
    unassignedAdmin = (await logIn(app, UNASSIGNED_ADMIN_EMAIL)).accessToken;
  });

  afterAll(async () => {
    // 조용히 무시하지 않는다 — 실패하면 원인이 드러나야 한다 (seed-data.spec.ts 가 사용자
    // 19명을 기대하므로, 지우지 못하면 다음 파일이 그 이유를 알 수 없는 채로 깨진다).
    const deleted = await prisma.user.deleteMany({ where: { email: UNASSIGNED_ADMIN_EMAIL } });

    if (deleted.count !== 1) {
      throw new Error(`정리 실패 — ${UNASSIGNED_ADMIN_EMAIL} 이 ${deleted.count}건 삭제됐어요 (기대: 1)`);
    }

    await app.close();
  });

  const get = (token: string | null): request.Test => {
    const test = request(app.getHttpServer()).get('/api/v1/admin/hospitals');

    return token === null ? test : test.set('Authorization', bearer(token));
  };

  it('담당자는 담당 병원만 보고 scope 가 managed 다', async () => {
    const response = await get(adminH1);

    expect(response.status).toBe(200);
    expect(response.body.scope).toBe('managed');
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual(['h1']);
  });

  it('운영자는 전 병원을 보고 scope 가 all 이다', async () => {
    const response = await get(operator);

    expect(response.status).toBe(200);
    expect(response.body.scope).toBe('all');
    expect(response.body.items.length).toBeGreaterThan(1);
  });

  it('일반 사용자는 403 이다', async () => {
    expect((await get(user)).status).toBe(403);
  });

  it('비로그인은 401 이다', async () => {
    expect((await get(null)).status).toBe(401);
  });

  it('캐시하지 않는다', async () => {
    const response = await get(adminH1);

    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('광고 현황 표시용 sponsorship 계산 필드가 항상 있다', async () => {
    const response = await get(adminH1);

    expect(response.body.items[0].sponsorship).toEqual({
      isActive: expect.any(Boolean),
      isPlacementEligible: expect.any(Boolean),
    });
  });

  /**
   * ★ 권한 상승 방지의 핵심 케이스. `hospital_admins` 행이 0개인 담당자는 빈 목록을
   * 받아야 한다 — 배열 길이로 "전체" 로 분기하면 이 테스트가 실패하고(전 병원이 보임),
   * 역할로 분기하면 통과한다. 이 테스트가 있어야 미래의 길이 기준 회귀를 잡는다.
   */
  it('담당 병원이 아직 없는 담당자는 200 + 빈 목록이다 (전 병원이 아니다)', async () => {
    const response = await get(unassignedAdmin);

    expect(response.status).toBe(200);
    expect(response.body.scope).toBe('managed');
    expect(response.body.items).toEqual([]);
    expect(response.body.meta.totalItems).toBe(0);
  });
});
