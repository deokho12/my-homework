import { useFocusEffect } from '@/navigation';
import { Ellipsis, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { CardGrid } from '@/components/layout/CardGrid';
import { Chip } from '@/components/Chip';
import { CONTAINER_CLASS, CONTAINER_PADDING } from '@/components/layout/Container';
import { QueryState } from '@/components/QueryState';
import { useDoctors } from '@/features/doctor';
import { DoctorCard } from '@/features/doctor/components/DoctorCard';
import { useHospital, useHospitals } from '@/features/hospital';
import { HospitalExploreCard } from '@/features/hospital/components/HospitalExploreCard';
import { HospitalMapView } from '@/features/hospital/components/HospitalMapView';
import { PriceCompareTable } from '@/features/hospital/components/PriceCompareTable';
import { SORT_OPTIONS, useExploreFilters } from '@/features/hospital/hooks/useExploreFilters';
import { useProcedures } from '@/features/procedure';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
import type { Doctor, ProcedureId } from '@/types/domain';
import { PROCEDURE_ICONS, type IconComponent } from '@/utils/procedureIcons';

const SCROLL_SHADOW_THRESHOLD = 8;

type Category = 'recommended' | 'all' | ProcedureId;

// All 13 procedure-category icons now live in src/utils/procedureIcons.ts (shared with the home screen's
// "시술로 찾기" grid) — only the two non-procedure special tabs (추천/기타) are defined here.
const CATEGORY_ICONS: Record<Category, IconComponent> = {
  recommended: Sparkles,
  all: Ellipsis,
  ...PROCEDURE_ICONS,
};

/** 의사 모드 카드가 필요한 소속 병원을 개별 조회한다 — 공개 `GET /doctors` 응답에는 병원 정보가 없다. */
function ExploreDoctorCard({ doctor }: { doctor: Doctor }) {
  const { data: hospital } = useHospital(doctor.hospitalId);
  return <DoctorCard doctor={doctor} hospital={hospital} />;
}

interface ResultsHeaderProps {
  /** `null` 이면 시술 목록이 아직 로딩 중이다 — 다른 카테고리 이름을 잘못 주장하지 않고 스켈레톤을 그린다. */
  selectedCategoryLabel: string | null;
  modeLabel: '병원' | '의사';
  totalCountLabel: string;
  action?: ReactNode;
}

/** 병원·의사 모드가 공유하는 카테고리 라벨 + 총 개수(+선택 액션) 헤더. */
function ResultsHeader({ selectedCategoryLabel, modeLabel, totalCountLabel, action }: ResultsHeaderProps) {
  return (
    <>
      {selectedCategoryLabel ? (
        <Text className="mb-2 text-base font-bold text-neutral-900">
          &ldquo;{selectedCategoryLabel}&rdquo; {modeLabel}
        </Text>
      ) : (
        // 카테고리 라벨이 아직 없다(로딩 중) — "추천" 이라고 잘못 주장하지 않고 자리를 비운다.
        <View
          className="mb-2 h-5 w-32 animate-pulse rounded bg-neutral-100"
          role="status"
          accessibilityLabel="카테고리 이름을 불러오는 중이에요"
        />
      )}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm text-neutral-500">{totalCountLabel}</Text>
        {action ?? null}
      </View>
    </>
  );
}

export default function ExplorePage() {
  const { data: procedures = [], isPending: proceduresPending } = useProcedures();
  // Order matches the product spec exactly: 추천 first, then every procedure in the server's
  // fixed order (implant→orthodontics→laminate→inlay→crown→whitening→wisdom-tooth→cavity→
  // gum-disease→splint→snoring-device→tmj→botox), then 기타 (was "전체" — same "no filter"
  // behavior, renamed + moved last). Empty while `procedures` is still loading.
  const categoryTabs = useMemo<{ key: Category; label: string }[]>(
    () => [
      { key: 'recommended', label: '추천' },
      ...procedures.map((procedure) => ({ key: procedure.id as Category, label: procedure.name })),
      { key: 'all', label: '기타' },
    ],
    [procedures]
  );

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
  // ★ 클라이언트 정렬·필터를 하지 않는다. 서버가 스폰서 우선 노출까지 이미 적용한 배열을 준다.
  const hospitalsQuery = useHospitals(hospitalFilters, { enabled: mode === 'hospital' });
  const doctorsQuery = useDoctors(doctorFilters, { enabled: mode === 'doctor' });

  const matchedCategoryTab = categoryTabs.find((tab) => tab.key === selectedCategory);
  const isProcedureCategory = selectedCategory !== 'recommended' && selectedCategory !== 'all';
  // "못 찾음" 이 두 가지 다른 이유일 수 있다: (1) 시술 목록이 아직 로딩 중이라 안 왔거나,
  // (2) 데이터가 다 왔는데도 정말 그런 카테고리가 없다. 전자를 "추천" 이라고 잘못
  // 단정하면 안 된다. `null` 이면 아래에서 스켈레톤을 그린다.
  const selectedCategoryLabel = matchedCategoryTab
    ? matchedCategoryTab.label
    : isProcedureCategory && proceduresPending
      ? null
      : '추천';

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
            {proceduresPending ? (
              // `categoryTabs` 는 로딩 중엔 [추천, 기타] 뿐이다 — 이걸 그대로 그리면 진짜
              // 13종 목록인 것처럼 보여 "기타"(=전체)를 누르도록 유도한다. 로딩 표시로 대신한다.
              <View
                className="flex-row gap-2"
                role="status"
                accessibilityLabel="시술 카테고리를 불러오는 중이에요"
              >
                {Array.from({ length: 6 }).map((_, index) => (
                  <View key={index} className="h-8 w-16 animate-pulse rounded-full bg-neutral-100" />
                ))}
              </View>
            ) : (
              categoryTabs.map((tab) => (
                <Chip
                  key={tab.key}
                  label={tab.label}
                  icon={CATEGORY_ICONS[tab.key]}
                  selected={selectedCategory === tab.key}
                  onPress={() => setSelectedCategory(tab.key)}
                />
              ))
            )}
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
            isEmpty={(data) => data.items.length === 0}
            emptyState={{
              title: isMapMode
                ? `반경 ${radiusKm < 1 ? `${radiusKm * 1000}m` : `${radiusKm}km`} 안에 병원이 없어요`
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
                    selectedCategoryLabel={selectedCategoryLabel}
                    modeLabel="병원"
                    totalCountLabel={`총 ${data.meta.totalItems}곳`}
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
                          activeCategory={
                            selectedCategory !== 'all' && selectedCategory !== 'recommended'
                              ? selectedCategory
                              : undefined
                          }
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
            emptyState={{ title: '조건에 맞는 의사가 없어요' }}
          >
            {(data) => (
              <ScrollView
                contentContainerClassName={cx(CONTAINER_CLASS, 'pb-8 pt-4')}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                <ResultsHeader
                  selectedCategoryLabel={selectedCategoryLabel}
                  modeLabel="의사"
                  totalCountLabel={`총 ${data.meta.totalItems}명`}
                />

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
