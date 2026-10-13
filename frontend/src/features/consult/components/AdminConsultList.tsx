import type { AdminConsultRequest } from '@/features/consult/api/consultApi';
import { AdminConsultCard } from '@/features/consult/components/AdminConsultCard';

interface AdminConsultListProps {
  items: AdminConsultRequest[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** `지연` 판정 시각. **화면이 한 번 읽어 넘긴다** — 카드마다 시계를 읽으면 긴 목록의 위와 아래가 다른 기준이 된다. */
  now: Date;
}

/**
 * 관리자 상담 예약 화면의 왼쪽 목록. 신청일시 최신순은 api 가 이미 맞춰 준다 — 화면에서
 * 다시 정렬하지 않는다.
 *
 * `지연` 판정 시각은 **화면에서 한 번 읽어** 카드마다 넘긴다 (렌더 중에 시계를 읽지 않는다).
 */
export function AdminConsultList({ items, selectedId, onSelect, now }: AdminConsultListProps) {
  return (
    <ul>
      {items.map((request) => (
        <AdminConsultCard
          key={request.id}
          request={request}
          selected={request.id === selectedId}
          onSelect={onSelect}
          now={now.getTime()}
        />
      ))}
    </ul>
  );
}
