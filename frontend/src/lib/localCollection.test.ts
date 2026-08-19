import { describe, expect, it } from 'vitest';

import {
  clearCollection,
  pageLocalRows,
  readCollection,
  resetCollectionCache,
  writeCollection,
} from '@/lib/localCollection';

/**
 * 삭제된 `src/mocks/db.test.ts` 를 옮겨 온 것이다. 검증 대상은 그대로다 —
 * 시드·영속·zustand persist 이관. 여기에 페이지네이션 보조가 더해졌다.
 *
 * `setup.ts` 가 매 테스트마다 localStorage 와 메모리 캐시를 함께 비운다.
 */
describe('localCollection — 읽기·쓰기', () => {
  it('처음 읽으면 fixture seed 를 돌려준다', () => {
    expect(readCollection('consultRequests').length).toBeGreaterThan(0);
    expect(readCollection('communityPosts').length).toBeGreaterThan(0);
    expect(readCollection('notifications').length).toBeGreaterThan(0);
  });

  it('찜은 시드가 없어 빈 목록에서 시작한다', () => {
    expect(readCollection('favoriteHospitalIds')).toEqual([]);
  });

  it('clearCollection 은 그 컬렉션을 비운다 (로그아웃 시 찜 비우기 경로)', () => {
    writeCollection('favoriteHospitalIds', ['h1', 'h2']);

    clearCollection('favoriteHospitalIds');

    expect(readCollection('favoriteHospitalIds')).toEqual([]);
  });

  it('write 한 값이 다음 read 에 보인다', () => {
    writeCollection('notifications', readCollection('notifications').slice(0, 1));

    expect(readCollection('notifications')).toHaveLength(1);
  });

  it('write 한 값이 localStorage 에 남아 캐시를 버려도 유지된다', () => {
    writeCollection('notifications', readCollection('notifications').slice(0, 2));
    resetCollectionCache(); // 메모리 캐시만 비운다

    expect(readCollection('notifications')).toHaveLength(2);
  });

  it('seed 를 읽은 직후 localStorage 에 그대로 심어 둔다', () => {
    const seeded = readCollection('consultRequests');

    const raw = window.localStorage.getItem('molarmolar-local-consultRequests');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveLength(seeded.length);
  });
});

describe('localCollection — zustand persist 이관', () => {
  it('기존 persist 키에 있던 데이터를 최초 1회 이관한다', () => {
    window.localStorage.setItem(
      'molarmolar-notifications',
      JSON.stringify({ state: { notifications: [{ id: 'legacy-1' }] }, version: 0 })
    );
    resetCollectionCache();

    const notifications = readCollection('notifications');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe('legacy-1');
  });

  it('컬렉션마다 다른 필드 이름에서 이관한다', () => {
    window.localStorage.setItem(
      'molarmolar-consult-requests',
      JSON.stringify({ state: { requests: [{ id: 'legacy-consult' }] }, version: 0 })
    );
    window.localStorage.setItem(
      'molarmolar-community-posts',
      JSON.stringify({ state: { posts: [{ id: 'legacy-post' }] }, version: 0 })
    );
    window.localStorage.setItem(
      'molarmolar-favorites',
      JSON.stringify({ state: { hospitalIds: ['h9'] }, version: 0 })
    );
    resetCollectionCache();

    expect(readCollection('consultRequests')[0].id).toBe('legacy-consult');
    expect(readCollection('communityPosts')[0].id).toBe('legacy-post');
    expect(readCollection('favoriteHospitalIds')).toEqual(['h9']);
  });

  it('깨진 legacy JSON 은 무시하고 seed 로 떨어진다', () => {
    window.localStorage.setItem('molarmolar-notifications', '{ this is not json');
    resetCollectionCache();

    expect(readCollection('notifications').length).toBeGreaterThan(1);
  });

  it('legacy 값이 배열이 아니면 무시하고 seed 로 떨어진다', () => {
    window.localStorage.setItem(
      'molarmolar-community-posts',
      JSON.stringify({ state: { posts: 'not-an-array' }, version: 0 })
    );
    resetCollectionCache();

    expect(readCollection('communityPosts').length).toBeGreaterThan(1);
  });
});

describe('pageLocalRows', () => {
  const rows = Array.from({ length: 25 }, (_, index) => index);

  it('계약의 기본값(page=1, pageSize=20)을 쓴다', () => {
    const page = pageLocalRows(rows);

    expect(page.items).toHaveLength(20);
    expect(page.meta).toEqual({ page: 1, pageSize: 20, totalItems: 25, totalPages: 2 });
  });

  it('마지막 페이지는 남은 만큼만 담는다', () => {
    expect(pageLocalRows(rows, 2).items).toEqual([20, 21, 22, 23, 24]);
  });

  it('pageSize 는 계약 상한(100)을 넘지 않는다', () => {
    expect(pageLocalRows(rows, 1, 500).meta.pageSize).toBe(100);
  });

  it('0건이면 totalPages 가 0 이다', () => {
    expect(pageLocalRows([]).meta).toEqual({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  });
});
