import { router, useFocusEffect } from '@/navigation';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { FlatList, Pressable, Text, View, cx } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { QueryState } from '@/components/QueryState';
import { CONTAINER_PADDING } from '@/components/layout/Container';
import { useCommunityPosts, type QAPostSummary } from '@/features/community';
import { useProcedureMap } from '@/features/procedure';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';

const SCROLL_SHADOW_THRESHOLD = 8;

/**
 * 이 화면에는 페이지네이션 UI 가 없다. 계약이 허용하는 상한(`pageSize` 최대 100)까지
 * 한 번에 받아 예전처럼 전부 그린다. 페이지 이동 UI 가 생기면 이 상수는 사라진다.
 */
const LIST_PAGE_SIZE = 100;

function PostRow({ post }: { post: QAPostSummary }) {
  const procedureMap = useProcedureMap();
  const procedure = procedureMap.get(post.procedureId);

  return (
    <Pressable
      onPress={() => router.push(`/community/${post.id}`)}
      className="mb-3 rounded-2xl border border-neutral-100 bg-white p-4"
    >
      <View className="mb-2 flex-row items-center gap-1.5">
        {procedure ? <Badge label={procedure.name} tone="brand" /> : null}
        <Text className="text-xs text-neutral-400">{post.createdAt}</Text>
      </View>
      <Text className="mb-1 text-base font-bold text-neutral-900" numberOfLines={1}>
        {post.title}
      </Text>
      <Text className="mb-2 text-sm text-neutral-500" numberOfLines={2}>
        {post.content}
      </Text>
      <View className="flex-row gap-3">
        <Text className="text-xs text-neutral-400">답변 {post.answerCount}</Text>
        <Text className="text-xs text-neutral-400">조회 {post.viewCount}</Text>
      </View>
    </Pressable>
  );
}

export default function CommunityScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useCommunityPosts({ pageSize: LIST_PAGE_SIZE });
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
      <View className={cx(CONTAINER_PADDING, 'flex-row items-center justify-between pb-2 pt-3')}>
        <View>
          <Text className="text-2xl font-extrabold text-neutral-900">커뮤니티</Text>
          <Text className="mt-1 text-sm text-neutral-500">궁금한 점을 물어보고 답변을 받아보세요</Text>
        </View>
        <Pressable
          onPress={() => router.push('/community/new')}
          className="rounded-full bg-brand-600 px-4 py-2.5"
        >
          <Text className="text-sm font-semibold text-white">질문하기</Text>
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
        isEmpty={(page) => page.items.length === 0}
        emptyState={{ title: '아직 등록된 질문이 없어요', description: '첫 질문을 남겨보세요' }}
      >
        {(page) => (
          <FlatList
            data={page.items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PostRow post={item} />}
            contentContainerClassName={cx(CONTAINER_PADDING, 'pb-8 pt-3')}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        )}
      </QueryState>
    </SafeAreaView>
  );
}
