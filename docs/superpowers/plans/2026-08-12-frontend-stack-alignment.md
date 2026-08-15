# Frontend 스택 정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `frontend/`의 코드를 `frontend/CLAUDE.md`가 선언한 스택(feature-based 구조 + TanStack Query + React Hook Form + Zod)에 실제로 맞추고, 그 과정에서 발견된 인가 누락·비반응형 스토어 읽기 결함을 제거한다.

**Architecture:** `src/data/`의 정적 목 데이터를 `src/mocks/`의 **비동기 목 백엔드 계층**으로 승격시킨다. 각 feature의 `api/`가 이 계층을 호출하고, TanStack Query가 그 위에서 캐시·로딩·에러·무효화를 담당한다. Zustand는 서버성 데이터를 모두 내려놓고 클라이언트 전역 상태(세션, 찜, UI)만 보유한다. 라우트 진입점은 `pages/`로 옮기고 `screens/`는 삭제한다. 이 순서가 중요한 이유: 목 백엔드가 비동기가 되는 순간 loading/error 상태가 실재하게 되므로, TanStack Query 도입이 실제 서버가 없는 지금도 의미를 갖고, 나중에 `api/` 파일 내부만 HTTP로 바꾸면 화면은 그대로 동작한다.

**Tech Stack:** React 19.2 · TypeScript 5.7 · Vite 6 · React Router 7 · TanStack Query 5 · Zustand 5 · React Hook Form 7 · Zod 3 · Tailwind 3 · Vitest + React Testing Library

---

## Global Constraints

- **작업 디렉토리는 항상 `frontend/`다.** 모든 명령은 `cd frontend` 상태를 전제한다.
- **Node 24 LTS 이상이 필요하다.** 계획 작성 시점에 이 머신에는 Node가 설치되어 있지 않았다. Task 0에서 설치를 확인하지 못하면 이후 모든 Task는 진행 불가다.
- **경로 별칭은 `@/` → `src/`다.** `tsconfig.json`과 `vite.config.ts`에 이미 설정되어 있으므로 변경하지 않는다. 파일을 `src/` 안에서 옮기면 `@/` 접두사는 유지되고 뒷부분만 바뀐다.
- **`src/primitives/`와 `src/navigation/`은 이 계획에서 건드리지 않는다.** 각각 react-native-web과 expo-router의 동작을 의도적으로 재현한 레이어다(`AGENTS.md`). 화면을 옮길 때 import 경로도 그대로 유지한다.
- **`useHospitalStore` 는 Task 3 이후 `mockDb` 에 위임한다** (`persist` 제거, 액션이 `mockDb.write` + `queryClient.invalidateQueries`). 관리자 화면이 아직 이 스토어에 쓰고 상세 화면은 `useQuery` 로 읽기 때문에, 저장소를 하나로 두지 않으면 관리자 수정이 상세에 반영되지 않는다. **이 스토어와 `@/app/providers` import 는 Task 12 에서 관리자 화면이 `hospitalApi` mutation 을 쓰게 되면 함께 삭제한다.** Task 12 의 완료 조건에 포함된다.
- **`persist` 스토리지 키를 새로 만들 때 접두사는 `molarmolar-`다.** 기존 키(실제 값 확인 완료): `molarmolar-auth`, `molarmolar-hospitals`, `molarmolar-consult-requests`, `molarmolar-community-posts`, `molarmolar-doctors`, `molarmolar-favorites`, `molarmolar-notifications`.
- **커뮤니티 글의 도메인 타입은 `QAPost`다** (`QaPost`가 아니다). 필드는 `title` · `content` · `procedureId` · `authorName` · `createdAt` · `viewCount` · `answers`. **본문 필드는 `content`이며 `body`가 아니다.**
- **알림 audience 타입은 `domain.ts`의 `NotificationAudience`를 쓴다.** feature 안에서 새로 선언하지 않는다. 알림 id 접두사는 기존 코드와 같이 `notif-`다.
- **기존 localStorage 데이터를 깨뜨리지 않는다.** 이미 앱을 써 본 브라우저에는 위 키에 데이터가 있다. 목 백엔드로 옮길 때 최초 1회 읽어서 이관한다(Task 1).
- **도메인 타입의 단일 출처는 `src/types/domain.ts`다.** feature 안에 도메인 타입을 재선언하지 않는다. feature 고유의 파생 타입(폼 입력값, 필터 상태 등)만 `features/{f}/types.ts`에 둔다.
- **`any` 금지.** 예외는 `src/components/map/KakaoMap.tsx`의 외부 Kakao SDK 전역 객체뿐이며, 그 파일에만 `eslint-disable` 주석으로 국소 허용한다.
- **커밋 메시지는 Conventional Commits.** 기존 히스토리와 동일한 형식: `feat(frontend): ...`, `fix(frontend): ...`, `refactor(frontend): ...`, `chore: ...`.
- **매 Task 종료 시 게이트:** `npm run lint && npm run typecheck && npm run test:run && npm run build` 전부 통과해야 커밋한다. 하나라도 실패하면 다음 Task로 넘어가지 않는다.

### 화면 이관 레시피

Task 3 이후 화면을 `screens/` → `pages/`로 옮길 때 매번 이 절차를 그대로 적용한다. Task별로 대상 파일만 다르다.

1. `src/screens/<경로>.tsx` 파일을 `src/pages/<PascalCase 이름>Page.tsx`로 `git mv` 한다.
   - `screens/tabs/index.tsx` → `pages/HomePage.tsx`
   - `screens/hospital/[id].tsx` → `pages/HospitalDetailPage.tsx`
   - `screens/admin/consultations/[id].tsx` → `pages/admin/AdminConsultationDetailPage.tsx`
2. default export 함수 이름을 파일명과 일치시킨다(`HospitalDetailPage`).
3. 페이지 안에서 하는 일을 셋으로 줄인다: **라우트 파라미터 읽기 · feature 훅 호출 · 결과를 feature 컴포넌트에 전달.** 필터·정렬·집계 로직이 남아 있으면 해당 feature의 `hooks/`로 옮긴다.
4. `useState` + 목데이터 직접 참조를 feature 훅(`useXxx()`)으로 교체한다. `@/data/*`, `@/mocks/*` 직접 import는 페이지에 남기지 않는다.
5. **`QueryState` 를 쓴다.** 상태 문구·레이아웃을 페이지마다 직접 분기하지 않는다. Task 3 에서 만든 공용 컴포넌트다:

```tsx
<QueryState
  isLoading={isLoading}
  isError={isError}
  isRetrying={isError && isFetching}
  data={hospital}
  onRetry={() => { void refetch(); }}
  emptyState={{ title: '병원 정보를 찾을 수 없어요' }}
  className="flex-1 bg-white"
>
  {(hospital) => <HospitalDetailView hospital={hospital} />}
</QueryState>
```

   - **`isPending` 이 아니라 `isLoading` 을 넘긴다.** `isPending` 은 "데이터 없음"만 뜻하므로 `enabled: false` 인 쿼리는 fetch 를 시작하지 않은 채로도 true 다 → 로딩 화면에 영구히 갇힌다.
   - 로딩 문구 `불러오는 중이에요` 는 `sr-only` 다. 화면에는 200ms 이후에만 스피너가 뜬다(목 지연 180ms 라 목 환경에서는 보이지 않는 것이 의도).
   - **필터링 결과 0건은 `QueryState` 에 넣지 않는다.** 쿼리는 성공했고 데이터도 있는 상태이므로, success 분기 안에서 `<EmptyState variant="inline" title="조건에 맞는 병원이 없어요" />` 를 직접 렌더한다.
6. **페이지 / View 로 나눈다.** `children` 은 콜백이라 그 안에서 훅을 호출할 수 없다 — `useDoctorsByHospital`, `useReviews`, RHF 의 `useForm` 이 필요한 화면은 전부 이 벽에 부딪힌다.
   - `src/pages/XxxPage.tsx` — 파라미터 읽기 + feature 훅 + `QueryState`. 그 외 로직 없음
   - `src/features/{f}/components/XxxView.tsx` — 로드된 데이터를 prop 으로 받아 렌더. 파생 로직·`useState`·핸들러가 여기 있고, **훅을 자유롭게 호출할 수 있다**
7. `src/App.tsx`의 `ROUTES`에서 해당 import와 `element`를 새 페이지로 바꾼다. `path`와 `options`는 **바꾸지 않는다.**
8. 렌더 테스트를 작성한다(Task 3의 예시 형식). 최소 loading / success / not-found / **에러 + 재시도** 네 경로.
9. **레시피 4번의 예외:** 정적 마스터 데이터(`fixtures/procedures`, `fixtures/promotions`, `fixtures/reviews`)의 직접 import 는 Task 11 까지 허용한다. 페이지에 남기지 않는다는 규칙은 스토어·목 DB 조회에 적용된다.

---

## Task 0: 개발 도구 설치와 검증 게이트 구축

이 Task의 산출물은 "이후 모든 Task가 자기 자신을 검증할 수 있는 상태"다. 여기서 린트·테스트 러너가 없으면 나머지 계획은 검증 없는 편집이 된다.

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/eslint.config.js`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/smoke.test.tsx`
- Modify: `frontend/.gitignore` (없으면 확인만)

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces: `npm run lint`, `npm run test`, `npm run test:run`, `npm run typecheck`, `npm run build` 스크립트. 이후 모든 Task가 이 5개를 게이트로 쓴다.

- [ ] **Step 1: Node 설치 확인**

```powershell
node --version
npm --version
```

Expected: `v24.x` 이상, npm `10.x` 이상.

없으면 설치하고 **터미널을 새로 연다**(PATH 갱신 필요):

```powershell
winget install OpenJS.NodeJS.LTS
```

- [ ] **Step 2: 기존 의존성 설치 후 현재 상태 확인**

```bash
cd frontend
npm install
npm run typecheck
npm run build
```

Expected: 둘 다 통과. **실패하면 여기서 멈추고 원인을 먼저 보고한다** — 기존 코드가 이미 깨져 있다면 이 계획의 전제(동작하는 앱을 리팩터링한다)가 틀린 것이므로 계획을 수정해야 한다.

- [ ] **Step 3: 런타임 의존성 추가**

```bash
npm install @tanstack/react-query@^5 react-hook-form@^7 zod@^3 @hookform/resolvers@^3
```

- [ ] **Step 4: 개발 의존성 추가**

```bash
npm install -D vitest@^3 jsdom @vitejs/plugin-react \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  eslint@^9 typescript-eslint@^8 eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
  @tanstack/eslint-plugin-query prettier
```

- [ ] **Step 5: Vitest 설정 작성**

`frontend/vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
```

`frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// 목 백엔드와 Zustand persist가 모두 localStorage를 쓴다.
// 테스트 간 상태가 새지 않게 매번 비운다.
beforeEach(() => {
  window.localStorage.clear();
});
```

- [ ] **Step 6: ESLint flat config 작성**

`frontend/eslint.config.js`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import pluginQuery from '@tanstack/eslint-plugin-query';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginQuery.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: {
      // 이 프로젝트에는 tsconfig.json 하나만 있다 (tsconfig.app.json 은 없다).
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // primitives/ 는 react-native-web 의 DOM 출력을 의도적으로 재현하므로
      // role="button" 을 붙인 div 등에 대한 a11y 규칙을 여기서만 끈다.
      'jsx-a11y/no-static-element-interactions': 'off',
    },
  },
  {
    // 이 레이어는 외부 SDK/RNW 재현 코드라 규칙을 완화한다.
    files: ['src/primitives/**', 'src/navigation/**', 'src/components/map/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  }
);
```

`tsconfig.app.json`이 없다면 `tsconfig.json`을 가리키도록 `project` 값을 바꾼다. Step 8에서 실제로 확인한다.

- [ ] **Step 6b: tsconfig의 include에 새 설정 파일 추가**

현재 `tsconfig.json`의 `include`는 `["src", "vite.config.ts"]`라서 새로 만든 `vitest.config.ts`가 타입 검사 대상에서 빠진다. 추가한다:

```json
"include": ["src", "vite.config.ts", "vitest.config.ts"]
```

`lib`은 `["ES2022", "DOM", "DOM.Iterable"]`이고 `strict: true`다. **`lib`을 올리지 않는다** — ES2023 이상 메서드(`Array.prototype.with`, `toSorted` 등)를 쓰지 않는 것으로 대응한다.

- [ ] **Step 7: package.json 스크립트 추가**

`frontend/package.json`의 `scripts`를 다음으로 만든다(`dev`/`build`/`preview`/`typecheck`는 기존 값 유지):

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  }
}
```

- [ ] **Step 8: 러너가 실제로 도는지 증명하는 스모크 테스트**

`frontend/src/test/smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrimaryButton } from '@/components/PrimaryButton';

describe('테스트 환경', () => {
  it('jsdom에서 기존 컴포넌트를 렌더하고 @/ 별칭을 해석한다', () => {
    render(<PrimaryButton label="상담 신청하기" onPress={() => {}} />);
    expect(screen.getByText('상담 신청하기')).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: 전체 게이트 실행**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: `test:run`은 1 passed. `lint`는 기존 코드에서 위반이 나올 수 있다 — **이 Task에서는 규칙을 끄지 말고**, 위반 목록을 그대로 기록해 둔다. `no-explicit-any`는 `TopNavBar.tsx:43`, `KakaoMap.tsx:10,33`에서 나올 것이 예상된다. `KakaoMap`은 Step 6의 완화 대상이라 `warn`으로 떨어지고, `TopNavBar.tsx:43`은 error로 남는다. 이건 Step 10에서 고친다.

- [ ] **Step 10: lint가 잡아낸 기존 위반 수정**

`src/components/TopNavBar.tsx:43` — `'sticky' as any`를 제거한다. `RNStyle`에 `position`이 좁게 선언되어 있어서 생긴 캐스트이므로, 캐스트 대신 `src/primitives/style.ts`의 `position` 타입에 `'sticky'`를 추가한다:

```ts
// src/primitives/style.ts 의 position 필드
position?: 'absolute' | 'relative' | 'static' | 'fixed' | 'sticky';
```

그리고 `TopNavBar.tsx:43`:

```tsx
style={{ position: 'sticky', top: 0, zIndex: 50 }}
```

`lint`에 남는 나머지 위반은 전부 목록으로 남기고, 해당 파일을 다루는 Task에서 고친다. 규칙 자체를 끄지 않는다.

- [ ] **Step 11: 커밋**

```bash
git add frontend/package.json frontend/package-lock.json frontend/eslint.config.js \
  frontend/vitest.config.ts frontend/src/test frontend/src/primitives/style.ts \
  frontend/src/components/TopNavBar.tsx
git commit -m "chore(frontend): add ESLint, Vitest, and stack dependencies

TanStack Query, React Hook Form, Zod 를 설치하고 lint/test 게이트를 만든다.
CLAUDE.md 가 선언한 스택으로 코드를 옮기기 위한 사전 작업."
```

---

## Task 1: 비동기 목 백엔드 계층

`src/data/`의 정적 배열을 **비동기 API처럼 행동하는 계층**으로 승격시킨다. 이게 이 계획 전체의 토대다. 여기서 영속화 책임이 Zustand `persist`에서 목 백엔드로 넘어온다.

**Files:**
- Move: `src/data/*.ts` → `src/mocks/fixtures/*.ts` (11개 파일, 내용 변경 없음)
- Create: `src/mocks/db.ts`
- Create: `src/mocks/latency.ts`
- Create: `src/mocks/db.test.ts`
- Modify: `@/data`를 import하는 모든 파일의 경로를 `@/mocks/fixtures`로 (Step 3에서 목록화)

**Interfaces:**
- Consumes: Task 0의 검증 게이트
- Produces:
  - `mockDb.read<K>(table: K): TableRow<K>[]` — 동기 읽기(내부용)
  - `mockDb.write<K>(table: K, rows: TableRow<K>[]): void` — localStorage에 즉시 영속
  - `type MockTable = 'hospitals' | 'doctors' | 'consultRequests' | 'communityPosts' | 'notifications'`
  - `delay(): Promise<void>` — 모든 api 함수가 앞에 붙이는 인위적 지연

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/mocks/db.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { mockDb } from '@/mocks/db';

describe('mockDb', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockDb.reset();
  });

  it('처음 읽으면 fixture seed를 돌려준다', () => {
    const hospitals = mockDb.read('hospitals');
    expect(hospitals.length).toBeGreaterThan(0);
  });

  it('write 한 값이 다음 read 에 보인다', () => {
    const before = mockDb.read('hospitals');
    mockDb.write('hospitals', before.slice(0, 1));
    expect(mockDb.read('hospitals')).toHaveLength(1);
  });

  it('write 한 값이 localStorage 에 남아 reset 후에도 유지된다', () => {
    mockDb.write('hospitals', mockDb.read('hospitals').slice(0, 2));
    mockDb.reset(); // 메모리 캐시만 비운다
    expect(mockDb.read('hospitals')).toHaveLength(2);
  });

  it('기존 zustand persist 키에 있던 데이터를 최초 1회 이관한다', () => {
    window.localStorage.setItem(
      'molarmolar-hospitals',
      JSON.stringify({ state: { hospitals: [{ id: 'legacy-1' }] }, version: 0 })
    );
    mockDb.reset();

    const hospitals = mockDb.read('hospitals');
    expect(hospitals).toHaveLength(1);
    expect(hospitals[0].id).toBe('legacy-1');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/mocks/db.test.ts`
Expected: FAIL — `Failed to resolve import "@/mocks/db"`

- [ ] **Step 3: fixture 이동**

```bash
cd frontend
mkdir -p src/mocks/fixtures
git mv src/data/consultRequests.ts src/data/doctors.ts src/data/guides.ts \
  src/data/hospitals.ts src/data/notifications.ts src/data/placeholder-company-info.ts \
  src/data/procedures.ts src/data/promotions.ts src/data/qaPosts.ts \
  src/data/reviews.ts src/data/trendingSearches.ts src/mocks/fixtures/
```

`@/data`를 참조하는 파일을 전부 찾아 `@/mocks/fixtures`로 바꾼다:

```bash
grep -rl "@/data/" src/ | xargs sed -i "s|@/data/|@/mocks/fixtures/|g"
```

대상 파일(21개, 검토 시점 기준): `components/admin/HospitalForm.tsx`, `components/DoctorCard.tsx`, `components/Footer.tsx`, `components/HospitalCard.tsx`, `components/HospitalExploreCard.tsx`, `components/HospitalMapView.tsx`, `components/PriceCompareTable.tsx`, `screens/admin/consultations/[id].tsx`, `screens/admin/consultations/index.tsx`, `screens/admin/hospital/[id].tsx`, `screens/community/[id].tsx`, `screens/community/new.tsx`, `screens/consult/[hospitalId].tsx`, `screens/doctor/[id].tsx`, `screens/events.tsx`, `screens/hospital/[id].tsx`, `screens/search.tsx`, `screens/tabs/community.tsx`, `screens/tabs/explore.tsx`, `screens/tabs/index.tsx`, `screens/tips/[id].tsx`, 그리고 `store/*.ts`.

- [ ] **Step 4: 지연 헬퍼 작성**

`frontend/src/mocks/latency.ts`:

```ts
// 실제 네트워크가 붙기 전에도 loading 상태가 실재하게 만드는 인위적 지연.
// 테스트에서는 0ms 로 떨어져 대기 없이 통과한다.
const DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 180;

export function delay(ms: number = DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
```

- [ ] **Step 5: 목 DB 구현**

`frontend/src/mocks/db.ts`:

```ts
import { consultRequests as seedConsultRequests } from '@/mocks/fixtures/consultRequests';
import { doctors as seedDoctors } from '@/mocks/fixtures/doctors';
import { hospitals as seedHospitals } from '@/mocks/fixtures/hospitals';
import { notifications as seedNotifications } from '@/mocks/fixtures/notifications';
import { qaPosts as seedQaPosts } from '@/mocks/fixtures/qaPosts';
import type {
  AppNotification,
  ConsultRequest,
  Doctor,
  Hospital,
  QaPost,
} from '@/types/domain';

interface Tables {
  hospitals: Hospital[];
  doctors: Doctor[];
  consultRequests: ConsultRequest[];
  communityPosts: QaPost[];
  notifications: AppNotification[];
}

export type MockTable = keyof Tables;
export type TableRow<K extends MockTable> = Tables[K][number];

const STORAGE_PREFIX = 'molarmolar-mockdb-';

const SEEDS: Tables = {
  hospitals: seedHospitals,
  doctors: seedDoctors,
  consultRequests: seedConsultRequests,
  communityPosts: seedQaPosts,
  notifications: seedNotifications,
};

/**
 * 이 앱을 이미 써 본 브라우저에는 zustand persist 가 만든 키에 사용자 데이터가 있다.
 * 목 DB 로 옮기면서 그걸 버리면 신청했던 상담·작성한 글이 사라지므로 최초 1회 흡수한다.
 * 키와 안쪽 필드 이름은 각 스토어의 persist 설정에서 그대로 가져온 값이다.
 */
const LEGACY_SOURCES: { [K in MockTable]: { key: string; field: string } | null } = {
  hospitals: { key: 'molarmolar-hospitals', field: 'hospitals' },
  doctors: { key: 'molarmolar-doctors', field: 'doctors' },
  consultRequests: { key: 'molarmolar-consult-requests', field: 'requests' },
  communityPosts: { key: 'molarmolar-community', field: 'posts' },
  notifications: { key: 'molarmolar-notifications', field: 'notifications' },
};

function readLegacy<K extends MockTable>(table: K): Tables[K] | null {
  const source = LEGACY_SOURCES[table];
  if (!source) return null;

  const raw = window.localStorage.getItem(source.key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const rows = parsed.state?.[source.field];
    return Array.isArray(rows) ? (rows as Tables[K]) : null;
  } catch {
    return null;
  }
}

const cache = new Map<MockTable, unknown>();

export const mockDb = {
  read<K extends MockTable>(table: K): Tables[K] {
    const cached = cache.get(table);
    if (cached) return cached as Tables[K];

    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${table}`);
    let rows: Tables[K];

    if (raw) {
      rows = JSON.parse(raw) as Tables[K];
    } else {
      rows = readLegacy(table) ?? (SEEDS[table] as Tables[K]);
      window.localStorage.setItem(`${STORAGE_PREFIX}${table}`, JSON.stringify(rows));
    }

    cache.set(table, rows);
    return rows;
  },

  write<K extends MockTable>(table: K, rows: Tables[K]): void {
    cache.set(table, rows);
    window.localStorage.setItem(`${STORAGE_PREFIX}${table}`, JSON.stringify(rows));
  },

  /** 메모리 캐시만 비운다. localStorage 는 유지된다. 테스트용. */
  reset(): void {
    cache.clear();
  },
};
```

`QaPost`와 `AppNotification`의 실제 타입 이름은 `src/types/domain.ts`에서 확인해 맞춘다. 이름이 다르면 이 파일의 import와 `Tables` 선언을 그 이름으로 바꾼다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm run test:run -- src/mocks/db.test.ts`
Expected: 4 passed

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "refactor(frontend): promote static data to an async mock backend

src/data/ 를 src/mocks/fixtures/ 로 옮기고, localStorage 영속을 담당하는
mockDb 를 추가한다. 기존 zustand persist 키의 사용자 데이터는 최초 읽기에서 흡수한다."
```

---

## Task 2: TanStack Query 도입과 hospital feature의 api/hooks

첫 feature 슬라이스를 만들면서 Query provider를 세운다. 이 Task가 이후 모든 feature의 틀이 된다.

**Files:**
- Create: `src/app/providers.tsx`
- Create: `src/lib/queryKeys.ts`
- Create: `src/features/hospital/api/hospitalApi.ts`
- Create: `src/features/hospital/hooks/useHospitals.ts`
- Create: `src/features/hospital/hooks/useHospital.ts`
- Create: `src/features/hospital/index.ts`
- Create: `src/features/hospital/hooks/useHospital.test.tsx`
- Create: `src/test/renderWithProviders.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `mockDb`, `delay` (Task 1)
- Produces:
  - `queryKeys.hospitals.all` → `['hospitals']`
  - `queryKeys.hospitals.detail(id: string)` → `['hospitals', id]`
  - `fetchHospitals(): Promise<Hospital[]>`
  - `fetchHospitalById(id: string): Promise<Hospital | null>`
  - `updateHospital(id: string, patch: Partial<Hospital>): Promise<Hospital>`
  - `createHospital(hospital: Hospital): Promise<Hospital>`
  - `useHospitals(): UseQueryResult<Hospital[]>`
  - `useHospital(id: string): UseQueryResult<Hospital | null>`
  - `renderWithProviders(ui: ReactElement): RenderResult` — 테스트에서 QueryClientProvider로 감싸 렌더

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/test/renderWithProviders.tsx` (테스트 유틸이라 먼저 작성):

```tsx
import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  // 테스트에서는 재시도를 끈다. 켜져 있으면 에러 케이스가 타임아웃으로 실패한다.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
```

`frontend/src/features/hospital/hooks/useHospital.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useHospital } from '@/features/hospital/hooks/useHospital';
import { useHospitals } from '@/features/hospital/hooks/useHospitals';
import { mockDb } from '@/mocks/db';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('hospital 조회 훅', () => {
  it('useHospitals 는 loading 을 지나 목록을 반환한다', async () => {
    const { result } = renderHook(() => useHospitals(), { wrapper });

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBe(mockDb.read('hospitals').length);
  });

  it('useHospital 은 id 로 한 건을 반환한다', async () => {
    const target = mockDb.read('hospitals')[0];
    const { result } = renderHook(() => useHospital(target.id), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe(target.name);
  });

  it('없는 id 는 null 을 반환한다 (에러가 아니다)', async () => {
    const { result } = renderHook(() => useHospital('no-such-hospital'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/features/hospital`
Expected: FAIL — `Failed to resolve import "@/features/hospital/hooks/useHospital"`

- [ ] **Step 3: 쿼리 키 작성**

`frontend/src/lib/queryKeys.ts`:

```ts
/**
 * 쿼리 키의 단일 출처. 무효화 대상을 문자열 리터럴로 흩뿌리지 않기 위해 한 곳에 모은다.
 * 새 feature 를 추가할 때 여기에 항목을 더한다.
 */
export const queryKeys = {
  hospitals: {
    all: ['hospitals'] as const,
    detail: (id: string) => ['hospitals', id] as const,
  },
  doctors: {
    all: ['doctors'] as const,
    detail: (id: string) => ['doctors', id] as const,
    byHospital: (hospitalId: string) => ['doctors', 'byHospital', hospitalId] as const,
  },
  consultRequests: {
    all: ['consultRequests'] as const,
    detail: (id: string) => ['consultRequests', id] as const,
  },
  communityPosts: {
    all: ['communityPosts'] as const,
    detail: (id: string) => ['communityPosts', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    byAudience: (audience: 'user' | 'admin') => ['notifications', audience] as const,
  },
} as const;
```

- [ ] **Step 4: api 함수 작성**

`frontend/src/features/hospital/api/hospitalApi.ts`:

```ts
import { mockDb } from '@/mocks/db';
import { delay } from '@/mocks/latency';
import type { Hospital } from '@/types/domain';

// 실제 백엔드가 생기면 이 파일 내부만 HTTP 호출로 바꾼다.
// 시그니처는 유지되므로 훅과 화면은 손대지 않는다.

export async function fetchHospitals(): Promise<Hospital[]> {
  await delay();
  return mockDb.read('hospitals');
}

export async function fetchHospitalById(id: string): Promise<Hospital | null> {
  await delay();
  return mockDb.read('hospitals').find((hospital) => hospital.id === id) ?? null;
}

export async function createHospital(hospital: Hospital): Promise<Hospital> {
  await delay();
  mockDb.write('hospitals', [...mockDb.read('hospitals'), hospital]);
  return hospital;
}

export async function updateHospital(id: string, patch: Partial<Hospital>): Promise<Hospital> {
  await delay();
  const rows = mockDb.read('hospitals');
  const index = rows.findIndex((hospital) => hospital.id === id);

  if (index === -1) throw new Error(`병원을 찾을 수 없어요: ${id}`);

  const updated = { ...rows[index], ...patch };
  // Array.prototype.with 은 ES2023 이고 이 프로젝트의 tsconfig lib 은 ES2022 다 — 쓰지 않는다.
  const next = [...rows];
  next[index] = updated;
  mockDb.write('hospitals', next);
  return updated;
}
```

- [ ] **Step 5: 조회 훅 작성**

`frontend/src/features/hospital/hooks/useHospitals.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchHospitals } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

export function useHospitals() {
  return useQuery({
    queryKey: queryKeys.hospitals.all,
    queryFn: fetchHospitals,
  });
}
```

`frontend/src/features/hospital/hooks/useHospital.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchHospitalById } from '@/features/hospital/api/hospitalApi';
import { queryKeys } from '@/lib/queryKeys';

export function useHospital(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hospitals.detail(id ?? ''),
    queryFn: () => fetchHospitalById(id as string),
    enabled: Boolean(id),
  });
}
```

`frontend/src/features/hospital/index.ts`:

```ts
export { useHospital } from '@/features/hospital/hooks/useHospital';
export { useHospitals } from '@/features/hospital/hooks/useHospitals';
export {
  createHospital,
  fetchHospitalById,
  fetchHospitals,
  updateHospital,
} from '@/features/hospital/api/hospitalApi';
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm run test:run -- src/features/hospital`
Expected: 3 passed

- [ ] **Step 7: 앱에 Query provider 연결**

`frontend/src/app/providers.tsx`:

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 목 백엔드는 즉시 응답하므로 창 전환마다 다시 부를 이유가 없다.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

`frontend/src/main.tsx`을 수정해 `<App />`을 `<AppProviders>`로 감싼다. 기존 `StrictMode`·`global.css` import는 유지한다.

- [ ] **Step 8: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "feat(frontend): add TanStack Query and the hospital feature slice

queryKeys 단일 출처, features/hospital/{api,hooks}, AppProviders 를 추가한다."
```

---

## Task 3: 첫 화면 이관 — 병원 상세 페이지

레시피가 실제로 통하는지 가장 무거운 화면(373줄)으로 검증한다. 여기서 걸리는 문제는 남은 26개 화면에서도 걸린다.

**Files:**
- Create: `src/hooks/useDelayedFlag.ts`, `src/components/{ErrorState,EmptyState,QueryState}.tsx` — **27개 페이지가 공유할 상태 표시 컴포넌트.** 여기서의 결함은 26번 복제된다
- Move: `src/screens/hospital/[id].tsx` → `src/pages/HospitalDetailPage.tsx`
- Create: `src/features/hospital/components/HospitalDetailView.tsx` — 렌더와 파생 로직. Page 는 획득만 한다
- Create: `src/pages/HospitalDetailPage.test.tsx`
- Modify: `src/App.tsx` (import 1줄 + `ROUTES` 1항목)
- Modify: `src/store/useHospitalStore.ts` — `mockDb` 위임 (위 Global Constraints 참고). 이게 없으면 관리자 수정이 상세에 반영되지 않는 회귀가 생긴다
- Move: 위 4개 컴포넌트를 `src/features/hospital/components/`로

**Interfaces:**
- Consumes: `useHospital` (Task 2)
- Produces:
  - `<QueryState isLoading isError isRetrying? data onRetry? isEmpty? errorState? emptyState className? >{(data) => ...}</QueryState>` — `children` 은 `(data: NonNullable<T>) => ReactNode`. `isError && data === undefined` 일 때만 에러 화면으로 가고, data 가 있으면 children 을 유지한다 (v5 는 refetch 실패 시 data 를 유지하고 status 만 'error' 로 바꾼다)
  - `<ErrorState title? description? onRetry? isRetrying? variant? className? />`
  - `<EmptyState icon? title description? actionLabel? onAction? variant? className? />` — `variant: 'block' | 'inline'`, `icon={null}` 로 아이콘 끄기
  - `useDelayedFlag(flag: boolean, delayMs = 200): boolean`
  - `HospitalDetailPage` (default export), `HospitalDetailView`, `@/features/hospital/components/{HospitalCard,HospitalExploreCard,PriceCompareTable,HospitalMapView}`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/pages/HospitalDetailPage.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HospitalDetailPage from '@/pages/HospitalDetailPage';
import { renderWithProviders } from '@/test/renderWithProviders';
import { mockDb } from '@/mocks/db';

describe('HospitalDetailPage', () => {
  it('로딩 상태를 먼저 보여준다', () => {
    const target = mockDb.read('hospitals')[0];
    renderWithProviders(<HospitalDetailPage />, { route: `/hospital/${target.id}` });

    expect(screen.getByText('불러오는 중이에요')).toBeInTheDocument();
  });

  it('불러온 병원 이름을 렌더한다', async () => {
    const target = mockDb.read('hospitals')[0];
    renderWithProviders(<HospitalDetailPage />, { route: `/hospital/${target.id}` });

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
  });

  it('없는 병원이면 안내 문구를 보여준다', async () => {
    renderWithProviders(<HospitalDetailPage />, { route: '/hospital/no-such-id' });

    await waitFor(() =>
      expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument()
    );
  });
});
```

`useLocalSearchParams`가 `MemoryRouter`의 `initialEntries`에서 `:id`를 읽으려면 라우트 매칭이 필요하다. `renderWithProviders`가 `MemoryRouter`만 감싸므로 파라미터가 비어 있을 수 있다 — 그 경우 `renderWithProviders`에 라우트 매칭을 추가한다:

```tsx
// renderWithProviders 의 Wrapper 안, MemoryRouter 자식
<Routes>
  <Route path="/hospital/:id" element={children} />
  <Route path="*" element={children} />
</Routes>
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/pages/HospitalDetailPage.test.tsx`
Expected: FAIL — `Failed to resolve import "@/pages/HospitalDetailPage"`

- [ ] **Step 3: 컴포넌트를 feature로 옮긴다**

```bash
mkdir -p src/features/hospital/components
git mv src/components/HospitalCard.tsx src/components/HospitalExploreCard.tsx \
  src/components/PriceCompareTable.tsx src/components/HospitalMapView.tsx \
  src/features/hospital/components/
```

호출부의 import 경로를 `@/components/X` → `@/features/hospital/components/X`로 일괄 수정한다.

**실제 참조 현황(확인 완료).** 계획 초안은 "목데이터 직접 참조를 props로 승격"이라고 뭉갰지만, 이 4개 파일의 참조는 성격이 둘로 갈린다:

| 참조 | 파일 | 성격 | 이 Task 에서 |
|---|---|---|---|
| `getProcedureById` (`fixtures/procedures`) | HospitalCard, HospitalExploreCard, HospitalMapView | 정적 마스터 데이터 | **유지** |
| `getPromotionByHospital` (`fixtures/promotions`) | HospitalCard, PriceCompareTable | 정적 마스터 데이터 | **유지** |
| `getDoctorsByHospital` (`store/useDoctorStore`) | HospitalCard:25, HospitalExploreCard:22 | 비반응형 `getState()` 읽기 | **Task 5 로 넘긴다** |

정적 마스터 데이터 두 개는 유지하고 파일 상단에 주석을 남긴다:
`// 정적 마스터 데이터. features/procedure(또는 content) 가 생기면 그쪽으로 옮긴다 (Task 11).`

`getDoctorsByHospital`은 **이 Task 에서 손대지 않는다.** 반응형으로 바꾸려면 Task 5 의 `useDoctorsByHospital` 이 필요하고, 지금 props 로 승격시키면 아직 이관되지 않은 호출부(explore, home, hospital 상세)로 문제가 번진다. Task 5 가 `useDoctorStore` 를 삭제할 때 함께 고친다 — Task 5 Step 7 의 grep 이 이 두 곳을 잡는다.

- [ ] **Step 4: 페이지 이동과 재작성**

```bash
mkdir -p src/pages
git mv src/screens/hospital/\[id\].tsx src/pages/HospitalDetailPage.tsx
```

`src/pages/HospitalDetailPage.tsx`를 다음 골격으로 맞춘다. **기존 373줄의 렌더 트리는 그대로 유지하고**, 데이터 획득부와 상태 분기만 교체한다:

```tsx
import { Stack, useLocalSearchParams } from '@/navigation';
import { SafeAreaView, Text } from '@/primitives';

import { useHospital } from '@/features/hospital';

export default function HospitalDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: hospital, isPending, isError } = useHospital(id);

  if (isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">불러오는 중이에요</Text>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">정보를 불러올 수 없어요</Text>
      </SafeAreaView>
    );
  }

  if (!hospital) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">병원 정보를 찾을 수 없어요</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <Stack.Screen options={{ title: hospital.name }} />
      {/* 기존 렌더 트리를 여기에 그대로 둔다 */}
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: 라우트 갱신**

`src/App.tsx`에서 이 두 줄만 바꾼다:

```tsx
// 변경 전
import HospitalDetailScreen from '@/screens/hospital/[id]';
{ path: '/hospital/:id', element: <HospitalDetailScreen />, options: { title: '' } },

// 변경 후
import HospitalDetailPage from '@/pages/HospitalDetailPage';
{ path: '/hospital/:id', element: <HospitalDetailPage />, options: { title: '' } },
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm run test:run -- src/pages/HospitalDetailPage.test.tsx`
Expected: 3 passed

- [ ] **Step 7: 브라우저에서 실제 동작 확인**

```bash
npm run dev
```

`http://localhost:5173/hospital/<실제 id>`를 열어 로딩 문구가 잠깐 보이고 기존과 같은 화면이 나오는지 본다. `/hospital/zzz`로 안내 문구도 확인한다.

- [ ] **Step 8: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "refactor(frontend): move hospital detail to pages/ with useQuery states

컴포넌트 4개를 features/hospital/components/ 로 옮기고 목데이터 직접 참조를 props 로 바꾼다."
```

---

## Task 4: explore 필터 로직을 hospital feature 훅으로 분리

> **2026-08-14 — `2026-08-13-hospital-doctor-domain-api` 조각 1이 이 Task를 대체했다.**
> 이 Task가 만든 `useHospitalFilters`는 병원·전문의 전량을 클라이언트 메모리로 받아
> `useMemo`로 필터링·정렬하는 훅이었다(아래 Step 3 참고). 조각 1의 Task 18("탐색 화면 서버
> 필터")이 그 방식을 걷어내고 `useExploreFilters`(`frontend/src/features/hospital/hooks/useExploreFilters.ts`)로
> 바꿨다 — 화면 상태(칩·정렬·반경)를 `HospitalFilters`/`DoctorFilters` 쿼리 파라미터로만
> 변환하고, 실제 필터링·정렬·스폰서 우선 노출은 서버(`GET /hospitals`, `GET /doctors`)가 한다.
> 클라이언트 정렬이 아예 사라졌다는 점이 핵심 차이다 — 서버가 이미 정렬된 배열을 내려준다.
> `ExplorePage.tsx`는 이관됐지만 이 Task가 쓴 형태가 아니라 그 위에 다시 쓰인 형태다.

`screens/tabs/explore.tsx`(337줄)에 필터·정렬·스폰서 랭킹이 인라인으로 들어 있다. CLAUDE.md의 "Business logic belongs in hooks"를 정면으로 위반하는 지점이고, 병원용/전문의용 필터가 거의 동일하게 두 번 반복된다.

**Files:**
- Create: `src/features/hospital/hooks/useHospitalFilters.ts`
- Create: `src/features/hospital/hooks/useHospitalFilters.test.ts`
- Create: `src/features/hospital/types.ts`
- Move: `src/screens/tabs/explore.tsx` → `src/pages/ExplorePage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useHospitals` (Task 2), `useDoctors` — **Task 5에서 만든다. 이 Task는 Task 5 이후에 실행한다.**
- Produces:
  - `type ExploreFilters = { category: string; onlyConsult: boolean; onlyOneDay: boolean; onlySpecialist: boolean; onlyNightConsult: boolean; onlyExperienced: boolean; sortBy: SortKey }`
  - `type SortKey = 'popular' | 'reviews' | 'consults'`
  - `useHospitalFilters(): { filters, setFilter, hospitals, doctors, resultCount }`

> **실행 순서 주의:** 이 Task는 `useDoctors`를 필요로 한다. **Task 5를 먼저 완료하고 돌아온다.**

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/features/hospital/hooks/useHospitalFilters.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useHospitalFilters } from '@/features/hospital/hooks/useHospitalFilters';
import { queryWrapper } from '@/test/queryWrapper';

describe('useHospitalFilters', () => {
  it('기본 상태에서는 전체 병원을 반환한다', async () => {
    const { result } = renderHook(() => useHospitalFilters(), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.hospitals.length).toBeGreaterThan(0));
  });

  it('onlyOneDay 를 켜면 원데이 병원만 남는다', async () => {
    const { result } = renderHook(() => useHospitalFilters(), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.hospitals.length).toBeGreaterThan(0));

    act(() => result.current.setFilter('onlyOneDay', true));

    await waitFor(() =>
      expect(result.current.hospitals.every((hospital) => hospital.isOneDay)).toBe(true)
    );
  });

  it('onlyConsult 를 켜면 상담 가능 병원만 남는다', async () => {
    const { result } = renderHook(() => useHospitalFilters(), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.hospitals.length).toBeGreaterThan(0));

    act(() => result.current.setFilter('onlyConsult', true));

    await waitFor(() =>
      expect(result.current.hospitals.every((hospital) => hospital.consultAvailable)).toBe(true)
    );
  });

  it('sortBy=reviews 는 리뷰 수 내림차순으로 정렬한다', async () => {
    const { result } = renderHook(() => useHospitalFilters(), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.hospitals.length).toBeGreaterThan(1));

    act(() => result.current.setFilter('sortBy', 'reviews'));

    await waitFor(() => {
      const counts = result.current.hospitals.map((hospital) => hospital.reviewCount);
      expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    });
  });

  it('필터를 모두 켜서 결과가 0건이어도 던지지 않고 빈 배열을 준다', async () => {
    const { result } = renderHook(() => useHospitalFilters(), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.hospitals.length).toBeGreaterThan(0));

    act(() => {
      result.current.setFilter('onlyOneDay', true);
      result.current.setFilter('onlySpecialist', true);
      result.current.setFilter('onlyNightConsult', true);
      result.current.setFilter('onlyExperienced', true);
    });

    await waitFor(() => expect(Array.isArray(result.current.hospitals)).toBe(true));
  });
});
```

`frontend/src/test/queryWrapper.tsx` (여러 훅 테스트가 재사용하므로 별도 파일로 뽑는다):

```tsx
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function queryWrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/features/hospital/hooks/useHospitalFilters.test.ts`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 3: 필터 훅 구현**

`src/screens/tabs/explore.tsx:100-183`의 로직을 그대로 옮긴다. **동작을 바꾸지 않는다** — 스폰서 랭킹 우선 배치(`:141-154`), 카테고리가 `'all'`일 때만 스폰서를 앞에 붙이는 조건, `MIN_EXPERIENCED_YEARS` 임계값, `isVerifiedSpecialist`(`@/utils/specialty`) 사용 모두 유지한다. 병원용과 전문의용에서 반복되는 조건은 아래처럼 하나의 술어 맵으로 합친다:

```ts
import { useMemo, useState } from 'react';

import { useDoctors } from '@/features/doctor';
import { useHospitals } from '@/features/hospital/hooks/useHospitals';
import type { ExploreFilters, SortKey } from '@/features/hospital/types';
import type { Doctor, Hospital } from '@/types/domain';
import { isVerifiedSpecialist } from '@/utils/specialty';

const MIN_EXPERIENCED_YEARS = 10; // explore.tsx 의 기존 상수를 그대로 옮긴 값

const INITIAL_FILTERS: ExploreFilters = {
  category: 'all',
  onlyConsult: false,
  onlyOneDay: false,
  onlySpecialist: false,
  onlyNightConsult: false,
  onlyExperienced: false,
  sortBy: 'popular',
};

function sortByKey<T extends { reviewCount: number; consultCount: number }>(
  rows: T[],
  sortBy: SortKey
): T[] {
  return [...rows].sort((a, b) => {
    if (sortBy === 'reviews') return b.reviewCount - a.reviewCount;
    if (sortBy === 'consults') return b.consultCount - a.consultCount;
    return 0; // 'popular' 는 원본 순서를 유지한다 (기존 동작)
  });
}

export function useHospitalFilters() {
  const [filters, setFilters] = useState<ExploreFilters>(INITIAL_FILTERS);
  const { data: allHospitals = [] } = useHospitals();
  const { data: allDoctors = [] } = useDoctors();

  const setFilter = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const hospitalById = useMemo(
    () => new Map(allHospitals.map((hospital) => [hospital.id, hospital])),
    [allHospitals]
  );

  const doctorsByHospitalId = useMemo(() => {
    const map = new Map<string, Doctor[]>();
    for (const doctor of allDoctors) {
      const list = map.get(doctor.hospitalId) ?? [];
      list.push(doctor);
      map.set(doctor.hospitalId, list);
    }
    return map;
  }, [allDoctors]);

  const hospitals = useMemo(() => {
    let list: Hospital[] = allHospitals;

    if (filters.category === 'recommended') list = list.filter((h) => h.isRecommended);
    else if (filters.category !== 'all') list = list.filter((h) => h.procedureIds.includes(filters.category as Hospital['procedureIds'][number]));
    if (filters.onlyConsult) list = list.filter((h) => h.consultAvailable);
    if (filters.onlyOneDay) list = list.filter((h) => h.isOneDay);
    if (filters.onlySpecialist) {
      list = list.filter((h) => (doctorsByHospitalId.get(h.id) ?? []).some(isVerifiedSpecialist));
    }
    if (filters.onlyNightConsult) list = list.filter((h) => h.features?.nightConsult);
    if (filters.onlyExperienced) {
      list = list.filter((h) =>
        (doctorsByHospitalId.get(h.id) ?? []).some((d) => d.yearsOfExperience >= MIN_EXPERIENCED_YEARS)
      );
    }

    return sortByKey(list, filters.sortBy);
  }, [allHospitals, doctorsByHospitalId, filters]);

  const doctors = useMemo(() => {
    let list: Doctor[] = allDoctors;

    if (filters.category === 'recommended') list = list.filter((d) => d.isRecommended);
    else if (filters.category !== 'all') list = list.filter((d) => d.procedureIds.includes(filters.category as Doctor['procedureIds'][number]));
    if (filters.onlyConsult) list = list.filter((d) => hospitalById.get(d.hospitalId)?.consultAvailable);
    if (filters.onlyOneDay) list = list.filter((d) => hospitalById.get(d.hospitalId)?.isOneDay);
    if (filters.onlySpecialist) list = list.filter(isVerifiedSpecialist);
    if (filters.onlyNightConsult) list = list.filter((d) => hospitalById.get(d.hospitalId)?.features?.nightConsult);
    if (filters.onlyExperienced) list = list.filter((d) => d.yearsOfExperience >= MIN_EXPERIENCED_YEARS);

    return sortByKey(list, filters.sortBy);
  }, [allDoctors, hospitalById, filters]);

  return { filters, setFilter, hospitals, doctors };
}
```

**스폰서 랭킹 처리:** `explore.tsx:141-154`의 스폰서 우선 배치와 `@/utils/sponsorship`의 `isEligible` 사용은 위 `hospitals` useMemo의 `return` 직전에 원본 그대로 삽입한다. 원본을 열어 그 블록을 복사해 온다 — 조건과 정렬 키를 임의로 바꾸면 화면의 노출 순서가 달라진다.

`frontend/src/features/hospital/types.ts`:

```ts
export type SortKey = 'popular' | 'reviews' | 'consults';

export interface ExploreFilters {
  category: string;
  onlyConsult: boolean;
  onlyOneDay: boolean;
  onlySpecialist: boolean;
  onlyNightConsult: boolean;
  onlyExperienced: boolean;
  sortBy: SortKey;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/features/hospital/hooks/useHospitalFilters.test.ts`
Expected: 5 passed

- [ ] **Step 5: 페이지 이관**

레시피(Global Constraints)를 적용해 `screens/tabs/explore.tsx` → `pages/ExplorePage.tsx`. 필터 상태 `useState` 7개를 `useHospitalFilters()` 한 줄로 대체하고, 칩·정렬 버튼의 `onPress`를 `setFilter('onlyOneDay', !filters.onlyOneDay)` 형태로 바꾼다. 렌더 트리와 Tailwind 클래스는 유지한다.

- [ ] **Step 6: 브라우저에서 필터 동작 확인**

`npm run dev` → `/explore`에서 필터 칩을 하나씩 켜고 **결과 리스트가 실제로 바뀌는지** 확인한다. 정렬 3종, 병원/전문의 모드 전환, 결과 0건 상태까지 본다. (프로젝트 QA 규칙: 필터/검색은 실제 리스트 변경까지 확인)

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "refactor(frontend): extract explore filtering into useHospitalFilters

explore 화면에 인라인이던 필터/정렬/스폰서 랭킹 로직을 hospital feature 훅으로 옮긴다."
```

---

## Task 5: doctor feature

> **2026-08-14 — `2026-08-13-hospital-doctor-domain-api` 조각 1이 이 Task를 대체했다.**
> 이 Task가 만든 `doctorApi.ts`는 `mockDb`(로컬스토리지)를 읽고 쓰는 **목 백엔드**였다(아래
> Step 3 참고, `fetchDoctors`/`fetchDoctorById`/`updateDoctor`가 전부 `mockDb.read/write`
> 호출). 조각 1의 Task 15·17이 같은 파일 경로를 그대로 두고 내부를 실제 HTTP 호출
> (`apiRequest`, `GET/PATCH/DELETE /doctors`, `GET/PUT /hospitals/{id}/doctors`,
> `GET /doctors/verification-queue`, `PUT /doctors/{id}/verification`)로 바꿨다. 훅 구성도
> 이 Task의 3개(`useDoctors`/`useDoctor`/`useDoctorsByHospital`)에서 관리자 검수·로스터
> 교체·단건 수정·삭제까지 다루는 8개(`useHospitalDoctors`, `useReplaceHospitalDoctors`,
> `useUpdateDoctor`, `useDeleteDoctor`, `useVerificationQueue`, `useDecideVerification` 포함)로
> 늘었다. `DoctorCard`의 `getHospitalById` 제거(이 Task의 핵심 목표)는 그대로 유지됐다.

**Files:**
- Create: `src/features/doctor/api/doctorApi.ts`
- Create: `src/features/doctor/hooks/useDoctors.ts`
- Create: `src/features/doctor/hooks/useDoctor.ts`
- Create: `src/features/doctor/hooks/useDoctors.test.tsx`
- Create: `src/features/doctor/index.ts`
- Move: `src/components/DoctorCard.tsx` → `src/features/doctor/components/DoctorCard.tsx`
- Move: `src/screens/doctor/[id].tsx` → `src/pages/DoctorDetailPage.tsx`
- Modify: `src/App.tsx`
- Delete: `src/store/useDoctorStore.ts`

**Interfaces:**
- Consumes: `mockDb`, `delay`, `queryKeys`
- Produces:
  - `fetchDoctors(): Promise<Doctor[]>`
  - `fetchDoctorById(id: string): Promise<Doctor | null>`
  - `fetchDoctorsByHospital(hospitalId: string): Promise<Doctor[]>`
  - `updateDoctor(id: string, patch: Partial<Doctor>): Promise<Doctor>` — 전문의 인증 검수 화면이 쓴다
  - `useDoctors()`, `useDoctor(id)`, `useDoctorsByHospital(hospitalId)`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/features/doctor/hooks/useDoctors.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDoctor, useDoctors, useDoctorsByHospital } from '@/features/doctor';
import { mockDb } from '@/mocks/db';
import { queryWrapper } from '@/test/queryWrapper';

describe('doctor 조회 훅', () => {
  it('useDoctors 는 전체 목록을 반환한다', async () => {
    const { result } = renderHook(() => useDoctors(), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBe(mockDb.read('doctors').length);
  });

  it('useDoctor 는 id 로 한 건을 반환한다', async () => {
    const target = mockDb.read('doctors')[0];
    const { result } = renderHook(() => useDoctor(target.id), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe(target.name);
  });

  it('useDoctorsByHospital 은 해당 병원 전문의만 반환한다', async () => {
    const target = mockDb.read('doctors')[0];
    const { result } = renderHook(() => useDoctorsByHospital(target.hospitalId), {
      wrapper: queryWrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.every((d) => d.hospitalId === target.hospitalId)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/features/doctor`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 3: api 함수 구현**

`frontend/src/features/doctor/api/doctorApi.ts` — Task 2의 `hospitalApi.ts`와 같은 형태로 `'doctors'` 테이블에 대해 작성한다:

```ts
import { mockDb } from '@/mocks/db';
import { delay } from '@/mocks/latency';
import type { Doctor } from '@/types/domain';

export async function fetchDoctors(): Promise<Doctor[]> {
  await delay();
  return mockDb.read('doctors');
}

export async function fetchDoctorById(id: string): Promise<Doctor | null> {
  await delay();
  return mockDb.read('doctors').find((doctor) => doctor.id === id) ?? null;
}

export async function fetchDoctorsByHospital(hospitalId: string): Promise<Doctor[]> {
  await delay();
  return mockDb.read('doctors').filter((doctor) => doctor.hospitalId === hospitalId);
}

export async function updateDoctor(id: string, patch: Partial<Doctor>): Promise<Doctor> {
  await delay();
  const rows = mockDb.read('doctors');
  const index = rows.findIndex((doctor) => doctor.id === id);

  if (index === -1) throw new Error(`전문의를 찾을 수 없어요: ${id}`);

  const updated = { ...rows[index], ...patch };
  const next = [...rows];
  next[index] = updated;
  mockDb.write('doctors', next);
  return updated;
}
```

- [ ] **Step 4: 훅 3개와 배럴 작성**

`frontend/src/features/doctor/hooks/useDoctors.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchDoctors } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

export function useDoctors() {
  return useQuery({
    queryKey: queryKeys.doctors.all,
    queryFn: fetchDoctors,
  });
}
```

`frontend/src/features/doctor/hooks/useDoctor.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchDoctorById } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.doctors.detail(id ?? ''),
    queryFn: () => fetchDoctorById(id as string),
    enabled: Boolean(id),
  });
}
```

`frontend/src/features/doctor/hooks/useDoctorsByHospital.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchDoctorsByHospital } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';

export function useDoctorsByHospital(hospitalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.doctors.byHospital(hospitalId ?? ''),
    queryFn: () => fetchDoctorsByHospital(hospitalId as string),
    enabled: Boolean(hospitalId),
  });
}
```

`frontend/src/features/doctor/hooks/useVerifySpecialist.ts` (Task 12의 전문의 인증 검수 화면이 쓴다):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { updateDoctor } from '@/features/doctor/api/doctorApi';
import { queryKeys } from '@/lib/queryKeys';
import type { Doctor } from '@/types/domain';

export function useVerifySpecialist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Doctor> }) => updateDoctor(id, patch),
    onSuccess: (doctor) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.doctors.detail(doctor.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.doctors.byHospital(doctor.hospitalId) });
    },
  });
}
```

`frontend/src/features/doctor/index.ts`:

```ts
export { DoctorCard } from '@/features/doctor/components/DoctorCard';
export { useDoctor } from '@/features/doctor/hooks/useDoctor';
export { useDoctors } from '@/features/doctor/hooks/useDoctors';
export { useDoctorsByHospital } from '@/features/doctor/hooks/useDoctorsByHospital';
export { fetchDoctorById, fetchDoctors, updateDoctor } from '@/features/doctor/api/doctorApi';
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test:run -- src/features/doctor`
Expected: 3 passed

- [ ] **Step 6: DoctorCard 이동 + `getHospitalById` 제거**

```bash
mkdir -p src/features/doctor/components
git mv src/components/DoctorCard.tsx src/features/doctor/components/DoctorCard.tsx
```

`DoctorCard.tsx:19`의 `const hospital = getHospitalById(doctor.hospitalId)`를 삭제하고 `hospital`을 **prop으로 받는다.** 이게 Warning #3(비반응형 스토어 읽기)의 핵심 수정이다:

```tsx
interface DoctorCardProps {
  doctor: Doctor;
  /** 소속 병원. 호출하는 페이지가 useHospital/useHospitals 로 받아 넘긴다. */
  hospital?: Hospital;
}
```

`DoctorCard`를 쓰는 모든 호출부에서 `hospital`을 넘기도록 고친다. 호출부는 `grep -rn "DoctorCard" src/`로 찾는다.

- [ ] **Step 7: 페이지 이관과 스토어 삭제**

레시피를 적용해 `screens/doctor/[id].tsx` → `pages/DoctorDetailPage.tsx`. `getHospitalById`(`:31`) 호출을 `useHospital(doctor.hospitalId)`로 바꾼다.

`src/store/useDoctorStore.ts`를 삭제한다. 남은 참조가 없는지 확인한다:

```bash
git rm src/store/useDoctorStore.ts
grep -rn "useDoctorStore" src/ && echo "남은 참조 있음 — 먼저 정리" || echo "참조 없음"
```

- [ ] **Step 8: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "feat(frontend): add doctor feature and drop useDoctorStore

DoctorCard 의 비반응형 getHospitalById 호출을 prop 으로 바꾼다."
```

> 여기까지 끝내면 **Task 4로 돌아가서** `useHospitalFilters`를 완성한다.

---

## Task 6: consult feature — React Hook Form + Zod 첫 적용

상담 신청 폼은 이 앱에서 가장 중요한 전환 지점인데 현재 검증이 `length > 0`뿐이다(`screens/consult/[hospitalId].tsx:46`). RHF + Zod를 여기에 처음 적용하고, 이 형태를 나머지 폼에 반복한다.

**현재 각 폼의 실제 에러 표시 방식(확인 완료 — 초안에 잘못 적었던 것을 바로잡음):**

| 화면 | 검증 | 에러 표시 |
|---|---|---|
| 상담 신청 | 이름·연락처 `trim().length > 0` 뿐. 전화번호 형식 미검사 | **에러 문구가 아예 없다.** 버튼 비활성화만. `window.alert` 는 접수 *성공* 시에만 쓴다 |
| 로그인 | 이메일·비밀번호 비어있지 않음. 비밀번호는 `trim` 안 하므로 공백 한 칸도 통과 | 화면 안 빨간 글씨(`text-rose-500`)지만 **문제된 칸 아래가 아니라 제출 버튼 위** |
| 회원가입 | 이름·이메일 `trim` 1자↑, 비밀번호 6자↑, 확인란 1자↑. 이메일 형식 미검사 | 로그인과 동일 |

`window.alert`(`utils/alert.ts`)를 쓰는 곳은 4군데뿐이다: 주소 복사, 소셜 로그인 `준비중이에요`, 상담 접수 완료, 로그아웃 확인. **이 4개는 그대로 둔다** — 폼 검증 에러가 아니다.

따라서 이 Task 의 목표는 "alert 를 필드 에러로 바꾸는 것"이 아니라 **(a) 없는 검증을 추가하고 (b) 에러를 해당 입력 칸 아래로 옮기는 것**이다.

**Files:**
- Create: `src/features/consult/api/consultApi.ts`
- Create: `src/features/consult/schemas/consultRequestSchema.ts`
- Create: `src/features/consult/schemas/consultRequestSchema.test.ts`
- Create: `src/features/consult/hooks/useCreateConsultRequest.ts`
- Create: `src/features/consult/hooks/useConsultRequests.ts`
- Create: `src/features/consult/components/ConsultRequestForm.tsx`
- Create: `src/features/consult/components/ConsultRequestForm.test.tsx`
- Create: `src/features/consult/index.ts`
- Move: `src/screens/consult/[hospitalId].tsx` → `src/pages/ConsultRequestPage.tsx`
- Modify: `src/App.tsx`
- Delete: `src/store/useConsultStore.ts`

**Interfaces:**
- Consumes: `mockDb`, `delay`, `queryKeys`, `useHospital`, `notifyAdmin`/`notifyUser` (`@/services/notifications`)
- Produces:
  - `consultRequestSchema` (zod), `type ConsultRequestInput = z.infer<typeof consultRequestSchema>`
  - `createConsultRequest(input: ConsultRequestInput & { hospitalId: string }): Promise<ConsultRequest>`
  - `updateConsultStatus(id: string, status: ConsultStatus): Promise<ConsultRequest>`
  - `addConsultMemo(id: string, content: string): Promise<ConsultRequest>`
  - `useCreateConsultRequest()`, `useConsultRequests()`, `useConsultRequest(id)`

- [ ] **Step 1: 스키마의 실패하는 테스트 작성**

`frontend/src/features/consult/schemas/consultRequestSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { consultRequestSchema } from '@/features/consult/schemas/consultRequestSchema';

const valid = {
  name: '박지영',
  phone: '010-1234-5678',
  procedureId: 'implant',
  preferredTime: '평일 오전',
  message: '',
};

describe('consultRequestSchema', () => {
  it('올바른 입력을 통과시킨다', () => {
    expect(consultRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('이름이 비면 거부한다', () => {
    const result = consultRequestSchema.safeParse({ ...valid, name: '  ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('이름을 입력해주세요');
    }
  });

  it('전화번호 형식이 틀리면 거부한다', () => {
    for (const phone of ['1234', '010-12-5678', 'abcdefghijk', '02-1234-5678']) {
      expect(consultRequestSchema.safeParse({ ...valid, phone }).success).toBe(false);
    }
  });

  it('하이픈 없는 휴대폰 번호도 통과시킨다', () => {
    expect(consultRequestSchema.safeParse({ ...valid, phone: '01012345678' }).success).toBe(true);
  });

  it('희망 시술을 고르지 않으면 거부한다', () => {
    expect(consultRequestSchema.safeParse({ ...valid, procedureId: '' }).success).toBe(false);
  });

  it('남기고 싶은 말은 선택 항목이라 빈 값도 통과한다', () => {
    expect(consultRequestSchema.safeParse({ ...valid, message: '' }).success).toBe(true);
  });

  it('남기고 싶은 말이 500자를 넘으면 거부한다', () => {
    expect(consultRequestSchema.safeParse({ ...valid, message: 'ㄱ'.repeat(501) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/features/consult/schemas`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 3: 스키마 구현**

`frontend/src/features/consult/schemas/consultRequestSchema.ts`:

```ts
import { z } from 'zod';

// 국내 휴대폰 번호. 하이픈은 있어도 없어도 통과시킨다.
const MOBILE_PHONE = /^01[016789]-?\d{3,4}-?\d{4}$/;

export const consultRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '이름을 입력해주세요')
    .max(20, '이름이 너무 길어요'),
  phone: z
    .string()
    .trim()
    .min(1, '연락처를 입력해주세요')
    .regex(MOBILE_PHONE, '휴대폰 번호를 확인해주세요'),
  procedureId: z.string().min(1, '희망 시술을 선택해주세요'),
  preferredTime: z.string().min(1, '희망 상담 시간을 선택해주세요'),
  message: z.string().trim().max(500, '500자 이내로 입력해주세요'),
});

export type ConsultRequestInput = z.infer<typeof consultRequestSchema>;
```

- [ ] **Step 4: 스키마 테스트 통과 확인**

Run: `npm run test:run -- src/features/consult/schemas`
Expected: 7 passed

- [ ] **Step 5: api와 훅 구현**

`frontend/src/features/consult/api/consultApi.ts` — 기존 `store/useConsultStore.ts`의 `addRequest`/`updateStatus`/`addMemo` 로직을 그대로 옮긴다. **`notifyAdmin`/`notifyUser` 호출과 그 문구를 유지한다** — 상담 신청 시 관리자 알림, 상태 변경 시 사용자 알림은 기존 동작이다.

```ts
import { mockDb } from '@/mocks/db';
import { delay } from '@/mocks/latency';
import { notifyAdmin, notifyUser } from '@/services/notifications';
import { CONSULT_STATUS_LABEL, type ConsultRequest, type ConsultStatus } from '@/types/domain';
import type { ConsultRequestInput } from '@/features/consult/schemas/consultRequestSchema';

export async function fetchConsultRequests(): Promise<ConsultRequest[]> {
  await delay();
  return mockDb.read('consultRequests');
}

export async function fetchConsultRequestById(id: string): Promise<ConsultRequest | null> {
  await delay();
  return mockDb.read('consultRequests').find((request) => request.id === id) ?? null;
}

export async function createConsultRequest(
  input: ConsultRequestInput & { hospitalId: string }
): Promise<ConsultRequest> {
  await delay();

  const id = `consult-${Date.now()}`;
  const now = new Date().toISOString();
  const request: ConsultRequest = {
    ...input,
    id,
    createdAt: now,
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: now }],
    memos: [],
  };

  mockDb.write('consultRequests', [request, ...mockDb.read('consultRequests')]);

  notifyAdmin({
    type: 'consult-status',
    title: '새로운 상담 신청',
    message: `${input.name}님이 상담을 신청했어요`,
    relatedId: id,
  });

  return request;
}

export async function updateConsultStatus(
  id: string,
  status: ConsultStatus
): Promise<ConsultRequest> {
  await delay();

  const rows = mockDb.read('consultRequests');
  const index = rows.findIndex((request) => request.id === id);
  if (index === -1) throw new Error(`상담 신청을 찾을 수 없어요: ${id}`);

  const now = new Date().toISOString();
  const updated: ConsultRequest = {
    ...rows[index],
    status,
    statusHistory: [...rows[index].statusHistory, { status, changedAt: now }],
  };

  const next = [...rows];
  next[index] = updated;
  mockDb.write('consultRequests', next);

  notifyUser({
    type: 'consult-status',
    title: '상담 상태 변경',
    message: `상담 상태가 '${CONSULT_STATUS_LABEL[status]}'(으)로 변경되었어요`,
    relatedId: id,
  });

  return updated;
}

export async function addConsultMemo(id: string, content: string): Promise<ConsultRequest> {
  await delay();

  const rows = mockDb.read('consultRequests');
  const index = rows.findIndex((request) => request.id === id);
  if (index === -1) throw new Error(`상담 신청을 찾을 수 없어요: ${id}`);

  const memo = { id: `memo-${Date.now()}`, content, createdAt: new Date().toISOString() };
  const updated: ConsultRequest = { ...rows[index], memos: [...rows[index].memos, memo] };

  const next = [...rows];
  next[index] = updated;
  mockDb.write('consultRequests', next);

  return updated;
}
```

`frontend/src/features/consult/hooks/useCreateConsultRequest.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createConsultRequest } from '@/features/consult/api/consultApi';
import { queryKeys } from '@/lib/queryKeys';

export function useCreateConsultRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConsultRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.consultRequests.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
```

`useConsultRequests.ts`, `useConsultRequest.ts`, `useUpdateConsultStatus.ts`, `useAddConsultMemo.ts`도 같은 형태로 작성한다. 상태 변경·메모 mutation은 `onSuccess`에서 `queryKeys.consultRequests.all`과 `.detail(id)` 둘 다 무효화한다.

- [ ] **Step 6: 폼 컴포넌트의 실패하는 테스트 작성**

`frontend/src/features/consult/components/ConsultRequestForm.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConsultRequestForm } from '@/features/consult/components/ConsultRequestForm';
import { renderWithProviders } from '@/test/renderWithProviders';

const procedures = [{ id: 'implant', name: '임플란트' }];

describe('ConsultRequestForm', () => {
  it('전화번호 형식이 틀리면 제출하지 않고 에러를 보여준다', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ConsultRequestForm procedures={procedures} onSubmit={onSubmit} isSubmitting={false} />
    );

    await userEvent.type(screen.getByLabelText('이름'), '박지영');
    await userEvent.type(screen.getByLabelText('연락처'), '1234');
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() =>
      expect(screen.getByText('휴대폰 번호를 확인해주세요')).toBeInTheDocument()
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('올바르게 채우면 onSubmit 을 검증된 값으로 호출한다', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <ConsultRequestForm procedures={procedures} onSubmit={onSubmit} isSubmitting={false} />
    );

    await userEvent.type(screen.getByLabelText('이름'), '박지영');
    await userEvent.type(screen.getByLabelText('연락처'), '010-1234-5678');
    await userEvent.click(screen.getByRole('button', { name: '임플란트' }));
    await userEvent.click(screen.getByRole('button', { name: '상담 신청하기' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: '박지영',
      phone: '010-1234-5678',
      procedureId: 'implant',
    });
  });

  it('제출 중에는 버튼이 비활성화된다', () => {
    renderWithProviders(
      <ConsultRequestForm procedures={procedures} onSubmit={vi.fn()} isSubmitting />
    );
    expect(screen.getByRole('button', { name: '상담 신청하기' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
```

- [ ] **Step 7: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/features/consult/components`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 8: 폼 컴포넌트 구현**

`frontend/src/features/consult/components/ConsultRequestForm.tsx`. RHF + zodResolver를 쓰고, **필드별 에러를 입력 아래에 렌더한다**(현재는 `window.alert` 하나로 처리). 라벨은 `htmlFor`/`id`로 연결한다 — 테스트의 `getByLabelText`가 이걸 요구하고, 접근성 결함도 같이 해소된다.

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  consultRequestSchema,
  type ConsultRequestInput,
} from '@/features/consult/schemas/consultRequestSchema';

const TIME_SLOTS = ['평일 오전', '평일 오후', '주말'];

interface ConsultRequestFormProps {
  procedures: { id: string; name: string }[];
  onSubmit: (input: ConsultRequestInput) => void;
  isSubmitting: boolean;
}

export function ConsultRequestForm({
  procedures,
  onSubmit,
  isSubmitting,
}: ConsultRequestFormProps) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConsultRequestInput>({
    resolver: zodResolver(consultRequestSchema),
    defaultValues: {
      name: '',
      phone: '',
      procedureId: procedures[0]?.id ?? '',
      preferredTime: TIME_SLOTS[0],
      message: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="consult-name" className="mb-2 block text-sm font-semibold text-neutral-700">
        이름
      </label>
      <input
        id="consult-name"
        {...register('name')}
        placeholder="이름을 입력해주세요"
        aria-invalid={Boolean(errors.name)}
        className="mb-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[15px]"
      />
      {errors.name ? (
        <p role="alert" className="mb-3 text-xs text-rose-500">
          {errors.name.message}
        </p>
      ) : null}

      {/* 연락처 · 희망 시술(Controller + Chip) · 희망 상담 시간 · 남기고 싶은 말을
          같은 형태로 이어서 작성한다. Chip 은 Pressable 기반이라 Controller 로 감싼다. */}

      <PrimaryButton label="상담 신청하기" type="submit" disabled={isSubmitting} />
    </form>
  );
}
```

`PrimaryButton`이 `type="submit"`을 지원하지 않으면(`src/components/PrimaryButton.tsx` 확인) `type` prop을 추가한다. `Pressable` 기반이라 `div role="button"`을 렌더하므로 form submit이 안 걸린다 — 이 경우 `PrimaryButton`에 `type` prop을 받아 `button` 엘리먼트로 렌더하는 분기를 추가하고, 기존 호출부는 영향받지 않게 기본값을 현재 동작으로 둔다.

- [ ] **Step 9: 폼 테스트 통과 확인**

Run: `npm run test:run -- src/features/consult`
Expected: 10 passed (스키마 7 + 폼 3)

- [ ] **Step 10: 페이지 이관과 스토어 삭제**

레시피를 적용해 `screens/consult/[hospitalId].tsx` → `pages/ConsultRequestPage.tsx`. 페이지는 `useHospital`로 병원을 받고, `useCreateConsultRequest()`의 `mutate`를 폼의 `onSubmit`에 연결하고, 성공 시 기존과 동일하게 `showAlert('상담 신청이 접수되었어요', ...)` 후 `router.back()`을 호출한다. 로그인 가드(`:29-34`)는 그대로 유지한다.

`git rm src/store/useConsultStore.ts` 후 남은 참조를 확인한다. `screens/admin/consultations/*`가 이 스토어를 쓰므로 **그 화면들도 이 Task에서 훅으로 바꾼다** — 안 그러면 typecheck가 깨진다.

- [ ] **Step 11: 브라우저에서 상담 신청 실제 동작 확인**

`npm run dev` → 로그인 후 `/consult/<병원 id>`에서 잘못된 전화번호로 제출 시 필드 에러가 뜨는지, 올바른 값으로 제출 후 `/admin/consultations`에 **실제로 저장되어 나타나는지** 확인한다. (프로젝트 QA 규칙: 상담신청은 데이터 저장 확인)

- [ ] **Step 12: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "feat(frontend): rebuild consult request on React Hook Form + Zod

length>0 검사만 있던 폼에 필드 단위 검증과 에러 표시를 넣고,
useConsultStore 를 consult feature 의 api/mutation 으로 대체한다."
```

---

## Task 7: auth feature — 역할(role) 도입과 RHF/Zod 폼

Critical #1의 근본 원인은 `User`에 `role`이 없다는 것이다. 인가 가드(Task 8)를 붙이려면 먼저 모델에 역할이 있어야 한다.

**Files:**
- Modify: `src/types/domain.ts` (`User`에 `role` 추가)
- Create: `src/features/auth/schemas/authSchemas.ts`
- Create: `src/features/auth/schemas/authSchemas.test.ts`
- Create: `src/features/auth/hooks/useSession.ts`
- Create: `src/features/auth/index.ts`
- Move: `src/store/useAuthStore.ts` → `src/stores/useAuthStore.ts` (+ `role` 지원)
- Create: `src/stores/useAuthStore.test.ts`
- Move: `src/screens/auth/login.tsx` → `src/pages/LoginPage.tsx`
- Move: `src/screens/auth/signup.tsx` → `src/pages/SignupPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: 없음 (auth는 클라이언트 상태로 남는다 — 세션은 서버 상태가 아니다)
- Produces:
  - `User.role: 'user' | 'admin'`
  - `loginSchema`, `signupSchema` (zod) + `LoginInput`, `SignupInput`
  - `useSession(): { user: User | null; isAdmin: boolean; isAuthenticated: boolean }`

- [ ] **Step 1: 스토어의 실패하는 테스트 작성**

`frontend/src/stores/useAuthStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/useAuthStore';

function reset() {
  window.localStorage.clear();
  useAuthStore.setState({ user: null, accounts: [] });
}

describe('useAuthStore', () => {
  beforeEach(reset);

  it('신규 가입 계정의 기본 역할은 user 다', () => {
    useAuthStore.getState().signUp({ email: 'a@b.com', password: 'pw123456', name: '박지영' });
    expect(useAuthStore.getState().user?.role).toBe('user');
  });

  it('중복 이메일 가입을 거부한다', () => {
    const { signUp } = useAuthStore.getState();
    signUp({ email: 'a@b.com', password: 'pw123456', name: '박지영' });
    const result = useAuthStore.getState().signUp({
      email: 'A@B.com',
      password: 'pw123456',
      name: '다른사람',
    });
    expect(result).toEqual({ ok: false, message: '이미 가입된 이메일이에요' });
  });

  it('로그아웃하면 user 가 null 이 된다', () => {
    useAuthStore.getState().signUp({ email: 'a@b.com', password: 'pw123456', name: '박지영' });
    useAuthStore.getState().logOut();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('role 없이 저장돼 있던 기존 계정은 user 로 취급한다', () => {
    useAuthStore.setState({
      accounts: [
        // role 필드가 없는 구버전 레코드
        { id: 'u1', email: 'old@b.com', name: '기존', password: 'pw123456', provider: 'email' },
      ] as never,
      user: null,
    });

    const result = useAuthStore.getState().logIn({ email: 'old@b.com', password: 'pw123456' });
    expect(result.ok).toBe(true);
    expect(useAuthStore.getState().user?.role).toBe('user');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/stores/useAuthStore.test.ts`
Expected: FAIL — `Failed to resolve import "@/stores/useAuthStore"`

- [ ] **Step 3: 도메인 타입에 역할 추가**

`src/types/domain.ts:189`:

```ts
export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  provider: AuthProvider;
  role: UserRole;
}
```

- [ ] **Step 4: 스토어 이동과 역할 지원**

```bash
mkdir -p src/stores
git mv src/store/useAuthStore.ts src/stores/useAuthStore.ts
```

`StoredAccount`에 `role: UserRole`을 추가하고, `toUser`에서 **구버전 레코드 폴백**을 넣는다. 폴백이 없으면 이미 가입한 브라우저에서 `role`이 `undefined`가 되어 Task 8의 가드가 오작동한다:

```ts
function toUser(account: StoredAccount): User {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    provider: account.provider,
    // role 이 없던 시절 저장된 계정은 일반 사용자로 취급한다.
    role: account.role ?? 'user',
  };
}
```

`signUp`이 만드는 계정의 `role`은 `'user'`로 고정한다.

**관리자 계정을 어떻게 만드는가:** 실제 백엔드가 없으므로 UI로 승격시킬 수단이 없다. 목 단계에서는 환경변수로 지정한 이메일만 관리자로 취급한다. `src/config/adminAllowlist.ts`:

```ts
// 목 인증 단계의 임시 수단. 실제 백엔드가 붙으면 서버가 role 을 내려주고 이 파일은 삭제한다.
// VITE_ 로 노출되는 값이므로 비밀이 아니다 — 이메일 목록만 담고 비밀번호는 절대 넣지 않는다.
const RAW = import.meta.env.VITE_ADMIN_EMAILS ?? '';

export const ADMIN_EMAILS = RAW.split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
```

`toUser`의 `role`을 `isAdminEmail(account.email) ? 'admin' : (account.role ?? 'user')`로 바꾼다. `frontend/.env.example`에 항목을 추가한다:

```
# 목 인증 단계에서 관리자로 취급할 이메일 목록 (쉼표 구분).
# 실제 백엔드가 role 을 내려주게 되면 이 변수와 src/config/adminAllowlist.ts 는 삭제한다.
VITE_ADMIN_EMAILS=
```

- [ ] **Step 5: 스토어 테스트 통과 확인**

Run: `npm run test:run -- src/stores/useAuthStore.test.ts`
Expected: 4 passed. `store/` → `stores/` 이동으로 다른 파일들이 깨지므로 `grep -rl "@/store/useAuthStore" src/ | xargs sed -i "s|@/store/useAuthStore|@/stores/useAuthStore|g"`로 일괄 수정한다.

- [ ] **Step 6: 세션 훅과 폼 스키마**

`frontend/src/features/auth/hooks/useSession.ts`:

```ts
import { useAuthStore } from '@/stores/useAuthStore';

export function useSession() {
  const user = useAuthStore((state) => state.user);

  return {
    user,
    isAuthenticated: user !== null,
    isAdmin: user?.role === 'admin',
  };
}
```

`frontend/src/features/auth/schemas/authSchemas.ts`:

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, '이메일을 입력해주세요').email('이메일 형식을 확인해주세요'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해주세요').max(20, '이름이 너무 길어요'),
    email: z.string().trim().min(1, '이메일을 입력해주세요').email('이메일 형식을 확인해주세요'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 해요'),
    passwordConfirm: z.string().min(1, '비밀번호를 다시 입력해주세요'),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않아요',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
```

`authSchemas.test.ts`에 각 규칙당 최소 1개씩 테스트를 쓴다(빈 이메일, 잘못된 형식, 짧은 비밀번호, 불일치 확인, 정상 통과).

- [ ] **Step 7: 로그인/회원가입 페이지 이관**

레시피를 적용해 `screens/auth/login.tsx` → `pages/LoginPage.tsx`, `screens/auth/signup.tsx` → `pages/SignupPage.tsx`. `useState` 검증을 Task 6의 `ConsultRequestForm`과 동일한 RHF + zodResolver 형태로 바꾸고, 에러를 필드 아래에 렌더한다. 로그인 성공 후 `redirect` 파라미터로 돌아가는 기존 동작을 유지한다.

- [ ] **Step 8: 브라우저에서 로그인/로그아웃 실제 동작 확인**

`npm run dev` → 회원가입 → 로그아웃 → 로그인. **상태 변경이 화면에 반영되는지**(마이페이지, 헤더) 확인한다. `.env`에 `VITE_ADMIN_EMAILS`에 넣은 이메일로 로그인하면 `useSession().isAdmin`이 `true`가 되는지 React DevTools 또는 임시 로그로 확인한다. (프로젝트 QA 규칙: 로그인/로그아웃은 상태 변경 + 화면 반영 확인)

- [ ] **Step 9: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src frontend/.env.example
git commit -m "feat(frontend): add user roles and move auth forms to RHF + Zod

User.role 을 도입하고 store/ 를 stores/ 로 옮긴다. 관리자 판정은
목 단계 임시 수단으로 VITE_ADMIN_EMAILS allowlist 를 쓴다."
```

---

## Task 8: 관리자 화면 인가 가드 (Critical #1)

현재 `/admin/**` 7개 화면에 인증·인가 검사가 **하나도 없다.** `/admin/consultations`는 고객 실명과 전화번호를 렌더하므로 URL만 알면 누구나 열람할 수 있다.

**Files:**
- Create: `src/features/auth/components/RequireAdmin.tsx`
- Create: `src/features/auth/components/RequireAdmin.test.tsx`
- Modify: `src/App.tsx` (`ROUTES`에 `guard` 필드 추가 + 렌더에 적용)
- Modify: `src/hooks/useRequireAuth.ts` → `src/features/auth/hooks/useRequireAuth.ts`로 이동

**Interfaces:**
- Consumes: `useSession` (Task 7)
- Produces: `<RequireAdmin>{children}</RequireAdmin>`, `AppRoute.guard?: 'auth' | 'admin'`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/features/auth/components/RequireAdmin.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';

import { RequireAdmin } from '@/features/auth/components/RequireAdmin';
import { useAuthStore } from '@/stores/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { User } from '@/types/domain';

const adminUser: User = {
  id: 'a1', email: 'admin@mola.kr', name: '관리자', provider: 'email', role: 'admin',
};
const normalUser: User = {
  id: 'u1', email: 'user@mola.kr', name: '박지영', provider: 'email', role: 'user',
};

describe('RequireAdmin', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accounts: [] });
  });

  it('비로그인 사용자에게 내용을 보여주지 않는다', () => {
    renderWithProviders(<RequireAdmin><div>상담 목록</div></RequireAdmin>);
    expect(screen.queryByText('상담 목록')).not.toBeInTheDocument();
  });

  it('일반 사용자에게 내용을 보여주지 않고 안내를 띄운다', () => {
    useAuthStore.setState({ user: normalUser });
    renderWithProviders(<RequireAdmin><div>상담 목록</div></RequireAdmin>);

    expect(screen.queryByText('상담 목록')).not.toBeInTheDocument();
    expect(screen.getByText('접근 권한이 없어요')).toBeInTheDocument();
  });

  it('관리자에게는 내용을 보여준다', () => {
    useAuthStore.setState({ user: adminUser });
    renderWithProviders(<RequireAdmin><div>상담 목록</div></RequireAdmin>);
    expect(screen.getByText('상담 목록')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/features/auth/components`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 3: 가드 구현**

`frontend/src/features/auth/components/RequireAdmin.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/hooks/useSession';
import { router } from '@/navigation';
import { SafeAreaView, Text } from '@/primitives';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin } = useSession();

  useEffect(() => {
    // 비로그인은 로그인 화면으로 보낸다. 로그인했지만 권한이 없으면
    // 리다이렉트하지 않고 안내만 띄운다 — 로그인 루프를 만들지 않기 위해서다.
    if (!isAuthenticated) {
      router.replace({ pathname: '/auth/login', params: { redirect: window.location.pathname } });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-sm text-neutral-500">접근 권한이 없어요</Text>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
```

같은 파일 패턴으로 `RequireAuth.tsx`도 만든다(로그인만 요구, 안내 문구 `로그인이 필요해요`). `src/hooks/useRequireAuth.ts`는 `src/features/auth/hooks/`로 옮기고 참조를 일괄 수정한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/features/auth/components`
Expected: 3 passed

- [ ] **Step 5: 라우트 테이블에 가드 적용**

`src/App.tsx`의 `AppRoute`에 `guard`를 추가한다:

```tsx
interface AppRoute {
  path: string;
  element: ReactNode;
  options: ScreenOptions;
  isTab?: boolean;
  guard?: 'auth' | 'admin';
}
```

`/admin`으로 시작하는 **7개 라우트 전부**에 `guard: 'admin'`을 붙인다: `/admin`, `/admin/hospital/new`, `/admin/hospital/:id`, `/admin/specialists`, `/admin/consultations`, `/admin/consultations/:id`, `/admin/notifications`.

`/consult/:hospitalId`와 `/notifications`에는 `guard: 'auth'`를 붙인다(`/consult`는 현재 화면 내부에서 처리하고 있는데, 라우트 선언으로 올려서 한 곳에서 보이게 한다).

렌더 부분에서 가드로 감싼다:

```tsx
function withGuard(element: ReactNode, guard: AppRoute['guard']) {
  if (guard === 'admin') return <RequireAdmin>{element}</RequireAdmin>;
  if (guard === 'auth') return <RequireAuth>{element}</RequireAuth>;
  return element;
}

// Routes 안
<Route path={route.path} element={withGuard(route.element, route.guard)} />
```

- [ ] **Step 6: 브라우저에서 인가 확인**

`npm run dev`, 그리고 **시크릿 창**에서:

1. 로그아웃 상태로 `/admin/consultations` 직접 입력 → 로그인 화면으로 이동하고 고객 정보가 보이지 않는지
2. 일반 계정으로 로그인 후 `/admin/consultations` → `접근 권한이 없어요`
3. `.env`의 `VITE_ADMIN_EMAILS`에 넣은 계정으로 로그인 → 정상 열람
4. `/admin/hospital/new`, `/admin/specialists`, `/admin/notifications`도 1~3 반복

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "fix(frontend): gate admin routes behind an admin-role check

인가 검사가 전혀 없어 비로그인 방문자가 /admin/consultations 에서
고객 실명·연락처를 열람할 수 있었다. 라우트 테이블에 guard 를 선언한다."
```

---

## Task 9: community feature

**Files:**
- Create: `src/features/community/api/communityApi.ts`
- Create: `src/features/community/schemas/postSchema.ts` + `.test.ts`
- Create: `src/features/community/hooks/{useCommunityPosts,useCommunityPost,useCreatePost}.ts`
- Create: `src/features/community/index.ts`
- Move: `src/screens/tabs/community.tsx` → `src/pages/CommunityPage.tsx`
- Move: `src/screens/community/[id].tsx` → `src/pages/CommunityPostPage.tsx`
- Move: `src/screens/community/new.tsx` → `src/pages/CommunityNewPage.tsx`
- Modify: `src/App.tsx`
- Delete: `src/store/useCommunityStore.ts`

**Interfaces:**
- Consumes: `mockDb`, `delay`, `queryKeys`
- Produces: `fetchCommunityPosts()`, `fetchCommunityPostById(id)`, `createCommunityPost(input)`, `postSchema`, `useCommunityPosts()`, `useCommunityPost(id)`, `useCreatePost()`

- [ ] **Step 1: 스키마 테스트 작성**

`src/screens/community/new.tsx`를 열어 현재 어떤 필드를 받는지 확인하고, 그 필드에 맞춰 스키마 테스트를 쓴다. 최소 케이스: 제목 빈 값 거부, 제목 100자 초과 거부, 본문 빈 값 거부, 정상 통과.

```ts
import { describe, expect, it } from 'vitest';

import { postSchema } from '@/features/community/schemas/postSchema';

const valid = { title: '임플란트 문의', content: '가격이 궁금해요', procedureId: 'implant' };

describe('postSchema', () => {
  it('제목이 비면 거부한다', () => {
    const result = postSchema.safeParse({ ...valid, title: '  ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe('제목을 입력해주세요');
  });

  it('본문이 비면 거부한다', () => {
    expect(postSchema.safeParse({ ...valid, content: '' }).success).toBe(false);
  });

  it('시술을 고르지 않으면 거부한다', () => {
    expect(postSchema.safeParse({ ...valid, procedureId: '' }).success).toBe(false);
  });

  it('올바른 입력을 통과시킨다', () => {
    expect(postSchema.safeParse(valid).success).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/features/community`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 3: 스키마·api·훅 구현**

`frontend/src/features/community/api/communityApi.ts`. 기존 `store/useCommunityStore.ts`를 열어 액션 목록(글 추가, 답변 추가 등)을 확인하고 **그 로직을 그대로** 옮긴다. 아래는 글 목록·상세·작성까지의 골격이다:

```ts
import { mockDb } from '@/mocks/db';
import { delay } from '@/mocks/latency';
import type { ProcedureId, QAPost } from '@/types/domain';
import type { PostInput } from '@/features/community/schemas/postSchema';

export async function fetchCommunityPosts(): Promise<QAPost[]> {
  await delay();
  return mockDb.read('communityPosts');
}

export async function fetchCommunityPostById(id: string): Promise<QAPost | null> {
  await delay();
  return mockDb.read('communityPosts').find((post) => post.id === id) ?? null;
}

export async function createCommunityPost(
  input: PostInput & { authorName: string }
): Promise<QAPost> {
  await delay();

  // id 접두사와 createdAt 형식(YYYY-MM-DD 로 자른 것)은 기존 useCommunityStore.addPost 와 같게 둔다.
  const post: QAPost = {
    ...input,
    procedureId: input.procedureId as ProcedureId,
    id: `q-${Date.now()}`,
    createdAt: new Date().toISOString().slice(0, 10),
    viewCount: 0,
    answers: [],
  };

  mockDb.write('communityPosts', [post, ...mockDb.read('communityPosts')]);
  return post;
}

export async function incrementPostView(id: string): Promise<void> {
  const rows = mockDb.read('communityPosts');
  mockDb.write(
    'communityPosts',
    rows.map((post) => (post.id === id ? { ...post, viewCount: post.viewCount + 1 } : post))
  );
}
```

`procedureId as ProcedureId` 캐스트는 Zod 스키마가 `z.string()`이라서 생긴다. Task 14에서 스키마를 `z.enum`으로 좁혀 캐스트를 없앤다.

`frontend/src/features/community/hooks/useCommunityPosts.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchCommunityPosts } from '@/features/community/api/communityApi';
import { queryKeys } from '@/lib/queryKeys';

export function useCommunityPosts() {
  return useQuery({
    queryKey: queryKeys.communityPosts.all,
    queryFn: fetchCommunityPosts,
  });
}
```

`frontend/src/features/community/hooks/useCommunityPost.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import { fetchCommunityPostById } from '@/features/community/api/communityApi';
import { queryKeys } from '@/lib/queryKeys';

export function useCommunityPost(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.communityPosts.detail(id ?? ''),
    queryFn: () => fetchCommunityPostById(id as string),
    enabled: Boolean(id),
  });
}
```

`frontend/src/features/community/hooks/useCreatePost.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createCommunityPost } from '@/features/community/api/communityApi';
import { queryKeys } from '@/lib/queryKeys';

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCommunityPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communityPosts.all });
    },
  });
}
```

`postSchema.ts`:

```ts
import { z } from 'zod';

export const postSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요').max(100, '제목은 100자 이내로 입력해주세요'),
  // 도메인 타입 QAPost 의 본문 필드 이름은 content 다 (body 가 아니다).
  content: z.string().trim().min(1, '내용을 입력해주세요').max(2000, '2000자 이내로 입력해주세요'),
  procedureId: z.string().min(1, '시술을 선택해주세요'),
});

export type PostInput = z.infer<typeof postSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test:run -- src/features/community`
Expected: 3 passed

- [ ] **Step 5: 페이지 3개 이관**

레시피 적용. `CommunityNewPage`는 Task 6의 폼 패턴(RHF + zodResolver + 필드 에러)을 따른다.

- [ ] **Step 6: 스토어 삭제와 참조 정리**

```bash
git rm src/store/useCommunityStore.ts
grep -rn "useCommunityStore" src/ && echo "남은 참조 정리 필요" || echo "OK"
```

- [ ] **Step 7: 브라우저에서 글 작성 확인**

`/community/new`에서 빈 제목으로 제출 → 필드 에러. 정상 작성 → `/community` 목록에 실제로 나타나는지 확인.

- [ ] **Step 8: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "feat(frontend): add community feature with Zod-validated post form"
```

---

## Task 10: notification feature

**Files:**
- Create: `src/features/notification/api/notificationApi.ts`
- Create: `src/features/notification/hooks/{useNotifications,useMarkAsRead}.ts`
- Create: `src/features/notification/hooks/useNotifications.test.tsx`
- Create: `src/features/notification/index.ts`
- Move: `src/screens/notifications.tsx` → `src/pages/NotificationsPage.tsx`
- Move: `src/screens/admin/notifications.tsx` → `src/pages/admin/AdminNotificationsPage.tsx`
- Modify: `src/services/notifications.ts` (스토어 직접 호출 → api 호출)
- Modify: `src/App.tsx`
- Delete: `src/store/useNotificationStore.ts`

**Interfaces:**
- Consumes: `mockDb`, `delay`, `queryKeys`
- Produces: `fetchNotifications(audience)`, `markNotificationAsRead(id)`, `addNotification(input)`, `useNotifications(audience)`, `useMarkAsRead()`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useNotifications } from '@/features/notification';
import { queryWrapper } from '@/test/queryWrapper';

describe('useNotifications', () => {
  it('audience=admin 은 관리자 알림만 반환한다', async () => {
    const { result } = renderHook(() => useNotifications('admin'), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.every((n) => n.audience === 'admin')).toBe(true);
  });

  it('audience=user 는 사용자 알림만 반환한다', async () => {
    const { result } = renderHook(() => useNotifications('user'), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.every((n) => n.audience === 'user')).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test:run -- src/features/notification`
Expected: FAIL — `Failed to resolve import "@/features/notification"`

- [ ] **Step 3: api 구현**

`frontend/src/features/notification/api/notificationApi.ts`:

```ts
import { mockDb } from '@/mocks/db';
import { delay } from '@/mocks/latency';
import type { AppNotification } from '@/types/domain';

export type NotificationAudience = 'user' | 'admin';

export async function fetchNotifications(
  audience: NotificationAudience
): Promise<AppNotification[]> {
  await delay();
  return mockDb.read('notifications').filter((item) => item.audience === audience);
}

/**
 * 훅 밖(services/notifications.ts)에서도 호출된다. 그래서 여기서는 캐시를 만지지 않고,
 * 무효화는 호출하는 쪽이 책임진다 — 훅이면 mutation 의 onSuccess, 서비스면 Step 5 참고.
 */
export async function addNotification(
  input: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>
): Promise<AppNotification> {
  await delay();

  const notification: AppNotification = {
    ...input,
    id: `noti-${Date.now()}`,
    createdAt: new Date().toISOString(),
    isRead: false,
  };

  mockDb.write('notifications', [notification, ...mockDb.read('notifications')]);
  return notification;
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  await delay();

  const rows = mockDb.read('notifications');
  const index = rows.findIndex((item) => item.id === id);
  if (index === -1) throw new Error(`알림을 찾을 수 없어요: ${id}`);

  const updated = { ...rows[index], isRead: true };
  const next = [...rows];
  next[index] = updated;
  mockDb.write('notifications', next);
  return updated;
}
```

`AppNotification`의 실제 이름과 필드(`audience`, `isRead`, `type`, `relatedId`)는 `src/types/domain.ts`와 `src/mocks/fixtures/notifications.ts`에서 확인해 맞춘다. `services/notifications.ts`가 이미 `type`/`title`/`message`/`relatedId`를 넘기고 있으므로 그 4개는 확실하다.

- [ ] **Step 4: 훅 구현과 테스트 통과 확인**

`frontend/src/features/notification/hooks/useNotifications.ts`:

```ts
import { useQuery } from '@tanstack/react-query';

import {
  fetchNotifications,
  type NotificationAudience,
} from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';

export function useNotifications(audience: NotificationAudience) {
  return useQuery({
    queryKey: queryKeys.notifications.byAudience(audience),
    queryFn: () => fetchNotifications(audience),
  });
}
```

`frontend/src/features/notification/hooks/useMarkAsRead.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { markNotificationAsRead } from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      // audience 별 키가 나뉘어 있으므로 접두사 전체를 무효화한다.
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
```

Run: `npm run test:run -- src/features/notification`
Expected: 2 passed

- [ ] **Step 4b: 서비스 함수를 api로 연결**

`src/services/notifications.ts`의 `notifyAdmin`/`notifyUser`는 현재 `useNotificationStore.getState().addNotification(...)`을 호출한다(`:17`, `:27`). 이걸 api 호출로 바꾸는데, **훅 밖이라 `useQueryClient()`를 쓸 수 없다.** `queryClient` 인스턴스를 모듈에서 꺼내 쓴다.

`src/app/providers.tsx`에서 인스턴스를 export한다:

```ts
export const queryClient = new QueryClient({ /* 기존 옵션 유지 */ });
```

`src/services/notifications.ts`:

```ts
import { queryClient } from '@/app/providers';
import { addNotification } from '@/features/notification/api/notificationApi';
import { queryKeys } from '@/lib/queryKeys';

// 기존 notifyAdmin/notifyUser 의 시그니처와 호출부는 바꾸지 않는다.
// consult/community api 가 이 함수들을 그대로 부르고 있다.
async function notify(
  audience: 'user' | 'admin',
  input: { type: string; title: string; message: string; relatedId?: string }
) {
  await addNotification({ ...input, audience } as never);
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
}
```

`as never`는 임시 표현이다 — `AppNotification`의 실제 필드에 맞춰 `Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>` 타입으로 정확히 맞추고 **캐스트를 제거한다.** `notifyAdmin`/`notifyUser`는 이 `notify`를 각각 `'admin'`/`'user'`로 호출하는 얇은 래퍼로 남긴다.

- [ ] **Step 5: 페이지 2개 이관과 스토어 삭제**

레시피 적용. 관리자 알림 페이지는 Task 8의 `guard: 'admin'` 아래에 있다. `git rm src/store/useNotificationStore.ts`.

- [ ] **Step 6: 브라우저 확인**

상담 신청 → `/admin/notifications`에 새 알림이 뜨는지, 읽음 처리 후 배지 숫자가 줄어드는지 확인한다.

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "feat(frontend): add notification feature and drop useNotificationStore"
```

---

## Task 11: 나머지 feature — favorites · search · content · procedure

작은 슬라이스 4개를 한 Task로 묶는다. 각자 파일 2~3개 규모이고 서로 의존하지 않아 리뷰어가 함께 판단할 수 있다.

**Files:**
- Move: `src/store/useFavoritesStore.ts` → `src/features/favorites/stores/useFavoritesStore.ts`

> **전제 변경 (2026-08-12).** 이 Task 초안은 "찜은 서버 상태가 아니므로 Zustand 에 그대로 둔다"고 썼다. **틀렸다.** 찜이 계정과 무관해서 A 계정으로 찜한 것이 B 계정에 보이는 것이 확인된 결함이고(`docs/features/known-issues.md`), 이를 고치려면 찜은 `(userId, hospitalId)` 로 서버에 저장되어야 한다 — 즉 **서버 상태가 되고 TanStack Query 가 관리해야 한다.** `docs/api/openapi.yaml` 의 `GET/PUT/DELETE /me/favorites` 가 그 자리다.
>
> 따라서 이 Task 는 Zustand 스토어를 유지하는 것이 아니라 **제거**하는 방향이며, 백엔드 favorites 엔드포인트가 준비된 뒤에 실행한다. 낙관적 업데이트(하트를 눌렀을 때 즉시 반응)는 Query 의 `onMutate` 로 처리한다.
- Create: `src/features/favorites/hooks/useFavorites.ts` + `.test.ts`
- Create: `src/features/search/hooks/useSearch.ts` + `.test.ts`
- Move: `src/components/SearchBar.tsx` → `src/features/search/components/SearchBar.tsx`
- Move: `src/screens/search.tsx` → `src/pages/SearchPage.tsx`
- Create: `src/features/content/api/contentApi.ts` (guides, promotions, events)
- Create: `src/features/content/hooks/{useGuides,usePromotions}.ts`
- Move: `src/components/{GuideCard,PromotionCard,HeroBanner}.tsx` → `src/features/content/components/`
- Move: `src/screens/tips/[id].tsx` → `src/pages/TipDetailPage.tsx`
- Move: `src/screens/events.tsx` → `src/pages/EventsPage.tsx`
- Create: `src/features/procedure/api/procedureApi.ts`
- Move: `src/components/ProcedureCategoryCard.tsx` → `src/features/procedure/components/`
- Move: `src/utils/procedureIcons.ts` → `src/features/procedure/procedureIcons.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `mockDb`, `delay`, `queryKeys`, `useHospitals`, `useDoctors`
- Produces:
  - `useFavorites(): { favoriteIds: string[]; isFavorite(id): boolean; toggle(id): void }`
  - `useSearch(query: string): { hospitals: Hospital[]; doctors: Doctor[] }`
  - `fetchGuides()`, `fetchPromotions()`, `useGuides()`, `usePromotions()`
  - `getProcedureById(id)`, `fetchProcedures()` — procedures는 정적 마스터 데이터라 동기 조회를 유지한다

- [ ] **Step 1: favorites 테스트 작성**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { useFavoritesStore } from '@/features/favorites/stores/useFavoritesStore';

describe('useFavorites', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useFavoritesStore.setState({ hospitalIds: [] });
  });

  it('찜하지 않은 병원은 isFavorite 이 false 다', () => {
    const { result } = renderHook(() => useFavorites());
    expect(result.current.isFavorite('h1')).toBe(false);
  });

  it('toggle 하면 찜 목록에 들어간다', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggle('h1'));
    expect(result.current.isFavorite('h1')).toBe(true);
  });

  it('다시 toggle 하면 빠진다', () => {
    const { result } = renderHook(() => useFavorites());
    act(() => result.current.toggle('h1'));
    act(() => result.current.toggle('h1'));
    expect(result.current.isFavorite('h1')).toBe(false);
  });
});
```

`useFavoritesStore`의 실제 상태 필드 이름은 `src/store/useFavoritesStore.ts`를 열어 확인하고 테스트를 그 이름으로 맞춘다.

- [ ] **Step 2: search 테스트 작성**

```ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSearch } from '@/features/search/hooks/useSearch';
import { mockDb } from '@/mocks/db';
import { queryWrapper } from '@/test/queryWrapper';

describe('useSearch', () => {
  it('빈 질의는 빈 결과를 준다', async () => {
    const { result } = renderHook(() => useSearch('   '), { wrapper: queryWrapper });
    await waitFor(() => expect(result.current.hospitals).toEqual([]));
  });

  it('병원 이름 일부로 찾는다', async () => {
    const target = mockDb.read('hospitals')[0];
    const { result } = renderHook(() => useSearch(target.name.slice(0, 2)), {
      wrapper: queryWrapper,
    });
    await waitFor(() =>
      expect(result.current.hospitals.some((h) => h.id === target.id)).toBe(true)
    );
  });

  it('일치하는 것이 없으면 빈 배열을 준다 (던지지 않는다)', async () => {
    const { result } = renderHook(() => useSearch('존재하지않는병원이름zzz'), {
      wrapper: queryWrapper,
    });
    await waitFor(() => expect(result.current.hospitals).toEqual([]));
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npm run test:run -- src/features/favorites src/features/search`
Expected: FAIL — 모듈 해석 실패

- [ ] **Step 4: 구현**

`useSearch`는 `screens/search.tsx:96,108`의 **렌더 중 `.getState()` 호출을 제거**하는 것이 핵심이다. `useHospitals()`/`useDoctors()`로 받아 `useMemo`로 필터한다:

```ts
import { useMemo } from 'react';

import { useDoctors } from '@/features/doctor';
import { useHospitals } from '@/features/hospital';

export function useSearch(query: string) {
  const trimmed = query.trim();
  const { data: hospitals = [] } = useHospitals();
  const { data: doctors = [] } = useDoctors();

  return useMemo(() => {
    if (!trimmed) return { hospitals: [], doctors: [] };

    const needle = trimmed.toLowerCase();
    return {
      hospitals: hospitals.filter((hospital) => hospital.name.toLowerCase().includes(needle)),
      doctors: doctors.filter((doctor) => doctor.name.toLowerCase().includes(needle)),
    };
  }, [trimmed, hospitals, doctors]);
}
```

`screens/search.tsx`의 기존 매칭 규칙(`:96`의 `name.includes(trimmed)`, 인기 검색어 처리, 최근 검색어 저장 등)을 열어 확인하고 동일하게 유지한다. `screens/search.tsx:34`의 `useDoctorStore.getState()`도 `useDoctors()`로 교체한다.

`favorites`는 서버 상태가 아니므로 **Zustand에 그대로 둔다.** `useFavorites`는 스토어를 감싸는 얇은 훅이다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test:run -- src/features/favorites src/features/search`
Expected: 6 passed

- [ ] **Step 6: 컴포넌트·페이지 이동**

Files 목록의 `git mv`를 수행하고 레시피에 따라 페이지를 이관한다. `screens/tips/[id].tsx:30`의 `getHospitalById` 호출과 `:73`의 `key={index}`를 함께 고친다 — `key`는 문단 텍스트 대신 안정적인 식별자를 쓰거나, 문단 배열이 변하지 않는다면 `key={`${index}-${paragraph.slice(0, 8)}`}`처럼 내용 기반으로 만든다.

- [ ] **Step 7: 브라우저에서 찜하기·검색 확인**

찜하기 토글 후 **새로고침해도 유지되는지**, 마이페이지 찜 목록에 반영되는지 확인한다. 검색어 입력 시 실제 리스트가 바뀌는지, 0건 상태 문구가 나오는지 확인한다. (프로젝트 QA 규칙: 찜하기는 데이터 저장 확인, 검색은 실제 리스트 변경 확인)

- [ ] **Step 8: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "feat(frontend): add favorites, search, content, and procedure features

search 화면의 렌더 중 getState() 호출을 제거하고 useHospitals/useDoctors 로 대체한다."
```

---

## Task 12: admin feature와 남은 관리자 화면 이관

**Files:**
- Delete: `src/store/useHospitalStore.ts` — **이 Task 의 완료 조건이다.** Task 3 에서 이 스토어는 `mockDb` 위임 + 쿼리 무효화라는 임시 형태가 되었다. 관리자 병원 화면이 `useCreateHospital`/`useUpdateHospital` mutation 을 쓰게 되면 스토어와 `@/app/providers` 결합이 함께 사라진다. `grep -rn "useHospitalStore" src/` 가 0건이어야 한다 (Task 3 시점 기준 읽는 파일 14개 — 전부 `useHospitals()`/`useHospital(id)` 로 바꿔야 한다)
- Move: `src/components/admin/HospitalForm.tsx` → `src/features/admin/components/HospitalForm.tsx`
- Move: `src/components/admin/AddressSearchInput.tsx` → `src/features/admin/components/AddressSearchInput.tsx`
- Create: `src/features/admin/schemas/hospitalSchema.ts` + `.test.ts`
- Create: `src/features/admin/hooks/{useCreateHospital,useUpdateHospital,useVerifySpecialist}.ts`
- Move: `src/screens/admin/index.tsx` → `src/pages/admin/AdminHomePage.tsx`
- Move: `src/screens/admin/hospital/new.tsx` → `src/pages/admin/AdminHospitalNewPage.tsx`
- Move: `src/screens/admin/hospital/[id].tsx` → `src/pages/admin/AdminHospitalEditPage.tsx`
- Move: `src/screens/admin/specialists.tsx` → `src/pages/admin/AdminSpecialistsPage.tsx`
- Move: `src/screens/admin/consultations/index.tsx` → `src/pages/admin/AdminConsultationsPage.tsx`
- Move: `src/screens/admin/consultations/[id].tsx` → `src/pages/admin/AdminConsultationDetailPage.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `updateHospital`/`createHospital` (Task 2), `updateDoctor` (Task 5), consult mutation 훅 (Task 6), `RequireAdmin` (Task 8)
- Produces: `hospitalSchema`, `useCreateHospital()`, `useUpdateHospital()`, `useVerifySpecialist()`

- [ ] **Step 1: hospitalSchema 테스트 작성**

`HospitalForm.tsx`(420줄)가 현재 어떤 필드를 다루는지 열어 확인하고, 필수 필드에 대한 테스트를 쓴다. 최소: 병원명 빈 값 거부, 지역 빈 값 거부, 시술 0개 선택 거부, 정상 통과.

- [ ] **Step 2: 실패 확인**

Run: `npm run test:run -- src/features/admin`
Expected: FAIL

- [ ] **Step 3: 스키마와 mutation 훅 구현**

`hospitalSchema`는 Zod로, `HospitalForm`은 RHF로 재작성한다(420줄이라 이 Task에서 가장 무거운 작업). `HospitalForm.tsx:371`의 `key={index}`를 안정적인 키로 바꾼다 — 반복되는 항목(진료 시간, 가격 등)에 이미 `id`가 있으면 그것을 쓰고, 없으면 항목 추가 시 `crypto.randomUUID()`로 id를 부여한다.

- [ ] **Step 4: 테스트 통과 확인 → Step 5: 페이지 6개 이관**

레시피 적용. `admin/consultations/index.tsx:49`와 `[id].tsx:38`의 `getHospitalById` 호출을 `useHospitals()`로 받은 목록에서 찾는 방식으로 바꾼다(Warning #3 마지막 잔여분). `admin/specialists.tsx:26`도 동일.

- [ ] **Step 6: 브라우저에서 관리자 흐름 확인**

관리자 계정으로: 병원 등록 → 목록에 나타남 → 수정 → **병원 상세 페이지(`/hospital/:id`)에 수정 내용이 반영되는지** 확인한다. 이게 Warning #3이 실제로 고쳐졌는지 보는 테스트다(예전에는 낡은 값이 남았다). 상담 상태 변경 → 사용자 알림 생성 확인. 전문의 인증 검수 처리 확인.

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "feat(frontend): add admin feature and migrate admin pages

병원 폼을 RHF + Zod 로 재작성하고 남은 getState() 기반 조회를 훅으로 바꾼다."
```

---

## Task 13: 남은 화면 이관과 `screens/` 삭제

로직이 거의 없는 화면들을 한 번에 옮기고 옛 디렉토리를 없앤다.

**Files:**
- Move: `src/screens/tabs/index.tsx` → `src/pages/HomePage.tsx`
- Move: `src/screens/tabs/mypage.tsx` → `src/pages/MyPagePage.tsx`
- Move: `src/screens/about.tsx` → `src/pages/AboutPage.tsx`
- Move: `src/screens/partner-inquiry.tsx` → `src/pages/PartnerInquiryPage.tsx`
- Move: `src/screens/legal/terms.tsx` → `src/pages/legal/TermsPage.tsx`
- Move: `src/screens/legal/privacy.tsx` → `src/pages/legal/PrivacyPage.tsx`
- Move: `src/screens/legal/location.tsx` → `src/pages/legal/LocationTermsPage.tsx`
- Move: `src/App.tsx` → `src/app/App.tsx`
- Modify: `src/main.tsx`
- Delete: `src/screens/` (비어야 한다), `src/store/` (비어야 한다)

**Interfaces:**
- Consumes: 지금까지의 모든 feature
- Produces: `src/screens/`와 `src/store/`가 존재하지 않는 상태

- [ ] **Step 1: 남은 화면 목록 확인**

```bash
find src/screens -name '*.tsx' | sort
```

Expected: 위 Files의 7개만 남아 있어야 한다. 더 있으면 앞 Task가 미완료다 — 돌아가서 끝낸다.

- [ ] **Step 2: 페이지 렌더 테스트 작성**

정적 화면들이므로 "깨지지 않고 렌더된다"만 확인한다:

```tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AboutPage from '@/pages/AboutPage';
import TermsPage from '@/pages/legal/TermsPage';
import { renderWithProviders } from '@/test/renderWithProviders';

describe('정적 페이지', () => {
  it('AboutPage 가 렌더된다', () => {
    renderWithProviders(<AboutPage />);
    expect(screen.getByText('몰라몰라 알아보기')).toBeInTheDocument();
  });

  it('TermsPage 가 렌더된다', () => {
    renderWithProviders(<TermsPage />);
    expect(document.body.textContent?.length).toBeGreaterThan(0);
  });
});
```

`AboutPage`의 실제 텍스트를 파일에서 확인해 assertion을 맞춘다.

- [ ] **Step 3: 실패 확인 → Step 4: 이동 수행**

레시피 적용. `mypage.tsx:95`의 `getHospitalById` 호출을 `useHospitals()` + `useFavorites()` 조합으로 바꾼다.

- [ ] **Step 5: App.tsx 이동**

```bash
mkdir -p src/app
git mv src/App.tsx src/app/App.tsx
```

`src/main.tsx`의 import를 `@/app/App`으로, `AppProviders` import를 `@/app/providers`로 맞춘다.

- [ ] **Step 6: 옛 디렉토리 제거 확인**

```bash
ls src/screens src/store 2>/dev/null && echo "아직 남아 있음" || echo "정리 완료"
grep -rn "@/screens/\|@/store/" src/ && echo "남은 참조 있음" || echo "참조 없음"
```

둘 다 "정리 완료"/"참조 없음"이어야 한다.

- [ ] **Step 7: 게이트 실행 후 커밋**

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
git add -A frontend/src
git commit -m "refactor(frontend): finish pages/ migration and remove screens/ and store/"
```

---

## Task 14: 잔여 결함 정리와 문서 갱신

**Files:**
- Modify: `src/features/hospital/api/hospitalApi.ts` 또는 해당 위치 (`as Hospital['procedureIds'][number]` 캐스트 제거)
- Modify: `src/components/map/KakaoMap.tsx` (`any` 국소 허용 주석)
- Modify: `frontend/CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `.claude/skills/react-feature/SKILL.md`, `.claude/skills/react-api/SKILL.md`

**Interfaces:**
- Consumes: 완료된 전체 구조
- Produces: 실제 구조와 일치하는 문서

- [ ] **Step 1: 남은 타입 캐스트 제거**

`grep -rn " as " src/ | grep -v "as const"`로 목록을 만든다. `useHospitalFilters`의 `filters.category as Hospital['procedureIds'][number]` 캐스트는 `category` 타입을 `ProcedureId | 'all' | 'recommended'`로 좁혀서 없앤다:

```ts
export type ExploreCategory = ProcedureId | 'all' | 'recommended';

export interface ExploreFilters {
  category: ExploreCategory;
  // ...
}
```

이렇게 하면 `list.filter((h) => h.procedureIds.includes(filters.category))`가 캐스트 없이 통과한다(`category !== 'all' && category !== 'recommended'` 분기 안에서 TypeScript가 좁혀준다).

- [ ] **Step 2: KakaoMap의 any 국소 허용**

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any -- Kakao Maps SDK 는 타입 정의를 제공하지 않는다 */
```

파일 최상단에 두고, 이 파일 밖에서는 쓰지 않는다.

- [ ] **Step 3: `frontend/CLAUDE.md` 재작성**

현재 이 파일은 실제와 다른 구조를 지시하고 있었다. 완료된 구조로 갱신한다:

```markdown
# frontend 개발 규칙

## Stack

React 19 · TypeScript 5.7 · Vite 6 · React Router 7 · TanStack Query 5 · Zustand 5 ·
React Hook Form 7 · Zod 3 · Tailwind 3 · Vitest + React Testing Library

## 구조

src/
├── app/           # App.tsx, providers.tsx — 라우트 테이블과 전역 provider
├── features/      # 도메인 슬라이스. {api,components,hooks,schemas,stores,types}
├── components/    # feature 에 속하지 않는 공용 UI
├── pages/         # 라우트 진입점. 파라미터 읽기 + feature 훅 호출 + 렌더만 한다
├── stores/        # 여러 feature 가 공유하는 클라이언트 전역 상태 (세션)
├── mocks/         # 백엔드 대역. fixtures/ + db.ts
├── lib/           # queryKeys, storage, clipboard
├── navigation/    # 옛 expo-router API shim (건드리지 않는다)
└── primitives/    # 옛 react-native 컴포넌트의 DOM 포팅 (건드리지 않는다)

## 규칙

- 컴포넌트는 API를 직접 호출하지 않는다. 호출은 `features/{f}/api/` 에 둔다.
- 서버 데이터는 TanStack Query 가 관리한다. Zustand 에 복사하지 않는다.
- 클라이언트 전역 상태만 Zustand 에 둔다 (세션, 찜).
- 폼은 React Hook Form + Zod. 스키마는 `features/{f}/schemas/`.
- 도메인 타입의 단일 출처는 `src/types/domain.ts`.
- 쿼리 키는 `src/lib/queryKeys.ts` 한 곳에서 만든다.
- `any` 금지. 예외는 `components/map/KakaoMap.tsx` (Kakao SDK).
- 실제 백엔드가 붙으면 `features/{f}/api/` 내부만 HTTP 로 바꾼다. 훅과 페이지는 그대로다.

## 명령어

npm run dev / build / typecheck / lint / test / test:run / format
```

- [ ] **Step 4: `AGENTS.md`의 구조 설명 갱신**

`AGENTS.md`의 "frontend/ 에서 알아둘 것" 절에서 `src/screens/`·`src/store/`를 언급하는 부분을 새 구조로 고친다. `primitives`·`navigation`·`lib/storage`·아이콘·환경변수 설명은 여전히 맞으므로 유지한다.

- [ ] **Step 5: skill 문서 갱신**

`.claude/skills/react-feature/SKILL.md`에서 "TanStack Query 미설치", "RHF/Zod 미설치", "lint/test 스크립트 없음", 실제 구조 표를 **모두 현재 상태로 고친다.** 이 문서들은 "미설치"를 전제로 쓰여 있어 그대로 두면 앞으로 잘못된 지시를 하게 된다. `.claude/skills/react-api/SKILL.md`의 "백엔드도 API 클라이언트도 없다" 절도 목 백엔드 계층 설명으로 교체한다.

- [ ] **Step 6: 전체 게이트 + 커버리지 확인**

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run dev   # 수동으로 주요 흐름 재확인
```

- [ ] **Step 7: 최종 QA**

프로젝트 규칙(`CLAUDE.md`)에 따라 `qa-master` 에이전트를 호출해 아래를 실제 동작까지 검증한다. QA 통과 전에는 완료가 아니다.

- 로그인/로그아웃 (상태 변경 + 화면 반영)
- 상담신청 (저장 확인)
- 찜하기 (저장 확인)
- 필터/검색 (실제 리스트 변경)
- 폼 제출 (검증 + 제출 후 처리)
- **관리자 인가** (비로그인·일반 사용자가 `/admin/**` 에 접근 불가)

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "docs: align CLAUDE.md, AGENTS.md, and skills with the new structure

frontend/CLAUDE.md 가 지시하던 구조와 실제 코드가 일치하게 되었으므로
문서와 skill 을 현재 상태로 갱신한다."
```

---

## 실행 순서 요약

```
Task 0  도구 (Node·ESLint·Vitest·의존성)
Task 1  목 백엔드 계층
Task 2  TanStack Query + hospital api/hooks
Task 3  hospital 상세 페이지 이관
Task 5  doctor feature          ← Task 4 보다 먼저
Task 4  explore 필터 훅 분리
Task 6  consult + RHF/Zod
Task 7  auth + role
Task 8  관리자 인가 가드 (Critical)
Task 9  community
Task 10 notification
Task 11 favorites·search·content·procedure
Task 12 admin
Task 13 남은 화면 + screens//store/ 삭제
Task 14 잔여 결함 + 문서
```

## 이 계획이 해소하는 검토 결과

| 검토 항목 | 해소 위치 |
|---|---|
| Critical #1 관리자 인가 없음 | Task 7 (role) + Task 8 (가드) |
| Critical #2 평문 비밀번호 | **해소되지 않는다.** 실제 백엔드 도입이 필요하다. Task 7에서 `useAuthStore` 상단 주석에 이 사실을 남긴다 |
| Warning #3 `getState()` 비반응형 읽기 10곳 | Task 3·5·11·12·13에서 호출부별로 제거 |
| Warning #4 컴포넌트의 데이터 계층 직접 참조 | Task 3·5·11·12에서 feature 이동 + props 승격 |
| Warning #5 폼 검증 없음 | Task 6·7·9·12 (RHF + Zod) |
| Warning #6 타입 구멍 | Task 0 (`sticky as any`), Task 14 (캐스트·`any`) |
| Warning #7 `key={index}` 2곳 | Task 11 (`tips`), Task 12 (`HospitalForm`) |
| 린트·테스트 도구 없음 | Task 0 |
| CLAUDE.md와 코드 불일치 | Task 14 |
