import { useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  bgClassName: string;
}

const SLIDES: HeroSlide[] = [
  {
    id: 'find-by-procedure',
    title: '병원명 말고, 시술로 찾아보세요',
    subtitle: '임플란트, 교정, 라미네이트까지 한눈에 비교하고 상담까지 한번에',
    bgClassName: 'bg-brand-600',
  },
  {
    id: 'verified-hospitals',
    title: '전문의가 검증된 병원만 모았어요',
    subtitle: '깐깐한 검증을 거친 병원과 의료진 정보만 믿고 확인하세요',
    bgClassName: 'bg-brand-700',
  },
  {
    id: 'community',
    title: '궁금한 건 커뮤니티에 물어보세요',
    subtitle: '먼저 경험한 사람들의 솔직한 후기와 답변을 지금 확인해보세요',
    bgClassName: 'bg-brand-500',
  },
];

export function HeroBanner() {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / containerWidth);
    const clampedIndex = Math.min(Math.max(index, 0), SLIDES.length - 1);
    if (clampedIndex !== activeIndex) {
      setActiveIndex(clampedIndex);
    }
  };

  return (
    <View className="relative mb-8 overflow-hidden rounded-[24px]" onLayout={handleLayout}>
      {containerWidth > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((slide) => (
            <View
              key={slide.id}
              className={`justify-center px-5 py-7 ${slide.bgClassName}`}
              style={{ width: containerWidth }}
            >
              <Text className="mb-1 text-lg font-bold text-white">{slide.title}</Text>
              <Text className="text-sm text-brand-50">{slide.subtitle}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className={`justify-center px-5 py-7 ${SLIDES[0].bgClassName}`}>
          <Text className="mb-1 text-lg font-bold text-white">{SLIDES[0].title}</Text>
          <Text className="text-sm text-brand-50">{SLIDES[0].subtitle}</Text>
        </View>
      )}

      <View className="absolute bottom-3 right-4 rounded-full bg-black/30 px-2.5 py-1">
        <Text className="text-xs font-semibold text-white">
          {activeIndex + 1}/{SLIDES.length}
        </Text>
      </View>
    </View>
  );
}
