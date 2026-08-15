---
name: react-code-review
description: Use when reviewing React/TypeScript code in this repo for correctness, architecture, state handling, UX states, accessibility, or security — before merging or when asked to check existing code.
---

# 코드 리뷰

아래 순서로 본다. 요청받지 않았다면 **코드를 고치지 말고 지적만 한다.**

## 1. 정확성

- 잘못된 동작, 놓친 엣지 케이스
- 상태 동기화 문제 (스토어와 로컬 상태가 어긋남)
- 비동기 순서 / 경쟁 조건
- 에러 처리 누락 — 실패하면 화면이 어떻게 되는지

## 2. 구조

- 화면(`src/screens/`)과 재사용 컴포넌트(`src/components/`)의 경계
- **중복 컴포넌트** — 기존 카드/버튼과 사실상 같은 것을 새로 만들었는지
- 도메인 타입이 `src/types/domain.ts` 대신 화면 안에 중복 선언됐는지
- 외부 호출이 컴포넌트에 직접 박혀 있는지 (`src/services/` 로 가야 함)
- 새 화면이 `src/App.tsx` 의 `ROUTES` 에 등록됐는지
- `package.json` 에 없는 라이브러리를 import 하는지

## 3. 상태 관리

- Zustand 스토어가 지역 상태여도 되는 것을 전역으로 들고 있는지
- `persist` 스토어의 `name` 키가 기존 것과 충돌하는지
- 스토어 상태를 컴포넌트에서 직접 mutate하는지 (액션을 통해야 함)
- 스토어 전체를 구독해서 불필요한 리렌더를 유발하는지

## 4. TypeScript

- `any`, 근거 없는 `as` 캐스트
- nullable 처리 누락 (`find()` 결과를 바로 사용하는 등)
- 타입 없는 함수 시그니처

## 5. React

- 잘못된 `useEffect` 사용 — 계산으로 충분한 것을 effect로 처리
- 의존성 배열 누락
- 리스트 `key` 에 인덱스를 쓰는지
- 불필요한 `useMemo`/`useCallback` — **측정 가능한 이유 없이 메모이제이션을 권하지 않는다**

## 6. UX / 접근성

- loading / error / **empty** / disabled 상태
- 모바일·데스크톱 두 폭에서의 레이아웃 (`useIsWideWeb`)
- 클릭 핸들러 달린 `div` (→ `button`)
- 라벨 없는 입력, alt 없는 의미 있는 이미지
- 키보드 조작 가능 여부

## 7. 보안

- 서버 시크릿에 `VITE_` 접두사 (브라우저에 그대로 노출됨)
- 토큰/개인정보를 콘솔에 로그
- 인증 가드 누락 — 관리자 화면(`src/screens/admin/`)이 특히 중요

## 8. 검증

- `npm run typecheck` / `npm run build` 가 실제로 통과하는지 확인한다.
  "통과할 것 같다"로 넘기지 않는다
- 중요한 동작에 검증 수단이 없다면 그 사실을 지적한다 (현재 테스트 러너는 없다)

## 출력 형식

심각도별로 묶어서 보고한다. 각 항목은 `파일:줄` 로 위치를 밝힌다.

### Critical
반드시 고쳐야 하는 것 — 동작이 깨지거나 보안 문제.

### Warning
고치는 게 맞는 것 — 구조 훼손, 중복, 접근성 결함.

### Suggestion
선택적 개선.

## 리뷰어가 하지 말 것

- 요청 없이 코드를 고치는 것
- 지적할 게 없을 때 억지로 항목을 만드는 것 — 깨끗하면 깨끗하다고 말한다
- 확인하지 않은 추측을 단정으로 쓰는 것. 확실하지 않으면 그렇다고 표시한다
- 이 프로젝트의 기존 관례를 개인 취향으로 재단하는 것 (primitives 사용, RN식 flex 기본값 등은 의도된 것)
