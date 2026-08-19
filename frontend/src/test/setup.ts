import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { resetCollectionCache } from '@/lib/localCollection';

afterEach(() => {
  cleanup();
});

// 아직 서버가 없는 도메인의 저장소(`lib/localCollection.ts`)와 토큰이 localStorage 를 쓴다.
// 테스트 간에 상태가 새지 않도록 매번 비운다.
//
// **메모리 캐시도 함께 버려야 한다.** localStorage 만 비우면 `readCollection` 이
// 앞 테스트가 캐시에 남긴 배열을 그대로 돌려준다.
beforeEach(() => {
  window.localStorage.clear();
  resetCollectionCache();
});
