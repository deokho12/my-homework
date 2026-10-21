import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import { formatVisitAt, todayInSeoul } from '@/features/consult/consultDisplay';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { readCollection, writeCollection, type StoredConsultRequest } from '@/lib/localCollection';
import { RouterBridge } from '@/navigation';
import AdminConsultationsPage from '@/pages/admin/AdminConsultationsPage';
import { useAdminHospitalStore } from '@/store/useAdminHospitalStore';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { User, UserRole } from '@/types/domain';

/** 병원 이름은 상담 응답에 없어 화면이 병원 id 로 따로 묻는다 — 그 조회를 여기서 고정한다. */
const HOSPITAL_NAMES: Record<string, string> = { h1: '강남 스마일 치과', h2: '서초 미소 치과' };

const HOUR = 60 * 60 * 1000;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

/** 서울 달력으로 `days` 일 뒤의 `YYYY-MM-DD`. 날짜 칸에 넣을 값이다. */
function seoulDateIn(days: number): string {
  return todayInSeoul(new Date(Date.now() + days * 24 * HOUR));
}

function signIn(role: UserRole, managedHospitalIds: string[] = ['h1']): void {
  const user: User = {
    id: role === 'operator' ? 'u-op' : 'u-admin',
    email: 'admin@molarmolar.example',
    name: '김실장',
    provider: 'email',
    role,
    managedHospitalIds: role === 'hospital_admin' ? managedHospitalIds : [],
  };

  act(() => {
    useAuthStore.setState({ user, status: 'ready' });
  });
}

function row(overrides: Partial<StoredConsultRequest> = {}): StoredConsultRequest {
  return {
    id: 'cr1',
    hospitalId: 'h1',
    procedureId: 'implant-general',
    name: '박서영',
    phone: '010-1234-4411',
    preferredTime: '평일 오후',
    message: '임플란트 비용이 궁금해요',
    createdAt: hoursAgo(2),
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: hoursAgo(2) }],
    memos: [],
    ...overrides,
  };
}

function seed(rows: StoredConsultRequest[]): void {
  writeCollection('consultRequests', rows);
  writeCollection('notifications', []);
}

function LocationProbe() {
  const location = useLocation();

  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function probe(): string {
  return screen.getByTestId('location').textContent ?? '';
}

function renderPage(route = '/admin/consultations') {
  return renderWithProviders(
    <>
      <RouterBridge />
      <LocationProbe />
      <AdminConsultationsPage />
    </>,
    { route, path: '/admin/consultations/:id' }
  );
}

function list() {
  return screen.getByRole('tabpanel');
}

function detail() {
  return screen.getByRole('region', { name: '상담 상세' });
}

beforeEach(() => {
  seed([]);
  signIn('hospital_admin');
  act(() => {
    useAdminHospitalStore.getState().clear();
  });
  vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) =>
    baseHospital({ id, name: HOSPITAL_NAMES[id] ?? `${id} 치과` })
  );
});

afterEach(() => {
  act(() => {
    useAuthStore.setState({ user: null, status: 'ready' });
  });
  vi.restoreAllMocks();
});

describe('목록과 상태 탭', () => {
  beforeEach(() => {
    seed([
      row({ id: 'cr-new', name: '박서영', status: 'new', createdAt: hoursAgo(2) }),
      row({ id: 'cr-contacted', name: '최지훈', status: 'contacted', createdAt: hoursAgo(5) }),
      row({
        id: 'cr-booked',
        name: '정하윤',
        status: 'booked',
        visitAt: '2026-12-09T05:00:00.000Z',
        createdAt: hoursAgo(8),
      }),
    ]);
  });

  it('기본 탭은 신규이고 주소에 적지 않는다', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('tab', { name: '신규 1' })).toHaveAttribute('aria-selected', 'true'));
    expect(probe()).toBe('/admin/consultations');
    expect(within(list()).getByText('박서영')).toBeInTheDocument();
    expect(within(list()).queryByText('최지훈')).not.toBeInTheDocument();
  });

  it('탭 숫자는 지금 걸린 필터의 모집단에서 센다', async () => {
    renderPage();

    await screen.findByRole('tab', { name: '전체 3' });
    expect(screen.getByRole('tab', { name: '연락중 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '예약확정 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '내원완료 0' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '취소 0' })).toBeInTheDocument();
  });

  it('탭을 누르면 주소에 status 가 붙고 목록이 바뀐다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: '연락중 1' }));

    await waitFor(() => expect(probe()).toBe('/admin/consultations?status=contacted'));
    expect(within(list()).getByText('최지훈')).toBeInTheDocument();
    expect(within(list()).queryByText('박서영')).not.toBeInTheDocument();
  });

  it('화살표 키로 탭 사이를 돈다', async () => {
    const user = userEvent.setup();
    renderPage();

    const newTab = await screen.findByRole('tab', { name: '신규 1' });
    newTab.focus();
    await user.keyboard('{ArrowLeft}');

    await waitFor(() => expect(probe()).toBe('/admin/consultations?status=all'));
    expect(screen.getByRole('tab', { name: '전체 3' })).toHaveAttribute('aria-selected', 'true');
  });

  it('카드는 네 줄이다 — 상태·접수시각 / 이름·가린 번호 / 시술 / 방문 일시', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: '예약확정 1' }));

    const card = await within(list()).findByRole('button', { name: /정하윤/ });
    expect(within(card).getByText('예약확정')).toBeInTheDocument();
    expect(within(card).getByText('010-****-4411')).toBeInTheDocument();
    expect(await within(card).findByText('강남 스마일 치과 · 임플란트 · 일반 임플란트')).toBeInTheDocument();
    expect(within(card).getByText(`${formatVisitAt('2026-12-09T05:00:00.000Z')} 방문`)).toBeInTheDocument();
    // 전체 번호는 목록에 실리지 않는다.
    expect(within(list()).queryByText('010-1234-4411')).not.toBeInTheDocument();
  });

  it('확정 일시가 없으면 희망 연락 시간을 보여준다', async () => {
    renderPage();

    expect(await within(list()).findByText('평일 오후 연락 희망')).toBeInTheDocument();
  });

  it('카드 안에 빠른 상태 버튼이 없다', async () => {
    renderPage();

    await within(list()).findByRole('button', { name: /박서영/ });
    expect(within(list()).queryByRole('button', { name: '연락중' })).not.toBeInTheDocument();
  });

  it('신규로 24시간이 지나면 지연이 붙는다', async () => {
    seed([row({ id: 'cr-late', name: '한소율', createdAt: hoursAgo(26) })]);
    renderPage();

    const card = await within(list()).findByRole('button', { name: /한소율/ });
    expect(within(card).getByText('지연')).toBeInTheDocument();
  });

  it('다른 병원 관리자는 그 상담을 목록에서도 직접 주소에서도 못 본다', async () => {
    signIn('hospital_admin', ['h9']);
    renderPage('/admin/consultations/cr-new');

    expect(await screen.findByText('상담 정보를 찾을 수 없어요')).toBeInTheDocument();
    expect(within(list()).queryByText('박서영')).not.toBeInTheDocument();
  });

  it('운영자는 전 병원의 상담을 한 목록에서 보므로 카드가 어느 병원인지 적는다', async () => {
    seed([
      row({ id: 'cr-h1', name: '박서영', hospitalId: 'h1' }),
      row({ id: 'cr-h2', name: '최지훈', hospitalId: 'h2', createdAt: hoursAgo(3) }),
    ]);
    signIn('operator');
    renderPage();

    expect(await within(list()).findByText(/^강남 스마일 치과 · /)).toBeInTheDocument();
    expect(within(list()).getByText(/^서초 미소 치과 · /)).toBeInTheDocument();
  });
});

describe('필터', () => {
  beforeEach(() => {
    seed([
      row({ id: 'cr-a', name: '박서영', phone: '010-1234-4411', procedureId: 'implant-general', createdAt: hoursAgo(2) }),
      row({ id: 'cr-b', name: '최지훈', phone: '010-5555-6789', procedureId: 'resin', createdAt: hoursAgo(3) }),
    ]);
  });

  it('기본 기간은 최근 30일이고 주소에 적지 않는다', async () => {
    renderPage();

    await within(list()).findByRole('button', { name: /박서영/ });
    expect(screen.getByLabelText('기간')).toHaveValue('last30');
    expect(probe()).toBe('/admin/consultations');
  });

  it('기간을 바꾸면 주소에 적힌다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(await screen.findByLabelText('기간'), 'today');

    await waitFor(() => expect(probe()).toBe('/admin/consultations?period=today'));
  });

  /**
   * 요청 14 전에는 스케일링·예방에 서버 시술이 하나도 없어 **빈 배열**이 나갔고, 그러면
   * 필터가 없는 것과 같아 **모든 상담**이 보였다. 지금은 그 분야의 세부 4개가 나간다.
   */
  it('스케일링·예방을 고르면 그 분야의 세부 시술로 거른다 — 전체가 보이지 않는다', async () => {
    const user = userEvent.setup();
    seed([
      row({ id: 'cr-s', name: '정하늘', procedureId: 'scaling', createdAt: hoursAgo(1) }),
      row({ id: 'cr-a', name: '박서영', procedureId: 'implant-general', createdAt: hoursAgo(2) }),
    ]);
    renderPage();

    await user.selectOptions(await screen.findByLabelText('시술'), 'prevention');

    await waitFor(() => expect(within(list()).getByText('정하늘')).toBeInTheDocument());
    expect(within(list()).queryByText('박서영')).not.toBeInTheDocument();
  });

  it('시술 필터는 대분류를 고르면 목록을 줄인다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(await screen.findByLabelText('시술'), 'cavity');

    await waitFor(() => expect(probe()).toBe('/admin/consultations?category=cavity'));
    expect(within(list()).getByText('최지훈')).toBeInTheDocument();
    expect(within(list()).queryByText('박서영')).not.toBeInTheDocument();
  });

  it('검색은 디바운스 뒤에 주소에 적히고 목록이 줄어든다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('검색'), '서영');

    await waitFor(() => expect(probe()).toBe('/admin/consultations?q=%EC%84%9C%EC%98%81'));
    await waitFor(() => expect(within(list()).queryByText('최지훈')).not.toBeInTheDocument());
    expect(within(list()).getByText('박서영')).toBeInTheDocument();
  });

  it('연락처 뒷자리로도 찾는다', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('검색'), '6789');

    // 디바운스가 끝난 뒤의 결과를 본다 — 중간 글자(`6`)로는 아무것도 맞지 않는다.
    await waitFor(() => {
      expect(within(list()).queryByText('박서영')).not.toBeInTheDocument();
      expect(within(list()).getByText('최지훈')).toBeInTheDocument();
    });
  });

  it('조건 때문에 0건이면 조건 초기화가 기간·시술·검색만 되돌린다 (탭은 유지)', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations?status=all&category=botox');

    expect(await screen.findByText('조건에 맞는 상담이 없어요')).toBeInTheDocument();
    expect(screen.getByText('검색어나 기간을 바꿔 보세요')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '조건 초기화' }));

    // 시술만 풀렸고 탭은 그대로다.
    await waitFor(() => expect(probe()).toBe('/admin/consultations?status=all'));
    expect(await within(list()).findByText('박서영')).toBeInTheDocument();
  });

  it('기본 기간에 0건이면 최근 30일 기준이라고 말하고 전체 기간으로 넓혀 볼 수 있다', async () => {
    // 40일 전에 들어와 아직 아무도 연락하지 않은 신규 건 — 기본 기간이 가리면 "새 상담이 없다" 가 거짓이 된다.
    seed([row({ id: 'cr-old', createdAt: hoursAgo(40 * 24), statusHistory: [{ status: 'new', changedAt: hoursAgo(40 * 24) }] })]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('처리할 새 상담이 없어요')).toBeInTheDocument();
    expect(screen.getByText('최근 30일 기준이에요. 그 전에 들어온 상담은 기간을 넓혀야 보여요.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '전체 기간 보기' }));

    await waitFor(() => expect(probe()).toBe('/admin/consultations?period=all'));
    expect(await within(list()).findByText('박서영')).toBeInTheDocument();
  });

  it('조건이 전부 기본값이면 탭별 빈 상태 문구를 쓴다', async () => {
    seed([]);
    renderPage('/admin/consultations?status=visited');

    expect(await screen.findByText('내원한 상담이 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '조건 초기화' })).not.toBeInTheDocument();
  });
});

describe('상세', () => {
  beforeEach(() => {
    seed([row({ id: 'cr1', name: '박서영', phone: '010-1234-4411' })]);
  });

  it('카드를 누르면 주소에 id 가 붙고 걸린 조건이 유지된다', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations?period=today');

    await user.click(await within(list()).findByRole('button', { name: /박서영/ }));

    await waitFor(() => expect(probe()).toBe('/admin/consultations/cr1?period=today'));
  });

  it('담당 병원 관리자는 전체 번호와 전화 걸기 버튼을 본다', async () => {
    renderPage('/admin/consultations/cr1');

    expect(await within(detail()).findByText('010-1234-4411')).toBeInTheDocument();
    expect(within(detail()).getByRole('link', { name: '전화 걸기' })).toHaveAttribute('href', 'tel:01012344411');
    expect(
      within(detail()).queryByText('연락처 전체와 전화 걸기는 담당 병원 관리자만 볼 수 있어요.')
    ).not.toBeInTheDocument();
  });

  it('운영자는 상세에서도 가려진 번호만 보고 전화를 걸 수 없다', async () => {
    signIn('operator');
    renderPage('/admin/consultations/cr1');

    expect(await within(detail()).findByText('010-****-4411')).toBeInTheDocument();
    expect(within(detail()).queryByRole('link', { name: '전화 걸기' })).not.toBeInTheDocument();
    expect(
      within(detail()).getByText('연락처 전체와 전화 걸기는 담당 병원 관리자만 볼 수 있어요.')
    ).toBeInTheDocument();
    // 운영자는 이름도 마스킹된다.
    expect(within(detail()).getByRole('heading', { level: 2, name: '박*영' })).toBeInTheDocument();
  });

  it('정보 목록이 어느 병원의 상담인지 적는다 — 담당 병원이 여럿인 담당자도 있다', async () => {
    renderPage('/admin/consultations/cr1');

    expect(await within(detail()).findByText('강남 스마일 치과')).toBeInTheDocument();
  });

  it('지연된 상담은 상세에도 먼저 연락하라고 적는다', async () => {
    seed([row({ id: 'cr1', createdAt: hoursAgo(26) })]);
    renderPage('/admin/consultations/cr1');

    expect(await within(detail()).findByText('24시간 넘게 신규 상태예요. 먼저 연락해 주세요.')).toBeInTheDocument();
  });

  it('선택이 없으면 왼쪽에서 고르라고 안내한다', async () => {
    renderPage();

    expect(await within(detail()).findByText('왼쪽에서 상담을 선택하세요')).toBeInTheDocument();
  });
});

describe('상태 바꾸기', () => {
  beforeEach(() => {
    seed([row({ id: 'cr1', status: 'new' })]);
  });

  function statusButton(name: string) {
    return within(screen.getByRole('group', { name: '상태 바꾸기' })).getByRole('button', { name });
  }

  it('고르는 것과 바뀌는 것은 다르다 — 저장을 눌러야 바뀐다', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '연락중' }));

    expect(statusButton('연락중')).toHaveAttribute('aria-pressed', 'true');
    expect(readCollection('consultRequests')[0].status).toBe('new');

    await user.click(screen.getByRole('button', { name: '연락중으로 저장' }));

    await waitFor(() => expect(readCollection('consultRequests')[0].status).toBe('contacted'));
  });

  it('현재와 같은 상태를 고르면 아무것도 열리지 않는다 — 같은 알림이 또 나가지 않게', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '신규' }));

    expect(screen.queryByRole('button', { name: '신규로 저장' })).not.toBeInTheDocument();
  });

  it('예약확정은 날짜·시간이 없으면 저장할 수 없고 요청도 나가지 않는다', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '예약확정' }));

    expect(screen.getByLabelText('확정 날짜 (필수)')).toHaveAttribute('min', todayInSeoul(new Date()));
    expect(screen.getByRole('button', { name: '예약 확정하기' })).toBeDisabled();
    expect(screen.getByText('날짜와 시간을 모두 넣어야 저장할 수 있어요')).toBeInTheDocument();
    expect(readCollection('consultRequests')[0].status).toBe('new');
  });

  it('날짜·시간을 넣어 저장하면 확정 일시가 보이고 성공 줄에 포커스가 간다', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '예약확정' }));
    fireEvent.change(screen.getByLabelText('확정 날짜 (필수)'), { target: { value: seoulDateIn(2) } });
    fireEvent.change(screen.getByLabelText('시간 (필수)'), { target: { value: '14:00' } });
    await user.click(screen.getByRole('button', { name: '예약 확정하기' }));

    expect(
      await screen.findByText('예약확정으로 저장했어요. 환자에게 알림이 갔어요.')
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '상태 바꾸기' }));

    // 다음 변경을 고르기 시작하면 방금 저장 결과는 내려간다 — 새 선택이 이미 저장된 것처럼 읽히지 않게.
    await user.click(screen.getByRole('button', { name: '내원완료' }));
    expect(screen.queryByText('예약확정으로 저장했어요. 환자에게 알림이 갔어요.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    const stored = readCollection('consultRequests')[0];
    expect(stored.status).toBe('booked');
    expect(stored.visitAt).toBe(new Date(`${seoulDateIn(2)}T14:00:00+09:00`).toISOString());
    // 탭 숫자가 함께 바뀌고, 그 탭의 카드가 확정 일시를 보여준다.
    await waitFor(() => expect(screen.getByRole('tab', { name: '예약확정 1' })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: '예약확정 1' }));
    expect(await within(list()).findByText(`${formatVisitAt(stored.visitAt ?? '')} 방문`)).toBeInTheDocument();
  });

  it('지난 날짜는 저장 직전에 막는다', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '예약확정' }));
    fireEvent.change(screen.getByLabelText('확정 날짜 (필수)'), { target: { value: seoulDateIn(-3) } });
    fireEvent.change(screen.getByLabelText('시간 (필수)'), { target: { value: '14:00' } });
    await user.click(screen.getByRole('button', { name: '예약 확정하기' }));

    expect(await screen.findByText('지난 날짜는 고를 수 없어요')).toBeInTheDocument();
    expect(readCollection('consultRequests')[0].status).toBe('new');
  });

  it('일시 변경은 현재 값을 채워 주고, 그대로면 저장할 수 없다', async () => {
    const visitAt = new Date(`${seoulDateIn(3)}T14:00:00+09:00`).toISOString();
    seed([
      row({
        id: 'cr1',
        status: 'booked',
        visitAt,
        statusHistory: [{ status: 'booked', changedAt: hoursAgo(1), visitAt, event: 'status_change' }],
      }),
    ]);
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '일시 변경' }));

    expect(screen.getByLabelText('확정 날짜 (필수)')).toHaveValue(seoulDateIn(3));
    expect(screen.getByLabelText('시간 (필수)')).toHaveValue('14:00');
    expect(screen.getByRole('button', { name: '일시 변경 저장' })).toBeDisabled();
    expect(screen.getByText('일시가 그대로예요')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('시간 (필수)'), { target: { value: '11:00' } });
    await user.click(screen.getByRole('button', { name: '일시 변경 저장' }));

    const changed = new Date(`${seoulDateIn(3)}T11:00:00+09:00`).toISOString();
    expect(
      await screen.findByText(`일시를 ${formatVisitAt(changed)}으로 바꿨어요. 환자에게 알림이 갔어요.`)
    ).toBeInTheDocument();
    expect(readCollection('consultRequests')[0].visitAt).toBe(changed);
    expect(readCollection('consultRequests')[0].statusHistory.at(-1)?.event).toBe('reschedule');
  });

  it('취소는 사유를 고르기 전에는 저장할 수 없고, 예약확정이면 경고를 보여준다', async () => {
    const visitAt = new Date(`${seoulDateIn(3)}T14:00:00+09:00`).toISOString();
    seed([row({ id: 'cr1', status: 'booked', visitAt })]);
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '취소' }));

    expect(screen.getByText('저장하면 확정된 방문 일정이 취소돼요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소로 저장' })).toBeDisabled();
    // 예약확정의 날짜 안내와 같은 자리에서 왜 저장이 안 되는지 말한다.
    expect(screen.getByText('취소 사유를 골라야 저장할 수 있어요')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('취소 사유 (필수)'), 'no_answer');
    await user.click(screen.getByRole('button', { name: '취소로 저장' }));

    await waitFor(() => expect(readCollection('consultRequests')[0].status).toBe('cancelled'));
    // 취소하면 확정 일시를 지운다 — 환자에게 거짓이 남지 않게.
    expect(readCollection('consultRequests')[0].visitAt).toBeNull();
    expect(await within(detail()).findByText(/취소 · 연락이 안 됨 · 김실장 · 환자 알림 발송/)).toBeInTheDocument();
  });

  it('저장에 실패하면 인라인으로 알리고 고른 값을 유지한다', async () => {
    vi.spyOn(consultApi, 'updateConsultStatus').mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '연락중' }));
    await user.click(screen.getByRole('button', { name: '연락중으로 저장' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해주세요');
    expect(statusButton('연락중')).toHaveAttribute('aria-pressed', 'true');
  });

  it('운영자에게는 상태 폼이 없다 — 상담 처리는 병원이 한다', async () => {
    signIn('operator');
    renderPage('/admin/consultations/cr1');

    await within(detail()).findByRole('heading', { level: 2 });
    expect(screen.queryByRole('group', { name: '상태 바꾸기' })).not.toBeInTheDocument();
  });

  it('저장하지 않은 선택을 두고 다른 상담을 열면 묻는다', async () => {
    seed([row({ id: 'cr1', name: '박서영' }), row({ id: 'cr2', name: '최지훈', createdAt: hoursAgo(4) })]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.click(await screen.findByRole('button', { name: '연락중' }));
    await user.click(within(list()).getByRole('button', { name: /최지훈/ }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('저장하지 않은 내용이 있어요'));
    expect(probe()).toBe('/admin/consultations/cr1');
  });
});

describe('메모와 처리 이력', () => {
  it('메모를 추가하면 목록에 쌓이고 칸이 비워진다', async () => {
    seed([row({ id: 'cr1' })]);
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    await user.type(await screen.findByLabelText('메모 추가'), '전화 연결 안 됨');
    await user.click(screen.getByRole('button', { name: '메모 추가' }));

    expect(await within(detail()).findByText('전화 연결 안 됨')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('메모 추가')).toHaveValue(''));
  });

  it('처리 이력은 누가 언제 무엇으로 바꿨는지 한 줄로 적는다', async () => {
    seed([row({ id: 'cr1' })]);
    const user = userEvent.setup();
    renderPage('/admin/consultations/cr1');

    expect(await within(detail()).findByText(/앱에서 상담 신청/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '연락중' }));
    await user.click(screen.getByRole('button', { name: '연락중으로 저장' }));

    expect(await within(detail()).findByText(/연락중 · 김실장 · 환자 알림 발송/)).toBeInTheDocument();
  });
});

/**
 * 대시보드 숫자 카드가 **자기 숫자를 재현하는 주소**로 보낸다 (`?status=new&status=contacted`,
 * `?period=thisMonth`). 상담 목록은 그 주소를 그대로 읽어야 카드와 목록이 같은 건수를 말한다.
 */
describe('여러 상태로 좁혀 보기 (대시보드 카드에서 옴)', () => {
  beforeEach(() => {
    seed([
      row({ id: 'cr-new', name: '박서영', status: 'new', createdAt: hoursAgo(2) }),
      row({ id: 'cr-contacted', name: '최지훈', status: 'contacted', createdAt: hoursAgo(5) }),
      row({ id: 'cr-booked', name: '정하윤', status: 'booked', visitAt: '2026-12-09T05:00:00.000Z', createdAt: hoursAgo(8) }),
      row({ id: 'cr-visited', name: '김민준', status: 'visited', createdAt: hoursAgo(10) }),
    ]);
  });

  it('상태가 두 개면 그 둘을 OR 로 보여주고 어떤 탭도 선택하지 않는다', async () => {
    renderPage('/admin/consultations?status=new&status=contacted');

    await waitFor(() => expect(within(list()).getByText('박서영')).toBeInTheDocument());
    expect(within(list()).getByText('최지훈')).toBeInTheDocument();
    expect(within(list()).queryByText('정하윤')).not.toBeInTheDocument();

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('`처리 대기` 조합에는 카드와 같은 말로 안내한다', async () => {
    renderPage('/admin/consultations?status=new&status=contacted');

    expect(await screen.findByText('처리 대기(신규 + 연락중)만 보는 중')).toBeInTheDocument();
  });

  it('다른 조합은 상태 이름을 그대로 잇는다 (카드 ④ 가 보내는 주소)', async () => {
    renderPage('/admin/consultations?period=thisMonth&status=booked&status=visited');

    expect(await screen.findByText('예약확정 + 내원완료만 보는 중')).toBeInTheDocument();
    await waitFor(() => expect(within(list()).getByText('정하윤')).toBeInTheDocument());
    expect(within(list()).getByText('김민준')).toBeInTheDocument();
    expect(within(list()).queryByText('박서영')).not.toBeInTheDocument();
  });

  it('탭 숫자는 그대로 전 상태를 센다 — 좁혀 본다고 모집단이 바뀌지 않는다', async () => {
    renderPage('/admin/consultations?status=new&status=contacted');

    expect(await screen.findByRole('tab', { name: '전체 4' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '예약확정 1' })).toBeInTheDocument();
  });

  it('`해제` 를 누르면 기본 탭으로 돌아간다', async () => {
    const user = userEvent.setup();
    renderPage('/admin/consultations?status=new&status=contacted');

    await user.click(await screen.findByRole('button', { name: '해제' }));

    await waitFor(() => expect(probe()).toBe('/admin/consultations'));
    expect(await screen.findByRole('tab', { name: '신규 1' })).toHaveAttribute('aria-selected', 'true');
  });

  /**
   * `처리 대기` 는 **기간 무관한 숫자**다. 목록의 기본 기간이 `최근 30일` 이라, 카드가
   * 기간을 함께 풀어 보내지 않으면 **오래 밀린 건일수록** 카드에는 세어지고 목록에서는 빠진다.
   */
  it('`처리 대기` 카드 주소는 기간도 풀어서 온다 — 31일 전에 들어온 신규도 보인다', async () => {
    seed([row({ id: 'cr-stale', name: '오래된환자', status: 'new', createdAt: hoursAgo(24 * 40) })]);

    renderPage('/admin/consultations?status=new&status=contacted&period=all');

    await waitFor(() => expect(within(list()).getByText('오래된환자')).toBeInTheDocument());
  });

  it('상태가 하나뿐이면 평소처럼 그 탭이 선택된다', async () => {
    renderPage('/admin/consultations?status=booked');

    expect(await screen.findByRole('tab', { name: '예약확정 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText(/만 보는 중/)).not.toBeInTheDocument();
  });
});

describe('기간 `이번 달`', () => {
  it('선택지에 있고, 고르면 그 달에 접수된 건만 남는다', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 3, 0, 0)).toISOString();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 3, 0, 0)).toISOString();

    seed([
      row({ id: 'cr-this', name: '이번달', status: 'new', createdAt: thisMonth }),
      row({ id: 'cr-last', name: '지난달', status: 'new', createdAt: lastMonth }),
    ]);
    renderPage('/admin/consultations?period=all');

    await user.selectOptions(await screen.findByLabelText('기간'), 'thisMonth');

    await waitFor(() => expect(probe()).toBe('/admin/consultations?period=thisMonth'));
    await waitFor(() => expect(within(list()).getByText('이번달')).toBeInTheDocument());
    expect(within(list()).queryByText('지난달')).not.toBeInTheDocument();
  });
});

describe('선택한 담당 병원 범위', () => {
  it('담당 병원이 둘이어도 고른 병원의 상담만 보여준다', async () => {
    signIn('hospital_admin', ['h1', 'h2']);
    // 담당 병원이 2곳이면 셸의 선택기가 이름을 받으러 목록을 부른다.
    vi.spyOn(hospitalApi, 'fetchManagedHospitals').mockResolvedValue({
      items: [baseHospital({ id: 'h1' }), baseHospital({ id: 'h2' })],
      meta: { page: 1, pageSize: 100, totalItems: 2, totalPages: 1 },
      scope: 'managed',
    });
    seed([
      row({ id: 'cr-h1', hospitalId: 'h1', name: '강남환자', status: 'new', createdAt: hoursAgo(1) }),
      row({ id: 'cr-h2', hospitalId: 'h2', name: '서초환자', status: 'new', createdAt: hoursAgo(2) }),
    ]);
    act(() => {
      useAdminHospitalStore.getState().select('h2');
    });

    renderPage();

    await waitFor(() => expect(within(list()).getByText('서초환자')).toBeInTheDocument());
    expect(within(list()).queryByText('강남환자')).not.toBeInTheDocument();
  });
});
