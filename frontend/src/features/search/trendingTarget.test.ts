import { describe, expect, it } from 'vitest';

import { trendingTargetPath } from '@/features/search/trendingTarget';

/**
 * 홈의 인기 검색어 알약과 검색 화면의 인기 검색어 행이 **같은 목적지**로 가는지를 여기서
 * 고정한다. 예전에는 홈만 `/search?q=` 를 거쳐 두 화면의 결과가 달랐다 (HOME-3).
 */
describe('trendingTargetPath', () => {
  it('시술은 읽은 글자를 먼저 분류에 태운다 — 세부 시술이 걸리면 그 칩까지 연다', () => {
    expect(trendingTargetPath({ kind: 'procedure', procedureId: 'resin' }, '라미네이트')).toBe(
      '/category/aesthetic?sub=laminate'
    );
  });

  it('글자가 분류에 걸리지 않으면 서버 시술 id 로 그 시술을 연다', () => {
    expect(trendingTargetPath({ kind: 'procedure', procedureId: 'resin' }, '없는 말')).toBe(
      '/category/cavity?sub=resin'
    );
  });

  it('taxonomy 가 모르는 시술 id 는 탐색으로 떨어진다 — 빈 화면을 열지 않는다', () => {
    expect(
      trendingTargetPath({ kind: 'procedure', procedureId: 'unknown-procedure' as never })
    ).toBe('/(tabs)/explore');
  });

  it('병원·의사는 그 상세로 바로 간다', () => {
    expect(trendingTargetPath({ kind: 'hospital', hospitalId: 'h1' })).toBe('/hospital/h1');
    expect(trendingTargetPath({ kind: 'doctor', doctorId: 'd1' })).toBe('/doctor/d1');
  });
});
