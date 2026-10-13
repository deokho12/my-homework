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
import { readCollection, writeCollection, type StoredConsultRequest } from '@/lib/localCollection';
import { useAuthStore } from '@/store/useAuthStore';
import type { User, UserRole } from '@/types/domain';

const CONSENT = { agreed: true, noticeVersion: '2026-10-12' };

function signIn(role: UserRole, options: { id?: string; name?: string; managedHospitalIds?: string[] } = {}): void {
  const user: User = {
    id: options.id ?? `u-${role}`,
    email: 'someone@molarmolar.example',
    name: options.name ?? '김실장',
    provider: 'email',
    role,
    managedHospitalIds: options.managedHospitalIds ?? [],
  };

  useAuthStore.setState({ user, status: 'ready' });
}

function signOut(): void {
  useAuthStore.setState({ user: null, status: 'ready' });
}

/** 담당 병원 `h1` 의 관리자. 목록·상세·상태 변경의 기본 주체다. */
function signInAsAdmin(managedHospitalIds = ['h1']): void {
  signIn('hospital_admin', { id: 'u-admin', name: '김실장', managedHospitalIds });
}

function seedRequest(overrides: Partial<StoredConsultRequest> = {}): StoredConsultRequest {
  return {
    id: 'cr1',
    hospitalId: 'h1',
    procedureId: 'implant',
    name: '박서영',
    phone: '010-1234-4411',
    preferredTime: '평일 오전',
    message: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: '2026-07-01T00:00:00.000Z' }],
    memos: [],
    ...overrides,
  };
}

function seed(requests: StoredConsultRequest[]): void {
  writeCollection('consultRequests', requests);
  writeCollection('notifications', []);
}

beforeEach(() => {
  signInAsAdmin();
  seed([]);
});

afterEach(() => {
  signOut();
  vi.useRealTimers();
});

describe('createConsultRequest', () => {
  it('신규 상담을 저장하고 신청자 시야로 돌려준다', async () => {
    signIn('user', { id: 'u-me' });

    const created = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: 'implant',
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '주말',
      message: '문의드려요',
      thirdPartyConsent: CONSENT,
    });

    expect(created).toMatchObject({ hospitalId: 'h1', name: '김민준', status: 'new', visitAt: null });
    // 신청자 시야에는 내부 메모가 없다 (`MyConsultRequest`).
    expect(created).not.toHaveProperty('memos');
    expect(readCollection('consultRequests')).toHaveLength(1);
  });

  it('그 병원 담당자에게 갈 admin 알림을 함께 만든다', async () => {
    signIn('user', { id: 'u-me' });

    await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '주말',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    expect(readCollection('notifications')[0]).toMatchObject({
      audience: 'admin',
      type: 'consult-status',
      title: '새로운 상담 신청',
      message: '김민준님이 상담을 신청했어요',
      isRead: false,
    });
  });

  it('접수 이력 행은 행위자도 알림도 없다', async () => {
    signIn('user', { id: 'u-me' });

    await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '주말',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    signInAsAdmin();
    const detail = await fetchConsultRequestById(readCollection('consultRequests')[0].id);

    expect(detail.statusHistory).toEqual([
      {
        event: 'status_change',
        status: 'new',
        changedAt: expect.any(String),
        changedByName: null,
        visitAt: null,
        cancelReason: null,
        notified: false,
      },
    ]);
  });
});

describe('fetchConsultRequests — 스코프', () => {
  beforeEach(() => {
    seed([
      seedRequest({ id: 'mine', hospitalId: 'h1' }),
      seedRequest({ id: 'other', hospitalId: 'h9', name: '남궁민수' }),
    ]);
  });

  it('병원 관리자는 담당 병원의 상담만 본다', async () => {
    const page = await fetchConsultRequests();

    expect(page.items.map((item) => item.id)).toEqual(['mine']);
    expect(page.scope).toBe('managed');
  });

  it('운영자는 전체를 본다', async () => {
    signIn('operator');

    const page = await fetchConsultRequests();

    expect(page.items.map((item) => item.id).sort()).toEqual(['mine', 'other']);
    expect(page.scope).toBe('all');
  });

  it('로그인하지 않았으면 401, 일반 사용자는 403 이다', async () => {
    signOut();
    const unauthenticated = await fetchConsultRequests().catch((error: unknown) => error);
    expect(isApiError(unauthenticated) && unauthenticated.status).toBe(401);

    signIn('user', { id: 'u-me' });
    const forbidden = await fetchConsultRequests().catch((error: unknown) => error);
    expect(isApiError(forbidden) && forbidden.status).toBe(403);
  });

  it('담당 병원 밖을 hospitalId 로 물으면 403 HOSPITAL_NOT_MANAGED 다', async () => {
    const error = await fetchConsultRequests({ hospitalId: 'h9' }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.code).toBe('HOSPITAL_NOT_MANAGED');
  });
});

describe('fetchConsultRequests — 개인정보 투영', () => {
  beforeEach(() => {
    seed([seedRequest({ name: '박서영', phone: '010-1234-4411' })]);
  });

  it('목록은 담당자에게도 번호 가운데를 가린다 (piiMasked: true)', async () => {
    const page = await fetchConsultRequests();

    expect(page.items[0]).toMatchObject({ name: '박서영', phone: '010-****-4411', piiMasked: true });
  });

  it('운영자 목록은 이름까지 가린다', async () => {
    signIn('operator');

    const page = await fetchConsultRequests();

    expect(page.items[0]).toMatchObject({ name: '박*영', phone: '010-****-4411', piiMasked: true });
  });

  it('전체 번호는 담당 병원 관리자의 상세 한 곳에만 있다', async () => {
    const detail = await fetchConsultRequestById('cr1');

    expect(detail).toMatchObject({ name: '박서영', phone: '010-1234-4411', piiMasked: false });
  });

  it('운영자는 상세에서도 가려진 값만 본다', async () => {
    signIn('operator');

    const detail = await fetchConsultRequestById('cr1');

    expect(detail).toMatchObject({ name: '박*영', phone: '010-****-4411', piiMasked: true });
  });

  it('담당 병원 밖의 상담은 상세에서 404 다 (403 이 아니다 — 존재 자체를 숨긴다)', async () => {
    seed([seedRequest({ id: 'other', hospitalId: 'h9' })]);

    const error = await fetchConsultRequestById('other').catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(404);
    expect(isApiError(error) && error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
  });
});

describe('fetchConsultRequests — 필터', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 서울 2026-10-14(수) 09:00.
    vi.setSystemTime(new Date('2026-10-14T00:00:00.000Z'));
    seed([
      seedRequest({
        id: 'today',
        createdAt: '2026-10-13T16:00:00.000Z', // 서울 10/14 01:00
        name: '박서영',
        phone: '010-1234-4411',
        procedureId: 'implant',
        status: 'new',
      }),
      seedRequest({
        id: 'this-week',
        createdAt: '2026-10-12T01:00:00.000Z', // 서울 10/12(월) 10:00
        name: '최지훈',
        phone: '010-5555-6789',
        procedureId: 'cavity',
        status: 'contacted',
      }),
      seedRequest({
        id: 'last-month',
        createdAt: '2026-09-01T01:00:00.000Z',
        name: '정하윤',
        phone: '010-7777-8888',
        procedureId: 'orthodontics',
        status: 'cancelled',
        statusHistory: [
          { status: 'new', changedAt: '2026-09-01T01:00:00.000Z' },
          { status: 'cancelled', changedAt: '2026-09-02T01:00:00.000Z', cancelReason: 'duplicate' },
        ],
      }),
    ]);
  });

  it('오늘 / 이번 주 / 최근 30일이 서울 달력으로 갈린다', async () => {
    expect((await fetchConsultRequests({ period: 'today' })).items.map((item) => item.id)).toEqual(['today']);
    expect((await fetchConsultRequests({ period: 'thisWeek' })).items.map((item) => item.id)).toEqual([
      'today',
      'this-week',
    ]);
    expect((await fetchConsultRequests({ period: 'last30' })).items.map((item) => item.id)).toEqual([
      'today',
      'this-week',
    ]);
  });

  it('기간을 두 방식으로 함께 보내면 422 PERIOD_FILTER_CONFLICT 다', async () => {
    const error = await fetchConsultRequests({
      period: 'today',
      createdFrom: '2026-10-01T00:00:00.000Z',
    }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(422);
    expect(isApiError(error) && error.code).toBe('PERIOD_FILTER_CONFLICT');
    expect(isApiError(error) && error.message).toBe('기간 조건은 한 가지 방식으로만 보낼 수 있어요');
  });

  it('시술 필터는 여러 id 를 OR 로 묶는다', async () => {
    const page = await fetchConsultRequests({ procedureId: ['implant', 'orthodontics'] });

    expect(page.items.map((item) => item.id)).toEqual(['today', 'last-month']);
  });

  it('검색은 이름 부분일치와 번호 숫자를 OR 로 건다', async () => {
    expect((await fetchConsultRequests({ q: '서영' })).items.map((item) => item.id)).toEqual(['today']);
    expect((await fetchConsultRequests({ q: '4411' })).items.map((item) => item.id)).toEqual(['today']);
    // 하이픈이 있든 없든 같은 숫자열로 대조한다.
    expect((await fetchConsultRequests({ q: '010-1234-4411' })).items.map((item) => item.id)).toEqual(['today']);
    expect((await fetchConsultRequests({ q: '01012344411' })).items.map((item) => item.id)).toEqual(['today']);
  });

  it('운영자의 숫자 검색은 뒤 4자리 접미 일치뿐이다', async () => {
    signIn('operator');

    // 뒤 4자리는 맞는다.
    expect((await fetchConsultRequests({ q: '4411' })).items.map((item) => item.id)).toEqual(['today']);
    // 가운데 네 자리는 맞지 않는다 — 번호 전체를 묻는 오라클이 되지 않게.
    expect((await fetchConsultRequests({ q: '1234' })).items).toHaveLength(0);
    // 5자리 이상은 에러가 아니라 뒤 4자리만 써서 비교한다.
    expect((await fetchConsultRequests({ q: '01012344411' })).items.map((item) => item.id)).toEqual(['today']);
    // 이름 검색은 그대로 된다.
    expect((await fetchConsultRequests({ q: '서영' })).items.map((item) => item.id)).toEqual(['today']);
  });

  it('마스킹된 값을 그대로 넣으면 0건이 정상이다', async () => {
    expect((await fetchConsultRequests({ q: '010-****-4411' })).items).toHaveLength(0);
  });

  it('탭 숫자는 상태만 푼 같은 모집단에서 센다', async () => {
    const all = await fetchConsultRequests();

    expect(all.statusCounts).toEqual({ new: 1, contacted: 1, booked: 0, visited: 0, cancelled: 1, total: 3 });

    const thisWeek = await fetchConsultRequests({ period: 'thisWeek' });

    expect(thisWeek.statusCounts).toEqual({ new: 1, contacted: 1, booked: 0, visited: 0, cancelled: 0, total: 2 });
  });

  it('상태 탭을 눌러도 다른 탭의 숫자는 흔들리지 않는다', async () => {
    const filtered = await fetchConsultRequests({ status: 'new' });

    expect(filtered.items.map((item) => item.id)).toEqual(['today']);
    expect(filtered.statusCounts).toEqual({ new: 1, contacted: 1, booked: 0, visited: 0, cancelled: 1, total: 3 });
    // 계약의 등식: 상태 필터를 건 요청의 `totalItems` 는 그 상태의 건수와 같다.
    expect(filtered.meta.totalItems).toBe(filtered.statusCounts.new);
  });

  it('취소 사유는 저장하지 않고 이력에서 파생한다', async () => {
    const page = await fetchConsultRequests({ status: 'cancelled' });

    expect(page.items[0].cancelReason).toBe('duplicate');
  });
});

describe('updateConsultStatus — 필수 입력', () => {
  beforeEach(() => {
    seed([seedRequest()]);
  });

  it('예약확정인데 확정 일시가 없으면 422 VISIT_AT_REQUIRED 다', async () => {
    const error = await updateConsultStatus('cr1', { status: 'booked' }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(422);
    expect(isApiError(error) && error.code).toBe('VALIDATION_FAILED');
    expect(isApiError(error) && error.details).toEqual([
      { field: 'visitAt', code: 'VISIT_AT_REQUIRED', message: '확정 일시를 입력해주세요' },
    ]);
    expect(readCollection('consultRequests')[0].status).toBe('new');
    expect(readCollection('notifications')).toHaveLength(0);
  });

  it('목록에 없는 취소 사유 코드는 "고르지 않음" 이 아니라 형식 오류다', async () => {
    seed([seedRequest({ id: 'cr1' })]);
    signInAsAdmin();

    const error = await updateConsultStatus('cr1', { status: 'cancelled', cancelReason: 'bogus' as never }).catch(
      (caught: unknown) => caught
    );

    expect(isApiError(error) && error.code).toBe('VALIDATION_FAILED');
    expect(isApiError(error) && error.details?.[0]?.code).not.toBe('CANCEL_REASON_REQUIRED');
  });

  it('취소인데 사유가 없으면 422 CANCEL_REASON_REQUIRED 다', async () => {
    const error = await updateConsultStatus('cr1', { status: 'cancelled' }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.details).toEqual([
      { field: 'cancelReason', code: 'CANCEL_REASON_REQUIRED', message: '취소 사유를 선택해주세요' },
    ]);
  });

  it('목록에 없는 사유 코드는 422 다', async () => {
    const error = await updateConsultStatus('cr1', {
      status: 'cancelled',
      cancelReason: '그냥' as never,
    }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(422);
  });

  it('필수 입력 검사가 no-op 판정보다 먼저다', async () => {
    // 이미 예약확정인데 일시가 없는 건 — 계약 확장 이전에 들어온 데이터다.
    seed([seedRequest({ status: 'booked', statusHistory: [{ status: 'booked', changedAt: 'x' }] })]);

    const error = await updateConsultStatus('cr1', { status: 'booked' }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.details?.[0].code).toBe('VISIT_AT_REQUIRED');
  });
});

describe('updateConsultStatus — 이벤트와 부수효과', () => {
  beforeEach(() => {
    seed([seedRequest()]);
  });

  it('예약확정은 일시를 저장하고 이력·알림을 남긴다', async () => {
    const updated = await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-09T05:00:42.000Z' });

    // 초·밀리초는 깎아서 저장한다.
    expect(updated.visitAt).toBe('2026-10-09T05:00:00.000Z');
    expect(updated.statusHistory.at(-1)).toMatchObject({
      event: 'status_change',
      status: 'booked',
      changedByName: '김실장',
      visitAt: '2026-10-09T05:00:00.000Z',
      notified: true,
    });
    expect(readCollection('notifications')[0]).toMatchObject({
      audience: 'user',
      type: 'consult-status',
      title: '상담 상태 변경',
      message: "상담 상태가 '예약확정'(으)로 변경되었어요",
      relatedId: 'cr1',
    });
  });

  it('상태는 그대로 두고 일시만 바꾸면 일시 변경 이력과 전용 알림이 생긴다', async () => {
    await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' });
    writeCollection('notifications', []);

    const updated = await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-10T02:00:00.000Z' });

    expect(updated.visitAt).toBe('2026-10-10T02:00:00.000Z');
    expect(updated.statusHistory.at(-1)).toMatchObject({
      event: 'reschedule',
      status: 'booked',
      visitAt: '2026-10-10T02:00:00.000Z',
      notified: true,
    });
    expect(readCollection('notifications')[0]).toMatchObject({
      title: '예약 일시 변경',
      message: "예약 일시가 '10월 10일(토) 11:00'(으)로 변경되었어요",
    });
  });

  it('세 값이 모두 같으면 이력도 알림도 늘지 않는다 (no-op)', async () => {
    await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' });
    writeCollection('notifications', []);

    const result = await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-09T05:00:30.000Z' });

    expect(result.statusHistory).toHaveLength(2);
    expect(readCollection('notifications')).toHaveLength(0);
  });

  it('취소하면 확정 일시를 지우고 사유를 이력에 남긴다', async () => {
    await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' });

    const cancelled = await updateConsultStatus('cr1', { status: 'cancelled', cancelReason: 'no_answer' });

    expect(cancelled.visitAt).toBeNull();
    expect(cancelled.cancelReason).toBe('no_answer');
    // 지워진 약속은 직전 이력 행의 스냅샷에 남는다.
    expect(cancelled.statusHistory[1].visitAt).toBe('2026-10-09T05:00:00.000Z');
    expect(cancelled.statusHistory.at(-1)).toMatchObject({ status: 'cancelled', cancelReason: 'no_answer' });
  });

  it('내원완료는 확정 일시를 유지한다', async () => {
    await updateConsultStatus('cr1', { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' });

    const visited = await updateConsultStatus('cr1', { status: 'visited' });

    expect(visited.visitAt).toBe('2026-10-09T05:00:00.000Z');
    expect(visited.cancelReason).toBeNull();
  });

  it('재오픈하면 파생된 취소 사유가 저절로 사라진다', async () => {
    await updateConsultStatus('cr1', { status: 'cancelled', cancelReason: 'no_answer' });

    const reopened = await updateConsultStatus('cr1', { status: 'contacted' });

    expect(reopened.cancelReason).toBeNull();
  });

  it('운영자는 상태를 바꿀 수 없다 (403)', async () => {
    signIn('operator');

    const error = await updateConsultStatus('cr1', { status: 'contacted' }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(403);
    expect(readCollection('consultRequests')[0].status).toBe('new');
  });

  it('담당 병원 밖의 상담은 404 다', async () => {
    seed([seedRequest({ id: 'other', hospitalId: 'h9' })]);

    const error = await updateConsultStatus('other', { status: 'contacted' }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
  });
});

describe('계약 확장 이전 행', () => {
  it('없는 필드를 api 가 채워 내보낸다 (visitAt=null, event=status_change, notified=false)', async () => {
    seed([
      seedRequest({
        status: 'booked',
        statusHistory: [
          { status: 'new', changedAt: '2026-07-01T00:00:00.000Z' },
          { status: 'booked', changedAt: '2026-07-02T00:00:00.000Z' },
        ],
      }),
    ]);

    const detail = await fetchConsultRequestById('cr1');

    expect(detail.visitAt).toBeNull();
    expect(detail.cancelReason).toBeNull();
    expect(detail.statusHistory[1]).toEqual({
      event: 'status_change',
      status: 'booked',
      changedAt: '2026-07-02T00:00:00.000Z',
      changedByName: null,
      visitAt: null,
      cancelReason: null,
      notified: false,
    });
  });
});

describe('addConsultMemo', () => {
  beforeEach(() => {
    seed([seedRequest()]);
  });

  it('메모를 붙여 상담 전체를 돌려준다', async () => {
    const updated = await addConsultMemo('cr1', '전화 연결 안 됨');

    expect(updated.memos).toHaveLength(1);
    expect(readCollection('consultRequests')[0].memos).toHaveLength(1);
    expect(readCollection('notifications')).toHaveLength(0);
  });

  it('담당 병원 밖의 상담은 404 다', async () => {
    seed([seedRequest({ id: 'other', hospitalId: 'h9' })]);

    const error = await addConsultMemo('other', '메모').catch((caught: unknown) => caught);

    expect(isApiError(error) && error.code).toBe('CONSULT_REQUEST_NOT_FOUND');
  });
});

describe('fetchConsultSummary', () => {
  it("'이번 달' 을 기기 시계가 아니라 Asia/Seoul 달력으로 센다", async () => {
    vi.useFakeTimers();
    // 지금은 UTC 로 6월 30일이지만 서울에서는 이미 7월 1일 08:30 이다.
    vi.setSystemTime(new Date('2026-06-30T23:30:00.000Z'));
    seed([
      seedRequest({ id: 'june', createdAt: '2026-06-30T14:00:00.000Z' }),
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
  async function applyAs(userId: string): Promise<string> {
    signIn('user', { id: userId });
    const created = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: 'implant',
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    });

    return created.id;
  }

  it('내부 메모를 담지 않는다 (신청자 시야 투영)', async () => {
    await applyAs('u-me');

    const page = await fetchMyConsultRequests();

    expect(page.items[0]).not.toHaveProperty('memos');
    expect(page.items[0].hospitalId).toBe('h1');
  });

  it('같은 브라우저라도 다른 계정이 신청한 건은 돌려주지 않는다', async () => {
    await applyAs('u-a');
    await applyAs('u-b');

    expect((await fetchMyConsultRequests()).items).toHaveLength(1);

    signIn('user', { id: 'u-a' });
    expect((await fetchMyConsultRequests()).items).toHaveLength(1);

    signOut();
    expect((await fetchMyConsultRequests()).items).toHaveLength(0);
  });

  it('주인이 없는 시드 행은 누구의 것도 아니다', async () => {
    seed([seedRequest()]);
    signIn('user', { id: 'u-me' });

    expect((await fetchMyConsultRequests()).items).toHaveLength(0);
  });

  it('확정 일시를 담고, 일시 변경 이력과 취소 사유·알림 여부는 담지 않는다', async () => {
    const id = await applyAs('u-me');

    signInAsAdmin();
    await updateConsultStatus(id, { status: 'booked', visitAt: '2026-10-09T05:00:00.000Z' });
    await updateConsultStatus(id, { status: 'booked', visitAt: '2026-10-10T02:00:00.000Z' });

    signIn('user', { id: 'u-me' });
    const mine = (await fetchMyConsultRequests()).items[0];

    expect(mine.visitAt).toBe('2026-10-10T02:00:00.000Z');
    expect(mine).not.toHaveProperty('cancelReason');
    // 일시 변경 행은 신청자 이력에 내려가지 않는다 (`예약확정` 중복으로 보인다).
    expect(mine.statusHistory).toEqual([
      { status: 'new', changedAt: expect.any(String), visitAt: null },
      { status: 'booked', changedAt: expect.any(String), visitAt: '2026-10-09T05:00:00.000Z' },
    ]);
    expect(mine.statusHistory[0]).not.toHaveProperty('notified');
    expect(mine.statusHistory[0]).not.toHaveProperty('changedByName');
  });
});

describe('createConsultRequest — 계약이 422 로 막는 것', () => {
  beforeEach(() => {
    signIn('user', { id: 'u-me' });
  });

  it('동의 없이 보내면 422 THIRD_PARTY_CONSENT_REQUIRED 다', async () => {
    const error = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: '010-1111-2222',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: { agreed: false, noticeVersion: '2026-10-12' },
    }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.code).toBe('THIRD_PARTY_CONSENT_REQUIRED');
    expect(readCollection('consultRequests')).toHaveLength(0);
  });

  it('휴대폰 형식이 아니면 422 VALIDATION_FAILED + details[].INVALID_PHONE_FORMAT 다', async () => {
    const error = await createConsultRequest({
      hospitalId: 'h1',
      procedureId: null,
      name: '김민준',
      phone: 'abc',
      preferredTime: '평일 오전',
      message: '',
      thirdPartyConsent: CONSENT,
    }).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.details).toEqual([
      {
        field: 'phone',
        code: 'INVALID_PHONE_FORMAT',
        message: '휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요',
      },
    ]);
    expect(readCollection('consultRequests')).toHaveLength(0);
  });

  it('연락처를 010-1234-5678 형태로 정규화해 저장한다', async () => {
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
  });

  it('신청자 시야 응답에는 로컬 전용 저장 필드(주인 id)가 새지 않는다', async () => {
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

    signInAsAdmin();
    expect(await fetchConsultRequestById(created.id)).not.toHaveProperty('ownerUserId');
    expect((await fetchConsultRequests()).items[0]).not.toHaveProperty('ownerUserId');
  });

  it('동의 절차 도입 이전 행은 thirdPartyConsent 가 null 로 내려온다 (키는 항상 있다)', async () => {
    seed([seedRequest({ ownerUserId: 'u-me' })]);

    const page = await fetchMyConsultRequests();

    expect(page.items[0]).toHaveProperty('thirdPartyConsent');
    expect(page.items[0].thirdPartyConsent).toBeNull();
  });
});
