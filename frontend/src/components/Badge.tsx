import { Text, View } from '@/primitives';

/**
 * 배지 색. **색만으로 뜻을 구분하지 않는다** — 칩에는 항상 한국어 라벨이 함께 있고,
 * 네 색 모두 글자 대비 4.5:1 이상이다.
 */
export type BadgeTone = 'neutral' | 'brand' | 'info' | 'warning';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, { box: string; text: string }> = {
  neutral: { box: 'bg-neutral-100 border-neutral-200', text: 'text-neutral-600' },
  brand: { box: 'bg-brand-50 border-brand-200', text: 'text-brand-700' },
  info: { box: 'bg-sky-50 border-sky-200', text: 'text-sky-700' },
  warning: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const classes = TONE_CLASSES[tone];

  return (
    <View className={`rounded-full border px-2.5 py-1 ${classes.box}`}>
      <Text className={`text-xs font-medium ${classes.text}`}>{label}</Text>
    </View>
  );
}
