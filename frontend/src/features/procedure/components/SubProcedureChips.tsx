import { ScrollView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useProcedureAvailability } from '@/features/procedure/hooks/useProcedureAvailability';
import { getSubProceduresOf, type CategoryId, type SubProcedureId } from '@/features/procedure/taxonomy';

interface SubProcedureChipsProps {
  categoryId: CategoryId;
  /** `null` = "전체" */
  selected: SubProcedureId | null;
  onSelect: (id: SubProcedureId | null) => void;
}

/**
 * 대분류 안의 세부 시술 칩 줄.
 *
 * 등록된 병원이 아직 없는 시술은 **지우지 않고 "· 준비중" 을 붙인다.** 목록에서 빼면
 * 사용자는 그 시술을 아예 안 하는 줄 알고 떠난다 — 준비중이라는 사실 자체가 정보다.
 *
 * 전에는 비활성(`disabled`)이었다. **지금은 누를 수 있다** — 그때는 서버가 그 시술을 몰라서
 * 물어볼 수가 없었지만, 이제 31개 전부 물어볼 수 있고 답이 0건일 뿐이다. 그 0건은 목록의
 * 빈 상태가 "이 시술은 준비중이에요" 로 말한다 (`CategoryPage`). 누를 수 있게 둔 덕에
 * 검색 추천에서 준비중 세부로 들어와도 칩이 `aria-disabled` + `aria-pressed` 동시 참이라는
 * 모순 상태가 되지 않는다.
 */
export function SubProcedureChips({ categoryId, selected, onSelect }: SubProcedureChipsProps) {
  const availability = useProcedureAvailability();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={CONTAINER_PADDING}>
      <Chip label="전체" selected={selected === null} onPress={() => onSelect(null)} />
      {getSubProceduresOf(categoryId).map((sub) => (
        <Chip
          key={sub.id}
          label={availability.isSubComingSoon(sub.id) ? `${sub.name} · 준비중` : sub.name}
          selected={selected === sub.id}
          onPress={() => onSelect(sub.id)}
        />
      ))}
    </ScrollView>
  );
}
