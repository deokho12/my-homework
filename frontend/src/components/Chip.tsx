import type { ComponentType } from 'react';
import { Pressable, Text, View } from '@/primitives';

/** Matches the shape of a lucide-react-native icon component (e.g. `Sparkles`, `Syringe`). */
type IconComponent = ComponentType<{ size?: number; color?: string }>;

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional lucide icon shown to the left of the label — used by the explore category tabs. */
  icon?: IconComponent;
}

/**
 * 칩은 **항상 누를 수 있다.** 전에는 준비중인 세부 시술을 위한 `disabled` 가 있었지만,
 * 요청 14 에서 준비중 칩도 눌러서 "등록된 병원이 아직 없어요" 를 보여주기로 하면서
 * 쓰는 곳이 사라졌다 (`SubProcedureChips.tsx` 의 주석이 그 경위다).
 */
export function Chip({ label, selected, onPress, icon: Icon }: ChipProps) {
  const borderAndFill = selected ? 'border-brand-600 bg-brand-600' : 'border-neutral-200 bg-white';
  const labelColor = selected ? 'text-white' : 'text-neutral-600';
  const iconColor = selected ? '#ffffff' : '#525252';

  return (
    <Pressable
      onPress={onPress}
      pressed={selected}
      className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${borderAndFill}`}
    >
      <View className="flex-row items-center gap-1.5">
        {/* 16px — 14px 에서는 직접 그린 치아 글리프의 안쪽 선이 뭉개졌다 (EXPLORE-4). */}
        {Icon ? <Icon size={16} color={iconColor} /> : null}
        <Text className={`text-sm font-medium ${labelColor}`}>{label}</Text>
      </View>
    </Pressable>
  );
}
