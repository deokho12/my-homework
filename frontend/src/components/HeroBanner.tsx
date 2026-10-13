import { useRef, useState } from 'react';
import { ScrollView, Text, View, cx } from '@/primitives';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';

import { StockImage } from '@/components/StockImage';
import { CLINIC_INTERIOR_1, DOCTOR_FEMALE_2, PROCEDURE_IN_PROGRESS, sized } from '@/config/stockImages';
import { router } from '@/navigation';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  /** 누르면 가는 곳. 진짜 `<a href>` 라 Ctrl+클릭·가운데 클릭·낭독기 링크 목록이 그대로 동작한다. */
  href: string;
  /** 링크의 목적을 이름에 덧붙인다 (WCAG 2.4.4) — 보이는 글자는 그대로 둔다. */
  linkLabel: string;
  bgClassName: string;
  imageUrl: string;
  alt: string;
}

const SLIDES: HeroSlide[] = [
  {
    id: 'find-by-procedure',
    title: '병원명 말고, 시술로 찾아보세요',
    subtitle: '임플란트, 교정, 라미네이트까지 한눈에 비교하고 상담까지 한번에',
    href: '/explore',
    linkLabel: '병원명 말고, 시술로 찾아보세요 — 병원 탐색으로 이동',
    bgClassName: 'bg-brand-600/60',
    imageUrl: sized(CLINIC_INTERIOR_1, 800),
    alt: '밝고 신뢰감 있는 치과 진료실 사진',
  },
  {
    id: 'verified-hospitals',
    title: '전문의가 검증된 병원만 모았어요',
    subtitle: '깐깐한 검증을 거친 병원과 의료진 정보만 믿고 확인하세요',
    // `?specialist=1` 은 탐색 화면의 `전문의` 조건 칩을 켜고 연다 (`useExploreFilters`).
    href: '/explore?specialist=1',
    linkLabel: '전문의가 검증된 병원만 모았어요 — 전문의가 있는 병원 목록으로 이동',
    bgClassName: 'bg-brand-700/60',
    imageUrl: sized(DOCTOR_FEMALE_2, 800),
    alt: '흰 가운을 입은 전문 의료진 사진',
  },
  {
    id: 'community',
    title: '궁금한 건 커뮤니티에 물어보세요',
    subtitle: '먼저 경험한 사람들의 솔직한 후기와 답변을 지금 확인해보세요',
    href: '/community',
    linkLabel: '궁금한 건 커뮤니티에 물어보세요 — 커뮤니티로 이동',
    bgClassName: 'bg-brand-500/60',
    imageUrl: sized(PROCEDURE_IN_PROGRESS, 800),
    alt: '치과의사가 스캐너로 진료하는 모습',
  },
];

/**
 * 스와이프와 누르기를 가르는 임계값(px). 브라우저가 탭/드래그를 가르는 통상 값이고,
 * 손가락이 1–2px 떨린 "누르기" 는 그대로 살아남는다.
 */
const DRAG_THRESHOLD_PX = 8;

const SLIDE_CLASS =
  'rnw-view shrink-0 justify-center overflow-hidden px-5 py-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white';

function SlideBody({ slide }: { slide: HeroSlide }) {
  return (
    <>
      <StockImage
        uri={slide.imageUrl}
        alt={slide.alt}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View className={`absolute inset-0 ${slide.bgClassName}`} />
      <Text className="mb-1 text-lg font-bold text-white">{slide.title}</Text>
      <Text className="text-sm text-brand-50">{slide.subtitle}</Text>
    </>
  );
}

export function HeroBanner() {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  /** 마지막 `pointerdown` 좌표. 드래그로 넘긴 뒤 손을 떼는 클릭을 이동으로 세지 않으려고 쓴다. */
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

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

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // 새 탭·새 창으로 열려는 클릭(Ctrl/⌘·Shift·Alt)은 **건드리지 않는다** — `preventDefault`
    // 를 부르면 브라우저가 새 탭을 열지 못하고 같은 탭에서 이동해 버린다. 진짜 `<a href>` 를
    // 쓴 이유의 절반이 여기 있다. (가운데 클릭은 `auxclick` 이라 애초에 이 핸들러에 오지 않는다.)
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    // 그 밖은 SPA 이동이라 기본 동작을 막는다.
    event.preventDefault();

    const start = pointerStart.current;
    pointerStart.current = null;
    if (start) {
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      // 끌어서 넘긴 다음 손을 뗀 것이다 — 넘기기만 하고 이동하지 않는다.
      if (moved > DRAG_THRESHOLD_PX) return;
    }

    router.push(href);
  };

  return (
    <View
      role="group"
      accessibilityLabel="추천 배너"
      className="relative mb-8 overflow-hidden rounded-[24px]"
      onLayout={handleLayout}
    >
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
            <a
              key={slide.id}
              href={slide.href}
              aria-label={slide.linkLabel}
              draggable={false}
              className={SLIDE_CLASS}
              style={{ width: containerWidth }}
              onPointerDown={(event) => {
                pointerStart.current = { x: event.clientX, y: event.clientY };
              }}
              onClick={(event) => handleClick(event, slide.href)}
            >
              <SlideBody slide={slide} />
            </a>
          ))}
        </ScrollView>
      ) : (
        // 폭을 재기 전 한 장. 같은 링크여야 측정 전 클릭도 동작한다.
        <a
          href={SLIDES[0].href}
          aria-label={SLIDES[0].linkLabel}
          draggable={false}
          className={cx(SLIDE_CLASS, 'w-full')}
          onClick={(event) => handleClick(event, SLIDES[0].href)}
        >
          <SlideBody slide={SLIDES[0]} />
        </a>
      )}

      {/*
        클릭을 통과시킨다 — 그러지 않으면 이 표시가 우하단 모서리의 클릭을 가로채
        "오른쪽 아래만 안 눌리는 배너" 가 된다. 낭독기에는 숨긴다: 링크 3개를 차례로
        읽으면 순서를 이미 안다.
      */}
      <div
        aria-hidden
        className="rnw-view pointer-events-none absolute bottom-3 right-4 rounded-full bg-black/30 px-2.5 py-1"
      >
        <span className="text-xs font-semibold text-white">
          {activeIndex + 1}/{SLIDES.length}
        </span>
      </div>
    </View>
  );
}
