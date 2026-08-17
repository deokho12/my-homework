import { router, Stack } from '@/navigation';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
} from '@/features/notification';
import type { AppNotification, NotificationAudience } from '@/types/domain';

/**
 * 알림을 눌렀을 때 어디로 갈지.
 *
 * **`relatedResource` 를 본다.** 예전 관리자 알림함은 `relatedId` 만 보고 무조건 상담
 * 상세로 보냈다 — 전문의 검수 알림이 생기면 엉뚱한 곳으로 간다(개발자 메모). 서버가
 * 종류를 함께 내려주므로 이제 구분할 수 있다.
 *
 * 모르는 조합이면 `null` 을 돌려 **이동하지 않는다** — 읽음 처리만 된다. 추측해서
 * 아무 데나 보내는 것보다 낫다.
 */
function routeFor(notification: AppNotification, audience: NotificationAudience): string | null {
  if (notification.relatedResource === 'consultRequest' && notification.relatedId) {
    return audience === 'admin'
      ? `/admin/consultations/${notification.relatedId}`
      : `/me/consult-requests/${notification.relatedId}`;
  }

  if (notification.relatedResource === 'doctor' && audience === 'admin') {
    return '/admin/specialists';
  }

  if (notification.relatedResource === 'hospital' && notification.relatedId) {
    return `/hospital/${notification.relatedId}`;
  }

  if (notification.type === 'event') return '/events';

  return null;
}

function NotificationRow({
  notification,
  audience,
}: {
  notification: AppNotification;
  audience: NotificationAudience;
}) {
  const { mutate: markAsRead } = useMarkNotificationAsRead();

  const handlePress = () => {
    // 서버가 멱등이라 이미 읽은 알림에 다시 불러도 안전하다.
    if (!notification.isRead) markAsRead(notification.id);

    const target = routeFor(notification, audience);

    if (target !== null) router.push(target);
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

/**
 * 사용자·관리자 알림함의 공용 본체.
 *
 * 두 화면이 정렬·읽음·행 렌더를 각자 갖고 있었는데 내용이 같았다 — 한쪽만 고치면
 * 조용히 갈라진다. 다른 것은 `audience` 하나뿐이고, 그 값이 **서버 쿼리와 이동 경로**를
 * 함께 정한다.
 *
 * 정렬은 **서버가 한다**(최신순). 화면이 전체를 받아 정렬하면 페이지네이션과 어긋난다.
 */
export function NotificationInbox({ audience }: { audience: NotificationAudience }) {
  const { data, isLoading, isError, isFetching, refetch } = useNotifications(audience);
  const { mutate: markAllAsRead, isPending: markAllPending } = useMarkAllNotificationsAsRead();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '알림' }} />
      <View className={cx(CONTAINER_PADDING, 'flex-row items-center justify-between pb-2 pt-4')}>
        <Text className="text-lg font-bold text-neutral-900">알림함</Text>
        {/* `audience` 를 함께 보낸다 — 반대쪽 알림함의 안 읽은 표시는 그대로 남아야 한다. */}
        <Pressable onPress={() => markAllAsRead(audience)} hitSlop={8} disabled={markAllPending}>
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
        emptyState={{ title: '아직 도착한 알림이 없어요' }}
        className="flex-1"
      >
        {(page) => (
          <FlatList
            data={page.items}
            keyExtractor={(item) => item.id}
            contentContainerClassName={cx(CONTAINER_PADDING, 'py-2')}
            renderItem={({ item }) => <NotificationRow notification={item} audience={audience} />}
            ListEmptyComponent={
              <View className="items-center px-8 py-16">
                <Text className="mb-2 text-4xl">🔔</Text>
                <Text className="text-center text-sm text-neutral-500">아직 도착한 알림이 없어요</Text>
              </View>
            }
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
