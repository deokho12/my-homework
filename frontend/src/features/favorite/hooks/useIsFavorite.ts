import { useFavorites } from '@/features/favorite/hooks/useFavorites';

/**
 * 하트 표시용. 목록이 아직 도착하지 않았으면 `false` 다 — "찜하지 않았다"가 아니라
 * "아직 모른다"지만, 하트는 두 상태를 구분해 보여줄 자리가 없다(빈 하트가 기본 모양이다).
 */
export function useIsFavorite(hospitalId: string): boolean {
  const { data } = useFavorites();

  return data?.hospitalIds.includes(hospitalId) ?? false;
}
