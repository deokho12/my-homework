import { Pressable, Text } from 'react-native';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-3.5 py-2 ${
        selected ? 'border-brand-600 bg-brand-600' : 'border-neutral-200 bg-white'
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-neutral-600'}`}>{label}</Text>
    </Pressable>
  );
}
