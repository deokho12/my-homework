import { Badge } from '@/components/Badge';
import type { AdminConsultRequest } from '@/features/consult/api/consultApi';
import {
  CONSULT_STATUS_TONE,
  consultProcedureLabel,
  consultVisitLine,
  formatDateTimeShort,
  isConsultDelayed,
} from '@/features/consult/consultDisplay';
import { useHospitalName } from '@/features/hospital';
import { cx } from '@/primitives';
import { CONSULT_STATUS_LABEL } from '@/types/domain';

interface AdminConsultCardProps {
  request: AdminConsultRequest;
  selected: boolean;
  onSelect: (id: string) => void;
  /** 판정 시각을 인자로 받는다 — 카드가 각자 `Date.now()` 를 부르면 한 목록 안에서 기준이 갈린다. */
  now: number;
}

/**
 * 목록 카드 한 장. **표가 아니라 카드다** — 넓은 화면에서도 왼쪽 칸이 380px 이라 열이 들어가지
 * 않고, 360px 에서 가로 스크롤이 생긴다. 목업의 표 열을 카드 네 줄로 옮겼다.
 *
 * **카드 안에 빠른 상태 버튼을 두지 않는다.** 상태 변경은 환자에게 알림이 나가 되돌릴 수 없고,
 * 예약확정에는 확정 일시 입력이 필요하다 — 목록에서 한 번의 오탭으로 일어나서는 안 되는 일이다.
 */
export function AdminConsultCard({ request, selected, onSelect, now }: AdminConsultCardProps) {
  const procedureLabel = consultProcedureLabel(request.procedureId);
  const line = consultVisitLine(request);
  const delayed = isConsultDelayed(request, now);
  // 로컬 응답에 `hospitalName` 이 없어 병원 id 로 따로 묻는다 (마이페이지 상담 내역과 같은 훅).
  // 같은 병원의 카드는 한 번만 조회된다 — react-query 가 병원 id 로 캐시를 공유한다.
  const hospitalName = useHospitalName(request.hospitalId);
  const whereLine = [hospitalName, procedureLabel].filter(Boolean).join(' · ');

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(request.id)}
        aria-current={selected ? 'true' : undefined}
        className={cx(
          'mb-3 flex w-full flex-col gap-1.5 rounded-2xl border bg-white p-4 text-left',
          selected ? 'border-brand-600 ring-2 ring-brand-600' : 'border-neutral-100'
        )}
      >
        <span className="flex flex-row items-center justify-between gap-2">
          <span className="flex min-w-0 flex-row items-center gap-1.5">
            <Badge label={CONSULT_STATUS_LABEL[request.status]} tone={CONSULT_STATUS_TONE[request.status]} />
            {/* 상태 칩이 아니라서 Badge(danger) 를 쓰지 않는다 — 같은 빨강이라도 더 작고 굵은
                pill 로 두어 옆의 `취소` 칩과 생김새가 갈린다. 색 없이 글자로도 읽힌다. */}
            {delayed ? (
              <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                지연
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-xs text-neutral-400">{formatDateTimeShort(request.createdAt)}</span>
        </span>

        <span className="flex flex-row items-baseline gap-2">
          <span className="min-w-0 truncate text-[15px] font-bold text-neutral-900">{request.name}</span>
          {/* 목록 응답이 이미 가려서 준다 — 화면에서 자르지 않는다. */}
          <span className="shrink-0 text-[13px] tabular-nums text-neutral-500">{request.phone}</span>
        </span>

        {/* 운영자는 전 병원의 상담을 한 목록에서 본다 — 어느 병원의 건인지가 카드에 있어야 한다. */}
        {whereLine ? <span className="break-words text-[13px] text-neutral-600">{whereLine}</span> : null}

        {line ? (
          <span className={line.emphasized ? 'text-[13px] font-semibold text-brand-700' : 'text-[13px] text-neutral-500'}>
            {line.text}
          </span>
        ) : null}
      </button>
    </li>
  );
}
