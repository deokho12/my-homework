import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addConsultMemo,
  createConsultRequest,
  fetchConsultRequestById,
  fetchConsultRequests,
  fetchConsultSummary,
  fetchMyConsultRequests,
  updateConsultStatus,
} from '@/features/consult/api/consultApi';
import { isApiError } from '@/lib/apiClient';
import { readCollection, writeCollection } from '@/lib/localCollection';
import { useAuthStore } from '@/store/useAuthStore';
import type { ConsultRequest, User } from '@/types/domain';

const CONSENT = { agreed: true, noticeVersion: '2026-10-12' };

function signedInAs(id: string | null): void {
  const user: User | null =
    id === null
      ? null
      : { id, email: `${id}@molarmolar.example`, name: '테스트', provider: 'email', role: 'user', managedHospitalIds: [] };

  useAuthStore.setState({ user, status: 'ready' });
}

/** 삭제된 `useConsultStore` 의 동작을 이 계층으로 옮겨 고정한다. */
function seedRequest(overrides: Partial<ConsultRequest> = {}): ConsultRequest {
  return {
    id: 'cr1',
    hospitalId: 'h1',
    procedureId: 'implant',
    name: '홍길동',
    phone: '010-1234-5678',
    preferredTime: '평일 오전',
    message: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: '2026-07-01T00:00:00.000Z' }],
    memos: [],
    ...overrides,
  };
}

function seed(requests: ConsultRequest[]): void {
  writeCollection('consultRequests', requests);
  writeCollection('notifications', []);
}

beforeEach(() => {
  signedInAs('u-me');
});

describe('createConsultRequest', () => {
  it('신규 상담을 저장하고 신청자 시야로 돌려준다', async () => {
    seed([]);

    const created = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: 'implant',
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '주말',
      message: '문의드려요',
      thirdPartyConsent: CONSENT,
    });

    expect(created).toMatchObject({ hospitalId: 'h1', name: '김민준', status: 'new' });
    // 신청자 시야에는 내부 메모가 없다 (`MyConsultRequest`).
    expect(created).not.toHaveProperty('memos');
    expect(readCollection('consultRequests')).toHaveLength(1);
  });

  it('최신 상담이 목록 맨 앞에 온다', async () => {
    seed([seedRequest()]);

    await createConsultRequest({
      hospitalId: 'h2',
      procedureId: null,
      name: '박서영',
      phone: '010-0000-0000',
      preferredTime: '주말',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    const page = await fetchConsultRequests();
    expect(page.items[0].name).toBe('박서영');
  });

  it('그 병원 담당자에게 갈 admin 알림을 함께 만든다', async () => {
    seed([]);

    await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '주말',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    const notifications = readCollection('notifications');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      audience: 'admin',
      type: 'consult-status',
      title: '새로운 상담 신청',
      message: '김민준님이 상담을 신청했어요',
      isRead: false,
    });
  });
});

describe('fetchConsultRequests', () => {
  it('신청일시 최신순으로 돌려준다', async () => {
    seed([
      seedRequest({ id: 'old', createdAt: '2026-06-01T00:00:00.000Z' }),
      seedRequest({ id: 'new', createdAt: '2026-07-30T00:00:00.000Z' }),
    ]);

    const page = await fetchConsultRequests();

    expect(page.items.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('status 필터가 목록을 실제로 줄인다', async () => {
    seed([seedRequest({ id: 'a', status: 'new' }), seedRequest({ id: 'b', status: 'booked' })]);

    const page = await fetchConsultRequests({ status: 'booked' });

    expect(page.items.map((item) => item.id)).toEqual(['b']);
    expect(page.meta.totalItems).toBe(1);
  });

  it('계약의 페이지네이션 모양으로 응답한다', async () => {
    seed([seedRequest()]);

    const page = await fetchConsultRequests({ page: 1, pageSize: 20 });

    expect(page.meta).toEqual({ page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
  });
});

describe('fetchConsultRequestById', () => {
  it('없는 상담은 404 CONSULT_REQUEST_NOT_FOUND 를 던진다', async () => {
    seed([]);

    const error = await fetchConsultRequestById('nope').catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    expect(isApiError(error) && error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
    expect(isApiError(error) && error.status).toBe(404);
  });
});

describe('updateConsultStatus', () => {
  it('상태와 이력을 갱신하고 신청자에게 갈 user 알림을 만든다', async () => {
    seed([seedRequest()]);

    const updated = await updateConsultStatus('cr1', 'booked');

    expect(updated.status).toBe('booked');
    expect(updated.statusHistory).toHaveLength(2);

    const notifications = readCollection('notifications');
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      audience: 'user',
      title: '상담 상태 변경',
      message: "상담 상태가 '예약완료'(으)로 변경되었어요",
      relatedId: 'cr1',
    });
  });

  it('같은 상태로 다시 부르면 이력도 알림도 늘지 않는다 (no-op)', async () => {
    seed([seedRequest({ status: 'booked', statusHistory: [{ status: 'booked', changedAt: 'x' }] })]);

    const result = await updateConsultStatus('cr1', 'booked');

    expect(result.statusHistory).toHaveLength(1);
    expect(readCollection('notifications')).toHaveLength(0);
  });

  it('없는 상담은 404 를 던진다', async () => {
    seed([]);

    const error = await updateConsultStatus('nope', 'booked').catch((caught: unknown) => caught);

    expect(isApiError(error) && error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
  });
});

describe('addConsultMemo', () => {
  it('메모를 붙여 상담 전체를 돌려준다', async () => {
    seed([seedRequest()]);

    const updated = await addConsultMemo('cr1', '전화 연결 안 됨');

    expect(updated.memos).toHaveLength(1);
    expect(updated.memos[0].content).toBe('전화 연결 안 됨');
    expect(readCollection('consultRequests')[0].memos).toHaveLength(1);
  });

  it('메모는 알림을 만들지 않는다', async () => {
    seed([seedRequest()]);

    await addConsultMemo('cr1', '내부 공유');

    expect(readCollection('notifications')).toHaveLength(0);
  });
});

describe('fetchConsultSummary', () => {
  // 가짜 시계는 여기서만 쓴다. 단언이 실패해 `it` 이 중간에 끊겨도 다음 테스트로 새지 않도록
  // 복원은 본문이 아니라 `afterEach` 가 한다 (실제 시각을 쓰는 뒤 테스트가 조용히 깨진다).
  afterEach(() => {
    vi.useRealTimers();
  });

  it("'이번 달' 을 기기 시계가 아니라 Asia/Seoul 달력으로 센다", async () => {
    vi.useFakeTimers();
    // 지금은 UTC 로 6월 30일이지만 서울에서는 이미 7월 1일 08:30 이다.
    vi.setSystemTime(new Date('2026-06-30T23:30:00.000Z'));
    seed([
      // 서울 6/30 23:00 — 지난 달
      seedRequest({ id: 'june', createdAt: '2026-06-30T14:00:00.000Z' }),
      // 서울 7/1 00:30 — 이번 달
      seedRequest({ id: 'july', createdAt: '2026-06-30T15:30:00.000Z' }),
    ]);

    const summary = await fetchConsultSummary();

    expect(summary.timezone).toBe('Asia/Seoul');
    expect(summary.newThisMonth).toBe(1);
  });

  it('pending 은 상태가 new 인 건수다', async () => {
    seed([
      seedRequest({ id: 'a', status: 'new' }),
      seedRequest({ id: 'b', status: 'new' }),
      seedRequest({ id: 'c', status: 'booked' }),
    ]);

    expect((await fetchConsultSummary()).pending).toBe(2);
  });
});

describe('fetchMyConsultRequests', () => {
  it('내부 메모를 담지 않는다 (신청자 시야 투영)', async () => {
    seed([]);
    await createConsultRequest({
      hospitalId: 'h1',
      procedureId: 'implant',
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    const page = await fetchMyConsultRequests();

    expect(page.items[0]).not.toHaveProperty('memos');
    expect(page.items[0].hospitalId).toBe('h1');
  });

  it('같은 브라우저라도 다른 계정이 신청한 건은 돌려주지 않는다', async () => {
    seed([]);

    signedInAs('u-a');
    await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: 'A',
      phone: '010-1111-1111',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    signedInAs('u-b');
    await createConsultRequest({
      hospitalId: 'h2',
      procedureId: null,
      name: 'B',
      phone: '010-2222-2222',
      preferredTime: '주말',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    expect((await fetchMyConsultRequests()).items.map((item) => item.name)).toEqual(['B']);

    signedInAs('u-a');
    expect((await fetchMyConsultRequests()).items.map((item) => item.name)).toEqual(['A']);
  });

  it('주인이 없는 시드 행은 누구의 것도 아니다', async () => {
    seed([seedRequest()]);

    expect((await fetchMyConsultRequests()).items).toHaveLength(0);
  });

  it('로그아웃 상태에서는 빈 목록이다 (서버라면 토큰이 없어 401 인 자리)', async () => {
    seed([]);
    await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    signedInAs(null);

    expect((await fetchMyConsultRequests()).items).toHaveLength(0);
  });

  it('동의 절차 도입 이전 행은 thirdPartyConsent 가 null 로 내려온다 (키는 항상 있다)', async () => {
    seed([]);
    signedInAs('u-me');
    await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    });
    // 저장된 행에서 동의 기록만 지운다 = 절차 도입 전에 접수된 데이터.
    const stored = readCollection('consultRequests');
    writeCollection(
      'consultRequests',
      stored.map((row) => {
        const { thirdPartyConsent: _dropped, ...rest } = row;

        return rest;
      })
    );

    const page = await fetchMyConsultRequests();

    expect(page.items[0]).toHaveProperty('thirdPartyConsent');
    expect(page.items[0].thirdPartyConsent).toBeNull();
  });
});

describe('createConsultRequest — 계약이 422 로 막는 것', () => {
  it('동의 없이 보내면 422 THIRD_PARTY_CONSENT_REQUIRED 다', async () => {
    seed([]);

    const error = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: { agreed: false, noticeVersion: '2026-10-12' },
    }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(422);
    expect(isApiError(error) && error.code).toBe('THIRD_PARTY_CONSENT_REQUIRED');
    expect(isApiError(error) && error.message).toBe('개인정보 제3자 제공에 동의해야 상담을 신청할 수 있어요');
    // 동의하지 않은 상담은 저장되지 않는다.
    expect(readCollection('consultRequests')).toHaveLength(0);
  });

  it('휴대폰 형식이 아니면 422 VALIDATION_FAILED + details[].INVALID_PHONE_FORMAT 다', async () => {
    seed([]);

    const error = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: 'abc',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.code).toBe('VALIDATION_FAILED');
    expect(isApiError(error) && error.message).toBe('입력값을 확인해주세요');
    expect(isApiError(error) && error.details).toEqual([
      {
        field: 'phone',
        code: 'INVALID_PHONE_FORMAT',
        message: '휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요',
      },
    ]);
    expect(readCollection('consultRequests')).toHaveLength(0);
  });
});

describe('createConsultRequest — 저장되는 모양', () => {
  it('연락처를 010-1234-5678 형태로 정규화해 저장한다', async () => {
    seed([]);

    const created = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '01012345678',
      preferredTime: '평일 저녁',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    expect(created.phone).toBe('010-1234-5678');
    expect(readCollection('consultRequests')[0].phone).toBe('010-1234-5678');
  });

  it('동의를 안내문 버전과 서버 시계로 기록한다 (클라이언트가 보낸 시각을 쓰지 않는다)', async () => {
    seed([]);

    const created = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1234-5678',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: { agreed: true, noticeVersion: '2026-10-12' },
    });

    expect(created.thirdPartyConsent?.noticeVersion).toBe('2026-10-12');
    expect(Number.isNaN(Date.parse(created.thirdPartyConsent?.agreedAt ?? ''))).toBe(false);
    expect(readCollection('consultRequests')[0].thirdPartyConsent?.noticeVersion).toBe('2026-10-12');
  });

  it('신청자 시야 응답에는 로컬 전용 저장 필드(주인 id)가 새지 않는다', async () => {
    seed([]);

    const created = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1234-5678',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    expect(created).not.toHaveProperty('ownerUserId');
    expect(await fetchConsultRequestById(created.id)).not.toHaveProperty('ownerUserId');
    expect((await fetchConsultRequests()).items[0]).not.toHaveProperty('ownerUserId');
  });
});
