import { Pressable, Text } from 'react-native';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'solid' | 'outline';
}

export function PrimaryButton({ label, onPress, disabled, variant = 'solid' }: PrimaryButtonProps) {
  const solidClasses = 'bg-brand-600 active:bg-brand-700';
  const outlineClasses = 'border border-brand-600 bg-white active:bg-brand-50';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-xl px-4 py-3.5 ${
        variant === 'solid' ? solidClasses : outlineClasses
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <Text className={`text-base font-semibold ${variant === 'solid' ? 'text-white' : 'text-brand-700'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
