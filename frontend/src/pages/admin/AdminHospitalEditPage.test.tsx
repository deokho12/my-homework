import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { ApiError } from '@/lib/apiClient';
import { procedures } from '@/mocks/fixtures/procedures';
import { RouterBridge } from '@/navigation';
import AdminHospitalEditPage from '@/pages/admin/AdminHospitalEditPage';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, DoctorAdminView, Hospital, User } from '@/types/domain';

function userWithRole(role: 'hospital_admin' | 'operator'): User {
  return {
    id: `u-${role}`,
    email: `${role}@molarmolar.example`,
    name: '테스트',
    provider: 'email',
    role,
    managedHospitalIds: role === 'hospital_admin' ? ['h1'] : [],
  };
}

function baseHospital(overrides: Partial<Hospital> = {}): Hospital {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    specialty: '임플란트 전문의원',
    region: '서울 강남구',
    latitude: 37.5,
    longitude: 127.0,
    thumbnail: 'https://example.com/thumb.jpg',
    images: [],
    procedureIds: ['implant'],
    priceRange: { min: 100000, max: 200000 },
    rating: 4.8,
    reviewCount: 120,
    consultCount: 90,
    consultAvailable: true,
    businessHours: [],
    directions: '',
    features: {
      coordinator: false,
      painlessAnesthesia: false,
      digitalCare: false,
      parking: false,
      nightConsult: false,
      cctv: false,
    },
    isOneDay: false,
    isRecommended: false,
    isSponsored: false,
    sponsoredCategories: [],
    sponsoredRank: null,
    sponsoredStartDate: null,
    sponsoredEndDate: null,
    tags: [],
    address: '서울특별시 강남구 테헤란로 123',
    introduction: '',
    events: [],
    sponsorship: { isActive: false, isPlacementEligible: false },
    representativeSpecialty: null,
    ...overrides,
  };
}

function baseDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'd1',
    name: '김민준',
    title: '대표원장',
    specialty: '치과보철전문의',
    hospitalId: 'h1',
    photo: 'https://example.com/photo.jpg',
    procedureIds: ['implant'],
    rating: 4.9,
    reviewCount: 180,
    consultCount: 90,
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

/** `PATCH /doctors/:id` 응답 모킹용 — 관리자 시야는 `specialty` 가 항상 있다. */
function baseDoctorAdminView(overrides: Partial<DoctorAdminView> = {}): DoctorAdminView {
  return {
    ...baseDoctor(),
    specialty: '치과보철전문의',
    certificateUrl: null,
    rejectionReason: null,
    ...overrides,
  };
}

function renderPage() {
  return renderWithProviders(
    <>
      <RouterBridge />
      <AdminHospitalEditPage />
    </>,
    { route: '/admin/hospital/h1', path: '/admin/hospital/:id' }
  );
}

describe('AdminHospitalEditPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, status: 'ready' });
  });

  it('병원 또는 전문의 목록이 로딩 중이면 폼을 마운트하지 않는다 (빈 로스터로 초기화되는 사고 방지)', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    // 전문의 목록은 아직 응답하지 않는다.
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.queryByPlaceholderText('병원명을 입력해주세요')).not.toBeInTheDocument();
    expect(screen.queryByText('병원 정보를 찾을 수 없어요')).not.toBeInTheDocument();
  });

  /**
   * [Important 1 리뷰 수정] 미승인 전공의 전문의가 있어도 병원 필드 저장(PATCH)은 절대
   * 막히면 안 된다 — 로스터 PUT 은 시도조차 하지 않는다(독립된 액션이라 호출될 이유가 없다).
   */
  it('미승인 전공 전문의가 있어도 병원 필드만 수정해 저장하면 성공한다 (로스터 호출은 일어나지 않는다)', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([
      baseDoctor({ specialty: undefined, visibleSpecialty: null, isVerifiedSpecialist: false }),
    ]);
    const updateHospitalSpy = vi.spyOn(hospitalApi, 'updateHospital').mockResolvedValue(baseHospital());
    const replaceSpy = vi.spyOn(doctorApi, 'replaceHospitalDoctors');
    const updateDoctorSpy = vi.spyOn(doctorApi, 'updateDoctor');
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    const saveHospitalButton = screen.getByRole('button', { name: '병원 정보 저장' });
    expect(saveHospitalButton).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(saveHospitalButton);

    await waitFor(() => expect(updateHospitalSpy).toHaveBeenCalledTimes(1));
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(updateDoctorSpy).not.toHaveBeenCalled();
  });

  /**
   * [Important 1 리뷰 수정] 새 전문의 추가는 로스터 전체를 `PUT` 으로 다시 보내야 하고, 그
   * 요청은 모든 항목에 `specialty` 가 필수다 — 감춰진 전공이 있으면 그때만 막히고, 이유가
   * 화면에 드러나야 한다.
   */
  it('그 상태에서 새 전문의 추가만 막히고 이유가 표시된다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([
      baseDoctor({ specialty: undefined, visibleSpecialty: null, isVerifiedSpecialist: false }),
    ]);
    const replaceSpy = vi.spyOn(doctorApi, 'replaceHospitalDoctors');

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByText('+ 전문의 추가'));
    await userEvent.type(screen.getAllByPlaceholderText('이름')[1], '박서준');

    expect(
      screen.getByText(/검수 대기·반려 상태인 전문의가 있어 새 전문의를 추가할 수 없어요/)
    ).toBeInTheDocument();
    const saveRosterButton = screen.getByRole('button', { name: '전문의 정보 저장' });
    expect(saveRosterButton).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(saveRosterButton);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  /** [Important 1 리뷰 수정] 기존 전문의 변경은 `PATCH /doctors/:id` 로 가고, `specialty` 를 몰라도 된다. */
  it('기존 전문의 변경(신규 추가 없음)은 PATCH /doctors/:id 로 가고 본문에 specialty 가 없어도 된다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([
      baseDoctor({ specialty: undefined, visibleSpecialty: null, isVerifiedSpecialist: false }),
    ]);
    const updateDoctorSpy = vi.spyOn(doctorApi, 'updateDoctor').mockResolvedValue(baseDoctorAdminView());
    const replaceSpy = vi.spyOn(doctorApi, 'replaceHospitalDoctors');
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText('직함 (예: 대표원장)'), '2');
    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));

    await waitFor(() => expect(updateDoctorSpy).toHaveBeenCalledTimes(1));
    expect(replaceSpy).not.toHaveBeenCalled();
    const [, patch] = updateDoctorSpy.mock.calls[0];
    expect('specialty' in patch).toBe(false);
  });

  /**
   * ★ 함정1 — 새 경로(PATCH)에서도 지켜져야 한다: 자격증을 안 건드렸으면 PATCH 본문에도
   * `certificateUrl` 키가 없어야 한다.
   */
  it('★ 함정1 — 새 경로(PATCH)에서도 자격증을 안 건드리면 본문에 certificateUrl 키가 없다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([baseDoctor()]);
    const updateDoctorSpy = vi.spyOn(doctorApi, 'updateDoctor').mockResolvedValue(baseDoctorAdminView());
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.type(screen.getByPlaceholderText('직함 (예: 대표원장)'), '2');
    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));

    await waitFor(() => expect(updateDoctorSpy).toHaveBeenCalledTimes(1));
    const [, patch] = updateDoctorSpy.mock.calls[0];
    expect('certificateUrl' in patch).toBe(false);
  });

  it('422 FIELD_NOT_WRITABLE 은 해당 입력 칸(추천 병원) 아래에 표시된다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    vi.spyOn(hospitalApi, 'updateHospital').mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'FIELD_NOT_WRITABLE',
        message: '수정할 수 없는 항목이에요',
        details: [{ field: 'isRecommended', code: 'not_writable', message: '수정할 수 없는 항목이에요' }],
      })
    );

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '병원 정보 저장' }));

    await waitFor(() => expect(screen.getByText('수정할 수 없는 항목이에요')).toBeInTheDocument());
  });

  it('403 HOSPITAL_NOT_MANAGED 는 원인이 드러나는 문구로 알린다', async () => {
    useAuthStore.setState({ user: userWithRole('hospital_admin'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    vi.spyOn(hospitalApi, 'updateHospital').mockRejectedValue(
      new ApiError({ status: 403, code: 'HOSPITAL_NOT_MANAGED', message: '담당하지 않는 병원이에요' })
    );
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '병원 정보 저장' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(String(alertSpy.mock.calls[0][0])).toContain('담당하지 않는 병원이에요');
  });

  it('병원 정보 저장 성공은 화면에 그대로 남는다 (로스터를 이어서 저장할 수 있어야 한다)', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    vi.spyOn(hospitalApi, 'updateHospital').mockResolvedValue(baseHospital());
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '병원 정보 저장' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument();
  });

  /**
   * `patch` 경로는 전문의 수만큼 독립된 PATCH/DELETE 호출로 늘어난다. 하나가 실패해도
   * 나머지는 계속 시도하고(Promise.allSettled), 실패한 항목을 **이름으로** 짚어 알린다.
   */
  it('전문의 여러 명을 patch 로 저장할 때 한 명만 실패해도 그 이름을 짚어 알린다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([
      baseDoctor({ id: 'd1', name: '김민준' }),
      baseDoctor({ id: 'd2', name: '이서연', title: '부원장' }),
    ]);
    vi.spyOn(doctorApi, 'updateDoctor').mockImplementation(async (id) => {
      if (id === 'd2') throw new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: '일시적인 문제' });
      return baseDoctorAdminView({ id });
    });
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    renderPage();

    await waitFor(() => expect(screen.getAllByText(/전문의 \d/)).toHaveLength(2));
    const titleInputs = screen.getAllByPlaceholderText('직함 (예: 대표원장)');
    await userEvent.type(titleInputs[0], '!');
    await userEvent.type(titleInputs[1], '!');
    await userEvent.click(screen.getByRole('button', { name: '전문의 정보 저장' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const message = String(alertSpy.mock.calls[0][0]);
    expect(message).toContain('이서연');
  });
});
