import { Text, View } from 'react-native';

interface BadgeProps {
  label: string;
  tone?: 'neutral' | 'brand';
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const toneClasses =
    tone === 'brand' ? 'bg-brand-50 border-brand-200' : 'bg-neutral-100 border-neutral-200';
  const textClasses = tone === 'brand' ? 'text-brand-700' : 'text-neutral-600';

  return (
    <View className={`rounded-full border px-2.5 py-1 ${toneClasses}`}>
      <Text className={`text-xs font-medium ${textClasses}`}>{label}</Text>
    </View>
  );
}
