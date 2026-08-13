import { router, Stack, useLocalSearchParams } from '@/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { queryClient } from '@/app/providers';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { fetchDoctorById, fetchDoctors } from '@/features/doctor';
import { useProcedures } from '@/features/procedure';
import { queryKeys } from '@/lib/queryKeys';
import {
  SPONSORED_SEARCH_SUGGESTIONS,
  TRENDING_SEARCHES,
  type SearchTab,
  type SearchTarget,
  type SearchTrend,
  type TrendingSearchTerm,
} from '@/mocks/fixtures/trendingSearches';
import { useHospitalStore } from '@/store/useHospitalStore';
import type { Doctor } from '@/types/domain';

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'procedure', label: '시술' },
  { key: 'hospital', label: '병원' },
  { key: 'doctor', label: '의사' },
];

/**
 * 이름으로 전문의를 찾는다. 서버의 `q` 필터(`nameNormalized.contains`, 부분일치)에 검색을
 * 맡긴다 — 클라이언트가 목록을 훑지 않으므로 로스터가 페이지 크기(기본 20)를 넘어도
 * 안전하다. `queryClient.fetchQuery` 를 쓰는 이유는 이 함수가 훅이 아니라 이벤트 핸들러에서
 * 부르는 일회성 조회라서다(`src/app/providers.tsx` 의 모듈 수준 `queryClient` 용도 그대로).
 *
 * Trending 문구는 직함을 붙여 온다(예: "김민준 원장") — `q` 는 부분일치라 검색어가 실제
 * 이름보다 길면(직함이 붙어서) 매칭되지 않는다. 그 경우 마지막 낱말을 떼고 한 번 더
 * 시도해 이름이 검색어로 시작하는지 확인한다.
 */
async function findMatchingDoctor(trimmed: string): Promise<Doctor | undefined> {
  // `staleTime: 0` 을 강제한다 — 이 조회는 캐시 재사용보다 "지금 서버가 뭐라고 하는지"가
  // 중요한 일회성 검색 액션이다. 기본 `staleTime`(`src/app/providers.tsx`, 30s)에 맡기면
  // 같은 검색어를 다시 치거나(다른 검색에서 우연히 같은 키를 썼을 때) 오래된 결과를
  // 그대로 돌려줄 수 있다.
  const direct = await queryClient.fetchQuery({
    queryKey: queryKeys.doctors.list({ q: trimmed }),
    queryFn: () => fetchDoctors({ q: trimmed }),
    staleTime: 0,
  });
  if (direct.items.length > 0) return direct.items[0];

  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return undefined;

  const namePart = trimmed.slice(0, lastSpace);
  const fallback = await queryClient.fetchQuery({
    queryKey: queryKeys.doctors.list({ q: namePart }),
    queryFn: () => fetchDoctors({ q: namePart }),
    staleTime: 0,
  });
  return fallback.items.find((doctor) => trimmed.startsWith(doctor.name));
}

async function navigateToTarget(target: SearchTarget) {
  if (target.kind === 'procedure') {
    router.push({ pathname: '/(tabs)/explore', params: { mode: 'hospital', category: target.procedureId } });
    return;
  }
  if (target.kind === 'hospital') {
    router.push(`/hospital/${target.hospitalId}`);
    return;
  }
  try {
    const doctor = await queryClient.fetchQuery({
      queryKey: queryKeys.doctors.detail(target.doctorId),
      queryFn: () => fetchDoctorById(target.doctorId),
      staleTime: 0,
    });
    router.push(`/hospital/${doctor.hospitalId}`);
  } catch {
    // 존재하지 않는 전문의면 조용히 무시한다 — 이전 로직(로컬 배열에서 못 찾으면 아무 일도
    // 하지 않는다)과 같은 동작이다.
  }
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

function SearchRow({ item, onSelect }: { item: TrendingSearchTerm; onSelect: (target: SearchTarget) => void }) {
  return (
    <Pressable
      onPress={() => onSelect(item.target)}
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
  // 시술 매칭이 이 조회에 의존한다. 로딩 중에 검색을 돌리면 `procedures` 가 아직 빈
  // 배열이라 실제로 있는 시술을 "결과 없음" 으로 잘못 단정하게 된다 — `proceduresPending`
  // 을 아래에서 게이트로 쓴다. 전문의 매칭은 `findMatchingDoctor` 가 제출 시점에 서버
  // `q` 필터로 직접 조회하므로 여기서 전체 목록을 미리 불러 둘 필요가 없다.
  const { data: procedures = [], isPending: proceduresPending } = useProcedures();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(q ?? '');
  const [tab, setTab] = useState<SearchTab>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const nowLabel = useMemo(() => formatNowLabel(), []);

  useEffect(() => {
    const timeout = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(timeout);
  }, []);

  // `procedures` 가 바뀔 때만 새로 만든다 — 아래 자동검색 effect 가 이 함수를 의존성으로
  // 쓸 수 있게(그리고 매 렌더마다 다시 실행되지 않게) 안정된 참조로 유지한다.
  const runSearch = useCallback(
    async (trimmed: string) => {
      if (!trimmed) return;

      const matchedProcedure = procedures.find((procedure) => procedure.name.includes(trimmed));
      if (matchedProcedure) {
        setNotice(null);
        await navigateToTarget({ kind: 'procedure', procedureId: matchedProcedure.id });
        return;
      }

      const matchedHospital = useHospitalStore
        .getState()
        .hospitals.find((hospital) => hospital.name.includes(trimmed));
      if (matchedHospital) {
        setNotice(null);
        await navigateToTarget({ kind: 'hospital', hospitalId: matchedHospital.id });
        return;
      }

      const matchedDoctor = await findMatchingDoctor(trimmed);
      if (matchedDoctor) {
        setNotice(null);
        router.push(`/hospital/${matchedDoctor.hospitalId}`);
        return;
      }

      setNotice(`"${trimmed}"에 대한 검색 결과가 없어요. 아래 인기 검색어를 살펴보세요`);
    },
    [procedures]
  );

  const handleSubmit = () => {
    void runSearch(query.trim());
  };

  // Prefills and auto-runs the search when arriving from a trending-tag link (e.g. the home screen's
  // popular-search pills), which navigate here with a `q` param instead of typing into the input.
  // 시술 목록이 아직 로딩 중이면 실행을 미룬다(빈 배열을 근거로 "결과 없음" 을 단정하지
  // 않기 위해) — 로딩이 끝나 `runSearch` 가 최신 `procedures` 를 담은 새 참조로 바뀌면
  // 이 effect 가 다시 돌아 그때 한 번 검색한다.
  useEffect(() => {
    if (!q || proceduresPending) return;
    void runSearch(q.trim());
  }, [q, proceduresPending, runSearch]);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className={cx(CONTAINER_PADDING, 'flex-row items-center gap-2 pt-3')}>
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
          contentContainerClassName={cx(CONTAINER_PADDING, 'gap-2 pb-2 pt-4')}
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

        <View className={cx(CONTAINER_PADDING, 'mb-1 mt-4 flex-row items-center justify-between')}>
          <Text className="text-lg font-extrabold text-neutral-900">인기 검색어</Text>
          <Text className="text-xs text-neutral-400">{nowLabel}</Text>
        </View>

        <View className={cx(CONTAINER_PADDING, 'mb-2 flex-row border-b border-neutral-100')}>
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

        <View className={CONTAINER_PADDING}>
          {TRENDING_SEARCHES[tab].map((item) => (
            <SearchRow
              key={`${tab}-${item.rank}`}
              item={item}
              onSelect={(target) => {
                void navigateToTarget(target);
              }}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
