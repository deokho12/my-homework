import { useQuery } from '@tanstack/react-query';

import { fetchCommunityPosts, type CommunityPostFilters } from '@/features/community/api/communityApi';
import { queryKeys } from '@/lib/queryKeys';

/** 커뮤니티 질문 목록. `GET /community/posts`. 최신순. */
export function useCommunityPosts(filters: CommunityPostFilters = {}) {
  return useQuery({
    queryKey: queryKeys.communityPosts.list(filters),
    queryFn: () => fetchCommunityPosts(filters),
  });
}
