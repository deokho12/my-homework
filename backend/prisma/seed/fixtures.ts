/**
 * 시드가 쓰는 fixture 의 창구.
 *
 * `hospitals`·`doctors`·`reviews` 는 DB 가 원본이 됐으므로(Task 20) 이제
 * `./data/*` 에 있다 — 소유권이 백엔드로 넘어왔다. **`procedures` 와
 * `procedureCategories` 도 2026-10-21(요청 14)에 같은 자리로 왔다** — 분야 9 ·
 * 세부 시술 31 의 원본은 이제 서버다 (docs/database/README.md §17.8). 프론트
 * fixture(`mocks/fixtures/procedures.ts`)는 MSW 스텁으로 남지만 id·이름·순서를
 * `taxonomy.ts` 에서 파생하고, 두 사본이 갈리지 않는 것은 프론트의 동기화
 * 테스트가 고정한다.
 *
 * 나머지 5개(`consultRequests`·`notifications`·`qaPosts`·`guides`·`promotions`)는
 * 아직 `frontend/src/mocks/fixtures/*` 를 그대로 가리킨다. 값을
 * 백엔드로 복사해 적지 않는다 — 복사하면 fixture × 수십 행에서 반드시 불일치가
 * 생긴다 (docs/database/README.md §8.1 원칙 3). 조각 2~4 가 각자 같은 절차로 옮긴다.
 *
 * 경로 별칭(`@/*` → `frontend/src/*`)은 prisma/tsconfig.seed.json 에 있고,
 * 실행은 `tsx --tsconfig prisma/tsconfig.seed.json` 으로 한다 (package.json 의 prisma.seed).
 *
 * 이전하지 않는 fixture (docs §8.6): trendingSearches.ts, placeholder-company-info.ts
 */
export { doctors } from './data/doctors';
export { hospitals } from './data/hospitals';
export { procedureCategories } from './data/procedure-categories';
export { procedures } from './data/procedures';
export { reviews } from './data/reviews';

export { consultRequests } from '../../../frontend/src/mocks/fixtures/consultRequests';
export { guides } from '../../../frontend/src/mocks/fixtures/guides';
export { notifications } from '../../../frontend/src/mocks/fixtures/notifications';
export { promotions } from '../../../frontend/src/mocks/fixtures/promotions';
export { qaPosts } from '../../../frontend/src/mocks/fixtures/qaPosts';
