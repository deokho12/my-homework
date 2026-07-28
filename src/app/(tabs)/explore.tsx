import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/Chip';
import { HospitalExploreCard } from '@/components/HospitalExploreCard';
import { PriceCompareTable } from '@/components/PriceCompareTable';
import { ProcedureCategoryCard } from '@/components/ProcedureCategoryCard';
import { procedures } from '@/data/procedures';
import { useHospitalStore } from '@/store/useHospitalStore';
import type { ProcedureId } from '@/types/domain';

type Mode = 'procedure' | 'hospital';
type SortKey = 'popular' | 'reviews' | 'consults';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: '인기순' },
  { key: 'reviews', label: '후기순' },
  { key: 'consults', label: '상담많은순' },
];

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ mode?: string; category?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'procedure' ? 'procedure' : 'hospital');
  const [selectedCategory, setSelectedCategory] = useState<ProcedureId | 'all'>(
    (params.category as ProcedureId) || 'all'
  );
  const [sortBy, setSortBy] = useState<SortKey>('popular');
  const [onlyConsult, setOnlyConsult] = useState(false);
  const [onlyOneDay, setOnlyOneDay] = useState(false);
  const [showPriceTable, setShowPriceTable] = useState(false);

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const allHospitals = useHospitalStore((state) => state.hospitals);

  const filteredHospitals = useMemo(() => {
    let list = allHospitals;
    if (selectedCategory !== 'all') {
      list = list.filter((hospital) => hospital.procedureIds.includes(selectedCategory));
    }
    if (onlyConsult) list = list.filter((hospital) => hospital.consultAvailable);
    if (onlyOneDay) list = list.filter((hospital) => hospital.isOneDay);

    return [...list].sort((a, b) => {
      if (sortBy === 'reviews') return b.reviewCount - a.reviewCount;
      if (sortBy === 'consults') return b.consultCount - a.consultCount;
      return b.rating - a.rating;
    });
  }, [allHospitals, selectedCategory, onlyConsult, onlyOneDay, sortBy]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <View className="border-b border-neutral-100 bg-white px-5 pb-3 pt-4">
        <Text className="mb-3 text-2xl font-extrabold text-neutral-900">병원 탐색</Text>
        <View className="flex-row rounded-full bg-neutral-100 p-1">
          <Pressable
            onPress={() => setMode('procedure')}
            className={`flex-1 items-center rounded-full py-2 ${mode === 'procedure' ? 'bg-white' : ''}`}
          >
            <Text className={`text-sm font-bold ${mode === 'procedure' ? 'text-brand-700' : 'text-neutral-500'}`}>
              시술
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
      </View>

      {mode === 'procedure' ? (
        <ScrollView contentContainerClassName="px-5 pb-8 pt-4" showsVerticalScrollIndicator={false}>
          <Text className="mb-3 text-sm text-neutral-500">
            관심 있는 시술을 선택하면 관련 병원을 바로 보여드려요
          </Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {procedures.map((procedure) => (
              <ProcedureCategoryCard
                key={procedure.id}
                procedure={procedure}
                onPress={() => {
                  setSelectedCategory(procedure.id);
                  setMode('hospital');
                }}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1">
          <View className="border-b border-neutral-100 bg-white py-3">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5">
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

          <ScrollView contentContainerClassName="px-5 pb-8 pt-4" showsVerticalScrollIndicator={false}>
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-sm text-neutral-500">총 {filteredHospitals.length}곳</Text>
              <Pressable onPress={() => setShowPriceTable((value) => !value)}>
                <Text className="text-sm font-semibold text-brand-700">
                  {showPriceTable ? '카드로 보기' : '가격 비교표 보기'}
                </Text>
              </Pressable>
            </View>

            {filteredHospitals.length === 0 ? (
              <View className="items-center py-16">
                <Text className="text-center text-sm text-neutral-500">조건에 맞는 병원이 없어요</Text>
              </View>
            ) : showPriceTable ? (
              <PriceCompareTable hospitals={filteredHospitals} />
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {filteredHospitals.map((hospital) => (
                  <HospitalExploreCard
                    key={hospital.id}
                    hospital={hospital}
                    style={{ width: isWide ? '48%' : '100%' }}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}
