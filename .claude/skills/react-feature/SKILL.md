---
name: react-feature
description: Use when implementing a new screen, page, route, or business feature in frontend/ — or when adding state, data flow, or forms to the mola web app.
---

# 신규 기능 구현

## 핵심 원칙

AI가 코드를 못 짜서 생기는 문제보다, **기존 프로젝트를 제대로 확인하지 않고 새 패턴을 만들어버리는 것**이 장기적으로 더 큰 문제다.

그래서 이 skill은 "코딩 방법"보다 **작업 절차**를 강제한다.

```
요구사항 → 기존 코드 탐색 → 재사용 대상 확인 → 설계 → 구현 → 검증 → QA
```

## 1. 탐색 — 코드 작성 전 필수

아래를 실제로 열어본다. 해당하는 게 없다는 것을 확인한 것도 탐색 결과다.

| 찾을 것 | 위치 |
|---|---|
| 비슷한 화면 | `frontend/src/screens/` |
| 재사용 컴포넌트 | `frontend/src/components/` (`HospitalCard`, `DoctorCard`, `PrimaryButton`, `SectionHeader`, `Chip`, `Badge`, `SearchBar` …) |
| 전역 상태 | `frontend/src/store/use*Store.ts` |
| 도메인 타입 | `frontend/src/types/domain.ts` |
| 시드/목 데이터 | `frontend/src/data/` |
| 라우트 목록 | `frontend/src/App.tsx` 의 `ROUTES` 배열 |
| 헬퍼 | `frontend/src/lib/`, `src/hooks/`, `src/services/`, `src/utils/` |

## 2. 설계 보고

구현에 들어가기 전에 한 번 정리한다.

- 새로 만들 파일
- 수정할 파일
- **재사용할 기존 컴포넌트/스토어/타입**
- 새로 만들어야 하는 것 + 기존에 없는 이유

"기존에 없어서 새로 만든다"는 탐색을 마친 뒤에만 유효한 문장이다.

## 이 저장소의 실제 구조

`frontend/CLAUDE.md`는 `features/`, `pages/`, TanStack Query를 전제로 쓰여 있지만 **현재 그 구조도 그 의존성도 없다.** 실제는 이렇다.

```
frontend/src/
├── screens/      # 화면 (라우트 대응). 예: tabs/index.tsx, hospital/[id].tsx
├── components/   # 재사용 UI
├── store/        # Zustand 전역 상태
├── data/         # 목 데이터 모듈 (아직 서버 없음)
├── services/     # 외부 호출 래퍼 (geocoding, notifications)
├── types/        # domain.ts — 도메인 타입 한 곳
├── lib/          # storage(localStorage 어댑터), clipboard
├── hooks/        # useIsWideWeb, useRequireAuth, useUserLocation
├── navigation/   # 옛 expo-router API shim (router, useLocalSearchParams …)
└── primitives/   # 옛 react-native 컴포넌트의 DOM 포팅
```

새 디렉토리 구조를 도입하려면 별도로 논의한다. 기능 작업에 끼워 넣지 않는다.

## 새 화면 추가

1. `frontend/src/screens/<경로>.tsx` 에 default export 컴포넌트를 만든다
2. `frontend/src/App.tsx` 에 import 추가 + `ROUTES` 배열에 `{ path, element, options }` 항목 추가
3. 동적 세그먼트는 `:id` 형식. 화면에서는 `useLocalSearchParams()` (`@/navigation`)로 읽는다
4. 화면 제목은 `options.title`, 헤더를 숨기려면 `options: { headerShown: false }`

`ROUTES` 등록은 화면 작업의 일부다. 등록하지 않은 화면은 404다.

## 상태 관리

- **전역 상태** — Zustand. `src/store/` 의 기존 패턴을 따른다:
  `create<T>()(persist((set) => ({...}), { name: 'molarmolar-*', storage: createJSONStorage(() => AsyncStorage) }))`
- **화면 로컬 상태** — `useState`
- **서버 상태** — 아직 없다. 데이터는 `src/data/` 목 모듈이 스토어 seed로 들어간다. 임의로 `fetch`를 심지 말고, 실제 API가 필요하면 먼저 사용자에게 확인한다
- `package.json`에 `@tanstack/react-query`가 추가된 뒤부터는 서버 상태를 그것으로 다루고 Zustand에 넣지 않는다

## 폼

React Hook Form / Zod는 미설치다. 기존 폼(`src/screens/consult/[hospitalId].tsx`, `src/screens/auth/login.tsx`)의 `useState` + 수동 검증 패턴을 따른다.
`package.json`에 `react-hook-form`과 `zod`가 추가된 뒤부터는 새 폼을 그것으로 만들고, 스키마는 화면 옆에 둔다.

## UI 상태

상태/데이터에 의존하는 화면은 네 가지를 모두 고려한다.

- loading
- error
- **empty** — 목 데이터라도 필터 결과 0건은 실제로 발생한다
- success

## 검증 — 완료 전 필수

```bash
cd frontend
npm run typecheck
npm run build
```

`lint` / `test` 스크립트는 현재 `package.json`에 없다. 추가되면 그것도 실행한다.
**없는 스크립트를 실행했다고 보고하지 않는다.**

## QA

프로젝트 규칙(`CLAUDE.md`): 기능 구현이 끝나면 `qa-master` 에이전트로 실제 동작을 검증한다. QA 통과 전에는 완료가 아니다.
특히 로그인/로그아웃, 상담신청, 찜하기, 필터/검색, 폼 제출은 실제 동작까지 확인한다.

## 합리화 차단

| 변명 | 실제 |
|---|---|
| "간단한 화면이라 탐색 생략" | 간단한 화면도 카드·버튼·헤더를 재사용한다. 탐색은 5분이면 끝난다. |
| "비슷한 게 없을 것 같다" | 확인하지 않은 추측이다. `src/components/`와 `src/screens/`를 먼저 본다. |
| "새 구조가 더 깔끔하다" | 구조 변경은 별도 논의 대상이다. 기능 요청 범위가 아니다. |
| "TanStack Query가 정석이니 쓰자" | 미설치 의존성 추가는 기능 요청 범위 밖이다. 먼저 물어본다. |
| "typecheck 통과했으니 완료" | build까지 통과하고 QA를 거쳐야 완료다. |
| "일단 만들고 나중에 정리" | 나중에 정리되지 않는다. 중복 컴포넌트가 남는다. |

## Red Flags — 멈추고 탐색으로 돌아간다

- `src/components/`를 열어보지 않고 새 카드/버튼 컴포넌트를 만들고 있다
- `ROUTES`에 등록하지 않은 화면을 "완성"이라고 부르려 한다
- `package.json`에 없는 라이브러리를 import 하고 있다
- 도메인 타입을 `types/domain.ts` 확인 없이 화면 안에 새로 선언하고 있다
- 검증 명령을 실행하지 않고 완료를 보고하려 한다

## 완료 보고 형식

1. 생성한 파일
2. 수정한 파일
3. 구현 요약
4. 실행한 검증 명령과 그 결과
5. 남은 문제 / 사용자 확인이 필요한 사항
