import { router, Stack } from '@/navigation';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useMarkAllNotificationsAsRead, useMarkNotificationAsRead, useNotifications } from '@/features/notification';
import type { AppNotification } from '@/types/domain';

/**
 * 이 화면에는 페이지네이션 UI 가 없다. 계약이 허용하는 상한(`pageSize` 최대 100)까지
 * 한 번에 받아 예전처럼 전부 그린다. 페이지 이동 UI 가 생기면 이 상수는 사라진다.
 *
 * ⚠ **알림은 상담 접수·상태 변경마다 늘어나기만 하는 컬렉션이라 언젠가 100건을 넘는다.**
 * 그때 101번째부터는 화면에서 조용히 사라진다 (안 읽은 개수 배지는 전체를 세므로 목록에
 * 없는 알림이 숫자에만 남는다). 페이지 이동 UI 나 무한 스크롤이 그 시점의 숙제다.
 */
const LIST_PAGE_SIZE = 100;

const EMPTY_TITLE = '아직 도착한 알림이 없어요';

function AdminNotificationRow({ notification }: { notification: AppNotification }) {
  const markAsRead = useMarkNotificationAsRead();

  const handlePress = () => {
    // 읽음 처리는 이동을 막지 않는다 — 실패해도 알림을 열지 못할 이유가 없다.
    markAsRead.mutate(notification.id);

    if (notification.relatedId) {
      router.push(`/admin/consultations/${notification.relatedId}`);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      className={`mb-2 flex-row gap-3 rounded-2xl border p-4 ${
        notification.isRead ? 'border-neutral-100 bg-white' : 'border-brand-100 bg-brand-50'
      }`}
    >
      <View className="pt-1.5">
        {notification.isRead ? (
          <View style={{ width: 8, height: 8 }} />
        ) : (
          <View className="rounded-full bg-brand-600" style={{ width: 8, height: 8 }} />
        )}
      </View>
      <View className="flex-1">
        <Text
          className={`mb-1 text-sm ${
            notification.isRead ? 'font-medium text-neutral-500' : 'font-bold text-neutral-900'
          }`}
        >
          {notification.title}
        </Text>
        <Text className={`text-sm ${notification.isRead ? 'text-neutral-400' : 'text-neutral-600'}`}>
          {notification.message}
        </Text>
        <Text className="mt-1.5 text-[11px] text-neutral-400">
          {new Date(notification.createdAt).toLocaleString('ko-KR')}
        </Text>
      </View>
    </Pressable>
  );
}

export default function AdminNotificationsScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useNotifications('admin', { pageSize: LIST_PAGE_SIZE });
  const markAllAsRead = useMarkAllNotificationsAsRead();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '알림' }} />
      <View className={cx(CONTAINER_PADDING, 'flex-row items-center justify-between pb-2 pt-4')}>
        <Text className="text-lg font-bold text-neutral-900">알림함</Text>
        <Pressable onPress={() => markAllAsRead.mutate('admin')} hitSlop={8}>
          <Text className="text-sm font-semibold text-brand-700">모두 읽음</Text>
        </Pressable>
      </View>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        // 0건은 아래 FlatList 의 기존 빈 상태(🔔)가 그대로 맡는다.
        isEmpty={() => false}
        emptyState={{ title: EMPTY_TITLE }}
      >
        {(page) => (
          <FlatList
            data={page.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName={cx(CONTAINER_PADDING, 'py-2')}
            renderItem={({ item }) => <AdminNotificationRow notification={item} />}
            ListEmptyComponent={
              <View className="items-center px-8 py-16">
                <Text className="mb-2 text-4xl">🔔</Text>
                <Text className="text-center text-sm text-neutral-500">{EMPTY_TITLE}</Text>
              </View>
            }
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
