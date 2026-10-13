import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation, useNavigationType } from 'react-router-dom';

import { createConsultRequest, type ConsultRequestCreateInput } from '@/features/consult';
import { addFavorite } from '@/features/favorite';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { readCollection, writeCollection, type StoredHospitalInquiry } from '@/lib/localCollection';
import { RouterBridge, router } from '@/navigation';
import MyPage from '@/pages/MyPage';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { AppNotification, ProcedureId, User } from '@/types/domain';

const HOSPITAL_NAMES: Record<string, string> = {
  h1: 'A치과의원',
  h2: 'B치과의원',
};

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'u-me',
    email: 'me@molarmolar.example',
    name: '김민준',
    provider: 'email',
    role: 'user',
    managedHospitalIds: [],
    ...overrides,
  };
}

function signIn(overrides: Partial<User> = {}): User {
  const signed = user(overrides);
  useAuthStore.setState({ user: signed, status: 'ready' });

  return signed;
}

/**
 * 상담은 **api 를 목하지 않고 실제로 접수한다** — "내 것만 보인다" 는 계정 스코프 판정이
 * api 계층(`fetchMyConsultRequests`)에 있어서, 목을 끼우면 그 판정이 테스트에서 사라진다.
 */
async function consultBy(userId: string, input: Partial<ConsultRequestCreateInput> = {}) {
  const current = useAuthStore.getState().user;

  useAuthStore.setState({ user: user({ id: userId }), status: 'ready' });
  const created = await createConsultRequest({
    hospitalId: 'h1',
    procedureId: null,
    name: '김민준',
    phone: '010-1234-5678',
    preferredTime: '평일 저녁',
    message: '',
    thirdPartyConsent: { agreed: true, noticeVersion: '2026-10-12' },
    ...input,
  });
  useAuthStore.setState({ user: current, status: current ? 'ready' : 'ready' });

  return created;
}

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    audience: 'user',
    type: 'consult-status',
    title: '상담 상태 변경',
    message: '상담 상태가 바뀌었어요',
    relatedId: 'c1',
    isRead: false,
    createdAt: '2026-10-12T00:00:00.000Z',
    ...overrides,
  };
}

/** 주소(`?tab=`)와 **쌓인 방식**(PUSH/REPLACE)을 함께 드러낸다 — 탭 전환은 이력을 쌓지 않는다. */
function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();

  return <div data-testid="location">{`${location.search}|${navigationType}`}</div>;
}

function probe(): string {
  return screen.getByTestId('location').textContent ?? '';
}

function renderMyPage(route = '/mypage') {
  return renderWithProviders(
    <>
      <RouterBridge />
      <LocationProbe />
      <MyPage />
    </>,
    { route }
  );
}

function tab(name: RegExp | string) {
  return screen.getByRole('tab', { name });
}

describe('MyPage — 로그인 상태에 따른 갈림', () => {
  afterEach(() => {
    // 화면이 아직 붙어 있는 채로 스토어를 비우면 그 리렌더가 act 경고로 샌다.
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
  });

  it('로그인하지 않았으면 로그인 카드만 보이고 탭이 없다', () => {
    useAuthStore.setState({ user: null, status: 'ready' });

    renderMyPage();

    expect(screen.getByText('로그인이 필요해요')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument();
  });

  it('세션을 되살리는 중에는 로그인 카드 대신 자리만 비워 둔다 (새로고침마다 번쩍이지 않게)', () => {
    useAuthStore.setState({ user: null, status: 'restoring' });

    renderMyPage();

    expect(screen.queryByText('로그인이 필요해요')).not.toBeInTheDocument();
    expect(screen.getByLabelText('내 정보를 불러오는 중이에요')).toBeInTheDocument();
  });

  it('로그인하면 이름·이메일과 탭 3개가 보인다', async () => {
    signIn();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());

    renderMyPage();

    expect(screen.getByText('김민준님, 안녕하세요')).toBeInTheDocument();
    expect(screen.getByText('me@molarmolar.example')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    await waitFor(() => expect(tab(/찜/)).toHaveTextContent('찜 0'));
  });
});

describe('MyPage — 상담 내역 탭', () => {
  beforeEach(() => {
    writeCollection('consultRequests', []);
    writeCollection('notifications', []);
    signIn();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) =>
      baseHospital({ id, name: HOSPITAL_NAMES[id] ?? `${id} 치과` })
    );
  });

  afterEach(() => {
    // 화면이 아직 붙어 있는 채로 스토어를 비우면 그 리렌더가 act 경고로 샌다.
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
  });

  it('내가 신청한 건만 센다 — 다른 계정의 신청은 보이지 않는다', async () => {
    await consultBy('u-other', { hospitalId: 'h2' });
    await consultBy('u-me', { hospitalId: 'h1' });

    renderMyPage();

    await waitFor(() => expect(tab(/상담 내역/)).toHaveTextContent('상담 내역 1'));
    expect(await screen.findByText('A치과의원')).toBeInTheDocument();
    expect(screen.queryByText('B치과의원')).not.toBeInTheDocument();
  });

  it('한 줄에 병원명·시술·상태·보조 문구가 함께 보인다', async () => {
    await consultBy('u-me', { procedureId: 'cavity' as ProcedureId, preferredTime: '평일 저녁' });

    renderMyPage();

    const row = await screen.findByRole('button', { name: /A치과의원/ });

    expect(within(row).getByText('충치치료 · 레진')).toBeInTheDocument();
    expect(within(row).getByText('신규')).toBeInTheDocument();
    expect(within(row).getByText(/신청 · 평일 저녁 연락 희망$/)).toBeInTheDocument();
  });

  it('병원이 확정한 방문 일시는 보조 문구를 대체하고 강조된다', async () => {
    const created = await consultBy('u-me', { hospitalId: 'h1' });
    // 병원 관리자가 `예약확정 + 일시` 로 바꾼 상태를 만든다 (관리자 화면이 하는 일 그대로).
    const rows = readCollection('consultRequests');
    writeCollection(
      'consultRequests',
      rows.map((row) =>
        row.id === created.id
          ? {
              ...row,
              status: 'booked' as const,
              visitAt: '2026-10-08T05:00:00.000Z',
              statusHistory: [
                ...row.statusHistory,
                {
                  event: 'status_change' as const,
                  status: 'booked' as const,
                  changedAt: '2026-10-07T02:00:00.000Z',
                  visitAt: '2026-10-08T05:00:00.000Z',
                },
              ],
            }
          : row
      )
    );

    renderMyPage();

    const row = await screen.findByRole('button', { name: /A치과의원/ });
    expect(within(row).getByText('10/8(목) 14:00 방문')).toBeInTheDocument();
    expect(within(row).getByText('예약확정')).toBeInTheDocument();
    expect(within(row).queryByText(/연락 희망/)).not.toBeInTheDocument();
  });

  it('고르지 않은 시술은 `시술 미지정` 으로 적는다', async () => {
    await consultBy('u-me', { procedureId: null });

    renderMyPage();

    expect(await screen.findByText('시술 미지정')).toBeInTheDocument();
  });

  it('최신 신청이 맨 위다', async () => {
    await consultBy('u-me', { hospitalId: 'h1' });
    await consultBy('u-me', { hospitalId: 'h2' });

    renderMyPage();

    expect(await screen.findByText('A치과의원')).toBeInTheDocument();
    expect(await screen.findByText('B치과의원')).toBeInTheDocument();

    const names = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(names).toHaveLength(2);
    expect(names[0]).toContain('B치과의원');
    expect(names[1]).toContain('A치과의원');
  });

  it('한 줄을 누르면 그 병원 상세로 간다', async () => {
    await consultBy('u-me', { hospitalId: 'h1' });
    const pushSpy = vi.spyOn(router, 'push');

    renderMyPage();

    await userEvent.click(await screen.findByRole('button', { name: /A치과의원/ }));

    expect(pushSpy).toHaveBeenCalledWith('/hospital/h1');
  });

  it('신청한 상담이 없으면 빈 상태를 보여준다', async () => {
    renderMyPage();

    expect(await screen.findByText('아직 신청한 상담이 없어요')).toBeInTheDocument();
  });

  it('알림에서 온 `?consult=` 는 그 행에 포커스를 주고, 쓰고 나면 주소에서 지운다', async () => {
    await consultBy('u-me', { hospitalId: 'h1' });
    const mine = await consultBy('u-me', { hospitalId: 'h2' });

    renderMyPage(`/mypage?tab=consults&consult=${mine.id}`);

    const row = await screen.findByRole('button', { name: /B치과의원/ });
    await waitFor(() => expect(row).toHaveFocus());
    // 포커스가 사라져도 어느 줄인지 남아야 한다 — 링은 주소를 정리한 뒤에도 그 행에 있다.
    expect(row.className).toContain('ring-brand-300');
    expect(screen.getByRole('button', { name: /A치과의원/ }).className).not.toContain('ring-brand-300');

    // 한 번 쓰고 지운다 — 탭은 그대로 두고 `consult=` 만 사라진다.
    await waitFor(() => expect(probe()).toBe('?tab=consults|REPLACE'));
  });

  it('목록에 없는 상담 id 면 조용히 탭만 열고 주소만 정리한다', async () => {
    await consultBy('u-me', { hospitalId: 'h1' });

    renderMyPage('/mypage?tab=consults&consult=cr-not-mine');

    expect(await screen.findByRole('button', { name: /A치과의원/ })).toBeInTheDocument();
    await waitFor(() => expect(probe()).toBe('?tab=consults|REPLACE'));
    expect(screen.getByRole('button', { name: /A치과의원/ }).className).not.toContain('ring-brand-300');
  });
});

describe('MyPage — 탭 전환과 주소', () => {
  beforeEach(() => {
    writeCollection('consultRequests', []);
    writeCollection('notifications', []);
    signIn();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) =>
      baseHospital({ id, name: HOSPITAL_NAMES[id] ?? `${id} 치과` })
    );
  });

  afterEach(() => {
    // 화면이 아직 붙어 있는 채로 스토어를 비우면 그 리렌더가 act 경고로 샌다.
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
  });

  it('기본은 상담 내역 탭이다', async () => {
    renderMyPage();

    await waitFor(() => expect(tab(/상담 내역/)).toHaveAttribute('aria-selected', 'true'));
  });

  it('모르는 탭 값이 들어오면 상담 내역으로 떨어진다', async () => {
    renderMyPage('/mypage?tab=unknown');

    await waitFor(() => expect(tab(/상담 내역/)).toHaveAttribute('aria-selected', 'true'));
  });

  it('탭을 누르면 패널이 바뀌고 주소가 이력을 쌓지 않고 바뀐다', async () => {
    renderMyPage();

    await userEvent.click(tab(/내 문의/));

    expect(await screen.findByText('아직 남긴 문의가 없어요')).toBeInTheDocument();
    expect(screen.queryByText('아직 신청한 상담이 없어요')).not.toBeInTheDocument();
    expect(probe()).toBe('?tab=inquiries|REPLACE');

    await userEvent.click(tab(/찜/));

    expect(await screen.findByText('아직 찜한 병원이 없어요')).toBeInTheDocument();
    expect(probe()).toBe('?tab=favorites|REPLACE');

    await userEvent.click(tab(/상담 내역/));

    expect(await screen.findByText('아직 신청한 상담이 없어요')).toBeInTheDocument();
    expect(probe()).toBe('|REPLACE');
  });

  it('`?tab=favorites` 로 들어오면 찜 탭이 열린다', async () => {
    renderMyPage('/mypage?tab=favorites');

    await waitFor(() => expect(tab(/찜/)).toHaveAttribute('aria-selected', 'true'));
    expect(await screen.findByText('아직 찜한 병원이 없어요')).toBeInTheDocument();
  });

  it('키보드 ←/→/Home/End 로 탭을 옮긴다', async () => {
    renderMyPage();

    // 숫자가 붙을 때까지 기다린다 — 조회가 키 입력 도중에 끝나면 그 리렌더가 경고로 샌다.
    await waitFor(() => expect(tab(/상담 내역/)).toHaveTextContent('상담 내역 0'));
    act(() => tab(/상담 내역/).focus());

    await userEvent.keyboard('{ArrowRight}');
    expect(tab(/내 문의/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/내 문의/)).toHaveFocus();

    await userEvent.keyboard('{End}');
    expect(tab(/찜/)).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowRight}');
    expect(tab(/상담 내역/)).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowLeft}');
    expect(tab(/찜/)).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Home}');
    expect(tab(/상담 내역/)).toHaveAttribute('aria-selected', 'true');
    expect(probe()).toBe('|REPLACE');
  });
});

describe('MyPage — 찜 탭', () => {
  beforeEach(() => {
    writeCollection('consultRequests', []);
    writeCollection('notifications', []);
    signIn();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockImplementation(async (id: string) =>
      baseHospital({ id, name: HOSPITAL_NAMES[id] ?? `${id} 치과` })
    );
  });

  afterEach(() => {
    // 화면이 아직 붙어 있는 채로 스토어를 비우면 그 리렌더가 act 경고로 샌다.
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
  });

  it('찜 탭이 아닐 때는 찜한 병원을 조회하지 않는다 (보이지 않는 패널은 그리지 않는다)', async () => {
    await addFavorite('h1');

    renderMyPage('/mypage');

    // 찜 숫자는 목록 id 만으로 센다 — 병원 상세 조회 없이도 확정된다.
    await waitFor(() => expect(tab(/찜/)).toHaveTextContent('찜 1'));
    expect(hospitalApi.fetchHospitalById).not.toHaveBeenCalledWith('h1');
  });

  it('찜한 병원이 카드로 보이고, 하트를 해제하면 목록과 숫자에서 빠진다', async () => {
    await addFavorite('h1');

    renderMyPage('/mypage?tab=favorites');

    await waitFor(() => expect(tab(/찜/)).toHaveTextContent('찜 1'));
    expect(await screen.findByText('A치과의원')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '❤️' }));

    await waitFor(() => expect(screen.queryByText('A치과의원')).not.toBeInTheDocument());
    expect(tab(/찜/)).toHaveTextContent('찜 0');
  });

  it('조회가 끝났는데도 병원을 찾을 수 없으면(삭제됨) 조용히 걷어낸다', async () => {
    await addFavorite('deleted-hospital');
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(new Error('not found'));

    renderMyPage('/mypage?tab=favorites');

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.queryByText('아직 찜한 병원이 없어요')).not.toBeInTheDocument();
  });
});

describe('MyPage — 메뉴와 로그아웃', () => {
  beforeEach(() => {
    writeCollection('consultRequests', []);
    writeCollection('notifications', []);
    signIn();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
  });

  afterEach(() => {
    // 화면이 아직 붙어 있는 채로 스토어를 비우면 그 리렌더가 act 경고로 샌다.
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
  });

  it('안 읽은 알림 수를 알림함 줄에 배지로 보여준다', async () => {
    writeCollection('notifications', [
      notification({ id: 'n1' }),
      notification({ id: 'n2' }),
      notification({ id: 'n3', isRead: true }),
      notification({ id: 'n4', audience: 'admin' }),
    ]);

    renderMyPage();

    const row = await screen.findByRole('button', { name: /알림함/ });
    await waitFor(() => expect(within(row).getByText('2')).toBeInTheDocument());
  });

  it('준비중 메뉴는 눌리지도 포커스되지도 않는다', async () => {
    renderMyPage();

    await waitFor(() => expect(tab(/찜/)).toHaveTextContent('찜 0'));
    expect(screen.getAllByText('준비중')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /알림 설정/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /회원정보 수정/ })).not.toBeInTheDocument();
  });

  it('로그아웃을 확인하면 탭·메뉴가 사라지고 로그인 카드만 남는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderMyPage();

    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    await waitFor(() => expect(screen.getByText('로그인이 필요해요')).toBeInTheDocument());
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('로그아웃을 취소하면 그대로 로그인 상태다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderMyPage();

    await waitFor(() => expect(tab(/찜/)).toHaveTextContent('찜 0'));
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(screen.getByText('김민준님, 안녕하세요')).toBeInTheDocument();
  });
});

describe('MyPage — 관리자 입구', () => {
  beforeEach(() => {
    writeCollection('consultRequests', []);
    writeCollection('notifications', []);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
  });

  afterEach(() => {
    // 화면이 아직 붙어 있는 채로 스토어를 비우면 그 리렌더가 act 경고로 샌다.
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
  });

  it('일반 사용자에게는 보이지 않는다', async () => {
    signIn({ role: 'user' });

    renderMyPage();

    await waitFor(() => expect(tab(/찜/)).toHaveTextContent('찜 0'));
    expect(screen.queryByText('병원 관리자 페이지')).not.toBeInTheDocument();
  });

  it('병원 관리자에게만 보이고 누르면 관리자 화면으로 간다', async () => {
    signIn({ role: 'hospital_admin', managedHospitalIds: ['h1'] });
    const pushSpy = vi.spyOn(router, 'push');

    renderMyPage();

    await waitFor(() => expect(tab(/찜/)).toHaveTextContent('찜 0'));
    await userEvent.click(screen.getByRole('button', { name: /병원 관리자 페이지/ }));

    expect(pushSpy).toHaveBeenCalledWith('/admin');
  });
});

/**
 * 내 문의 탭 (요청서 `2026-10-12-03`).
 *
 * 문의도 상담과 같이 **api 를 목하지 않고 실제 저장소에 넣는다** — "내 것만 보인다" 는
 * 계정 스코프 판정이 api 계층(`fetchMyInquiries`)에 있다.
 */
describe('MyPage — 내 문의 탭', () => {
  function seedInquiries(rows: Partial<StoredHospitalInquiry>[]): void {
    writeCollection(
      'inquiries',
      rows.map((row, index) => ({
        id: `hi${index + 1}`,
        hospitalId: 'h1',
        hospitalName: 'A치과의원',
        topic: 'price' as const,
        content: `질문 ${index + 1}`,
        isPublic: true,
        answer: null,
        createdAt: `2026-10-0${index + 1}T00:00:00.000Z`,
        ownerUserId: 'u-me',
        askerDisplayName: '김민준',
        ...row,
      }))
    );
  }

  beforeEach(() => {
    writeCollection('consultRequests', []);
    writeCollection('notifications', []);
    writeCollection('inquiries', []);
    signIn();
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

  it('탭 숫자가 실제 내 문의 수다 (더 이상 0 으로 고정되어 있지 않다)', async () => {
    seedInquiries([{}, { id: 'hi2' }]);

    renderMyPage('/mypage?tab=inquiries');

    await waitFor(() => expect(tab(/내 문의/)).toHaveTextContent('내 문의 2'));
  });

  it('다른 계정이 남긴 문의는 보이지 않는다', async () => {
    seedInquiries([
      { id: 'hi-mine', content: '내가 남긴 질문' },
      { id: 'hi-other', content: '남이 남긴 질문', ownerUserId: 'u-other' },
    ]);

    renderMyPage('/mypage?tab=inquiries');

    expect(await screen.findByRole('button', { name: /내가 남긴 질문/ })).toBeInTheDocument();
    expect(screen.queryByText('남이 남긴 질문')).not.toBeInTheDocument();
  });

  it('행에 제목·병원·공개 여부·상태가 보이고, 펼치면 본문과 답변을 읽을 수 있다', async () => {
    seedInquiries([
      {
        id: 'hi-answered',
        content: '임플란트 비용이 궁금해요\n뼈이식도 필요할까요?',
        answer: { content: '90만원부터 시작합니다', isPublic: true, answeredAt: '2026-10-08T00:00:00.000Z' },
      },
    ]);

    renderMyPage('/mypage?tab=inquiries');

    const row = await screen.findByRole('button', { name: /임플란트 비용이 궁금해요/ });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('A치과의원 · 공개')).toBeInTheDocument();
    expect(screen.getByText('답변완료')).toBeInTheDocument();
    // 펼치기 전에는 답변이 읽히지 않는다 (패널이 hidden 이다).
    expect(screen.getByText('90만원부터 시작합니다')).not.toBeVisible();

    await userEvent.click(row);

    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('90만원부터 시작합니다')).toBeVisible();
    expect(screen.getByText('뼈이식도 필요할까요?', { exact: false })).toBeVisible();
  });

  it('공개로 물었어도 병원이 비공개로 답했으면 비공개라고 말하고, 병원 상세의 문의로 보내지 않는다', async () => {
    seedInquiries([
      {
        id: 'hi-private-answer',
        content: '스케일링 보험 되나요?',
        isPublic: true,
        answer: { content: '연 1회 적용돼요', isPublic: false, answeredAt: '2026-10-08T00:00:00.000Z' },
      },
    ]);

    renderMyPage('/mypage?tab=inquiries');

    const row = await screen.findByRole('button', { name: /스케일링 보험 되나요\?/ });
    // 공개 Q/A 에 실제로 올라가 있지 않으므로 '공개' 라고 말하면 거짓이다.
    expect(screen.getByText('A치과의원 · 비공개')).toBeInTheDocument();

    await userEvent.click(row);
    expect(screen.getByText(/비공개 · 나만 볼 수 있어요/)).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: '병원 상세 보기 ›' }));
    // 문의 섹션으로 점프하는 `?section=inquiry` 가 붙지 않는다 — 그곳에 이 글이 없다.
    await waitFor(() => expect(probe()).toBe('|PUSH'));
  });

  it('아직 답이 없으면 기다리는 중이라고 적는다', async () => {
    seedInquiries([{ id: 'hi-waiting', content: '주차 되나요?', isPublic: false }]);

    renderMyPage('/mypage?tab=inquiries');

    await userEvent.click(await screen.findByRole('button', { name: /주차 되나요\?/ }));

    expect(screen.getByText('A치과의원 · 비공개')).toBeInTheDocument();
    expect(screen.getByText('답변 대기')).toBeInTheDocument();
    expect(screen.getByText('아직 답변을 기다리는 중이에요')).toBeVisible();
  });

  it('알림에서 온 `?inquiry=` 는 그 행을 펼친 채 열고, 쓰고 나면 주소에서 지운다', async () => {
    seedInquiries([
      { id: 'hi1', content: '첫 질문' },
      {
        id: 'hi2',
        content: '둘째 질문',
        createdAt: '2026-10-05T00:00:00.000Z',
        answer: { content: '둘째 답변입니다', isPublic: false, answeredAt: '2026-10-06T00:00:00.000Z' },
      },
    ]);

    renderMyPage('/mypage?tab=inquiries&inquiry=hi2');

    const row = await screen.findByRole('button', { name: /둘째 질문/ });
    await waitFor(() => expect(row).toHaveAttribute('aria-expanded', 'true'));
    expect(screen.getByText('둘째 답변입니다')).toBeVisible();
    expect(row).toHaveFocus();
    // 첫 행은 접힌 채다 — 딥링크는 한 건만 연다.
    expect(screen.getByRole('button', { name: /첫 질문/ })).toHaveAttribute('aria-expanded', 'false');

    // 한 번 쓰고 지운다. 새로고침·뒤로 가기에서 같은 행이 다시 열리지 않게.
    await waitFor(() => expect(probe()).toBe('?tab=inquiries|REPLACE'));
  });

  it('문의가 없으면 병원 찾기로 보내는 빈 상태를 보여준다', async () => {
    renderMyPage('/mypage?tab=inquiries');

    expect(await screen.findByText('아직 남긴 문의가 없어요')).toBeInTheDocument();
    expect(screen.getByText('병원 상세에서 궁금한 점을 물어보세요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '병원 찾아보기' })).toBeInTheDocument();
  });
});
