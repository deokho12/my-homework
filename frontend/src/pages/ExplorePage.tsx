import { useFocusEffect } from '@/navigation';
import { List, Map as MapIcon, Star } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { CardGrid } from '@/components/layout/CardGrid';
import { Chip } from '@/components/Chip';
import { CONTAINER_CLASS, CONTAINER_PADDING } from '@/components/layout/Container';
import { ListMoreFooter } from '@/components/ListMoreFooter';
import { QueryState } from '@/components/QueryState';
import { DoctorCard } from '@/features/doctor/components/DoctorCard';
import { useDoctorsByCategory } from '@/features/doctor/hooks/useDoctorsByCategory';
import { useHospital } from '@/features/hospital';
import { HospitalExploreCard } from '@/features/hospital/components/HospitalExploreCard';
import { HospitalMapView } from '@/features/hospital/components/HospitalMapView';
import { PriceCompareTable } from '@/features/hospital/components/PriceCompareTable';
import { ResultsHeader } from '@/features/hospital/components/ResultsHeader';
import { useHospitalsByCategory } from '@/features/hospital/hooks/useHospitalsByCategory';
import {
  SORT_OPTIONS,
  useExploreFilters,
  type ExploreCategory,
} from '@/features/hospital/hooks/useExploreFilters';
import type { CategoryId } from '@/features/procedure/taxonomy';
import { comingSoonDescription } from '@/features/procedure/availability';
import { useProcedureAvailability } from '@/features/procedure/hooks/useProcedureAvailability';
import { CATEGORIES, getCategory } from '@/features/procedure/taxonomy';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
import type { Doctor } from '@/types/domain';
import { CATEGORY_ICONS, thin, type IconComponent } from '@/utils/procedureIcons';

const SCROLL_SHADOW_THRESHOLD = 8;

/**
 * 대분류 9개 아이콘은 `utils/procedureIcons.tsx` 가 소유한다 — 여기서 더하는 건 "추천" 탭뿐이다.
 * `추천` 의 별도 **같은 선 굵기(1.75)** 로 감싼다 (EXPLORE-4) — 감싸지 않으면 lucide 기본값 2
 * 라서 한 줄에서 첫 탭만 굵어 보인다.
 */
const TAB_ICONS: Record<ExploreCategory, IconComponent> = {
  recommended: thin(Star, 'RecommendedIcon'),
  ...CATEGORY_ICONS,
};

/**
 * 탭 **목록**은 정적이다(이름·순서는 번들 상수) — 라벨의 "· 준비중" 만 서버가 준
 * 가용성에서 온다. 준비중 분야도 탭에서 빼지 않는다: 빼면 "이 서비스는 스케일링을 아예 안
 * 다룬다" 로 읽힌다 (`SubProcedureChips`·홈 격자와 같은 판단).
 */
function categoryTabs(isCategoryComingSoon: (id: CategoryId) => boolean): {
  key: ExploreCategory;
  label: string;
}[] {
  return [
    { key: 'recommended', label: '추천' },
    ...CATEGORIES.map((category) => ({
      key: category.id,
      label: isCategoryComingSoon(category.id) ? `${category.name} · 준비중` : category.name,
    })),
  ];
}

/** 의사 모드 카드가 필요한 소속 병원을 개별 조회한다 — 공개 `GET /doctors` 응답에는 병원 정보가 없다. */
function ExploreDoctorCard({ doctor }: { doctor: Doctor }) {
  const { data: hospital } = useHospital(doctor.hospitalId);
  return <DoctorCard doctor={doctor} hospital={hospital} />;
}

export default function ExplorePage() {
  const {
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
  } = useExploreFilters();

  const [showPriceTable, setShowPriceTable] = useState(false);

  const availability = useProcedureAvailability();
  const categoryTabList = useMemo(
    () => categoryTabs(availability.isCategoryComingSoon),
    [availability]
  );

  const setScrolled = useScrollShadowStore((state) => state.setScrolled);
  const scrollOffsetRef = useRef(0);
  /** 리스트 ScrollView. 필터가 바뀌면 맨 위로 되돌린다 (아래 useEffect). */
  const listRef = useRef<HTMLDivElement>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = offsetY;
    setScrolled(offsetY > SCROLL_SHADOW_THRESHOLD);
  };

  useEffect(() => {
    if (hospitalView === 'map') {
      // The list ScrollView unmounts while the map is shown and remounts at offset 0 when we
      // switch back — reset the remembered offset too, or the next focus recompute would use
      // the stale pre-map scroll position and show a shadow the freshly-mounted list doesn't have.
      scrollOffsetRef.current = 0;
      setScrolled(false);
    }
  }, [hospitalView, setScrolled]);

  useFocusEffect(
    useCallback(() => {
      if (hospitalView !== 'map') {
        setScrolled(scrollOffsetRef.current > SCROLL_SHADOW_THRESHOLD);
      }
    }, [hospitalView, setScrolled])
  );

  /**
   * 필터가 바뀌면 목록은 다시 첫 20개다 — 40번째 카드를 보던 자리에 남아 있으면 **다른
   * 목록의 중간**을 보게 된다. 「더 보기」로 이어 붙일 때는 건드리지 않는다.
   *
   * 묶음 자체를 되돌리는 코드는 없다 — 아래 값들은 전부 queryKey 의 일부라 새 쿼리가 된다.
   */
  const filterSignature = [
    mode,
    selectedCategory,
    sortBy,
    onlyConsult,
    onlyOneDay,
    onlySpecialist,
    onlyNightConsult,
    onlyExperienced,
    hospitalView,
    radiusKm,
  ].join('|');

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
    scrollOffsetRef.current = 0;
    setScrolled(false);
  }, [filterSignature, setScrolled]);

  // 모드별로 조회를 하나만 켠다 — 병원 모드에서 의사 목록을(또는 반대로) 미리 부르지 않는다.
  // ★ 거르기도 정렬도 클라이언트가 하지 않는다. 탭 선택 → 서버 파라미터 변환은
  //   `selectionToListFilters`(순수 함수) 한 곳이고, 카테고리 화면도 같은 함수를 쓴다.
  const hospitalsQuery = useHospitalsByCategory(selection, hospitalFilters, {
    enabled: mode === 'hospital',
  });
  const doctorsQuery = useDoctorsByCategory(selection, doctorFilters, { enabled: mode === 'doctor' });

  // 탭 라벨("충치치료 · 준비중")이 아니라 카테고리 이름을 쓴다 — 헤더는 목록을 가리키지
  // 탭을 가리키지 않는다.
  const selectedCategoryLabel =
    selectedCategory === 'recommended' ? '추천' : getCategory(selectedCategory).name;
  // 준비중 문장은 `availability.ts` 가 만든다 — 분야 전체면 `이 분야는`, 세부 하나면
  // `이 시술은`. 카테고리 화면과 같은 함수라 같은 상황에서 두 화면의 문장이 같다.
  const comingSoonText = comingSoonDescription(availability, selection);

  const isMapMode = mode === 'hospital' && hospitalView === 'map';

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <View className={cx(CONTAINER_PADDING, 'border-b border-neutral-100 bg-white pb-3 pt-4')}>
        <Text className="mb-3 text-2xl font-extrabold text-neutral-900">병원 탐색</Text>
        <View className="flex-row rounded-full bg-neutral-100 p-1">
          <Pressable
            onPress={() => setMode('doctor')}
            className={`flex-1 items-center rounded-full py-2 ${mode === 'doctor' ? 'bg-white' : ''}`}
          >
            <Text className={`text-sm font-bold ${mode === 'doctor' ? 'text-brand-700' : 'text-neutral-500'}`}>
              의사
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('hospital')}
            className={`flex-1 items-center rounded-full py-2 ${mode === 'hospital' ? 'bg-white' : ''}`}
          >
            <Text className={`text-sm font-bold ${mode === 'hospital' ? 'text-brand-700' : 'text-neutral-500'}`}>
              병원
            </Text>
          </Pressable>
        </View>

        {/*
          보기 전환도 **같은 칩**이다 (EXPLORE-4) — 예전에는 검은 알약이라 아래 네 줄의
          brand 칩과 규칙이 달랐고, 켜진 칩이 두 가지 색으로 보였다.
        */}
        {mode === 'hospital' ? (
          <View className="-mb-2 mt-3 flex-row">
            <Chip
              label="리스트 보기"
              icon={List}
              selected={hospitalView === 'list'}
              onPress={() => setHospitalView('list')}
            />
            <Chip
              label="지도 보기"
              icon={MapIcon}
              selected={hospitalView === 'map'}
              onPress={() => setHospitalView('map')}
            />
          </View>
        ) : null}
      </View>

      <View className="flex-1">
        <View className="border-b border-neutral-100 bg-white py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={CONTAINER_PADDING}>
            {categoryTabList.map((tab) => (
              <Chip
                key={tab.key}
                label={tab.label}
                icon={TAB_ICONS[tab.key]}
                selected={selectedCategory === tab.key}
                onPress={() => setSelectedCategory(tab.key)}
              />
            ))}
          </ScrollView>
        </View>

        <View className="border-b border-neutral-100 bg-white py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={CONTAINER_PADDING}>
            {SORT_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                selected={sortBy === option.key}
                onPress={() => setSortBy(option.key)}
              />
            ))}
          </ScrollView>
        </View>

        <View className="border-b border-neutral-100 bg-white py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={CONTAINER_PADDING}>
            <Chip label="상담가능" selected={onlyConsult} onPress={() => setOnlyConsult((value) => !value)} />
            <Chip label="원데이" selected={onlyOneDay} onPress={() => setOnlyOneDay((value) => !value)} />
            <Chip
              label="전문의"
              selected={onlySpecialist}
              onPress={() => setOnlySpecialist((value) => !value)}
            />
            {/* `진료시간` 이었다 — 실제로 거르는 값(`nightConsult`)에 이름을 맞췄다 (EXPLORE-4).
                쿼리 키도 서버 파라미터도 그대로다. */}
            <Chip
              label="야간상담"
              selected={onlyNightConsult}
              onPress={() => setOnlyNightConsult((value) => !value)}
            />
            <Chip
              label="경력"
              selected={onlyExperienced}
              onPress={() => setOnlyExperienced((value) => !value)}
            />
          </ScrollView>
        </View>

        {mode === 'hospital' ? (
          <QueryState
            isLoading={hospitalsQuery.isLoading}
            isError={hospitalsQuery.isError}
            data={hospitalsQuery.data}
            onRetry={() => {
              void hospitalsQuery.refetch();
            }}
            isRetrying={hospitalsQuery.isError && hospitalsQuery.isFetching}
            // 지도 보기에서는 0건이어도 `QueryState` 의 공용 빈 화면으로 통째로 바꾸지 않는다
            // — 그러면 반경 칩(재검색 수단)까지 함께 사라져 사용자가 막다른 곳에 갇힌다.
            // `HospitalMapView` 를 그대로 마운트하고, 빈 안내는 그 안에서 지도 위 오버레이로
            // 보여준다(반경 칩은 계속 보이고 눌린다).
            isEmpty={(data) => !isMapMode && data.items.length === 0}
            emptyState={{
              // 0건의 이유가 둘이다: 그 분야를 하는 병원이 아직 없거나(준비중), 조건이
              // 좁거나. 전자에 "조건에 맞는" 이라고 하면 필터를 풀면 나올 것처럼 보인다.
              title: comingSoonText ? '등록된 병원이 아직 없어요' : '조건에 맞는 병원이 없어요',
              description: comingSoonText,
            }}
          >
            {(data) =>
              isMapMode ? (
                <HospitalMapView
                  hospitals={data.items}
                  totalCount={data.meta.totalItems}
                  location={userLocation.location}
                  locationStatus={userLocation.status}
                  radiusKm={radiusKm}
                  onRadiusKmChange={setRadiusKm}
                />
              ) : (
                <ScrollView
                  ref={listRef}
                  contentContainerClassName={cx(CONTAINER_CLASS, 'pb-8 pt-4')}
                  showsVerticalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                >
                  <ResultsHeader
                    label={selectedCategoryLabel}
                    modeLabel="병원"
                    totalCount={data.meta.totalItems}
                    action={
                      <Pressable onPress={() => setShowPriceTable((value) => !value)}>
                        <Text className="text-sm font-semibold text-brand-700">
                          {showPriceTable ? '카드로 보기' : '가격 비교표 보기'}
                        </Text>
                      </Pressable>
                    }
                  />

                  {showPriceTable ? (
                    <>
                      {/* 표는 **불러온 카드만** 비교한다 — 20곳만 보고 "가장 싼 곳"이라 읽지 않게. */}
                      {data.items.length < data.meta.totalItems ? (
                        <Text className="mb-2 text-xs text-neutral-500">
                          불러온 {data.items.length}곳끼리 비교한 표예요
                        </Text>
                      ) : null}
                      <PriceCompareTable hospitals={data.items} />
                    </>
                  ) : (
                    <CardGrid columns="wide">
                      {data.items.map((hospital) => (
                        <HospitalExploreCard
                          key={hospital.id}
                          hospital={hospital}
                          activeCategory={selectedCategory !== 'recommended' ? selectedCategory : undefined}
                          // 허용했을 때만 좌표가 넘어간다 — 카드는 `null` 이면 거리를 그리지 않는다.
                          userPoint={userLocation.point}
                        />
                      ))}
                    </CardGrid>
                  )}

                  <ListMoreFooter
                    loadedCount={data.items.length}
                    totalCount={data.meta.totalItems}
                    unit="곳"
                    noun="병원"
                    isLoadingMore={hospitalsQuery.isFetchingNextPage}
                    isError={hospitalsQuery.isFetchNextPageError}
                    onLoadMore={() => {
                      void hospitalsQuery.fetchNextPage();
                    }}
                  />
                </ScrollView>
              )
            }
          </QueryState>
        ) : (
          <QueryState
            isLoading={doctorsQuery.isLoading}
            isError={doctorsQuery.isError}
            data={doctorsQuery.data}
            onRetry={() => {
              void doctorsQuery.refetch();
            }}
            isRetrying={doctorsQuery.isError && doctorsQuery.isFetching}
            isEmpty={(data) => data.items.length === 0}
            emptyState={{
              title: comingSoonText ? '등록된 의사가 아직 없어요' : '조건에 맞는 의사가 없어요',
              description: comingSoonText,
            }}
          >
            {(data) => (
              <ScrollView
                ref={listRef}
                contentContainerClassName={cx(CONTAINER_CLASS, 'pb-8 pt-4')}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                <ResultsHeader label={selectedCategoryLabel} modeLabel="의사" totalCount={data.meta.totalItems} />

                <CardGrid columns="wide">
                  {data.items.map((doctor) => (
                    <ExploreDoctorCard key={doctor.id} doctor={doctor} />
                  ))}
                </CardGrid>

                <ListMoreFooter
                  loadedCount={data.items.length}
                  totalCount={data.meta.totalItems}
                  unit="명"
                  noun="의사"
                  isLoadingMore={doctorsQuery.isFetchingNextPage}
                  isError={doctorsQuery.isFetchNextPageError}
                  onLoadMore={() => {
                    void doctorsQuery.fetchNextPage();
                  }}
                />
              </ScrollView>
            )}
          </QueryState>
        )}
      </View>
    </SafeAreaView>
  );
}
