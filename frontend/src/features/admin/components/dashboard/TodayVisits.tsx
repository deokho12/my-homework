import { Link } from 'react-router-dom';

import type { AdminDashboard } from '@/features/admin/api/dashboardApi';
import { BlockEmpty, BlockError, DashboardBlock } from '@/features/admin/components/dashboard/DashboardBlock';
import { consultProcedureLabel, formatVisitTime } from '@/features/consult/consultDisplay';

/**
 * `오늘 내원 예정`. **`전체 보기` 가 없다** — 하루치가 전부이고 각 줄은 상담 상세로 간다
 * (그래서 이 목록을 재현하는 목록 파라미터도 만들지 않았다 — `docs/database/README.md` §13.5).
 */
export function TodayVisits({
  dashboard,
  isError,
  onRetry,
}: {
  dashboard: AdminDashboard | undefined;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <DashboardBlock id="today-visits-h" title="오늘 내원 예정">
      {isError ? (
        <BlockError label="오늘 내원 예정" onRetry={onRetry} />
      ) : !dashboard ? (
        <BlockEmpty>불러오는 중이에요</BlockEmpty>
      ) : dashboard.todayVisits.length === 0 ? (
        <BlockEmpty>오늘 내원 예정이 없어요</BlockEmpty>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100">
            {dashboard.todayVisits.map((visit) => (
              <li key={visit.id}>
                <Link
                  to={`/admin/consultations/${visit.id}`}
                  className="flex items-center gap-2 py-2.5 hover:bg-neutral-50"
                >
                  <span className="w-[52px] shrink-0 text-[14px] font-bold tabular-nums text-brand-700">
                    {formatVisitTime(visit.visitAt)}
                  </span>
                  <span className="shrink-0 text-[14px] font-bold text-neutral-900">{visit.name}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-500">
                    {consultProcedureLabel(visit.procedureId) ?? ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* 모집단을 적어 둔다 — "오늘 온 사람" 이 아니라 "오늘 오기로 한 사람" 이다. */}
          <p className="mt-3 text-[12px] text-neutral-400">예약확정 상태이고 확정 일시가 오늘인 건이에요</p>
        </>
      )}
    </DashboardBlock>
  );
}
