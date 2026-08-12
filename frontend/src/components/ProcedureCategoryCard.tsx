import { router } from '@/navigation';
import { Pressable, Text, type StyleProp, type ViewStyle } from '@/primitives';

import type { Procedure } from '@/types/domain';
import { PROCEDURE_ICONS } from '@/utils/procedureIcons';

interface ProcedureCategoryCardProps {
  procedure: Procedure;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Neutral-400 at rest, brand-600 (see tailwind.config.js `colors.brand[600]`) while pressed.
const ICON_COLOR_REST = '#a3a3a3';
const ICON_COLOR_PRESSED = '#17847a';

export function ProcedureCategoryCard({ procedure, onPress, style }: ProcedureCategoryCardProps) {
  const Icon = PROCEDURE_ICONS[procedure.id];

  return (
    <Pressable
      onPress={
        onPress ??
        (() =>
          router.push({ pathname: '/(tabs)/explore', params: { mode: 'hospital', category: procedure.id } }))
      }
      style={style}
      className="items-center rounded-2xl border border-neutral-100 bg-white py-4 active:bg-neutral-50 hover:bg-neutral-50 hover:shadow-md"
    >
      {({ pressed }) => (
        <>
          <Icon size={26} color={pressed ? ICON_COLOR_PRESSED : ICON_COLOR_REST} />
          <Text className="mt-1.5 text-[13px] font-semibold text-neutral-800">{procedure.name}</Text>
        </>
      )}
    </Pressable>
  );
}
