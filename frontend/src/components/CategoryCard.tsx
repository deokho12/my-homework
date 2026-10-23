import { router } from '@/navigation';
import { Pressable, Text, type StyleProp, type ViewStyle } from '@/primitives';

import { useProcedureAvailability } from '@/features/procedure/hooks/useProcedureAvailability';
import { categoryPath, type ProcedureCategory } from '@/features/procedure/taxonomy';
import { CATEGORY_ICONS } from '@/utils/procedureIcons';

interface CategoryCardProps {
  category: ProcedureCategory;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

// neutral-500 at rest, brand-600 (see tailwind.config.js `colors.brand[600]`) while pressed.
// 쉬는 색을 neutral-400 → 500 으로 올렸다 (SYS-22) — 시안의 9칸 격자와 같은 색이다.
const ICON_COLOR_REST = '#737373';
const ICON_COLOR_PRESSED = '#17847a';

/**
 * 홈 "시술로 찾기" 격자의 한 칸 — 시술 대분류 하나.
 *
 * 등록된 병원이 한 곳도 없는 분야는 **숨기지 않고 "준비중"을 붙인다**. 격자에서 빼면
 * "이 서비스는 스케일링을 아예 안 다룬다"로 읽힌다 — 준비중이라는 사실 자체가 정보다
 * (`SubProcedureChips`·탐색 탭과 같은 판단).
 *
 * 판정은 서버가 준 `isAvailable` 에서 온다 (`features/procedure/availability.ts`). 아직
 * 받기 전이면 배지를 **달지 않는다** — 첫 프레임에 9칸 전부 "준비중" 이 번쩍이지 않게.
 */
export function CategoryCard({ category, onPress, style }: CategoryCardProps) {
  const Icon = CATEGORY_ICONS[category.id];
  const comingSoon = useProcedureAvailability().isCategoryComingSoon(category.id);

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
              nbsp 는 줄 높이는 차지하되 스크린리더가 읽지 않는다.
              `준비중` 은 **회색 글자**다 (2026-10-23 시안 검토 결정 — amber 배지로 바꾸지 않는다).
              읽어야 하는 글자라 neutral-500 이다. */}
          <Text className="text-[10px] text-neutral-500">{comingSoon ? '준비중' : ' '}</Text>
        </>
      )}
    </Pressable>
  );
}
