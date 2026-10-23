import { Star } from 'lucide-react';

import { Badge } from '@/components/Badge';

interface RecommendedBadgeProps {
  /** 카드에서는 `추천`, 병원 상세 머리줄에서는 `추천 병원` 처럼 길게 쓴다. */
  label?: string;
}

/**
 * 에디터가 고른 추천 표시 — 병원 카드·탐색 카드·전문의 카드·병원 상세가 함께 쓴다.
 *
 * **아이콘(`Star`)과 색(brand)은 여기서만 정한다.** 네 곳이 각자 `<Badge icon={...} />` 를
 * 적어 두니 한 곳만 `Sparkles` 로 갈라졌던 적이 있다 (SYS-22 리뷰). 라벨만 자리에 맞게 받는다.
 */
export function RecommendedBadge({ label = '추천' }: RecommendedBadgeProps) {
  return <Badge icon={Star} label={label} tone="brand" />;
}
