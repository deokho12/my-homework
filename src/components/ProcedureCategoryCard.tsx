import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import type { Procedure } from '@/types/domain';

interface ProcedureCategoryCardProps {
  procedure: Procedure;
  onPress?: () => void;
}

export function ProcedureCategoryCard({ procedure, onPress }: ProcedureCategoryCardProps) {
  return (
    <Pressable
      onPress={
        onPress ??
        (() =>
          router.push({ pathname: '/(tabs)/explore', params: { mode: 'hospital', category: procedure.id } }))
      }
      className="w-[23%] items-center rounded-2xl border border-neutral-100 bg-white py-4 active:bg-neutral-50"
    >
      <Text className="mb-1.5 text-2xl">{procedure.emoji}</Text>
      <Text className="text-[13px] font-semibold text-neutral-800">{procedure.name}</Text>
    </Pressable>
  );
}
