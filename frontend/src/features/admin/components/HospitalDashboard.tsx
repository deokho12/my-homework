import { Building2 } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useAdminDashboard } from '@/features/admin/hooks/useAdminDashboard';
import { useAdminHospital } from '@/features/admin/hooks/useAdminHospital';
import { CompletenessCard } from '@/features/admin/components/dashboard/CompletenessCard';
import { DashboardNumbers } from '@/features/admin/components/dashboard/DashboardNumbers';
import { ExposureWarning } from '@/features/admin/components/dashboard/ExposureWarning';
import { MonthlyFunnel } from '@/features/admin/components/dashboard/MonthlyFunnel';
import { RecentConsults } from '@/features/admin/components/dashboard/RecentConsults';
import { TodayTodoList } from '@/features/admin/components/dashboard/TodayTodoList';
import { TodayVisits } from '@/features/admin/components/dashboard/TodayVisits';
import { formatTodayLong } from '@/lib/dateFormat';
import { Stack } from '@/navigation';
import { ScrollView, cx } from '@/primitives';

/**
 * 병원 관리자의 `/admin` — **오늘 처리할 일이 먼저 보이는 화면**.
 *
 * 숫자는 전부 대시보드 응답 하나에서 온다. 화면은 **아무것도 다시 세지 않는다** —
 * 지연도, 처리 대기(= 신규 + 연락중)도 서버가 센 값을 그대로 그린다. 다시 세는 순간 사이드
 * 배지와 카드가 어긋날 자리가 생긴다 (`docs/database/README.md` §13.8).
 */
export default function HospitalDashboard() {
  const { hospitalId, count } = useAdminHospital();
  const dashboard = useAdminDashboard(hospitalId);
  // 경과 시간(`3시간째 연락 전`)의 기준. **화면이 한 번 읽어** 블록마다 넘긴다 —
  // 줄마다 시계를 읽으면 한 화면의 위와 아래가 다른 기준이 된다.
  const now = new Date();

  if (count === 0) {
    return (
      <>
        <Stack.Screen options={{ title: '대시보드' }} />
        <EmptyState
          icon={Building2}
          title="담당 병원이 아직 지정되지 않았어요"
          description="운영자가 병원을 연결하면 이 화면에 오늘 할 일이 나타나요"
        />
      </>
    );
  }

  const data = dashboard.data;
  const isError = dashboard.isError;
  const retry = () => {
    void dashboard.refetch();
  };

  return (
    <ScrollView contentContainerClassName={cx(CONTAINER_PADDING, 'flex flex-col gap-4 pb-12 pt-5')}>
      <Stack.Screen options={{ title: '대시보드' }} />

      {/* 인사는 heading 이 아니다 — 화면 제목은 상단바의 `h1` 하나다. */}
      <div>
        <p className="text-[13px] text-neutral-500">{formatTodayLong(now)}</p>
        <p className="text-[22px] font-extrabold text-neutral-900 lg:text-[26px]">
          {/* 이름이 오기 전에 `안녕하세요,` 의 쉼표만 남지 않게 한다. */}
          {data ? `안녕하세요, ${data.hospitalName}` : '안녕하세요'}
        </p>
      </div>

      {data?.completeness.noProcedures ? <ExposureWarning hospitalId={data.hospitalId} /> : null}
      {data ? <CompletenessCard hospitalId={data.hospitalId} completeness={data.completeness} /> : null}

      <DashboardNumbers numbers={data?.numbers} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <TodayTodoList dashboard={data} isError={isError} onRetry={retry} now={now.getTime()} />
          <RecentConsults dashboard={data} isError={isError} onRetry={retry} now={now.getTime()} />
        </div>
        <div className="flex flex-col gap-4 lg:w-[320px] lg:shrink-0">
          <TodayVisits dashboard={data} isError={isError} onRetry={retry} />
          <MonthlyFunnel dashboard={data} isError={isError} onRetry={retry} />
        </div>
      </div>
    </ScrollView>
  );
}
