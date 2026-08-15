# 숙제

- `frontend/` — Vite + React 19 웹 앱
- `backend/` — NestJS + Prisma + SQLite 서버
- `mobile/` — 아직 비어있는 자리표시자

**백엔드를 먼저 띄우세요.** 병원·전문의·시술·후기 화면이 실제 API 를 씁니다 —
서버가 없으면 그 화면들이 빈 목록이나 오류로 뜹니다.

Node v24.19.0 / npm 11.17.0 에서 확인했습니다.

---

## Backend 실행

NestJS + Prisma + SQLite 서버 (`backend/`)

### 설치

```bash
cd backend
cp .env.example .env   # 아래 "환경변수" 참고 — JWT 키를 채워야 부팅됩니다
npm install
npm run prisma:migrate # 마이그레이션 적용 (prisma/dev.db 생성)
npm run prisma:seed    # 샘플 데이터 + 개발용 계정 19개 (여러 번 돌려도 안전)
```

### 환경변수

`.env.example` 을 복사하면 대부분 채워져 있지만, **JWT 키 두 개는 직접 넣어야 합니다.**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- `JWT_ACCESS_SECRET` · `JWT_REFRESH_SECRET` — 각각 32자 이상, **서로 달라야 합니다**
- 비었거나 짧거나 두 값이 같으면 요청 처리 중이 아니라 **부팅이 실패합니다**

전체 목록은 [`backend/README.md`](backend/README.md#환경변수) 에 있습니다.

### 개발 서버

```bash
npm run dev            # http://localhost:3000
```

- 모든 API 는 `/api/v1` 로 시작합니다. `GET /health` 만 예외입니다
- 헬스체크: http://localhost:3000/health

### 빌드 / 실행

```bash
npm run build          # nest build → dist/
npm start              # node dist/main.js
```

### 검사 / 테스트

```bash
npm run typecheck      # 서버 코드 + 시드 스크립트 두 tsconfig
npm run lint           # eslint .
npm run test           # vitest (watch)
npm run test:run       # vitest 1회 실행
```

테스트는 `.env` 의 개발용 SQLite 를 그대로 쓰므로 `prisma:migrate` + `prisma:seed` 가
먼저 되어 있어야 합니다.

### 개발용 계정

비밀번호는 전부 같고 `.env` 의 `SEED_PASSWORD` 입니다 (예시값 `molamola!dev1`).

| 역할 | 계정 |
|---|---|
| `operator` | `ops@molarmolar.example` |
| `hospital_admin` | `admin-h1@molarmolar.example` ~ `admin-h11@…` (11개, 각 병원 1곳 담당) |
| `user` | `seed-1@molarmolar.example` ~ `seed-7@…` (7개) |

### dev 모드 단계 로그

`.env` 의 `NODE_ENV` 가 `development` 이면(`.env.example` 의 기본값입니다) 요청이
**어느 단계에서 멈췄는지**가 콘솔에 찍힙니다. `403` 이 어느 가드에서 났는지 바로 보입니다.

```
HQIYMA → PATCH /api/v1/hospitals/h2
HQIYMA   auth ✓ u-admin-h1 (hospital_admin)
HQIYMA   roles ✓ allowed=[hospital_admin, operator]
HQIYMA   ✗ HOSPITAL_NOT_MANAGED
HQIYMA ← 403 (4ms)
```

마지막 `✓` 가 통과한 마지막 단계이고, `✗ CODE` 가 막은 이유입니다. Prisma 쿼리도
dev 에서만 함께 찍힙니다. **요청/응답 본문은 찍지 않습니다**(비밀번호·개인정보).
운영·테스트에서는 한 줄도 나가지 않습니다.

### 더 보기

DB 스키마·인가 3층·감사 로그·운영자 승격 CLI 등 자세한 내용은
[`backend/README.md`](backend/README.md) 에 있습니다.

---

## Frontend 실행

Vite + React 19 웹 앱 (`frontend/`)

### 설치

```bash
cd frontend
cp .env.example .env   # 환경변수 설정 (VITE_ 접두사)
npm install
```

`VITE_API_BASE_URL` 이 백엔드를 가리켜야 합니다 (기본값 `http://localhost:3000/api/v1`).

### 개발 서버

```bash
npm run dev            # http://localhost:5173
```

### 빌드 / 미리보기

```bash
npm run build          # tsc -b && vite build
npm run preview        # 빌드 결과 확인
```

### 검사 / 테스트

```bash
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run test           # vitest (watch)
npm run test:run       # vitest 1회 실행
npm run format         # prettier
```
