import { ScrollView } from '@/primitives';

import { Chip } from '@/components/Chip';
import { CONTAINER_PADDING } from '@/components/layout/Container';
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
 * 서버가 모르는 세부 시술은 **지우지 않고 "· 준비중" 을 붙여 비활성**으로 둔다. 목록에서
 * 빼면 사용자는 그 시술을 아예 안 하는 줄 알고 떠난다 — 준비중이라는 사실 자체가 정보다.
 */
export function SubProcedureChips({ categoryId, selected, onSelect }: SubProcedureChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName={CONTAINER_PADDING}>
      <Chip label="전체" selected={selected === null} onPress={() => onSelect(null)} />
      {getSubProceduresOf(categoryId).map((sub) => (
        <Chip
          key={sub.id}
          label={sub.legacyProcedureId ? sub.name : `${sub.name} · 준비중`}
          disabled={!sub.legacyProcedureId}
          selected={selected === sub.id}
          onPress={() => onSelect(sub.id)}
        />
      ))}
    </ScrollView>
  );
}
