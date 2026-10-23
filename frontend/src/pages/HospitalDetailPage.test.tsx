import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as reviewApi from '@/features/review/api/reviewApi';
import { ApiError } from '@/lib/apiClient';
import { writeCollection, type StoredHospitalInquiry } from '@/lib/localCollection';
import { RouterBridge, router } from '@/navigation';
import HospitalDetailPage from '@/pages/HospitalDetailPage';
import { useAuthStore } from '@/store/useAuthStore';
import { baseHospital } from '@/test/hospitalFixture';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital } from '@/types/domain';

/**
 * `fetchHospitalById` 는 이제 HTTP 를 부른다 — 목 백엔드를 거치지 않으므로 매 테스트가
 * `hospitalApi.fetchHospitalById` 를 직접 스파이한다.
 */
/** 탭 하나를 연다. 시안 B 부터는 한 번에 한 섹션만 보인다. */
async function openTab(name: string): Promise<void> {
  await userEvent.click(await screen.findByRole('tab', { name }));
}

describe('HospitalDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('로딩 중에는 status 영역을 보여준다', () => {
    const target = baseHospital();
    // 응답이 오지 않은 상태를 고정한다 — resolve/reject 하지 않는 프라미스.
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('불러오는 중이에요')).toBeInTheDocument();
  });

  it('불러온 병원 이름을 렌더한다', async () => {
    const target = baseHospital();
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.getByText('병원 소개')).toBeInTheDocument();
  });

  it('404 HOSPITAL_NOT_FOUND 면 안내 문구를 보여주고 다시 시도 버튼은 없다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderWithProviders(<HospitalDetailPage />, {
      route: '/hospital/no-such-id',
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText('병원 정보를 찾을 수 없어요')).toBeInTheDocument());
    // 존재하지 않는 병원이다 — 재시도해도 성공하지 않으므로 에러 화면이 아니라 빈 상태여야 한다.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });

  it('네트워크 오류 등 그 외 에러는 에러 문구와 다시 시도 버튼을 보여준다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '연결에 문제가 있어요. 잠시 후 다시 시도해주세요' })
    );

    renderWithProviders(<HospitalDetailPage />, {
      route: '/hospital/h1',
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('정보를 불러오지 못했어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('다시 시도가 성공하면 병원 정보를 렌더하고 에러를 치운다', async () => {
    const target = baseHospital();
    const spy = vi
      .spyOn(hospitalApi, 'fetchHospitalById')
      .mockRejectedValueOnce(
        new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '연결에 문제가 있어요. 잠시 후 다시 시도해주세요' })
      )
      .mockResolvedValueOnce(target);
    // 병원이 뜨면 상세 화면이 전문의·후기를 따로 조회한다. 스파이하지 않으면 실제 HTTP 로 나가
    // 실패한 시점에 따라 그 영역의 `alert` 가 하나 둘 더 생긴다 — 아래 "에러를 치운다" 단언이
    // 실행 순서에 따라 깨지던 원인이다 (다섯 번 중 두 번 실패).
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    vi.spyOn(reviewApi, 'fetchHospitalReviews').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(screen.getByText(target.name)).toBeInTheDocument());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('businessHours/features 가 없는 병원도 폴백 문구로 렌더한다', async () => {
    const base = baseHospital();
    // 목 데이터 백필이 끝나지 않은 레코드를 재현한다 — 타입상 필수지만 실제로는 빠질 수 있다.
    const partial = {
      ...base,
      businessHours: undefined,
      features: undefined,
      isOneDay: false,
      directions: '',
    } as unknown as Hospital;
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(partial);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${base.id}`,
      path: '/hospital/:id',
    });

    await waitFor(() => expect(screen.getByText('등록된 진료시간 정보가 없어요')).toBeInTheDocument());
    expect(screen.getByText('등록된 병원 특징이 없어요')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('대표 시술을 대분류별로 묶어 보여준다 — 라벨 아래에 세부 시술 이름', async () => {
    // `cavity` 는 화면에서 "레진", `implant` 는 "일반 임플란트" 다 (서버 이름과 다르다).
    const target = baseHospital({ procedureIds: ['resin', 'implant-general'] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await openTab('시술·가격');

    await waitFor(() => expect(screen.getByText('대표 시술')).toBeInTheDocument());
    // 대분류 라벨은 `CATEGORIES` 순서대로 — 임플란트가 충치치료보다 먼저다.
    expect(screen.getByText('충치치료')).toBeInTheDocument();
    expect(screen.getByText('레진')).toBeInTheDocument();
    expect(screen.getByText('일반 임플란트')).toBeInTheDocument();
  });

  it('시술이 하나도 없는 병원은 대표 시술 자리에 안내 문구를 보여준다', async () => {
    const target = baseHospital({ procedureIds: [] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await openTab('시술·가격');

    await waitFor(() => expect(screen.getByText('등록된 시술 정보가 없어요')).toBeInTheDocument());
  });

  /**
   * 서버가 taxonomy 가 모르는 시술만 내려주는 경우(백엔드가 시술을 추가했는데 프론트 분류가
   * 아직 못 따라간 상태). 그릴 그룹이 하나도 없으니 빈 목록과 **같은** 안내를 보여야 한다 —
   * 라벨 없는 빈 상자가 남으면 "대표 시술" 제목만 덩그러니 뜬다.
   */
  it('모르는 시술 id 만 있는 병원도 같은 안내 문구를 보여준다', async () => {
    const target = baseHospital({ procedureIds: ['future-id' as never] });
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(target);

    renderWithProviders(<HospitalDetailPage />, {
      route: `/hospital/${target.id}`,
      path: '/hospital/:id',
    });

    await openTab('시술·가격');

    await waitFor(() => expect(screen.getByText('등록된 시술 정보가 없어요')).toBeInTheDocument());
  });
});

/**
 * 섹션 탭과 문의 섹션 (요청서 `2026-10-12-03`, 2026-10-23 시안 B 로 목차 → 탭).
 *
 * 공개 Q/A 는 로컬 저장소(`lib/localCollection.ts`)의 `inquiries` 컬렉션에서 온다 —
 * api 를 목하지 않고 실제로 저장해, **공개 판정(환자 공개 + 병원 공개 + 답변완료)** 이
 * 테스트에서 사라지지 않게 한다.
 */
describe('HospitalDetailPage — 섹션 탭과 문의 섹션', () => {
  const TAB_LABELS = ['정보', '시술·가격', '의료진', '후기·문의'];

  function seedInquiries(rows: Partial<StoredHospitalInquiry>[]): void {
    writeCollection(
      'inquiries',
      rows.map((row, index) => ({
        id: `hi${index + 1}`,
        hospitalId: 'h1',
        hospitalName: '강남 스마일 치과',
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

  function answered(answeredAt: string, content = '답변드립니다', isPublic = true) {
    return { content, isPublic, answeredAt };
  }

  /** 문의는 `후기·문의` 탭 안에 있다 — 그 탭을 연 상태로 시작한다. */
  async function renderDetail() {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    vi.spyOn(reviewApi, 'fetchHospitalReviews').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    renderWithProviders(
      <>
        <RouterBridge />
        <HospitalDetailPage />
      </>,
      { route: '/hospital/h1', path: '/hospital/:id' }
    );

    await screen.findByRole('tablist', { name: '병원 정보' });
    await openTab('후기·문의');
  }

  beforeEach(() => {
    writeCollection('inquiries', []);
    useAuthStore.setState({ user: null, status: 'ready' });
    // jsdom 에는 scrollIntoView 가 없다 — 목차가 실제로 그것을 부르는지 본다.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ user: null, status: 'ready' });
    });
    vi.restoreAllMocks();
  });

  it('탭 4개가 순서대로 있고, 한 번에 한 섹션만 보인다', async () => {
    await renderDetail();

    const tablist = screen.getByRole('tablist', { name: '병원 정보' });
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(TAB_LABELS);

    // `후기·문의` 가 열려 있으니 `정보` 탭의 내용은 화면에 없다.
    expect(screen.getByRole('heading', { name: /방문자 후기/ })).toBeInTheDocument();
    expect(screen.queryByText('병원 소개')).not.toBeInTheDocument();

    await openTab('정보');

    expect(screen.getByText('병원 소개')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /방문자 후기/ })).not.toBeInTheDocument();
  });

  it('열린 탭만 aria-selected 이고, 패널이 그 탭을 가리킨다', async () => {
    await renderDetail();

    const selected = screen.getByRole('tab', { name: '후기·문의' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '정보' })).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', selected.id);
    expect(selected).toHaveAttribute('aria-controls', panel.id);
    // 닫힌 탭의 패널은 그려지지 않는다 — 없는 id 를 가리키지 않게 비워 둔다.
    expect(screen.getByRole('tab', { name: '정보' })).not.toHaveAttribute('aria-controls');
  });

  it('탭 줄은 Tab 키 한 번에 지나간다 — 열린 탭만 tabIndex 0 이다', async () => {
    await renderDetail();

    expect(screen.getByRole('tab', { name: '후기·문의' })).toHaveAttribute('tabindex', '0');
    for (const name of ['정보', '시술·가격', '의료진']) {
      expect(screen.getByRole('tab', { name })).toHaveAttribute('tabindex', '-1');
    }

    await openTab('정보');

    expect(screen.getByRole('tab', { name: '정보' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: '후기·문의' })).toHaveAttribute('tabindex', '-1');
  });

  it('키보드 ←/→/Home/End 로 탭을 옮기면 그 탭이 바로 열리고 포커스가 따라간다', async () => {
    await renderDetail();

    await userEvent.click(screen.getByRole('tab', { name: '정보' }));
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: '시술·가격' })).toHaveFocus();
    expect(screen.getByText('대표 시술')).toBeInTheDocument();

    await userEvent.keyboard('{End}');

    expect(screen.getByRole('tab', { name: '후기·문의' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: /방문자 후기/ })).toBeInTheDocument();

    // 오른쪽 끝에서 한 번 더 가면 처음으로 돈다.
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '정보' })).toHaveFocus();

    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: '후기·문의' })).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: '정보' })).toHaveFocus();
    expect(screen.getByText('병원 소개')).toBeInTheDocument();
  });

  it('공개 + 병원 공개 + 답변완료 인 문의만 Q/A 로 보이고 작성자 이름은 어디에도 없다', async () => {
    seedInquiries([
      { id: 'hi-visible', content: '토요일에도 진료하나요?', answer: answered('2026-10-08T00:00:00.000Z', '토요일은 2시까지 진료합니다') },
      { id: 'hi-waiting', content: '주차 되나요?' },
      { id: 'hi-answer-private', content: '교정 비용은요?', answer: answered('2026-10-09T00:00:00.000Z', '내원 상담을 권해드려요', false) },
      { id: 'hi-asked-private', content: '비공개로 물었어요', isPublic: false, answer: answered('2026-10-10T00:00:00.000Z') },
    ]);

    await renderDetail();

    expect(await screen.findByText('토요일에도 진료하나요?')).toBeInTheDocument();
    expect(screen.getByText('토요일은 2시까지 진료합니다')).toBeInTheDocument();
    expect(screen.queryByText('주차 되나요?')).not.toBeInTheDocument();
    expect(screen.queryByText('교정 비용은요?')).not.toBeInTheDocument();
    expect(screen.queryByText('비공개로 물었어요')).not.toBeInTheDocument();
    expect(screen.queryByText('김*준')).not.toBeInTheDocument();
    expect(screen.queryByText('김민준')).not.toBeInTheDocument();
  });

  it('헤딩에 공개 문의 수와 답변 수를 적는다 — 모집단이 다른 두 숫자다', async () => {
    seedInquiries([
      { answer: answered('2026-10-08T00:00:00.000Z') },
      {},
      { answer: answered('2026-10-09T00:00:00.000Z', '답변드립니다', false) },
      { isPublic: false, answer: answered('2026-10-10T00:00:00.000Z') },
      { answer: answered('2026-10-11T00:00:00.000Z') },
    ]);

    await renderDetail();

    // 공개로 남긴 문의 4건(미답변 포함) 중 실제로 보이는 Q/A 는 2건이다.
    expect(await screen.findByRole('heading', { name: '문의 4건 · 답변 2' })).toBeInTheDocument();
  });

  it('공개된 문의가 없으면 숫자 없이 빈 문구를 보여준다', async () => {
    await renderDetail();

    expect(await screen.findByText('아직 공개된 문의가 없어요')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '문의 0건 · 답변 0' })).toBeInTheDocument();
  });

  it('기본 3건만 보여주고 더보기로 나머지를 펼친다', async () => {
    seedInquiries([
      { content: '질문 하나', answer: answered('2026-10-05T00:00:00.000Z') },
      { content: '질문 둘', answer: answered('2026-10-06T00:00:00.000Z') },
      { content: '질문 셋', answer: answered('2026-10-07T00:00:00.000Z') },
      { content: '질문 넷', answer: answered('2026-10-08T00:00:00.000Z') },
    ]);

    await renderDetail();

    // 답변 최신순이라 가장 늦게 답한 셋이 먼저 보인다.
    expect(await screen.findByText('질문 넷')).toBeInTheDocument();
    expect(screen.queryByText('질문 하나')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '문의 더보기 (1)' }));

    expect(await screen.findByText('질문 하나')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /문의 더보기/ })).not.toBeInTheDocument();
  });

  it('마이페이지에서 `?section=inquiry` 로 들어오면 위쪽 영역이 도착한 뒤에 문의 섹션으로 내려간다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    // 후기를 붙잡아 둔다 — 도착 전에 움직이면 늦게 그려진 후기만큼 문의 섹션이 화면 아래로 밀린다
    // (2026-10-12 QA: 마운트 직후 이동해서 문의 섹션이 화면 아래 1000px 넘게 남았다).
    let releaseReviews: () => void = () => {};
    vi.spyOn(reviewApi, 'fetchHospitalReviews').mockReturnValue(
      new Promise((resolve) => {
        releaseReviews = () => resolve({ items: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
      })
    );

    renderWithProviders(
      <>
        <RouterBridge />
        <HospitalDetailPage />
      </>,
      { route: '/hospital/h1?section=inquiry', path: '/hospital/:id' }
    );

    await screen.findByRole('tablist', { name: '병원 정보' });
    // 문의가 있는 탭에서 시작한다 — 탭이 닫혀 있으면 내려갈 섹션 자체가 없다.
    expect(screen.getByRole('tab', { name: '후기·문의' })).toHaveAttribute('aria-selected', 'true');
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

    act(() => releaseReviews());

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1));
    expect(document.getElementById('hospital-inquiry-h')).toHaveFocus();
  });

  it('비로그인으로 문의하기를 누르면 돌아올 곳을 들고 로그인으로 보낸다', async () => {
    const pushSpy = vi.spyOn(router, 'push');
    await renderDetail();

    await userEvent.click(screen.getByRole('button', { name: '문의하기' }));

    expect(pushSpy).toHaveBeenCalledWith({
      pathname: '/auth/login',
      params: { redirect: '/inquiry/h1' },
    });
  });

  it('로그인했으면 문의 작성 화면으로 보낸다', async () => {
    useAuthStore.setState({
      user: {
        id: 'u-me',
        email: 'me@molarmolar.example',
        name: '김민준',
        provider: 'email',
        role: 'user',
        managedHospitalIds: [],
      },
      status: 'ready',
    });
    const pushSpy = vi.spyOn(router, 'push');
    await renderDetail();

    await userEvent.click(screen.getByRole('button', { name: '문의하기' }));

    expect(pushSpy).toHaveBeenCalledWith('/inquiry/h1');
  });
});

/**
 * 사진 아래 요약 카드 2×2 (2026-10-23 시안 B-1).
 *
 * `진료중` 경계값 자체는 순수 함수 테스트(`lib/businessHours.test.ts`)가 고정한다 —
 * 여기서는 **그 결과가 카드에 어떻게 보이는지**만 본다.
 */
describe('HospitalDetailPage — 요약 카드', () => {
  function doctor(overrides: Partial<Doctor> = {}): Doctor {
    return {
      id: 'd1',
      name: '김하늘',
      title: '대표원장',
      hospitalId: 'h1',
      photo: 'https://example.com/photo.jpg',
      procedureIds: [],
      rating: 4.9,
      reviewCount: 10,
      consultCount: 3,
      certificateUrl: null,
      verificationStatus: 'approved',
      rejectionReason: null,
      isRecommended: false,
      yearsOfExperience: 15,
      career: [],
      visibleSpecialty: '치과보철전문의',
      isVerifiedSpecialist: true,
      ...overrides,
    };
  }

  async function renderWith(hospital: Hospital, doctors: Doctor[] = [doctor()]) {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(hospital);
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue(doctors);
    vi.spyOn(reviewApi, 'fetchHospitalReviews').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });

    renderWithProviders(<HospitalDetailPage />, { route: '/hospital/h1', path: '/hospital/:id' });

    await screen.findByRole('tablist', { name: '병원 정보' });
  }

  beforeEach(() => {
    // 서울 금요일 10:00. 기계의 시간대와 무관하게 같은 답이 나와야 한다.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-23T01:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('진료 시간 안이면 오늘 시간과 진료중 배지를 보여준다', async () => {
    await renderWith(
      baseHospital({
        businessHours: [{ day: '금', hours: '10:00 - 19:00' }],
        priceRange: { min: 900000, max: 1800000 },
        rating: 4.8,
        reviewCount: 312,
      })
    );

    expect(screen.getByText('오늘 (금)')).toBeInTheDocument();
    expect(await screen.findByText('진료중')).toBeInTheDocument();
    expect(screen.getByText('900,000원 ~ 1,800,000원')).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('후기 312개')).toBeInTheDocument();
    expect(await screen.findByText('전문의 1명')).toBeInTheDocument();
    expect(screen.getByText('치과보철전문의')).toBeInTheDocument();
  });

  it('진료가 끝난 뒤에는 진료 종료로 적는다', async () => {
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z')); // 서울 금요일 19:00 — 종료 정각

    await renderWith(baseHospital({ businessHours: [{ day: '금', hours: '10:00 - 19:00' }] }));

    expect(await screen.findByText('진료 종료')).toBeInTheDocument();
    expect(screen.queryByText('진료중')).not.toBeInTheDocument();
  });

  it('진료시간 문자열을 읽지 못하면 배지를 숨긴다 — 열렸는지 닫혔는지 단정하지 않는다', async () => {
    await renderWith(baseHospital({ businessHours: [{ day: '금', hours: '예약제로 운영해요' }] }));

    // 요약 카드와 아래 `진료시간` 줄 두 곳에 같은 문자열이 그대로 보인다.
    expect(screen.getAllByText('예약제로 운영해요')).toHaveLength(2);
    expect(screen.queryByText('진료중')).not.toBeInTheDocument();
    expect(screen.queryByText('진료 종료')).not.toBeInTheDocument();
  });

  it('값이 없는 칸은 빈 상태 문구를 적는다', async () => {
    await renderWith(baseHospital({ businessHours: [], reviewCount: 0, rating: 0 }), []);

    expect(screen.getByText('등록된 진료시간이 없어요')).toBeInTheDocument();
    expect(screen.getByText('아직 후기가 없어요')).toBeInTheDocument();
    expect(await screen.findByText('등록된 의료진이 없어요')).toBeInTheDocument();
  });

  it('다른 탭에서는 요약이 한 줄로 접힌다', async () => {
    await renderWith(baseHospital({ businessHours: [{ day: '금', hours: '10:00 - 19:00' }] }));

    await userEvent.click(screen.getByRole('tab', { name: '의료진' }));

    expect(screen.getByText('진료중 · 19시까지')).toBeInTheDocument();
    expect(screen.queryByText('오늘 (금)')).not.toBeInTheDocument();
  });

  it('의료진 칸은 불러오는 중과 실패를 다르게 적는다 — "없다" 고 단정하지 않는다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(reviewApi, 'fetchHospitalReviews').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
    // 끝나지 않는 조회 — 목록이 아직 도착하지 않은 상태를 고정한다.
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<HospitalDetailPage />, { route: '/hospital/h1', path: '/hospital/:id' });

    await screen.findByRole('tablist', { name: '병원 정보' });
    expect(screen.getByText('불러오는 중이에요')).toBeInTheDocument();
    expect(screen.queryByText('등록된 의료진이 없어요')).not.toBeInTheDocument();
  });

  it('의료진 조회가 실패하면 요약 칸에 불러오지 못했다고 적는다', async () => {
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(reviewApi, 'fetchHospitalReviews').mockResolvedValue({
      items: [],
      meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
    });
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '연결에 문제가 있어요' })
    );

    renderWithProviders(<HospitalDetailPage />, { route: '/hospital/h1', path: '/hospital/:id' });

    expect(await screen.findByText('불러오지 못했어요')).toBeInTheDocument();
    expect(screen.queryByText('등록된 의료진이 없어요')).not.toBeInTheDocument();
  });

  it('하단 고정 바에는 찜과 병원 상담신청만 있다', async () => {
    await renderWith(baseHospital());

    expect(await screen.findByText('병원 상담신청')).toBeInTheDocument();
    // 시안 B — 어느 전문의인지 보내지 못하던 `전문의 상담신청` 은 뺐다.
    expect(screen.queryByText('전문의 상담신청')).not.toBeInTheDocument();
  });

  it('상담을 받지 않는 병원은 상담 마감으로 바뀐다', async () => {
    await renderWith(baseHospital({ consultAvailable: false }));

    expect(await screen.findByText('상담 마감')).toBeInTheDocument();
    expect(screen.queryByText('병원 상담신청')).not.toBeInTheDocument();
  });
});
