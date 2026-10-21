import { describe, expect, it } from 'vitest';

import { LIST_PAGE_SIZE, MAP_PAGE_SIZE, dedupeById, flattenPages, nextPageParam } from '@/lib/pagination';
import type { Paged } from '@/types/domain';

interface Row {
  id: string;
}

function page(ids: string[], pageNo: number, totalPages: number, totalItems = 57): Paged<Row> {
  return {
    items: ids.map((id) => ({ id })),
    meta: { page: pageNo, pageSize: LIST_PAGE_SIZE, totalItems, totalPages },
  };
}

describe('목록 페이지 합치기', () => {
  it('한 묶음은 20개, 지도 질의는 계약 상한 100개', () => {
    expect(LIST_PAGE_SIZE).toBe(20);
    expect(MAP_PAGE_SIZE).toBe(100);
  });

  it('dedupeById 는 먼저 온 쪽을 남긴다', () => {
    expect(dedupeById([{ id: 'a' }, { id: 'b' }, { id: 'a' }]).map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('flattenPages 는 순서대로 이어 붙이고 meta 는 마지막 페이지 것을 쓴다', () => {
    const merged = flattenPages([page(['a', 'b'], 1, 3), page(['c'], 2, 3)]);

    expect(merged?.items.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    // `총 N곳`(헤더)과 진행 줄이 가장 최근 서버 값을 본다.
    expect(merged?.meta.page).toBe(2);
    expect(merged?.meta.totalItems).toBe(57);
  });

  it('두 요청 사이에 병원이 늘어 경계가 겹쳐도 같은 카드를 두 번 그리지 않는다', () => {
    const merged = flattenPages([page(['a', 'b'], 1, 2), page(['b', 'c'], 2, 2)]);

    expect(merged?.items.map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('페이지가 하나도 없으면 undefined (아직 아무것도 받지 않았다)', () => {
    expect(flattenPages([])).toBeUndefined();
  });

  it('nextPageParam 은 마지막 페이지에서 undefined — 버튼이 그때 사라진다', () => {
    expect(nextPageParam(page(['a'], 1, 3))).toBe(2);
    expect(nextPageParam(page(['a'], 3, 3))).toBeUndefined();
    expect(nextPageParam(page([], 1, 0, 0))).toBeUndefined();
  });
});
