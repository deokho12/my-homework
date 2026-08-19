import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/hooks/useSession';
import { fetchMyFavorites } from '@/features/favorite/api/favoriteApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 내 찜 목록. `GET /me/favorites`.
 *
 * **로그인했을 때만 조회한다.** 찜은 계정에 딸린 리소스라 비로그인 요청은 서버에서
 * `401` 이 확정이고, 병원 카드는 앱의 거의 모든 목록에 깔려 있어 그 요청이 화면 수만큼 나간다.
 * 비로그인 상태에서 하트가 비어 보이는 것은 그대로다 (로그아웃 시 찜을 비우므로 결과가 같다).
 */
export function useFavorites() {
  const { isAuthenticated } = useSession();

  return useQuery({
    queryKey: queryKeys.favorites.mine,
    queryFn: fetchMyFavorites,
    enabled: isAuthenticated,
  });
}
