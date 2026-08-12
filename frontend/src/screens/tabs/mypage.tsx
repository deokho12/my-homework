import { router, useFocusEffect } from '@/navigation';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { FlatList, Pressable, Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { HospitalCard } from '@/features/hospital/components/HospitalCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSession } from '@/features/auth/hooks/useSession';
import { useAuthStore } from '@/store/useAuthStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { getHospitalById } from '@/store/useHospitalStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
import type { Hospital } from '@/types/domain';
import { showAlert } from '@/utils/alert';

const SCROLL_SHADOW_THRESHOLD = 8;

function AuthCard() {
  const user = useAuthStore((state) => state.user);
  const logOut = useAuthStore((state) => state.logOut);

  if (!user) {
    return (
      <View className="mb-6 rounded-2xl border border-neutral-100 bg-white p-5">
        <Text className="mb-1 text-base font-bold text-neutral-900">로그인이 필요해요</Text>
        <Text className="mb-4 text-sm text-neutral-500">
          로그인하면 찜한 병원과 상담 신청 내역을 확인할 수 있어요
        </Text>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <PrimaryButton label="로그인" onPress={() => router.push('/auth/login')} />
          </View>
          <View className="flex-1">
            <PrimaryButton
              label="회원가입"
              variant="outline"
              onPress={() => router.push('/auth/signup')}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-6 rounded-2xl border border-neutral-100 bg-white p-5">
      <Text className="mb-1 text-base font-bold text-neutral-900">{user.name}님, 안녕하세요</Text>
      <Text className="mb-4 text-sm text-neutral-500">{user.email}</Text>
      <Pressable
        onPress={() =>
          showAlert('로그아웃', '로그아웃할까요?', [
            { text: '취소', style: 'cancel' },
            {
              text: '로그아웃',
              style: 'destructive',
              // 서버 세션 폐기(`POST /auth/logout`)를 기다리지 않고 화면은 즉시 반응한다 —
              // 로컬 상태는 스토어가 성공·실패와 무관하게 비운다.
              onPress: () => {
                void logOut();
              },
            },
          ])
        }
        className="items-center rounded-xl border border-neutral-200 py-3"
      >
        <Text className="text-sm font-semibold text-neutral-600">로그아웃</Text>
      </Pressable>
    </View>
  );
}

function NotificationLinkRow() {
  const unreadCount = useNotificationStore(
    (state) => state.notifications.filter((n) => n.audience === 'user' && !n.isRead).length
  );

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      className="mb-6 flex-row items-center justify-between rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-lg">🔔</Text>
        <Text className="text-sm font-semibold text-neutral-800">알림함</Text>
      </View>
      <View className="flex-row items-center gap-2">
        {unreadCount > 0 ? (
          <View className="min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5">
            <Text className="text-[11px] font-bold text-white">{unreadCount}</Text>
          </View>
        ) : null}
        <Text className="text-neutral-300">›</Text>
      </View>
    </Pressable>
  );
}

export default function MyPageScreen() {
  const { user, isHospitalAdmin } = useSession();
  const hospitalIds = useFavoritesStore((state) => state.hospitalIds);
  const favoriteHospitals = hospitalIds
    .map((id) => getHospitalById(id))
    .filter((hospital): hospital is Hospital => Boolean(hospital));
  const setScrolled = useScrollShadowStore((state) => state.setScrolled);
  const scrollOffsetRef = useRef(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = offsetY;
    setScrolled(offsetY > SCROLL_SHADOW_THRESHOLD);
  };

  useFocusEffect(
    useCallback(() => {
      setScrolled(scrollOffsetRef.current > SCROLL_SHADOW_THRESHOLD);
    }, [setScrolled])
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={['top']}>
      <FlatList
        data={user ? favoriteHospitals : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HospitalCard hospital={item} />}
        contentContainerClassName="px-5 pb-8 pt-3"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <Text className="mb-4 text-2xl font-extrabold text-neutral-900">마이페이지</Text>
            <AuthCard />
            {user ? <NotificationLinkRow /> : null}
            {user ? <Text className="mb-3 text-lg font-bold text-neutral-900">찜한 병원</Text> : null}
          </View>
        }
        ListEmptyComponent={
          user ? (
            <View className="items-center px-8 py-12">
              <Text className="mb-2 text-4xl">🤍</Text>
              <Text className="text-center text-sm text-neutral-500">
                아직 찜한 병원이 없어요{'\n'}병원 카드의 하트를 눌러 찜해보세요
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          // 권한이 있는 계정에만 보여준다. 예전에는 로그인 여부와 무관하게 노출되어
          // 우연히 관리자 화면에 들어가는 경로가 됐다 (`docs/features/known-issues.md` 🔴).
          isHospitalAdmin ? (
            <Pressable onPress={() => router.push('/admin')} className="mt-6 items-center py-4">
              <Text className="text-xs text-neutral-400 underline">관리자 페이지</Text>
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
