# 몰라몰라

치과 시술 정보와 병원을 비교하고 상담까지 연결하는 웹 서비스.

## 구조

| 경로 | 내용 |
| --- | --- |
| `frontend/` | 웹 앱 — Vite + React 19 + React Router 7 + Tailwind 3 + Zustand |
| `backend/` | (예정) |
| `mobile/` | (예정) |

## 실행

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

빌드는 `npm run build`, 타입 체크는 `npm run typecheck`.

Kakao 지도/주소검색 키가 필요하면 `frontend/.env.example`을 `.env`로 복사해서 채우면 된다.
비워두면 지도는 안내 문구를, 주소 검색은 목업 결과를 보여준다.
