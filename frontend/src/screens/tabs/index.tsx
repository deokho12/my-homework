import { router, useFocusEffect } from '@/navigation';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Footer } from '@/components/Footer';
import { GuideCard } from '@/components/GuideCard';
import { HeroBanner } from '@/components/HeroBanner';
import { ProcedureCategoryCard } from '@/components/ProcedureCategoryCard';
import { PromotionCard } from '@/components/PromotionCard';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { guides } from '@/data/guides';
import { procedures } from '@/data/procedures';
import { promotions } from '@/data/promotions';
import { TRENDING_SEARCHES } from '@/data/trendingSearches';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';

const SCROLL_SHADOW_THRESHOLD = 8;

// Top row of trending search terms shown as pill badges under the home search bar.
// Tapping a pill routes to `/search?q=...`, which prefills and auto-runs the search.
const HOME_TRENDING_TAGS = TRENDING_SEARCHES.all.slice(0, 6).map((item) => item.term);

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWideDesktop = width >= 1024;
  // Percentage-based grid math (not CSS `gap` + percentage widths, which overflows) so each row holds
  // exactly `columns` cards and the last row — however many items it has left — packs from the left
  // instead of stretching via `justify-between`.
  const columns = width >= 1024 ? 6 : width >= 768 ? 4 : width >= 480 ? 3 : 2;
  const GAP_PERCENT = 2;
  const cardWidthPercent = (100 - (columns - 1) * GAP_PERCENT) / columns;
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
        contentContainerClassName="px-5 pb-8 pt-4"
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
            {isWideDesktop ? (
              <View className="flex-row flex-wrap gap-y-3">
                {promotions.map((promotion) => (
                  <PromotionCard key={promotion.id} promotion={promotion} />
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {promotions.map((promotion) => (
                  <PromotionCard key={promotion.id} promotion={promotion} />
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View className="mb-8 rounded-2xl bg-white p-4">
          <SectionHeader
            title="시술로 찾기"
            actionLabel="전체보기"
            onPressAction={() => router.push('/(tabs)/explore')}
          />
          <View className="flex-row flex-wrap justify-start">
            {procedures.map((procedure, index) => (
              <ProcedureCategoryCard
                key={procedure.id}
                procedure={procedure}
                style={{
                  width: `${cardWidthPercent}%`,
                  marginRight: (index + 1) % columns === 0 ? 0 : `${GAP_PERCENT}%`,
                  marginBottom: 12,
                }}
              />
            ))}
          </View>
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
