import { useQuery } from '@tanstack/react-query';

import { fetchCommunityPostById } from '@/features/community/api/communityApi';
import { queryKeys } from '@/lib/queryKeys';

/** 질문 상세(답변 포함). `GET /community/posts/{id}`. */
export function useCommunityPost(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.communityPosts.detail(id ?? ''),
    queryFn: () => fetchCommunityPostById(id as string),
    enabled: Boolean(id),
  });
}
