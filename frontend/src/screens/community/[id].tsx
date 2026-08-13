import { Stack, useLocalSearchParams } from '@/navigation';
import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { containerClass } from '@/components/layout/Container';
import { useProcedureMap } from '@/features/procedure';
import { useCommunityStore } from '@/store/useCommunityStore';

export default function CommunityPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = useCommunityStore((state) => state.posts.find((p) => p.id === id));
  const incrementView = useCommunityStore((state) => state.incrementView);
  const procedureMap = useProcedureMap();
  const hasCountedView = useRef(false);

  useEffect(() => {
    if (id && !hasCountedView.current) {
      hasCountedView.current = true;
      incrementView(id);
    }
  }, [id, incrementView]);

  if (!post) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">질문을 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  const procedure = procedureMap.get(post.procedureId);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: '질문 상세' }} />
      <ScrollView contentContainerClassName={containerClass('prose', 'pb-8 pt-4')}>
        <View className="mb-2 flex-row items-center gap-1.5">
          {procedure ? <Badge label={procedure.name} tone="brand" /> : null}
          <Text className="text-xs text-neutral-400">{post.createdAt}</Text>
        </View>
        <Text className="mb-2 text-xl font-extrabold text-neutral-900">{post.title}</Text>
        <Text className="mb-1 text-sm text-neutral-400">
          {post.authorName} · 조회 {post.viewCount}
        </Text>
        <Text className="mb-6 text-[15px] leading-6 text-neutral-700">{post.content}</Text>

        <View className="mb-3 h-px bg-neutral-100" />

        <Text className="mb-3 text-base font-bold text-neutral-900">답변 {post.answers.length}</Text>

        {post.answers.length === 0 ? (
          <Text className="text-sm text-neutral-400">아직 답변이 없어요. 조금만 기다려주세요!</Text>
        ) : (
          post.answers.map((answer) => (
            <View
              key={answer.id}
              className={`mb-3 rounded-xl border p-3.5 ${
                answer.isDentist ? 'border-brand-200 bg-brand-50' : 'border-neutral-100'
              }`}
            >
              <View className="mb-1.5 flex-row items-center gap-1.5">
                <Text className="text-sm font-semibold text-neutral-800">{answer.authorName}</Text>
                {answer.isDentist ? <Badge label="치과의사 답변" tone="brand" /> : null}
                <Text className="text-xs text-neutral-400">{answer.createdAt}</Text>
              </View>
              <Text className="text-sm leading-5 text-neutral-700">{answer.content}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
