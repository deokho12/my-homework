import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAdminDashboard } from '@/features/admin/api/dashboardApi';
import { fetchConsultRequests } from '@/features/consult/api/consultApi';
import { CONSULT_DELAY_MS, isConsultDelayed } from '@/features/consult/consultDisplay';
import { funnelOf } from '@/features/consult/lib/funnel';
import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { fetchHospitalInquiries } from '@/features/inquiry/api/inquiryApi';
import { isApiError } from '@/lib/apiClient';
import {
  writeCollection,
  type StoredConsultRequest,
  type StoredHospitalInquiry,
} from '@/lib/localCollection';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import type { Doctor, User, UserRole } from '@/types/domain';

/**
 * `GET /admin/dashboard` 의 로컬 구현.
 *
 * **이 파일이 고정하는 불변식은 하나다**: 숫자 카드 = 사이드 배지 = 그 카드를 눌렀을 때
 * 열리는 목록의 건수. 그래서 거의 모든 숫자 테스트가 "같은 필터의 목록 질의와 같은가" 를 묻는다.
 */

/** 서울 2026-10-13(화) 11:30. 달력 경계가 걸린 숫자가 다섯이라 시계를 고정한다. */
const NOW = new Date('2026-10-13T02:30:00.000Z');

function at(iso: string): string {
  return new Date(iso).toISOString();
}

/** `NOW` 로부터 `hours` 시간 전. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function signIn(role: UserRole, managedHospitalIds: string[] = ['h1']): void {
  const user: User = {
    id: `u-${role}`,
    email: 'admin@molarmolar.example',
    name: '김실장',
    provider: 'email',
    role,
    managedHospitalIds: role === 'hospital_admin' ? managedHospitalIds : [],
  };

  useAuthStore.setState({ user, status: 'ready' });
}

function consult(overrides: Partial<StoredConsultRequest> = {}): StoredConsultRequest {
  const createdAt = overrides.createdAt ?? hoursAgo(2);

  return {
    id: 'cr1',
    hospitalId: 'h1',
    procedureId: 'implant',
    name: '박서영',
    phone: '010-1234-4411',
    preferredTime: '평일 오후',
    message: '',
    createdAt,
    status: 'new',
    visitAt: null,
    statusHistory: [{ event: 'status_change', status: 'new', changedAt: createdAt }],
    memos: [],
    ...overrides,
  };
}

function inquiry(overrides: Partial<StoredHospitalInquiry> = {}): StoredHospitalInquiry {
  return {
    id: 'hi1',
    hospitalId: 'h1',
    topic: 'price',
    content: '비용이 궁금해요',
    isPublic: true,
    answer: null,
    createdAt: hoursAgo(10),
    askerDisplayName: '김민준',
    ...overrides,
  };
}

function doctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'd1',
    name: '이수진',
    title: '원장',
    specialty: '치과보철전문의',
    hospitalId: 'h1',
    photo: '',
    procedureIds: [],
    rating: null,
    reviewCount: 0,
    consultCount: 0,
    certificateUrl: null,
    verificationStatus: 'approved',
    rejectionReason: null,
    isRecommended: false,
    yearsOfExperience: 10,
    career: [],
    visibleSpecialty: '치과보철전문의',
    isVerifiedSpecialist: true,
    ...overrides,
  };
}

function stubHospitalData(doctors: Doctor[] = [], hospital = baseHospital()): void {
  vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) =>
    baseHospital({ ...hospital, id })
  );
  vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue(doctors);
}

async function expectApiError(promise: Promise<unknown>, code: string, status: number): Promise<void> {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => isApiError(error) && error.code === code && error.status === status,
    `${status} ${code}`
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  writeCollection('consultRequests', []);
  writeCollection('inquiries', []);
  signIn('hospital_admin');
  stubHospitalData();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, status: 'ready' });
});

describe('fetchAdminDashboard — 인가와 hospitalId 규칙', () => {
  it('비로그인은 401 이다', async () => {
    useAuthStore.setState({ user: null, status: 'ready' });

    await expectApiError(fetchAdminDashboard(), 'UNAUTHENTICATED', 401);
  });

  it('운영자는 403 OPERATOR_CANNOT_USE_DASHBOARD 다 — 답할 수도 연락할 수도 없는 역할이다', async () => {
    signIn('operator');

    await expectApiError(fetchAdminDashboard({ hospitalId: 'h1' }), 'OPERATOR_CANNOT_USE_DASHBOARD', 403);
  });

  it('일반 사용자는 403 FORBIDDEN 이다', async () => {
    signIn('user');

    await expectApiError(fetchAdminDashboard({ hospitalId: 'h1' }), 'FORBIDDEN', 403);
  });

  it('hospitalId 를 생략하고 담당 병원이 1곳이면 그 병원으로 집계한다', async () => {
    signIn('hospital_admin', ['h7']);

    const dashboard = await fetchAdminDashboard();

    expect(dashboard.hospitalId).toBe('h7');
  });

  it('hospitalId 를 생략했는데 담당 병원이 2곳 이상이면 422 다 — 서버가 임의로 고르지 않는다', async () => {
    signIn('hospital_admin', ['h1', 'h3']);

    await expectApiError(fetchAdminDashboard(), 'HOSPITAL_ID_REQUIRED', 422);
  });

  it('담당하지 않는 병원은 403 HOSPITAL_NOT_MANAGED 다 (존재하지 않는 id 도 같다)', async () => {
    signIn('hospital_admin', ['h1']);

    await expectApiError(fetchAdminDashboard({ hospitalId: 'h2' }), 'HOSPITAL_NOT_MANAGED', 403);
    await expectApiError(fetchAdminDashboard({ hospitalId: 'nope' }), 'HOSPITAL_NOT_MANAGED', 403);
  });

  it('실제로 집계한 병원과 이름을 함께 돌려준다', async () => {
    const dashboard = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(dashboard.hospitalId).toBe('h1');
    expect(dashboard.hospitalName).toBe('강남 스마일 치과');
    expect(dashboard.timezone).toBe('Asia/Seoul');
    expect(dashboard.calculatedAt).toBe(NOW.toISOString());
  });
});

describe('fetchAdminDashboard — 숫자 카드 = 그 카드를 눌러 열리는 목록', () => {
  beforeEach(() => {
    writeCollection('consultRequests', [
      // 오늘(서울 10/13) 접수 — 상태 무관
      consult({ id: 'c-today-new', createdAt: at('2026-10-13T01:00:00.000Z'), status: 'new' }),
      consult({ id: 'c-today-cancelled', createdAt: at('2026-10-13T00:10:00.000Z'), status: 'cancelled' }),
      // 어제 접수한 신규 (지연: 24시간 경과)
      consult({ id: 'c-delayed', createdAt: hoursAgo(30), status: 'new' }),
      // 이번 달 접수 + 지금 상태가 예약확정/내원완료
      consult({ id: 'c-booked', createdAt: at('2026-10-05T01:00:00.000Z'), status: 'booked', visitAt: at('2026-10-13T05:00:00.000Z') }),
      consult({ id: 'c-visited', createdAt: at('2026-10-02T01:00:00.000Z'), status: 'visited' }),
      consult({ id: 'c-contacted', createdAt: at('2026-10-04T01:00:00.000Z'), status: 'contacted' }),
      // 지난달 접수 — 이번 달 숫자에 들어가면 안 된다
      consult({ id: 'c-last-month', createdAt: at('2026-09-20T01:00:00.000Z'), status: 'new' }),
      // 다른 병원
      consult({ id: 'c-other', hospitalId: 'h9', createdAt: at('2026-10-13T01:00:00.000Z'), status: 'new' }),
    ]);
    writeCollection('inquiries', [
      inquiry({ id: 'hi-old', createdAt: at('2026-10-09T01:12:00.000Z') }),
      inquiry({ id: 'hi-new', createdAt: at('2026-10-12T01:12:00.000Z') }),
      inquiry({
        id: 'hi-answered',
        createdAt: at('2026-10-08T01:12:00.000Z'),
        answer: { content: '답변이에요. 감사합니다.', answeredAt: at('2026-10-08T02:00:00.000Z'), isPublic: true },
      }),
      inquiry({ id: 'hi-other', hospitalId: 'h9' }),
    ]);
  });

  it('① 오늘 들어온 상담 = `period=today` 목록의 건수 (상태 무관)', async () => {
    const { numbers } = await fetchAdminDashboard({ hospitalId: 'h1' });
    const list = await fetchConsultRequests({ hospitalId: 'h1', period: 'today' });

    expect(numbers.todayNew).toBe(list.meta.totalItems);
    expect(numbers.todayNew).toBe(2);
  });

  it('① 보조 `신규 전체` = `status=new` 목록의 건수 = statusCounts.new', async () => {
    const { numbers } = await fetchAdminDashboard({ hospitalId: 'h1' });
    const list = await fetchConsultRequests({ hospitalId: 'h1', status: 'new' });

    expect(numbers.statusNew).toBe(list.meta.totalItems);
    expect(numbers.statusNew).toBe(list.statusCounts.new);
    expect(numbers.statusNew).toBe(3);
  });

  it('② 처리 대기 = `status=new&status=contacted` 목록의 건수 (더하지 않는다)', async () => {
    const { numbers } = await fetchAdminDashboard({ hospitalId: 'h1' });
    const list = await fetchConsultRequests({ hospitalId: 'h1', status: ['new', 'contacted'] });

    expect(numbers.pending).toBe(list.meta.totalItems);
    expect(numbers.pending).toBe(4);
  });

  it('③ 답변 안 한 문의 = `status=unanswered` 목록의 건수, 보조 줄은 그중 가장 오래된 접수 시각', async () => {
    const { numbers } = await fetchAdminDashboard({ hospitalId: 'h1' });
    const list = await fetchHospitalInquiries({ hospitalId: 'h1', status: 'unanswered' });

    expect(numbers.unansweredInquiries).toBe(list.meta.totalItems);
    expect(numbers.unansweredInquiries).toBe(2);
    expect(numbers.oldestUnansweredAt).toBe(at('2026-10-09T01:12:00.000Z'));
  });

  it('④ M = `period=thisMonth`, N = `+status=booked&status=visited` 목록의 건수', async () => {
    const { numbers } = await fetchAdminDashboard({ hospitalId: 'h1' });
    const month = await fetchConsultRequests({ hospitalId: 'h1', period: 'thisMonth' });
    const booked = await fetchConsultRequests({
      hospitalId: 'h1',
      period: 'thisMonth',
      status: ['booked', 'visited'],
    });

    expect(numbers.newThisMonth).toBe(month.meta.totalItems);
    expect(numbers.bookedThisMonth).toBe(booked.meta.totalItems);
    expect([numbers.newThisMonth, numbers.bookedThisMonth]).toEqual([6, 2]);
  });

  it('깔때기는 같은 코호트에 순수 함수를 적용한 값이다 — requested 는 M 과 같다', async () => {
    const { numbers, funnel } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(funnel.requested).toBe(numbers.newThisMonth);
    expect(funnel.booked).toBe(numbers.bookedThisMonth);
    expect(funnel).toEqual(
      funnelOf([
        { status: 'new', cancelReason: null },
        { status: 'cancelled', cancelReason: null },
        { status: 'new', cancelReason: null },
        { status: 'booked', cancelReason: null },
        { status: 'visited', cancelReason: null },
        { status: 'contacted', cancelReason: null },
      ])
    );
  });

  /** 선택한 병원 한 곳이 이 화면 전체의 축이다 (요청 04 가 남긴 합산 구멍을 닫는다). */
  it('두 병원을 맡아도 고른 병원의 숫자만 센다', async () => {
    signIn('hospital_admin', ['h1', 'h9']);

    const h1 = await fetchAdminDashboard({ hospitalId: 'h1' });
    const h9 = await fetchAdminDashboard({ hospitalId: 'h9' });

    expect(h1.numbers.todayNew).toBe(2);
    expect(h9.numbers.todayNew).toBe(1);
    expect(h9.numbers.unansweredInquiries).toBe(1);
  });

  it('미답변이 0건이면 가장 오래된 것은 null 이다', async () => {
    writeCollection('inquiries', []);

    const { numbers } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(numbers.unansweredInquiries).toBe(0);
    expect(numbers.oldestUnansweredAt).toBeNull();
  });
});

describe('fetchAdminDashboard — 지연', () => {
  it('목록 배지와 같은 함수로 판정한다 — 정확히 24시간 경과한 건도 지연이다', async () => {
    const exactly = new Date(NOW.getTime() - CONSULT_DELAY_MS).toISOString();
    const justUnder = new Date(NOW.getTime() - CONSULT_DELAY_MS + 1).toISOString();

    writeCollection('consultRequests', [
      consult({ id: 'c-exactly', createdAt: exactly, status: 'new' }),
      consult({ id: 'c-just-under', createdAt: justUnder, status: 'new' }),
      // 지연은 `new` 에만 붙는다 — 연락중은 아무리 오래돼도 아니다.
      consult({ id: 'c-contacted', createdAt: hoursAgo(100), status: 'contacted' }),
    ]);

    const { numbers, todo } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(numbers.delayed).toBe(1);
    expect(todo.delayedConsults.map((item) => item.id)).toEqual(['c-exactly']);
    // 각 행을 클라이언트가 다시 판정해도 같은 답이 나온다 — 그것이 규칙이 하나라는 뜻이다.
    expect(isConsultDelayed({ status: 'new', createdAt: exactly }, NOW.getTime())).toBe(true);
    expect(isConsultDelayed({ status: 'new', createdAt: justUnder }, NOW.getTime())).toBe(false);
  });

  it('지연은 statusNew 의 부분집합이다 — 더하면 거짓이 된다', async () => {
    writeCollection('consultRequests', [
      consult({ id: 'c1', createdAt: hoursAgo(30), status: 'new' }),
      consult({ id: 'c2', createdAt: hoursAgo(1), status: 'new' }),
    ]);

    const { numbers } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(numbers.statusNew).toBe(2);
    expect(numbers.delayed).toBe(1);
  });

  it('지연 상담은 오래된 것 먼저 최대 5건이고 나머지는 `delayedRemaining` 이다', async () => {
    writeCollection(
      'consultRequests',
      Array.from({ length: 7 }, (_, index) =>
        consult({ id: `c${index}`, createdAt: hoursAgo(30 + index), status: 'new' })
      )
    );

    const { numbers, todo } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(numbers.delayed).toBe(7);
    expect(todo.delayedConsults).toHaveLength(5);
    expect(todo.delayedConsults.map((item) => item.id)).toEqual(['c6', 'c5', 'c4', 'c3', 'c2']);
    expect(todo.delayedRemaining).toBe(2);
  });

  it('5건 이하면 `delayedRemaining` 은 0 이다', async () => {
    writeCollection('consultRequests', [consult({ id: 'c1', createdAt: hoursAgo(30), status: 'new' })]);

    const { todo } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(todo.delayedRemaining).toBe(0);
  });

  it('지연 행에는 연락처 필드가 아예 없다 — 이름·시술·접수 시각뿐이다', async () => {
    writeCollection('consultRequests', [consult({ id: 'c1', createdAt: hoursAgo(30), status: 'new' })]);

    const { todo } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(Object.keys(todo.delayedConsults[0]).sort()).toEqual(['createdAt', 'id', 'name', 'procedureId']);
    expect(todo.delayedConsults[0].name).toBe('박서영');
  });
});

describe('fetchAdminDashboard — 오늘 할 일의 반려 전문의', () => {
  it('그 병원 소속 전문의 중 반려된 사람의 id 와 이름만 담는다', async () => {
    stubHospitalData([
      doctor({ id: 'd1', name: '이수진', verificationStatus: 'rejected', rejectionReason: '사진이 흐려요' }),
      doctor({ id: 'd2', name: '김보철', verificationStatus: 'approved' }),
      doctor({ id: 'd3', name: '박대기', verificationStatus: 'pending' }),
    ]);

    const { todo } = await fetchAdminDashboard({ hospitalId: 'h1' });

    // 반려 사유는 담지 않는다 — 관리자 시야로 소속 전문의를 읽는 GET 이 아직 없다.
    expect(todo.rejectedDoctors).toEqual([{ id: 'd1', name: '이수진' }]);
  });
});

describe('fetchAdminDashboard — 최근 상담 예약', () => {
  it('신청일시 내림차순 5건이고 상태를 가리지 않는다', async () => {
    writeCollection(
      'consultRequests',
      Array.from({ length: 7 }, (_, index) =>
        consult({ id: `c${index}`, createdAt: hoursAgo(index), status: index % 2 === 0 ? 'new' : 'cancelled' })
      )
    );

    const { recentConsults } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(recentConsults.map((item) => item.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
  });

  it('목록과 같은 투영이다 — 이름은 전체, 연락처는 마스킹, `piiMasked: true`', async () => {
    writeCollection('consultRequests', [consult({ id: 'c1' })]);

    const { recentConsults } = await fetchAdminDashboard({ hospitalId: 'h1' });
    const list = await fetchConsultRequests({ hospitalId: 'h1', pageSize: 5 });

    expect(recentConsults[0].name).toBe('박서영');
    expect(recentConsults[0].phone).toBe('010-****-4411');
    expect(recentConsults[0].piiMasked).toBe(true);
    expect(recentConsults).toEqual(list.items);
  });
});

describe('fetchAdminDashboard — 오늘 내원 예정', () => {
  it('예약확정이고 확정 일시가 오늘(서울)인 건만, 일시 오름차순이다', async () => {
    writeCollection('consultRequests', [
      consult({ id: 'c-pm', status: 'booked', visitAt: at('2026-10-13T05:00:00.000Z') }), // 14:00 KST
      consult({ id: 'c-am', status: 'booked', visitAt: at('2026-10-13T01:00:00.000Z') }), // 10:00 KST — 이미 지났다
      consult({ id: 'c-tomorrow', status: 'booked', visitAt: at('2026-10-14T01:00:00.000Z') }),
      // `예정` 이므로 내원 처리를 하면 줄이 사라진다.
      consult({ id: 'c-visited', status: 'visited', visitAt: at('2026-10-13T02:00:00.000Z') }),
      consult({ id: 'c-no-visit', status: 'booked', visitAt: null }),
    ]);

    const { todayVisits } = await fetchAdminDashboard({ hospitalId: 'h1' });

    // `visitAt` 이 이미 지난 오늘 건도 포함한다 — 하루 단위 목록이지 미래 필터가 아니다.
    expect(todayVisits.map((item) => item.id)).toEqual(['c-am', 'c-pm']);
    expect(Object.keys(todayVisits[0]).sort()).toEqual(['id', 'name', 'procedureId', 'visitAt']);
  });
});

describe('fetchAdminDashboard — 병원 정보 완성도', () => {
  it('저장된 병원과 소속 전문의 수로 계산한다', async () => {
    stubHospitalData(
      [doctor()],
      baseHospital({
        introduction: '가'.repeat(30),
        directions: '강남역 11번 출구 도보 5분',
        businessHours: [
          { day: '월', hours: '09:30 - 18:30' },
          { day: '화', hours: '09:30 - 18:30' },
          { day: '수', hours: '09:30 - 18:30' },
          { day: '목', hours: '09:30 - 18:30' },
          { day: '금', hours: '09:30 - 18:30' },
          { day: '토', hours: '09:30 - 14:00' },
          { day: '일', hours: '휴진', isClosed: true },
        ],
      })
    );

    const { completeness } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(completeness.percent).toBe(100);
    expect(completeness.noProcedures).toBe(false);
  });

  it('소속 전문의가 없으면 의료진 항목이 비고 백분율이 내려간다', async () => {
    stubHospitalData([]);

    const { completeness } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(completeness.items.find((item) => item.key === 'doctors')?.done).toBe(false);
    expect(completeness.percent).toBeLessThan(100);
  });

  it('시술 0개는 백분율과 별개 경고다', async () => {
    stubHospitalData([doctor()], baseHospital({ procedureIds: [] }));

    const { completeness } = await fetchAdminDashboard({ hospitalId: 'h1' });

    expect(completeness.noProcedures).toBe(true);
  });
});
