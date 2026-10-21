import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, logIn, SEED_ACCOUNTS, SEED_FIXTURES } from './support/app';

/**
 * =============================================================================
 * 요청서 14 의 확인 항목 1 — `준비중` 이 풀리는 경로 전체
 * =============================================================================
 *
 * "관리자 병원 정보에서 `스케일링` 을 체크하고 저장하면, 홈 '시술로 찾기' 의
 * 스케일링·예방이 `준비중` 이 아니게 되고 그 병원이 나온다."
 *
 * 세 응답이 **하나의 사실**(= `hospital_procedures` 행)에서 나와야 한다는 단정이다.
 * 하나라도 다른 출처를 쓰면 저장 직후 화면 셋이 서로 다른 말을 한다.
 *
 * 이 파일은 시드 병원(h1)의 시술 목록을 건드리므로 **afterAll 에서 정확히 복원한다**
 * (`hospital-write.e2e.spec.ts` 와 같은 규칙 — 다른 파일의 개수 단정이 흔들리면 안 된다).
 */
describe('준비중 해제 경로 (요청서 14 확인 항목 1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminH1: string;
  let originalProcedureIds: string[];

  const hospitalId = SEED_FIXTURES.hospitalManagedByH1Admin;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    adminH1 = (await logIn(app, SEED_ACCOUNTS.adminH1)).accessToken;

    const rows = await prisma.hospitalProcedure.findMany({
      where: { hospitalId },
      orderBy: { procedureId: 'asc' },
      select: { procedureId: true },
    });

    originalProcedureIds = rows.map((row) => row.procedureId);
  });

  afterAll(async () => {
    // 시술 목록을 저장 전 상태로 되돌린다. 결정적 id(`hp-{hospitalId}-{procedureId}`)
    // 규칙까지 시드와 같게 맞춰 재시드가 중복 행을 만들지 않게 한다.
    await prisma.hospitalProcedure.deleteMany({ where: { hospitalId } });
    await prisma.hospitalProcedure.createMany({
      data: originalProcedureIds.map((procedureId) => ({
        id: `hp-${hospitalId}-${procedureId}`,
        hospitalId,
        procedureId,
      })),
    });

    await app.close();
  });

  const procedures = (): request.Test => request(app.getHttpServer()).get('/api/v1/procedures');

  it('저장 전: 스케일링은 준비중이고 분야 목록도 0건이다', async () => {
    const items: { id: string; isAvailable: boolean }[] = (await procedures()).body;

    expect(items.find((item) => item.id === 'scaling')?.isAvailable).toBe(false);

    const hospitals = await request(app.getHttpServer()).get('/api/v1/hospitals?categoryId=prevention');

    expect(hospitals.body.items).toEqual([]);
  });

  it('담당자가 스케일링을 체크해 저장하면 세 응답이 함께 바뀐다', async () => {
    const saved = await request(app.getHttpServer())
      .patch(`/api/v1/hospitals/${hospitalId}`)
      .set('Authorization', bearer(adminH1))
      .send({ procedureIds: [...originalProcedureIds, 'scaling'] });

    expect(saved.status).toBe(200);
    expect(saved.body.procedureIds).toContain('scaling');

    // ① 홈 격자 — 더 이상 준비중이 아니다
    const items: { id: string; isAvailable: boolean; categoryId: string }[] = (await procedures()).body;

    expect(items.find((item) => item.id === 'scaling')?.isAvailable).toBe(true);
    // 같은 분야의 다른 시술은 여전히 준비중이다 (분야가 통째로 열리지 않는다)
    expect(items.find((item) => item.id === 'halitosis')?.isAvailable).toBe(false);
    // 화면이 유도하는 "분야 준비중" 은 이제 거짓이다 — 하나라도 열렸다
    expect(items.filter((item) => item.categoryId === 'prevention').some((item) => item.isAvailable)).toBe(true);

    // ② 분야 목록 — 그 병원이 나온다
    const byCategory = await request(app.getHttpServer()).get('/api/v1/hospitals?categoryId=prevention');

    expect(byCategory.body.items.map((item: { id: string }) => item.id)).toEqual([hospitalId]);

    // ③ 세부 시술 목록 — 같은 병원이 나온다
    const byProcedure = await request(app.getHttpServer()).get('/api/v1/hospitals?procedureId=scaling');

    expect(byProcedure.body.items.map((item: { id: string }) => item.id)).toEqual([hospitalId]);
  });

  it('체크를 풀면 다시 준비중이 된다 — 저장된 컬럼이 아니라 매번 세기 때문이다', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/hospitals/${hospitalId}`)
      .set('Authorization', bearer(adminH1))
      .send({ procedureIds: originalProcedureIds })
      .expect(200);

    const items: { id: string; isAvailable: boolean }[] = (await procedures()).body;

    expect(items.find((item) => item.id === 'scaling')?.isAvailable).toBe(false);
  });
});
