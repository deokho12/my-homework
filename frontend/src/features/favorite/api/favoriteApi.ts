import { apiRequest } from '@/lib/apiClient';
import type { Hospital } from '@/types/domain';

/**
 * 찜 API. 서버가 계정별로 저장한다 — 예전에는 브라우저에 저장해서 로그아웃해도 남았다.
 *
 * 추가·삭제가 **둘 다 멱등**이라 하트를 두 번 눌러도 결과가 같다. 그래서 낙관적 갱신이
 * 안전하다(실패해도 서버 상태가 요청과 어긋나지 않는다).
 */

export interface FavoriteListResponse {
  /** 최근에 찜한 것이 먼저. */
  hospitalIds: string[];
  /** `expand=hospital` 일 때만. `hospitalIds` 와 같은 순서다. */
  hospitals?: Hospital[];
}

/**
 * `expand` 를 주지 않으면 id 배열만 온다. 하트만 그리는 화면이 병원 본문 N개를
 * 받지 않게 하려는 것이다.
 */
export async function fetchMyFavorites(expand?: 'hospital'): Promise<FavoriteListResponse> {
  const query = expand === undefined ? '' : `?expand=${expand}`;

  return apiRequest<FavoriteListResponse>(`/me/favorites${query}`);
}

export async function addFavorite(hospitalId: string): Promise<void> {
  await apiRequest<void>(`/me/favorites/${encodeURIComponent(hospitalId)}`, { method: 'PUT' });
}

export async function removeFavorite(hospitalId: string): Promise<void> {
  await apiRequest<void>(`/me/favorites/${encodeURIComponent(hospitalId)}`, { method: 'DELETE' });
}
