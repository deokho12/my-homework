/**
 * `준비중` 판정 — **저장하지 않고 센다** (docs/database/README.md §17.7).
 *
 * 규칙(요청서 14 그대로): 세부 시술은 **앱에 노출되는 병원 중 그 시술을 하는 곳이
 * 1곳 이상이면 열려 있고**, 0곳이면 `준비중` 이다.
 *
 * 이 파일은 **순수 함수다** — DB 도 요청도 모르고, 집계 결과(시술 id → 병원 수)만
 * 받는다. 그래서 DB 없이 경계값(0곳/1곳)을 테스트할 수 있다 (AGENTS.md).
 * "앱에 노출되는 병원" 의 정의는 여기 없다 — 그것은
 * `hospital/public-visibility.ts` 의 `publicHospitalWhere()` 한 곳이고,
 * 집계 질의가 그 조건을 그대로 쓴다.
 *
 * 분야(카테고리)의 가용성은 **만들지 않는다.** 계약이 `GET /procedure-categories`
 * 도 `ProcedureCategory.isAvailable` 도 두지 않았고(docs/api/README.md §22.4),
 * "분야 준비중 = 그 분야의 세부 시술이 전부 `isAvailable=false`" 는 화면이 이
 * 응답 하나에서 유도한다. 소비자 없는 출력을 미리 만들지 않는다.
 */

/**
 * 시술별 가용성. `hospitalCountById` 는 "공개 병원이 등록한 시술 id → 그 병원 수"
 * 집계다. 집계에 없는 id 는 0곳이므로 `false` 다.
 *
 * `hospitalCount` 자체는 돌려주지 않는다 — 읽는 화면이 없다 (계약 §22.3).
 * 숫자가 필요해지는 날 같은 집계에서 바로 더할 수 있다.
 */
export function computeProcedureAvailability(
  procedureIds: readonly string[],
  hospitalCountById: ReadonlyMap<string, number>,
): Map<string, boolean> {
  return new Map(procedureIds.map((id) => [id, (hospitalCountById.get(id) ?? 0) > 0]));
}
