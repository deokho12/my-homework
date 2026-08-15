import { useState } from 'react';
import { ScrollView, Text, View } from '@/primitives';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';

import { StockImage } from '@/components/StockImage';
import { CLINIC_INTERIOR_1, DOCTOR_FEMALE_2, PROCEDURE_IN_PROGRESS, sized } from '@/config/stockImages';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  bgClassName: string;
  imageUrl: string;
  alt: string;
}

const SLIDES: HeroSlide[] = [
  {
    id: 'find-by-procedure',
    title: '병원명 말고, 시술로 찾아보세요',
    subtitle: '임플란트, 교정, 라미네이트까지 한눈에 비교하고 상담까지 한번에',
    bgClassName: 'bg-brand-600/60',
    imageUrl: sized(CLINIC_INTERIOR_1, 800),
    alt: '밝고 신뢰감 있는 치과 진료실 사진',
  },
  {
    id: 'verified-hospitals',
    title: '전문의가 검증된 병원만 모았어요',
    subtitle: '깐깐한 검증을 거친 병원과 의료진 정보만 믿고 확인하세요',
    bgClassName: 'bg-brand-700/60',
    imageUrl: sized(DOCTOR_FEMALE_2, 800),
    alt: '흰 가운을 입은 전문 의료진 사진',
  },
  {
    id: 'community',
    title: '궁금한 건 커뮤니티에 물어보세요',
    subtitle: '먼저 경험한 사람들의 솔직한 후기와 답변을 지금 확인해보세요',
    bgClassName: 'bg-brand-500/60',
    imageUrl: sized(PROCEDURE_IN_PROGRESS, 800),
    alt: '치과의사가 스캐너로 진료하는 모습',
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
            <View key={slide.id} className="justify-center overflow-hidden px-5 py-7" style={{ width: containerWidth }}>
              <StockImage
                uri={slide.imageUrl}
                alt={slide.alt}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View className={`absolute inset-0 ${slide.bgClassName}`} />
              <Text className="mb-1 text-lg font-bold text-white">{slide.title}</Text>
              <Text className="text-sm text-brand-50">{slide.subtitle}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="justify-center overflow-hidden px-5 py-7">
          <StockImage
            uri={SLIDES[0].imageUrl}
            alt={SLIDES[0].alt}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View className={`absolute inset-0 ${SLIDES[0].bgClassName}`} />
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
