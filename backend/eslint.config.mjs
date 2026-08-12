import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * 프론트엔드(frontend/eslint.config.js)와 같은 계열로 맞춘다:
 * flat config + @eslint/js + typescript-eslint. 백엔드에는 React 관련 플러그인이
 * 필요 없으므로 그만큼만 뺐다.
 */
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', '.tmp-manual'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        module: 'writable',
        require: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // 서버 코드는 console 대신 Nest 의 Logger 를 쓴다. 로그 형식·레벨이
      // 섞이면 운영에서 검색이 안 된다.
      'no-console': 'error',

      // 빈 인터페이스/클래스는 Nest 모듈 클래스(`export class AppModule {}`)에서
      // 정상적인 패턴이다.
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },

  {
    // 시드·부트스트랩 CLI·Prisma 설정은 CLI 스크립트다. stdout 이 곧 UI 이므로 console 을 허용한다.
    files: ['prisma/**/*.ts', 'prisma.config.ts', 'src/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    // 테스트는 Prisma delegate 를 일부러 바꿔치기한다(헬스체크 실패 경로 재현).
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
