import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNotificationStore } from '@/store/useNotificationStore';
import type { AppNotification } from '@/types/domain';

function AdminNotificationRow({ notification }: { notification: AppNotification }) {
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  const handlePress = () => {
    markAsRead(notification.id);
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
  const notifications = useNotificationStore((state) => state.notifications);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  const adminNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.audience === 'admin')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications]
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['bottom']}>
      <Stack.Screen options={{ title: '알림' }} />
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-lg font-bold text-neutral-900">알림함</Text>
        <Pressable onPress={() => markAllAsRead('admin')} hitSlop={8}>
          <Text className="text-sm font-semibold text-brand-700">모두 읽음</Text>
        </Pressable>
      </View>

      <FlatList
        data={adminNotifications}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 py-2"
        renderItem={({ item }) => <AdminNotificationRow notification={item} />}
        ListEmptyComponent={
          <View className="items-center px-8 py-16">
            <Text className="mb-2 text-4xl">🔔</Text>
            <Text className="text-center text-sm text-neutral-500">아직 도착한 알림이 없어요</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
