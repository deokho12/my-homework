import type { ProcedureAvailability } from '@/features/procedure/availability';
import {
  categoryPath,
  procedureDisplayName,
  normalizeSearchTerm,
  searchTaxonomyAll,
  type TaxonomyMatch,
} from '@/features/procedure/taxonomy';
import type { Doctor, Hospital } from '@/types/domain';

/**
 * 검색 추천 조립 — **순수 함수만** 둔다 (React·네트워크 없음).
 *
 * 이미 받아온 배열을 받아 화면에 그릴 세 그룹(`시술`/`병원`/`원장님`)을 만든다. 그래서
 * 순서·중복 제거·상한·문구를 목서버 없이 테스트할 수 있다 (AGENTS.md).
 *
 * `features/search/` 가 따로 있는 이유: 추천은 시술·병원·전문의 셋을 가로지르므로 어느 한
 * feature 폴더에 넣으면 그 feature 가 다른 둘을 import 하게 된다.
 */

/** 그룹당 최대 줄 수. 이 화면은 결과 목록 화면이 아니라 "먼저 알려주는" 화면이다. */
export const SUGGESTION_GROUP_LIMIT = 3;

/** 1자·미완성 자모 입력일 때의 안내. 화면 한 줄과 낭독기 안내가 같은 말을 하게 한 곳에 둔다. */
export const MIN_CHARS_HINT = '두 글자부터 병원·원장님도 찾아드려요';

export interface ProcedureSuggestion {
  kind: 'procedure';
  /** 그룹 안에서 유일한 값. DOM id(`aria-activedescendant`)의 재료다. */
  id: string;
  match: TaxonomyMatch;
  title: string;
  subtitle: string;
  /** 카테고리 화면의 빈 상태와 **같은 판정**이다 (`features/procedure/availability.ts`). */
  comingSoon: boolean;
}

export interface HospitalSuggestion {
  kind: 'hospital';
  id: string;
  title: string;
  subtitle: string;
  /** 병원 카드와 같은 조건(`sponsorship.isActive`). 광고가 위로 오는 목록이라 표시가 필요하다. */
  sponsored: boolean;
}

export interface DoctorSuggestion {
  kind: 'doctor';
  id: string;
  title: string;
  /** 소속 병원 이름은 행이 따로 조회한다(`useHospitalName`) — 여기서는 id 만 들고 간다. */
  hospitalId: string;
  /** 서버가 계산한 `visibleSpecialty` 그대로. `null` 이면 행이 전공 조각을 통째로 뺀다. */
  specialty: string | null;
}

export type Suggestion = ProcedureSuggestion | HospitalSuggestion | DoctorSuggestion;

export interface SuggestionGroups {
  procedures: ProcedureSuggestion[];
  hospitals: HospitalSuggestion[];
  doctors: DoctorSuggestion[];
}

export const EMPTY_SUGGESTION_GROUPS: SuggestionGroups = { procedures: [], hospitals: [], doctors: [] };

/* ------------------------------------------------------------------ 목적지 */

/**
 * 추천 한 줄의 목적지. **클릭과 Enter 가 이 함수 하나만 본다** — 같은 줄이 경로에 따라
 * 다른 화면으로 가지 않게 하려는 것이다(전문의는 언제나 `/doctor/:id`).
 */
export function suggestionHref(suggestion: Suggestion): string {
  switch (suggestion.kind) {
    case 'procedure':
      // 준비중 세부도 `?sub=` 를 그대로 붙인다 — 카테고리 화면이 그 이름으로 안내를 띄운다.
      return categoryPath(suggestion.match.category.id, suggestion.match.sub?.id ?? null);
    case 'hospital':
      return `/hospital/${suggestion.id}`;
    case 'doctor':
      return `/doctor/${suggestion.id}`;
  }
}

/** `aria-activedescendant` 와 행의 `id` 가 같은 값을 쓰도록 한 곳에서 만든다. */
export function suggestionOptionId(suggestion: Suggestion): string {
  return `search-suggest-${suggestion.kind}-${suggestion.id}`;
}

/* ------------------------------------------------------------------ 시술 그룹 */

function procedureSubtitle(match: TaxonomyMatch, comingSoon: boolean, query: string): string {
  const { category, sub } = match;
  const base = sub
    ? comingSoon
      ? // 준비중 세부도 **그 세부가 선택된** 카테고리 화면으로 간다(요청 14 — 분야 전체로
        // 되돌리지 않는다). 그래서 목적지의 빈 상태와 **같은 말**을 적는다.
        `${category.name} › ${sub.name} · 등록된 병원이 아직 없어요`
      : `${category.name} › ${sub.name}`
    : comingSoon
      ? '분야 전체 · 등록된 병원이 아직 없어요'
      : `${category.name} 분야 전체`;

  const title = sub ? sub.name : category.name;
  // 표시 이름에 검색어가 없으면 동의어로 걸린 것이다 — 설명이 없으면 오작동으로 보인다.
  const q = normalizeSearchTerm(query);
  if (q.length > 0 && !normalizeSearchTerm(title).includes(q)) {
    return `${base} · ‘${match.matchedAlias}’ 로 찾았어요`;
  }
  return base;
}

export function toProcedureSuggestion(
  match: TaxonomyMatch,
  query: string,
  availability: ProcedureAvailability
): ProcedureSuggestion {
  const comingSoon = match.sub
    ? availability.isSubComingSoon(match.sub.id)
    : availability.isCategoryComingSoon(match.category.id);

  return {
    kind: 'procedure',
    id: match.sub ? `${match.category.id}-${match.sub.id}` : match.category.id,
    match,
    title: match.sub ? match.sub.name : match.category.name,
    subtitle: procedureSubtitle(match, comingSoon, query),
    comingSoon,
  };
}

/**
 * 시술 그룹. 매칭 자체는 동기 계산이고(네트워크도 디바운스도 없다), 가용성은 이미 받아 둔
 * `GET /procedures` 에서 온다.
 *
 * **준비중 줄을 뒤로 민다**(안정 정렬). "이갈이" 처럼 열린 시술과 준비중 시술 양쪽에 걸리는
 * 말이 있을 때 **결과가 나오는 쪽**을 먼저 보여주기 위해서다 — 그 첫 줄이 Enter 의 목적지이기도
 * 하다(`firstSuggestion`). 가용성을 아직 모르면 아무것도 준비중이 아니므로 분류 순서 그대로다.
 */
export function buildProcedureSuggestions(
  query: string,
  availability: ProcedureAvailability,
  limit = SUGGESTION_GROUP_LIMIT
): ProcedureSuggestion[] {
  const all = searchTaxonomyAll(query).map((match) => toProcedureSuggestion(match, query, availability));

  return [...all.filter((item) => !item.comingSoon), ...all.filter((item) => item.comingSoon)].slice(0, limit);
}

/* ------------------------------------------------------------------ 병합 */

export interface MergedSuggestion<T> {
  item: T;
  /** 이름으로 걸렸는가, 시술로 걸렸는가. 병원 보조줄의 시술 순서가 이 값을 본다. */
  matchedBy: 'name' | 'procedure';
}

/**
 * 이름 일치 → 시술 일치 순으로 이어붙이고 id 로 중복을 없앤다(먼저 들어온 쪽이 이긴다).
 * 병원·원장님이 같은 함수를 쓴다.
 */
export function mergeSuggestions<T extends { id: string }>(
  byName: readonly T[],
  byProcedure: readonly T[],
  limit = SUGGESTION_GROUP_LIMIT
): MergedSuggestion<T>[] {
  const merged: MergedSuggestion<T>[] = [];
  const seen = new Set<string>();

  for (const [source, matchedBy] of [
    [byName, 'name'],
    [byProcedure, 'procedure'],
  ] as const) {
    for (const item of source) {
      if (merged.length >= limit) return merged;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push({ item, matchedBy });
    }
  }

  return merged;
}

/* ------------------------------------------------------------------ 병원·원장님 그룹 */

/** 걸린 시술을 맨 앞으로 — "왜 이 병원이 여기 있는지"가 보조줄 첫 낱말이 된다. */
function orderMatchedFirst(
  procedureIds: readonly string[],
  matchedProcedureIds: ReadonlySet<string> | null
): readonly string[] {
  if (!matchedProcedureIds) return procedureIds;
  return [
    ...procedureIds.filter((id) => matchedProcedureIds.has(id)),
    ...procedureIds.filter((id) => !matchedProcedureIds.has(id)),
  ];
}

export function buildHospitalSuggestions(
  merged: readonly MergedSuggestion<Hospital>[],
  matchedProcedureIds: ReadonlySet<string> | null
): HospitalSuggestion[] {
  return merged.map(({ item, matchedBy }) => {
    const ordered = matchedBy === 'procedure' ? orderMatchedFirst(item.procedureIds, matchedProcedureIds) : item.procedureIds;
    // 모르는 서버 id 는 건너뛴다(배지와 같은 규칙).
    const names = ordered
      .map((id) => procedureDisplayName(id))
      .filter((name): name is string => name !== null)
      .slice(0, 2);

    return {
      kind: 'hospital',
      id: item.id,
      title: item.name,
      subtitle: names.length > 0 ? `${item.region} · ${names.join(', ')}` : item.region,
      sponsored: item.sponsorship.isActive,
    };
  });
}

export function buildDoctorSuggestions(merged: readonly MergedSuggestion<Doctor>[]): DoctorSuggestion[] {
  return merged.map(({ item }) => ({
    kind: 'doctor',
    id: item.id,
    title: `${item.name} ${item.title}`,
    hospitalId: item.hospitalId,
    specialty: item.visibleSpecialty,
  }));
}

export interface SuggestionInput {
  query: string;
  hospitalsByName: readonly Hospital[];
  hospitalsByProcedure: readonly Hospital[];
  doctorsByName: readonly Doctor[];
  doctorsByProcedure: readonly Doctor[];
  /** 시술 첫 항목으로 서버에 물은 시술 id 들 (세부면 1개, 분야면 그 분야 전부). */
  matchedProcedureIds: ReadonlySet<string> | null;
  /** `준비중` 판정. 카테고리 화면·홈 격자와 **같은 출처**다. */
  availability: ProcedureAvailability;
  limit?: number;
}

export function buildSuggestions(input: SuggestionInput): SuggestionGroups {
  const limit = input.limit ?? SUGGESTION_GROUP_LIMIT;

  return {
    procedures: buildProcedureSuggestions(input.query, input.availability, limit),
    hospitals: buildHospitalSuggestions(
      mergeSuggestions(input.hospitalsByName, input.hospitalsByProcedure, limit),
      input.matchedProcedureIds
    ),
    doctors: buildDoctorSuggestions(mergeSuggestions(input.doctorsByName, input.doctorsByProcedure, limit)),
  };
}

/** 화면에 보이는 순서 그대로 평탄화한다 — 화살표 이동과 Enter 가 같은 순서를 본다. */
export function flattenSuggestions(groups: SuggestionGroups): Suggestion[] {
  return [...groups.procedures, ...groups.hospitals, ...groups.doctors];
}

/** Enter 와 `?q=` 자동 실행이 보는 단 하나의 목적지. */
export function firstSuggestion(groups: SuggestionGroups): Suggestion | null {
  return flattenSuggestions(groups)[0] ?? null;
}

export function countSuggestions(groups: SuggestionGroups): number {
  return groups.procedures.length + groups.hospitals.length + groups.doctors.length;
}

/* ------------------------------------------------------------------ 입력 판정 */

/** 완성되지 않은 한글 자모 (`ㄱ`·`ㅏ`). 조합 중간값으로 요청이 나가는 것을 막는다. */
const INCOMPLETE_JAMO = /[ㄱ-ㆎ]/;

/**
 * 네트워크 그룹(병원·원장님)을 물어볼 입력인가.
 *
 * - 2자 미만이면 묻지 않는다. 1자 한글은 병원 이름 대부분에 걸려 쓸모가 없다.
 * - 마지막 글자가 미완성 자모면 묻지 않는다(`인ㄹ`). `compositionend` 를 기다리지 않는
 *   이유는 한국어 IME 가 마지막 음절을 계속 조합 상태로 두기 때문이다 — 기다리면
 *   `인레` 는 영원히 `인` 으로만 질의된다.
 */
export function shouldQueryNetwork(term: string): boolean {
  const trimmed = term.trim();
  if (trimmed.length < 2) return false;
  return !INCOMPLETE_JAMO.test(trimmed.slice(-1));
}

/**
 * 직함이 붙은 검색어(`김민준 원장`)의 2차 조회어. 공백이 없으면 `null`.
 * 서버 `q` 는 부분일치라 검색어가 실제 이름보다 길면 1차 조회로는 못 찾는다.
 */
export function doctorNameFallbackQuery(term: string): string | null {
  const trimmed = term.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace === -1 ? null : trimmed.slice(0, lastSpace);
}

/** 2차 조회 결과 중 **검색어가 그 이름으로 시작하는** 것만 받는다. */
export function filterDoctorsByNamePrefix(term: string, doctors: readonly Doctor[]): Doctor[] {
  const trimmed = term.trim();
  return doctors.filter((doctor) => trimmed.startsWith(doctor.name));
}

/* ------------------------------------------------------------------ 굵게 표시 */

export interface HighlightSegment {
  text: string;
  match: boolean;
}

/**
 * 제목에서 검색어와 겹치는 **첫 구간**을 갈라낸다. 굵게는 보조 수단이라
 * 낭독기에는 영향을 주지 않는다(§ 행 전체가 `aria-label` 로 읽힌다).
 */
export function splitHighlight(text: string, query: string): HighlightSegment[] {
  const q = normalizeSearchTerm(query);
  if (q.length === 0) return [{ text, match: false }];

  const index = text.toLowerCase().indexOf(q);
  if (index === -1) return [{ text, match: false }];

  const segments: HighlightSegment[] = [];
  if (index > 0) segments.push({ text: text.slice(0, index), match: false });
  segments.push({ text: text.slice(index, index + q.length), match: true });
  if (index + q.length < text.length) segments.push({ text: text.slice(index + q.length), match: false });
  return segments;
}
