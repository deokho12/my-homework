import { router, Stack, useLocalSearchParams } from '@/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { procedures } from '@/data/procedures';
import {
  SPONSORED_SEARCH_SUGGESTIONS,
  TRENDING_SEARCHES,
  type SearchTab,
  type SearchTarget,
  type SearchTrend,
  type TrendingSearchTerm,
} from '@/data/trendingSearches';
import { useDoctorStore } from '@/store/useDoctorStore';
import { useHospitalStore } from '@/store/useHospitalStore';

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'procedure', label: '시술' },
  { key: 'hospital', label: '병원' },
  { key: 'doctor', label: '의사' },
];

function navigateToTarget(target: SearchTarget) {
  if (target.kind === 'procedure') {
    router.push({ pathname: '/(tabs)/explore', params: { mode: 'hospital', category: target.procedureId } });
    return;
  }
  if (target.kind === 'hospital') {
    router.push(`/hospital/${target.hospitalId}`);
    return;
  }
  const doctor = useDoctorStore.getState().doctors.find((item) => item.id === target.doctorId);
  if (doctor) router.push(`/hospital/${doctor.hospitalId}`);
}

function TrendBadge({ trend }: { trend: SearchTrend }) {
  if (trend.type === 'up') {
    return <Text className="text-xs font-semibold text-rose-500">▲ {trend.delta}</Text>;
  }
  if (trend.type === 'down') {
    return <Text className="text-xs font-semibold text-blue-500">▼ {trend.delta}</Text>;
  }
  if (trend.type === 'new') {
    return <Text className="text-xs font-semibold text-blue-500">NEW</Text>;
  }
  return <Text className="text-xs text-neutral-300">－</Text>;
}

function SearchRow({ item }: { item: TrendingSearchTerm }) {
  return (
    <Pressable
      onPress={() => navigateToTarget(item.target)}
      className="flex-row items-center justify-between border-b border-neutral-50 py-3"
    >
      <View className="flex-row items-center gap-4">
        <Text className="w-5 text-base font-bold text-neutral-400">{item.rank}</Text>
        <Text className="text-[15px] font-medium text-neutral-800">{item.term}</Text>
      </View>
      <TrendBadge trend={item.trend} />
    </Pressable>
  );
}

function formatNowLabel(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm} 기준`;
}

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(q ?? '');
  const [tab, setTab] = useState<SearchTab>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const nowLabel = useMemo(() => formatNowLabel(), []);

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timeout);
  }, []);

  const runSearch = (trimmed: string) => {
    if (!trimmed) return;

    const matchedProcedure = procedures.find((procedure) => procedure.name.includes(trimmed));
    if (matchedProcedure) {
      setNotice(null);
      navigateToTarget({ kind: 'procedure', procedureId: matchedProcedure.id });
      return;
    }

    const matchedHospital = useHospitalStore.getState().hospitals.find((hospital) => hospital.name.includes(trimmed));
    if (matchedHospital) {
      setNotice(null);
      navigateToTarget({ kind: 'hospital', hospitalId: matchedHospital.id });
      return;
    }

    // Trending terms append a title suffix (e.g. "김민준 원장") that isn't part of the stored
    // doctor name ("김민준"), so also match when the search term starts with the doctor's name —
    // narrower than a general bidirectional includes() so it can't false-positive against
    // hospital names that happen to contain a procedure name (e.g. "더화이트 라미네이트클리닉").
    const matchedDoctor = useDoctorStore
      .getState()
      .doctors.find((doctor) => doctor.name.includes(trimmed) || trimmed.startsWith(doctor.name));
    if (matchedDoctor) {
      setNotice(null);
      navigateToTarget({ kind: 'doctor', doctorId: matchedDoctor.id });
      return;
    }

    setNotice(`"${trimmed}"에 대한 검색 결과가 없어요. 아래 인기 검색어를 살펴보세요`);
  };

  const handleSubmit = () => runSearch(query.trim());

  // Prefills and auto-runs the search when arriving from a trending-tag link (e.g. the home screen's
  // popular-search pills), which navigate here with a `q` param instead of typing into the input.
  useEffect(() => {
    if (q) runSearch(q.trim());
  }, [q]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center gap-2 px-5 pt-3">
        <Pressable onPress={() => router.back()} hitSlop={8} className="px-1 py-2">
          <Text className="text-2xl text-neutral-400">‹</Text>
        </Pressable>
        <View className="flex-1 flex-row items-center rounded-full border-[1.5px] border-brand-600 bg-white px-4 py-2.5">
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (notice) setNotice(null);
            }}
            onSubmitEditing={handleSubmit}
            placeholder="시술, 병원, 원장님 이름을 검색해보세요"
            placeholderTextColor="#a3a3a3"
            returnKeyType="search"
            className="flex-1 text-[15px] text-neutral-900"
          />
          <Pressable onPress={handleSubmit} hitSlop={8}>
            <Text className="text-lg">🔍</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5 pb-2 pt-4"
        >
          {SPONSORED_SEARCH_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => setQuery(suggestion)}
              className="flex-row items-center gap-1 rounded-full border border-neutral-200 px-3 py-2"
            >
              <Text className="text-xs text-brand-600">✦</Text>
              <Text className="text-[13px] text-neutral-700">{suggestion}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {notice ? (
          <View className="mx-5 mb-2 mt-2 rounded-xl bg-neutral-50 px-4 py-3">
            <Text className="text-sm text-neutral-500">{notice}</Text>
          </View>
        ) : null}

        <View className="mb-1 mt-4 flex-row items-center justify-between px-5">
          <Text className="text-lg font-extrabold text-neutral-900">인기 검색어</Text>
          <Text className="text-xs text-neutral-400">{nowLabel}</Text>
        </View>

        <View className="mb-2 flex-row border-b border-neutral-100 px-5">
          {TABS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              className={`mr-6 border-b-2 py-3 ${tab === item.key ? 'border-neutral-900' : 'border-transparent'}`}
            >
              <Text
                className={`text-sm font-semibold ${tab === item.key ? 'text-neutral-900' : 'text-neutral-400'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="px-5">
          {TRENDING_SEARCHES[tab].map((item) => (
            <SearchRow key={`${tab}-${item.rank}`} item={item} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
