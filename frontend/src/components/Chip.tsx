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
  /**
   * 누를 수 없는 칩(아직 준비중인 세부 시술 등). 보이되 동작하지 않는다 — 목록에서 빼면
   * "그 시술은 아예 없는 것"처럼 보여서, 준비중이라는 사실 자체를 전달하지 못한다.
   * `Pressable` 이 `aria-disabled` 를 붙이고 `rnw-pressable`(커서·호버)을 뗀다.
   */
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, icon: Icon, disabled }: ChipProps) {
  const borderAndFill = disabled
    ? 'border-neutral-100 bg-neutral-50'
    : selected
      ? 'border-brand-600 bg-brand-600'
      : 'border-neutral-200 bg-white';
  const labelColor = disabled ? 'text-neutral-300' : selected ? 'text-white' : 'text-neutral-600';
  const iconColor = disabled ? '#d4d4d4' : selected ? '#ffffff' : '#525252';

  return (
    <Pressable
      onPress={onPress}
      pressed={selected}
      disabled={disabled}
      className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${borderAndFill}`}
    >
      <View className="flex-row items-center gap-1.5">
        {Icon ? <Icon size={14} color={iconColor} /> : null}
        <Text className={`text-sm font-medium ${labelColor}`}>{label}</Text>
      </View>
    </Pressable>
  );
}
