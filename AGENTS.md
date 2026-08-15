# 몰라몰라 — 스택 안내

이 저장소는 원래 Expo(React Native) 앱이었지만, 지금은 **웹 전용 React 앱**이다.
React Native / Expo 관련 코드는 모두 제거됐으니 그 전제로 작업할 것.

## 구조

- `frontend/` — 실제 앱. Vite + React 19 + React Router 7 + Tailwind 3 + Zustand
- `backend/` — NestJS + Prisma + SQLite 서버. 인증·인가에 이어 병원·전문의 도메인 API(시술·병원·
  전문의·후기, 15개 오퍼레이션)가 구현되어 있다. 자세한 내용은 `backend/README.md` 참고
- `mobile/` — 아직 비어있는 자리표시자

## 비즈니스 로직은 최소한으로

**계약과 화면이 요구하는 것만 만든다.** 아래 넷은 슬로건이 아니라 리뷰에서 판정하는 기준이다.

- **계약(`docs/api/openapi.yaml`)이 요구하지 않는 규칙을 서버에 만들지 않는다.** 어느 화면도
  쓰지 않는 필드·엔드포인트·상태를 미리 만들지 않는다. "나중에 필요할 것 같아서" 는 근거가
  아니다 — 필요해진 날 만드는 비용보다, 소비자가 없는 코드를 계속 맞다고 믿는 비용이 크다.
- **컨트롤러는 배선, 서비스는 조합, 규칙은 순수 함수.** 판정 규칙은 DB 도 요청도 모르는
  순수 함수로 떼어내 인자로 받는다 (`hospital/sponsorship.ts`, `hospital/distance.ts`,
  `*/**.projection.ts` 가 그 형태다). 그래야 DB 없이 경계값을 테스트할 수 있다.
- **같은 판정을 두 곳에 두지 않는다.** 병원 카드의 `OO전문의 상주` 배지와 전문의 목록의
  배지가 서로 다른 규칙으로 갈린 적이 있다 — 한쪽만 고치면 화면 두 곳이 조용히 어긋난다.
  같은 판정이 두 번 필요하면 함수를 공유하고, 공유가 안 되면 그 이유를 주석에 남긴다.
- **미룬 것은 조용히 넘기지 않는다.** 계약과 구현이 갈리거나 의도적으로 구현하지 않은 것은
  `backend/README.md` 의 "미룬 것들" 절과 `docs/features/known-issues.md` 에 **근거와 함께**
  남긴다. 기록되지 않은 격차는 다음 사람에게 버그로 보인다.

## 백엔드 dev 모드 — 단계 추적 로그

`NODE_ENV=development` 로 서버를 띄우면 요청이 **어느 단계에서 멈췄는지**가 콘솔에 찍힌다.

```
K3F9AB → PATCH /api/v1/hospitals/h2
K3F9AB   auth ✓ u-admin-h1 (hospital_admin)
K3F9AB   roles ✓ allowed=[hospital_admin, operator]
K3F9AB   ✗ HOSPITAL_NOT_MANAGED
K3F9AB ← 403 (12ms)
```

- 줄 앞머리는 요청 id 뒤 6자다. 동시 요청이 섞여도 같은 키끼리 읽으면 된다
  (전체 값은 응답 헤더 `X-Request-Id`)
- **마지막 `✓` 가 통과한 마지막 단계이고, `✗ CODE` 가 막은 이유다.** 성공 단계만 찍으므로
  줄 수가 단계 수를 넘지 않는다
- Prisma 쿼리도 dev 에서만 함께 찍힌다 — 그 단계가 DB 에 무엇을 물었는지가 거기 보인다.
  그래서 서비스·리포지토리는 한 줄도 계측하지 않는다
- **요청/응답 본문은 찍지 않는다.** 로그인 요청의 비밀번호와 상담 개인정보가 콘솔에 남기
  때문이다 (`docs/decisions/0001-roles-and-pii.md`). 본문이 필요하면 마스킹을 함께 설계한다
- 구현은 `backend/src/common/logging/dev-trace.ts` 하나이고, `development` 가 아니면
  **한 줄도 나가지 않는다** (`test/dev-trace.spec.ts` 가 그것을 고정한다)

## frontend/ 에서 알아둘 것

- `src/primitives/` — 예전 react-native 컴포넌트(`View`/`Text`/`Pressable`/`ScrollView`/
  `FlatList`/`TextInput`/`Modal`/`Image`/`SafeAreaView`)를 DOM으로 옮긴 레이어.
  react-native-web이 내보내던 것과 같은 엘리먼트·기본 CSS(`src/global.css`의 `.rnw-*`)를
  재현해서, 화면 코드가 쓰던 RN식 flex 기본값(세로 방향)과 Tailwind 클래스가 그대로 동작한다.
  **새 화면을 만들 때는 primitives 대신 평범한 HTML 요소를 써도 된다.** primitives는
  이미 포팅된 화면들이 재작성 없이 돌아가게 하려고 남겨둔 것이지, 강제 규약이 아니다.
- `src/navigation/` — 예전 expo-router API(`router`, `Stack`, `useLocalSearchParams`,
  `usePathname`, `useFocusEffect`)를 react-router 위에 얹은 shim. 라우트 목록은
  `src/App.tsx`의 `ROUTES` 테이블 하나에 모여 있다.
- `src/lib/storage.ts` — AsyncStorage 자리에 들어간 localStorage 어댑터 (인터페이스 동일)
- 아이콘은 `lucide-react` (`lucide-react-native` 아님)
- 환경변수는 `VITE_` 접두사 + `import.meta.env` (`frontend/.env.example` 참고)

## 명령어

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run typecheck
```
