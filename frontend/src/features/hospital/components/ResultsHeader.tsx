import type { ReactNode } from 'react';

import { Text, View } from '@/primitives';

interface ResultsHeaderProps {
  /** 지금 보고 있는 카테고리·세부 시술 이름. 따옴표는 이 컴포넌트가 붙인다. */
  label: string;
  modeLabel: '병원' | '의사';
  totalCount: number;
  action?: ReactNode;
}

/**
 * 목록 위의 "〇〇 병원 / 총 N곳" 헤더. 병원·의사 모드와 탐색·카테고리 화면이 공유한다.
 *
 * 단위(`곳`/`명`)는 `modeLabel` 에서 끌어낸다 — 호출부가 문자열을 따로 만들면 "병원 … 총 3명"
 * 같은 조합이 조용히 생긴다.
 */
export function ResultsHeader({ label, modeLabel, totalCount, action }: ResultsHeaderProps) {
  const unit = modeLabel === '병원' ? '곳' : '명';

  return (
    <>
      <Text className="mb-2 text-base font-bold text-neutral-900">
        &ldquo;{label}&rdquo; {modeLabel}
      </Text>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm text-neutral-500">{`총 ${totalCount}${unit}`}</Text>
        {action ?? null}
      </View>
    </>
  );
}
