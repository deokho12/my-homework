import { readCollection, writeCollection } from '@/lib/localCollection';

/**
 * 찜(즐겨찾기).
 *
 * **지금은 `lib/localCollection.ts`(localStorage)를 읽고 쓴다. 백엔드가 생기면 각 함수의
 * 본문만 `apiRequest('<경로>')` 로 갈아끼우면 되고, 시그니처와 화면 코드는 바뀌지 않는다.**
 *
 * | 함수 | 대응 엔드포인트 |
 * |---|---|
 * | `fetchMyFavorites` | `GET /me/favorites` |
 * | `addFavorite` | `PUT /me/favorites/{hospitalId}` |
 * | `removeFavorite` | `DELETE /me/favorites/{hospitalId}` |
 *
 * **`PUT`/`DELETE` 는 멱등이다.** 이미 찜한 병원에 다시 `addFavorite` 해도 성공이고 목록도
 * 그대로다 — 하트는 오탭이 잦고 낙관적 갱신이 같은 요청을 두 번 보낼 수 있어서다.
 *
 * **로컬 구현이 계약과 다른 점:** 계정 스코프가 없다. 브라우저 하나에 목록이 하나뿐이라
 * 로그인·로그아웃 때 저장소를 비워서(`clearCollection('favoriteHospitalIds')`, `store/useAuthStore.ts`)
 * 계정 간 유출만 막고 있다 (`docs/features/known-issues.md` 🔴 "다른 사람의 찜 목록이 보입니다").
 * **그 비우기는 엔드포인트가 없는 로컬 전용 조작이라 이 파일에 두지 않는다** — 여기에는 계약
 * 함수만 남겨 서버가 생기면 파일째 지울 수 있게 한다.
 */

/** openapi `FavoriteList`. `expand=hospital` 은 아직 어느 화면도 쓰지 않아 `hospitals` 를 두지 않는다. */
export interface FavoriteList {
  /** 최근에 찜한 것이 먼저. */
  hospitalIds: string[];
}

/** `GET /me/favorites`. */
export async function fetchMyFavorites(): Promise<FavoriteList> {
  // 사본을 돌려준다 — 저장된 배열을 그대로 주면 호출부의 `.sort()`·`.push()` 가 저장소를 조용히
  // 바꾸고, 서버 전환 뒤에는 같은 코드가 아무것도 바꾸지 않아 동작이 갈린다.
  return { hospitalIds: [...readCollection('favoriteHospitalIds')] };
}

/** `PUT /me/favorites/{hospitalId}`. 멱등 — 이미 찜한 병원이면 아무것도 하지 않는다. */
export async function addFavorite(hospitalId: string): Promise<void> {
  const current = readCollection('favoriteHospitalIds');

  if (current.includes(hospitalId)) return;

  writeCollection('favoriteHospitalIds', [hospitalId, ...current]);
}

/** `DELETE /me/favorites/{hospitalId}`. 멱등 — 찜하지 않은 병원이어도 성공이다. */
export async function removeFavorite(hospitalId: string): Promise<void> {
  const current = readCollection('favoriteHospitalIds');

  if (!current.includes(hospitalId)) return;

  writeCollection(
    'favoriteHospitalIds',
    current.filter((id) => id !== hospitalId)
  );
}
