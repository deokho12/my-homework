---
name: react-api
description: Use when connecting the frontend to backend endpoints, adding data fetching, handling auth tokens, or working with environment variables and external APIs in frontend/.
---

# 데이터 연동

## 현재 상태를 먼저 알 것

**이 프로젝트에는 아직 백엔드도 API 클라이언트도 없다.**

- `backend/` 는 빈 자리표시자다
- 화면 데이터는 `frontend/src/data/*.ts` 목 모듈 → Zustand 스토어 seed로 들어간다
- 외부 호출은 `frontend/src/services/` 에만 있다 (`geocoding.ts` — Kakao Local, `notifications.ts`)
- 영속화는 `frontend/src/lib/storage.ts` (localStorage 어댑터)를 통해 Zustand `persist`가 처리한다

그래서 "API 붙여줘" 요청을 받으면 **먼저 어떤 엔드포인트인지 확인한다.** 없는 서버를 향한 `fetch`를 심지 않는다.

## 구현 전 탐색

1. `src/services/` — 기존 외부 호출이 어떻게 생겼는지
2. `src/data/` — 지금 그 데이터가 어디서 오는지
3. `src/types/domain.ts` — 이미 정의된 도메인 타입
4. `src/store/` — 그 데이터를 쥐고 있는 스토어
5. `frontend/.env.example` — 필요한 키가 이미 있는지

## 외부 호출 작성 규칙

- 호출은 **`src/services/` 안에** 둔다. 컴포넌트나 화면에서 직접 `fetch`하지 않는다
- 요청/응답 타입을 명시한다. `any` 금지
- 도메인 타입은 `src/types/domain.ts` 에서 가져오거나 거기에 추가한다. 화면 파일에 중복 선언하지 않는다
- `geocoding.ts` 의 패턴을 따른다: 키가 없거나 호출이 실패하면 **결정적인 목 데이터로 폴백**하고, 화면이 깨지지 않게 한다
- axios 등 새 HTTP 클라이언트를 추가하지 않는다. `fetch`로 충분하다

## 환경변수

- `VITE_` 접두사 + `import.meta.env` 로 읽는다
- 읽는 코드는 `src/config/` 에 모은다 (`kakaoMap.ts` 참고)
- 새 키를 추가하면 **`frontend/.env.example` 에 주석과 함께 반드시 기록한다**
- `.env` 는 gitignore 대상이다. 실제 키 값을 코드나 예시 파일에 커밋하지 않는다

## 보안

- `VITE_` 로 노출되는 값은 **전부 브라우저에서 볼 수 있다.** 서버 시크릿, DB 자격증명, 관리자 키를 `VITE_`로 넣지 않는다
- access/refresh 토큰을 로그로 남기지 않는다
- 인증이 필요한 화면은 `useRequireAuth()` (`@/hooks/useRequireAuth`)를 쓴다. 새 가드를 만들지 않는다

## TanStack Query가 추가된 뒤

`package.json` 에 `@tanstack/react-query` 가 들어오면 그때부터:

- 서버 데이터의 fetch/캐시/로딩/에러/무효화는 Query가 담당한다
- 서버 데이터를 Zustand에 복사해 두지 않는다 (Zustand는 클라이언트 전역 상태만)
- 쿼리 키는 한 곳에 모아 관리한다
- mutation 후 관련 쿼리를 명시적으로 무효화한다

그 전까지는 스토어 액션 + `src/services/` 조합이 이 프로젝트의 방식이다.

## 완료 전 확인

- [ ] `npm run typecheck && npm run build` 통과
- [ ] loading / error / empty 상태 처리
- [ ] 키가 없을 때의 폴백 동작
- [ ] 새 환경변수가 `.env.example` 에 기록됨
- [ ] 브라우저에 노출돼선 안 되는 값이 `VITE_` 로 들어가지 않았는지

## Red Flags

- 존재하지 않는 백엔드 URL로 `fetch`를 작성하고 있다
- 컴포넌트 안에서 직접 `fetch` 하고 있다
- 응답 타입을 `any` 로 두었다
- 새 `VITE_` 키를 쓰면서 `.env.example` 을 수정하지 않았다
- 서버 시크릿처럼 보이는 값에 `VITE_` 접두사를 붙였다
