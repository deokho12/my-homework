/**
 * 목록 조회 필터를 쿼리 문자열로 만든다. 병원·전문의·후기 api 가 함께 쓴다
 * (`src/lib/queryKeys.ts` 처럼 필터 직렬화의 단일 출처).
 *
 * `undefined` 인 필터는 보내지 않는다 — 서버는 "지정 안 함" 과 `false` 를 구분한다.
 * `consultAvailable=false` 는 "상담을 받지 않는 병원만" 이라는 필터다.
 */
export function toSearchParams(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
