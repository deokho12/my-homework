import type { ReactNode } from 'react';

import { View, cx, type RNStyle } from '@/primitives';

/**
 * 좌우 여백만 필요한 곳(가로 스크롤 줄, 화면 폭을 꽉 채우는 필터 바)에서 쓴다.
 * 본문과 왼쪽 끝이 맞아야 해서 같은 값을 공유한다.
 */
export const CONTAINER_PADDING = 'px-4 md:px-6 lg:px-8';

/**
 * 화면 성격에 따른 본문 최대폭.
 *
 * 전부 1200 으로 늘리면 안 되는 이유가 성격마다 다르다. 폼은 입력 칸이 화면 끝까지
 * 벌어지면 라벨과 값이 멀어져 읽기 나빠지고, 긴 글은 한 줄이 길수록 다음 줄 첫 글자를
 * 찾기 어려워진다. 목록·상세는 정보를 한 화면에 많이 보여주는 게 이득이라 끝까지 쓴다.
 */
export const CONTAINER_WIDTHS = {
  /** 목록·상세·대시보드 — 1200 */
  content: 'max-w-content',
  /** 긴 글 (약관, 팁, 커뮤니티 글) — 768 */
  prose: 'max-w-3xl',
  /** 입력 폼 — 576 */
  form: 'max-w-xl',
} as const;

export type ContainerWidth = keyof typeof CONTAINER_WIDTHS;

/**
 * ScrollView 를 쓰는 화면은 `<Container>` 를 한 겹 더 두는 대신 이 함수가 돌려주는
 * 클래스를 자기 `contentContainerClassName` 에 붙인다. 여백·최대폭 규칙이 두 벌로
 * 갈라지지 않게 하려는 것이다.
 */
export function containerClass(width: ContainerWidth = 'content', className?: string) {
  return cx('mx-auto w-full', CONTAINER_WIDTHS[width], CONTAINER_PADDING, className);
}

/** 기본 폭(1200)의 클래스. `containerClass('content')` 과 같다. */
export const CONTAINER_CLASS = containerClass();

interface ContainerProps {
  children?: ReactNode;
  width?: ContainerWidth;
  className?: string;
  style?: RNStyle;
}

/**
 * 본문 최대폭과 좌우 여백의 단일 기준.
 *
 * 이전에는 `maxWidth: 1200` 이 App.tsx 의 셸과 TopNavBar 에 각각 박혀 있었고, 화면마다
 * `px-5` 를 따로 붙였다. 둘이 어긋나면 상단바 로고와 본문 첫 줄이 세로로 안 맞는다.
 * 폭 관련 값을 바꿀 곳은 이제 여기 하나다.
 */
export function Container({ children, width = 'content', className, style }: ContainerProps) {
  return (
    <View className={containerClass(width, className)} style={style}>
      {children}
    </View>
  );
}
