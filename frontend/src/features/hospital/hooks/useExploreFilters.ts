import { useMemo, useState } from 'react';

import type { DoctorCategoryBaseFilters } from '@/features/doctor/hooks/useDoctorsByCategory';
import type { HospitalCategoryBaseFilters } from '@/features/hospital/hooks/useHospitalsByCategory';
import {
  categoryFromLegacy,
  isCategoryId,
  isProcedureId,
  type CategoryId,
} from '@/features/procedure/taxonomy';
import type { CategorySelection } from '@/features/procedure/lib/resolveCategoryFilter';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useLocalSearchParams } from '@/navigation';

export type ExploreMode = 'doctor' | 'hospital';
export type HospitalView = 'list' | 'map';
/** 탐색 탭 하나. 시술 대분류 9개 + "추천" — 옛 기타 탭(`all`)은 없다. */
export type ExploreCategory = 'recommended' | CategoryId;
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

/** 정렬 칩 → 서버 `sort` 값. 카테고리 화면도 같은 표를 쓴다 — 두 벌로 갈라지면 안 된다. */
export const SORT_TO_SERVER: Record<ExploreSortKey, 'rating' | 'reviewCount' | 'consultCount'> = {
  popular: 'rating',
  reviews: 'reviewCount',
  consults: 'consultCount',
};

/**
 * `/explore?category=` 한 값 → 탭 하나.
 *
 * **옛 북마크와 옛 딥링크를 둘 다 받는다.** 지금의 대분류 id(`cavity`)는 그대로 쓰고,
 * 서버 시술 13종(`crown`, `gum-disease` …)은 그 시술이 속한 대분류로 올려 보낸다.
 * 그 밖의 값(옛 기타 탭 `all`, `bogus`, 없음)은 추천으로 떨어진다 — 모르는 값을
 * 서버에 그대로 넘기면 서버는 문자열 존재만 검사해서 "설명 없는 빈 목록"을 돌려준다.
 *
 * `implant`·`orthodontics`·`cavity`·`tmj`·`botox` 는 대분류 id 이면서 서버 시술 id 이기도
 * 하다 — 어느 분기로 가든 같은 대분류가 나오므로 순서는 결과를 바꾸지 않는다.
 */
export function parseExploreCategoryParam(value: string | undefined): ExploreCategory {
  if (value === 'recommended') return 'recommended';
  if (isCategoryId(value)) return value;
  if (isProcedureId(value)) {
    const category = categoryFromLegacy(value);
    if (category) return category.id;
  }
  return 'recommended';
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
 * **카테고리 탭은 여기서 서버 파라미터로 바꾸지 않는다.** 대분류 하나가 서버 시술 여러 개에
 * 걸릴 수 있어서(충치치료 = `cavity`+`inlay`+`crown`) `procedureId` 한 값으로 못 옮기는
 * 경우가 있다. 이 훅은 선택(`selection`)만 내려주고, 요청 방식은 `useHospitalsByCategory` /
 * `useDoctorsByCategory` 가 `resolveCategoryFilter`(순수 함수)로 정한다 — 그래야 탐색 화면과
 * 카테고리 화면이 같은 판정을 공유한다.
 *
 * 지도 반경은 병원 모드의 지도 보기에서만 `latitude`+`longitude`+`radiusKm` 세 값을 함께
 * 보낸다 — 서버는 셋 중 하나만 오면 422 를 준다.
 *
 * 클라이언트 정렬은 하지 않는다 — 서버가 스폰서 우선 노출을 이미 적용한 배열을 준다.
 */
export function useExploreFilters() {
  const params = useLocalSearchParams<{ mode?: string; category?: string; specialist?: string }>();

  const [mode, setMode] = useState<ExploreMode>(params.mode === 'doctor' ? 'doctor' : 'hospital');
  const [selectedCategory, setSelectedCategory] = useState<ExploreCategory>(() =>
    parseExploreCategoryParam(params.category)
  );
  const [hospitalView, setHospitalView] = useState<HospitalView>('list');
  const [sortBy, setSortBy] = useState<ExploreSortKey>('popular');
  const [onlyConsult, setOnlyConsult] = useState(false);
  const [onlyOneDay, setOnlyOneDay] = useState(false);
  // `?specialist=1` 은 홈 배너 "전문의가 검증된 병원만 모았어요" 가 쓰는 딥링크다.
  // `mode`·`category` 와 같은 규약 — 마운트 때 한 번만 읽고, 그 뒤 칩을 끄거나 켜도 주소는
  // 다시 쓰지 않는다. 모르는 값(`?specialist=yes`)은 조용히 꺼진 상태로 연다.
  const [onlySpecialist, setOnlySpecialist] = useState(params.specialist === '1');
  const [onlyNightConsult, setOnlyNightConsult] = useState(false);
  const [onlyExperienced, setOnlyExperienced] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);

  const isMapView = mode === 'hospital' && hospitalView === 'map';
  // 목록 카드가 거리를 보여주므로 리스트 보기에서도 좌표가 필요하다 — 권한 창은 탐색·카테고리
  // 두 화면에서만 뜬다(홈·검색·상세는 이 훅을 부르지 않는다). 거부해도 화면은 지역명만 보이고
  // 지도는 서울시청 폴백으로 그려진다.
  const userLocation = useUserLocation();

  const sort = SORT_TO_SERVER[sortBy];

  // 탭 → 대분류 선택. 이 값이 서버 파라미터로 바뀌는 곳은 `use*ByCategory` 한 곳뿐이다.
  // 탐색 화면에는 세부 시술 칩이 없다(카테고리 화면 전용) — 항상 "대분류 전체"다.
  const selection = useMemo<CategorySelection>(
    () =>
      selectedCategory === 'recommended'
        ? { kind: 'recommended' }
        : { kind: 'category', categoryId: selectedCategory, subProcedureId: null },
    [selectedCategory]
  );

  const hospitalFilters: HospitalCategoryBaseFilters = {
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

  const doctorFilters: DoctorCategoryBaseFilters = {
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
    selection,
    hospitalFilters,
    doctorFilters,
  };
}
