# 프론트엔드 규칙 (`frontend/`)

Vite + React 19 + React Router 7 + TanStack Query + Zustand + React Hook Form + zod + Tailwind 3.
언어 규칙은 [typescript.md](typescript.md)를 따르고, 이 문서는 화면 코드에만 해당하는 것을 다룬다.
HTML·CSS 부분은 [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)를
JSX·Tailwind 에 맞게 옮긴 것이다.

## 폴더 구조와 책임

```
src/
├── App.tsx            라우트 표(ROUTES) 하나
├── app/               전역 provider
├── pages/             라우트 화면 (XxxPage.tsx) — 새 화면은 여기
├── screens/           expo-router 시절 화면 — 새 화면을 추가하지 않는다
├── features/<도메인>/
│   ├── api/           서버 호출 함수 (fetchX, createX, updateX)
│   ├── hooks/         TanStack Query 훅 (useX) — 화면은 이것만 쓴다
│   ├── components/    그 도메인 전용 컴포넌트
│   ├── lib/           순수 판정 함수 (React·네트워크를 모른다)
│   └── schemas/       zod 폼 스키마
├── components/        도메인이 없는 공용 컴포넌트 (QueryState, EmptyState, ErrorState …)
├── store/             Zustand 스토어 (useXxxStore.ts) — 클라이언트 전역 상태만
├── lib/               apiClient, queryKeys, storage 같은 기반 코드
├── types/             도메인 타입
├── primitives/        react-native 호환 레이어 — 새 코드는 평범한 HTML 요소를 쓴다
└── navigation/        expo-router 호환 shim
```

데이터는 한 방향으로 흐른다:

```
pages / components  →  features/*/hooks  →  features/*/api  →  lib/apiClient  →  서버
```

- **컴포넌트는 api 함수를 직접 부르지 않는다.** 훅을 거친다. 캐시·재시도·로딩 상태가 한 곳에서 관리된다.
- 비즈니스 판정은 `features/*/lib` 의 순수 함수에 둔다. 컴포넌트에 `if` 로 흩어 두지 않는다.
- 도메인 A 의 컴포넌트가 도메인 B 의 내부를 깊이 알아야 하면, 그 조각을 `components/` 로 올릴지 먼저 생각한다.

### 파일 이름

| 무엇 | 이름 | 예 |
|---|---|---|
| 컴포넌트 | `PascalCase.tsx` — 파일 이름이 컴포넌트 이름 | `HospitalCard.tsx` |
| 라우트 화면 | `XxxPage.tsx` | `ConsultRequestPage.tsx` |
| 훅 | `useXxx.ts` | `useConsultRequests.ts` |
| 스토어 | `useXxxStore.ts` | `useAuthStore.ts` |
| 그 밖의 모듈 | `camelCase.ts` | `consultApi.ts`, `transition.ts` |
| 테스트 | 대상 옆에 `대상이름.test.ts(x)` | `transition.test.ts` |

## 상태 관리 — 어떤 상태를 어디에

| 상태 | 도구 | 예 |
|---|---|---|
| 서버에서 온 데이터 | TanStack Query | 병원 목록, 상담 상세, 알림 수 |
| 여러 화면이 함께 보는 클라이언트 상태 | Zustand (`store/`) | 로그인 세션, 관리자가 고른 병원 |
| 폼 입력 | React Hook Form + zod | 상담 신청 폼 |
| 한 컴포넌트 안의 UI 상태 | `useState` | 펼침/접힘, 열린 탭 |

- **서버 데이터를 Zustand 에 복사하지 않는다.** 복사한 순간 두 곳이 어긋나기 시작한다.
- query key 는 `@/lib/queryKeys` 에서만 만든다. 문자열 배열을 화면에서 직접 쓰지 않는다.
  무효화(`invalidateQueries`)할 때 키가 정확히 같아야 하기 때문이다.
- **계산할 수 있는 값은 상태로 두지 않는다.** props·다른 상태에서 렌더 중에 계산한다.
- 쓰기 후에는 관련 query 를 무효화해 화면이 서버 상태를 다시 읽게 한다.

## 컴포넌트

- 함수 컴포넌트를 쓰고, **이름 붙은 export** 로 내보낸다. 파일 하나에 공개 컴포넌트 하나.
- props 타입은 `interface XxxProps` 로 쓰고 매개변수에서 구조 분해한다.
- 컴포넌트 안의 이벤트 핸들러는 `const handleSubmit = () => { ... }`, 받는 prop 이름은 `onSubmit` 이다.
- `useEffect` 는 **외부 시스템과 맞출 때만** 쓴다 (지도 SDK, 구독, 타이머). 데이터를 가져오는 일은
  TanStack Query 가, 값을 계산하는 일은 렌더가 한다. effect 안에서 `setState` 를 연쇄하면 lint 가 경고한다.
- 목록의 `key` 는 안정된 id 를 쓴다. 순서가 바뀌거나 항목이 빠지는 목록에서 배열 인덱스를 쓰지 않는다.
- `&&` 의 왼쪽에 숫자를 두지 않는다. `count && <Badge />` 는 `0` 을 그린다. `count > 0 &&` 로 쓴다.
- `useMemo`·`memo` 는 측정해서 느린 곳에만 쓴다. 미리 감싸면 의존성 배열이 버그를 만든다.

### 화면이 보여줘야 하는 상태 4가지

서버 데이터를 그리는 화면은 **로딩·빈 결과·에러·정상** 넷을 모두 그린다.
공용 컴포넌트 `QueryState`, `EmptyState`, `ErrorState` 를 다시 쓴다. 빈 결과와 에러는 다른 문구다 —
"병원이 없어요" 와 "불러오지 못했어요" 를 섞으면 사용자는 다시 시도해야 하는지 모른다.

## 폼

- React Hook Form + `zodResolver`. 스키마는 `features/<도메인>/schemas/` 에 두고 테스트한다.
- 서버가 `422 VALIDATION_FAILED` 와 `details[]` 를 주면 `setError(field, ...)` 로 **해당 칸에** 붙인다.
  필드가 아닌 에러는 `setError('root.serverError', ...)` 로 폼 위에 보인다.
- 제출 중에는 제출 버튼을 비활성화해 두 번 보내지 않게 한다.
- 제출이 끝난 뒤 무엇이 보이는지(완료 화면, 이동, 토스트)까지가 폼이다. QA 는 그것까지 확인한다
  (`CLAUDE.md` 워크플로 7).

## 서버 호출

- 서버는 `@/lib/apiClient` 의 `apiRequest` 로만 부른다. 토큰 첨부와 갱신은 거기서 한다.
- api 함수 파일 첫 JSDoc 에 **함수 ↔ 엔드포인트 표**를 둔다 (`consultApi.ts` 가 그 형태다).
- 에러는 코드로 분기한다:

  ```ts
  if (isApiError(error) && error.code === 'CONSULT_CLOSED') {
    // 마감 안내로 바꿔 그린다
  }
  ```

- 서버의 `message` 는 사용자에게 그대로 보여줄 수 있는 문구다 (`docs/api/README.md` §11).
  화면에 같은 뜻의 문구 사전을 또 만들지 않는다.
- **모르는 enum 값이 와도 화면이 죽지 않게** 기본 표시로 떨어뜨린다. 서버는 `v1` 안에서 enum 값을
  추가할 수 있다 (`docs/api/README.md` §15).

## HTML (JSX)

- **의미에 맞는 요소를 쓴다.** 이동은 `<a>`/`<Link>`, 동작은 `<button type="button">`, 목록은
  `<ul>`/`<li>`, 제목은 `<h1>`~`<h6>`. 클릭되는 `<div>` 를 새로 만들지 않는다
  (`primitives/` 의 `Pressable` 은 호환을 위한 예외다).
- 제목 단계는 건너뛰지 않는다 (`h1` 다음은 `h2`).
- 이미지는 `alt` 를 쓴다. 꾸밈용이면 `alt=""` 로 비워 화면 낭독기가 건너뛰게 한다.
- 폼 컨트롤마다 연결된 `<label>` 이 있다 (lint 가 확인한다).
- 구조(JSX)·표현(Tailwind 클래스)·동작(훅)을 섞지 않는다. JSX 안에 긴 계산식을 쓰지 않고 위에서 변수로 뺀다.
- 외부 리소스는 HTTPS 로 불러온다.
- HTML 엔티티(`&nbsp;` 등) 대신 실제 문자를 쓴다. 파일은 UTF-8 이다.

## CSS — Tailwind

- 기본은 **Tailwind 유틸리티 클래스**다. `src/global.css` 에는 Tailwind 로 표현할 수 없는 것만 둔다
  (`.rnw-*` 호환 기본값 등).
- 색·브레이크포인트·최대 폭은 `tailwind.config.js` 의 토큰을 쓴다: `brand-50`~`brand-900`,
  `xs`(480)·`md`(768)·`lg`(1024), `max-w-content`. 같은 값을 화면마다 임의값(`text-[#17847a]`,
  `max-w-[1200px]`)으로 다시 박지 않는다. 임의값은 한 번뿐인 예외에만 쓰고, 두 번째로 필요해지면 토큰으로 올린다.
- 상태 색 `amber`·`sky` 는 상태 배지(`Badge`)에서만 쓴다. **예외: 병원 상세의 후기 별점(★)은 `amber` 로 칠한다**
  (2026-10-23 시안 검토 결정 — "지금처럼 유지"). 카드·목록·가격 비교표의 별점은 지금처럼 neutral 이다.
  둘을 맞출지는 요청자 결정을 기다린다 (`docs/TODO_LIST.md` SYS-24).
- 인라인 `style` 은 런타임에 계산되는 값(지도 좌표, 진행률)에만 쓴다.
- CSS 를 직접 쓸 때는 Google CSS 규칙을 따른다: 의미가 드러나는 클래스 이름을 하이픈으로 잇는다,
  ID 선택자를 쓰지 않는다, `!important` 를 쓰지 않는다, `0` 에 단위를 붙이지 않는다, 모든 선언 끝에 세미콜론.

## 접근성

lint(`jsx-a11y`)가 기본을 막고, 나머지는 사람이 본다.

- **키보드만으로 모든 동작을 할 수 있어야 한다.** Tab 으로 닿고 Enter·Space 로 실행된다.
- 포커스 표시를 지우지 않는다. `outline-none` 을 쓰면 다른 포커스 표시(`focus:border-brand-600`,
  `focus-visible:ring-2`)를 함께 둔다.
- 아이콘만 있는 버튼에는 `aria-label` 을 단다 (`aria-label="찜하기"`).
- 본문 글자의 명도 대비는 4.5:1 이상이다. **색만으로 정보를 전하지 않는다** — 상태 칩은 색과 함께 글자로도 상태를 쓴다.
- 대화상자는 열릴 때 포커스를 안으로 옮기고, Esc 로 닫히고, 닫히면 연 버튼으로 포커스를 돌려준다.

## 보안

- **`VITE_` 환경변수는 번들에 그대로 들어가 누구나 볼 수 있다.** 비밀 키를 넣지 않는다.
  브라우저에 공개돼도 되는 키(지도 JS 키처럼 도메인으로 제한된 것)만 넣는다.
- `dangerouslySetInnerHTML` 을 쓰지 않는다. 피할 수 없으면 정제(sanitize)하고 이유를 주석에 쓴다.
- 개인정보(이름·연락처)를 `console`·localStorage 에 남기지 않는다.
