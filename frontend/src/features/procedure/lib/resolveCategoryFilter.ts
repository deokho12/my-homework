import {
  getLegacyIdsOf,
  getSubProcedure,
  type CategoryId,
  type SubProcedureId,
} from '@/features/procedure/taxonomy';
import type { Paged, ProcedureId } from '@/types/domain';

/**
 * 대분류 선택 → 요청 방식 결정. **순수 함수다** — 네트워크도 React 도 모른다.
 *
 * `GET /hospitals?procedureId=` 는 값을 **하나만** 받는다 (배열을 주면 422). 그런데 대분류
 * 하나가 서버 시술 여러 개에 걸리는 경우가 있다 (충치치료 = `cavity`+`inlay`+`crown`,
 * 심미 = `laminate`+`whitening`, 턱관절 = `tmj`+`splint`+`snoring-device`). 그 셋만
 * 한 번 넉넉히 받아서 클라이언트에서 거르고, 나머지 여섯은 서버 필터 그대로 쓴다.
 *
 * N개 병렬 요청 후 병합(fan-out)은 쓰지 않는다 — 서버의 정렬·광고 규칙을 클라이언트에
 * 복제해야 하고(AGENTS.md "같은 판정을 두 곳에 두지 않는다"), `meta.totalItems` 를 합산할
 * 방법이 없으며, 지도 모드에서 반경 요청이 N배가 된다.
 *
 * `procedureId` 를 보낼 때만 서버가 광고 우선 노출을 켜므로, `client` 모드의 목록에는
 * 광고 순서가 없다 (`docs/features/known-issues.md`).
 */
export type CategorySelection =
  | { kind: 'recommended' }
  | { kind: 'category'; categoryId: CategoryId; subProcedureId: SubProcedureId | null };

export type CategoryFilterPlan =
  /** 추천 탭 — `recommended=true` */
  | { mode: 'recommended' }
  /** 서버 필터 하나로 끝난다 — 광고 순서 유지 */
  | { mode: 'server'; procedureId: ProcedureId }
  /** 넉넉히 받아서 `procedureIds` 교집합으로 거른다 — 광고 순서 없음 */
  | { mode: 'client'; legacyIds: ReadonlySet<ProcedureId> }
  /** 서버가 아는 시술이 하나도 없다 (준비중) — 요청 자체를 보내지 않는다 */
  | { mode: 'empty' };

/** `client` 모드에서 한 번에 받아올 개수. 시드 병원 11곳 규모에선 전수와 같다. */
export const CLIENT_FILTER_PAGE_SIZE = 100;

export function resolveCategoryFilter(selection: CategorySelection): CategoryFilterPlan {
  if (selection.kind === 'recommended') return { mode: 'recommended' };

  if (selection.subProcedureId !== null) {
    const legacyId = getSubProcedure(selection.subProcedureId).legacyProcedureId;
    // 준비중 세부를 고른 경우. 전체로 넓히지 않는다 — 고른 것과 다른 결과를 보여주게 된다.
    // 화면이 "준비중" 안내 후 전체로 되돌릴지는 화면이 정한다.
    return legacyId ? { mode: 'server', procedureId: legacyId } : { mode: 'empty' };
  }

  const legacyIds = getLegacyIdsOf(selection.categoryId);
  if (legacyIds.length === 0) return { mode: 'empty' };
  if (legacyIds.length === 1) return { mode: 'server', procedureId: legacyIds[0] };
  return { mode: 'client', legacyIds: new Set(legacyIds) };
}

/** 결정된 방식 → 목록 API 가 받는 필터 조각. 나머지 필터(정렬·칩)는 호출부가 합친다. */
export function planToListFilters(plan: CategoryFilterPlan): {
  procedureId?: ProcedureId;
  recommended?: true;
  pageSize?: typeof CLIENT_FILTER_PAGE_SIZE;
} {
  switch (plan.mode) {
    case 'recommended':
      return { recommended: true };
    case 'server':
      return { procedureId: plan.procedureId };
    case 'client':
      return { pageSize: CLIENT_FILTER_PAGE_SIZE };
    case 'empty':
      return {};
  }
}

/**
 * `client` 모드의 교집합 필터. `meta` 는 **거른 뒤의 개수로 다시 쓴다** — 서버가 준
 * `totalItems` 는 필터 전 개수라 그대로 두면 화면이 "총 11곳"이라 말하고 3장만 그린다.
 * 한 페이지에 다 들어간 결과이므로 `totalPages` 는 0 또는 1 이다.
 */
export function filterPageByLegacyIds<T extends { procedureIds: readonly string[] }>(
  page: Paged<T>,
  legacyIds: ReadonlySet<ProcedureId>
): Paged<T> {
  const items = page.items.filter((item) =>
    item.procedureIds.some((id) => legacyIds.has(id as ProcedureId))
  );

  return {
    items,
    meta: { ...page.meta, totalItems: items.length, totalPages: items.length > 0 ? 1 : 0 },
  };
}
