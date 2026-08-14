import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HospitalForm } from '@/components/admin/HospitalForm';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import * as geocoding from '@/services/geocoding';
import { procedures } from '@/mocks/fixtures/procedures';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor, Hospital } from '@/types/domain';

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

describe('HospitalForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('★ 함정1 — 자격증 칸을 건드리지 않고 저장하면 그 전문의의 certificateUrl 키가 빠진다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    const onSubmit = vi.fn();

    renderWithProviders(
      <HospitalForm
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        submitLabel="저장하기"
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [, doctors] = onSubmit.mock.calls[0];
    expect(doctors).toHaveLength(1);
    expect('certificateUrl' in doctors[0]).toBe(false);
  });

  it('자격증 칸에 실제로 입력하면 certificateUrl 이 그 값으로 실린다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    const onSubmit = vi.fn();

    renderWithProviders(
      <HospitalForm
        initial={baseHospital()}
        doctors={[baseDoctor()]}
        canEditRecommended={false}
        submitLabel="저장하기"
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    await userEvent.type(
      screen.getByPlaceholderText('자격증/인증서 이미지 URL'),
      'https://example.com/cert.png'
    );
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    const [, doctors] = onSubmit.mock.calls[0];
    expect(doctors[0].certificateUrl).toBe('https://example.com/cert.png');
  });

  it('★ 함정2 — 전공이 감춰진(대기중) 전문의를 "일반의" 로 기본값 처리하지 않고 선택 전까지 저장을 막는다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    const onSubmit = vi.fn();

    renderWithProviders(
      <HospitalForm
        // specialty 가 없다 — 검수 대기 중이라 서버가 감춘 상태(공개 Doctor 계약)를 재현한다.
        initial={baseHospital()}
        doctors={[baseDoctor({ specialty: undefined, visibleSpecialty: null, isVerifiedSpecialist: false })]}
        canEditRecommended={false}
        submitLabel="저장하기"
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(screen.getByText('전문의 1')).toBeInTheDocument());
    expect(screen.getByText(/검수 대기 중이라 전공을 확인할 수 없어요/)).toBeInTheDocument();

    // 아무 전공 칩도 '일반의'로 미리 선택돼 있으면 안 된다.
    expect(screen.getByRole('button', { name: '일반의' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '저장하기' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('button', { name: '통합치의학과전문의' }));

    expect(screen.getByRole('button', { name: '저장하기' })).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: '저장하기' }));

    const [, doctors] = onSubmit.mock.calls[0];
    expect(doctors[0].specialty).toBe('통합치의학과전문의');
  });

  it('canEditRecommended=false 면 추천 병원 체크박스를 숨기고 현재 상태만 읽기 전용으로 보여준다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);

    renderWithProviders(
      <HospitalForm
        initial={baseHospital({ isRecommended: true })}
        doctors={[]}
        canEditRecommended={false}
        submitLabel="저장하기"
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText(/추천 병원 노출/)).toBeInTheDocument());
    expect(screen.queryByText('추천 병원으로 노출 (에디터 추천)')).not.toBeInTheDocument();
  });

  it('canEditRecommended=true 면 체크박스를 보여주고 켜면 isRecommended 를 함께 보낸다', async () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue(procedures);
    vi.spyOn(geocoding, 'searchAddress').mockResolvedValue([
      { id: 'a1', addressName: '서울 강남구 테스트로 1', latitude: 37.1, longitude: 127.1 },
    ]);
    const onSubmit = vi.fn();

    renderWithProviders(
      <HospitalForm canEditRecommended submitLabel="등록하기" onSubmit={onSubmit} />
    );

    await userEvent.type(screen.getByPlaceholderText('병원명을 입력해주세요'), '새 치과');
    await userEvent.type(screen.getByPlaceholderText('예: 서울 강남구'), '서울 강남구');
    await userEvent.type(screen.getByPlaceholderText('도로명 또는 지번 주소를 입력해주세요'), '테스트로');
    await waitFor(() => expect(screen.getByText('서울 강남구 테스트로 1')).toBeInTheDocument());
    await userEvent.click(screen.getByText('서울 강남구 테스트로 1'));
    await userEvent.click(screen.getByRole('button', { name: '임플란트' }));
    await userEvent.type(screen.getByPlaceholderText('최소'), '100000');
    await userEvent.type(screen.getByPlaceholderText('최대'), '200000');

    await userEvent.click(screen.getByText('추천 병원으로 노출 (에디터 추천)'));
    await userEvent.click(screen.getByRole('button', { name: '등록하기' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [data] = onSubmit.mock.calls[0];
    expect(data.isRecommended).toBe(true);
  });
});
