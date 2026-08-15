/**
 * offset 페이지네이션. 계약이 cursor 가 아니라 offset 을 쓰는 이유는 화면이
 * `총 11곳` 처럼 전체 건수를 표시하기 때문이다 (openapi 공통 규약).
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface PageMeta extends PageParams {
  totalItems: number;
  totalPages: number;
}

/**
 * 호출부가 `page >= 1` 과 `1 <= pageSize <= MAX_PAGE_SIZE` 를 보장해야 한다
 * (엔드포인트의 zod 스키마가 검증한다). 이 함수는 재검증하지 않는다.
 */
export function buildPageMeta(params: PageParams & { totalItems: number }): PageMeta {
  return {
    page: params.page,
    pageSize: params.pageSize,
    totalItems: params.totalItems,
    // 0건일 때 1이 아니라 0이다 — 화면이 "1 / 0 페이지" 를 그리지 않게 한다.
    totalPages: Math.ceil(params.totalItems / params.pageSize),
  };
}

/**
 * 메모리 배열 페이징. **반경 필터가 걸린 병원 목록에서만 쓴다** — 거리 계산이 앱에서
 * 일어나 SQL 의 `LIMIT/OFFSET` 을 쓸 수 없기 때문이다 (Task 6 참고).
 * 반경이 없는 경로는 Prisma 의 `skip`/`take` 를 쓴다.
 *
 * 호출부가 `page >= 1` 과 `1 <= pageSize <= MAX_PAGE_SIZE` 를 보장해야 한다
 * (엔드포인트의 zod 스키마가 검증한다). 이 함수는 재검증하지 않는다.
 */
export function paginate<T>(items: T[], params: PageParams): T[] {
  const start = (params.page - 1) * params.pageSize;

  return items.slice(start, start + params.pageSize);
}
