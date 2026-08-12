import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],
  // configs['recommended-latest'] 는 eslintrc 형식(plugins 가 배열)이라 flat config 에서 못 쓴다.
  // flat 하위의 것을 써야 한다.
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',

      // 이 저장소는 의도적으로 안 쓰는 인자·타입 파라미터에 밑줄을 붙이는 관례가 있다
      // (primitives 가 react-native 의 시그니처를 유지하려고 받기만 하는 prop 들).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // react-hooks v7 의 React Compiler 계열 규칙. 정확성이 아니라 순수성/성능 권고라
      // error 로 두면 기존 코드 전체가 막힌다. warn 으로 남겨 리팩터링 과정에서 줄여 나간다.
      // rules-of-hooks 와 exhaustive-deps 는 실제 버그를 잡으므로 error 로 유지한다.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },

  {
    // 이 두 레이어는 react-native-web / expo-router 의 동작을 의도적으로 재현한다.
    // Pressable 이 role="button" 을 붙인 div 를 렌더하는 것, RouterBridge 가 모듈 변수에
    // navigate 를 심는 것 등은 버그가 아니라 사양이다. (AGENTS.md — 이 레이어는 수정 대상이 아니다)
    files: ['src/primitives/**', 'src/navigation/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/globals': 'off',
    },
  },

  {
    // Kakao Maps SDK 는 타입 정의를 제공하지 않는다.
    files: ['src/components/map/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  }
);
