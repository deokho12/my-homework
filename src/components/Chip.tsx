import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

/** Matches the shape of a lucide-react-native icon component (e.g. `Sparkles`, `Syringe`). */
type IconComponent = ComponentType<{ size?: number; color?: string }>;

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional lucide icon shown to the left of the label — used by the explore category tabs. */
  icon?: IconComponent;
}

export function Chip({ label, selected, onPress, icon: Icon }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-neutral-200 bg-white'
      }`}
    >
      <View className="flex-row items-center gap-1.5">
        {Icon ? <Icon size={14} color={selected ? '#ffffff' : '#525252'} /> : null}
        <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-neutral-600'}`}>{label}</Text>
      </View>
    </Pressable>
  );
}
