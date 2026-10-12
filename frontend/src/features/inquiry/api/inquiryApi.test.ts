import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  answerHospitalInquiry,
  createHospitalInquiry,
  fetchHospitalInquiries,
  fetchHospitalInquiryById,
  fetchHospitalInquirySummary,
  fetchMyInquiries,
  fetchPublicHospitalInquiries,
} from '@/features/inquiry/api/inquiryApi';
import { isApiError, type ApiError } from '@/lib/apiClient';
import { readCollection, writeCollection, type StoredHospitalInquiry } from '@/lib/localCollection';
import { useAuthStore } from '@/store/useAuthStore';
import type { User, UserRole } from '@/types/domain';

function signIn(
  id: string,
  { role = 'user', managedHospitalIds = [], name = '김민준' }: { role?: UserRole; managedHospitalIds?: string[]; name?: string } = {}
): User {
  const user: User = {
    id,
    email: `${id}@molarmolar.example`,
    name,
    provider: 'email',
    role,
    managedHospitalIds,
  };

  useAuthStore.setState({ user, status: 'ready' });

  return user;
}

function signOut(): void {
  useAuthStore.setState({ user: null, status: 'ready' });
}

/**
 * 저장 구조를 직접 넣는다. 스코프·정렬·카운트는 "언제 누가 남겼는가" 를 고정해야 판정할 수
 * 있는데, `createHospitalInquiry` 로 만들면 시각이 전부 지금이라 순서가 흔들린다.
 */
function seed(rows: Partial<StoredHospitalInquiry>[]): void {
  writeCollection(
    'inquiries',
    rows.map((row, index) => ({
      id: `hi${index + 1}`,
      hospitalId: 'h1',
      hospitalName: '강남 스마일 치과',
      topic: 'price' as const,
      content: '임플란트 비용이 궁금해요',
      isPublic: true,
      answer: null,
      createdAt: `2026-10-0${index + 1}T00:00:00.000Z`,
      ownerUserId: 'u-me',
      askerDisplayName: '김민준',
      ...row,
    }))
  );
}

/** 거절을 **에러 객체로** 돌려준다 — 코드·상태·details 를 한 자리에서 단언하기 위해서다. */
async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (isApiError(error)) return error;
    throw error;
  }

  throw new Error('거절될 줄 알았는데 성공했어요');
}

async function expectApiError(promise: Promise<unknown>, code: string, status: number): Promise<ApiError> {
  const error = await rejection(promise);

  expect(error.code).toBe(code);
  expect(error.status).toBe(status);

  return error;
}

describe('inquiryApi — 접수 (POST /hospital-inquiries)', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('notifications', []);
    signIn('u-me');
  });

  afterEach(() => {
    signOut();
  });

  it('공개 여부를 보내지 않으면 공개가 기본이고, 응답은 문의자 시야다', async () => {
    const created = await createHospitalInquiry({
      hospitalId: 'h1',
      hospitalName: '강남 스마일 치과',
      topic: 'price',
      content: '임플란트 1개 비용이 궁금해요',
    });

    expect(created.isPublic).toBe(true);
    expect(created.status).toBe('unanswered');
    expect(created.answer).toBeNull();
    expect(created.hospitalId).toBe('h1');
    // 문의자 시야에는 마스킹된 자기 이름도, 로컬 전용 주인 표시도 없다.
    expect(created).not.toHaveProperty('askerName');
    expect(created).not.toHaveProperty('ownerUserId');
  });

  it('본문은 앞뒤 공백을 떼고 저장한다', async () => {
    const created = await createHospitalInquiry({
      hospitalId: 'h1',
      topic: 'hours',
      content: '  토요일에도 진료하나요?  ',
    });

    expect(created.content).toBe('토요일에도 진료하나요?');
  });

  it('주제를 고르지 않으면 422 TOPIC_REQUIRED 다 — 기본값이 없다', async () => {
    const error = await expectApiError(
      createHospitalInquiry({ hospitalId: 'h1', topic: null, content: '궁금한 점이 있어요' }),
      'VALIDATION_FAILED',
      422
    );

    expect(error.details).toEqual([
      { field: 'topic', code: 'TOPIC_REQUIRED', message: '문의 주제를 선택해주세요' },
    ]);
    expect(readCollection('inquiries')).toHaveLength(0);
  });

  it('공백을 뺀 내용이 5자 미만이면 422 CONTENT_TOO_SHORT 다', async () => {
    const error = await expectApiError(
      createHospitalInquiry({ hospitalId: 'h1', topic: 'price', content: '  비용  ' }),
      'VALIDATION_FAILED',
      422
    );

    expect(error.details?.[0]).toEqual({
      field: 'content',
      code: 'CONTENT_TOO_SHORT',
      message: '문의 내용을 5자 이상 입력해주세요',
    });
  });

  it('1000자를 넘으면 422 CONTENT_TOO_LONG 이다', async () => {
    const error = await expectApiError(
      createHospitalInquiry({ hospitalId: 'h1', topic: 'price', content: 'ㄱ'.repeat(1001) }),
      'VALIDATION_FAILED',
      422
    );

    expect(error.details?.[0]).toEqual({
      field: 'content',
      code: 'CONTENT_TOO_LONG',
      message: '문의 내용은 1000자까지 쓸 수 있어요',
    });
  });

  it('접수는 관리자 알림을 만들지 않는다 (배지는 미답변 수다)', async () => {
    await createHospitalInquiry({ hospitalId: 'h1', topic: 'price', content: '임플란트 비용이 궁금해요' });

    expect(readCollection('notifications')).toHaveLength(0);
  });

  it('로그인하지 않았으면 401 이다', async () => {
    signOut();

    await expectApiError(
      createHospitalInquiry({ hospitalId: 'h1', topic: 'price', content: '임플란트 비용이 궁금해요' }),
      'UNAUTHENTICATED',
      401
    );
  });
});

describe('inquiryApi — 내 문의 (GET /me/inquiries)', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('notifications', []);
  });

  afterEach(() => {
    signOut();
  });

  it('같은 브라우저라도 내 계정이 남긴 것만 보인다', async () => {
    seed([
      { id: 'hi-mine', ownerUserId: 'u-me' },
      { id: 'hi-other', ownerUserId: 'u-other' },
      { id: 'hi-nobody', ownerUserId: undefined },
    ]);
    signIn('u-me');

    const page = await fetchMyInquiries();

    expect(page.items.map((item) => item.id)).toEqual(['hi-mine']);
    expect(page.meta.totalItems).toBe(1);
  });

  it('최신순이고, 비공개·미답변도 전부 보인다', async () => {
    seed([
      { id: 'hi-old', createdAt: '2026-10-01T00:00:00.000Z', isPublic: false },
      {
        id: 'hi-new',
        createdAt: '2026-10-09T00:00:00.000Z',
        answer: { content: '토요일은 2시까지 진료합니다', isPublic: false, answeredAt: '2026-10-10T00:00:00.000Z' },
      },
    ]);
    signIn('u-me');

    const page = await fetchMyInquiries();

    expect(page.items.map((item) => item.id)).toEqual(['hi-new', 'hi-old']);
    // 비공개로 답한 건의 답변을 본인이 읽는 유일한 경로다.
    expect(page.items[0].answer?.content).toBe('토요일은 2시까지 진료합니다');
    expect(page.items[0].status).toBe('answered');
    // 병원의 공개 선택도 문의자에게 내려간다 — 화면이 실제 노출 여부를 같은 순수 함수로 판정한다.
    expect(page.items[0].answer?.isPublic).toBe(false);
  });

  it('상태 필터는 파생 상태로 가른다', async () => {
    seed([
      { id: 'hi-waiting' },
      { id: 'hi-done', answer: { content: '답변드립니다', isPublic: true, answeredAt: '2026-10-10T00:00:00.000Z' } },
    ]);
    signIn('u-me');

    const page = await fetchMyInquiries({ status: 'unanswered' });

    expect(page.items.map((item) => item.id)).toEqual(['hi-waiting']);
  });

  it('비로그인이면 빈 목록이다 (서버라면 401 인 자리)', async () => {
    seed([{ id: 'hi1' }]);
    signOut();

    await expect(fetchMyInquiries()).resolves.toMatchObject({ items: [] });
  });
});

describe('inquiryApi — 관리자 목록·요약 (GET /hospital-inquiries)', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('notifications', []);
    seed([
      { id: 'hi-h1-a', hospitalId: 'h1', createdAt: '2026-10-01T00:00:00.000Z' },
      {
        id: 'hi-h1-b',
        hospitalId: 'h1',
        createdAt: '2026-10-05T00:00:00.000Z',
        answer: { content: '답변드립니다', isPublic: true, answeredAt: '2026-10-06T00:00:00.000Z' },
      },
      { id: 'hi-h2', hospitalId: 'h2', hospitalName: 'B치과', createdAt: '2026-10-07T00:00:00.000Z' },
    ]);
  });

  afterEach(() => {
    signOut();
  });

  it('병원 담당자는 담당 병원 것만 보고 scope 는 managed 다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    const page = await fetchHospitalInquiries();

    expect(page.scope).toBe('managed');
    expect(page.items.map((item) => item.id)).toEqual(['hi-h1-b', 'hi-h1-a']);
  });

  it('운영자는 전 병원을 보고 scope 는 all 이다', async () => {
    signIn('u-op', { role: 'operator' });

    const page = await fetchHospitalInquiries();

    expect(page.scope).toBe('all');
    expect(page.items.map((item) => item.id)).toEqual(['hi-h2', 'hi-h1-b', 'hi-h1-a']);
  });

  it('문의자 이름은 역할과 무관하게 항상 마스킹된다', async () => {
    signIn('u-op', { role: 'operator' });

    const page = await fetchHospitalInquiries();

    expect(page.items.every((item) => item.askerName === '김*준')).toBe(true);
  });

  it('담당 병원 밖을 hospitalId 로 물으면 403 HOSPITAL_NOT_MANAGED 다 (병원 존재는 공개 정보다)', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    await expectApiError(fetchHospitalInquiries({ hospitalId: 'h2' }), 'HOSPITAL_NOT_MANAGED', 403);
  });

  it('일반 사용자는 403 FORBIDDEN 이다', async () => {
    signIn('u-me');

    await expectApiError(fetchHospitalInquiries(), 'FORBIDDEN', 403);
  });

  it('상태 필터 결과 수와 요약 숫자가 같다 (같은 판정 함수를 쓰므로)', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1', 'h2'] });

    const summary = await fetchHospitalInquirySummary();
    const unanswered = await fetchHospitalInquiries({ status: 'unanswered' });
    const answered = await fetchHospitalInquiries({ status: 'answered' });
    const all = await fetchHospitalInquiries();

    expect(summary).toEqual({ unanswered: 2, answered: 1, total: 3, scope: 'managed' });
    expect(unanswered.meta.totalItems).toBe(summary.unanswered);
    expect(answered.meta.totalItems).toBe(summary.answered);
    expect(all.meta.totalItems).toBe(summary.total);
  });

  it('요약도 담당 병원 범위로만 센다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h2'] });

    await expect(fetchHospitalInquirySummary()).resolves.toEqual({
      unanswered: 1,
      answered: 0,
      total: 1,
      scope: 'managed',
    });
  });
});

describe('inquiryApi — 관리자 상세 (GET /hospital-inquiries/{id})', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('notifications', []);
    seed([{ id: 'hi-h1', hospitalId: 'h1' }, { id: 'hi-h2', hospitalId: 'h2' }]);
  });

  afterEach(() => {
    signOut();
  });

  it('담당 병원 문의는 읽을 수 있다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    await expect(fetchHospitalInquiryById('hi-h1')).resolves.toMatchObject({ id: 'hi-h1', askerName: '김*준' });
  });

  it('다른 병원 문의는 403 이 아니라 404 다 (id 대입으로 비공개 문의 수가 새지 않게)', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    await expectApiError(fetchHospitalInquiryById('hi-h2'), 'HOSPITAL_INQUIRY_NOT_FOUND', 404);
  });

  it('없는 id 도 같은 404 다 — 두 경우를 구분하지 않는다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    await expectApiError(fetchHospitalInquiryById('no-such'), 'HOSPITAL_INQUIRY_NOT_FOUND', 404);
  });

  it('운영자는 전 병원의 문의를 읽는다', async () => {
    signIn('u-op', { role: 'operator' });

    await expect(fetchHospitalInquiryById('hi-h2')).resolves.toMatchObject({ id: 'hi-h2' });
  });
});

describe('inquiryApi — 답변 (POST /hospital-inquiries/{id}/answer)', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('notifications', []);
    seed([
      { id: 'hi-h1', hospitalId: 'h1', hospitalName: '강남 스마일 치과' },
      { id: 'hi-h2', hospitalId: 'h2', hospitalName: 'B치과' },
      {
        id: 'hi-done',
        hospitalId: 'h1',
        answer: { content: '이미 답했어요', isPublic: true, answeredAt: '2026-10-06T00:00:00.000Z' },
      },
    ]);
  });

  afterEach(() => {
    signOut();
  });

  it('운영자는 병원을 대신해 답할 수 없다 (403 OPERATOR_CANNOT_ANSWER)', async () => {
    signIn('u-op', { role: 'operator' });

    await expectApiError(
      answerHospitalInquiry('hi-h1', { content: '평일 10시부터 진료합니다', isPublic: true }),
      'OPERATOR_CANNOT_ANSWER',
      403
    );
    expect(readCollection('notifications')).toHaveLength(0);
  });

  it('담당 병원이 아니면 404 다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    await expectApiError(
      answerHospitalInquiry('hi-h2', { content: '평일 10시부터 진료합니다', isPublic: true }),
      'HOSPITAL_INQUIRY_NOT_FOUND',
      404
    );
  });

  it('이미 답변한 문의에 다시 보내면 409 다 — 수정이 없다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    await expectApiError(
      answerHospitalInquiry('hi-done', { content: '다시 답해볼게요', isPublic: true }),
      'INQUIRY_ALREADY_ANSWERED',
      409
    );
    // 두 번째 답변이 막히면 알림도 나가지 않는다.
    expect(readCollection('notifications')).toHaveLength(0);
  });

  it('공개 여부를 고르지 않으면 422 ANSWER_PUBLIC_REQUIRED 다 — 기본값이 없다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    const error = await expectApiError(
      answerHospitalInquiry('hi-h1', {
        content: '평일 10시부터 진료합니다',
      } as unknown as { content: string; isPublic: boolean }),
      'VALIDATION_FAILED',
      422
    );

    expect(error.details?.[0]).toEqual({
      field: 'isPublic',
      code: 'ANSWER_PUBLIC_REQUIRED',
      message: '이 답변을 공개할지 선택해주세요',
    });
  });

  it('답변이 5자 미만이면 422 CONTENT_TOO_SHORT 다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    const error = await expectApiError(
      answerHospitalInquiry('hi-h1', { content: '네', isPublic: true }),
      'VALIDATION_FAILED',
      422
    );

    expect(error.details?.[0].message).toBe('답변 내용을 5자 이상 입력해주세요');
  });

  it('답변을 등록하면 상태가 바뀌고 문의자에게 알림이 딱 한 건 생긴다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'], name: '관리자' });

    const answered = await answerHospitalInquiry('hi-h1', {
      content: '평일은 오전 10시부터 오후 7시까지 진료합니다.',
      isPublic: true,
    });

    expect(answered.status).toBe('answered');
    expect(answered.answer).toMatchObject({
      content: '평일은 오전 10시부터 오후 7시까지 진료합니다.',
      isPublic: true,
    });

    const notifications = readCollection('notifications');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      audience: 'user',
      type: 'inquiry-answer',
      title: '문의에 답변이 왔어요',
      message: '강남 스마일 치과 · 평일은 오전 10시부터 오후 7시까지 진료합니다.',
      relatedId: 'hi-h1',
      isRead: false,
    });
  });

  it('알림 본문은 답변 앞 60자까지이고 넘으면 … 를 붙인다', async () => {
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });
    const long = 'ㄱ'.repeat(70);

    await answerHospitalInquiry('hi-h1', { content: long, isPublic: false });

    expect(readCollection('notifications')[0].message).toBe(`강남 스마일 치과 · ${'ㄱ'.repeat(60)}…`);
  });

  it('병원의 공개 선택은 그대로 저장된다 — 노출은 AND 규칙이 따로 정한다', async () => {
    seed([{ id: 'hi-private', hospitalId: 'h1', isPublic: false }]);
    signIn('u-admin', { role: 'hospital_admin', managedHospitalIds: ['h1'] });

    const answered = await answerHospitalInquiry('hi-private', { content: '방문 상담을 권해드려요', isPublic: true });

    // 병원이 고른 값은 true 로 남고(파생값을 미리 덮어쓰지 않는다),
    expect(answered.answer?.isPublic).toBe(true);
    // 환자가 비공개로 물었으므로 공개 Q/A 에는 오르지 않는다.
    const publicList = await fetchPublicHospitalInquiries('h1');
    expect(publicList.items).toHaveLength(0);
  });
});

describe('inquiryApi — 공개 Q/A (GET /hospitals/{id}/inquiries)', () => {
  beforeEach(() => {
    writeCollection('inquiries', []);
    writeCollection('notifications', []);
    seed([
      // 공개 + 병원 공개 + 답변완료 → 보인다
      {
        id: 'hi-visible-old',
        isPublic: true,
        answer: { content: '토요일은 2시까지입니다', isPublic: true, answeredAt: '2026-10-02T00:00:00.000Z' },
      },
      // 공개로 물었지만 아직 답이 없다 → 목록에는 없고 `문의 N건` 에는 센다
      { id: 'hi-waiting', isPublic: true },
      // 병원이 비공개로 답했다 → 안 보인다
      {
        id: 'hi-answer-private',
        isPublic: true,
        answer: { content: '내원 상담을 권해드려요', isPublic: false, answeredAt: '2026-10-03T00:00:00.000Z' },
      },
      // 환자가 비공개로 물었다 → 모집단에서도 빠진다
      {
        id: 'hi-asked-private',
        isPublic: false,
        answer: { content: '비공개 답변입니다', isPublic: true, answeredAt: '2026-10-04T00:00:00.000Z' },
      },
      // 다른 병원
      { id: 'hi-other-hospital', hospitalId: 'h2' },
      {
        id: 'hi-visible-new',
        isPublic: true,
        answer: { content: '주차는 2시간 무료입니다', isPublic: true, answeredAt: '2026-10-08T00:00:00.000Z' },
      },
    ]);
  });

  afterEach(() => {
    signOut();
  });

  it('비로그인도 볼 수 있고, 공개 판정을 통과한 건만 답변 최신순으로 준다', async () => {
    signOut();

    const page = await fetchPublicHospitalInquiries('h1');

    expect(page.items.map((item) => item.id)).toEqual(['hi-visible-new', 'hi-visible-old']);
  });

  it('작성자 자리가 아예 없다', async () => {
    const page = await fetchPublicHospitalInquiries('h1');

    expect(page.items[0]).not.toHaveProperty('askerName');
    expect(page.items[0]).not.toHaveProperty('ownerUserId');
    expect(Object.keys(page.items[0]).sort()).toEqual(['answer', 'content', 'createdAt', 'id', 'topic']);
    // 여기 있다는 것이 곧 공개 허용이라 답변의 공개 여부도 내려주지 않는다.
    expect(page.items[0].answer).not.toHaveProperty('isPublic');
  });

  it('`문의 N건` 과 `답변 N` 은 모집단이 다르다 — 전자는 환자가 공개로 남긴 수(미답변 포함)', async () => {
    const page = await fetchPublicHospitalInquiries('h1');

    // 공개로 남긴 것: hi-visible-old, hi-waiting, hi-answer-private, hi-visible-new
    expect(page.publicInquiryCount).toBe(4);
    // 실제로 보이는 목록의 길이
    expect(page.meta.totalItems).toBe(2);
    expect(page.meta.totalItems).toBe(page.items.length);
  });

  it('다른 병원의 문의는 섞이지 않는다', async () => {
    const page = await fetchPublicHospitalInquiries('h2');

    expect(page.items).toHaveLength(0);
    expect(page.publicInquiryCount).toBe(1);
  });
});
