import { useState } from 'react';

import type { DoctorFilters } from '@/features/doctor';
import type { HospitalFilters } from '@/features/hospital/api/hospitalApi';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useLocalSearchParams } from '@/navigation';
import type { ProcedureId } from '@/types/domain';
import { PROCEDURE_ICONS } from '@/utils/procedureIcons';

export type ExploreMode = 'doctor' | 'hospital';
export type HospitalView = 'list' | 'map';
export type ExploreCategory = 'recommended' | 'all' | ProcedureId;
export type ExploreSortKey = 'popular' | 'reviews' | 'consults';

export const SORT_OPTIONS: { key: ExploreSortKey; label: string }[] = [
  { key: 'popular', label: '인기순' },
  { key: 'reviews', label: '후기순' },
  { key: 'consults', label: '상담많은순' },
];

/** 지도 반경 칩 옵션(km). 0.5 는 화면에 "500m" 로 표시된다. */
export const MAP_RADIUS_OPTIONS_KM = [0.5, 1, 3, 5];
const DEFAULT_RADIUS_KM = 3;

/**
 * 반경 라벨 포맷의 단일 출처. `HospitalMapView`(반경 칩)와 `ExplorePage`(지도 빈 상태 문구)
 * 둘 다 이 함수를 쓴다 — 예전에는 두 곳에 같은 `km < 1 ? ... : ...` 삼항식이 중복돼 있었다.
 */
export function formatRadiusLabel(km: number): string {
  return km < 1 ? `${km * 1000}m` : `${km}km`;
}

/** `경력` 칩이 켜졌을 때 요구하는 최소 연차. 병원·의사 모드 둘 다 같다. */
const MIN_EXPERIENCED_YEARS = 10;

const SORT_TO_SERVER: Record<ExploreSortKey, 'rating' | 'reviewCount' | 'consultCount'> = {
  popular: 'rating',
  reviews: 'reviewCount',
  consults: 'consultCount',
};

/**
 * `PROCEDURE_ICONS` 가 `Record<ProcedureId, IconComponent>` 라 13종 전체를 정적으로 덮는다 —
 * 서버 시술 목록(`useProcedures`)을 기다리지 않고도(네트워크 대기 없이) 유효성 검사를 할 수
 * 있는 이유다. `Object.keys` 는 문자열만 주므로 `as` 없이 `Set.has` 로 좁힌다.
 */
const KNOWN_PROCEDURE_IDS: ReadonlySet<string> = new Set(Object.keys(PROCEDURE_ICONS));

function isProcedureId(value: string | undefined): value is ProcedureId {
  return value !== undefined && KNOWN_PROCEDURE_IDS.has(value);
}

/**
 * 탐색 화면 상태(모드·칩·정렬·반경) → 서버 필터 변환을 한 곳에 모은다.
 *
 * 화면 칩 이름과 서버 파라미터 이름이 다른 것들이 여기 매핑 표다:
 *
 * | 화면 칩     | 병원 모드                        | 의사 모드                  |
 * |------------|----------------------------------|----------------------------|
 * | 상담가능    | `consultAvailable`                | `consultAvailable`          |
 * | 원데이      | `oneDay`                          | `oneDay`                    |
 * | 전문의      | `hasVerifiedSpecialist`            | `verifiedSpecialist`        |
 * | 진료시간    | `nightConsult` (실제로는 야간상담)  | `nightConsult`              |
 * | 경력        | `minDoctorYearsOfExperience=10`    | `minYearsOfExperience=10`   |
 *
 * 시술 칩은 `procedureId`, `추천` 은 `recommended=true`, `기타` 는 둘 다 보내지 않는다
 * (기타 = "전체", 필터 없음과 같다). 지도 반경은 병원 모드의 지도 보기에서만
 * `latitude`+`longitude`+`radiusKm` 세 값을 함께 보낸다 — 서버는 셋 중 하나만 오면 422 를 준다.
 *
 * 클라이언트 정렬은 하지 않는다 — 서버가 스폰서 우선 노출을 이미 적용한 배열을 준다.
 */
export function useExploreFilters() {
  const params = useLocalSearchParams<{ mode?: string; category?: string }>();

  const [mode, setMode] = useState<ExploreMode>(params.mode === 'doctor' ? 'doctor' : 'hospital');
  const [selectedCategory, setSelectedCategory] = useState<ExploreCategory>(
    params.category === 'recommended'
      ? 'recommended'
      : isProcedureId(params.category)
        ? params.category
        : 'all'
  );
  const [hospitalView, setHospitalView] = useState<HospitalView>('list');
  const [sortBy, setSortBy] = useState<ExploreSortKey>('popular');
  const [onlyConsult, setOnlyConsult] = useState(false);
  const [onlyOneDay, setOnlyOneDay] = useState(false);
  const [onlySpecialist, setOnlySpecialist] = useState(false);
  const [onlyNightConsult, setOnlyNightConsult] = useState(false);
  const [onlyExperienced, setOnlyExperienced] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);

  const isMapView = mode === 'hospital' && hospitalView === 'map';
  // 지도 보기로 전환할 때만 위치 권한을 요청한다 — 리스트 보기에서부터 물으면
  // 화면을 열자마자 권한 프롬프트가 뜬다(예전 동작은 지도 컴포넌트가 그때만 마운트됐다).
  const userLocation = useUserLocation(isMapView);

  const sort = SORT_TO_SERVER[sortBy];

  // 시술/추천/기타 칩 → procedureId·recommended. '기타' 는 아무것도 보내지 않는다 —
  // "전체"라는 뜻이라 필터 없음과 같다.
  const categoryFilter: Pick<HospitalFilters, 'procedureId' | 'recommended'> =
    selectedCategory === 'recommended'
      ? { recommended: true }
      : selectedCategory === 'all'
        ? {}
        : { procedureId: selectedCategory };

  const hospitalFilters: HospitalFilters = {
    ...categoryFilter,
    sort,
    consultAvailable: onlyConsult || undefined,
    oneDay: onlyOneDay || undefined,
    hasVerifiedSpecialist: onlySpecialist || undefined,
    nightConsult: onlyNightConsult || undefined,
    minDoctorYearsOfExperience: onlyExperienced ? MIN_EXPERIENCED_YEARS : undefined,
    ...(isMapView
      ? { latitude: userLocation.location.latitude, longitude: userLocation.location.longitude, radiusKm }
      : {}),
  };

  const doctorFilters: DoctorFilters = {
    ...categoryFilter,
    sort,
    consultAvailable: onlyConsult || undefined,
    oneDay: onlyOneDay || undefined,
    verifiedSpecialist: onlySpecialist || undefined,
    nightConsult: onlyNightConsult || undefined,
    minYearsOfExperience: onlyExperienced ? MIN_EXPERIENCED_YEARS : undefined,
  };

  return {
    mode,
    setMode,
    selectedCategory,
    setSelectedCategory,
    hospitalView,
    setHospitalView,
    sortBy,
    setSortBy,
    onlyConsult,
    setOnlyConsult,
    onlyOneDay,
    setOnlyOneDay,
    onlySpecialist,
    setOnlySpecialist,
    onlyNightConsult,
    setOnlyNightConsult,
    onlyExperienced,
    setOnlyExperienced,
    radiusKm,
    setRadiusKm,
    userLocation,
    hospitalFilters,
    doctorFilters,
  };
}
