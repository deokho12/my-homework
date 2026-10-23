# 몰라몰라 기술 스택

> 이 저장소에서 쓰는 언어·프레임워크·라이브러리·도구를 한곳에 정리한 문서입니다.
>
> - 기준일: 2026-10-22 / 기준 커밋: `0ef948d` (main)
> - 버전은 그날 `node_modules` 에 실제로 설치된 값입니다. **정답은 언제나 각 폴더의 `package.json`** 이고,
>   이 문서는 의존성을 더하거나 뺄 때 함께 고칩니다 ([갱신 방법](#갱신-방법))
> - 각 영역의 자세한 설계는 [더 읽을 문서](#더-읽을-문서)에 있습니다

---

## 한눈에 보기

```
[브라우저]
   │  React 19 SPA (Vite 빌드, localhost:5173)
   │  fetch + Bearer 토큰 → /api/v1/...
   ▼
[NestJS 11 API 서버] (localhost:3000)
   │  Prisma 6
   ▼
[SQLite]  ← 나중에 PostgreSQL 14+ 로 옮기는 것을 전제로 설계
```

| 폴더 | 역할 | 핵심 스택 |
|---|---|---|
| `frontend/` | 웹 앱 (사용자 화면 + 병원 관리자 화면) | React 19, Vite 6, React Router 7, TanStack Query 5, Zustand 5, Tailwind 3 |
| `backend/` | API 서버 | NestJS 11, Prisma 6, SQLite, JWT, Zod |
| `mobile/` | 모바일 앱 자리 | 비어 있음 (미착수) |
| `docs/api/` | API 계약 | OpenAPI 3.1 (`openapi.yaml`). 코드 생성 없이 양쪽이 직접 맞춥니다 |

**양쪽이 같은 버전을 쓰는 도구:** TypeScript 5.7.3 · Zod 3.25.76 · Vitest 3.2.7 · ESLint 9 + typescript-eslint 8.
테스트 러너와 검증 라이브러리를 하나로 맞춰서 설정과 사용법을 한 번만 익히면 됩니다.

**런타임:** Node.js (개발 기기 기준 v24.18.0). 저장소에 `.nvmrc`·`engines` 고정은 아직 없습니다.

---

## 1. 프론트엔드 (`frontend/`)

원래 Expo(React Native) 앱이었고, 지금은 **웹 전용 React 앱**입니다. React Native 코드는 남아 있지 않습니다.

### 1-1. 런타임 의존성

| 영역 | 라이브러리 | 버전 | 쓰는 방식 |
|---|---|---|---|
| UI | `react`, `react-dom` | 19.2.3 | |
| 라우팅 | `react-router-dom` | 7.18 | 라우트 목록은 `src/App.tsx` 의 `ROUTES` 테이블 하나에 모여 있습니다 |
| 서버 상태 | `@tanstack/react-query` | 5.101 | 서버에서 오는 데이터는 모두 Query 가 캐시합니다. 쿼리 키는 `src/lib/queryKeys.ts` |
| 클라이언트 상태 | `zustand` | 5.0 | 인증(`useAuthStore`), 관리자가 고른 병원, 스크롤 그림자. **서버 데이터는 넣지 않습니다** |
| 폼 | `react-hook-form` + `@hookform/resolvers` | 7.85 / 3.10 | 폼 검증 스키마는 Zod 로 씁니다 |
| 검증 | `zod` | 3.25.76 | |
| 아이콘 | `lucide-react` | 0.475 | `lucide-react-native` 가 아닙니다 |

### 1-2. 직접 만든 기반 코드

라이브러리 대신 저장소 안에 직접 만든 것들입니다. 새 화면을 만들 때 이것들을 거쳐서 씁니다.

| 파일 | 하는 일 |
|---|---|
| `src/lib/apiClient.ts` | 백엔드 HTTP 클라이언트. **axios 없이 `fetch` 만** 씁니다. Bearer 토큰 부착, `401 ACCESS_TOKEN_EXPIRED` 면 리프레시 후 1회 재시도, 동시 401 이 와도 리프레시는 한 번만, 에러를 `{ error: { code, message } }` 계약대로 파싱 |
| `src/lib/authTokens.ts` | 액세스·리프레시 토큰 보관 |
| `src/lib/localCollection.ts` | **아직 서버가 없는 도메인**의 localStorage 저장소 대역 ([1-5](#1-5-데이터는-어디서-오나)) |
| `src/lib/storage.ts` | 예전 AsyncStorage 자리의 localStorage 어댑터 |
| `src/primitives/` | 예전 RN 컴포넌트(`View`/`Text`/`Pressable` 등)를 DOM 으로 옮긴 레이어. 포팅된 화면이 그대로 돌게 하려고 남겨 둔 것이고, **새 화면은 평범한 HTML 요소를 써도 됩니다** |
| `src/navigation/` | 예전 expo-router API(`router`, `useLocalSearchParams` 등)를 React Router 위에 얹은 shim |

### 1-3. 스타일

- **Tailwind CSS 3.4** + PostCSS + autoprefixer
- `src/global.css` 의 `.rnw-*` 클래스가 RN 식 flex 기본값(세로 방향)을 재현합니다. primitives 를 쓰는 화면은 이 기본값 위에서 Tailwind 클래스가 동작합니다

### 1-4. 외부 서비스

| 서비스 | 용도 | 키가 없을 때 |
|---|---|---|
| Kakao Maps JavaScript SDK | 병원 지도 (`components/map/KakaoMap.tsx`, 스크립트를 동적으로 로드) | 지도 대신 "키가 설정되지 않음" 안내를 보여줍니다 |
| Kakao Local REST API | 주소 검색 (`services/geocoding.ts`) | 같은 검색어에 늘 같은 결과를 내는 mock 으로 동작합니다 |

키는 `frontend/.env` 의 `VITE_KAKAO_MAP_JS_KEY`, `VITE_KAKAO_REST_API_KEY` 에 넣습니다 (`.env.example` 참고).
`VITE_` 접두사가 붙은 값은 빌드할 때 번들에 그대로 들어가므로 **공개되어도 되는 클라이언트 키만** 넣습니다.

### 1-5. 데이터는 어디서 오나

서버로 옮겨진 도메인과 아직 브라우저에 저장하는 도메인이 섞여 있습니다.
어느 쪽이든 화면과 훅은 `features/*/api/*.ts` 함수만 부르므로 저장 위치를 모릅니다.
서버가 생기면 그 api 함수 본문만 `apiRequest(...)` 로 바꿉니다.

| 출처 | 도메인 |
|---|---|
| **백엔드 API** | 인증·약관, 병원, 전문의, 시술 분류, 후기, 상담, 알림 |
| **브라우저 localStorage** (`localCollection.ts`) | 찜, 병원 문의, 커뮤니티 (그리고 이것들을 집계하는 관리자 대시보드 일부) |

찜과 병원 문의는 요청서 16 에서 서버로 옮길 예정입니다.

### 1-6. 빌드·품질 도구

| 영역 | 도구 | 비고 |
|---|---|---|
| 언어 | TypeScript 5.7.3 | `strict`, 타깃 ES2022, `@/` → `src/` 별칭 |
| 빌드·개발 서버 | Vite 6.4 + `@vitejs/plugin-react` | 포트 5173. `npm run build` = `tsc -b && vite build` |
| 테스트 | Vitest 3.2.7 + jsdom + Testing Library (`react`, `user-event`, `jest-dom`) | `vitest.config.ts` 가 Vite 설정을 물려받아 별칭이 한 곳에만 있습니다 |
| 린트 | ESLint 9 + typescript-eslint, `react-hooks`, `jsx-a11y`, `@tanstack/eslint-plugin-query` | |
| 포맷 | Prettier 3 | `npm run format` |

---

## 2. 백엔드 (`backend/`)

### 2-1. 런타임 의존성

| 영역 | 라이브러리 | 버전 | 쓰는 방식 |
|---|---|---|---|
| 프레임워크 | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | 11.1 | Express 어댑터, CommonJS. 모든 API 는 `/api/v1` 아래, `GET /health` 만 예외 |
| 설정 | `@nestjs/config` | 4.0 | 환경변수는 부팅할 때 Zod 스키마로 검증합니다 (`src/config/env.schema.ts`). 잘못되면 서버가 뜨지 않습니다 |
| ORM | `@prisma/client` / `prisma` | 6.19.3 | 스키마는 `prisma/schema.prisma`, 마이그레이션은 `prisma/migrations/` |
| DB | SQLite | | 개발 DB `prisma/dev.db`, 테스트 DB `prisma/test.db`. 둘 다 커밋하지 않습니다 |
| 인증 | `@nestjs/jwt` | 11.0 | 액세스 토큰(15분) + 회전식 리프레시 토큰(30일, DB 저장). 같은 리프레시 토큰을 두 번 쓰면 그 계열 전체를 폐기합니다 |
| 비밀번호 | `bcryptjs` | 3.0 | |
| 요청 검증 | `zod` | 3.25.76 | 라우트마다 `ZodValidationPipe` (`src/common/pipes/`) |
| 스케줄 작업 | `@nestjs/schedule` | 6.1 | 리프레시 토큰 정리 배치, 매일 04:00 KST |
| id 생성 | `@paralleldrive/cuid2` | 3.3 | DB autoincrement 대신 애플리케이션이 만듭니다 |
| 기타 | `reflect-metadata`, `rxjs` | | Nest 가 요구하는 것 |

### 2-2. 직접 만든 기반 코드

| 위치 | 하는 일 |
|---|---|
| `src/common/logging/dev-trace.ts` | `NODE_ENV=development` 일 때만 요청이 어느 단계(인증·역할·검증…)에서 멈췄는지 콘솔에 찍습니다. 요청/응답 본문과 검색어 `q` 는 찍지 않습니다 (개인정보) |
| `src/common/errors/`, `src/common/filters/` | 에러 응답을 `{ error: { code, message, details?, requestId } }` 계약 형태로 만듭니다 |
| `src/auth/guards/`, `src/auth/scope/` | 인가 3층 (인증 → 역할 → 담당 병원 범위) |
| `src/app-setup.ts` | 전역 접두어·요청 id·예외 필터. 서버와 테스트가 같은 함수를 씁니다 |

도메인 모듈: `auth`, `hospital`, `doctor`, `procedure`, `review`, `consult`, `notification`, `audit`, `legal`, `health`

### 2-3. DB 이식성 규칙

지금은 SQLite 지만 PostgreSQL 14+ 로 옮길 때 깨지지 않도록 스키마에서 다음을 쓰지 않습니다
(전체 근거는 `docs/database/README.md`).

- enum → `String` + 애플리케이션 검증
- 스칼라 배열·Json 컬럼 → 자식 테이블 또는 실제 컬럼
- autoincrement → `String @id` + cuid2
- `@default(now())`·`@updatedAt` → 애플리케이션이 UTC 로 직접 세팅
- raw SQL
- 금액은 `Int`(원), 달력 날짜는 `'YYYY-MM-DD'` 문자열(KST)

### 2-4. 빌드·품질 도구

| 영역 | 도구 | 비고 |
|---|---|---|
| 언어 | TypeScript 5.7.3 | `strict`, 타깃 ES2023, CommonJS |
| 빌드 | `@nestjs/cli` (`nest build`) | 개발은 `nest start --watch` |
| 테스트 | Vitest 3.2.7 + `unplugin-swc` + supertest + `@nestjs/testing` | 실행할 때마다 `prisma/test.db` 를 지우고 마이그레이션 + 시드를 다시 합니다. 파일은 병렬로 돌리지 않습니다 (SQLite 쓰기 잠금) |
| 스크립트 실행 | `tsx` | 운영자 권한 부여·회수, 토큰 정리 (`npm run operator:*`, `tokens:cleanup`) |
| 린트 | ESLint 9 + typescript-eslint | |

---

## 3. 왜 이렇게 골랐나

코드 주석과 설계 문서에 흩어져 있는 결정을 모았습니다. 바꾸려면 먼저 이 이유가 아직 맞는지 확인하세요.

| 결정 | 이유 | 근거 위치 |
|---|---|---|
| 백엔드 검증에 class-validator 대신 **Zod** | 프론트와 같은 라이브러리를 씁니다. 그래서 Nest 의 전역 `ValidationPipe` 는 쓸 수 없고(class-validator 를 요구함), 라우트마다 `ZodValidationPipe` 를 붙입니다 | `backend/src/main.ts` |
| 백엔드 테스트에 Jest 대신 **Vitest** | 저장소의 러너를 하나로 맞춥니다. 대신 esbuild 가 데코레이터 메타데이터를 못 만들어서 SWC 로 트랜스파일합니다 | `backend/vitest.config.ts` |
| axios 없이 **`fetch`** | 필요한 것이 `apiClient.ts` 한 파일이면 충분합니다 | `frontend/src/lib/apiClient.ts` |
| 서버 데이터는 **TanStack Query 만** 캐시 (Zustand `persist` 제거) | 두 곳이 같은 값을 붙들면 두 캐시가 조용히 어긋납니다 | `frontend/src/lib/localCollection.ts` |
| **SQLite** 로 시작, PostgreSQL 전제 설계 | 혼자 개발하는 동안 별도 DB 서버 없이 돌리고, 이식성 규칙으로 이전 비용을 낮춥니다 | `docs/database/README.md` |
| 액세스 토큰 **15분** | 액세스 토큰은 무상태라 폐기할 수단이 없어서 수명을 짧게 둡니다 | `backend/.env.example` |

---

## 4. 환경변수

값은 각 폴더의 `.env` 에 넣고, `.env` 는 커밋하지 않습니다. 목록과 설명은 `.env.example` 이 정본입니다.

| 폴더 | 변수 |
|---|---|
| `frontend/` | `VITE_API_BASE_URL` (비우면 같은 오리진의 `/api/v1`), `VITE_KAKAO_MAP_JS_KEY`, `VITE_KAKAO_REST_API_KEY` |
| `backend/` | `DATABASE_URL`, `TEST_DATABASE_URL`, `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_CLEANUP_ENABLED`, `REFRESH_TOKEN_CONSUMED_RETENTION_DAYS`, `SEED_PASSWORD`, `SEED_TODAY` |

---

## 5. 자주 쓰는 명령

```bash
# 프론트엔드
cd frontend
npm run dev          # http://localhost:5173
npm run build        # tsc -b && vite build

# 백엔드
cd backend
npm run dev          # http://localhost:3000, 헬스체크 /health
npm run prisma:migrate
npm run prisma:seed
npm run prisma:studio

# 커밋 전 완료 게이트 — 바꾸지 않은 쪽도 돌립니다 (CLAUDE.md)
(cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build)
(cd backend  && npm run lint && npm run typecheck && npm run test:run && npm run build)
```

`prisma migrate`·`prisma:reset`·시드처럼 개발 DB 를 다시 만드는 작업 전에는 `backend/prisma/dev.db` 를 백업합니다 (CLAUDE.md 안전장치 2).

---

## 갱신 방법

- 의존성을 더하거나 빼거나 메이저 버전을 올리면 이 문서의 해당 표를 같은 커밋에서 고칩니다
- 버전을 다시 확인할 때는 설치된 값을 봅니다:
  ```bash
  node -p "require('./frontend/node_modules/<패키지>/package.json').version"
  ```
- 도메인이 서버로 옮겨지면 [1-5](#1-5-데이터는-어디서-오나) 표를 고칩니다
- 문서 맨 위의 기준일과 기준 커밋을 새로 적습니다

## 더 읽을 문서

| 주제 | 문서 |
|---|---|
| 저장소 규칙·프론트 구조 | [`AGENTS.md`](../AGENTS.md), [`CLAUDE.md`](../CLAUDE.md) |
| 백엔드 구조·인증·명령어 | [`backend/README.md`](../backend/README.md) |
| DB 설계·PostgreSQL 이전·시드·테스트 DB | [`database/README.md`](database/README.md), [`database/schema.dbml`](database/schema.dbml) |
| API 계약 | [`api/openapi.yaml`](api/openapi.yaml), [`api/README.md`](api/README.md) |
| 역할·개인정보 결정 | [`decisions/0001-roles-and-pii.md`](decisions/0001-roles-and-pii.md) |
| 화면별 기능 명세 | [`features/README.md`](features/README.md) |
