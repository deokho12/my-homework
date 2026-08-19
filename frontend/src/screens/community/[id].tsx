import { Stack, useLocalSearchParams } from '@/navigation';
import { useEffect, useRef } from 'react';
import { ScrollView, Text, View } from '@/primitives';
import { SafeAreaView } from '@/primitives';

import { Badge } from '@/components/Badge';
import { QueryState } from '@/components/QueryState';
import { containerClass } from '@/components/layout/Container';
import { useCommunityPost, useRecordPostView } from '@/features/community';
import { useProcedureMap } from '@/features/procedure';
import { isApiError } from '@/lib/apiClient';
import type { QAPost } from '@/types/domain';

/** 조회가 끝난 글 하나를 렌더한다 — `QueryState` 의 children 은 콜백이라 훅을 부를 수 없다. */
function CommunityPostView({ post }: { post: QAPost }) {
  const procedureMap = useProcedureMap();
  const procedure = procedureMap.get(post.procedureId);

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
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

export default function CommunityPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: post, error, isLoading, isError, isFetching, refetch } = useCommunityPost(id);
  const recordView = useRecordPostView();
  const hasCountedView = useRef(false);

  useEffect(() => {
    // 화면을 한 번 열 때 한 번만 센다. 조회수 집계는 `GET` 이 아니라 별도 호출이라
    // (캐시·프리페치·재시도가 조회수를 부풀리지 않는다) 여기서 명시적으로 부른다.
    // 실패는 삼킨다 — 집계가 안 됐다고 글을 못 읽게 만들 이유가 없다.
    if (id && !hasCountedView.current) {
      hasCountedView.current = true;
      recordView.mutate(id);
    }
  }, [id, recordView]);

  // 없는 글은 서버가 404 POST_NOT_FOUND 를 준다 — "다시 시도" 를 권할 에러가 아니라 빈 상태다.
  const notFound = isError && isApiError(error) && error.code === 'POST_NOT_FOUND';

  return (
    <>
      <Stack.Screen options={{ title: '질문 상세' }} />
      <QueryState
        isLoading={isLoading}
        isError={notFound ? false : isError}
        data={notFound ? null : post}
        onRetry={() => {
          void refetch();
        }}
        isRetrying={isError && isFetching}
        emptyState={{ title: '질문을 찾을 수 없어요' }}
        className="flex-1 bg-white"
      >
        {(loaded) => <CommunityPostView post={loaded} />}
      </QueryState>
    </>
  );
}
