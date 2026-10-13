import { Text, View } from '@/primitives';

/**
 * 배지 색. **색만으로 뜻을 구분하지 않는다** — 칩에는 항상 한국어 라벨이 함께 있고,
 * 다섯 색 모두 글자 대비 4.5:1 이상이다.
 */
export type BadgeTone = 'neutral' | 'brand' | 'info' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, { box: string; text: string }> = {
  neutral: { box: 'bg-neutral-100 border-neutral-200', text: 'text-neutral-600' },
  brand: { box: 'bg-brand-50 border-brand-200', text: 'text-brand-700' },
  info: { box: 'bg-sky-50 border-sky-200', text: 'text-sky-700' },
  warning: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  // 상담 `취소` 처럼 "끝났고 이루어지지 않았다" 를 다른 종결 상태와 가를 때. 오류 표시가 아니다.
  danger: { box: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const classes = TONE_CLASSES[tone];

  return (
    <View className={`rounded-full border px-2.5 py-1 ${classes.box}`}>
      <Text className={`text-xs font-medium ${classes.text}`}>{label}</Text>
    </View>
  );
}
