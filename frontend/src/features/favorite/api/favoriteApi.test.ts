import { describe, expect, it } from 'vitest';

import {
  addFavorite,
  fetchMyFavorites,
  removeFavorite,
} from '@/features/favorite/api/favoriteApi';

/** 삭제된 `useFavoritesStore` 의 동작을 이 계층으로 옮겨 고정한다. */
describe('favoriteApi', () => {
  it('처음에는 빈 목록이다', async () => {
    expect(await fetchMyFavorites()).toEqual({ hospitalIds: [] });
  });

  it('찜하면 목록에 들어간다', async () => {
    await addFavorite('h1');

    expect((await fetchMyFavorites()).hospitalIds).toEqual(['h1']);
  });

  it('최근에 찜한 것이 먼저 온다 (계약의 순서 규약)', async () => {
    await addFavorite('h1');
    await addFavorite('h2');

    expect((await fetchMyFavorites()).hospitalIds).toEqual(['h2', 'h1']);
  });

  it('addFavorite 은 멱등이다 — 두 번 불러도 중복되지 않는다', async () => {
    await addFavorite('h1');
    await addFavorite('h1');

    expect((await fetchMyFavorites()).hospitalIds).toEqual(['h1']);
  });

  it('찜을 해제하면 목록에서 빠진다', async () => {
    await addFavorite('h1');
    await addFavorite('h2');
    await removeFavorite('h1');

    expect((await fetchMyFavorites()).hospitalIds).toEqual(['h2']);
  });

  it('removeFavorite 은 멱등이다 — 찜하지 않은 병원이어도 실패하지 않는다', async () => {
    await expect(removeFavorite('h9')).resolves.toBeUndefined();
    expect((await fetchMyFavorites()).hospitalIds).toEqual([]);
  });

  it('돌려주는 배열은 사본이다 — 정렬해도 저장소가 바뀌지 않는다', async () => {
    await addFavorite('h1');
    await addFavorite('h2');

    // 호출부가 응답을 제자리 정렬하는 것은 흔한 일이다. 저장된 배열을 그대로 돌려주면
    // 그 한 줄이 저장소를 바꾸고, 서버 전환 뒤에는 같은 코드가 아무것도 바꾸지 않는다.
    (await fetchMyFavorites()).hospitalIds.sort();

    expect((await fetchMyFavorites()).hospitalIds).toEqual(['h2', 'h1']);
  });
});
