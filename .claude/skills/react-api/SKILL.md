---
name: react-api
description: Use when connecting the frontend to backend endpoints, adding data fetching, handling auth tokens, or working with environment variables and external APIs in frontend/.
---

# 데이터 연동

## 현재 상태를 먼저 알 것

**백엔드와 API 클라이언트가 둘 다 있다.** 새로 만들지 말고 기존 것에 얹는다.

- `backend/` 는 **동작하는 NestJS + Prisma + SQLite 서버**다 (자리표시자가 아니다).
  로컬은 `cd backend && npm run dev` → `http://localhost:3000`
- API 클라이언트는 `frontend/src/lib/apiClient.ts` **하나**다. 토큰 부착·재발급·에러 파싱이 여기 다 있다
- 서버 상태는 **TanStack Query** 가 쥔다. Zustand 에 복사하지 않는다 (`frontend/CLAUDE.md`)
- 외부 API 호출(Kakao Local 지오코딩)만 `frontend/src/services/geocoding.ts` 에 남아 있다

### 서버가 이미 제공하는 것 (15개 경로 / 20개 오퍼레이션 + `GET /health`)

| 경로 | 오퍼레이션 |
|---|---|
| `/auth/signup` `/auth/login` `/auth/refresh` `/auth/logout` `/auth/me` | 5 |
| `/procedures` | 1 |
| `/hospitals` `/hospitals/{id}` `/hospitals/{id}/doctors` `/hospitals/{id}/reviews` | 7 |
| `/admin/hospitals` | 1 |
| `/doctors` `/doctors/{id}` `/doctors/verification-queue` `/doctors/{id}/verification` | 6 |

**모두 `/api/v1` 접두어 아래다. `GET /health` 만 예외다** — 이 클라이언트로 부르지 않는다.

계약의 단일 출처는 `docs/api/openapi.yaml` 이다. **거기에는 46개 경로가 있고 그중 15개만 구현되어 있다.**
구현 여부를 추측하지 말고 `backend/src/**/*.controller.ts` 를 보거나 실제로 호출해 확인한다.

## 구현 전 탐색

1. `docs/api/openapi.yaml` — 붙이려는 엔드포인트가 계약에 있는가, 요청·응답 스키마가 무엇인가
2. `backend/src/**/*.controller.ts` — **실제로 구현되어 있는가** (계약에 있다고 있는 게 아니다)
3. `frontend/src/features/*/api/*.ts` — 같은 도메인 함수가 이미 있는가
4. `frontend/src/lib/queryKeys.ts` — 쿼리 키가 이미 준비되어 있는가
5. `frontend/src/types/domain.ts` — 도메인 타입이 이미 있는가
6. `frontend/.env.example` — 필요한 키가 이미 있는가

## 폴더 구조

```
frontend/src/features/<도메인>/
├── api/<도메인>Api.ts     ← apiRequest 호출. 화면·컴포넌트는 여기를 직접 안 부른다
├── hooks/use*.ts          ← useQuery / useMutation 래퍼. 화면은 이것만 쓴다
├── components/            ← 그 도메인 전용 컴포넌트 (선택)
├── lib/                   ← 그 도메인 전용 순수 함수 (선택)
└── index.ts               ← 배럴. 화면은 '@/features/<도메인>' 에서 가져온다
```

현재 도메인: `auth` `hospital` `doctor` `procedure` `review` `consult` `favorite` `notification` `community`

**`src/data/*.ts` 는 없다.** 목업 시드는 `src/mocks/fixtures/` 에 있고, 아래 4개 도메인의 로컬 구현만 그것을 쓴다.

## api 계층 작성 규칙

- 호출은 **`features/*/api/` 안에서만.** 컴포넌트·화면·훅에서 `fetch` 하지 않는다
- `apiRequest<T>(path, options)` 를 쓴다. axios 를 넣지 않는다
- 요청·응답 타입을 명시한다. `any` 금지
- 도메인 타입은 `@/types/domain` 에서 가져오거나 거기에 추가한다. 화면 파일에 중복 선언하지 않는다
- 함수 위 JSDoc 에 **대응 엔드포인트**를 적는다 (`hospitalApi.ts` 가 그 형태다)

### `apiRequest` 사용

```ts
import { apiRequest } from '@/lib/apiClient';
import { toSearchParams } from '@/lib/searchParams';
import type { Hospital, Paged } from '@/types/domain';

// GET — 쿼리스트링은 toSearchParams 로 만든다 (빈 값·undefined 를 걸러준다)
export function fetchHospitals(filters: HospitalFilters = {}): Promise<Paged<Hospital>> {
  return apiRequest<Paged<Hospital>>(`/hospitals${toSearchParams(filters)}`);
}

// 경로 변수는 반드시 encodeURIComponent
export function fetchHospitalById(id: string): Promise<Hospital> {
  return apiRequest<Hospital>(`/hospitals/${encodeURIComponent(id)}`);
}

// 쓰기 — body 는 객체 그대로 넘긴다 (내부에서 JSON 직렬화)
export function updateHospital(id: string, input: HospitalWriteInput): Promise<Hospital> {
  return apiRequest<Hospital>(`/hospitals/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
}
```

`ApiRequestOptions`: `method`(기본 `GET`) · `body` · `auth`(기본 `true`) · `signal`

`auth: false` 는 **토큰이 아직 없거나 본문으로 넘기는 경우**뿐이다 — 로그인·가입·리프레시, 그리고 비로그인도 읽는 공개 문서.

### 에러 — `ApiError`

`apiRequest` 는 실패하면 `ApiError` 를 던진다. 화면은 **문구 사전을 다시 만들지 않는다.**

```ts
class ApiError extends Error {
  status: number;              // HTTP 상태
  code: string;                // 백엔드 ERROR_CATALOG 코드 — 분기는 이걸로만
  message: string;             // 사용자에게 그대로 보여줄 수 있는 한국어
  details?: ApiErrorDetail[];  // { field, code, message } — 422 필드 오류
  requestId?: string;          // 서버 로그 대조용
}
```

```ts
import { isApiError } from '@/lib/apiClient';

if (isApiError(error) && error.code === 'HOSPITAL_NOT_FOUND') {
  // "없음" 분기
}
// 그 외에는 error.message 를 그대로 보여준다
```

- **`code` 로 분기하고 `message` 를 보여준다.** `status` 로 분기하지 않는다 (같은 404 도 코드가 다르다)
- 없는 리소스는 `null` 이 아니라 **`ApiError` 를 던진다** (`fetchHospitalById` 참고)
- `422` 필드 오류를 폼에 꽂을 때는 기존 매퍼를 쓴다:
  `applyServerFieldErrors` / `formErrorMessage` (`features/auth/lib/serverFieldErrors.ts`),
  `mapHospitalFieldErrors` (`features/hospital/lib/hospitalFieldErrors.ts`)

### 목록 — `Paged<T>`

```ts
interface Paged<T> {
  items: T[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
```

계약이 페이지네이션을 규정한 목록은 전부 이 형태다. `pageSize` 상한은 **100**이다.
페이지 UI 가 없는 화면은 `pageSize: 100` 으로 한 번에 받되, **그 상수 옆에 "언제 잘리는지"를 적는다.**

### 토큰

`apiClient` 가 알아서 한다. 화면·api 계층에서 토큰을 직접 만지지 않는다.

- `Authorization: Bearer` 자동 부착
- `401 ACCESS_TOKEN_EXPIRED` 면 리프레시 후 원 요청을 **1회** 재시도
- 동시 요청이 여러 개 401 을 받아도 **리프레시는 한 번만** (진행 중인 Promise 를 공유)
- 리프레시 자체는 재시도하지 않는다 — 서버가 토큰을 회전시키고 재사용을 공격으로 보아 계열 전체를 폐기하기 때문
- 세션을 되살릴 수 없으면 `subscribeToSessionInvalidated` 로 알린다 (`SessionWatcher` 가 듣는다)

## 훅 계층 작성 규칙

- 조회는 `useQuery`, 쓰기는 `useMutation`
- **쿼리 키는 `@/lib/queryKeys` 에서만** 가져온다. 화면에 문자열 리터럴 키 금지. 새 도메인은 거기에 항목을 추가한다
- mutation 성공 시 **관련 쿼리를 명시적으로 무효화**한다

```ts
export function useHospital(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hospitals.detail(id ?? ''),
    queryFn: () => fetchHospitalById(id as string),
    enabled: Boolean(id),          // 값이 없으면 아예 부르지 않는다
  });
}

export function useUpdateHospital() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: HospitalWriteInput }) => updateHospital(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.hospitals.all });
    },
  });
}
```

계정 자원을 비로그인 화면에서도 그리는 경우(병원 카드 하트, 상단바 배지)는 `enabled` 로 게이팅해서
확정 401 을 막는다 (`useFavorites`, `useUnreadNotificationCount` 참고).

## 아직 서버가 없는 4개 도메인

`consult` · `favorite` · `notification` · `community` 는 **백엔드에 엔드포인트가 없다**(계약에는 있다).
그래서 api 계층이 `apiRequest` 대신 `frontend/src/lib/localCollection.ts`(브라우저 저장)를 읽고 쓴다.

**구조는 나머지 도메인과 똑같다.** 화면은 이 넷이 로컬인지 서버인지 모른다:

- 모든 함수가 `async` 이고 `Promise<T>` 를 반환한다
- 없는 리소스는 **백엔드가 쓸 코드 그대로** `ApiError` 를 던진다 (`CONSULT_REQUEST_NOT_FOUND`, `POST_NOT_FOUND`)
- 목록은 `Paged<T>` 로 반환하고 `meta` 는 백엔드 `buildPageMeta` 와 같은 값을 낸다

> ⚠ **`NOTIFICATION_NOT_FOUND` 는 프론트가 지어낸 이름이다.** 계약이
> `PATCH /notifications/{id}/read` 의 404 `code` 를 고정하지 않아서다. 백엔드를 만들 때
> 같은 이름을 쓰면 프론트는 손댈 곳이 없고, 다른 이름으로 정하면
> `features/notification/api/notificationApi.ts` 한 곳만 맞추면 된다
> (지금 이 코드로 분기하는 화면은 없다).

| 컬렉션 | 저장 키 | 대응 계약 |
|---|---|---|
| `consultRequests` | `molarmolar-local-consultRequests` | `/consult-requests*`, `/me/consult-requests` |
| `favoriteHospitalIds` | `molarmolar-local-favoriteHospitalIds` | `/me/favorites*` |
| `notifications` | `molarmolar-local-notifications` | `/notifications*` |
| `communityPosts` | `molarmolar-local-communityPosts` | `/community/posts*` |

### 서버가 생기면 바꿀 것

1. **`features/{consult,favorite,notification,community}/api/*.ts` 의 함수 본문**만
   `apiRequest('<경로>')` 로 교체한다. 시그니처는 그대로 → **훅·화면은 손대지 않는다**
2. **`lib/localCollection.ts` 를 파일째 삭제**하고 `test/setup.ts` 의 `resetCollectionCache()` 한 줄을 지운다
3. `consultApi.ts` 의 `// 서버 전환 시 삭제: 알림 생성은 서버 몫` 표시 3곳을 지운다
   (알림 생성은 `POST /consult-requests` / `PATCH .../status` 의 서버 부수효과다)
4. `store/useAuthStore.ts` 의 `clearCollection('favoriteHospitalIds')` 한 줄을 지운다
   (찜이 계정 자원이 되면 로그아웃 시 `queryClient.clear()` 만으로 충분하다)

각 api 파일 맨 위에 **함수 ↔ 엔드포인트 표**와 **"로컬 구현이 계약과 다른 점"** 이 적혀 있다.
전환할 때 그 목록부터 읽는다 — `doctorId` 미저장, `scope`·`hospitalName`·`piiMasked` 미구현 같은 것들이 거기 있다.

**새 로컬 컬렉션을 늘리지 않는다.** 계약에 있는 엔드포인트가 구현되면 그때 위 순서로 걷어낸다.

## 저장소 접근

- **`localStorage` 를 직접 만지는 파일은 두 개뿐이다**: `lib/localCollection.ts`(위 4개 도메인),
  `lib/authTokens.ts`(토큰). 화면·컴포넌트·훅에서 `localStorage` 를 쓰지 않는다
- Zustand 는 클라이언트 전역 상태만 (`useAuthStore`, `useScrollShadowStore`). **서버 데이터를 넣지 않는다**
- `zustand/middleware` 의 `persist` 는 이제 쓰지 않는다

## 환경변수

- `VITE_` 접두사 + `import.meta.env` 로 읽는다
- 읽는 코드는 `src/config/` 또는 `src/lib/apiClient.ts` 에 모은다
- 새 키를 추가하면 **`frontend/.env.example` 에 주석과 함께 반드시 기록한다**
- `.env` 는 gitignore 대상이다. 실제 키 값을 코드나 예시 파일에 커밋하지 않는다

현재 키:

| 키 | 용도 | 비었을 때 |
|---|---|---|
| `VITE_API_BASE_URL` | 백엔드 기본 경로 | 같은 오리진의 `/api/v1` |
| `VITE_KAKAO_MAP_JS_KEY` | 지도 SDK | 지도 대신 안내 문구 |
| `VITE_KAKAO_REST_API_KEY` | 주소 검색 | 결정적인 목 결과로 폴백 |

## 보안

- `VITE_` 로 노출되는 값은 **전부 브라우저에서 볼 수 있다.** 서버 시크릿·DB 자격증명·관리자 키를 넣지 않는다
- access/refresh 토큰을 로그로 남기지 않는다
- 라우트 접근 제어는 `App.tsx` 의 `ROUTES` 에 `guard` 로 선언하고 `RequireAuth`(`features/auth/components/`)가 집행한다.
  **새 가드를 만들지 않는다**
- 화면 안에서 "로그인해야 하는 동작"(찜, 상담 신청)은 `useRequireAuth()`(`@/hooks/useRequireAuth`)로 감싼다
- 세션 복원 중(`status: 'restoring'`)을 **"권한 없음"으로 판정하지 않는다** — 아직 모르는 상태다

## 완료 전 확인

- [ ] `npm run typecheck && npm run build && npm run test:run && npm run lint`
- [ ] loading / error / empty 상태 처리 (`components/QueryState` 참고)
- [ ] 에러 분기를 `code` 로 했는가 (`status` 나 `message` 문자열 비교가 아니라)
- [ ] mutation 뒤 관련 쿼리를 무효화했는가
- [ ] 쿼리 키를 `lib/queryKeys.ts` 에서 가져왔는가
- [ ] 새 환경변수가 `.env.example` 에 기록됐는가
- [ ] 브라우저에 노출돼선 안 되는 값이 `VITE_` 로 들어가지 않았는가

## Red Flags

- 계약(`openapi.yaml`)에만 있고 **서버에 구현되지 않은** 엔드포인트로 `fetch` 를 작성하고 있다
- 컴포넌트·화면·훅 안에서 직접 `fetch` 하거나 `localStorage` 를 만지고 있다
- 응답 타입을 `any` 로 두었다
- 서버에서 받은 데이터를 Zustand 에 복사해 두었다
- 화면에 쿼리 키 문자열 리터럴을 적었다
- `error.status === 404` 나 `error.message.includes('...')` 로 분기하고 있다
- 새 `VITE_` 키를 쓰면서 `.env.example` 을 수정하지 않았다
- 로컬 컬렉션(`localCollection`)을 새로 늘리고 있다
