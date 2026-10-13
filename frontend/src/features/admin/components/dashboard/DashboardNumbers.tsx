import { Link } from 'react-router-dom';

import type { AdminDashboardNumbers } from '@/features/admin/api/dashboardApi';
import { formatDateTimeShort } from '@/lib/dateFormat';
import { cx } from '@/primitives';

/**
 * 숫자 카드 4장.
 *
 * **카드를 누르면 같은 숫자가 나오는 목록이 열린다** — 그 등식이 이 화면의 불변식이고,
 * 각 링크의 파라미터가 서버가 센 모집단을 그대로 재현한다 (`docs/api/README.md` §14).
 *
 * 보조 줄 안에는 링크를 두지 않는다(중첩 금지). `24시간 지연` 에는 링크가 아예 없다 —
 * 지연을 재현하는 목록 파라미터를 만들면 상태도 기간도 아닌 세 번째 필터 축이 생긴다.
 *
 * **기간이 무관한 숫자는 `period=all` 을 적어 보낸다.** 상담 목록의 기본 기간은 `최근 30일`
 * 이라, 적지 않으면 31일 전에 들어온 `신규` 가 카드에는 세어지고 목록에서는 빠진다 —
 * 카드 숫자와 목록 건수가 갈리는 바로 그 상황이고, 밀려 있는 오래된 건일수록 더 그렇다.
 */
export function DashboardNumbers({ numbers }: { numbers: AdminDashboardNumbers | undefined }) {
  const oldest = numbers?.oldestUnansweredAt ? formatDateTimeShort(numbers.oldestUnansweredAt) : null;

  return (
    <section aria-label="핵심 숫자" className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
      <NumberCard
        label="오늘 들어온 상담"
        value={numbers?.todayNew}
        to="/admin/consultations?status=all&period=today"
        note={numbers ? `신규 전체 ${numbers.statusNew}건` : null}
        noteClassName="text-sky-700 font-semibold"
      />
      <NumberCard
        label="처리 대기 (신규 + 연락중)"
        value={numbers?.pending}
        to="/admin/consultations?status=new&status=contacted&period=all"
        note={numbers ? (numbers.delayed > 0 ? `24시간 지연 ${numbers.delayed}건` : '24시간 지연 없음') : null}
        noteClassName={numbers && numbers.delayed > 0 ? 'text-rose-600 font-semibold' : 'text-neutral-500'}
      />
      <NumberCard
        label="답변 안 한 문의"
        value={numbers?.unansweredInquiries}
        to="/admin/inquiries"
        note={oldest ? `가장 오래된 것 ${oldest}` : null}
        noteClassName="text-neutral-500"
      />
      <NumberCard
        label="이번 달 예약확정"
        value={numbers?.bookedThisMonth}
        to="/admin/consultations?period=thisMonth&status=booked&status=visited"
        note={
          numbers
            ? numbers.newThisMonth === 0
              ? '이번 달 신청이 아직 없어요'
              : `이번 달 신청 ${numbers.newThisMonth}건 중 ${numbers.bookedThisMonth}건 예약`
            : null
        }
        noteClassName={numbers && numbers.newThisMonth === 0 ? 'text-neutral-500' : 'text-brand-700 font-semibold'}
      />
    </section>
  );
}

function NumberCard({
  label,
  value,
  to,
  note,
  noteClassName,
}: {
  label: string;
  /** 아직 모르는 동안(로딩·실패)에는 `—` 다. `0` 은 "없다" 는 **사실 주장**이다. */
  value: number | undefined;
  to: string;
  note: string | null;
  noteClassName: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col gap-1.5 rounded-2xl border border-neutral-100 bg-white p-4 hover:border-brand-200"
    >
      <span className="text-[13px] text-neutral-500">{label}</span>
      <span className="text-[28px] font-extrabold leading-tight text-neutral-900">
        {value === undefined ? '—' : `${value} 건`}
      </span>
      {note ? <span className={cx('text-[13px]', noteClassName)}>{note}</span> : null}
    </Link>
  );
}
