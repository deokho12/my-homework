import { Link } from 'react-router-dom';

import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useVerificationQueue } from '@/features/doctor';
import { useManagedHospitals } from '@/features/hospital';
import { Stack } from '@/navigation';
import { ScrollView, cx } from '@/primitives';

/**
 * 운영자의 `/admin`.
 *
 * **대시보드를 쓰지 않는다** — `답변 안 한 문의 N건`·`신규 상담 N건 연락하기` 는 답할 수도
 * 연락할 수도 없는 역할에게는 할 일이 아니다 (`GET /admin/dashboard` 가 운영자에게
 * `403 OPERATOR_CANNOT_USE_DASHBOARD` 인 이유와 같다). 운영자의 할 일은 검수와 병원 등록이다.
 */
export default function OperatorHome() {
  const queue = useVerificationQueue();
  const hospitals = useManagedHospitals();

  return (
    <ScrollView contentContainerClassName={cx(CONTAINER_PADDING, 'flex flex-col gap-4 pb-12 pt-5')}>
      <Stack.Screen options={{ title: '병원 목록' }} />

      <section aria-label="운영 할 일" className="grid grid-cols-1 gap-3 xs:grid-cols-2">
        <div className="flex flex-col gap-1.5 rounded-2xl border border-neutral-100 bg-white p-4">
          <span className="text-[13px] text-neutral-500">전문의 인증 검수 대기</span>
          {/* 아직 모르는 동안(로딩·실패)에는 `—` 다 — `0` 은 "검수할 것이 없다" 는 사실 주장이다. */}
          <span className="text-[28px] font-extrabold leading-tight text-neutral-900">
            {queue.data ? `${queue.data.items.length} 건` : '—'}
          </span>
          <Link to="/admin/specialists" className="text-[13px] font-semibold text-brand-700">
            검수하러 가기
          </Link>
        </div>

        <Link
          to="/admin/hospital/new"
          className="flex min-h-[44px] items-center justify-center rounded-2xl bg-brand-600 p-4 text-[15px] font-bold text-white"
        >
          새 병원 등록
        </Link>
      </section>

      <section aria-labelledby="operator-hospitals-h">
        <h2 id="operator-hospitals-h" className="mb-3 text-[17px] font-bold text-neutral-900">
          등록된 병원
        </h2>

        <QueryState
          isLoading={hospitals.isLoading}
          isError={hospitals.isError}
          data={hospitals.data}
          onRetry={() => {
            void hospitals.refetch();
          }}
          isRetrying={hospitals.isError && hospitals.isFetching}
          isEmpty={(value) => value.items.length === 0}
          emptyState={{ title: '등록된 병원이 없어요' }}
          className="min-h-[160px] justify-center"
        >
          {(value) => (
            <ul className="flex flex-col gap-3">
              {value.items.map((hospital) => (
                <li key={hospital.id}>
                  <Link
                    to={`/admin/hospital/${hospital.id}`}
                    className="flex flex-row items-center justify-between gap-2 rounded-2xl border border-neutral-100 bg-white p-4 hover:border-brand-200"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-neutral-900">{hospital.name}</span>
                      <span className="block text-xs text-neutral-400">{hospital.region}</span>
                    </span>
                    {hospital.isOneDay ? (
                      <span className="shrink-0 text-xs font-semibold text-brand-700">⚡ 원데이</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </section>
    </ScrollView>
  );
}
