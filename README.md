# 숙제

## 폴더 구조

| 폴더 | 내용 |
|---|---|
| `frontend/` | React 기반 웹 프론트엔드 (Vite + React 19) |
| `backend/` | NestJS 기반 API 서버 (Prisma + SQLite) — `backend/README.md` |
| `chat/` | 채팅용 소켓 서버 (아직 코드 없음) — `chat/README.md` |
| `mobile/` | 모바일 앱 자리 (아직 비어 있음) |
| `docs/` | API 계약·DB 설계·기능 문서 |

## Frontend 실행

Vite + React 19 웹 앱 (`frontend/`)

### 설치

```bash
cd frontend
cp .env.example .env   # 환경변수 설정 (VITE_ 접두사)
npm install
```

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
