import { Link } from 'react-router-dom';

import type { AdminDashboard } from '@/features/admin/api/dashboardApi';
import { BlockEmpty, BlockError, DashboardBlock } from '@/features/admin/components/dashboard/DashboardBlock';
import { ConsultDelayPill } from '@/features/consult/components/ConsultDelayPill';
import { consultProcedureLabel } from '@/features/consult/consultDisplay';
import { cx } from '@/primitives';

interface TodayTodoListProps {
  dashboard: AdminDashboard | undefined;
  isError: boolean;
  onRetry: () => void;
  /** 경과 시간 표시의 기준. 화면이 한 번 읽어 넘긴다. */
  now: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * `오늘 할 일` 네 종류. **겹치는 것을 겹친다고 적는다** — 지연 건도 `new` 라서 `지연 3건` 과
 * `신규 상담 8건` 을 더하면 거짓이다 (11건이 아니라 8건이고 그중 3건이 지연이다).
 *
 * 2·3번 줄은 `numbers.statusNew`·`numbers.unansweredInquiries` 를 **그대로** 읽는다 —
 * 같은 숫자를 두 필드로 내리면 그 둘이 어긋날 자리가 생긴다.
 */
export function TodayTodoList({ dashboard, isError, onRetry, now }: TodayTodoListProps) {
  if (isError || !dashboard) {
    return (
      <DashboardBlock id="todo-h" title="오늘 할 일">
        {isError ? <BlockError label="오늘 할 일" onRetry={onRetry} /> : <BlockEmpty>불러오는 중이에요</BlockEmpty>}
      </DashboardBlock>
    );
  }

  const { todo, numbers, hospitalId } = dashboard;
  const empty =
    todo.delayedConsults.length === 0 &&
    numbers.statusNew === 0 &&
    numbers.unansweredInquiries === 0 &&
    todo.rejectedDoctors.length === 0;

  return (
    <DashboardBlock id="todo-h" title="오늘 할 일">
      {empty ? (
        <div>
          <p className="text-sm font-semibold text-neutral-700">오늘 할 일이 없어요</p>
          <p className="mt-0.5 text-[13px] text-neutral-400">들어온 상담에 모두 연락했고, 문의도 다 답했어요</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {todo.delayedConsults.map((consult) => (
            <TodoRow
              key={consult.id}
              to={`/admin/consultations/${consult.id}`}
              urgent
              tag={<ConsultDelayPill />}
              cta="연락하기"
            >
              {consult.name} 님 {consultProcedureLabel(consult.procedureId) ?? ''},{' '}
              {Math.floor((now - new Date(consult.createdAt).getTime()) / HOUR_MS)}시간째 연락 전
            </TodoRow>
          ))}

          {todo.delayedRemaining > 0 ? (
            // 기간을 적어 보낸다 — 목록의 기본 기간(`최근 30일`)이 오래 밀린 건을 숨긴다.
            <TodoRow to="/admin/consultations?period=all" urgent>
              지연 상담 {todo.delayedRemaining}건 더 보기
            </TodoRow>
          ) : null}

          {numbers.statusNew > 0 ? (
            <TodoRow
              to="/admin/consultations?period=all"
              tag={<TodoTag className="text-sky-700">신규</TodoTag>}
              cta="보기"
            >
              신규 상담 {numbers.statusNew}건 연락하기
              {numbers.delayed > 0 ? (
                // 위의 지연 줄은 이 숫자의 일부다 — 더해서 읽지 않게 겹친다고 적는다.
                <span className="text-neutral-500"> — 그중 {numbers.delayed}건은 24시간이 지났어요</span>
              ) : null}
            </TodoRow>
          ) : null}

          {numbers.unansweredInquiries > 0 ? (
            <TodoRow to="/admin/inquiries" tag={<TodoTag className="text-neutral-600">문의</TodoTag>} cta="답변하기">
              답변 안 한 문의 {numbers.unansweredInquiries}건
            </TodoRow>
          ) : null}

          {todo.rejectedDoctors.map((doctor) => (
            <TodoRow
              key={doctor.id}
              to={`/admin/hospital/${hospitalId}?field=doctors`}
              tag={<TodoTag className="text-amber-700">반려</TodoTag>}
              cta="확인"
            >
              {/* 반려 사유는 아직 없다 — 소속 전문의를 관리자 시야로 읽는 GET 이 없다. */}
              {doctor.name} 원장 자격증 반려, 다시 올리기
            </TodoRow>
          ))}
        </ul>
      )}
    </DashboardBlock>
  );
}

function TodoTag({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cx('shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold', className)}>
      {children}
    </span>
  );
}

function TodoRow({
  to,
  urgent,
  tag,
  cta,
  children,
}: {
  to: string;
  urgent?: boolean;
  tag?: React.ReactNode;
  cta?: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        to={to}
        className={cx(
          'flex min-h-[52px] items-center gap-2.5 rounded-xl px-3 py-2',
          urgent ? 'bg-rose-50' : 'bg-neutral-50'
        )}
      >
        {tag}
        <span className="min-w-0 flex-1 text-[14px] text-neutral-800">{children}</span>
        {cta ? (
          <span className={cx('shrink-0 text-[13px] font-semibold', urgent ? 'text-rose-700' : 'text-brand-700')}>
            {cta}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
