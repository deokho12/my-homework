import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { Completeness } from '@/features/hospital/lib/completeness';

/**
 * `병원 정보 N% 입력됨` 바와 남은 항목 칩.
 *
 * **라벨과 순서는 응답의 `items` 그대로다** — 화면이 다시 정렬하거나 라벨을 매핑하면 판정
 * 지점이 둘이 되고, 항목이 늘어나는 날(요청 07) 두 곳을 고쳐야 한다.
 *
 * 각 칩은 `?field={target}` 으로 수정 화면의 **그 입력 칸**을 연다. `target` 은 서버 `422` 의
 * 필드 키와 같은 어휘라 포커스 이동 코드가 한 벌뿐이다 (`useFieldJump`).
 */
export function CompletenessCard({ hospitalId, completeness }: { hospitalId: string; completeness: Completeness }) {
  const remaining = completeness.items.filter((item) => !item.done);

  return (
    <section aria-labelledby="completeness-h" className="rounded-2xl border border-neutral-100 bg-white p-4 md:p-5">
      <h2 id="completeness-h" className="text-[15px] font-bold text-neutral-900">
        병원 정보 {completeness.percent}% 입력됨
      </h2>
      <div aria-hidden="true" className="mt-2.5 h-2 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${completeness.percent}%` }} />
      </div>

      {remaining.length > 0 ? (
        <>
          <p className="mt-3 text-[13px] text-neutral-500">남은 항목 {remaining.length}개 — 누르면 입력 칸으로 가요</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {remaining.map((item) => (
              <li key={item.key}>
                <Link
                  to={`/admin/hospital/${hospitalId}?field=${item.target}`}
                  className="flex min-h-[36px] items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 text-[13px] font-semibold text-brand-700 hover:bg-brand-100"
                >
                  {item.label}
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        // 100% 여도 카드를 지우지 않는다 — 사라지면 "어디서 고치지" 가 다시 문제가 된다.
        <p className="mt-2 text-[13px] text-neutral-500">
          모두 채웠어요.{' '}
          <Link to={`/admin/hospital/${hospitalId}`} className="font-semibold text-brand-700">
            병원 정보 수정
          </Link>
        </p>
      )}
    </section>
  );
}
