import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// vite.config.ts 의 react 플러그인과 '@' 별칭을 그대로 물려받는다.
// 그래서 별칭 설정이 두 곳으로 갈라지지 않는다.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  })
);
