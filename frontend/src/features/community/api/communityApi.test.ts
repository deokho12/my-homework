import { describe, expect, it } from 'vitest';

import {
  createCommunityPost,
  fetchCommunityPostById,
  fetchCommunityPosts,
  recordPostView,
} from '@/features/community/api/communityApi';
import { isApiError } from '@/lib/apiClient';
import { readCollection, writeCollection } from '@/lib/localCollection';
import type { QAPost } from '@/types/domain';

/** 삭제된 `useCommunityStore` 의 동작을 이 계층으로 옮겨 고정한다. */
function post(overrides: Partial<QAPost> = {}): QAPost {
  return {
    id: 'q1',
    title: '임플란트 뼈이식 꼭 해야 하나요?',
    content: '내용',
    procedureId: 'implant',
    authorName: '익명',
    createdAt: '2026-07-20',
    viewCount: 10,
    answers: [],
    ...overrides,
  };
}

describe('fetchCommunityPosts', () => {
  it('목록에는 답변 본문 대신 개수만 담는다', async () => {
    writeCollection('communityPosts', [
      post({
        answers: [
          { id: 'a1', authorName: '자문의', isDentist: true, content: '답변', createdAt: '2026-07-20' },
        ],
      }),
    ]);

    const page = await fetchCommunityPosts();

    expect(page.items[0].answerCount).toBe(1);
    expect(page.items[0]).not.toHaveProperty('answers');
  });

  it('계약의 페이지네이션 모양으로 응답한다', async () => {
    writeCollection('communityPosts', [post({ id: 'q1' }), post({ id: 'q2' })]);

    const page = await fetchCommunityPosts({ page: 1, pageSize: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.meta).toEqual({ page: 1, pageSize: 1, totalItems: 2, totalPages: 2 });
  });
});

describe('fetchCommunityPostById', () => {
  it('상세에는 답변이 함께 온다', async () => {
    writeCollection('communityPosts', [
      post({
        answers: [
          { id: 'a1', authorName: '자문의', isDentist: true, content: '답변', createdAt: '2026-07-20' },
        ],
      }),
    ]);

    expect((await fetchCommunityPostById('q1')).answers).toHaveLength(1);
  });

  it('없는 글은 404 POST_NOT_FOUND 를 던진다', async () => {
    writeCollection('communityPosts', []);

    const error = await fetchCommunityPostById('nope').catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect(isApiError(error) && error.code).toBe('POST_NOT_FOUND');
    expect(isApiError(error) && error.message).toBe('질문을 찾을 수 없어요');
  });
});

describe('createCommunityPost', () => {
  it('새 글을 목록 맨 앞에 넣고 조회수 0·답변 0 으로 시작한다', async () => {
    writeCollection('communityPosts', [post({ id: 'old' })]);

    const created = await createCommunityPost({
      title: '교정 통증',
      content: '많이 아픈가요?',
      procedureId: 'orthodontics',
    });

    expect(created).toMatchObject({ title: '교정 통증', viewCount: 0, answers: [] });
    expect(readCollection('communityPosts')[0].id).toBe(created.id);
  });

  it('작성자 이름을 요청에서 받지 않는다 — 지금은 항상 익명이다', async () => {
    writeCollection('communityPosts', []);

    const created = await createCommunityPost({ title: 'ㅇ', content: 'ㅇ', procedureId: 'implant' });

    expect(created.authorName).toBe('익명');
  });

  it('createdAt 은 날짜만 저장한다 (기존 데이터와 같은 모양)', async () => {
    writeCollection('communityPosts', []);

    const created = await createCommunityPost({ title: 'ㅇ', content: 'ㅇ', procedureId: 'implant' });

    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('recordPostView', () => {
  it('조회수를 1 올리고 결과를 돌려준다', async () => {
    writeCollection('communityPosts', [post({ viewCount: 10 })]);

    expect(await recordPostView('q1')).toEqual({ postId: 'q1', viewCount: 11, viewCounted: true });
    expect(readCollection('communityPosts')[0].viewCount).toBe(11);
  });

  it('없는 글은 404 를 던진다', async () => {
    writeCollection('communityPosts', []);

    const error = await recordPostView('nope').catch((caught: unknown) => caught);

    expect(isApiError(error) && error.code).toBe('POST_NOT_FOUND');
  });
});
