import { beforeEach, describe, expect, it } from 'vitest';

import { mockDb } from '@/mocks/db';

describe('mockDb', () => {
  beforeEach(() => {
    // setup.ts 가 localStorage 를 이미 비운다. 메모리 캐시도 함께 버려야
    // 같은 파일의 앞 테스트가 남긴 값이 새지 않는다.
    mockDb.reset();
  });

  it('처음 읽으면 fixture seed 를 돌려준다', () => {
    expect(mockDb.read('hospitals').length).toBeGreaterThan(0);
    expect(mockDb.read('doctors').length).toBeGreaterThan(0);
    expect(mockDb.read('consultRequests').length).toBeGreaterThan(0);
    expect(mockDb.read('communityPosts').length).toBeGreaterThan(0);
    expect(mockDb.read('notifications').length).toBeGreaterThan(0);
  });

  it('write 한 값이 다음 read 에 보인다', () => {
    const before = mockDb.read('hospitals');
    mockDb.write('hospitals', before.slice(0, 1));

    expect(mockDb.read('hospitals')).toHaveLength(1);
  });

  it('write 한 값이 localStorage 에 남아 캐시를 버려도 유지된다', () => {
    mockDb.write('hospitals', mockDb.read('hospitals').slice(0, 2));
    mockDb.reset(); // 메모리 캐시만 비운다

    expect(mockDb.read('hospitals')).toHaveLength(2);
  });

  it('seed 를 읽은 직후 localStorage 에 그대로 심어 둔다', () => {
    const seeded = mockDb.read('doctors');

    const raw = window.localStorage.getItem('molarmolar-mockdb-doctors');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toHaveLength(seeded.length);
  });

  it('기존 zustand persist 키에 있던 데이터를 최초 1회 이관한다', () => {
    window.localStorage.setItem(
      'molarmolar-hospitals',
      JSON.stringify({ state: { hospitals: [{ id: 'legacy-1', name: '이관된치과' }] }, version: 0 })
    );
    mockDb.reset();

    const hospitals = mockDb.read('hospitals');
    expect(hospitals).toHaveLength(1);
    expect(hospitals[0].id).toBe('legacy-1');
  });

  it('상담 신청은 requests 필드에서, 커뮤니티 글은 posts 필드에서 이관한다', () => {
    window.localStorage.setItem(
      'molarmolar-consult-requests',
      JSON.stringify({ state: { requests: [{ id: 'legacy-consult' }] }, version: 0 })
    );
    window.localStorage.setItem(
      'molarmolar-community-posts',
      JSON.stringify({ state: { posts: [{ id: 'legacy-post' }] }, version: 0 })
    );
    mockDb.reset();

    expect(mockDb.read('consultRequests')[0].id).toBe('legacy-consult');
    expect(mockDb.read('communityPosts')[0].id).toBe('legacy-post');
  });

  it('깨진 legacy JSON 은 무시하고 seed 로 떨어진다', () => {
    window.localStorage.setItem('molarmolar-hospitals', '{ this is not json');
    mockDb.reset();

    expect(mockDb.read('hospitals').length).toBeGreaterThan(1);
  });

  it('legacy 값이 배열이 아니면 무시하고 seed 로 떨어진다', () => {
    window.localStorage.setItem(
      'molarmolar-doctors',
      JSON.stringify({ state: { doctors: 'not-an-array' }, version: 0 })
    );
    mockDb.reset();

    expect(mockDb.read('doctors').length).toBeGreaterThan(1);
  });
});
