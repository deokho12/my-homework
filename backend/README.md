# 몰라몰라 백엔드 (NestJS + Prisma + SQLite)

현재 상태: **골격만 있습니다.** 도메인 API(병원·전문의·상담…)는 아직 없고,
`GET /health` 하나와 시드·테스트 게이트가 있습니다.

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
cp .env.example .env        # DATABASE_URL, SEED_PASSWORD 를 채웁니다
npm run prisma:migrate      # 마이그레이션 적용 (prisma/dev.db 생성)
npm run prisma:seed         # 프론트엔드 fixture → DB
npm run dev                 # http://localhost:3000/health
```

> **npm 11 의 설치 스크립트 차단**: `npm install` 이
> `5 packages have install scripts not yet covered by allowScripts` 를 출력하면
> Prisma 엔진과 esbuild/SWC 바이너리가 설치되지 않은 상태입니다.
> `package.json` 의 `allowScripts` 에 승인 목록이 들어 있으므로 보통은 그대로
> 진행되지만, 새 패키지를 추가한 뒤라면 `npm approve-scripts <pkg>` 로 승인하세요.

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
│   ├── main.ts                # 부트스트랩 (/api 접두어, health 제외)
│   ├── app.module.ts
│   ├── config/env.schema.ts   # Zod 환경변수 검증 (실패 = 부팅 실패)
│   ├── common/
│   │   ├── filters/all-exceptions.filter.ts
│   │   └── pipes/zod-validation.pipe.ts
│   ├── prisma/                # PrismaService (전역 모듈, lifecycle hook)
│   └── health/                # GET /health
└── test/
    ├── health.e2e.spec.ts     # 헬스체크 200/503 + DB 를 실제로 읽는지
    └── seed-data.spec.ts      # 시드 데이터 + 변환 검증
```

라우팅 규칙: 모든 도메인 API 는 `/api` 접두어를 씁니다. **`/health` 만 예외**입니다
(모니터링·컨테이너 프로브가 접두어를 몰라도 되게).

---

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
