/**
 * 시드가 쓰는 fixture 의 창구.
 *
 * `hospitals`·`doctors`·`reviews` 는 DB 가 원본이 됐으므로(Task 20) 이제
 * `./data/*` 에 있다 — 소유권이 백엔드로 넘어왔다. **`procedures` 와
 * `procedureCategories` 도 2026-10-21(요청 14)에 같은 자리로 왔다** — 분야 9 ·
 * 세부 시술 31 의 원본은 이제 서버다 (docs/database/README.md §17.8). 프론트
 * fixture(`mocks/fixtures/procedures.ts`)는 화면 전용으로 남지만 id·이름·순서를
 * `taxonomy.ts` 에서 파생하고, 두 사본이 갈리지 않는 것은 프론트의 동기화
 * 테스트가 고정한다.
 *
 * **`consultRequests` 와 `notifications` 도 2026-10-22(요청서 15)에 같은 자리로 왔다** —
 * 상담 샘플 8건과 공지 알림 3건의 원본은 이제 서버다 (docs/database/README.md §12.13).
 * 옮긴 이유가 이번에는 더 직접적이다: 새 샘플이 요구하는 필드(`visited`·`reschedule`·
 * 취소 사유·`visit_at`·동의 기록)가 **프런트 fixture 의 타입에 아예 없다.** 프런트의
 * 두 파일(`mocks/fixtures/consultRequests.ts`·`notifications.ts`)은 읽는 코드가 남지 않아
 * 같은 작업에서 삭제됐다.
 *
 * 나머지 3개(`qaPosts`·`guides`·`promotions`)는 아직 `frontend/src/mocks/fixtures/*` 를
 * 그대로 가리킨다. 값을 백엔드로 복사해 적지 않는다 — 복사하면 fixture × 수십 행에서
 * 반드시 불일치가 생긴다 (docs/database/README.md §8.1 원칙 3).
 *
 * 경로 별칭(`@/*` → `frontend/src/*`)은 prisma/tsconfig.seed.json 에 있고,
 * 실행은 `tsx --tsconfig prisma/tsconfig.seed.json` 으로 한다 (package.json 의 prisma.seed).
 *
 * 이전하지 않는 fixture (docs §8.6): trendingSearches.ts, placeholder-company-info.ts
 */
export { consultApplicants, consultRequests } from './data/consult-requests';
export { doctors } from './data/doctors';
export { announcements } from './data/notifications';
export { hospitals } from './data/hospitals';
export { procedureCategories } from './data/procedure-categories';
export { procedures } from './data/procedures';
export { reviews } from './data/reviews';

export { guides } from '../../../frontend/src/mocks/fixtures/guides';
export { promotions } from '../../../frontend/src/mocks/fixtures/promotions';
export { qaPosts } from '../../../frontend/src/mocks/fixtures/qaPosts';
