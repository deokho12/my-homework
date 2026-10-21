import type { CategorySelection } from '@/features/procedure/lib/categoryListFilters';
import { CATEGORIES, getSubProceduresOf, type CategoryId } from '@/features/procedure/taxonomy';
import type { Procedure } from '@/types/domain';

/**
 * `준비중` 판정 — **화면 전체에서 이 파일 하나다** (계약 §22.3·§22.4).
 *
 * 규칙은 요청서 14 가 정했다: *앱에 노출되는 병원 중 그 시술을 하는 곳이 1곳 이상이면 열림,
 * 0곳이면 준비중*. 그 입력은 서버에만 있으므로 세부 시술의 판정은 서버가 내려준
 * `Procedure.isAvailable` **그대로**이고, 분야의 판정만 여기서 유도한다
 * (= 그 분야의 세부 시술이 **전부** `isAvailable=false`).
 *
 * 홈 격자·탐색 탭·세부 칩·카테고리 화면·검색 추천이 각자 계산하면 같은 시술이 한 화면에서
 * 준비중, 다른 화면에서 정상으로 보인다 (AGENTS.md — 같은 판정을 두 곳에 두지 않는다).
 *
 * **순수 함수다** — React 도 네트워크도 모른다. 화면은 `useProcedureAvailability()` 로 받는다.
 */

export interface ProcedureAvailability {
  /**
   * `GET /procedures` 가 도착했는가. **아직이거나 실패했으면 아무것도 준비중이 아니다** —
   * 모르는 상태를 준비중으로 그리면 첫 프레임에 9칸 전부 `준비중` 이 번쩍인다. 목록은 그대로
   * 서버에 물어보고, 결과가 0건이면 각 화면의 빈 상태가 말한다.
   */
  readonly isKnown: boolean;
  /**
   * 세부 시술 하나가 준비중인가 = `isAvailable` 이 아니다. 응답에 아예 없는 id 도
   * 준비중이다 — 분야 판정과 **같은 집합 하나**(열린 시술)를 봐야 두 줄이 갈라지지 않는다.
   */
  isSubComingSoon(procedureId: string): boolean;
  /** 분야가 준비중인가 = 그 분야의 세부 시술이 전부 준비중. */
  isCategoryComingSoon(categoryId: CategoryId): boolean;
}

/** `isKnown: false` 일 때의 상수 응답. 매번 새 객체를 만들면 소비자의 memo 가 영원히 다시 돈다. */
const UNKNOWN: ProcedureAvailability = {
  isKnown: false,
  isSubComingSoon: () => false,
  isCategoryComingSoon: () => false,
};

export function buildProcedureAvailability(
  procedures: readonly Procedure[] | undefined
): ProcedureAvailability {
  if (procedures === undefined) return UNKNOWN;

  const available = new Set<string>();
  for (const procedure of procedures) {
    if (procedure.isAvailable) available.add(procedure.id);
  }

  const comingSoonCategories = new Set<CategoryId>(
    CATEGORIES.filter((category) =>
      getSubProceduresOf(category.id).every((sub) => !available.has(sub.id))
    ).map((category) => category.id)
  );

  return {
    isKnown: true,
    isSubComingSoon: (procedureId) => !available.has(procedureId),
    isCategoryComingSoon: (categoryId) => comingSoonCategories.has(categoryId),
  };
}

/**
 * 준비중인 선택의 빈 상태 설명 한 줄. 준비중이 아니면 `undefined`.
 *
 * **판정은 위 두 함수 그대로다** — 여기서 갈리는 것은 글자뿐이다: 세부 시술 하나를 고른
 * 상태면 `시술`, 분야 전체를 보는 중이면 `분야`. 「스케일링·예방」 탭에 "이 시술은" 이라고
 * 적으면 분야 안의 어느 시술을 가리키는지 읽는 사람이 찾게 된다.
 *
 * 탐색 화면과 카테고리 화면이 **같은 함수**를 쓴다 — 같은 상황에서 두 화면이 다른 문장을
 * 내놓지 않게 (AGENTS.md — 같은 판정을 두 곳에 두지 않는다).
 */
export function comingSoonDescription(
  availability: ProcedureAvailability,
  selection: CategorySelection
): string | undefined {
  if (selection.kind !== 'category') return undefined;

  if (selection.subProcedureId !== null) {
    return availability.isSubComingSoon(selection.subProcedureId) ? '이 시술은 준비중이에요' : undefined;
  }

  return availability.isCategoryComingSoon(selection.categoryId) ? '이 분야는 준비중이에요' : undefined;
}
