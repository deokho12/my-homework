import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { DoctorCard } from '@/components/DoctorCard';
import { HospitalExploreCard } from '@/components/HospitalExploreCard';
import { HospitalMapView } from '@/components/HospitalMapView';
import { PriceCompareTable } from '@/components/PriceCompareTable';
import { doctors } from '@/data/doctors';
import { procedures } from '@/data/procedures';
import { useHospitalStore } from '@/store/useHospitalStore';
import type { Hospital, ProcedureId } from '@/types/domain';
import { isEligibleForRecommendedSponsoredPlacement, isEligibleForSponsoredPlacement } from '@/utils/sponsorship';

type Mode = 'doctor' | 'hospital';
type HospitalView = 'list' | 'map';
type Category = 'recommended' | 'all' | ProcedureId;
type SortKey = 'popular' | 'reviews' | 'consults';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: '인기순' },
  { key: 'reviews', label: '후기순' },
  { key: 'consults', label: '상담많은순' },
];

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ mode?: string; category?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'doctor' ? 'doctor' : 'hospital');
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    params.category === 'recommended' ? 'recommended' : (params.category as ProcedureId) || 'all'
  );
  const [hospitalView, setHospitalView] = useState<HospitalView>('list');
  const [sortBy, setSortBy] = useState<SortKey>('popular');
  const [onlyConsult, setOnlyConsult] = useState(false);
  const [onlyOneDay, setOnlyOneDay] = useState(false);
  const [showPriceTable, setShowPriceTable] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const allHospitals = useHospitalStore((state) => state.hospitals);
  const hospitalById = useMemo(() => new Map(allHospitals.map((h) => [h.id, h])), [allHospitals]);

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
  }, [allHospitals, selectedCategory, onlyConsult, onlyOneDay, sortBy]);

  const filteredDoctors = useMemo(() => {
    let list = doctors;
    if (selectedCategory === 'recommended') list = list.filter((doctor) => doctor.isRecommended);
    else if (selectedCategory !== 'all') list = list.filter((doctor) => doctor.procedureIds.includes(selectedCategory));
    if (onlyConsult) list = list.filter((doctor) => hospitalById.get(doctor.hospitalId)?.consultAvailable);
    if (onlyOneDay) list = list.filter((doctor) => hospitalById.get(doctor.hospitalId)?.isOneDay);

    return [...list].sort((a, b) => {
      if (sortBy === 'reviews') return b.reviewCount - a.reviewCount;
      if (sortBy === 'consults') return b.consultCount - a.consultCount;
      return b.rating - a.rating;
    });
  }, [hospitalById, selectedCategory, onlyConsult, onlyOneDay, sortBy]);

  const resultCount = mode === 'doctor' ? filteredDoctors.length : filteredHospitals.length;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <View className="border-b border-neutral-100 bg-white px-5 pb-3 pt-4">
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5">
            <Chip label="추천" selected={selectedCategory === 'recommended'} onPress={() => setSelectedCategory('recommended')} />
            <Chip label="전체" selected={selectedCategory === 'all'} onPress={() => setSelectedCategory('all')} />
            {procedures.map((procedure) => (
              <Chip
                key={procedure.id}
                label={procedure.name}
                selected={selectedCategory === procedure.id}
                onPress={() => setSelectedCategory(procedure.id)}
              />
            ))}
          </ScrollView>
        </View>

        <View className="border-b border-neutral-100 bg-white py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5">
            {SORT_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                selected={sortBy === option.key}
                onPress={() => setSortBy(option.key)}
              />
            ))}
            <Chip label="상담가능" selected={onlyConsult} onPress={() => setOnlyConsult((value) => !value)} />
            <Chip label="원데이" selected={onlyOneDay} onPress={() => setOnlyOneDay((value) => !value)} />
          </ScrollView>
        </View>

        {mode === 'hospital' && hospitalView === 'map' ? (
          <HospitalMapView hospitals={filteredHospitals} />
        ) : (
          <ScrollView contentContainerClassName="px-5 pb-8 pt-4" showsVerticalScrollIndicator={false}>
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
              <View className="flex-row flex-wrap justify-between">
                {filteredDoctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} style={{ width: isWide ? '48%' : '100%' }} />
                ))}
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {filteredHospitals.map((hospital) => (
                  <HospitalExploreCard
                    key={hospital.id}
                    hospital={hospital}
                    activeCategory={selectedCategory !== 'all' && selectedCategory !== 'recommended' ? selectedCategory : undefined}
                    style={{ width: isWide ? '48%' : '100%' }}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
