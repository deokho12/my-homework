import type { Paged } from '@/types/domain';

/**
 * 「더 보기」 목록(병원 탐색·시술 카테고리)의 한 묶음 크기.
 *
 * **요청과 버튼 라벨이 같은 상수를 본다** — `병원 20곳 더 보기` 라고 적어 놓고 `pageSize=30`
 * 을 보내면 아무도 그 불일치를 눈치채지 못한다. 계약 기본값도 20 이지만 **명시적으로 보낸다**:
 * 기본값은 서버가 바꿀 수 있고, 그러면 라벨만 조용히 거짓이 된다 (계약 §5, 최대 100).
 */
export const LIST_PAGE_SIZE = 20;

/** 지도 보기 질의의 한 번 크기 = 계약 상한. 지도에는 「더 보기」가 없다 (설계 §5). */
export const MAP_PAGE_SIZE = 100;

/**
 * 이어 붙인 페이지들의 id 중복 제거. 먼저 들어온 쪽이 이긴다.
 *
 * 서버 정렬은 `id` 로 tie-break 되어 페이지 간 결정적이지만(계약 §22.7), 두 요청 사이에
 * 병원이 **추가**되면 경계의 한 건이 두 페이지에 모두 들어올 수 있다. 그때 React 가
 * 같은 key 두 개를 보게 하지 않는다.
 */
export function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

/**
 * `useInfiniteQuery` 의 페이지들 → 화면이 쓰는 `Paged<T>` 한 장.
 *
 * `meta` 는 **마지막 페이지의 것**을 쓴다 — `totalItems`(= 헤더의 `총 N곳`)가 가장 최근
 * 서버 값이어야 진행 줄(`57곳 중 40곳 보는 중`)과 어긋나지 않는다. 호출부(QueryState·
 * ResultsHeader·CardGrid·PriceCompareTable·HospitalMapView)는 모양이 같아 그대로 돌아간다.
 */
export function flattenPages<T extends { id: string }>(pages: readonly Paged<T>[]): Paged<T> | undefined {
  const lastPage = pages[pages.length - 1];
  if (!lastPage) return undefined;

  return { items: dedupeById(pages.flatMap((page) => page.items)), meta: lastPage.meta };
}

/** 다음 페이지 번호. 마지막 페이지면 `undefined` — `hasNextPage` 가 그것으로 꺼진다. */
export function nextPageParam<T>(lastPage: Paged<T>): number | undefined {
  return lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined;
}
