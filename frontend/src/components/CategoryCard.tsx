import { router } from '@/navigation';
import { Pressable, Text, type StyleProp, type ViewStyle } from '@/primitives';

import {
  categoryPath,
  getLegacyIdsOf,
  type ProcedureCategory,
} from '@/features/procedure/taxonomy';
import { CATEGORY_ICONS } from '@/utils/procedureIcons';

interface CategoryCardProps {
  category: ProcedureCategory;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// Neutral-400 at rest, brand-600 (see tailwind.config.js `colors.brand[600]`) while pressed.
const ICON_COLOR_REST = '#a3a3a3';
const ICON_COLOR_PRESSED = '#17847a';

/**
 * 홈 "시술로 찾기" 격자의 한 칸 — 시술 대분류 하나.
 *
 * 서버가 아는 시술이 하나도 없는 대분류(스케일링·예방)는 **숨기지 않고 "준비중"을 붙인다**.
 * 격자에서 빼면 "이 서비스는 스케일링을 아예 안 다룬다"로 읽힌다 — 준비중이라는 사실 자체가
 * 정보다 (`SubProcedureChips` 의 준비중 칩과 같은 판단).
 */
export function CategoryCard({ category, onPress, style }: CategoryCardProps) {
  const Icon = CATEGORY_ICONS[category.id];
  const comingSoon = getLegacyIdsOf(category.id).length === 0;

  return (
    <Pressable
      onPress={onPress ?? (() => router.push(categoryPath(category.id)))}
      style={style}
      accessibilityLabel={comingSoon ? `${category.name} · 준비중` : category.name}
      className="items-center rounded-2xl border border-neutral-100 bg-white py-4 active:bg-neutral-50 hover:bg-neutral-50 hover:shadow-md"
    >
      {({ pressed }) => (
        <>
          <Icon size={26} color={pressed ? ICON_COLOR_PRESSED : ICON_COLOR_REST} />
          <Text className="mt-1.5 text-[13px] font-semibold text-neutral-800">{category.name}</Text>
          {/* 배지 자리를 항상 잡아 둔다 — 조건부로 넣으면 그 칸만 한 줄 높아져 격자 첫 줄이 틀어진다.
              nbsp 는 줄 높이는 차지하되 스크린리더가 읽지 않는다. */}
          <Text className="text-[10px] text-neutral-400">{comingSoon ? '준비중' : ' '}</Text>
        </>
      )}
    </Pressable>
  );
}
