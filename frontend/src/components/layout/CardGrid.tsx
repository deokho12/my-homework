import type { ReactNode } from 'react';

import { View, cx } from '@/primitives';

/**
 * 카드 목록의 열 수 규칙. 화면마다 브레이크포인트를 다시 고르지 않도록 두 가지로 고정했다.
 *
 * 클래스를 문자열 상수로 통째로 적어 두는 건 Tailwind 때문이다. JIT 은 소스에 그대로
 * 등장하는 클래스만 생성하므로 `grid-cols-${n}` 처럼 조립하면 CSS 가 안 나온다.
 */
const PRESETS = {
  /** 아이콘 + 한 줄 이름처럼 작은 카드 (시술 카테고리) */
  compact: 'grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
  /** 이미지·설명·태그가 들어가는 큰 카드 (병원, 전문의) */
  wide: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
} as const;

interface CardGridProps {
  children?: ReactNode;
  columns?: keyof typeof PRESETS;
  className?: string;
}

/**
 * 반응형 카드 그리드.
 *
 * 이전 홈 화면은 `useWindowDimensions` 로 폭을 읽어 열 수를 정하고 카드마다 퍼센트 width 와
 * `marginRight` 를 인라인으로 계산해 넣었다. 리사이즈할 때마다 구독 컴포넌트가 전부
 * 리렌더됐고, "마지막 줄을 왼쪽부터 채운다"를 나머지 연산으로 직접 맞춰야 했다.
 * CSS Grid 는 둘 다 기본 동작이라 계산이 통째로 사라진다.
 */
export function CardGrid({ children, columns = 'compact', className }: CardGridProps) {
  return <View className={cx('grid gap-3', PRESETS[columns], className)}>{children}</View>;
}
