import { useCallback, useEffect, useMemo, useState } from "react";

import { useDoctors } from "@/features/doctor/hooks/useDoctors";
import { useDoctorsByCategory } from "@/features/doctor/hooks/useDoctorsByCategory";
import { useHospitals } from "@/features/hospital/hooks/useHospitals";
import { useHospitalsByCategory } from "@/features/hospital/hooks/useHospitalsByCategory";
import { useProcedureAvailability } from "@/features/procedure/hooks/useProcedureAvailability";
import { type CategorySelection } from "@/features/procedure/lib/categoryListFilters";
import { getSubProcedureIdsOf } from "@/features/procedure/taxonomy";
import {
  EMPTY_SUGGESTION_GROUPS,
  buildProcedureSuggestions,
  buildSuggestions,
  countSuggestions,
  doctorNameFallbackQuery,
  filterDoctorsByNamePrefix,
  flattenSuggestions,
  shouldQueryNetwork,
  type Suggestion,
  type SuggestionGroups,
} from "@/features/search/suggest";
import type { Doctor, Hospital, Paged } from "@/types/domain";

/**
 * 입력 중 추천 — 조회와 배선만 한다. **판정은 하지 않는다**(전부 `suggest.ts` 의 순수 함수).
 *
 * 경합 처리: 네트워크 그룹은 `useQuery` 로 그리고 queryKey 에 검색어가 들어간다. 늦게 온
 * 이전 검색어의 응답은 **현재 키가 아니라 렌더되지 않으므로** 수동 취소가 필요 없다.
 * `placeholderData: keepPreviousData` 는 일부러 쓰지 않는다 — 이전 검색어의 병원이 새
 * 검색어 밑에 남으면 그 자체가 틀린 추천이다.
 */

/** 한글은 음절당 자판 2~3회라 250ms 면 대체로 음절 경계에서 한 번 발사된다. */
export const SUGGEST_DEBOUNCE_MS = 250;

/**
 * 카테고리·탐색 화면의 기본 정렬(`SORT_TO_SERVER['popular']`)과 **같은 값**을 명시적으로
 * 보낸다 — queryKey 해시가 같아져 추천이 받아둔 목록을 다음 화면이 요청 없이 그대로 쓴다.
 */
const SUGGEST_SORT = { sort: "rating" } as const;

/**
 * 조회를 끄는 동안 쓰는 선택. 꺼진 쿼리도 키는 만들어지므로, **데이터는 항상
 * `enabled` 로 한 번 더 거른다** (탐색 화면이 같은 키를 캐시해 두었을 수 있다).
 */
const INERT_SELECTION: CategorySelection = { kind: "recommended" };

function useDebouncedTerm(term: string, delayMs: number) {
  const [debounced, setDebounced] = useState(term);
  /** Enter 가 최소 글자 수를 건너뛰라고 지목한 검색어. 글자가 바뀌면 저절로 풀린다. */
  const [forcedTerm, setForcedTerm] = useState<string | null>(null);

  useEffect(() => {
    if (debounced === term) return;
    const timer = setTimeout(() => setDebounced(term), delayMs);
    return () => clearTimeout(timer);
  }, [term, debounced, delayMs]);

  /**
   * Enter 가 기다릴 때 디바운스를 즉시 끊는다 — 명시적 의사표시는 250ms 를 기다리지 않고,
   * 최소 글자 수(2자) 규칙도 받지 않는다.
   */
  const flush = useCallback(() => {
    setDebounced(term);
    setForcedTerm(term);
  }, [term]);

  return { debounced, forced: forcedTerm === term && term.length > 0, flush };
}

export interface SuggestionGroupState {
  /** 스켈레톤 조건. 지연 노출(200ms)은 화면이 `useDelayedFlag` 로 건다. */
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

export interface UseSuggestionsResult {
  groups: SuggestionGroups;
  /** 화면에 보이는 순서 그대로 평탄화한 목록 (화살표·Enter 가 본다). */
  flat: Suggestion[];
  count: number;
  /** 네트워크 그룹까지 전부 확정됐는가. Enter 가 기다릴지 말지를 이 값으로 정한다. */
  isSettled: boolean;
  /** 2자 미만·미완성 자모라 병원·원장님을 **묻지 않는** 상태. */
  networkSkipped: boolean;
  hasError: boolean;
  hospitals: SuggestionGroupState;
  doctors: SuggestionGroupState;
  flush: () => void;
}

/** 물어본 시술 id 들 — 병원 보조줄에서 "걸린 시술"을 맨 앞에 두는 데 쓴다. */
function matchedProcedureIdsOf(
  selection: CategorySelection,
): ReadonlySet<string> | null {
  if (selection.kind !== "category") return null;
  if (selection.subProcedureId !== null) return new Set([selection.subProcedureId]);

  return new Set(getSubProcedureIdsOf(selection.categoryId));
}

function itemsOf<T>(
  enabled: boolean,
  page: Paged<T> | undefined,
): readonly T[] {
  return enabled ? (page?.items ?? []) : [];
}

export function useSuggestions(rawQuery: string): UseSuggestionsResult {
  const term = rawQuery.trim();
  const { debounced, forced, flush } = useDebouncedTerm(
    term,
    SUGGEST_DEBOUNCE_MS,
  );

  const availability = useProcedureAvailability();

  // 시술 그룹은 디바운스하지 않는다 — 동기 계산이라 비용이 0이고, 글자마다 즉시 반응하는
  // 것이 입력 중 추천의 핵심 체감이다.
  const procedures = useMemo(
    () => buildProcedureSuggestions(term, availability),
    [term, availability],
  );

  const wantsNetwork = shouldQueryNetwork(term) || forced;
  const networkTerm = wantsNetwork && debounced === term ? term : null;
  const enabled = networkTerm !== null;

  const hospitalsByName = useHospitals({ q: networkTerm ?? "" }, { enabled });
  const doctorsByName = useDoctors({ q: networkTerm ?? "" }, { enabled });

  // 직함이 붙은 검색어(`김민준 원장`)는 1차 조회가 0건이다 — 마지막 낱말을 떼고 한 번 더 묻는다.
  const directDoctors = itemsOf(enabled, doctorsByName.data);
  const fallbackTerm =
    enabled && doctorsByName.data !== undefined && directDoctors.length === 0
      ? doctorNameFallbackQuery(term)
      : null;
  const doctorsByNameFallback = useDoctors(
    { q: fallbackTerm ?? "" },
    { enabled: fallbackTerm !== null },
  );

  // 시술 첫 항목이 있으면 "그 시술을 하는 곳"도 함께 보여준다. 세부를 되돌리지 않는다 —
  // 추천 줄이 가리키는 카테고리 화면도 **같은 필터**로 물으므로 두 화면의 병원이 같다.
  const topMatch = procedures[0]?.match ?? null;
  const procedureEnabled = enabled && topMatch !== null;
  const selection = useMemo<CategorySelection>(
    () =>
      topMatch
        ? {
            kind: "category",
            categoryId: topMatch.category.id,
            subProcedureId: topMatch.sub?.id ?? null,
          }
        : INERT_SELECTION,
    [topMatch],
  );

  const hospitalsByProcedure = useHospitalsByCategory(selection, SUGGEST_SORT, {
    enabled: procedureEnabled,
  });
  const doctorsByProcedure = useDoctorsByCategory(selection, SUGGEST_SORT, {
    enabled: procedureEnabled,
  });

  const hospitalNameItems = itemsOf(enabled, hospitalsByName.data);
  const hospitalProcedureItems = itemsOf<Hospital>(
    procedureEnabled,
    hospitalsByProcedure.data,
  );
  const doctorProcedureItems = itemsOf<Doctor>(
    procedureEnabled,
    doctorsByProcedure.data,
  );
  const doctorNameItems =
    directDoctors.length > 0
      ? directDoctors
      : fallbackTerm !== null
        ? filterDoctorsByNamePrefix(
            term,
            doctorsByNameFallback.data?.items ?? [],
          )
        : [];

  const matchedProcedureIds = matchedProcedureIdsOf(selection);

  const groups = useMemo(
    () =>
      term.length === 0
        ? EMPTY_SUGGESTION_GROUPS
        : buildSuggestions({
            query: term,
            hospitalsByName: hospitalNameItems,
            hospitalsByProcedure: hospitalProcedureItems,
            doctorsByName: doctorNameItems,
            doctorsByProcedure: doctorProcedureItems,
            matchedProcedureIds,
            availability,
          }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 배열들은 매 렌더 새로 만들어지므로 내용이 바뀌는 원천(data)만 본다.
    [
      term,
      hospitalsByName.data,
      hospitalsByProcedure.data,
      doctorsByName.data,
      doctorsByNameFallback.data,
      doctorsByProcedure.data,
      enabled,
      procedureEnabled,
      availability,
    ],
  );

  // "확정"은 로딩 플래그가 아니라 **데이터·오류의 존재**로 판정한다. 폴백 조회가 켜지는
  // 렌더에서 `isLoading` 이 한 박자 늦게 참이 되는 창이 있어, 그 창에 Enter 가 통과하면
  // 아직 오지 않은 원장님을 건너뛰고 엉뚱한 곳으로 간다.
  const nameSettled = (query: { data: unknown; isError: boolean }) =>
    query.data !== undefined || query.isError;

  const hospitalsSettled =
    !wantsNetwork ||
    (enabled &&
      nameSettled(hospitalsByName) &&
      (!procedureEnabled ||
        hospitalsByProcedure.data !== undefined ||
        hospitalsByProcedure.isError));

  const doctorsSettled =
    !wantsNetwork ||
    (enabled &&
      nameSettled(doctorsByName) &&
      (fallbackTerm === null || nameSettled(doctorsByNameFallback)) &&
      (!procedureEnabled ||
        doctorsByProcedure.data !== undefined ||
        doctorsByProcedure.isError));

  const hospitalsError =
    enabled &&
    (hospitalsByName.isError ||
      (procedureEnabled && hospitalsByProcedure.isError));
  const doctorsError =
    enabled &&
    (doctorsByName.isError ||
      doctorsByNameFallback.isError ||
      (procedureEnabled && doctorsByProcedure.isError));

  const retryHospitals = useCallback(() => {
    void hospitalsByName.refetch();
    if (procedureEnabled) void hospitalsByProcedure.refetch();
  }, [hospitalsByName, hospitalsByProcedure, procedureEnabled]);

  const retryDoctors = useCallback(() => {
    void doctorsByName.refetch();
    if (fallbackTerm !== null) void doctorsByNameFallback.refetch();
    if (procedureEnabled) void doctorsByProcedure.refetch();
  }, [
    doctorsByName,
    doctorsByNameFallback,
    doctorsByProcedure,
    fallbackTerm,
    procedureEnabled,
  ]);

  return {
    groups,
    flat: flattenSuggestions(groups),
    count: countSuggestions(groups),
    isSettled: hospitalsSettled && doctorsSettled,
    networkSkipped: term.length > 0 && !wantsNetwork,
    hasError: hospitalsError || doctorsError,
    // 표시용 "불러오는 중" 은 **질의가 실제로 켜진 뒤부터**다(`enabled`). 디바운스 동안까지
    // 로딩으로 치면 스켈레톤 지연 타이머(200ms)가 키 입력 시점부터 돌아, 빠른 응답에서
    // 스켈레톤이 50ms 만 번쩍이고 사라진다(QA 2026-10-13 측정). Enter 판정은 위의 `isSettled` 를 쓴다.
    hospitals: {
      isLoading: enabled && !hospitalsSettled,
      isError: hospitalsError,
      retry: retryHospitals,
    },
    doctors: {
      isLoading: enabled && !doctorsSettled,
      isError: doctorsError,
      retry: retryDoctors,
    },
    flush,
  };
}
