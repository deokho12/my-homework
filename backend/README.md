# 몰라몰라 백엔드 (NestJS + Prisma + SQLite)

현재 상태: **인증·인가 → 병원·전문의 → 상담·찜·알림까지 구현되어 있습니다.**

| 조각 | 내용 | 오퍼레이션 |
|---|---|---|
| 기반 | 인증·인가 3층·감사 로그 | auth 5 |
| 1 | 시술, 병원 조회·등록·수정, 전문의 조회·수정·삭제·인증 검수, 병원 후기 | 15 |
| 2 | 찜, 알림, 상담 접수·내 내역·관리자 처리 | 15 |

남은 도메인(커뮤니티·콘텐츠·검색, 입점 문의, 병원 담당자 지정)은 아직 없습니다 —
아래 [아직 없는 것](#아직-없는-것-다음-task-로-넘김) 절과 [다음 조각](#다음-조각) 참고.

> **`x-screen-status` 로 남은 일을 세지 마세요.** 그 값은 `✅동작 / 🟡샘플 데이터 /
> 🚧껍데기` 로 **화면**의 상태를 나타냅니다. 브라우저 저장으로 도는 화면도 ✅ 라서,
> API 구현 여부와는 다릅니다. 서버에 무엇이 있는지는 이 표와 `src/*/**.controller.ts` 가
> 권위입니다.

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
| `npm run test` | Vitest watch |
| `npm run test:run` | Vitest 1회 실행 (CI 게이트) |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` (운영/CI) |
| `npm run prisma:seed` | 시드 (idempotent — 여러 번 돌려도 안전) |
| `npm run prisma:studio` | Prisma Studio |
| `npm run prisma:reset` | DB 초기화 + 마이그레이션 + 시드 |
| `npm run operator:grant -- <email> --actor=<email>` | 기존 계정을 `operator` 로 승격 (DB 직접 쓰기). **`--actor` 필수** |
| `npm run operator:revoke -- <email> --actor=<email>` | `operator` 회수 (`--force` 로 마지막 운영자까지). **`--actor` 필수** |
| `npm run tokens:cleanup` | `refresh_tokens` 만료·소비 행 정리 (수동 수단. 주 수단은 스케줄) |
| `npm run verify:guards` | 인가 수동 확인용 서버 (테스트 전용 보호 라우트 포함, 포트 3100) |

`npm run test:run` 은 **`.env` 의 DATABASE_URL(개발용 SQLite)을 그대로 씁니다.**
그래서 테스트 전에 `prisma:migrate` + `prisma:seed` 가 되어 있어야 합니다.
시드 데이터(병원·전문의·상담…)는 읽기만 하고, 쓰는 것은 자기가 만든 행뿐입니다 —
`refresh_tokens`, `audit_logs`, 그리고 CLI 테스트가 만드는 임시 계정입니다.
(CLI 테스트는 시드 계정의 역할을 잠시 바꿨다가 되돌립니다. 중간에 끊기면
`npm run prisma:seed` 로 역할 분포를 원복하세요.)

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
│   ├── procedure/             # 시술 목록 (13종, 마스터 데이터)
│   ├── hospital/              # 병원 조회·등록·수정 + 관리자 로스터 + 스폰서 계산 + 거리 계산
│   ├── doctor/                # 전문의 조회·로스터 교체·수정·삭제 + 인증 검수
│   ├── review/                # 병원 후기 조회 (작성 엔드포인트 없음 — 화면에 없다)
│   ├── favorite/              # 내 찜 (추가·삭제 멱등, expand=hospital)
│   ├── notification/          # 알림 조회 4개 + notification.write.ts (부수효과가 쓰는 공용 헬퍼)
│   ├── consult/               # 상담 접수·내 내역·관리자 처리 + 개인정보 마스킹(순수 함수)
│   ├── scripts/
│   │   ├── operator-role.ts   # 운영자 승격·회수 CLI (HTTP 경로 없음 — 결정 4)
│   │   └── tokens-cleanup.ts  # refresh_tokens 수동 정리 CLI
│   ├── prisma/                # PrismaService (전역 모듈, lifecycle hook)
│   └── health/                # GET /health
└── test/                      # 33 파일 / 405 테스트 (auth·인가 기반 + 병원·전문의 + 상담·찜·알림)
    ├── support/
    │   ├── app.ts                   # 테스트 앱 + 시드 계정 로그인 헬퍼
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
    └── seed-data.spec.ts             # 시드 데이터 + 변환 검증
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
- **시술→전공 매핑이 프론트·백엔드 양쪽에 있습니다** — `PROCEDURE_SPECIALTY_MAP` 을
  `backend/src/doctor/specialty-procedures.ts` 로 옮겼지만, `frontend/src/utils/specialty.ts`
  에도 사본이 남아 있습니다(`HospitalExploreCard` 가 시술 카테고리와 병원 대표 전공이
  맞는지 판단하는 데 씁니다). 근본 해결은 서버가 그 판정을 응답에 담는 것(예:
  `matchesRequestedProcedure`) — 계약 변경이라 다음 조각
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

### 다음 조각

조각 1(병원·전문의)과 조각 2(상담·찜·알림)가 끝났습니다. 조각 2 는 원래 문서가 나눠 둔
"찜·상담접수·알림"과 "관리자 상담 처리"를 **합쳤습니다** — `useConsultStore` 하나를 사용자
화면과 관리자 화면이 함께 써서, 한쪽만 옮기면 서버에 접수된 상담이 다른 쪽에 보이지 않기
때문입니다 (설계: `docs/superpowers/specs/2026-08-16-consults-favorites-notifications-design.md`).

남은 것:

| 조각 | 내용 | 오퍼레이션 |
|---|---|---|
| 4 | 커뮤니티·콘텐츠·검색·주소검색 | 14 |
| — | 병원 담당자 지정 3 · 입점 문의 4 · 소셜 로그인 1 | 8 |

프론트에서 아직 브라우저 저장을 쓰는 것은 **커뮤니티(`qaPosts`)뿐**입니다. 찜·상담·알림
스토어와 고아가 된 `mocks/db.ts` 는 조각 2 에서 지워졌습니다.

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

- 상담 7건은 **`SEED_TODAY` 기준 상대 오프셋**으로 들어갑니다. 고정 날짜를 쓰면
  `/admin` 의 '이번 달 신규 상담' 이 항상 0 이 되기 때문입니다.
- 프로모션 4건은 `SEED_TODAY` 를 감싸는 기간이라 항상 '진행중' 입니다.
  기간 만료 UI 를 보려면 `p3` 의 `end_date` 를 과거로 바꾸세요.
- 재현이 필요하면 `.env` 에 `SEED_TODAY=2026-08-12` 처럼 고정하세요.
- 후기·꿀팁·커뮤니티·전체 공지 알림은 fixture 날짜 그대로입니다.

자세한 규칙과 근거는 `prisma/seed/dates.ts` 주석에 있습니다.
