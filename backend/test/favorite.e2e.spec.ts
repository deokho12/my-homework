import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_ACCOUNTS, SEED_FIXTURES, bearer, createTestApp, logIn } from './support/app';
import type { Session } from './support/app';

/**
 * 찜 e2e.
 *
 * 경로가 `/me/favorites` 라 **주체를 토큰만 정한다** — 남의 찜을 건드릴 표면이 없다.
 * 추가·삭제가 둘 다 멱등인지가 이 스펙의 핵심이다(하트를 두 번 눌러도 같은 결과).
 */
describe('찜 (e2e)', () => {
  let app: INestApplication;
  let user: Session;
  let other: Session;

  const H1 = SEED_FIXTURES.hospitalManagedByH1Admin;
  const H2 = SEED_FIXTURES.hospitalNotManagedByH1Admin;

  beforeAll(async () => {
    app = await createTestApp();
    [user, other] = await Promise.all([logIn(app, SEED_ACCOUNTS.user), logIn(app, SEED_ACCOUNTS.adminH2)]);

    // 이 스펙이 만든 찜만 남기고 시작한다 (다른 스펙·수동 QA 의 잔재 제거).
    await Promise.all(
      [H1, H2].flatMap((id) =>
        [user, other].map((session) =>
          request(app.getHttpServer())
            .delete(`/api/v1/me/favorites/${id}`)
            .set('Authorization', bearer(session.accessToken)),
        ),
      ),
    );
  });

  afterAll(async () => {
    await Promise.all(
      [H1, H2].flatMap((id) =>
        [user, other].map((session) =>
          request(app.getHttpServer())
            .delete(`/api/v1/me/favorites/${id}`)
            .set('Authorization', bearer(session.accessToken)),
        ),
      ),
    );
    await app.close();
  });

  const list = (session: Session, query = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/me/favorites${query}`)
      .set('Authorization', bearer(session.accessToken));

  const add = (session: Session, hospitalId: string) =>
    request(app.getHttpServer())
      .put(`/api/v1/me/favorites/${hospitalId}`)
      .set('Authorization', bearer(session.accessToken));

  const remove = (session: Session, hospitalId: string) =>
    request(app.getHttpServer())
      .delete(`/api/v1/me/favorites/${hospitalId}`)
      .set('Authorization', bearer(session.accessToken));

  it('토큰이 없으면 401 이다', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/me/favorites');

    expect(response.status).toBe(401);
  });

  it('처음에는 빈 목록이다', async () => {
    const response = await list(user);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hospitalIds: [] });
  });

  it('찜하면 목록에 들어간다', async () => {
    expect((await add(user, H1)).status).toBe(204);

    const response = await list(user);

    expect(response.body.hospitalIds).toEqual([H1]);
  });

  it('★ 같은 병원을 다시 찜해도 한 번만 들어간다 (멱등)', async () => {
    await add(user, H1);
    await add(user, H1);

    const response = await list(user);

    expect(response.body.hospitalIds).toEqual([H1]);
  });

  it('최근에 찜한 것이 먼저다', async () => {
    await add(user, H2);

    const response = await list(user);

    expect(response.body.hospitalIds).toEqual([H2, H1]);
  });

  it('★ 다시 찜해도 순서가 바뀌지 않는다 (createdAt 을 갱신하지 않는다)', async () => {
    await add(user, H1);

    const response = await list(user);

    expect(response.body.hospitalIds).toEqual([H2, H1]);
  });

  it('★ 남의 찜은 보이지 않는다', async () => {
    const response = await list(other);

    expect(response.body.hospitalIds).toEqual([]);
  });

  it('expand=hospital 이면 병원 본문을 같은 순서로 함께 준다', async () => {
    const response = await list(user, '?expand=hospital');

    expect(response.status).toBe(200);
    expect(response.body.hospitals.map((h: { id: string }) => h.id)).toEqual(response.body.hospitalIds);
    expect(response.body.hospitals[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) });
  });

  it('expand 없이는 병원 본문을 싣지 않는다 (하트만 그리는 화면이 낭비하지 않게)', async () => {
    const response = await list(user);

    expect(response.body.hospitals).toBeUndefined();
  });

  it('모르는 expand 값은 거절한다', async () => {
    const response = await list(user, '?expand=everything');

    expect(response.status).toBe(422);
  });

  it('해제하면 목록에서 빠진다', async () => {
    expect((await remove(user, H2)).status).toBe(204);

    const response = await list(user);

    expect(response.body.hospitalIds).toEqual([H1]);
  });

  it('★ 찜하지 않은 것을 해제해도 성공이다 (멱등)', async () => {
    expect((await remove(user, H2)).status).toBe(204);
    expect((await remove(user, 'h-does-not-exist')).status).toBe(204);
  });

  it('없는 병원은 찜할 수 없다 — FK 위반으로 500 이 나가지 않게 404 로 거절한다', async () => {
    const response = await add(user, 'h-does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('HOSPITAL_NOT_FOUND');
  });

  it('개인 목록이라 캐시하지 않는다', async () => {
    const response = await list(user);

    expect(response.headers['cache-control']).toBe('no-store');
  });
});
