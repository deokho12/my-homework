import { Pressable, Text, View } from '@/primitives';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onPressAction }: SectionHeaderProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <Text className="text-lg font-bold text-neutral-900">{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onPressAction} hitSlop={8}>
          <Text className="text-sm font-medium text-neutral-500">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
