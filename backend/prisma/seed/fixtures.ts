/**
 * 시드가 쓰는 fixture 의 창구.
 *
 * `hospitals`·`doctors`·`reviews` 는 DB 가 원본이 됐으므로(Task 20) 이제
 * `./data/*` 에 있다 — 소유권이 백엔드로 넘어왔다.
 *
 * 나머지 6개(`consultRequests`·`notifications`·`qaPosts`·`guides`·`promotions`·
 * `procedures`)는 아직 `frontend/src/mocks/fixtures/*` 를 그대로 가리킨다. 값을
 * 백엔드로 복사해 적지 않는다 — 복사하면 fixture × 수십 행에서 반드시 불일치가
 * 생긴다 (docs/database/README.md §8.1 원칙 3). `consultRequests`·`notifications`·
 * `qaPosts`·`guides`·`promotions`는 조각 2~4 가 각자 같은 절차로 옮긴다.
 * `procedures`는 옮기지 않는다 — 8개 프론트 테스트가 이 fixture 를 HTTP 응답
 * 스텁으로 직접 import 하고, `useProcedureMap.test.tsx` 는 `procedures[0].id ===
 * 'implant'` 를 결합 가드로 검증한다(`screens/community/new.tsx` 가 그 값을
 * 하드코딩된 로딩 기본값으로 쓰기 때문). 프론트 사본을 새로 만들면 그 가드가
 * 실제 카탈로그가 아니라 사본을 감시하게 되어 "fixture 를 손으로 옮겨 적지
 * 않는다" 원칙을 어긴다.
 *
 * 경로 별칭(`@/*` → `frontend/src/*`)은 prisma/tsconfig.seed.json 에 있고,
 * 실행은 `tsx --tsconfig prisma/tsconfig.seed.json` 으로 한다 (package.json 의 prisma.seed).
 *
 * 이전하지 않는 fixture (docs §8.6): trendingSearches.ts, placeholder-company-info.ts
 */
export { doctors } from './data/doctors';
export { hospitals } from './data/hospitals';
export { reviews } from './data/reviews';

export { consultRequests } from '../../../frontend/src/mocks/fixtures/consultRequests';
export { guides } from '../../../frontend/src/mocks/fixtures/guides';
export { notifications } from '../../../frontend/src/mocks/fixtures/notifications';
export { procedures } from '../../../frontend/src/mocks/fixtures/procedures';
export { promotions } from '../../../frontend/src/mocks/fixtures/promotions';
export { qaPosts } from '../../../frontend/src/mocks/fixtures/qaPosts';
