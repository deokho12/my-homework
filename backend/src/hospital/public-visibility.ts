import type { Prisma } from '@prisma/client';

/**
 * **앱에 노출되는 병원**의 조건 — 이 저장소에서 그 판정의 유일한 자리다
 * (docs/database/README.md §17.7, docs/api/README.md §22.3).
 *
 * `GET /hospitals` 의 공개 목록(`buildHospitalWhere` 가 이 함수로 시작한다)과
 * `GET /procedures` 의 `isAvailable` 집계가 **같은 함수**를 쓴다. 두 곳에 각자
 * `{ deletedAt: null }` 을 적으면, 노출 조건이 하나 늘어나는 날(요청서 18 의
 * `approvalStatus='approved'`) 목록에서는 사라졌는데 `준비중` 은 안 붙는 병원이
 * 생긴다 — 화면 두 곳이 조용히 어긋나는 종류의 결함이다 (AGENTS.md).
 *
 * 요청 17(공공데이터 병원)도 같은 두 테이블(`hospitals`·`hospital_procedures`)에
 * 들어오므로 그 병원들은 이 조건에 자동으로 잡힌다 — 미리 만들어 둘 것이 없다.
 */
export function publicHospitalWhere(): Prisma.HospitalWhereInput {
  return { deletedAt: null };
}
