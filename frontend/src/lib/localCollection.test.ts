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
 * **상담·알림은 2026-10-22(요청서 15)에 서버로 가면서 이 파일을 떠났다.** 남은 컬렉션은
 * 커뮤니티·문의·찜 셋이다 (문의와 찜은 요청서 16 의 범위).
 *
 * `setup.ts` 가 매 테스트마다 localStorage 와 메모리 캐시를 함께 비운다.
 */
describe('localCollection — 읽기·쓰기', () => {
  it('처음 읽으면 fixture seed 를 돌려준다', () => {
    expect(readCollection('communityPosts').length).toBeGreaterThan(0);
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
    writeCollection('communityPosts', readCollection('communityPosts').slice(0, 1));

    expect(readCollection('communityPosts')).toHaveLength(1);
  });

  it('write 한 값이 localStorage 에 남아 캐시를 버려도 유지된다', () => {
    writeCollection('communityPosts', readCollection('communityPosts').slice(0, 2));
    resetCollectionCache(); // 메모리 캐시만 비운다

    expect(readCollection('communityPosts')).toHaveLength(2);
  });

  it('seed 를 읽은 직후 localStorage 에 그대로 심어 둔다', () => {
    const seeded = readCollection('communityPosts');

    const raw = window.localStorage.getItem('molarmolar-local-communityPosts');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveLength(seeded.length);
  });
});

describe('localCollection — zustand persist 이관', () => {
  it('기존 persist 키에 있던 데이터를 최초 1회 이관한다', () => {
    window.localStorage.setItem(
      'molarmolar-community-posts',
      JSON.stringify({ state: { posts: [{ id: 'legacy-1' }] }, version: 0 })
    );
    resetCollectionCache();

    const posts = readCollection('communityPosts');
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('legacy-1');
  });

  it('컬렉션마다 다른 필드 이름에서 이관한다', () => {
    window.localStorage.setItem(
      'molarmolar-community-posts',
      JSON.stringify({ state: { posts: [{ id: 'legacy-post' }] }, version: 0 })
    );
    window.localStorage.setItem(
      'molarmolar-favorites',
      JSON.stringify({ state: { hospitalIds: ['h9'] }, version: 0 })
    );
    resetCollectionCache();

    expect(readCollection('communityPosts')[0].id).toBe('legacy-post');
    expect(readCollection('favoriteHospitalIds')).toEqual(['h9']);
  });

  it('상담·알림의 옛 키는 더 이상 읽지 않는다 — 서버로 옮기지 않는다 (요청자 결정)', () => {
    window.localStorage.setItem(
      'molarmolar-consult-requests',
      JSON.stringify({ state: { requests: [{ id: 'legacy-consult' }] }, version: 0 })
    );
    window.localStorage.setItem(
      'molarmolar-notifications',
      JSON.stringify({ state: { notifications: [{ id: 'legacy-notif' }] }, version: 0 })
    );
    resetCollectionCache();

    // 남은 컬렉션 어디에도 섞이지 않는다.
    expect(JSON.stringify(readCollection('communityPosts'))).not.toContain('legacy-consult');
    expect(JSON.stringify(readCollection('inquiries'))).not.toContain('legacy-notif');
  });

  it('깨진 legacy JSON 은 무시하고 seed 로 떨어진다', () => {
    window.localStorage.setItem('molarmolar-community-posts', '{ this is not json');
    resetCollectionCache();

    expect(readCollection('communityPosts').length).toBeGreaterThan(1);
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

describe('브라우저에 남은 옛 시술 id (요청 14)', () => {
  /**
   * 2026-10-21 이전에 저장된 질문 행은 옛 서버 시술 id 를 들고 있다. 그대로 두면 라벨이
   * 붙지 않는다 (`procedureDisplayName` 이 null). 푸는 자리는 **읽기 한 곳**이다 —
   * 화면·훅·api 가 각자 풀면 한 군데를 빠뜨린다.
   *
   * 상담 행도 같은 표를 거쳤지만 2026-10-22 에 서버로 갔다 — 남은 것은 커뮤니티뿐이다.
   */
  it('커뮤니티 글의 옛 id 를 읽는 순간 새 id 로 바꾼다', () => {
    window.localStorage.setItem(
      'molarmolar-local-communityPosts',
      JSON.stringify([
        { id: 'q-1', title: 't', content: 'c', procedureId: 'implant', answers: [] },
        { id: 'q-2', title: 't', content: 'c', procedureId: 'cavity', answers: [] },
      ])
    );
    resetCollectionCache();

    expect(readCollection('communityPosts').map((row) => row.procedureId)).toEqual([
      'implant-general',
      'resin',
    ]);
  });

  it('지금 id·시술 미지정·모르는 값은 그대로 둔다 — 지어내지 않는다', () => {
    window.localStorage.setItem(
      'molarmolar-local-communityPosts',
      JSON.stringify([
        { id: 'q-1', title: 't', content: 'c', procedureId: 'root-canal', answers: [] },
        { id: 'q-2', title: 't', content: 'c', procedureId: null, answers: [] },
        { id: 'q-3', title: 't', content: 'c', procedureId: 'zirconia-bridge', answers: [] },
      ])
    );
    resetCollectionCache();

    expect(readCollection('communityPosts').map((row) => row.procedureId)).toEqual([
      'root-canal',
      null,
      'zirconia-bridge',
    ]);
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
