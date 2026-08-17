import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addFavorite, fetchMyFavorites, removeFavorite } from '@/features/favorite/api/favoriteApi';
import type { FavoriteListResponse } from '@/features/favorite/api/favoriteApi';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * 내 찜 목록. **로그인하지 않았으면 요청하지 않는다** — 비로그인은 401 이 정상이라
 * 그걸 오류 화면으로 보여줄 이유가 없다. 그 상태의 찜은 빈 목록이다.
 */
export function useFavorites(expand?: 'hospital') {
  const isAuthenticated = useAuthStore((state) => state.user !== null);

  return useQuery({
    queryKey: queryKeys.favorites.list(expand ?? null),
    queryFn: () => fetchMyFavorites(expand),
    enabled: isAuthenticated,
  });
}

/** 찜한 병원 id 집합. 하트 아이콘이 이것만 본다. */
export function useFavoriteIds(): { ids: Set<string>; isPending: boolean } {
  const { data, isPending } = useFavorites();

  return { ids: new Set(data?.hospitalIds ?? []), isPending };
}

/**
 * 병원 하나에 대한 하트 상태와 토글.
 *
 * 카드와 상세 화면이 같은 것을 쓴다 — 두 곳이 각자 `isFavorite` 를 계산하면
 * "카드에서는 찜인데 상세에서는 아님" 같은 어긋남이 생긴다. 컴포넌트는 API 를
 * 직접 부르지 않는다 (`frontend/CLAUDE.md`).
 */
export function useFavoriteToggle(hospitalId: string): { isFavorite: boolean; toggle: () => void } {
  const { ids } = useFavoriteIds();
  const { mutate } = useToggleFavorite();
  const isFavorite = ids.has(hospitalId);

  return { isFavorite, toggle: () => mutate({ hospitalId, isFavorite }) };
}

/**
 * 하트 토글.
 *
 * **낙관적으로 갱신한다.** 하트는 누른 즉시 반응해야 하고, 서버 동작이 멱등이라
 * 실패해도 상태가 어긋나지 않는다. 실패하면 이전 캐시로 되돌린다.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ hospitalId, isFavorite }: { hospitalId: string; isFavorite: boolean }) =>
      isFavorite ? removeFavorite(hospitalId) : addFavorite(hospitalId),
    onMutate: async ({ hospitalId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.favorites.all });

      const previous = queryClient.getQueriesData<FavoriteListResponse>({
        queryKey: queryKeys.favorites.all,
      });

      queryClient.setQueriesData<FavoriteListResponse>({ queryKey: queryKeys.favorites.all }, (old) => {
        if (!old) return old;

        const hospitalIds = isFavorite
          ? old.hospitalIds.filter((id) => id !== hospitalId)
          : [hospitalId, ...old.hospitalIds];

        // `hospitals` 는 두 배열의 길이가 어긋나면 화면이 인덱스로 짝지을 수 없다.
        // 낙관적 단계에서는 제거만 반영하고, 추가는 서버 응답을 기다린다.
        const hospitals = old.hospitals?.filter((hospital) => hospitalIds.includes(hospital.id));

        return hospitals === undefined ? { hospitalIds } : { hospitalIds, hospitals };
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.favorites.all });
    },
  });
}
