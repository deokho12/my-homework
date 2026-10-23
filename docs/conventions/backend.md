# 백엔드 규칙 (`backend/`)

NestJS 11 + Prisma 6 + SQLite + zod. 언어 규칙은 [typescript.md](typescript.md)를 따르고, 이 문서는
서버에만 해당하는 것을 다룬다. 실행 방법·인증 구조·시드는 `backend/README.md`, 데이터 설계는
`docs/database/README.md` 가 정본이다.

## 작업 순서

서버를 바꾸는 작업은 **계약 먼저**다 (`CLAUDE.md` "서버를 바꾸는 작업의 순서").

1. `db-master` — 스키마 (`docs/database/README.md`, `prisma/schema.prisma`)
2. `interface-master` — API 계약 (`docs/api/openapi.yaml`, `docs/api/README.md`)
3. `backend-engineer` — 구현. **테스트를 먼저 쓴다.**

`prisma migrate`·`prisma:reset`·시드 변경 전에는 개발 DB 를 백업한다 (`CLAUDE.md` 안전장치 2).

## 도메인 폴더 구조

도메인 하나가 `src/<도메인>/` 폴더 하나다. 파일 이름은 `kebab-case.<역할>.ts` 다.

| 파일 | 책임 | 모르는 것 |
|---|---|---|
| `<도메인>.module.ts` | Nest 모듈 배선 | — |
| `<도메인>.controller.ts` | 경로·가드·파이프·HTTP 상태 코드. **배선만 한다** | Prisma, 판정 규칙 |
| `<도메인>.service.ts` | **조합**: 리포지토리·순수 규칙·다른 서비스를 엮고 트랜잭션 경계를 정한다 | HTTP 요청·응답 객체 |
| `<도메인>.repository.ts` | Prisma 쿼리 | 판정 규칙, HTTP |
| `<도메인>.schemas.ts` | 입력 zod 스키마 + `z.infer` 로 뽑은 DTO 타입 | — |
| `<도메인>.projection.ts` | DB 행 → 응답 모양 (마스킹 포함). 순수 함수 | DB, HTTP |
| `<규칙>.ts` (`distance.ts`, `sponsorship.ts`, `transition.ts`) | 판정 규칙. 순수 함수 | DB, HTTP, Nest, 현재 시각 |
| `<도메인>.types.ts` | 여러 파일이 함께 쓰는 타입 | — |

공통 기반은 `src/common/` (에러·필터·파이프·페이지네이션·로그), 설정은 `src/config/` 에 있다.

## 계층 규칙 — 배선 · 조합 · 순수 함수

`AGENTS.md` 의 "컨트롤러는 배선, 서비스는 조합, 규칙은 순수 함수" 를 그대로 따른다.

```ts
// 나쁨 — 판정이 컨트롤러에 있다. DB 없이 테스트할 수 없고, 프론트의 같은 판정과 갈라진다
@Patch(':id/status')
async updateStatus(@Body() body: UpdateStatusDto) {
  if (body.status === 'booked' && !body.visitAt) {
    throw new ApiError('VALIDATION_FAILED');
  }
  ...
}

// 좋음 — 판정은 순수 함수(transition.ts), 서비스가 조합하고, 컨트롤러는 넘기기만 한다
export function requiredInputs(next: ConsultStatus): ReadonlyArray<'visitAt' | 'cancelReason'> {
  switch (next) {
    case 'booked':
      return ['visitAt'];
    case 'cancelled':
      return ['cancelReason'];
    default:
      return [];
  }
}
```

- 서비스는 Prisma 를 **리포지토리를 거쳐** 쓴다. 헬스체크·토큰 정리 같은 기반 서비스만 예외다.
- 순수 규칙 모듈은 `@nestjs/*`·`@prisma/client` 를 import 하지 않는다. 현재 시각도 인자로 받는다.
- 응답 모양은 `*.projection.ts` 가 만든다. 서비스가 응답 객체를 손으로 조립하지 않는다 —
  마스킹 같은 노출 규칙이 한 곳에 모여야 빠지는 경로가 없다.
- **계약에 없는 엔드포인트·필드·상태를 만들지 않는다.** 계약에 있지만 소비 화면이 없어 미룬 것은
  `backend/README.md` 의 미룬 것 절과 `docs/features/known-issues.md` 에 근거와 함께 적는다.

## Nest 의존성 주입과 `import type`

Nest 는 생성자 매개변수의 **런타임 타입 정보**(`emitDecoratorMetadata`)로 주입할 클래스를 찾는다.
`import type` 으로 가져오면 컴파일 결과에서 import 가 지워져 주입이 깨진다.
그래서 **생성자에 주입되는 클래스만** 값으로 import 하고 lint 를 그 줄에서만 끈다.

```ts
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConsultService } from './consult.service';
import type { AdminConsultListResult } from './consult.service';

@Controller('consult-requests')
export class ConsultController {
  constructor(private readonly consults: ConsultService) {}
}
```

그 밖의 모든 타입 전용 import 는 `import type` 이다.

## 입력 검증

- 외부 입력(본문·쿼리·경로 매개변수)은 **경계에서 한 번** 검증한다: `<도메인>.schemas.ts` 의 zod 스키마 +
  `ZodValidationPipe`. 검증을 통과한 뒤의 안쪽 코드는 타입을 믿고 다시 검사하지 않는다.
- 검사 **순서가 계약인** 경우(상담 접수: 동의 → 연락처 → 조건)는 서비스가 순서대로 검사한다.
  그 이유를 컨트롤러 주석에 쓴다.
- 상태 코드: 구조가 깨진 요청(JSON 아님, 타입 깨짐)은 `400`, 형식은 맞는데 규칙에 어긋나면 `422` 다
  (`docs/api/README.md` §11).

## 에러

- 의도한 실패는 `ApiError` 로 던진다. 코드는 `src/common/errors/api-error.ts` 의 `ERROR_CATALOG` 에 있고,
  코드 하나가 **HTTP 상태와 사용자 문구를 함께** 가진다.
- 새 에러 코드는 `ERROR_CATALOG` 와 `docs/api/README.md` §11·`openapi.yaml` 에 **함께** 추가한다.
  `message` 는 사용자에게 그대로 보이는 한국어이므로 해당 화면 문서(`docs/features/*.md`)의 문구와 맞춘다.
- 예상하지 못한 에러는 잡지 말고 그대로 던진다. `all-exceptions.filter.ts` 가 `500 INTERNAL_ERROR` 와
  `requestId` 로 바꾼다. **내부 메시지·스택·SQL 을 응답에 싣지 않는다.**
- 존재 여부가 개인정보와 이어지는 자원(상담·알림)은 "없음" 과 "남의 것" 을 구분하지 않고 둘 다 `404` 다.
  `403` 을 주면 id 를 차례로 넣어 건수를 알아낼 수 있다.

## 로그

- `console` 대신 Nest `Logger` 를 쓴다 (lint error). 클래스마다
  `private readonly logger = new Logger(Xxx.name)` 로 만든다.
- **요청·응답 본문, 비밀번호, 토큰, 이름·연락처를 로그에 남기지 않는다** (`docs/decisions/0001-roles-and-pii.md`).
- 요청이 어디서 멈췄는지는 dev 단계 추적 로그(`src/common/logging/dev-trace.ts`)가 이미 찍는다.
  서비스·리포지토리에 추적용 로그를 따로 넣지 않는다.
- 사용자가 자유롭게 입력하는 쿼리 키가 새로 생기면 `REDACTED_QUERY_KEYS` 에 더한다.

## 설정과 비밀

- `process.env` 를 코드 곳곳에서 읽지 않는다. `src/config/env.schema.ts` 가 **부팅할 때 검증**하고,
  값이 틀리면 서버가 뜨지 않는다. (`dev-trace.ts` 의 `NODE_ENV` 읽기는 이유가 주석에 있는 예외다.)
- 새 환경변수는 스키마와 `.env.example`(값 없이)에 함께 추가한다.
- 비밀 값은 요청자가 `.env` 에 직접 넣는다. 채팅·코드·테스트·문서에 쓰지 않는다.
  커밋 전 확인은 `CLAUDE.md` 안전장치 3 을 따른다.

## 데이터베이스

- 이식성 규칙(`docs/database/README.md` §3)을 따른다. 특히 **raw SQL 을 쓰지 않는다** (§3.8) —
  `$queryRaw`·`$executeRaw` 대신 Prisma 쿼리를 쓴다. SQL 문자열을 이어 붙이지 않으니 주입 공격도 막힌다.
- 함께 성공하거나 함께 실패해야 하는 쓰기(상태 변경 + 이력 + 알림 + 감사)는 **한 트랜잭션**이다
  (`docs/api/README.md` §9).
- 목록 정렬의 마지막 기준은 언제나 `id` 오름차순이다. 같은 값끼리의 순서가 흔들리면 페이지 사이에서
  항목이 중복되거나 사라진다 (`docs/api/README.md` §5).

## 시간

- 시각은 UTC 로 저장하고 ISO 8601 문자열(`toISOString()`)로 응답한다.
- "오늘", "이번 달" 같은 **한국 날짜 경계**는 순수 함수가 계산한다 (`seoulDateKey`, `periodRange`).
  서버가 도는 기기의 시간대에 기대지 않는다.
- 규칙 함수 안에서 `new Date()`·`Date.now()` 를 부르지 않는다. 호출하는 쪽이 `now` 를 넘긴다.
  그래야 테스트가 날짜에 따라 달라지지 않는다.
- "시각" 과 "달력 날짜" 는 다른 타입이다 (`docs/database/README.md` §3.7).

## 인증·인가

- 인가는 가드 3층(`AuthGuard` → `RolesGuard` → `HospitalScopeGuard`)으로 한다. 사용법은
  `backend/README.md` "인가 3층" 절에 있다. 담당 범위 판단은 `ResourceScopeService` 를 쓴다.
  서비스마다 역할 문자열을 비교하는 `if` 를 새로 만들지 않는다.
- 로그인 실패는 "계정 없음" 과 "비밀번호 틀림" 을 같은 코드·같은 문구로 돌려준다 (`INVALID_CREDENTIALS`).
- 개인정보 마스킹은 projection 에서 한다. 전체 연락처를 보여주는 경로는 감사 로그를 남긴다.

## 경로와 import

- `src` 안에서는 **상대 경로**로 import 한다. 경로 별칭을 두지 않는다 (`backend/tsconfig.json` 주석 참고).
- CLI 스크립트(`src/scripts/`, `prisma/`)만 `console` 을 쓴다. 그 출력이 곧 화면이다.
