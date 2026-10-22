/**
 * 목록 조회 필터를 쿼리 문자열로 만든다. 병원·전문의·후기·상담·알림 api 가 함께 쓴다
 * (`src/lib/queryKeys.ts` 처럼 필터 직렬화의 단일 출처).
 *
 * `undefined` 인 필터는 보내지 않는다 — 서버는 "지정 안 함" 과 `false` 를 구분한다.
 * `consultAvailable=false` 는 "상담을 받지 않는 병원만" 이라는 필터다.
 *
 * **배열은 같은 이름을 반복해 적는다** (`?status=new&status=contacted`). 계약의 반복
 * 파라미터 규약이고(`status`·`procedureId`), 쉼표로 이으면 서버가 값 하나로 읽는다.
 * 빈 배열은 "지정 안 함" 과 같아서 보내지 않는다.
 */
export function toSearchParams(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue;
        params.append(key, String(item));
      }
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
