import type { AdminDashboard } from '@/features/admin/api/dashboardApi';
import { BlockEmpty, BlockError, DashboardBlock } from '@/features/admin/components/dashboard/DashboardBlock';
import type { Funnel } from '@/features/consult/lib/funnel';

/**
 * `이번 달 상담 흐름`.
 *
 * 모집단은 숫자 카드 ④의 M 과 **같은 한 코호트**(이번 달 접수)라 네 막대가 같은 집합의
 * 부분집합이고, 단조 감소가 구조적으로 보장된다. 판정은 `funnelOf` 하나이고 화면은 그
 * 결과를 그리기만 한다.
 *
 * ⚠ `연락 완료` 는 "신규를 벗어났고 연락 불발로 닫히지 않은 건" 이다 — 라벨과 규칙이
 * 1:1 이 아닌 자리이고, 그 막대만 상태 탭으로 재현되지 않는다
 * (`docs/features/admin-dashboard.md`, `docs/database/README.md` §13.6).
 */
const STAGES: { key: keyof Funnel; label: string; bar: string }[] = [
  { key: 'requested', label: '상담 신청', bar: 'bg-neutral-400' },
  { key: 'contacted', label: '연락 완료', bar: 'bg-brand-400' },
  { key: 'booked', label: '예약확정', bar: 'bg-brand-600' },
  { key: 'visited', label: '내원완료', bar: 'bg-brand-800' },
];

export function MonthlyFunnel({
  dashboard,
  isError,
  onRetry,
}: {
  dashboard: AdminDashboard | undefined;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <DashboardBlock id="funnel-h" title="이번 달 상담 흐름">
      {isError ? (
        <BlockError label="이번 달 상담 흐름" onRetry={onRetry} />
      ) : !dashboard ? (
        <BlockEmpty>불러오는 중이에요</BlockEmpty>
      ) : dashboard.funnel.requested === 0 ? (
        <BlockEmpty>이번 달 상담 신청이 아직 없어요</BlockEmpty>
      ) : (
        <dl className="flex flex-col gap-3">
          {STAGES.map((stage) => {
            const value = dashboard.funnel[stage.key];

            return (
              <div key={stage.key}>
                <div className="flex flex-row items-baseline justify-between gap-2">
                  <dt className="text-[14px] text-neutral-700">{stage.label}</dt>
                  <dd className="text-[14px] font-bold text-neutral-900">{value}건</dd>
                </div>
                {/* 막대는 숫자를 보조할 뿐이다 — 값은 위 `dd` 가 글자로 말한다. */}
                <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${stage.bar}`}
                    style={{ width: `${Math.round((value / dashboard.funnel.requested) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {/* 취소는 단계가 아니라 옆에 적는 숫자다 — 막대 사이에 끼우지 않는다. */}
          <div className="flex flex-row items-baseline justify-between gap-2 border-t border-neutral-100 pt-3">
            <dt className="text-[14px] text-neutral-500">취소</dt>
            <dd className="text-[14px] font-bold text-neutral-500">{dashboard.funnel.cancelled}건</dd>
          </div>
        </dl>
      )}
    </DashboardBlock>
  );
}
