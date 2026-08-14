import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { ApiError } from '@/lib/apiClient';
import { procedures } from '@/mocks/fixtures/procedures';
import { router, RouterBridge } from '@/navigation';
import AdminHospitalEditPage from '@/pages/admin/AdminHospitalEditPage';
import { useAuthStore } from '@/store/useAuthStore';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital, User } from '@/types/domain';

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

  it('★ 함정1 — 자격증을 건드리지 않고 저장하면 PUT 본문에 그 전문의의 certificateUrl 키가 없다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([baseDoctor()]);
    vi.spyOn(hospitalApi, 'updateHospital').mockResolvedValue(baseHospital());
    const replaceSpy = vi.spyOn(doctorApi, 'replaceHospitalDoctors').mockResolvedValue([]);

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledTimes(1));
    const [, doctors] = replaceSpy.mock.calls[0];
    expect('certificateUrl' in doctors[0]).toBe(false);
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
    const replaceSpy = vi.spyOn(doctorApi, 'replaceHospitalDoctors');

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    await waitFor(() => expect(screen.getByText('수정할 수 없는 항목이에요')).toBeInTheDocument());
    // 병원 저장이 실패했으니 전문의 PUT 은 아예 시도하지 않는다.
    expect(replaceSpy).not.toHaveBeenCalled();
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
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(String(alertSpy.mock.calls[0][0])).toContain('담당하지 않는 병원이에요');
  });

  it('병원 저장은 성공하고 전문의 저장만 실패하면 알리고 화면에 남는다 (조용히 절반만 저장되지 않는다)', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    vi.spyOn(hospitalApi, 'updateHospital').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'replaceHospitalDoctors').mockRejectedValue(
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: '일시적인 문제가 발생했어요' })
    );
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const backSpy = vi.spyOn(router, 'back');

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(String(alertSpy.mock.calls[0][0])).toContain('전문의 정보는 저장하지 못했어요');
    expect(backSpy).not.toHaveBeenCalled();
  });

  it('둘 다 성공하면 이전 화면으로 돌아간다', async () => {
    useAuthStore.setState({ user: userWithRole('operator'), status: 'ready' });
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'fetchHospitalDoctors').mockResolvedValue([]);
    vi.spyOn(hospitalApi, 'updateHospital').mockResolvedValue(baseHospital());
    vi.spyOn(doctorApi, 'replaceHospitalDoctors').mockResolvedValue([]);
    const backSpy = vi.spyOn(router, 'back');

    renderPage();

    await waitFor(() => expect(screen.getByDisplayValue('강남 스마일 치과')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    await waitFor(() => expect(backSpy).toHaveBeenCalledTimes(1));
  });
});
