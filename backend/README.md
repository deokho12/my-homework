# 몰라몰라 백엔드 (NestJS + Prisma + SQLite)

현재 상태: **인증·인가에 이어 병원·전문의 도메인 API 까지 구현되어 있습니다**
(`2026-08-13-hospital-doctor-domain-api` 조각 1 — 시술 목록, 병원 조회·등록·수정, 전문의
조회·수정·삭제·인증 검수, 병원 후기 조회. 총 15개 오퍼레이션. `docs/api/openapi.yaml` 의
`x-screen-status` 참고). 그 밖의 도메인(상담 신청·찜·알림, 커뮤니티·콘텐츠·검색)은 아직
없습니다 — 아래 [아직 없는 것](#아직-없는-것-다음-task-로-넘김) 절과 [다음 조각](#다음-조각)
참고.

`GET /health`, `POST|GET /api/v1/auth/*` 5개, 그 위에 얹을 가드 3층, 감사 로그·
리프레시 토큰 정리 배치가 인증·인가 기반입니다.

**모든 API 는 `/api/v1` 로 시작합니다. `GET /health` 만 예외입니다** (아래 [라우팅](#라우팅) 절).

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
> 비었거나 32자 미만이거나 **두 값이 같으면 부팅이 실패합니다.** `.env.example` 에
> 개발용 예시 값과 생성 명령이 들어 있습니다. 이미 `.env` 를 갖고 있다면 이 4~6줄을
> 추가해야 서버가 뜹니다. 자세한 목록은 아래 [환경변수](#환경변수) 절에 있습니다.

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
| `npm run test` | Vitest watch (시작할 때 테스트 DB 를 한 번 다시 만듭니다) |
| `npm run test:run` | Vitest 1회 실행 (CI 게이트). **전용 DB `prisma/test.db` 를 새로 만들어 씁니다** |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` (운영/CI) |
| `npm run prisma:seed` | 시드 (idempotent — 여러 번 돌려도 안전) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run prisma:reset` | DB 초기화 + 마이그레이션 + 시드 |
| `npm run operator:grant -- <email> --actor=<email>` | 기존 계정을 `operator` 로 승격 (DB 직접 쓰기). **`--actor` 필수** |
| `npm run operator:revoke -- <email> --actor=<email>` | `operator` 회수 (`--force` 로 마지막 운영자까지). **`--actor` 필수** |
| `npm run tokens:cleanup` | `refresh_tokens` 만료·소비 행 정리 (수동 수단. 주 수단은 스케줄) |
| `npm run verify:guards` | 인가 수동 확인용 서버 (테스트 전용 보호 라우트 포함, 포트 3100) |

### 테스트는 전용 DB 를 씁니다 — 개발 DB 를 건드리지 않습니다

`npm run test:run` 은 **`.env` 의 DATABASE_URL 을 쓰지 않습니다.** 테스트 프로세스의
주소는 `TEST_DATABASE_URL` 이 있으면 그 값, 없으면 `file:./test.db`(= `prisma/test.db`)
입니다 (docs/database/README.md §8.7). 그 값이 `dev.db` 를 가리키면 테스트는 시작하지
않고 중단합니다.

- **실행 시작마다 다시 만듭니다** — `prisma/test.db` 삭제 → `prisma migrate deploy` →
  시드(`SEED_TODAY` = 오늘). `test/global-setup.ts` 가 합니다. 그래서 테스트 전에
  마이그레이션·시드를 손으로 돌릴 필요가 없고, 매번 같은 상태에서 출발합니다
- `npm test`(watch)는 **세션당 한 번만** 다시 만듭니다 (파일을 고칠 때마다가 아닙니다)
- **끝난 뒤 지우지 않습니다.** 실패를 조사할 때 Prisma Studio 로 열어 보세요:
  `DATABASE_URL="file:./test.db" npx prisma studio`
- 그래서 개발 중에 화면에서 가입해 본 계정이 테스트를 빨갛게 만들지 않고, 반대로
  테스트가 개발 DB 에 `refresh_tokens`·`audit_logs` 행을 남기거나(CLI 테스트는 계정의
  역할을 잠시 바꿉니다) 하지도 않습니다. "테스트 전에 dev.db 를 백업한다" 는 절차는
  더 이상 필요 없습니다
- `.env` 는 여전히 읽습니다 — `SEED_PASSWORD` 와 JWT 키가 거기 있습니다. dotenv 는
  이미 있는 값을 덮지 않으므로 테스트가 먼저 넣은 DATABASE_URL 이 이깁니다
- 자식 프로세스를 띄우는 테스트(운영자 CLI)도 부모 환경을 물려받아 같은 파일을 봅니다

---

## 환경변수

전부 `src/config/env.schema.ts`(Zod)가 부팅 시점에 검증합니다. **틀리면 요청 처리 중이 아니라
부팅이 실패합니다.** 값과 생성 명령은 `.env.example` 에 있습니다.

| 변수 | 기본값 | 비고 |
|---|---|---|
| `DATABASE_URL` | — | 없으면 부팅 실패 |
| `PORT` | `3000` | |
| `CORS_ORIGIN` | `http://localhost:5173` | 쉼표 구분 |
| `SEED_PASSWORD` | — | 시드 계정 19개의 공통 비밀번호. 시드·테스트가 씁니다 |
| `JWT_ACCESS_SECRET` | **없음** | 32자 이상. 기본값을 두면 그 키가 어디서나 통하는 백도어가 됩니다 |
| `JWT_REFRESH_SECRET` | **없음** | 32자 이상. ★ **액세스 키와 달라야 합니다** |
| `JWT_ISSUER` / `JWT_AUDIENCE` | `molamola-api` / `molamola-app` | `iss` · `aud` 클레임 |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` (15분) | |
| `REFRESH_TOKEN_TTL_SECONDS` | `2592000` (30일) | |
| `REFRESH_TOKEN_CLEANUP_ENABLED` | `true` | 일 1회 정리 스케줄(04:00 KST)을 켤지. **`true`/`false` 만** 받습니다(오타가 조용히 켜짐이 되지 않게). 인스턴스를 여러 대 띄우면 한 대만 켜세요 |
| `REFRESH_TOKEN_CONSUMED_RETENTION_DAYS` | `7` | 소비된(회전된) 행을 며칠 남길지. `0` 이면 만료까지 남깁니다 — 그동안 재사용 감지가 유지됩니다 |
| `SEED_TODAY` | 오늘 | 시드 날짜 고정용 (아래 시드 날짜 정책) |

**두 JWT 키가 같으면 부팅이 실패합니다.** 같은 키면 리프레시 토큰을 액세스 토큰으로
위조할 수 있고(`typ` 클레임 검사가 유일한 방어선이 됩니다), 키를 나누면 방어가 두 겹입니다.

---

## 구조

```
backend/
├── prisma/
│   ├── schema.prisma          # 28개 모델 (확정. 바꾸려면 db-master 와 논의)
│   ├── migrations/            # init · auth/audit/partner/legal · procedure_categories_and_31_procedures
│   ├── seed.ts                # fixture → DB (idempotent, upsert)
│   ├── seed/
│   │   ├── accounts.ts        # 개발용 계정 정의 + bcrypt
│   │   ├── dates.ts           # SEED_TODAY 기준 날짜 정책 (SeedClock — 순수 함수)
│   │   ├── data/
│   │   │   ├── procedure-categories.ts  # ★ 시술 분야 9개 (원본. import 0)
│   │   │   ├── procedures.ts            # ★ 세부 시술 31개 (원본. import 0)
│   │   │   └── hospitals|doctors|reviews.ts
│   │   └── fixtures.ts        # frontend fixture import 창구 (유일)
│   ├── tsconfig.seed.json     # 시드 전용 (@/* → frontend/src/*)
│   ├── dev.db                 # 개발용 SQLite (gitignore)
│   └── test.db                # 테스트 전용 SQLite — 매 실행마다 재생성 (gitignore)
├── prisma.config.ts           # Prisma CLI 설정 (seed 명령, .env 로드)
├── src/
│   ├── main.ts                # 부트스트랩
│   ├── app-setup.ts           # /api/v1 접두어 · 요청 id · 예외 필터 (테스트도 이 함수를 씁니다)
│   ├── app.module.ts
│   ├── config/env.schema.ts   # Zod 환경변수 검증 (실패 = 부팅 실패)
│   ├── common/
│   │   ├── errors/api-error.ts               # 에러 코드 카탈로그 (코드 → 상태 + 한국어 문구)
│   │   ├── filters/all-exceptions.filter.ts  # { error: { code, message, details, requestId } }
│   │   ├── http/request-id.ts                # X-Request-Id
│   │   └── pipes/zod-validation.pipe.ts      # 422 VALIDATION_FAILED
│   ├── auth/                  # 인증·인가 + 리프레시 토큰 저장소·정리 (아래 절 참고)
│   ├── audit/                 # audit_logs (append-only. 리포지토리에 update/delete 없음)
│   ├── legal/                 # 약관 버전 조회 (가입 동의 검증용)
│   ├── procedure/             # 시술 목록 (31종 + 분야 9개, `isAvailable` 집계)
│   ├── hospital/              # 병원 조회·등록·수정 + 관리자 로스터 + 스폰서 계산 + 거리 계산
│   ├── doctor/                # 전문의 조회·로스터 교체·수정·삭제 + 인증 검수
│   ├── review/                # 병원 후기 조회 (작성 엔드포인트 없음 — 화면에 없다)
│   ├── scripts/
│   │   ├── operator-role.ts   # 운영자 승격·회수 CLI (HTTP 경로 없음 — 결정 4)
│   │   └── tokens-cleanup.ts  # refresh_tokens 수동 정리 CLI
│   ├── prisma/                # PrismaService (전역 모듈, lifecycle hook)
│   └── health/                # GET /health
└── test/                      # 33 파일 / 383 테스트 (auth·인가 기반 + 병원·전문의 도메인 + 시술 분류)
    ├── global-setup.ts               # ★ test.db 삭제 → migrate deploy → 시드 (실행마다 1회)
    ├── support/
    │   ├── app.ts                   # 테스트 앱 + 시드 계정 로그인 헬퍼
    │   ├── test-database.ts          # 테스트 DB 주소 규칙 (dev.db 면 중단)
    │   ├── guard-test.module.ts      # ★ 인가 테스트 전용 보호 라우트 (src 에 두지 않습니다)
    │   └── guard-test-server.ts      # `npm run verify:guards` 의 진입점 (curl 확인용)
    ├── authorization.e2e.spec.ts     # 401/403/404 인가 행렬
    ├── auth-accounts.e2e.spec.ts     # 가입·로그인·내 정보
    ├── auth-tokens.e2e.spec.ts       # 회전·재사용 감지·폐기
    ├── signup-agreements.e2e.spec.ts # 가입 시 약관 동의 기록
    ├── refresh-token-store.spec.ts   # DB 저장소 + CLI 가 실행 중 서버의 세션을 끊는지
    ├── refresh-token-cleanup.spec.ts # 정리 배치 + `tokens:cleanup` CLI
    ├── audit-log.spec.ts             # 스냅샷 · append-only · 쓰기 실패 정책
    ├── operator-cli.spec.ts          # 부트스트랩 CLI + `--actor` 필수 + "HTTP 승격 경로 없음"
    ├── health.e2e.spec.ts            # 헬스체크 200/503 + DB 를 실제로 읽는지 + 접두어 밖인지
    ├── seed-data.spec.ts             # 시드 데이터 + 변환 검증
    ├── procedure-migration.spec.ts   # 옛 시술 id 이관 보존 단정 (임시 DB 에 마이그레이션을 직접 적용)
    ├── procedure-availability.spec.ts     # `준비중` 경계값 (순수 함수)
    └── procedure-availability.e2e.spec.ts # 체크 → 저장 → 준비중 해제 경로 전체
```

### 라우팅

모든 API 는 **`/api/v1`** 접두어를 씁니다 (`src/app-setup.ts` 의 `setGlobalPrefix`).
`docs/api/openapi.yaml` 의 `servers` 와 같은 값이고, 프론트엔드의 `VITE_API_BASE_URL` 과
Flutter 앱이 이 경로를 가리킵니다. 버전을 경로에 둔 이유는 클라이언트가 웹 하나가 아니라서
(모바일 앱이 붙습니다) 구버전 앱을 살려 두면서 응답 형태를 바꿀 방법이 필요하기 때문입니다.

**`GET /health` 만 예외로 접두어 밖에 있습니다.** 로드밸런서·컨테이너 프로브가 접두어도
버전도 몰라야 합니다 — `/api/v2` 를 붙이는 날 프로브 설정을 함께 고치는 상황을 만들지
않습니다. `test/health.e2e.spec.ts` 가 `/health` 는 200, `/api/v1/health` 는 404 임을 고정합니다.

| | |
|---|---|
| `GET /health` | 접두어 **밖** |
| `POST /api/v1/auth/signup` · `login` · `refresh` · `logout` | |
| `GET /api/v1/auth/me` | |

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

리프레시 토큰 상태(회전·재사용 감지·일괄 폐기)는 **`refresh_tokens` 테이블**에 있습니다
(`src/auth/prisma-refresh-token.store.ts`). 서버를 재시작해도 세션이 유지되고, 인스턴스를
여러 대 띄워도 동작하며, 무엇보다 **다른 프로세스(CLI)가 실행 중인 서버의 세션을 끊을 수
있습니다** — `operator:grant` 가 역할 변경과 같은 트랜잭션에서 토큰을 폐기하는 근거입니다.

행은 계속 누적됩니다(회전마다 새 행이고, 소비된 행도 재사용 감지를 위해 만료 전에는
남깁니다). 그래서 정리 수단이 둘 있습니다.

| | |
|---|---|
| **주 수단** | 일 1회 스케줄 04:00 KST (`RefreshTokenCleanupService`). `REFRESH_TOKEN_CLEANUP_ENABLED` 로 켜고 끕니다. 실패해도 API 가용성에 영향을 주지 않고 에러 로그만 남깁니다 |
| 수동 수단 | `npm run tokens:cleanup` — 배치가 멈춘 것을 발견했을 때 |

```bash
npm run tokens:cleanup                    # 만료 행 + 7일 넘게 지난 소비 행
npm run tokens:cleanup -- --keep-days=0   # 만료 행만 (소비 행은 만료까지 남깁니다)
npm run tokens:cleanup -- --dry-run       # 지우지 않고 대상 수만 셉니다
```

`--keep-days` 를 주지 않으면 `REFRESH_TOKEN_CONSUMED_RETENTION_DAYS`(기본 7)를 씁니다.
알 수 없는 인자는 exit 2 + 사용법입니다.

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
# 기존 계정을 operator 로 (--actor 는 실행하는 사람의 계정)
npm run operator:grant  -- someone@example.com --actor=me@molarmolar.example

# 회수 (마지막 운영자는 --force 필요)
npm run operator:revoke -- someone@example.com --actor=me@molarmolar.example
npm run operator:revoke -- someone@example.com --actor=me@molarmolar.example --force
```

**운영자 승격 엔드포인트는 없습니다.** HTTP 로 도달 가능하면 그것이 시스템의 최고 권한
상승 표면이 됩니다. 이 CLI 는 DB·파일시스템 접근 권한을 요구합니다. 병원 담당자
(`hospital_admins` 행이 있는 계정)는 승격을 거부합니다 — 겸직하면 자기 병원 전문의를
스스로 검수할 수 있게 됩니다.

#### `--actor` 는 필수입니다

운영자 승격·회수는 이 시스템의 **최고 권한 행위**입니다. 그게 기록 없이 성공할 수 있으면
감사가 막으려던 상태 그 자체이므로, 행위자 없이는 실행이 아예 되지 않습니다.

| 상황 | 결과 |
|---|---|
| `--actor` 없음 (빈 값·플래그만 준 경우 포함) | **exit 2** + 사용법. `users.role` 은 **바뀌지 않습니다** (부분 적용 없음) |
| `--actor` 이메일이 `users` 에 없음 (탈퇴 계정 포함) | **exit 1**. 역할은 그대로 |
| 정상 | exit 0. `users.role` UPDATE + 그 계정의 리프레시 토큰 폐기 + `audit_logs` INSERT 가 **한 트랜잭션** |

- **`--actor` 는 operator 일 필요가 없습니다.** 가입된 계정이면 됩니다 — 첫 운영자를 만드는
  부트스트랩(운영자가 아직 0명)에서도 실행하는 직원이 자기 이메일을 넘기면 됩니다.
  이 검사는 권한 판정이 아니라 "실재하는 계정인가" 입니다 (`audit_logs.actor_user_id` 가
  NOT NULL + FK 라서 OS 사용자를 행위자로 넣을 수 없습니다).
- **환경변수·`.env` 기본값으로 우회할 수 없습니다.** 기본값이 있으면 필수의 의미가 없습니다.
- 남는 것 두 곳: `audit_logs` 행(행위자 계정·역할 스냅샷·before/after 역할)과 **stdout `[AUDIT]` 줄**.
  OS 사용자·호스트는 `audit_logs.user_agent` 에 `cli:operator-role os=user@host` 로 남습니다 —
  둘이 함께 있으면 "누구 계정으로, 어느 머신에서" 가 남습니다. `request_id` 는 `cli-` 로
  시작해서 HTTP 요청과 구분됩니다.

```
✓ 'seed-7@molarmolar.example' (한소율) 의 역할을 user → operator 로 올렸습니다.
[AUDIT] 2026-08-12T15:53:57.999Z action=user.role_grant_operator actor=seed-2@molarmolar.example \
  actor_os_user=USER@DESKTOP-AN55EJP target_user_id=u-seed-7 \
  target_email=seed-7@molarmolar.example from_role=user
  audit_logs 에 기록했습니다 (id=f1747ohaorc4l98l5cx1to55, actor=seed-2@molarmolar.example).

  ⚠ 이 계정의 활성 세션 1개를 폐기했습니다 — 해당 기기는
    **다시 로그인**해야 합니다. 액세스 토큰은 최대 15분간 옛 역할로 남습니다.
```

빌드된 서버에서는 `node dist/scripts/operator-role.js grant <email> --actor=<email>` 로도
실행됩니다.

### 아직 없는 것 (다음 Task 로 넘김)

- **요청 한도(429 RATE_LIMITED)** — 로그인 브루트포스 방어. 계약에는 있고 구현은 없습니다
- **감사 로그의 HTTP 배선** — `audit_logs` 테이블·리포지토리·정책은 있고, 상담 상세 열람
  기록(결정 3)은 그 컨트롤러가 생길 때 `AuditLogService.recordFromRequest()` 한 줄로 붙습니다
  (`test/audit-log.spec.ts` 의 "도메인 컨트롤러 배선 지점" 테스트가 무엇이 기록되는지 고정합니다).
  지금 실제로 쓰는 곳은 `operator:grant` / `operator:revoke` 입니다
- **`POST /auth/social/{provider}`** — 화면이 버튼만 있는 상태라 미구현
- **비밀번호 찾기** — 계정을 운영자가 만들지 않는 설계이므로 우선순위가 높습니다 (결정 문서 §미결 6)

병원·전문의 도메인(조각 1) 안에서 의도적으로 미룬 것들입니다. 전부 `docs/api/openapi.yaml`
또는 `docs/features/known-issues.md` 에도 기록되어 있습니다(자세한 판정 근거는
`.superpowers/sdd/2026-08-13-hospital-doctor-domain-api/task-21-contract-followups.md`):

- **관리자용 병원 로스터 GET 이 없습니다** — `certificateUrl` 이나 미승인 전문의의 원본
  `specialty` 를 다시 읽을 GET 이 없어서, 병원 폼을 다시 열면 그 값이 사라집니다. 미승인
  전공을 가진 전문의가 있는 병원은 새 전문의를 추가하는 저장이 막힙니다(`PUT` 의
  `DoctorUpsert.specialty` 가 필수라서). 다음 후보: `GET /hospitals/{hospitalId}/doctors?view=admin`
- **공개 `Doctor` 응답에 `hospitalName` 이 없습니다** — 전문의·찜·관련병원 카드가 항목마다
  `useHospital(hospitalId)` 를 불러 N+1 조회가 됩니다. TanStack Query 가 중복 제거하므로
  현재 페이지 크기(20)에서는 견딜 만하지만, 근본 해결은 `GET /hospitals` 의 ids 배치 필터나
  `Doctor` 에 `hospitalName`/`consultAvailable` 추가입니다 — 계약 변경이라 다음 조각
- **시술→전공 매핑이 프론트·백엔드 양쪽에 있습니다** — 원본은
  `backend/src/doctor/specialty-procedures.ts` 의 `PROCEDURE_SPECIALTIES`(31행)이고,
  `frontend/src/utils/specialty.ts` 의 `CATEGORY_SPECIALTIES`(분야 → 강조 전공)는 그
  **합집합**입니다. 사본을 남긴 이유는 배지가 카드의 첫 프레임에 필요해 네트워크를
  기다릴 수 없기 때문이고(두 파일 머리말), **두 표가 갈리지 않는 것은 프론트의 동기화
  테스트가 고정합니다** — `frontend/src/features/procedure/taxonomy.sync.test.ts` 가
  분야별 합집합과 31개 키 집합을 단정합니다(요청 14 에서 추가됐습니다). 그래서 이
  파일은 **import 가 0 이어야 합니다** — 프론트 쪽 해석기가 상대 경로로 읽습니다
- **`POST /hospitals` 는 쓰기 금지 필드를 조용히 버립니다** (Task 21 QA 에서 발견).
  `PATCH` 는 원본 본문을 따로 받아 `422 FIELD_NOT_WRITABLE` 로 거절하는데, `POST` 는
  `assertWritableHospitalFields` 를 부르지 않아 광고·집계 필드를 보내도 `201` 이 나갑니다.
  **값이 쓰이지는 않습니다** — zod 가 모르는 키를 떨어뜨리고 서버가 자기 값을 넣습니다.
  계약(`createHospital`)도 create 에 422 를 규정하지 않고, 등록 화면은 `operator` 전용이라
  `isRecommended` 외에는 보낼 경로가 없어 현재 도달하지 않습니다. 붙인다면 `PATCH` 와
  같은 방식(원본 본문 + 같은 검사)입니다
- **계약이 "서버 기본값" 이라 적은 두 곳이 구현에 없습니다** (Task 21 QA 에서 발견).
  ① `thumbnail` 을 생략하면 계약은 서버가 기본 이미지를 넣으라고 하는데 구현은
  `422 REQUIRED` 입니다 — 등록 폼이 플레이스홀더를 채워 보내(`HospitalForm.tsx`) 화면에서는
  드러나지 않습니다. ② 신규 전문의의 `photo` 가 빈 문자열이 됩니다(`doctor.write.ts`).
  폼에 사진 칸이 없어 항상 빈 값이고 화면은 `StockImage` 폴백으로 버팁니다
- **미래 `SEED_TODAY` 로 돌리면 테스트 1건이 실패합니다** — `SEED_TODAY=2027-03-01
  npm run test:run` 에서 1건이 실패하고 나머지는 전부 통과합니다. 실패하는 것은
  `test/signup-agreements.e2e.spec.ts` 의 "약관 3종이 유효한 상태" 로,
  `legal_documents.effective_at` 이 `SEED_TODAY - 1일`(= 미래)이 되어 **실제 시계로는
  아직 시행 전**이기 때문입니다. 테스트의 결함이 아니라 사실입니다 — 그 DB 로 서버를
  띄우면 화면에서도 약관이 비어 보입니다. 그래서 `SEED_TODAY` 를 기준으로 느슨하게
  고치지 않았습니다(그러면 "지금 유효한 버전이 있다" 는 보장이 사라집니다).
  과거·오늘 날짜로 돌리면 전부 통과합니다
- **`test/seed-dates.spec.ts` 가 광고 창 4개를 리터럴로 들고 있습니다** —
  `prisma/seed/data/hospitals.ts` 는 `@/config/stockImages` 별칭을 쓰고 그 별칭은 시드
  전용 tsconfig 에만 있어서, vitest 에서 import 할 수 없습니다. 값이 갈라지면
  `test/seed-data.spec.ts` 가 실제 DB 행(5행이 전부 기준일을 포함)으로 잡습니다

요청 14(시술 분류)에서 의도적으로 만들지 않은 것들입니다. 근거는 `docs/api/README.md` §22.9 에 있습니다.

- **`GET /procedure-categories` 가 없습니다** — 분야의 이름·설명·순서를 서버에서 받아야 하는
  화면이 없습니다(홈 격자·탐색 탭·관리자 폼은 첫 프레임에 9개를 그려야 해서 번들 상수를 씁니다).
  **다시 볼 조건:** 분야를 운영자가 편집하는 화면이 생기는 날 — 그때 읽기·쓰기를 함께 설계합니다
- **`Procedure.hospitalCount` 를 내려주지 않습니다** — 화면은 "0인가 아닌가" 만 씁니다.
  숫자가 필요해지면 `countPublicHospitalsByProcedure()` 의 같은 집계에서 바로 더하면 됩니다
- **서버가 `procedureId`·`categoryId` 쿼리의 값 목록을 검증하지 않습니다** (`z.string().min(1)`).
  계약(`openapi.yaml`)은 enum 을 적어 두었지만 **일부러 맞추지 않았습니다** — 폐기된 옛 id 로
  들어온 북마크가 `422` 가 아니라 빈 목록을 받는 쪽이 화면에 낫습니다 (계약 §22.6 에 같은 말이
  적혀 있습니다). 요청 14 이전부터 그랬습니다
- **분야 가용성을 서버가 계산하지 않습니다** — "분야 준비중 = 그 분야의 세부 시술이 전부
  `isAvailable=false`" 이고, 유도는 **프런트 함수 하나**가 합니다 (계약 §22.4)
- **`GET /hospitals` 는 조건에 맞는 행을 전부 읽고 메모리에서 페이징합니다** —
  `HospitalRepository.findMany` 가 `skip`/`take` 없이 `HOSPITAL_INCLUDE`(자식 테이블 7종)를
  통째로 읽고, `HospitalService.list` 가 투영·거리·배지 정제 후 `orderHospitals` 로 전역
  재정렬한 다음 `paginate` 합니다. **광고 우선 노출이 전역 재정렬이라 DB 에서 자르면
  적용할 수 없기 때문**이고(Task 6 의 판단), 요청 14 이전에는 프런트가 100행 상한을 걸어
  이 비용이 드러나지 않았습니다. 요청 14 가 그 상한을 없애고 요청 17 이 공공데이터 병원을
  일괄 적재하면 `?categoryId=` 가 **가장 넓은 조회**가 됩니다 — 분야 하나가 수백~수천 병원을
  잡습니다. **다시 볼 조건:** 병원 수가 1000 을 크게 넘거나 `?categoryId=` 응답이 눈에 띄게
  느려지는 날. **고칠 방향:** 광고 분할을 DB 쪽으로 옮깁니다 — 자격 있는 광고 병원을
  `sponsoredRank` 순으로 먼저 조회하고, 나머지를 `orderBy` + `skip`/`take` 로 페이지 단위만
  읽어 이어 붙이는 2단 쿼리입니다(총 개수는 `count`). 거리 필터와 `hasVerifiedSpecialist`
  정제는 지금도 앱에서 하므로, 그 두 쿼리에는 bounding box 까지만 밀어 넣고 정밀 필터는
  남는 구조가 됩니다

### 다음 조각

이 저장소는 `hospital-doctor-domain-api` 조각 1(Task 1~21) 까지 끝났습니다. 남은 도메인은
`.superpowers/sdd/2026-08-13-hospital-doctor-domain-api/task-21-brief.md` 의 "다음 조각" 표
기준으로 이렇게 나뉩니다:

| 조각 | 내용 |
|---|---|
| 2 | 찜·상담접수·알림 (검수가 이미 만들고 있는 알림 행을 읽는 API 포함) |
| 3 | 관리자 상담 처리 (`@HospitalScope({ resource: 'consultRequest' })` 는 이미 준비됨) |
| 4 | 커뮤니티·콘텐츠·검색 (`frontend/src/mocks/db.ts` 의 남은 테이블 3개: `consultRequests`·`communityPosts`·`notifications`) |

## 시술 분류 — 분야 9 · 세부 31 · `준비중` (요청 14)

설계는 `docs/database/README.md` §17, 계약 판단은 `docs/api/README.md` §22 입니다.

| | |
|---|---|
| 원본 | `prisma/seed/data/procedure-categories.ts`(9) · `prisma/seed/data/procedures.ts`(31). **두 파일은 import 가 0 입니다** — 프론트의 동기화 테스트가 상대 경로로 읽습니다 (§17.8) |
| 테이블 | `procedure_categories`(9행) + `procedures.category_id`(NOT NULL, FK). 인덱스 추가는 없습니다(31행 테이블 — §17.10) |
| 순서 | `procedures.sort_order` 는 **31개 통짜 순서(0~30)** 입니다. 분야 순서 × 분야 안 순서를 한 줄로 편 값이고, 배열 순서가 곧 `GET /procedures` 의 순서입니다 |
| `준비중` | **컬럼이 아닙니다.** 요청마다 셉니다 — 공개 병원(`hospital/public-visibility.ts` 의 `publicHospitalWhere()`)이 1곳 이상 등록했으면 `isAvailable=true`. 판정은 순수 함수 `procedure/availability.ts` 입니다 |
| 캐시 | `GET /procedures` 는 `Cache-Control: no-cache` + ETag 입니다(`max-age=3600` 폐기). 담당자가 시술을 체크·저장하면 값이 그 자리에서 바뀌어야 합니다 (계약 §22.5) |
| 분야 필터 | `GET /hospitals`·`GET /doctors` 의 `categoryId`. `procedureId` 와 함께 오면 **AND**, 모르는 값은 `422` 가 아니라 **0건**입니다. 광고 우선 노출은 `procedureId`·`categoryId`·`recommended` 셋 다 켭니다 |
| 로스터 자동 배정 | 신규 전문의가 `procedureIds` 를 생략하면 **전공 시술 ∩ 병원 시술** 입니다 (`일반의` 는 그 교집합이 전체라 전과 같습니다 — 계약 §22.8) |

### 옛 id 6개는 서버가 받지 않습니다

`implant→implant-general` · `orthodontics→bracket-braces` · `cavity→resin` ·
`gum-disease→gum-treatment` · `tmj→tmj-treatment` · `botox→bruxism-botox`.
쓰기는 `422 VALIDATION_FAILED(unknown_procedure)`, 목록 필터는 0건입니다. 이미 발급된
주소·브라우저 저장소의 옛 값은 **화면의 별칭 표**(`frontend/src/features/procedure/taxonomy.ts`)
하나가 풉니다 — 저장되는 값이 둘이 되면 안 되기 때문입니다 (§17.5).

### 마이그레이션 `20261021082350_procedure_categories_and_31_procedures`

한 파일 8단계입니다: ① 분야 테이블 ② 분야 9행 ③ `category_id` 를 nullable 로 추가
④ 기존 13행 백필 ⑤ id 가 바뀌는 6행을 **복제**(`INSERT … SELECT`) ⑥ 자식 8개 테이블
재지정(결정적 id `hp-`·`dp-`·`sp-` 는 id 도 함께 — 재시드가 중복을 만들지 않게)
⑦ 옛 6행 삭제 ⑧ `NOT NULL` + FK 로 테이블 재작성.

- **PK 를 `UPDATE` 하지 않습니다.** FK 8개가 `ON UPDATE CASCADE` 지만 그 동작은
  `PRAGMA foreign_keys` 상태에 달려 있습니다. 삽입 → 재지정 → 삭제는 pragma 와 무관하게
  같은 결과입니다
- **⑥ 이 ⑦ 보다 먼저여야 합니다.** `consult_requests.procedure_id` 는 `ON DELETE SET NULL`
  이라 순서가 뒤집히면 '희망 시술' 이 조용히 비워집니다
- **새 18행은 마이그레이션이 아니라 시드가 넣습니다.** 그래서 빈 DB 에서는 ③~⑦ 이 0행에
  영향을 주고 끝납니다 (빈 DB 경로는 테스트 DB 가 매 실행마다 검증합니다)
- 보존 단정은 `test/procedure-migration.spec.ts` 가 임시 DB 에 **직전 마이그레이션까지만**
  적용 → 옛 id 행 삽입 → 이 마이그레이션 적용 순으로 고정합니다

개발 DB 적용 결과(전/후): `procedures` 13→31, `procedure_categories` 0→9,
`hospital_procedures` 26→26, `hospital_sponsorships` 5→5, `doctor_procedures` 25→25,
`consult_requests` 7→7(`procedure_id IS NULL` 0→0), `reviews` 5, `guides` 8,
`promotions` 4, `qa_posts` 4 — 전부 그대로입니다.

### 시드가 스케일링을 넣지 않습니다

요청서 14 의 확인 항목이 "관리자에서 스케일링을 체크·저장하면 준비중이 아니게 된다"
이고 다른 항목이 "기존 병원들의 시술 표시가 작업 전과 같다" 입니다. 시드가 미리 넣으면
**첫 항목을 확인할 수 없고 둘째 항목이 깨집니다** (§17.7). 그래서 시드 직후
스케일링·예방 분야 4종은 전부 `준비중` 입니다.

---

## 개발용 계정

시드가 **19개**를 만듭니다. 비밀번호는 전부 같고 **`.env` 의 `SEED_PASSWORD`** 입니다
(`.env.example` 의 값은 `molamola!dev1`). DB 에는 bcrypt(cost 12) 해시만 들어갑니다.
이메일 도메인이 `.example` 이라 실제로 메일이 나가지 않습니다.

| 역할 | 계정 | 비고 |
|---|---|---|
| `operator` | `ops@molarmolar.example` | 전문의 인증 검수 (`/admin/specialists`) |
| `hospital_admin` | `admin-h1@molarmolar.example` ~ `admin-h11@…` (11개) | 각 병원 1곳 담당 (`hospital_admins`) |
| `user` | `seed-1@molarmolar.example` ~ `seed-7@…` (7개) | 상담 `cr1`~`cr7` 의 신청자 |

테스트도 이 계정으로 로그인합니다 (`test/support/app.ts` 의 `SEED_ACCOUNTS`). 그래서
`SEED_PASSWORD` 가 없으면 테스트가 명확한 메시지로 실패합니다.

`seed-3@molarmolar.example`(최지훈) 계정에만 **안 읽은 알림 1건**이 있습니다 —
알림이 계정별로 갈렸다는 것을 눈으로 확인할 수 있는 케이스입니다.

---

## 시드 날짜 정책 (QA 가 알아야 하는 부분)

규칙은 **하나**입니다 — fixture 의 모든 날짜를 **기준일 하나로 통째로 밉니다**
(docs/database/README.md §8.5).

```
FIXTURE_TODAY = 2026-07-30            목 데이터의 "오늘"
SEED_TODAY    = env SEED_TODAY 또는 시드 실행 시각의 UTC 날짜
shift         = SEED_TODAY - FIXTURE_TODAY        (시드 배너에 `shift=+83일` 처럼 찍힙니다)
```

- **상담·후기·꿀팁·커뮤니티·알림·광고 기간이 전부 같은 양만큼** 움직입니다. 간격과
  순서가 원본 그대로라 "상담보다 먼저 도착한 상담 알림" 같은 역전이 생기지 않습니다.
- **광고(`hospital_sponsorships`) 기간도 밀립니다.** 예전에는 fixture 날짜를 그대로
  넣어서 2026-09-15 에 광고 5건이 전부 만료됐고, 탐색 화면의 스폰서 배치가 사라지고
  테스트가 빨개졌습니다. fixture 창 4개가 모두 `FIXTURE_TODAY` 를 품고 있으므로 민
  뒤에도 반드시 기준일을 품습니다 — 시드는 그것을 확인하고, 아니면 중단합니다.
- **`SEED_TODAY=2026-07-30` 으로 시드하면 shift = 0** 이라 fixture 원본이 그대로
  들어갑니다 (화면 문서의 날짜를 그대로 재현해야 할 때).
- fixture 에 **날짜가 없는 것**(프로모션 기간 4건, 전문의 검수 시각, 약관 시행일)만
  `SEED_TODAY` 기준 오프셋으로 **만들어 줍니다** (§8.4). 프로모션 4건은 기준일을
  감싸므로 항상 '진행중' 입니다 — 만료 UI 를 보려면 `p3` 의 `end_date` 를 과거로
  바꾸고, 되돌리려면 시드를 다시 돌리세요(idempotent).
- **'이번 달' 숫자는 `SEED_TODAY` 의 일(日)에 달려 있습니다.** 가장 최근 상담이
  기준일 하루 전이므로, 매월 1일에 시드하면 `/admin` 의 '이번 달 신규 상담' 이 0 입니다.
  대시보드 숫자를 보려면 `SEED_TODAY` 를 그 달 중순 이후로 고정해서 시드하세요.
  (테스트는 그래서 달력 월이 아니라 "최근 3일 안에 상담이 있다" 로 단정합니다.)
- 재현이 필요하면 `.env` 에 `SEED_TODAY=2026-08-12` 처럼 고정하세요.

자세한 규칙과 근거는 `prisma/seed/dates.ts` 주석에, 경계값은
`test/seed-dates.spec.ts`(DB 없는 순수 단위 테스트)에 있습니다.
