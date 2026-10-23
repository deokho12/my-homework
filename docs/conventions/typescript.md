# TypeScript 규칙 (프론트·백 공통)

[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)를 기준으로 했다.
`frontend/` 와 `backend/` 모두 이 문서를 따른다. 각자에만 해당하는 것은 [frontend.md](frontend.md),
[backend.md](backend.md) 에 있다.

## 1. 파일과 모듈

### 파일 안의 순서

1. 파일 개요 JSDoc (필요할 때) — 이 모듈이 무엇을 책임지고 무엇을 책임지지 않는지
2. import
3. 구현

### import

- **외부 패키지 → 빈 줄 → 내부 모듈** 순서로 묶는다. 묶음 안에서는 경로 알파벳순이다.
- 값 import 와 타입 import 는 줄을 나눈다. 같은 모듈이라도 `import type` 을 따로 쓴다.
- 경로:
  - 프론트엔드는 `@/` 별칭을 쓴다 (`@/features/consult/lib/transition`).
  - 백엔드는 **상대 경로만** 쓴다. `nest build` 가 별칭을 풀지 않아서 `node dist/main.js` 가 모듈을
    못 찾는다 (`backend/tsconfig.json` 주석).
  - 상대 경로가 `../../../` 처럼 세 단계를 넘으면 파일 위치를 다시 생각한다.

```ts
// 좋음
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { ApiError } from '../common/errors/api-error';
import type { ApiErrorDetail } from '../common/errors/api-error';
import { buildPageMeta } from '../common/pagination';
```

### export

- **이름 붙은 export 만 쓴다.** `export default` 는 새 코드에 쓰지 않는다.
  이름 붙은 export 는 import 하는 쪽마다 이름이 달라지지 않고, 없는 이름을 가져오면 컴파일러가 잡는다.
  (기존 `pages/`·`screens/` 의 default export 는 라우트 관례라 그대로 둔다.)
- 모듈 밖에서 쓰지 않는 것은 export 하지 않는다. export 는 공개 약속이다.
- `export let` 처럼 바뀌는 값을 export 하지 않는다. 바뀌는 상태가 필요하면 함수로 감싼다.
- 정적 메서드만 모은 클래스로 이름공간을 흉내 내지 않는다. 함수를 각각 export 한다.
- `namespace` 를 쓰지 않는다. 모듈 파일 하나가 이름공간이다. (lint error)

```ts
// 나쁨
export default class HospitalUtils {
  static distanceKm(a: LatLng, b: LatLng): number { ... }
}

// 좋음
export function distanceKm(a: LatLng, b: LatLng): number { ... }
```

## 2. 이름

### 형식

| 무엇 | 형식 | 예 |
|---|---|---|
| 클래스·인터페이스·타입 별칭·컴포넌트·타입 매개변수 | `UpperCamelCase` | `ConsultService`, `HospitalCardProps`, `T` |
| 변수·매개변수·함수·메서드·프로퍼티 | `lowerCamelCase` | `hospitalId`, `fetchConsultRequests` |
| 모듈 수준의 바뀌지 않는 값 | `CONSTANT_CASE` | `ERROR_CATALOG`, `DELAYED_TODO_LIMIT` |
| 함수 안의 `const` | `lowerCamelCase` | `const pageSize = 20` |
| React 훅 | `use` + `UpperCamelCase` | `useConsultRequests` |
| API 에러 코드 | `UPPER_SNAKE_CASE` 문자열 | `'CONSULT_REQUEST_NOT_FOUND'` |

### 고르는 법

- **새 독자가 바로 알아듣게 쓴다.** 범위가 10줄 안쪽인 지역 변수만 짧은 이름(`i`, `row`)을 쓴다.
- **약어는 단어처럼 쓴다.** `loadHttpUrl` 이지 `loadHTTPURL` 이 아니다. `userId`, `apiUrl`, `HttpError`.
- 도메인 이름은 **계약의 이름을 그대로** 쓴다. `openapi.yaml` 의 스키마·필드가 `consultRequest` 면
  코드도 `consultRequest` 다. 같은 개념에 영어 이름이 둘 생기면 검색이 안 된다.
- 함수는 동사로 시작한다 (`buildPageMeta`, `normalizePhone`). 불리언은 질문처럼 읽히게 쓴다
  (`isConsultCancelReason`, `hasNextPage`, `canEdit`).
- 붙이지 않는 것: 인터페이스의 `I` 접두사(`IHospital`), 헝가리안 표기(`strName`), 타입을 반복하는
  접미사(`hospitalList: Hospital[]` 보다 `hospitals`).
- `_` 접두사는 **일부러 쓰지 않는 인자·변수**에만 쓴다 (lint 가 이 관례를 안다). private 표시에는 쓰지 않는다.
- 코드 식별자는 영어, 사용자에게 보이는 문구는 한국어 문자열이다.

## 3. 타입

### 기본

- `strict` 를 끄지 않는다. 두 `tsconfig.json` 모두 켜져 있다.
- **`any` 대신 `unknown`.** 받은 다음 좁혀서 쓴다. 타입 정의가 없는 외부 SDK(Kakao Maps)만
  lint 가 warn 으로 풀어 두었다.
- `{}`, `Object`, `String`, `Number`, `Boolean` 을 타입으로 쓰지 않는다. `unknown`, `object`,
  `Record<string, T>`, 소문자 원시 타입을 쓴다.
- `@ts-ignore`·`@ts-nocheck` 를 쓰지 않는다 (lint error). 타입이 틀렸으면 타입을 고친다.

### 추론과 명시

- 값에서 바로 보이는 타입은 적지 않는다 (`const count = 0`, `const map = new Map<string, Hospital>()`).
- 반환 타입은 작성자가 판단한다. 계약 응답처럼 **모양 자체가 약속**인 곳은 적는다 — 구현이 바뀌어도
  약속이 조용히 바뀌지 않는다.

### 모양을 표현하는 법

- 객체 모양은 `interface`, 유니언·교차·매핑 타입은 `type` 으로 쓴다.
  (현재 코드: `interface` 약 300개, 객체 `type` 별칭 7개)
- 상태·종류는 **문자열 리터럴 유니언**으로 쓰고 `enum`·`const enum` 은 쓰지 않는다.
  계약의 JSON 값과 1:1 로 맞고, zod 의 `z.enum` 과 그대로 이어진다.

  ```ts
  export type ConsultScope = 'managed' | 'all';
  ```

- 배열: 단순 타입은 `T[]`·`readonly T[]`, 유니언이나 객체 리터럴처럼 복잡하면 `Array<T>` 가 읽기 쉽다.
- 선택 필드는 `| undefined` 보다 `?:` 로 쓴다. API 의 "값 없음" 은 계약대로 `null` 이다.
- 객체 상수의 모양을 검사하면서 리터럴 타입을 지키려면 `as const satisfies` 를 쓴다
  (`ERROR_CATALOG` 가 그 예다).

### 런타임 경계에서는 zod

외부에서 들어오는 값(요청 본문, 쿼리, 폼 입력, 환경변수)은 zod 스키마로 검증하고, 타입은
`z.infer` 로 **스키마에서 뽑는다.** 같은 모양을 타입과 검증에 두 번 쓰지 않는다.

```ts
export const createConsultRequestSchema = z.object({ ... });
export type CreateConsultRequestDto = z.infer<typeof createConsultRequestSchema>;
```

### 단언 (`as`, `!`)

- 타입 단언과 non-null 단언은 컴파일러를 끄는 것이다. **쓰면 왜 안전한지 주석을 붙인다.**
- 객체 리터럴에는 `as Foo` 대신 `: Foo` 로 적는다. 그래야 빠진 필드·남는 필드를 컴파일러가 잡는다.
- 꺾쇠 단언(`<Foo>x`)은 쓰지 않는다.

```ts
// 나쁨 — 필드가 빠져도 통과한다
const meta = { page: 1 } as PageMeta;

// 좋음
const meta: PageMeta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
```

## 4. 언어 기능

### 변수와 비교

- 한 선언에 변수 하나. `const` 가 기본이다.
- `===`·`!==` 만 쓴다. 예외는 `x == null` (null 과 undefined 를 함께 거른다) 하나다.
- 숫자 변환은 `Number(x)` 로 하고 `Number.isNaN` 으로 확인한다. 단항 `+x` 로 변환하지 않는다.
  `parseInt` 는 진법을 명시할 때만 쓴다.

### 제어문

- `if`·`for`·`while` 은 항상 중괄호를 쓴다. 한 줄에 끝나는 `if (x) return;` 만 예외다.
- 배열은 `for...of` 나 배열 메서드로 돈다. `for...in` 은 쓰지 않는다. 객체는 `Object.entries` 로 돈다.
- `switch` 에는 항상 `default` 를 둔다. 비어 있지 않은 `case` 는 다음 `case` 로 넘어가지 않는다
  (`noFallthroughCasesInSwitch` 가 막는다).
- 유니언 타입을 `switch` 할 때는 `default` 에서 `never` 로 **빠짐없음을 컴파일러에 검사시킨다.**
  상태가 하나 늘면 이 줄에서 컴파일이 깨진다.

  ```ts
  switch (status) {
    case 'booked':
      return '예약확정';
    case 'cancelled':
      return '취소';
    // ...
    default: {
      const unreachable: never = status;
      throw new Error(`알 수 없는 상담 상태: ${String(unreachable)}`);
    }
  }
  ```

### 함수

- 이름 있는 함수는 `function` 선언으로 쓴다. 콜백·인라인 함수는 화살표 함수로 쓴다.
  `function` 표현식(`const f = function () {}`)은 쓰지 않는다.
- 화살표 함수의 간결 본문(`() => value`)은 반환값을 쓸 때만 쓴다.
- 클래스 밖에서 `this` 를 쓰지 않는다.
- `arguments` 대신 나머지 매개변수(`...args`)를 쓴다.
- **받은 객체·배열을 고치지 않는다.** 새 값을 만들어 반환한다. React 상태와 TanStack Query 캐시는
  특히 그렇다 — 제자리에서 고치면 화면이 갱신되지 않는다.

### 클래스

- 숨길 멤버는 TypeScript 의 `private` 을 쓴다. `#private` 필드는 쓰지 않는다.
- 생성자 밖에서 다시 대입하지 않는 필드는 `readonly` 다.
- 생성자 주입은 매개변수 프로퍼티로 쓴다 (`constructor(private readonly repo: ConsultRepository) {}`).
- `public` 은 기본값이라 적지 않는다.
- getter 에는 부수효과를 두지 않는다. 읽을 때마다 같은 값이 나와야 한다.

### 문자열과 리터럴

- 문자열은 작은따옴표, 조합은 템플릿 리터럴(`` `총 ${count}곳` ``)로 쓴다.
- 배열·객체는 리터럴로 만든다 (`[]`, `{}`). `new Array()`, `new Object()` 를 쓰지 않는다.

### 쓰지 않는 것

`eval`, `new Function('...')`, `with`, `debugger` 커밋, 내장 객체의 프로토타입 수정,
원시 래퍼 객체(`new String('x')`), 세미콜론 자동 삽입에 기대는 코드.

## 5. 비동기

- `async`/`await` 를 쓴다. `.then()` 체인은 짧은 변환 하나일 때만 쓴다.
- **모든 Promise 는 `await` 하거나 반환한다.** 일부러 기다리지 않을 때는 `void promise` 로 쓰고
  왜 기다리지 않는지 주석을 단다. 놓친 Promise 의 실패는 아무 데도 찍히지 않는다.
- 서로 기다릴 필요 없는 작업은 `Promise.all` 로 함께 보낸다. 반복문 안의 순차 `await` 는
  순서가 정말 필요할 때만 쓴다.

```ts
// 나쁨 — 두 조회가 차례로 돈다
const hospital = await hospitalRepo.findById(id);
const doctors = await doctorRepo.listByHospital(id);

// 좋음
const [hospital, doctors] = await Promise.all([
  hospitalRepo.findById(id),
  doctorRepo.listByHospital(id),
]);
```

## 6. 에러

- **`Error` 객체만 던진다** (`throw new Error(...)` 또는 그 하위 클래스). 문자열·객체 리터럴을 던지지 않는다.
  스택이 남지 않는다.
- `catch` 의 값은 `unknown` 이다 (`strict` 의 기본값). `instanceof` 등으로 좁힌 뒤에 쓴다.
- 빈 `catch` 는 lint 가 막는다. 일부러 무시할 때는 왜 무시해도 되는지 주석을 쓴다.
- 잡아서 다른 에러로 다시 던질 때는 원인을 남긴다: `throw new Error('...', { cause: error })`.
- **실패를 그럴듯한 기본값으로 바꾸지 않는다.** 읽을 수 없는 날짜는 `null` 이지 오늘 날짜가 아니다.
  틀린 값은 에러보다 늦게, 더 멀리서 드러난다.
- 서버의 API 에러는 `ApiError` 와 `ERROR_CATALOG` 로, 화면은 `isApiError(error) && error.code === '...'`
  로 분기한다 ([backend.md](backend.md#에러), [frontend.md](frontend.md#서버-호출)).

## 7. 순수 함수로 떼는 규칙

`AGENTS.md` 의 "규칙은 순수 함수" 를 코드 수준에서 풀면 이렇다.

- 판정 규칙(필수 입력, 노출 여부, 거리, 배지, 기간 경계)은 **DB·HTTP·React·현재 시각을 모르는** 함수로 쓴다.
  필요한 것은 전부 인자로 받는다. 현재 시각도 `now: Date` 인자로 받는다.
- 그래야 DB 없이 경계값을 small 테스트로 고정할 수 있다 ([testing.md](testing.md)).
- **같은 판정을 두 곳에 두지 않는다.** 두 곳에 필요하면 함수를 공유한다. 프론트와 서버처럼 공유할 수
  없으면 같은 이름의 모듈을 양쪽에 두고 **동기화 테스트**로 묶는다
  (`frontend/src/features/consult/consultServerRules.sync.test.ts`). 공유하지 못하는 이유는 주석에 적는다.

## 8. 주석

자세한 규칙은 [documentation.md](documentation.md)에 있다. 요점은 셋이다.

- `/** ... */` 는 쓰는 사람을 위한 문서, `//` 는 고치는 사람을 위한 메모다.
- **무엇이 아니라 왜를 쓴다.**
- JSDoc 에 타입을 다시 적지 않는다 (`@param {string}` 은 쓰지 않는다). 타입은 TypeScript 가 말한다.

## 9. 포맷

Google 은 포맷을 사람이 아니라 도구가 정하게 한다. 이 저장소의 현재 포맷은 다음과 같다
(기존 코드에서 잰 값이다. 포맷터 설정이 아직 없다 — [README.md](README.md#남은-격차--포맷터-설정-파일이-없다)).

| 항목 | 값 |
|---|---|
| 들여쓰기 | 공백 2칸 |
| 세미콜론 | 항상 |
| 따옴표 | 작은따옴표 |
| 여러 줄 목록의 끝 쉼표 | 항상 |
| 한 줄 길이 | 100자 안팎 (문자열·URL·표는 예외) |
| 화살표 함수 인자 괄호 | 항상 (`(row) => ...`) |
| 중괄호 안 공백 | 있음 (`{ Injectable }`) |

- 기능 변경과 **관계없는 줄을 다시 포맷하지 않는다.** 포맷 변경은 포맷만 담은 커밋으로 한다.
  리뷰할 diff 에 의미 없는 줄이 섞이면 진짜 변경이 묻힌다.
