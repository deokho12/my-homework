import { router, Stack } from '@/navigation';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { PrimaryButton } from '@/components/PrimaryButton';
import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useSession } from '@/features/auth/hooks/useSession';
import { useConsultSummary } from '@/features/consult';
import { useManagedHospitals } from '@/features/hospital';
import { useUnreadNotificationCount } from '@/features/notification';

function AdminBell() {
  const { data } = useUnreadNotificationCount('admin');
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <Pressable onPress={() => router.push('/admin/notifications')} hitSlop={8} style={{ position: 'relative' }}>
      <Text className="text-xl">🔔</Text>
      {unreadCount > 0 ? (
        <View
          className="min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1"
          style={{ position: 'absolute', top: -6, right: -8, height: 16 }}
        >
          <Text className="text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 rounded-2xl border border-neutral-100 bg-white p-4">
      <Text className="mb-1 text-xs font-medium text-neutral-500">{label}</Text>
      <Text className="text-2xl font-extrabold text-neutral-900">{value}</Text>
    </View>
  );
}

/** `scope` 별로 다른 사실을 말한다 — 둘 다 "빈 화면"이 아니라 서로 다른 상황이다. */
function emptyTitleForScope(scope: 'managed' | 'all'): string {
  return scope === 'managed' ? '담당 병원이 아직 지정되지 않았어요' : '등록된 병원이 없어요';
}

export default function AdminHomePage() {
  const { isOperator } = useSession();
  const { data, isLoading, isError, isFetching, refetch } = useManagedHospitals();
  /**
   * 숫자 두 개를 **서버가 센다.** 예전에는 화면이 기기 시계로 "이번 달" 을 판정했는데,
   * 그 경계는 한국 달력이어야 하고(서버는 UTC 로 돈다) 세는 대상도 담당 병원 범위로
   * 좁혀져야 한다. 서버가 `Asia/Seoul` 로 계산해 내려준다.
   */
  const { data: summary } = useConsultSummary();
  const newThisMonthCount = summary?.newThisMonth ?? 0;
  const pendingCount = summary?.pending ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '병원 관리자' }} />
      <View className={cx(CONTAINER_PADDING, 'pb-2 pt-4')}>
        <View className="mb-1 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-neutral-900">병원 프로필 관리</Text>
          <AdminBell />
        </View>
        <Text className="mb-4 text-sm text-neutral-500">
          등록된 병원 정보를 수정하거나 새 병원을 등록할 수 있어요
        </Text>

        <View className="mb-3 flex-row gap-2">
          <StatCard label="이번 달 신규 상담" value={newThisMonthCount} />
          <StatCard label="처리 대기 중인 상담" value={pendingCount} />
        </View>

        <View className="mb-2">
          <PrimaryButton
            label="상담 관리"
            variant="outline"
            onPress={() => router.push('/admin/consultations')}
          />
        </View>

        <View className="flex-row gap-2">
          {isOperator ? (
            <View className="flex-1">
              <PrimaryButton label="새 병원 등록" onPress={() => router.push('/admin/hospital/new')} />
            </View>
          ) : null}
          {isOperator ? (
            // 전문의 인증 검수는 `operator` 전용 오퍼레이션이다 — `hospital_admin` 에게는
            // 라우트 가드(RequireAuth)뿐 아니라 화면 안 진입 버튼도 보이지 않아야 한다.
            <View className="flex-1">
              <PrimaryButton
                label="전문의 인증 검수"
                variant="outline"
                onPress={() => router.push('/admin/specialists')}
              />
            </View>
          ) : null}
        </View>
      </View>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        isEmpty={(value) => value.items.length === 0}
        emptyState={{ title: data ? emptyTitleForScope(data.scope) : '등록된 병원이 없어요' }}
      >
        {(value) => (
          <FlatList
            data={value.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName={cx(CONTAINER_PADDING, 'py-4')}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => router.push(`/admin/hospital/${item.id}`)}
                className="mb-3 flex-row items-center justify-between rounded-2xl border border-neutral-100 bg-white p-4"
              >
                <View className="flex-1">
                  <Text className="text-base font-bold text-neutral-900">{item.name}</Text>
                  <Text className="text-xs text-neutral-400">{item.region}</Text>
                </View>
                {item.isOneDay ? <Text className="text-xs font-semibold text-brand-700">⚡ 원데이</Text> : null}
              </Pressable>
            )}
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
