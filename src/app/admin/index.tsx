import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useConsultStore } from '@/store/useConsultStore';
import { useHospitalStore } from '@/store/useHospitalStore';
import { useNotificationStore } from '@/store/useNotificationStore';

function AdminBell() {
  const unreadCount = useNotificationStore(
    (state) => state.notifications.filter((n) => n.audience === 'admin' && !n.isRead).length
  );

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

export default function AdminHospitalListScreen() {
  const hospitals = useHospitalStore((state) => state.hospitals);
  const consultRequests = useConsultStore((state) => state.requests);

  const { newThisMonthCount, pendingCount } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let newThisMonth = 0;
    let pending = 0;

    for (const request of consultRequests) {
      const createdAt = new Date(request.createdAt);
      if (createdAt.getFullYear() === year && createdAt.getMonth() === month) {
        newThisMonth += 1;
      }
      if (request.status === 'new') {
        pending += 1;
      }
    }

    return { newThisMonthCount: newThisMonth, pendingCount: pending };
  }, [consultRequests]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '병원 관리자' }} />
      <View className="px-5 pb-2 pt-4">
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
          <View className="flex-1">
            <PrimaryButton label="새 병원 등록" onPress={() => router.push('/admin/hospital/new')} />
          </View>
          <View className="flex-1">
            <PrimaryButton
              label="전문의 인증 검수"
              variant="outline"
              onPress={() => router.push('/admin/specialists')}
            />
          </View>
        </View>
      </View>

      <FlatList
        data={hospitals}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 py-4"
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
    </SafeAreaView>
  );
}
