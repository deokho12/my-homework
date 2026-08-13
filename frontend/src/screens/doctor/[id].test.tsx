import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as doctorApi from '@/features/doctor/api/doctorApi';
import * as hospitalApi from '@/features/hospital/api/hospitalApi';
import { ApiError } from '@/lib/apiClient';
import DoctorDetailScreen from '@/screens/doctor/[id]';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital } from '@/types/domain';

/**
 * `useDoctor`/`useHospital` 은 이제 HTTP 를 부른다 — 목 백엔드를 거치지 않으므로 매 테스트가
 * `doctorApi.fetchDoctorById`/`hospitalApi.fetchHospitalById` 를 직접 스파이한다
 * (`HospitalDetailPage.test.tsx` 와 같은 방식).
 */
function baseDoctor(overrides: Partial<Doctor> = {}): Doctor {
  return {
    id: 'd1',
    name: '김민준',
    title: '대표원장',
    hospitalId: 'h1',
    photo: 'https://example.com/photo.jpg',
    procedureIds: [],
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

function baseHospital(overrides: Partial<Hospital> = {}): Hospital {
  return {
    id: 'h1',
    name: '강남 스마일 치과',
    specialty: '치과보철전문의',
    region: '서울 강남구',
    latitude: 37.5,
    longitude: 127.0,
    thumbnail: 'https://example.com/thumb.jpg',
    images: [],
    procedureIds: [],
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
    address: '서울 강남구 어딘가',
    introduction: '',
    events: [],
    sponsorship: { isActive: false, isPlacementEligible: false },
    representativeSpecialty: null,
    ...overrides,
  };
}

describe('DoctorDetailScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * F1 회귀 고정: `useHospital(doctor?.hospitalId)` 는 전문의가 로드된 뒤 시작하는 비동기
   * 조회다 — 병원이 아직 안 왔다고 해서 "없다"는 뜻이 아니다. 로딩 중에 "소속 병원 정보를
   * 찾을 수 없어요" 를 보여주거나 상담 버튼에 "상담 마감" 이라고 단정하면 안 된다.
   */
  it('소속 병원이 로딩 중이면 "찾을 수 없어요" 를 보여주지 않고 상담 버튼도 "마감" 이라고 주장하지 않는다', async () => {
    vi.spyOn(doctorApi, 'fetchDoctorById').mockResolvedValue(baseDoctor());
    // 응답이 오지 않은 상태를 고정한다 — resolve/reject 하지 않는 프라미스.
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockReturnValue(new Promise(() => {}));

    renderWithProviders(<DoctorDetailScreen />, { route: '/doctor/d1', path: '/doctor/:id' });

    await waitFor(() => expect(screen.getByText('김민준 대표원장')).toBeInTheDocument());

    expect(screen.queryByText('소속 병원 정보를 찾을 수 없어요')).not.toBeInTheDocument();
    expect(screen.queryByText('상담 마감')).not.toBeInTheDocument();
  });

  it('소속 병원 조회가 끝난 뒤에도 정말 없으면 그때는 "찾을 수 없어요" 를 보여준다', async () => {
    vi.spyOn(doctorApi, 'fetchDoctorById').mockResolvedValue(baseDoctor());
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockRejectedValue(
      new ApiError({ status: 404, code: 'HOSPITAL_NOT_FOUND', message: '병원 정보를 찾을 수 없어요' })
    );

    renderWithProviders(<DoctorDetailScreen />, { route: '/doctor/d1', path: '/doctor/:id' });

    await waitFor(() => expect(screen.getByText('소속 병원 정보를 찾을 수 없어요')).toBeInTheDocument());
    expect(screen.getByText('상담 마감')).toBeInTheDocument();
  });

  it('소속 병원이 로드되면 상담 가능 여부에 따라 버튼 문구를 보여준다', async () => {
    vi.spyOn(doctorApi, 'fetchDoctorById').mockResolvedValue(baseDoctor());
    vi.spyOn(hospitalApi, 'fetchHospitalById').mockResolvedValue(baseHospital({ consultAvailable: true }));

    renderWithProviders(<DoctorDetailScreen />, { route: '/doctor/d1', path: '/doctor/:id' });

    await waitFor(() => expect(screen.getByText('강남 스마일 치과')).toBeInTheDocument());
    expect(screen.getByText('상담 신청')).toBeInTheDocument();
    expect(screen.queryByText('상담 마감')).not.toBeInTheDocument();
  });
});
