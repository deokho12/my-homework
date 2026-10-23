# 코드 규칙

몰라몰라 저장소의 코드 규칙이다. 프론트엔드(`frontend/`, Vite + React)와 백엔드(`backend/`, NestJS +
Prisma)가 모두 Node.js + TypeScript 라서 **언어 규칙은 하나**로 두고, 화면·서버·API·테스트·리뷰·문서
규칙을 나눠 적었다.

기준은 Google 이 공개한 스타일 가이드와 엔지니어링 관행이다. 원문을 그대로 옮기지 않고, 이 저장소의
도구 설정과 이미 쌓인 코드에 맞춰 **골랐다.** Google 과 다르게 정한 곳은
[아래 표](#google-과-다르게-정한-것)에 이유와 함께 모았다.

## 문서 목록

| 문서 | 다루는 것 | 기준이 된 Google 원문 |
|---|---|---|
| [typescript.md](typescript.md) | 이름·타입·import/export·언어 기능·비동기·에러·포맷 (프론트·백 공통) | TypeScript Style Guide, JavaScript Style Guide |
| [frontend.md](frontend.md) | 폴더 구조·상태 관리·컴포넌트·폼·HTML/CSS(Tailwind)·접근성 | HTML/CSS Style Guide |
| [backend.md](backend.md) | NestJS 계층·입력 검증·에러·로그·설정·시간·보안 | TypeScript Style Guide + 이 저장소 원칙 |
| [api-design.md](api-design.md) | REST 자원 설계·이름·목록·에러·하위 호환 | API Improvement Proposals (AIP), API Design Guide |
| [testing.md](testing.md) | 테스트 크기·이름·구조·테스트 대역·불안정 테스트 | *Software Engineering at Google* 11~14장, Testing on the Toilet |
| [code-review.md](code-review.md) | 변경 크기·커밋 메시지·셀프 리뷰 체크리스트 | Google Engineering Practices |
| [documentation.md](documentation.md) | 주석·JSDoc·Markdown·문체 | Documentation Guide, Developer Documentation Style Guide |

## 규칙끼리 부딪히면

위에서부터 이긴다.

1. **도구 설정** — `eslint.config.*`, `tsconfig*.json`. lint 0 errors·typecheck 통과가 최소선이다.
   이 폴더의 문서와 도구가 다르게 말하면 도구가 맞고, 문서를 고친다.
2. **계약** — `docs/api/openapi.yaml`, `docs/api/README.md`, `docs/database/README.md`.
   API·DB 의 모양은 이 문서들이 정본이다. 이 폴더는 계약을 바꾸지 않는다.
3. **`AGENTS.md`·`CLAUDE.md`** — 비즈니스 로직 최소화, 작업 순서, 혼자 개발할 때의 안전장치.
4. **이 폴더.**
5. **같은 파일·같은 폴더의 기존 코드.** 위 넷에 답이 없으면 주변 코드와 같게 쓴다.
   Google 스타일 가이드도 마지막 규칙으로 일관성을 둔다.

## 자주 걸리는 규칙 12개

한 장으로 볼 때 쓴다. 자세한 것은 각 문서에 있다.

1. `var` 는 쓰지 않는다. 기본은 `const`, 다시 대입할 때만 `let`.
2. 비교는 `===`·`!==`. 예외는 null 과 undefined 를 함께 거르는 `x == null` 하나.
3. `any` 대신 `unknown` 으로 받고 좁힌다.
4. 타입으로만 쓰는 import 는 `import type`. Nest 생성자 주입 클래스만 예외다
   ([backend.md](backend.md#nest-의존성-주입과-import-type)).
5. 새 코드는 **이름 붙은 export** 만 쓴다. `export default` 는 기존 라우트 화면에만 남아 있다.
6. 이름: 타입·클래스·컴포넌트는 `UpperCamelCase`, 값·함수는 `lowerCamelCase`,
   모듈 수준 상수는 `CONSTANT_CASE`. 약어도 단어처럼 쓴다 (`apiUrl`, `HttpError`).
7. 던지는 것은 `Error` 객체뿐이다. `catch` 의 값은 `unknown` 으로 보고 좁힌다.
8. 판정 규칙은 DB·요청을 모르는 **순수 함수**로 떼고, 같은 판정을 두 곳에 두지 않는다.
9. 주석에는 **왜**를 쓴다. 무엇을 하는지는 코드가 말한다.
10. 테스트 이름은 **동작**을 문장으로 쓴다 (`'예약확정은 확정 일시를 요구한다'`). 테스트 안에 분기·반복을 넣지 않는다.
11. 커밋 하나에는 한 가지 일만 담는다. 기능 변경과 리팩터링·포맷 변경을 섞지 않는다.
12. 계약에 없는 필드·엔드포인트·상태를 "나중에 쓸 것 같아서" 만들지 않는다.

## Google 과 다르게 정한 것

| 주제 | Google | 이 저장소 | 이유 |
|---|---|---|---|
| 한 줄 길이 | 80자 (JavaScript 가이드) | 100자 안팎 권장 | 한국어 주석과 Tailwind 클래스 문자열이 80자에서 과하게 접힌다. 기존 코드도 대부분 100자 안이다 |
| 프론트 파일 이름 | 소문자 + `_`·`-` | 컴포넌트 `PascalCase.tsx`, 훅 `useXxx.ts`, 나머지 `camelCase.ts` | React 생태계 관례 — 파일 이름이 컴포넌트 이름이다. 백엔드는 Google 과 같다 (`kebab-case.role.ts`) |
| `_` 접두사 | 식별자 앞뒤에 `_` 금지 | **일부러 쓰지 않는 인자·변수에만** 허용 | lint 설정(`argsIgnorePattern: '^_'`)이 이 관례를 전제한다. private 표시 같은 다른 용도는 Google 대로 금지 |
| 데코레이터 정의 | 프레임워크가 준 것만 쓰고 새로 만들지 않는다 | Nest API(`createParamDecorator`·`SetMetadata`·`applyDecorators`)로 만든 것은 허용 | 인가 구조(`@Roles`, `@CurrentUser`)가 그렇게 짜여 있다 |
| `export default` | 금지 | 새 코드 금지. 기존 `pages/`·`screens/` 는 그대로 | expo-router 시절의 라우트 파일 관례다. 일괄 변경은 이득보다 diff 비용이 크다 |
| URL 경로 | 컬렉션 이름 `lowerCamelCase` | `kebab-case` (`/consult-requests`) | 계약(`openapi.yaml`)에서 이미 확정됐다 |
| enum 값 | `UPPER_SNAKE_CASE` | 소문자 문자열 (`'booked'`). 에러 코드만 `UPPER_SNAKE_CASE` | 계약에서 이미 확정됐다 |
| 시각 필드 이름 | `createTime` | `createdAt` | 계약·Prisma 스키마에서 이미 확정됐다 |
| 페이지네이션 | `pageToken` | `page`·`pageSize` (offset) | 화면이 총 건수를 보여준다 — `docs/api/README.md` §5 |
| 에러 `message` | 개발자가 읽는 문구 | **사용자에게 그대로 보여줄 한국어** | 프론트가 코드별 문구 사전을 따로 들지 않게 한다 — `docs/api/README.md` §11 |
| 코드 리뷰 | 다른 사람의 승인이 필요하다 | 셀프 리뷰 + `code-reviewer`·`qa-master` 에이전트 + 완료 게이트 | 혼자 개발한다 — `CLAUDE.md` "혼자 개발 체제" |

## 도구가 막는 것과 사람이 지키는 것

도구가 막는 규칙은 외울 필요가 없다. 오른쪽 칸만 사람(과 `code-reviewer`)이 본다.
(2026-10-22 에 `eslint --print-config` 로 확인한 값이다.)

| 도구가 막는다 (error) | 사람이 지킨다 (아직 막는 도구가 없다) |
|---|---|
| `any`, 타입 전용 import, 쓰지 않는 변수, `var`, `prefer-const`, 빈 블록·빈 `catch`, `@ts-ignore`·`@ts-nocheck`, `namespace`, `debugger`, 훅 규칙(`rules-of-hooks`·`exhaustive-deps`), 접근성 기본(`jsx-a11y`), 서버의 `console`, `strict` 타입 검사, `switch` 의 fallthrough(`noFallthroughCasesInSwitch`) | `===` (`eqeqeq` 꺼짐), `switch` 의 `default`, `await` 하지 않은 Promise (`no-floating-promises` 는 타입 정보 lint 가 필요해 꺼짐), 문자열 `throw`, non-null 단언 `!`, 이름 규칙, export 방식, 주석 품질, 테스트 구조 |

오른쪽 칸의 규칙을 lint 로 옮기는 것은 언제든 환영이다. 단 기존 코드 수정이 따라오므로
**lint 규칙 추가와 그에 따른 수정만 담은 별도 커밋**으로 한다.

## 남은 격차 — 포맷터 설정 파일이 없다

- `frontend/package.json` 에 `format` 스크립트(`prettier --write`)가 있지만 **Prettier 설정 파일이 없다.**
  지금 돌리면 Prettier 기본값(큰따옴표·80자)으로 `src/` 전체를 다시 쓴다. 이미 파일 4개
  (`AdminNarrowNav.tsx`, `SuggestionList.tsx`, `useSuggestions.ts`, `screens/search.tsx`)가 큰따옴표로 섞여 있다.
- **설정 파일을 넣기 전까지 `npm run format` 을 돌리지 않는다.**
- 넣을 때의 값은 기존 코드에서 잰 것이다:

  ```json
  {
    "singleQuote": true,
    "semi": true,
    "trailingComma": "all",
    "printWidth": 100,
    "arrowParens": "always"
  }
  ```

  설정 추가와 전체 재포맷은 **포맷만 바꾸는 단독 커밋**으로 하고, 백엔드에도 같은 파일을 둔다.

## 근거로 쓴 원문

- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html)
- [Google Engineering Practices — 코드 리뷰](https://google.github.io/eng-practices/)
- [API Improvement Proposals (AIP)](https://google.aip.dev/), [Google Cloud API Design Guide](https://cloud.google.com/apis/design)
- [*Software Engineering at Google* — 11~14장 테스트](https://abseil.io/resources/swe-book)
- [Google Documentation Guide (Markdown 스타일·문서 관행)](https://google.github.io/styleguide/docguide/)
- [Google Developer Documentation Style Guide](https://developers.google.com/style)
- [gts](https://github.com/google/gts) — Google 이 Node.js/TypeScript 프로젝트용으로 배포하는 lint·포맷 설정 묶음.
  이 저장소는 gts 를 쓰지 않고 같은 계열(ESLint flat config + typescript-eslint)을 직접 설정했다.
