import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Pressable, SafeAreaView, ScrollView, Text, View, cx } from '@/primitives';
import { router, useLocalSearchParams } from '@/navigation';

import { Chip } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { CardGrid } from '@/components/layout/CardGrid';
import { CONTAINER_CLASS, CONTAINER_PADDING } from '@/components/layout/Container';
import { QueryState } from '@/components/QueryState';
import { HospitalExploreCard } from '@/features/hospital/components/HospitalExploreCard';
import { ResultsHeader } from '@/features/hospital/components/ResultsHeader';
import { useHospitalsByCategory } from '@/features/hospital/hooks/useHospitalsByCategory';
import {
  SORT_OPTIONS,
  SORT_TO_SERVER,
  type ExploreSortKey,
} from '@/features/hospital/hooks/useExploreFilters';
import { SubProcedureChips } from '@/features/procedure/components/SubProcedureChips';
import { effectiveSubProcedure } from '@/features/procedure/lib/resolveCategoryFilter';
import { useUserLocation } from '@/hooks/useUserLocation';
import {
  getCategory,
  getSubProcedure,
  isCategoryId,
  isSubProcedureId,
  type CategoryId,
  type SubProcedureId,
} from '@/features/procedure/taxonomy';
import { CATEGORY_ICONS } from '@/utils/procedureIcons';

/** brand-600. `tailwind.config.js` 의 값과 같다 — lucide 아이콘은 클래스가 아니라 색을 받는다. */
const BRAND_COLOR = '#17847a';

/**
 * 시술 대분류 한 칸의 병원 목록 (`/category/:categoryId?sub=`).
 *
 * 탐색 화면과 달리 **병원 모드만** 있다 (지도·가격비교표·의사 모드 없음). 홈과 검색이
 * 보내는 "이 시술 하는 병원 보여줘" 한 가지 의도만 처리하는 화면이라, 탐색의 모드 전환을
 * 그대로 복제하면 같은 기능이 두 화면에 생긴다.
 *
 * 헤더를 화면이 직접 그린다 — `title: ''` + `Stack.Screen` 패턴은 뒤로 가기 버튼이 둘로
 * 보이는 결함이 `docs/features/known-issues.md` 에 이미 기록돼 있다.
 */
export default function CategoryPage() {
  const { categoryId, sub } = useLocalSearchParams<{ categoryId: string; sub?: string }>();

  if (!isCategoryId(categoryId)) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
        <EmptyState
          title="없는 카테고리예요"
          description="주소가 바뀌었거나 아직 준비되지 않은 시술일 수 있어요"
          actionLabel="병원 탐색으로"
          onAction={() => router.replace('/explore')}
        />
      </SafeAreaView>
    );
  }

  // categoryId 가 바뀌면 정렬·필터 상태를 들고 가지 않는다 — key 로 통째로 다시 마운트한다.
  return <CategoryView key={categoryId} categoryId={categoryId} sub={sub} />;
}

function CategoryView({ categoryId, sub }: { categoryId: CategoryId; sub?: string }) {
  const [, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<ExploreSortKey>('popular');
  const [onlyConsult, setOnlyConsult] = useState(false);
  const [onlyOneDay, setOnlyOneDay] = useState(false);

  const category = getCategory(categoryId);
  const Icon = CATEGORY_ICONS[categoryId];
  // 카드가 거리를 보여주므로 화면에 들어올 때 위치를 묻는다(탐색 화면과 같은 시점).
  // 거부·실패면 `point` 가 `null` 이고 카드는 지역명만 보여준다.
  const userLocation = useUserLocation();

  // 다른 대분류의 세부 시술이 `?sub=` 로 들어오면 무시한다 (`/category/implant?sub=crown`).
  const requestedSub =
    isSubProcedureId(sub) && getSubProcedure(sub).categoryId === categoryId ? sub : null;
  // 준비중 세부는 서버에 물어볼 수 없다 — 칩은 고른 모양으로 두되 목록은 대분류 전체를 준다.
  // 되돌림 규칙은 검색 추천의 병원·원장님 그룹과 **같은 함수**를 쓴다(추천 줄에 보인 병원과
  // 눌러서 열린 이 화면의 병원이 같아야 한다).
  const effectiveSub = effectiveSubProcedure(requestedSub);

  const baseFilters = {
    sort: SORT_TO_SERVER[sortBy],
    consultAvailable: onlyConsult || undefined,
    oneDay: onlyOneDay || undefined,
  };

  const { data, isLoading, isError, isFetching, refetch, plan } = useHospitalsByCategory(
    { kind: 'category', categoryId, subProcedureId: effectiveSub },
    baseFilters
  );

  /** 세부 칩 선택은 URL 에 쓴다 — 공유·새로고침·뒤로 가기가 같은 목록을 되살린다. */
  const selectSub = (id: SubProcedureId | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('sub', id);
        else next.delete('sub');
        return next;
      },
      { replace: true }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <View className={cx(CONTAINER_PADDING, 'border-b border-neutral-100 bg-white pb-3 pt-4')}>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="뒤로 가기"
            className="h-10 w-10 items-center justify-center rounded-full bg-neutral-100"
          >
            <ChevronLeft size={22} color="#171717" />
          </Pressable>
          <Icon size={24} color={BRAND_COLOR} />
          <Text className="text-2xl font-extrabold text-neutral-900">{category.name}</Text>
        </View>
        <Text className="mt-1 text-sm text-neutral-500">{category.description}</Text>
      </View>

      <View className="border-b border-neutral-100 bg-white py-3">
        {/*
          `requestedSub` 가 아니라 `effectiveSub` 를 넘긴다 — 칩 줄은 "지금 보고 있는 목록"을
          가리키는 컨트롤이다. 준비중 세부를 가리키면 비활성 칩이 눌린 상태(`aria-disabled` 와
          `aria-pressed` 가 동시에 참)가 되고, 목록은 전체인데 "전체" 칩은 꺼져 있게 된다.
          사용자가 무엇을 요청했는지는 바로 아래 안내 문구가 이름으로 말한다.
        */}
        <SubProcedureChips categoryId={categoryId} selected={effectiveSub} onSelect={selectSub} />
        {requestedSub && !effectiveSub ? (
          <Text className={cx(CONTAINER_PADDING, 'text-sm text-neutral-500')}>
            {plan.mode === 'empty'
              ? `${getSubProcedure(requestedSub).name}은(는) 준비중이에요`
              : `${getSubProcedure(requestedSub).name}은(는) 준비중이에요 — ${category.name} 전체를 보여드려요`}
          </Text>
        ) : null}
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
        </ScrollView>
      </View>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        isEmpty={(page) => page.items.length === 0}
        emptyState={{
          // 0건의 이유가 둘이다: 서버에 물어볼 시술이 아예 없거나(준비중), 물었는데 없거나.
          // 전자에 "조건에 맞는 병원이 없어요" 라고 하면 필터를 풀면 나올 것처럼 보인다.
          title: plan.mode === 'empty' ? '등록된 병원이 아직 없어요' : '조건에 맞는 병원이 없어요',
          description: plan.mode === 'empty' ? '이 시술은 준비중이에요' : undefined,
        }}
      >
        {(page) => (
          <ScrollView contentContainerClassName={cx(CONTAINER_CLASS, 'pb-8 pt-4')} showsVerticalScrollIndicator={false}>
            <ResultsHeader
              label={effectiveSub ? getSubProcedure(effectiveSub).name : category.name}
              modeLabel="병원"
              totalCount={page.meta.totalItems}
            />
            <CardGrid columns="wide">
              {page.items.map((hospital) => (
                <HospitalExploreCard
                  key={hospital.id}
                  hospital={hospital}
                  activeCategory={categoryId}
                  userPoint={userLocation.point}
                />
              ))}
            </CardGrid>
          </ScrollView>
        )}
      </QueryState>
    </SafeAreaView>
  );
}
