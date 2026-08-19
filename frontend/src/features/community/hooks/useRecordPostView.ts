import { useMutation, useQueryClient } from '@tanstack/react-query';

import { recordPostView } from '@/features/community/api/communityApi';
import { queryKeys } from '@/lib/queryKeys';
import type { QAPost } from '@/types/domain';

/**
 * 조회수 집계. `POST /community/posts/{id}/views`.
 *
 * **`GET` 이 아니라 별도 호출인 이유:** 조회가 상태를 바꾸면 캐시·프리페치·재시도가 모두
 * 조회수를 부풀린다. 실패는 화면에 알리지 않는다 — 집계 실패로 글을 못 읽게 만들 이유가 없다.
 *
 * **상세는 무효화하지 않고 응답으로 직접 갱신한다.** 응답이 이미 새 `viewCount` 를 담고 있어
 * 상세를 다시 부를 이유가 없는데, 무효화하면 글 하나를 여는 동안 상세 `GET` 이 두 번 나간다
 * (지금은 로컬이라 공짜지만 서버 전환 뒤에는 실제 왕복이 된다). 목록 카드의 `조회 N` 은
 * 항목마다 값을 들고 있어 응답 하나로 고칠 수 없으므로 목록만 무효화한다.
 */
export function useRecordPostView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recordPostView(id),
    onSuccess: ({ postId, viewCount }) => {
      queryClient.setQueryData(queryKeys.communityPosts.detail(postId), (previous: QAPost | undefined) =>
        previous ? { ...previous, viewCount } : previous
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts.list() });
    },
  });
}
