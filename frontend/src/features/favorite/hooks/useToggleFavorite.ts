import { useMutation, useQueryClient } from '@tanstack/react-query';

import { addFavorite, removeFavorite } from '@/features/favorite/api/favoriteApi';
import { queryKeys } from '@/lib/queryKeys';

/**
 * 하트 토글. `PUT`/`DELETE /me/favorites/{hospitalId}`.
 *
 * 지금 상태(`isFavorite`)를 인자로 받는다 — 어느 방향으로 가야 하는지는 하트를 그리고 있는
 * 화면이 이미 알고 있고, 훅이 캐시를 다시 읽어 판단하면 같은 판정이 두 곳에 생긴다.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ hospitalId, isFavorite }: { hospitalId: string; isFavorite: boolean }) =>
      isFavorite ? removeFavorite(hospitalId) : addFavorite(hospitalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
    },
  });
}
