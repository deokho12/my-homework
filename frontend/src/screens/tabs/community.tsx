import { router, useFocusEffect } from '@/navigation';
import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from '@/primitives';
import { FlatList, Pressable, Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { getProcedureById } from '@/mocks/fixtures/procedures';
import { useCommunityStore } from '@/store/useCommunityStore';
import { useScrollShadowStore } from '@/store/useScrollShadowStore';
import type { QAPost } from '@/types/domain';

const SCROLL_SHADOW_THRESHOLD = 8;

function PostRow({ post }: { post: QAPost }) {
  const procedure = getProcedureById(post.procedureId);

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
        <Text className="text-xs text-neutral-400">답변 {post.answers.length}</Text>
        <Text className="text-xs text-neutral-400">조회 {post.viewCount}</Text>
      </View>
    </Pressable>
  );
}

export default function CommunityScreen() {
  const posts = useCommunityStore((state) => state.posts);
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
      <View className="flex-row items-center justify-between px-5 pb-2 pt-3">
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

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostRow post={item} />}
        contentContainerClassName="px-5 pb-8 pt-3"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
}
