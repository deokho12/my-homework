/**
 * 프론트엔드 fixture 를 시드가 쓰는 유일한 창구.
 *
 * 여기서만 `frontend/src/mocks/fixtures/*` 를 import 한다. 값을 백엔드로
 * 복사해 적지 않는다 — 복사하면 11개 fixture × 수십 행에서 반드시 불일치가 생긴다
 * (docs/database/README.md §8.1 원칙 3).
 *
 * 경로 별칭(`@/*` → `frontend/src/*`)은 prisma/tsconfig.seed.json 에 있고,
 * 실행은 `tsx --tsconfig prisma/tsconfig.seed.json` 으로 한다 (package.json 의 prisma.seed).
 *
 * 이전하지 않는 fixture (docs §8.6): trendingSearches.ts, placeholder-company-info.ts
 */
export { consultRequests } from '../../../frontend/src/mocks/fixtures/consultRequests';
export { doctors } from '../../../frontend/src/mocks/fixtures/doctors';
export { guides } from '../../../frontend/src/mocks/fixtures/guides';
export { hospitals } from '../../../frontend/src/mocks/fixtures/hospitals';
export { notifications } from '../../../frontend/src/mocks/fixtures/notifications';
export { procedures } from '../../../frontend/src/mocks/fixtures/procedures';
export { promotions } from '../../../frontend/src/mocks/fixtures/promotions';
export { qaPosts } from '../../../frontend/src/mocks/fixtures/qaPosts';
export { reviews } from '../../../frontend/src/mocks/fixtures/reviews';
