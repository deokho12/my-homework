import type { ReactNode } from 'react';

import { View, cx, type RNStyle } from '@/primitives';

/**
 * 좌우 여백만 필요한 곳(가로 스크롤 줄, 화면 폭을 꽉 채우는 필터 바)에서 쓴다.
 * 본문과 왼쪽 끝이 맞아야 해서 같은 값을 공유한다.
 */
export const CONTAINER_PADDING = 'px-4 md:px-6 lg:px-8';

/**
 * ScrollView 를 쓰는 화면은 `<Container>` 를 한 겹 더 두는 대신 이 클래스를 자기
 * `contentContainerClassName` 에 붙인다. 여백 규칙이 두 벌로 갈라지지 않게 하려는 것이다.
 */
export const CONTAINER_CLASS = `mx-auto w-full max-w-content ${CONTAINER_PADDING}`;

interface ContainerProps {
  children?: ReactNode;
  className?: string;
  style?: RNStyle;
}

/**
 * 본문 최대폭과 좌우 여백의 단일 기준.
 *
 * 이전에는 `maxWidth: 1200` 이 App.tsx 의 셸과 TopNavBar 에 각각 박혀 있었고, 화면마다
 * `px-5` 를 따로 붙였다. 둘이 어긋나면 상단바 로고와 본문 첫 줄이 세로로 안 맞는다.
 * 폭 관련 값을 바꿀 곳은 이제 여기 하나다.
 *
 * `max-w-content` 는 tailwind.config.js 의 `maxWidth.content` (1200px) 다.
 */
export function Container({ children, className, style }: ContainerProps) {
  return (
    <View className={cx(CONTAINER_CLASS, className)} style={style}>
      {children}
    </View>
  );
}
