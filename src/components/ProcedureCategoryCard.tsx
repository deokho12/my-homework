import { router } from 'expo-router';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';

import type { Procedure } from '@/types/domain';

interface ProcedureCategoryCardProps {
  procedure: Procedure;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ProcedureCategoryCard({ procedure, onPress, style }: ProcedureCategoryCardProps) {
  return (
    <Pressable
      onPress={
        onPress ??
        (() =>
          router.push({ pathname: '/(tabs)/explore', params: { mode: 'hospital', category: procedure.id } }))
      }
      style={style}
      className="items-center rounded-2xl border border-neutral-100 bg-white py-4 active:bg-neutral-50"
    >
      <Text className="mb-1.5 text-2xl">{procedure.emoji}</Text>
      <Text className="text-[13px] font-semibold text-neutral-800">{procedure.name}</Text>
    </Pressable>
  );
}
