import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createCommunityPost, type CommunityPostCreateInput } from '@/features/community/api/communityApi';
import { queryKeys } from '@/lib/queryKeys';

/** 질문 등록. `POST /community/posts`. 등록 직후 목록으로 돌아가므로 목록 캐시를 깬다. */
export function useCreateCommunityPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CommunityPostCreateInput) => createCommunityPost(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts.all });
    },
  });
}
