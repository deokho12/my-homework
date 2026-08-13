import { router, useFocusEffect } from '@/navigation';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { Pressable, ScrollView, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { CardGrid } from '@/components/layout/CardGrid';
import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { HeroBanner } from '@/components/HeroBanner';
import { ProcedureCategoryCard } from '@/components/ProcedureCategoryCard';
import { PromotionCard } from '@/components/PromotionCard';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { CONTAINER_CLASS } from '@/components/layout/Container';
import { useProcedures } from '@/features/procedure';
import { guides } from '@/mocks/fixtures/guides';
import { promotions } from '@/mocks/fixtures/promotions';
import { TRENDING_SEARCHES } from '@/mocks/fixtures/trendingSearches';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';

const SCROLL_SHADOW_THRESHOLD = 8;

// Top row of trending search terms shown as pill badges under the home search bar.
// Tapping a pill routes to `/search?q=...`, which prefills and auto-runs the search.
const HOME_TRENDING_TAGS = TRENDING_SEARCHES.all.slice(0, 6).map((item) => item.term);

export default function HomeScreen() {
  const { data: procedures = [] } = useProcedures();
  const setScrolled = useScrollShadowStore((state) => state.setScrolled);
  const scrollOffsetRef = useRef(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = offsetY;
    setScrolled(offsetY > SCROLL_SHADOW_THRESHOLD);
  };

  useFocusEffect(
    useCallback(() => {
      setScrolled(scrollOffsetRef.current > SCROLL_SHADOW_THRESHOLD);
    }, [setScrolled])
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <ScrollView
        contentContainerClassName={cx(CONTAINER_CLASS, 'pb-8 pt-4')}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View className="mb-6 pt-1">
          <SearchBar />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerClassName="gap-2 pr-2"
          >
            {HOME_TRENDING_TAGS.map((term) => (
              <Pressable
                key={term}
                onPress={() => router.push({ pathname: '/search', params: { q: term } })}
                className="rounded-full bg-neutral-100 px-3.5 py-1.5"
                hitSlop={4}
              >
                <Text className="text-xs font-medium text-neutral-600" numberOfLines={1}>
                  {term}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <HeroBanner />

        {promotions.length > 0 ? (
          <View className="mb-8 rounded-2xl bg-white p-4">
            <SectionHeader title="지금 진행중인 이벤트" actionLabel="전체보기" onPressAction={() => router.push('/events')} />
            {/*
              좁은 화면은 가로 스크롤, lg 부터는 줄바꿈. 예전에는 두 갈래를 각각 렌더했지만
              구조가 같아서 CSS 로 합쳤다. `overflow-visible` 이 필요한 이유는
              `.rnw-scroll-horizontal` 이 overflow-y 를 hidden 으로 두기 때문이다 —
              줄바꿈으로 세로가 길어지면 두 번째 줄부터 잘린다.
            */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="lg:overflow-visible"
              contentContainerClassName="gap-3 lg:flex-wrap"
            >
              {promotions.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View className="mb-8 rounded-2xl bg-white p-4">
          <SectionHeader
            title="시술로 찾기"
            actionLabel="전체보기"
            onPressAction={() => router.push('/(tabs)/explore')}
          />
          <CardGrid columns="compact">
            {procedures.map((procedure) => (
              <ProcedureCategoryCard key={procedure.id} procedure={procedure} />
            ))}
          </CardGrid>
        </View>

        <View className="mb-8 rounded-2xl bg-white p-4">
          <SectionHeader title="이런 꿀팁 어때요?" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {guides.map((guide) => (
              <GuideCard key={guide.id} guide={guide} onPress={() => router.push(`/tips/${guide.id}`)} />
            ))}
          </ScrollView>
        </View>

        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
