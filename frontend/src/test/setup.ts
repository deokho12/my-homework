import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// 목 백엔드와 Zustand persist 가 모두 localStorage 를 쓴다.
// 테스트 간에 상태가 새지 않도록 매번 비운다.
beforeEach(() => {
  window.localStorage.clear();
});
