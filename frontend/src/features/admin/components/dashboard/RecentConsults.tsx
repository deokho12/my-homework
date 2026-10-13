import { Link } from 'react-router-dom';

import type { AdminDashboard } from '@/features/admin/api/dashboardApi';
import { BlockEmpty, BlockError, DashboardBlock } from '@/features/admin/components/dashboard/DashboardBlock';
import { ConsultSummaryRow } from '@/features/consult/components/ConsultSummaryRow';

/**
 * `최근 상담 예약` 5건. 상태를 가리지 않는다 — "방금 무슨 일이 있었나" 를 보는 자리다.
 * `전체 보기` 는 **같은 정렬의 1페이지**(상담 목록 전체 탭)로 간다.
 */
export function RecentConsults({
  dashboard,
  isError,
  onRetry,
  now,
}: {
  dashboard: AdminDashboard | undefined;
  isError: boolean;
  onRetry: () => void;
  now: number;
}) {
  return (
    <DashboardBlock
      id="recent-consults-h"
      title="최근 상담 예약"
      action={
        // 여기 다섯 줄은 기간을 가리지 않고 고른 최신 5건이다 — 목록의 기본 기간
        // (`최근 30일`)으로 열면 그중 일부가 빠져 "방금 본 줄이 없다" 가 된다.
        <Link
          to="/admin/consultations?status=all&period=all"
          className="shrink-0 text-[13px] font-semibold text-brand-700"
        >
          전체 보기
        </Link>
      }
    >
      {isError ? (
        <BlockError label="최근 상담 예약" onRetry={onRetry} />
      ) : !dashboard ? (
        <BlockEmpty>불러오는 중이에요</BlockEmpty>
      ) : dashboard.recentConsults.length === 0 ? (
        <BlockEmpty>아직 들어온 상담이 없어요</BlockEmpty>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {dashboard.recentConsults.map((request) => (
            <ConsultSummaryRow key={request.id} request={request} now={now} />
          ))}
        </ul>
      )}
    </DashboardBlock>
  );
}
