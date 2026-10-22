import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as dashboardApi from '@/features/admin/api/dashboardApi';
import type { AdminDashboard } from '@/features/admin/api/dashboardApi';
import HospitalDashboard from '@/features/admin/components/HospitalDashboard';
import type { AdminConsultRequest } from '@/features/consult/api/consultApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import { useAdminHospitalStore } from '@/store/useAdminHospitalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { User } from '@/types/domain';

/**
 * 대시보드 화면. **숫자를 다시 세지 않는다** — 응답이 말한 것을 그리고, 카드마다 그 숫자가
 * 나오는 목록으로 가는 링크를 단다.
 */

const NOW = new Date('2026-10-13T02:30:00.000Z');

function signIn(managedHospitalIds: string[] = ['h1']): void {
  const user: User = {
    id: 'u-admin',
    email: 'admin@molarmolar.example',
    name: '김실장',
    provider: 'email',
    role: 'hospital_admin',
    managedHospitalIds,
  };

  act(() => {
    useAuthStore.setState({ user, status: 'ready' });
  });
}

function consultRow(overrides: Partial<AdminConsultRequest> = {}): AdminConsultRequest {
  return {
    id: 'cr20',
    hospitalId: 'h1',
    hospitalName: '강남 스마일 치과',
    procedureId: 'implant-general',
    name: '박서영',
    phone: '010-****-4411',
    piiMasked: true,
    preferredTime: '평일 오후',
    message: '',
    createdAt: '2026-10-13T02:10:00.000Z',
    status: 'new',
    visitAt: null,
    cancelReason: null,
    statusHistory: [],
    thirdPartyConsent: null,
    memos: [],
    ...overrides,
  };
}

function dashboard(overrides: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    hospitalId: 'h1',
    hospitalName: '강남 스마일 치과',
    numbers: {
      todayNew: 3,
      statusNew: 8,
      pending: 15,
      delayed: 3,
      unansweredInquiries: 2,
      oldestUnansweredAt: '2026-10-09T01:12:00.000Z',
      newThisMonth: 42,
      bookedThisMonth: 18,
    },
    funnel: { requested: 42, contacted: 31, booked: 18, visited: 7, cancelled: 6 },
    todo: { delayedConsults: [], delayedRemaining: 0, rejectedDoctors: [] },
    recentConsults: [],
    todayVisits: [],
    completeness: {
      percent: 86,
      items: [
        { key: 'basicInfo', label: '기본 정보', done: true, target: 'name' },
        { key: 'directions', label: '찾아오시는 길', done: false, target: 'directions' },
      ],
      noProcedures: false,
    },
    timezone: 'Asia/Seoul',
    calculatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function stub(value: AdminDashboard): void {
  vi.spyOn(dashboardApi, 'fetchAdminDashboard').mockResolvedValue(value);
}

function renderDashboard() {
  return renderWithProviders(<HospitalDashboard />, { route: '/admin', path: '/admin' });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  signIn();
  act(() => {
    useAdminHospitalStore.getState().clear();
  });
  vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue({
    items: [],
    meta: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 },
    scope: 'managed',
  });
  stub(dashboard());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  act(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
  });
});

describe('HospitalDashboard — 인사와 담당 병원', () => {
  it('서울 달력의 오늘과 병원 이름으로 인사한다', async () => {
    renderDashboard();

    expect(await screen.findByText('안녕하세요, 강남 스마일 치과')).toBeInTheDocument();
    expect(screen.getByText('10월 13일 화요일')).toBeInTheDocument();
  });

  it('담당 병원이 0곳이면 대시보드 대신 빈 상태이고, 집계를 부르지 않는다', async () => {
    signIn([]);

    renderDashboard();

    expect(await screen.findByText('담당 병원이 아직 지정되지 않았어요')).toBeInTheDocument();
    expect(screen.getByText('운영자가 병원을 연결하면 이 화면에 오늘 할 일이 나타나요')).toBeInTheDocument();
    expect(dashboardApi.fetchAdminDashboard).not.toHaveBeenCalled();
  });
});

describe('HospitalDashboard — 숫자 카드', () => {
  it('네 카드가 응답의 숫자를 그대로 그린다', async () => {
    renderDashboard();

    const cards = await screen.findByRole('region', { name: '핵심 숫자' });

    expect(within(cards).getByText('3 건')).toBeInTheDocument();
    expect(within(cards).getByText('신규 전체 8건')).toBeInTheDocument();
    expect(within(cards).getByText('15 건')).toBeInTheDocument();
    expect(within(cards).getByText('24시간 지연 3건')).toBeInTheDocument();
    expect(within(cards).getByText('2 건')).toBeInTheDocument();
    expect(within(cards).getByText('가장 오래된 것 10/9 10:12')).toBeInTheDocument();
    expect(within(cards).getByText('18 건')).toBeInTheDocument();
    expect(within(cards).getByText('이번 달 신청 42건 중 18건 예약')).toBeInTheDocument();
  });

  /** 카드를 누르면 **같은 숫자가 나오는 목록**이 열려야 한다 (계약 §14 의 표). */
  it('각 카드가 그 숫자를 재현하는 목록으로 간다', async () => {
    renderDashboard();

    const cards = await screen.findByRole('region', { name: '핵심 숫자' });

    expect(within(cards).getByRole('link', { name: /오늘 들어온 상담/ })).toHaveAttribute(
      'href',
      '/admin/consultations?status=all&period=today'
    );
    // 기간 무관한 숫자는 `period=all` 을 적어 보낸다 — 목록의 기본 기간(`최근 30일`)이
    // 31일 전에 들어와 아직 신규인 건을 숨겨, 카드 숫자와 목록 건수가 갈린다.
    expect(within(cards).getByRole('link', { name: /처리 대기/ })).toHaveAttribute(
      'href',
      '/admin/consultations?status=new&status=contacted&period=all'
    );
    expect(within(cards).getByRole('link', { name: /답변 안 한 문의/ })).toHaveAttribute('href', '/admin/inquiries');
    expect(within(cards).getByRole('link', { name: /이번 달 예약확정/ })).toHaveAttribute(
      'href',
      '/admin/consultations?period=thisMonth&status=booked&status=visited'
    );
  });

  it('지연이 0건이면 없다고 적는다', async () => {
    stub(dashboard({ numbers: { ...dashboard().numbers, delayed: 0 } }));

    renderDashboard();

    expect(await screen.findByText('24시간 지연 없음')).toBeInTheDocument();
  });

  it('이번 달 신청이 0건이면 비율 대신 그 사실을 적는다', async () => {
    stub(
      dashboard({
        numbers: { ...dashboard().numbers, newThisMonth: 0, bookedThisMonth: 0 },
      })
    );

    renderDashboard();

    expect(await screen.findByText('이번 달 신청이 아직 없어요')).toBeInTheDocument();
  });

  it('미답변이 0건이면 `가장 오래된 것` 줄이 없다', async () => {
    stub(dashboard({ numbers: { ...dashboard().numbers, unansweredInquiries: 0, oldestUnansweredAt: null } }));

    renderDashboard();

    await screen.findByRole('region', { name: '핵심 숫자' });
    expect(screen.queryByText(/가장 오래된 것/)).not.toBeInTheDocument();
  });

  it('아직 모르는 동안에는 숫자 대신 `—` 다 — 0 은 사실 주장이다', async () => {
    vi.spyOn(dashboardApi, 'fetchAdminDashboard').mockRejectedValue(
      new ApiError({ status: 500, code: 'INTERNAL', message: '서버 오류' })
    );

    renderDashboard();

    const cards = await screen.findByRole('region', { name: '핵심 숫자' });
    await waitFor(() => expect(within(cards).getAllByText('—')).toHaveLength(4));
  });
});

describe('HospitalDashboard — 완성도와 노출 경고', () => {
  it('남은 항목 칩이 그 입력 칸으로 간다', async () => {
    renderDashboard();

    expect(await screen.findByText('병원 정보 86% 입력됨')).toBeInTheDocument();
    expect(screen.getByText('남은 항목 1개 — 누르면 입력 칸으로 가요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '찾아오시는 길' })).toHaveAttribute(
      'href',
      '/admin/hospital/h1?field=directions'
    );
  });

  it('다 채웠으면 카드는 남고 문구만 바뀐다', async () => {
    stub(
      dashboard({
        completeness: {
          percent: 100,
          items: [{ key: 'basicInfo', label: '기본 정보', done: true, target: 'name' }],
          noProcedures: false,
        },
      })
    );

    renderDashboard();

    expect(await screen.findByText('병원 정보 100% 입력됨')).toBeInTheDocument();
    expect(screen.getByText('모두 채웠어요.')).toBeInTheDocument();
    expect(screen.queryByText(/남은 항목/)).not.toBeInTheDocument();
  });

  /**
   * `앱에 노출되지 않아요` 는 사실이 아니다 — 이름 검색·찜·직접 링크로는 그대로 보인다
   * (`docs/database/README.md` §13.7 이 경로를 하나하나 확인했다).
   */
  it('시술이 0개면 "시술로 찾을 때" 로 좁힌 경고를 보여준다', async () => {
    stub(dashboard({ completeness: { ...dashboard().completeness, noProcedures: true } }));

    renderDashboard();

    expect(await screen.findByRole('heading', { name: '시술로 찾을 때 병원이 나오지 않아요' })).toBeInTheDocument();
    expect(
      screen.getByText(
        '시술을 등록하지 않으면 환자가 시술로 검색할 때 병원이 나오지 않아요. 이름으로 찾거나 찜한 환자에게는 그대로 보여요.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '시술 등록하러 가기' })).toHaveAttribute(
      'href',
      '/admin/hospital/h1?field=procedureIds'
    );
    expect(screen.queryByText(/앱에 노출되지 않아요/)).not.toBeInTheDocument();
  });

  it('시술이 있으면 경고가 없다', async () => {
    renderDashboard();

    await screen.findByText('병원 정보 86% 입력됨');
    expect(screen.queryByText('시술로 찾을 때 병원이 나오지 않아요')).not.toBeInTheDocument();
  });
});

describe('HospitalDashboard — 오늘 할 일', () => {
  it('지연 건은 건별 줄이고 경과 시간이 붙는다', async () => {
    stub(
      dashboard({
        todo: {
          delayedConsults: [
            { id: 'cr12', name: '박서영', procedureId: 'implant-general', createdAt: '2026-10-11T23:40:00.000Z' },
          ],
          delayedRemaining: 2,
          rejectedDoctors: [],
        },
      })
    );

    renderDashboard();

    const todo = await screen.findByRole('region', { name: '오늘 할 일' });
    // 2026-10-11T23:40Z → 2026-10-13T02:30Z 는 26시간 50분이다.
    expect(within(todo).getByText(/박서영 님 임플란트 · 일반 임플란트, 26시간째 연락 전/)).toBeInTheDocument();
    expect(within(todo).getByRole('link', { name: /박서영/ })).toHaveAttribute('href', '/admin/consultations/cr12');
    expect(within(todo).getByText('지연 상담 2건 더 보기')).toBeInTheDocument();
  });

  it('신규·미답변 줄은 숫자 카드와 같은 필드를 읽는다', async () => {
    renderDashboard();

    const todo = await screen.findByRole('region', { name: '오늘 할 일' });
    expect(within(todo).getByText('신규 상담 8건 연락하기')).toBeInTheDocument();
    // 지연 3건은 신규 8건의 일부다 — 11건으로 읽히지 않게 겹친다고 적는다.
    expect(within(todo).getByText('— 그중 3건은 24시간이 지났어요')).toBeInTheDocument();
    expect(within(todo).getByText('답변 안 한 문의 2건')).toBeInTheDocument();
    // `신규 8건` 은 기간 무관한 숫자다 — 목록도 기간을 풀고 열어야 8건이 나온다.
    expect(within(todo).getByRole('link', { name: /신규 상담 8건/ })).toHaveAttribute(
      'href',
      '/admin/consultations?period=all'
    );
  });

  it('반려된 전문의는 의료진 영역으로 간다 (사유는 아직 없다)', async () => {
    stub(
      dashboard({
        todo: { delayedConsults: [], delayedRemaining: 0, rejectedDoctors: [{ id: 'd4', name: '이수진' }] },
      })
    );

    renderDashboard();

    const todo = await screen.findByRole('region', { name: '오늘 할 일' });
    expect(within(todo).getByText('이수진 원장 자격증 반려, 다시 올리기')).toBeInTheDocument();
    expect(within(todo).getByRole('link', { name: /이수진/ })).toHaveAttribute(
      'href',
      '/admin/hospital/h1?field=doctors'
    );
  });

  it('네 줄이 모두 비면 할 일이 없다고 말한다', async () => {
    stub(
      dashboard({
        numbers: { ...dashboard().numbers, statusNew: 0, unansweredInquiries: 0, delayed: 0 },
      })
    );

    renderDashboard();

    const todo = await screen.findByRole('region', { name: '오늘 할 일' });
    expect(within(todo).getByText('오늘 할 일이 없어요')).toBeInTheDocument();
    expect(within(todo).getByText('들어온 상담에 모두 연락했고, 문의도 다 답했어요')).toBeInTheDocument();
  });
});

describe('HospitalDashboard — 최근 상담 · 오늘 내원 · 상담 흐름', () => {
  it('최근 상담 줄은 상세로 가고 전화번호를 싣지 않는다', async () => {
    stub(dashboard({ recentConsults: [consultRow()] }));

    renderDashboard();

    const recent = await screen.findByRole('region', { name: '최근 상담 예약' });
    expect(within(recent).getByRole('link', { name: /박서영/ })).toHaveAttribute('href', '/admin/consultations/cr20');
    expect(within(recent).queryByText(/010-/)).not.toBeInTheDocument();
    expect(within(recent).getByRole('link', { name: '전체 보기' })).toHaveAttribute(
      'href',
      '/admin/consultations?status=all&period=all'
    );
  });

  it('최근 상담이 없으면 그렇게 적는다', async () => {
    renderDashboard();

    const recent = await screen.findByRole('region', { name: '최근 상담 예약' });
    expect(within(recent).getByText('아직 들어온 상담이 없어요')).toBeInTheDocument();
  });

  it('오늘 내원 예정은 시각과 모집단을 함께 보여준다', async () => {
    stub(
      dashboard({
        todayVisits: [
          { id: 'cr3', name: '김민준', procedureId: 'bracket-braces', visitAt: '2026-10-13T05:00:00.000Z' },
        ],
      })
    );

    renderDashboard();

    const visits = await screen.findByRole('region', { name: '오늘 내원 예정' });
    expect(within(visits).getByText('14:00')).toBeInTheDocument();
    expect(within(visits).getByRole('link', { name: /김민준/ })).toHaveAttribute('href', '/admin/consultations/cr3');
    expect(within(visits).getByText('예약확정 상태이고 확정 일시가 오늘인 건이에요')).toBeInTheDocument();
  });

  it('오늘 내원 예정이 없으면 그렇게 적는다', async () => {
    renderDashboard();

    const visits = await screen.findByRole('region', { name: '오늘 내원 예정' });
    expect(within(visits).getByText('오늘 내원 예정이 없어요')).toBeInTheDocument();
  });

  it('상담 흐름은 네 단계와 취소를 적는다', async () => {
    renderDashboard();

    const funnel = await screen.findByRole('region', { name: '이번 달 상담 흐름' });
    expect(within(funnel).getByText('상담 신청')).toBeInTheDocument();
    expect(within(funnel).getByText('42건')).toBeInTheDocument();
    expect(within(funnel).getByText('연락 완료')).toBeInTheDocument();
    expect(within(funnel).getByText('31건')).toBeInTheDocument();
    expect(within(funnel).getByText('예약확정')).toBeInTheDocument();
    expect(within(funnel).getByText('내원완료')).toBeInTheDocument();
    expect(within(funnel).getByText('취소')).toBeInTheDocument();
  });

  it('이번 달 신청이 0건이면 막대 대신 한 줄이다', async () => {
    stub(dashboard({ funnel: { requested: 0, contacted: 0, booked: 0, visited: 0, cancelled: 0 } }));

    renderDashboard();

    const funnel = await screen.findByRole('region', { name: '이번 달 상담 흐름' });
    expect(within(funnel).getByText('이번 달 상담 신청이 아직 없어요')).toBeInTheDocument();
  });
});

describe('HospitalDashboard — 실패', () => {
  it('블록마다 실패를 말하고 다시 시도할 수 있다', async () => {
    const user = userEvent.setup();
    const fetchDashboard = vi
      .spyOn(dashboardApi, 'fetchAdminDashboard')
      .mockRejectedValue(new ApiError({ status: 500, code: 'INTERNAL', message: '서버 오류' }));

    renderDashboard();

    expect(await screen.findByText('오늘 할 일을 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('최근 상담 예약을 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('오늘 내원 예정을 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByText('이번 달 상담 흐름을 불러오지 못했어요')).toBeInTheDocument();

    fetchDashboard.mockResolvedValue(dashboard());
    await user.click(screen.getAllByRole('button', { name: '다시 시도' })[0]);

    expect(await screen.findByText('신규 상담 8건 연락하기')).toBeInTheDocument();
  });
});
