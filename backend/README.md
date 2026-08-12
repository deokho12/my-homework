# 몰라몰라 백엔드 (NestJS + Prisma + SQLite)

현재 상태: **인증·인가까지 구현되어 있습니다.** 도메인 API(병원·전문의·상담…)는 아직 없고,
`GET /health`, `POST|GET /api/auth/*` 5개, 그리고 그 위에 얹을 가드 3층이 있습니다.

| | |
|---|---|
| 프레임워크 | NestJS 11 (CommonJS, `@nestjs/cli` 빌드) |
| DB | SQLite (Prisma 6). 이전 대상은 PostgreSQL 14+ |
| 검증 | **Zod** (프론트엔드와 같은 라이브러리) |
| 테스트 | **Vitest** + SWC (프론트엔드와 같은 러너) |
| 설계 문서 | [`../docs/database/README.md`](../docs/database/README.md), [`prisma/schema.prisma`](prisma/schema.prisma) |

---

## 처음 실행할 때

```bash
cd backend
npm install                 # 설치 스크립트 승인이 필요할 수 있습니다 (아래 참고)
cp .env.example .env        # DATABASE_URL, SEED_PASSWORD, JWT_*_SECRET 을 채웁니다
npm run prisma:migrate      # 마이그레이션 적용 (prisma/dev.db 생성)
npm run prisma:seed         # 프론트엔드 fixture → DB
npm run dev                 # http://localhost:3000/health
```

> **npm 11 의 설치 스크립트 차단**: `npm install` 이
> `5 packages have install scripts not yet covered by allowScripts` 를 출력하면
> Prisma 엔진과 esbuild/SWC 바이너리가 설치되지 않은 상태입니다.
> `package.json` 의 `allowScripts` 에 승인 목록이 들어 있으므로 보통은 그대로
> 진행되지만, 새 패키지를 추가한 뒤라면 `npm approve-scripts <pkg>` 로 승인하세요.

> **JWT 키**: `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` 은 **기본값이 없습니다.**
> 비었거나 32자 미만이거나 두 값이 같으면 부팅이 실패합니다. `.env.example` 에
> 개발용 예시 값과 생성 명령이 들어 있습니다. 이미 `.env` 를 갖고 있다면 이 4~6줄을
> 추가해야 서버가 뜹니다.

Node 는 v24.19.0 / npm 11.17.0 에서 검증했습니다. PATH 에 node 가 없으면
Git Bash 에서 `export PATH="$PATH:/c/Program Files/nodejs"` 를 먼저 실행하세요.

---

## 명령어

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | `nest start --watch` (기본 포트 3000) |
| `npm run build` | `nest build` → `dist/` |
| `npm start` | `node dist/main.js` |
| `npm run typecheck` | 서버 코드 + 시드 스크립트 두 tsconfig 를 모두 검사 |
| `npm run lint` | ESLint (flat config, typescript-eslint) |
| `npm run test` | Vitest watch |
| `npm run test:run` | Vitest 1회 실행 (CI 게이트) |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` (운영/CI) |
| `npm run prisma:seed` | 시드 (idempotent — 여러 번 돌려도 안전) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run prisma:reset` | DB 초기화 + 마이그레이션 + 시드 |
| `npm run operator:grant -- <email>` | 기존 계정을 `operator` 로 승격 (DB 직접 쓰기) |
| `npm run operator:revoke -- <email>` | `operator` 회수 (`--force` 로 마지막 운영자까지) |
| `npm run verify:guards` | 인가 수동 확인용 서버 (테스트 전용 보호 라우트 포함, 포트 3100) |

`npm run test:run` 은 **`.env` 의 DATABASE_URL(개발용 SQLite)을 그대로 씁니다.**
그래서 테스트 전에 `prisma:migrate` + `prisma:seed` 가 되어 있어야 합니다.
(테스트는 읽기만 하므로 시드 데이터를 훼손하지 않습니다)

---

## 구조

```
backend/
├── prisma/
│   ├── schema.prisma          # 27개 모델 (확정. 바꾸려면 db-master 와 논의)
│   ├── migrations/            # 20260812121726_init
│   ├── seed.ts                # fixture → DB (idempotent, upsert)
│   ├── seed/
│   │   ├── accounts.ts        # 개발용 계정 정의 + bcrypt
│   │   ├── dates.ts           # SEED_TODAY 기준 날짜 정책
│   │   └── fixtures.ts        # frontend fixture import 창구 (유일)
│   └── tsconfig.seed.json     # 시드 전용 (@/* → frontend/src/*)
├── prisma.config.ts           # Prisma CLI 설정 (seed 명령, .env 로드)
├── src/
│   ├── main.ts                # 부트스트랩
│   ├── app-setup.ts           # /api 접두어 · 요청 id · 예외 필터 (테스트도 이 함수를 씁니다)
│   ├── app.module.ts
│   ├── config/env.schema.ts   # Zod 환경변수 검증 (실패 = 부팅 실패)
│   ├── common/
│   │   ├── errors/api-error.ts               # 에러 코드 카탈로그 (코드 → 상태 + 한국어 문구)
│   │   ├── filters/all-exceptions.filter.ts  # { error: { code, message, details, requestId } }
│   │   ├── http/request-id.ts                # X-Request-Id
│   │   └── pipes/zod-validation.pipe.ts      # 422 VALIDATION_FAILED
│   ├── auth/                  # 인증·인가 (아래 절 참고)
│   ├── scripts/
│   │   └── operator-role.ts   # 운영자 승격·회수 CLI (HTTP 경로 없음 — 결정 4)
│   ├── prisma/                # PrismaService (전역 모듈, lifecycle hook)
│   └── health/                # GET /health
└── test/
    ├── support/
    │   ├── app.ts                   # 테스트 앱 + 시드 계정 로그인 헬퍼
    │   ├── guard-test.module.ts      # ★ 인가 테스트 전용 보호 라우트 (src 에 두지 않습니다)
    │   └── guard-test-server.ts      # `npm run verify:guards` 의 진입점 (curl 확인용)
    ├── authorization.e2e.spec.ts     # 401/403/404 인가 행렬
    ├── auth-accounts.e2e.spec.ts     # 가입·로그인·내 정보
    ├── auth-tokens.e2e.spec.ts       # 회전·재사용 감지·폐기
    ├── operator-cli.spec.ts          # 부트스트랩 CLI + "HTTP 승격 경로 없음"
    ├── health.e2e.spec.ts            # 헬스체크 200/503 + DB 를 실제로 읽는지
    └── seed-data.spec.ts             # 시드 데이터 + 변환 검증
```

라우팅 규칙: 모든 도메인 API 는 `/api` 접두어를 씁니다. **`/health` 만 예외**입니다
(모니터링·컨테이너 프로브가 접두어를 몰라도 되게).

---

## 인증·인가

계약은 `docs/api/openapi.yaml`(auth 오퍼레이션 + 각 오퍼레이션의 `x-role`)과
`docs/api/README.md` §3·§11, 역할 정의는 `docs/decisions/0001-roles-and-pii.md` 입니다.

### 토큰

| | 값 | 왜 |
|---|---|---|
| 액세스 토큰 | JWT HS256, **15분**, 클레임 `sub role typ jti iat exp iss aud` | 폐기 수단이 없는 무상태 검증이라 짧게 둡니다 |
| 리프레시 토큰 | JWT HS256(**다른 키**), **30일**, 본문으로 전송, 회전 | 쿠키를 쓰지 않는 것은 Flutter 앱이 같은 API 를 쓰기 때문입니다 |
| 저장 위치(클라이언트) | localStorage (프론트엔드 현행) | httpOnly 쿠키는 웹 전용 메커니즘입니다. 대가는 XSS 노출이며, 액세스 15분 + 회전 + 재사용 감지로 완화합니다 |
| `managedHospitalIds` | **클레임에 넣지 않습니다** | 담당 해제가 토큰 만료까지 반영되지 않습니다. 매 요청 `hospital_admins` 를 조회합니다 |

리프레시 토큰 상태(회전·재사용 감지·일괄 폐기)는 **프로세스 메모리**에 있습니다
(`src/auth/refresh-token.store.ts`). 서버를 재시작하면 전원 재로그인이고 **인스턴스를 2개
이상 띄우면 동작하지 않습니다.** `refresh_tokens` 테이블이 필요하며, 저장소를 바꿀 때
고치는 파일은 그 하나입니다 (`AuthModule` 의 provider 한 줄).

### 인가 3층 — 도메인 컨트롤러에서 쓰는 방법

```ts
@Patch(':hospitalId')
@UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)   // ← 순서가 응답 코드를 정합니다
@Roles('hospital_admin', 'operator')                    // openapi 의 x-role
@HospitalScope({ resource: 'hospital' })                // 담당 병원 검사
update(@CurrentUser() user: AuthenticatedUser, @Scope() scope: ResolvedScope) {}
```

1. `AuthGuard` — 토큰 없음/위조 `401 UNAUTHENTICATED`, 만료 `401 ACCESS_TOKEN_EXPIRED`
2. `RolesGuard` — `x-role` 밖이면 `403 FORBIDDEN`
3. `HospitalScopeGuard` — 담당 범위 밖이면 **자원에 따라** `403` 또는 `404`

| 자원 | 담당 범위 밖 | 없는 자원 |
|---|---|---|
| `hospital` / `doctor` (공개 자원) | `403 HOSPITAL_NOT_MANAGED` | `404 HOSPITAL_NOT_FOUND` / `DOCTOR_NOT_FOUND` |
| `consultRequest` (비공개 자원) | **`404 CONSULT_REQUEST_NOT_FOUND`** | 같은 `404` — **구분되지 않습니다** |

상담이 404 인 이유는 상담 id 가 고객 개인정보와 1:1 이어서, 403 이면 id 순차 대입으로
건수·활동량을 셀 수 있기 때문입니다. `test/authorization.e2e.spec.ts` 가 두 응답이
`requestId` 를 빼고 완전히 같은지 검사합니다.

`x-role: user` 오퍼레이션(상담 신청·찜·내 알림 등)은 **`@Roles('user')` 가 아닙니다.**
문서 §3 의 역할 표가 누적형(`hospital_admin` = user + …)이므로 담당자·운영자도 일반
사용자로 앱을 씁니다. 그런 라우트는 `@Roles` 를 붙이지 말고 `AuthGuard` 만 쓰거나
`@Roles(...USER_ROLES)` 를 쓰세요.

### 운영자 부트스트랩 (결정 4)

```bash
npm run operator:grant  -- someone@example.com      # 기존 계정을 operator 로
npm run operator:revoke -- someone@example.com      # 회수 (마지막 운영자는 --force 필요)
```

**운영자 승격 엔드포인트는 없습니다.** HTTP 로 도달 가능하면 그것이 시스템의 최고 권한
상승 표면이 됩니다. 이 CLI 는 DB·파일시스템 접근 권한을 요구하고, 실행 결과를 `[AUDIT]`
줄로 남깁니다. 병원 담당자(`hospital_admins` 행이 있는 계정)는 승격을 거부합니다 —
겸직하면 자기 병원 전문의를 스스로 검수할 수 있게 됩니다.

빌드된 서버에서는 `node dist/scripts/operator-role.js grant <email>` 로도 실행됩니다.

### 아직 없는 것 (다음 Task 로 넘김)

- **요청 한도(429 RATE_LIMITED)** — 로그인 브루트포스 방어. 계약에는 있고 구현은 없습니다
- **감사 로그(`audit_logs`)** — 테이블이 없습니다. 상담 상세 열람 기록이 결정 3 의 요구사항입니다
- **`POST /auth/social/{provider}`** — 화면이 버튼만 있는 상태라 미구현
- **비밀번호 찾기** — 계정을 운영자가 만들지 않는 설계이므로 우선순위가 높습니다 (결정 문서 §미결 6)

## 개발용 계정

시드가 만듭니다. 비밀번호는 **`.env` 의 `SEED_PASSWORD`** 이고, DB 에는 bcrypt(cost 12)
해시만 들어갑니다. 이메일 도메인은 `.example` 이라 실제로 메일이 나가지 않습니다.

| 역할 | 계정 | 비고 |
|---|---|---|
| `operator` | `ops@molarmolar.example` | 전문의 인증 검수 (`/admin/specialists`) |
| `hospital_admin` | `admin-h1@…` ~ `admin-h11@…` (11개) | 각 병원 1곳 담당 (`hospital_admins`) |
| `user` | `seed-1@…` ~ `seed-7@…` (7개) | 상담 `cr1`~`cr7` 의 신청자 |

`seed-3@molarmolar.example`(최지훈) 계정에만 **안 읽은 알림 1건**이 있습니다 —
알림이 계정별로 갈렸다는 것을 눈으로 확인할 수 있는 케이스입니다.

---

## 시드 날짜 정책 (QA 가 알아야 하는 부분)

- 상담 7건은 **`SEED_TODAY` 기준 상대 오프셋**으로 들어갑니다. 고정 날짜를 쓰면
  `/admin` 의 '이번 달 신규 상담' 이 항상 0 이 되기 때문입니다.
- 프로모션 4건은 `SEED_TODAY` 를 감싸는 기간이라 항상 '진행중' 입니다.
  기간 만료 UI 를 보려면 `p3` 의 `end_date` 를 과거로 바꾸세요.
- 재현이 필요하면 `.env` 에 `SEED_TODAY=2026-08-12` 처럼 고정하세요.
- 후기·꿀팁·커뮤니티·전체 공지 알림은 fixture 날짜 그대로입니다.

자세한 규칙과 근거는 `prisma/seed/dates.ts` 주석에 있습니다.
