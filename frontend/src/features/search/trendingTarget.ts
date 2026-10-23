import {
  categoryPath,
  categoryPathForProcedure,
  searchTaxonomy,
} from '@/features/procedure';
import type { SearchTarget } from '@/mocks/fixtures/trendingSearches';

/**
 * 인기 검색어 한 줄 → 갈 곳(경로).
 *
 * **홈의 인기 검색어 알약과 검색 화면의 인기 검색어 행이 같은 함수를 쓴다.** 홈은 예전에
 * `/search?q=...` 를 거쳐 검색 화면이 다시 이 판정을 하게 했는데, 그러면 목적지에서 뒤로
 * 가기를 눌렀을 때 홈이 아니라 검색 화면이 나왔다 (`SEARCH-1`). 같은 판정을 두 곳에 두지
 * 않으려고 경로 계산만 떼어낸 순수 함수다 — `router` 도 React 도 모른다.
 *
 * `term` 은 사용자가 **읽은 글자**다(인기 검색어의 문구). 시술 항목은 그 글자를 먼저
 * `searchTaxonomy` 에 태운다 — 같은 "충치치료" 를 직접 타이핑하면 대분류 전체
 * (`/category/cavity`)가 열리는데, 행을 누를 때만 서버 id `cavity` 로 번역돼 레진만
 * (`?sub=resin`) 열리면 같은 글자가 경로에 따라 다른 개수를 보여준다. 글자가 없거나
 * (= 해석 불가) 안 걸릴 때만 서버 id 로 폴백한다.
 *
 * 전문의 행은 `/doctor/{id}` 로 간다 — 추천 목록의 원장님 줄과 **같은 목적지**다.
 */
export function trendingTargetPath(target: SearchTarget, term?: string): string {
  if (target.kind === 'procedure') {
    const match = term ? searchTaxonomy(term) : null;
    if (match) {
      return categoryPath(match.category.id, match.sub?.id ?? null);
    }
    // 인기검색어는 서버 시술 id 도 들고 있다 — 글자가 분류에 안 걸리면 그 id 로 보낸다.
    // 서버가 미래에 taxonomy 가 모르는 id 를 내려주면 탐색으로 떨어뜨린다.
    return categoryPathForProcedure(target.procedureId) ?? '/(tabs)/explore';
  }
  if (target.kind === 'hospital') {
    return `/hospital/${target.hospitalId}`;
  }
  return `/doctor/${target.doctorId}`;
}
