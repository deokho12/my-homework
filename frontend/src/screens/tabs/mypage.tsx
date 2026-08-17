import { router, useFocusEffect } from '@/navigation';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useFavorites } from '@/features/favorite';
import { HospitalCard } from '@/features/hospital/components/HospitalCard';
import { useUnreadNotificationCount } from '@/features/notification';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSession } from '@/features/auth/hooks/useSession';
import { useAuthStore } from '@/store/useAuthStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
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
  // 배지 전용 엔드포인트를 쓴다 — 숫자 하나 때문에 알림 목록 전체를 받아오지 않는다.
  const { data } = useUnreadNotificationCount('user');
  const unreadCount = data?.unreadCount ?? 0;

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

/**
 * 상담 신청 내역 진입점.
 *
 * 이 화면과 로그인 화면이 "상담 신청 내역을 확인할 수 있어요" 라고 안내해 왔는데
 * **가는 길이 없었다** (`docs/features/known-issues.md` 🟠). 이제 있다.
 */
function ConsultHistoryLinkRow() {
  return (
    <Pressable
      onPress={() => router.push('/me/consult-requests')}
      className="mb-6 flex-row items-center justify-between rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="flex-row items-center gap-2">
        <Text className="text-lg">📋</Text>
        <Text className="text-sm font-semibold text-neutral-800">상담 신청 내역</Text>
      </View>
      <Text className="text-neutral-300">›</Text>
    </Pressable>
  );
}

export default function MyPageScreen() {
  const { user, isHospitalAdmin } = useSession();
  // `expand=hospital` 로 병원 본문까지 한 번에 받는다. 예전에는 id 마다 병원을 따로
  // 조회해 항목 수만큼 요청이 나갔다.
  const { data: favorites, isPending: favoritesPending } = useFavorites('hospital');
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
        data={user ? (favorites?.hospitals ?? []) : []}
        keyExtractor={(hospital) => hospital.id}
        renderItem={({ item }) => <HospitalCard hospital={item} />}
        contentContainerClassName={cx(CONTAINER_PADDING, 'pb-8 pt-3')}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <Text className="mb-4 text-2xl font-extrabold text-neutral-900">마이페이지</Text>
            <AuthCard />
            {user ? <NotificationLinkRow /> : null}
            {user ? <ConsultHistoryLinkRow /> : null}
            {user ? <Text className="mb-3 text-lg font-bold text-neutral-900">찜한 병원</Text> : null}
          </View>
        }
        ListEmptyComponent={
          user ? (
            // 로딩 중에 "없어요" 를 단정하지 않는다 — 조회가 끝나기 전 빈 배열은
            // "찜이 없다" 가 아니라 "아직 모른다" 이다.
            favoritesPending ? (
              <View
                className="mb-4 h-40 w-full animate-pulse rounded-2xl bg-neutral-100"
                role="status"
                accessibilityLabel="찜한 병원 정보를 불러오는 중이에요"
              />
            ) : (
              <View className="items-center px-8 py-12">
                <Text className="mb-2 text-4xl">🤍</Text>
                <Text className="text-center text-sm text-neutral-500">
                  아직 찜한 병원이 없어요{'\n'}병원 카드의 하트를 눌러 찜해보세요
                </Text>
              </View>
            )
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
