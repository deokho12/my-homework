import { ApiError } from '@/lib/apiClient';
import { nextLocalId, pageLocalRows, readCollection, writeCollection } from '@/lib/localCollection';
import type { Paged, ProcedureId, QAPost } from '@/types/domain';

/**
 * 커뮤니티 Q&A.
 *
 * **지금은 `lib/localCollection.ts`(localStorage)를 읽고 쓴다. 백엔드가 생기면 각 함수의
 * 본문만 `apiRequest('<경로>')` 로 갈아끼우면 되고, 시그니처와 화면 코드는 바뀌지 않는다.**
 *
 * | 함수 | 대응 엔드포인트 |
 * |---|---|
 * | `fetchCommunityPosts` | `GET /community/posts` |
 * | `fetchCommunityPostById` | `GET /community/posts/{postId}` |
 * | `createCommunityPost` | `POST /community/posts` |
 * | `recordPostView` | `POST /community/posts/{postId}/views` |
 *
 * **조회수는 `GET` 이 올리지 않는다.** 상세 화면이 `recordPostView` 를 따로 부른다 —
 * `GET` 이 상태를 바꾸면 캐시·프리페치·재시도가 모두 조회수를 부풀린다.
 *
 * **로컬 구현이 계약과 다른 점:**
 * - 등록에 로그인을 요구하지 않고 작성자를 항상 `익명` 으로 저장한다. 서버는 토큰 주체에서
 *   `authorName` 을 정하고 `authorId` 를 내부에 남긴다 (`isAnonymous` 의 의미가 그때 생긴다).
 * - 조회수 중복 제거가 없다. 서버는 (사용자 또는 요청자 지문) × 글 조합으로 24시간 중복을
 *   제거하고 `viewCounted: false` 를 돌려준다.
 */

/**
 * 목록용 투영(openapi `QAPostSummary`). 답변 **본문**은 목록 카드가 쓰지 않으므로
 * `answers` 배열 대신 개수만 담는다.
 */
export interface QAPostSummary extends Omit<QAPost, 'answers'> {
  answerCount: number;
}

/**
 * 계약에는 `procedureId`·`sort`·`q` 필터도 있지만 커뮤니티 화면에 검색창·필터 칩·정렬
 * 버튼이 아직 없어 여기 두지 않는다. 그 UI 가 생기는 날 계약의 이름 그대로 추가한다.
 */
export interface CommunityPostFilters {
  page?: number;
  pageSize?: number;
}

/** `QAPostCreateRequest`. `authorName` 을 받지 않는 것이 위조 방지의 근거다. */
export interface CommunityPostCreateInput {
  title: string;
  content: string;
  procedureId: ProcedureId;
  /** 기본 `true`. 지금 올라간 글이 모두 `익명` 이라 기본을 바꾸면 목록의 표시 규칙이 갈린다. */
  isAnonymous?: boolean;
}

/** `POST /community/posts/{postId}/views` 응답. */
export interface RecordPostViewResult {
  postId: string;
  viewCount: number;
  /** 이번 호출로 실제로 1 올랐는지. 서버는 24시간 내 중복이면 `false` 를 준다. */
  viewCounted: boolean;
}

function postNotFound(): ApiError {
  return new ApiError({ status: 404, code: 'POST_NOT_FOUND', message: '질문을 찾을 수 없어요' });
}

function toSummary(post: QAPost): QAPostSummary {
  const { answers, ...rest } = post;

  return { ...rest, answerCount: answers.length };
}

/** `GET /community/posts`. 최신순. */
export async function fetchCommunityPosts(filters: CommunityPostFilters = {}): Promise<Paged<QAPostSummary>> {
  // 저장 순서가 곧 최신순이다 — 새 글은 항상 앞에 붙고 `createdAt` 은 날짜만 담아
  // 같은 날 쓴 글끼리는 시각으로 가릴 수 없다. 서버가 시각을 저장하면 정렬이 그쪽으로 간다.
  const rows = readCollection('communityPosts').map(toSummary);

  return pageLocalRows(rows, filters.page, filters.pageSize);
}

/**
 * `GET /community/posts/{postId}`. 답변(`answers`)을 함께 담는다 — 답변 수가 한 자릿수이고
 * 상세 화면이 항상 본문과 함께 그린다.
 *
 * 없는 글은 `null` 이 아니라 `404 POST_NOT_FOUND`(`ApiError`)를 던진다. 소비자는
 * `isApiError(error) && error.code === 'POST_NOT_FOUND'` 로 "없음"을 분기한다.
 */
export async function fetchCommunityPostById(id: string): Promise<QAPost> {
  const found = readCollection('communityPosts').find((post) => post.id === id);

  if (!found) throw postNotFound();

  return found;
}

/** `POST /community/posts`. `createdAt` 은 날짜만 저장한다 (기존 동작·기존 데이터와 맞춘다). */
export async function createCommunityPost(input: CommunityPostCreateInput): Promise<QAPost> {
  const post: QAPost = {
    id: nextLocalId('q'),
    title: input.title,
    content: input.content,
    procedureId: input.procedureId,
    // 로컬 구현은 세션을 모른다. 서버가 토큰 주체와 `isAnonymous` 로 정할 값이다.
    authorName: '익명',
    createdAt: new Date().toISOString().slice(0, 10),
    viewCount: 0,
    answers: [],
  };

  writeCollection('communityPosts', [post, ...readCollection('communityPosts')]);

  return post;
}

/** `POST /community/posts/{postId}/views`. 인증이 필요 없다 (비로그인도 글을 읽는다). */
export async function recordPostView(id: string): Promise<RecordPostViewResult> {
  const rows = readCollection('communityPosts');
  const target = rows.find((post) => post.id === id);

  if (!target) throw postNotFound();

  const viewCount = target.viewCount + 1;

  writeCollection(
    'communityPosts',
    rows.map((post) => (post.id === id ? { ...post, viewCount } : post))
  );

  return { postId: id, viewCount, viewCounted: true };
}
