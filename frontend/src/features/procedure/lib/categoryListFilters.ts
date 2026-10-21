import type { CategoryId, SubProcedureId } from '@/features/procedure/taxonomy';

/**
 * 분야/세부 시술 선택 → 목록 API 가 받는 필터 조각. **순수 함수다** — 네트워크도 React 도 모른다.
 *
 * 요청 14 전에는 이 파일이 훨씬 컸다. 서버가 아는 시술이 13종뿐이라 분야 하나가 시술 여러 개에
 * 걸렸고(충치치료 = `cavity`+`inlay`+`crown`), 그 셋은 100곳을 받아 화면에서 걸러야 했다 —
 * 그래서 그 분야들만 광고 우선 노출이 없고 100곳 상한이 있었다 (`known-issues.md` 🟠).
 *
 * 이제 **서버가 분야를 안다** (`?categoryId=`, 계약 §22.6). 분야도 세부도 요청 한 번이고,
 * 광고 우선 노출·총계·페이지 넘김이 셋 다 서버 규칙 그대로다. `client` 모드도 `empty` 모드도
 * 없다 — 준비중 분야/세부도 그냥 물어보고, 0건이면 화면의 빈 상태가 말한다
 * (`준비중` 판정은 `features/procedure/availability.ts`).
 */

export type CategorySelection =
  | { kind: 'recommended' }
  | { kind: 'category'; categoryId: CategoryId; subProcedureId: SubProcedureId | null };

export interface CategoryListFilters {
  procedureId?: SubProcedureId;
  categoryId?: CategoryId;
  recommended?: true;
}

/**
 * `procedureId` 와 `categoryId` 를 **함께 보내지 않는다.** 계약은 둘을 AND 로 받지만
 * (§22.6), 세부를 고른 순간 분야 조건은 아무것도 더 좁히지 못한다 — 보내면 같은 결과를
 * 가리키는 요청이 두 가지가 되고 쿼리 키도 둘로 갈린다.
 */
export function selectionToListFilters(selection: CategorySelection): CategoryListFilters {
  if (selection.kind === 'recommended') return { recommended: true };
  if (selection.subProcedureId !== null) return { procedureId: selection.subProcedureId };
  return { categoryId: selection.categoryId };
}
