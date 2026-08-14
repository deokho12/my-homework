# 몰라몰라 — 스택 안내

이 저장소는 원래 Expo(React Native) 앱이었지만, 지금은 **웹 전용 React 앱**이다.
React Native / Expo 관련 코드는 모두 제거됐으니 그 전제로 작업할 것.

## 구조

- `frontend/` — 실제 앱. Vite + React 19 + React Router 7 + Tailwind 3 + Zustand
- `backend/` — NestJS + Prisma + SQLite 서버. 인증·인가에 이어 병원·전문의 도메인 API(시술·병원·
  전문의·후기, 15개 오퍼레이션)가 구현되어 있다. 자세한 내용은 `backend/README.md` 참고
- `mobile/` — 아직 비어있는 자리표시자

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
