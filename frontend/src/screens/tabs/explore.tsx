import { useFocusEffect, useLocalSearchParams } from '@/navigation';
import { Ellipsis, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { CardGrid } from '@/components/layout/CardGrid';
import { Chip } from '@/components/Chip';
import { CONTAINER_CLASS, CONTAINER_PADDING } from '@/components/layout/Container';
import { DoctorCard } from '@/features/doctor';
import { HospitalExploreCard } from '@/features/hospital/components/HospitalExploreCard';
import { HospitalMapView } from '@/features/hospital/components/HospitalMapView';
import { PriceCompareTable } from '@/features/hospital/components/PriceCompareTable';
import { useProcedures } from '@/features/procedure';
import { useDoctorStore } from '@/store/useDoctorStore';
import { useHospitalStore } from '@/store/useHospitalStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
import type { Doctor, Hospital, ProcedureId } from '@/types/domain';
import { PROCEDURE_ICONS, type IconComponent } from '@/utils/procedureIcons';
import { isVerifiedSpecialist } from '@/utils/specialty';
import { isEligibleForRecommendedSponsoredPlacement, isEligibleForSponsoredPlacement } from '@/utils/sponsorship';

const SCROLL_SHADOW_THRESHOLD = 8;
const MIN_EXPERIENCED_YEARS = 10;

type Mode = 'doctor' | 'hospital';
type HospitalView = 'list' | 'map';
type Category = 'recommended' | 'all' | ProcedureId;
type SortKey = 'popular' | 'reviews' | 'consults';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: '인기순' },
  { key: 'reviews', label: '후기순' },
  { key: 'consults', label: '상담많은순' },
];

// All 13 procedure-category icons now live in src/utils/procedureIcons.ts (shared with the home screen's
// "시술로 찾기" grid) — only the two non-procedure special tabs (추천/기타) are defined here.
const CATEGORY_ICONS: Record<Category, IconComponent> = {
  recommended: Sparkles,
  all: Ellipsis,
  ...PROCEDURE_ICONS,
};

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ mode?: string; category?: string }>();
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
  const [mode, setMode] = useState<Mode>(params.mode === 'doctor' ? 'doctor' : 'hospital');
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    params.category === 'recommended' ? 'recommended' : (params.category as ProcedureId) || 'all'
  );
  const [hospitalView, setHospitalView] = useState<HospitalView>('list');
  const [sortBy, setSortBy] = useState<SortKey>('popular');
  const [onlyConsult, setOnlyConsult] = useState(false);
  const [onlyOneDay, setOnlyOneDay] = useState(false);
  // NEW filters. "치아고민" filter was intentionally NOT added here — the category tabs above already
  // filter by procedure/treatment concern, so a duplicate "치아고민" chip would just repeat that axis.
  const [onlySpecialist, setOnlySpecialist] = useState(false);
  const [onlyNightConsult, setOnlyNightConsult] = useState(false);
  const [onlyExperienced, setOnlyExperienced] = useState(false);
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

  const allHospitals = useHospitalStore((state) => state.hospitals);
  const hospitalById = useMemo(() => new Map(allHospitals.map((h) => [h.id, h])), [allHospitals]);

  // Doctors grouped by hospital, used for the hospital-mode "전문의"/"경력" filters below. Reads from
  // useDoctorStore (not the static src/data/doctors.ts array) so that verification-status edits made in
  // the admin specialist-review screen are reflected here live.
  const doctors = useDoctorStore((state) => state.doctors);
  const doctorsByHospitalId = useMemo(() => {
    const map = new Map<string, Doctor[]>();
    doctors.forEach((doctor) => {
      const list = map.get(doctor.hospitalId) ?? [];
      list.push(doctor);
      map.set(doctor.hospitalId, list);
    });
    return map;
  }, [doctors]);

  const sortHospitals = (list: typeof allHospitals) =>
    [...list].sort((a, b) => {
      if (sortBy === 'reviews') return b.reviewCount - a.reviewCount;
      if (sortBy === 'consults') return b.consultCount - a.consultCount;
      return b.rating - a.rating;
    });

  const filteredHospitals = useMemo(() => {
    let list = allHospitals;
    if (selectedCategory === 'recommended') list = list.filter((hospital) => hospital.isRecommended);
    else if (selectedCategory !== 'all') list = list.filter((hospital) => hospital.procedureIds.includes(selectedCategory));
    if (onlyConsult) list = list.filter((hospital) => hospital.consultAvailable);
    if (onlyOneDay) list = list.filter((hospital) => hospital.isOneDay);
    if (onlySpecialist) {
      list = list.filter((hospital) => (doctorsByHospitalId.get(hospital.id) ?? []).some(isVerifiedSpecialist));
    }
    if (onlyNightConsult) list = list.filter((hospital) => hospital.features?.nightConsult);
    if (onlyExperienced) {
      list = list.filter((hospital) =>
        (doctorsByHospitalId.get(hospital.id) ?? []).some(
          (doctor) => doctor.yearsOfExperience >= MIN_EXPERIENCED_YEARS
        )
      );
    }

    const sortedNormal = sortHospitals(list);
    if (selectedCategory === 'all') return sortedNormal;

    const isEligible = (hospital: Hospital) =>
      selectedCategory === 'recommended'
        ? isEligibleForRecommendedSponsoredPlacement(hospital)
        : isEligibleForSponsoredPlacement(hospital, selectedCategory);

    const sponsored = list
      .filter(isEligible)
      .sort((a, b) => (a.sponsoredRank ?? Infinity) - (b.sponsoredRank ?? Infinity));
    const sponsoredIds = new Set(sponsored.map((hospital) => hospital.id));

    return [...sponsored, ...sortedNormal.filter((hospital) => !sponsoredIds.has(hospital.id))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allHospitals,
    selectedCategory,
    onlyConsult,
    onlyOneDay,
    onlySpecialist,
    onlyNightConsult,
    onlyExperienced,
    sortBy,
    doctorsByHospitalId,
  ]);

  const filteredDoctors = useMemo(() => {
    let list = doctors;
    if (selectedCategory === 'recommended') list = list.filter((doctor) => doctor.isRecommended);
    else if (selectedCategory !== 'all') list = list.filter((doctor) => doctor.procedureIds.includes(selectedCategory));
    if (onlyConsult) list = list.filter((doctor) => hospitalById.get(doctor.hospitalId)?.consultAvailable);
    if (onlyOneDay) list = list.filter((doctor) => hospitalById.get(doctor.hospitalId)?.isOneDay);
    if (onlySpecialist) list = list.filter(isVerifiedSpecialist);
    if (onlyNightConsult) list = list.filter((doctor) => hospitalById.get(doctor.hospitalId)?.features?.nightConsult);
    if (onlyExperienced) list = list.filter((doctor) => doctor.yearsOfExperience >= MIN_EXPERIENCED_YEARS);

    return [...list].sort((a, b) => {
      if (sortBy === 'reviews') return b.reviewCount - a.reviewCount;
      if (sortBy === 'consults') return b.consultCount - a.consultCount;
      // 평점이 잠긴(null) 전문의는 0점이 아니라 "모른다"다 — 정렬에서는 뒤로 보낸다.
      if (a.rating === null) return b.rating === null ? 0 : 1;
      if (b.rating === null) return -1;
      return b.rating - a.rating;
    });
  }, [doctors, hospitalById, selectedCategory, onlyConsult, onlyOneDay, onlySpecialist, onlyNightConsult, onlyExperienced, sortBy]);

  const resultCount = mode === 'doctor' ? filteredDoctors.length : filteredHospitals.length;
  const matchedCategoryTab = categoryTabs.find((tab) => tab.key === selectedCategory);
  const isProcedureCategory = selectedCategory !== 'recommended' && selectedCategory !== 'all';
  // "못 찾음" 이 두 가지 다른 이유일 수 있다: (1) 시술 목록이 아직 로딩 중이라 안 왔거나,
  // (2) 데이터가 다 왔는데도 정말 그런 카테고리가 없다. 전자를 "추천" 이라고 잘못
  // 단정하면 안 된다 — `filteredHospitals`/`resultCount` 는 이미 `selectedCategory` 로
  // 올바르게 필터링돼 있는데 제목만 다른 카테고리를 주장하게 된다. `null` 이면
  // 아래에서 스켈레톤을 그린다.
  const selectedCategoryLabel = matchedCategoryTab
    ? matchedCategoryTab.label
    : isProcedureCategory && proceduresPending
      ? null
      : '추천';

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

        {mode === 'hospital' && hospitalView === 'map' ? (
          <HospitalMapView hospitals={filteredHospitals} />
        ) : (
          <ScrollView
            contentContainerClassName={cx(CONTAINER_CLASS, 'pb-8 pt-4')}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {selectedCategoryLabel ? (
              <Text className="mb-2 text-base font-bold text-neutral-900">
                &ldquo;{selectedCategoryLabel}&rdquo; {mode === 'doctor' ? '의사' : '병원'}
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
              <Text className="text-sm text-neutral-500">총 {resultCount}{mode === 'doctor' ? '명' : '곳'}</Text>
              {mode === 'hospital' ? (
                <Pressable onPress={() => setShowPriceTable((value) => !value)}>
                  <Text className="text-sm font-semibold text-brand-700">
                    {showPriceTable ? '카드로 보기' : '가격 비교표 보기'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {resultCount === 0 ? (
              <View className="items-center py-16">
                <Text className="text-center text-sm text-neutral-500">
                  조건에 맞는 {mode === 'doctor' ? '의사가' : '병원이'} 없어요
                </Text>
              </View>
            ) : mode === 'hospital' && showPriceTable ? (
              <PriceCompareTable hospitals={filteredHospitals} />
            ) : mode === 'doctor' ? (
              <CardGrid columns="wide">
                {filteredDoctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} hospital={hospitalById.get(doctor.hospitalId)} />
                ))}
              </CardGrid>
            ) : (
              <CardGrid columns="wide">
                {filteredHospitals.map((hospital) => (
                  <HospitalExploreCard
                    key={hospital.id}
                    hospital={hospital}
                    activeCategory={selectedCategory !== 'all' && selectedCategory !== 'recommended' ? selectedCategory : undefined}
                  />
                ))}
              </CardGrid>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
