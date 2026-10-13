import { Link } from 'react-router-dom';

import { Badge } from '@/components/Badge';
import type { AdminConsultRequest } from '@/features/consult/api/consultApi';
import { ConsultDelayPill } from '@/features/consult/components/ConsultDelayPill';
import {
  CONSULT_STATUS_TONE,
  consultProcedureLabel,
  consultVisitLine,
  formatDateTimeShort,
  isConsultDelayed,
} from '@/features/consult/consultDisplay';
import { CONSULT_STATUS_LABEL } from '@/types/domain';

interface ConsultSummaryRowProps {
  request: AdminConsultRequest;
  /** 판정 시각. **화면이 한 번 읽어 넘긴다** — 줄마다 시계를 읽으면 위아래 기준이 갈린다. */
  now: number;
}

/**
 * 대시보드 `최근 상담 예약` 한 줄.
 *
 * **표가 아니라 줄 목록이다** — 360px 에서 표를 그리면 가로 스크롤이 생긴다. 넓은 화면에서만
 * `order`·고정 폭으로 칸이 맞고, 좁으면 두세 줄로 접힌다.
 *
 * **전화번호를 싣지 않는다.** 대시보드는 목록보다 더 가벼운 자리이고, 번호가 필요한 일은
 * 상세에서 한다.
 */
export function ConsultSummaryRow({ request, now }: ConsultSummaryRowProps) {
  const visit = consultVisitLine(request);

  return (
    <li>
      <Link
        to={`/admin/consultations/${request.id}`}
        className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 hover:bg-neutral-50 lg:flex-nowrap"
      >
        <span className="order-1 w-[86px] shrink-0 text-[13px] text-neutral-400">
          {formatDateTimeShort(request.createdAt)}
        </span>
        <span className="order-2 shrink-0 text-[14px] font-bold text-neutral-900 lg:w-[72px] lg:truncate">
          {request.name}
        </span>
        <span className="order-4 w-full min-w-0 truncate text-[13px] text-neutral-600 lg:order-3 lg:w-auto lg:flex-1">
          {consultProcedureLabel(request.procedureId) ?? ''}
        </span>
        <span className="order-5 min-w-0 truncate text-[13px] text-neutral-500 lg:order-4 lg:w-[140px]">
          {visit?.text ?? ''}
        </span>
        <span className="order-3 ml-auto flex shrink-0 items-center gap-1.5 lg:order-5 lg:ml-0 lg:w-[96px] lg:justify-end">
          {isConsultDelayed(request, now) ? <ConsultDelayPill /> : null}
          <Badge label={CONSULT_STATUS_LABEL[request.status]} tone={CONSULT_STATUS_TONE[request.status]} />
        </span>
      </Link>
    </li>
  );
}
