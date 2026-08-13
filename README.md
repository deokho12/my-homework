# 숙제

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
