import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { useScrollShadowStore } from '@/store/useScrollShadowStore';

const SCROLL_SHADOW_THRESHOLD = 8;

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWideDesktop = width >= 1024;
  const procedureCardWidth = width >= 1024 ? '15%' : width >= 768 ? '23%' : '31%';
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
        <View className="mb-8 rounded-2xl bg-white p-4">
          <SearchBar />
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
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {procedures.slice(0, 8).map((procedure) => (
              <ProcedureCategoryCard
                key={procedure.id}
                procedure={procedure}
                style={{ width: procedureCardWidth }}
              />
            ))}
          </View>
        </View>

        <View className="mb-8 rounded-2xl bg-white p-4">
          <SectionHeader title="이런 꿀팁 어때요?" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {guides.map((guide) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/explore',
                    params: { mode: 'hospital', category: guide.procedureId },
                  })
                }
              />
            ))}
          </ScrollView>
        </View>

        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
