import type { LucideIcon } from 'lucide-react';

import { Text, View } from '@/primitives';

/**
 * 배지 색. **색만으로 뜻을 구분하지 않는다** — 칩에는 항상 한국어 라벨이 함께 있고,
 * 다섯 색 모두 글자 대비 4.5:1 이상이다.
 */
export type BadgeTone = 'neutral' | 'brand' | 'info' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /**
   * 라벨 왼쪽 lucide 아이콘 (`🌟 추천` → `<Badge icon={Star} label="추천" />`).
   * **장식이다** — 뜻은 항상 라벨이 전하므로 낭독기에서는 숨긴다. 없으면 글자만 그린다.
   */
  icon?: LucideIcon;
}

const TONE_CLASSES: Record<BadgeTone, { box: string; text: string; icon: string }> = {
  neutral: { box: 'bg-neutral-100 border-neutral-200', text: 'text-neutral-600', icon: '#525252' },
  brand: { box: 'bg-brand-50 border-brand-200', text: 'text-brand-700', icon: '#166863' },
  info: { box: 'bg-sky-50 border-sky-200', text: 'text-sky-700', icon: '#0369a1' },
  warning: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '#b45309' },
  // 상담 `취소` 처럼 "끝났고 이루어지지 않았다" 를 다른 종결 상태와 가를 때. 오류 표시가 아니다.
  danger: { box: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: '#be123c' },
};

export function Badge({ label, tone = 'neutral', icon: Icon }: BadgeProps) {
  const classes = TONE_CLASSES[tone];

  return (
    <View className={`flex-row items-center gap-1 rounded-full border px-2.5 py-1 ${classes.box}`}>
      {Icon ? <Icon size={14} color={classes.icon} aria-hidden /> : null}
      <Text className={`text-xs font-medium ${classes.text}`}>{label}</Text>
    </View>
  );
}
