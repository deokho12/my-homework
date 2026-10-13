import { useFocusEffect } from '@/navigation';
import { Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { CardGrid } from '@/components/layout/CardGrid';
import { Chip } from '@/components/Chip';
import { CONTAINER_CLASS, CONTAINER_PADDING } from '@/components/layout/Container';
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
import { CATEGORIES, getCategory, getLegacyIdsOf } from '@/features/procedure/taxonomy';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
import type { Doctor } from '@/types/domain';
import { CATEGORY_ICONS, type IconComponent } from '@/utils/procedureIcons';

const SCROLL_SHADOW_THRESHOLD = 8;

/** 대분류 9개 아이콘은 `utils/procedureIcons.ts` 가 소유한다 — 여기서 더하는 건 "추천" 탭뿐이다. */
const TAB_ICONS: Record<ExploreCategory, IconComponent> = {
  recommended: Star,
  ...CATEGORY_ICONS,
};

/**
 * 탭 목록은 정적이다 — 서버 시술 목록을 기다리던 스켈레톤이 사라진 이유다.
 * 서버가 아는 시술이 하나도 없는 대분류는 라벨에 "· 준비중" 을 달되 탭에서 빼지 않는다
 * (`SubProcedureChips`·홈 격자와 같은 판단).
 */
const CATEGORY_TABS: { key: ExploreCategory; label: string }[] = [
  { key: 'recommended', label: '추천' },
  ...CATEGORIES.map((category) => ({
    key: category.id,
    label: getLegacyIdsOf(category.id).length === 0 ? `${category.name} · 준비중` : category.name,
  })),
];

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

  const setScrolled = useScrollShadowStore((state) => state.setScrolled);
  const scrollOffsetRef = useRef(0);

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

  // 모드별로 조회를 하나만 켠다 — 병원 모드에서 의사 목록을(또는 반대로) 미리 부르지 않는다.
  // ★ 정렬은 클라이언트가 하지 않는다. 대분류가 서버 시술 여러 개에 걸릴 때만 받아서 거르고,
  //   그 판정은 `resolveCategoryFilter` 한 곳에 있다(카테고리 화면과 공유).
  const hospitalsQuery = useHospitalsByCategory(selection, hospitalFilters, {
    enabled: mode === 'hospital',
  });
  const doctorsQuery = useDoctorsByCategory(selection, doctorFilters, { enabled: mode === 'doctor' });

  // 탭 라벨("충치치료 · 준비중")이 아니라 카테고리 이름을 쓴다 — 헤더는 목록을 가리키지
  // 탭을 가리키지 않는다.
  const selectedCategoryLabel =
    selectedCategory === 'recommended' ? '추천' : getCategory(selectedCategory).name;

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

        {mode === 'hospital' ? (
          <View className="mt-3 flex-row">
            <Pressable
              onPress={() => setHospitalView('list')}
              className={`mr-2 rounded-full px-3.5 py-1.5 ${hospitalView === 'list' ? 'bg-neutral-900' : 'bg-neutral-100'}`}
            >
              <Text className={`text-sm font-medium ${hospitalView === 'list' ? 'text-white' : 'text-neutral-500'}`}>
                리스트 보기
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setHospitalView('map')}
              className={`rounded-full px-3.5 py-1.5 ${hospitalView === 'map' ? 'bg-neutral-900' : 'bg-neutral-100'}`}
            >
              <Text className={`text-sm font-medium ${hospitalView === 'map' ? 'text-white' : 'text-neutral-500'}`}>
                지도 보기
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className="flex-1">
        <View className="border-b border-neutral-100 bg-white py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={CONTAINER_PADDING}>
            {CATEGORY_TABS.map((tab) => (
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
            <Chip
              label="진료시간"
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
              // 0건의 이유가 둘이다: 서버에 물어볼 시술이 아예 없거나(준비중 대분류),
              // 물었는데 없거나. 전자에 "조건에 맞는" 이라고 하면 필터를 풀면 나올 것처럼 보인다.
              title:
                hospitalsQuery.plan.mode === 'empty'
                  ? '등록된 병원이 아직 없어요'
                  : '조건에 맞는 병원이 없어요',
            }}
          >
            {(data) =>
              isMapMode ? (
                <HospitalMapView
                  hospitals={data.items}
                  location={userLocation.location}
                  locationStatus={userLocation.status}
                  radiusKm={radiusKm}
                  onRadiusKmChange={setRadiusKm}
                />
              ) : (
                <ScrollView
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
                    <PriceCompareTable hospitals={data.items} />
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
              title:
                doctorsQuery.plan.mode === 'empty'
                  ? '등록된 의사가 아직 없어요'
                  : '조건에 맞는 의사가 없어요',
            }}
          >
            {(data) => (
              <ScrollView
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
              </ScrollView>
            )}
          </QueryState>
        )}
      </View>
    </SafeAreaView>
  );
}
