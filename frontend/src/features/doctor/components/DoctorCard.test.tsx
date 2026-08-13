import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DoctorCard } from '@/features/doctor/components/DoctorCard';
import * as procedureApi from '@/features/procedure/api/procedureApi';
import { renderWithProviders } from '@/test/renderWithProviders';
import type { Doctor } from '@/types/domain';

/**
 * `전문의` 배지·평점 잠금 판정이 **서버 필드를 그대로 신뢰**하는지 고정한다 — 이 컴포넌트가
 * `src/utils/specialty.ts` 를 다시 계산해 부르면 안 된다(승인 후 전공을 바꾼 전문의가
 * 재검수 없이 새 배지를 다는 결함의 화면 쪽 재발을 막는다).
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

describe('DoctorCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('서버가 isVerifiedSpecialist: true 를 주면 "전문의" 배지를 그린다', () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue([]);

    renderWithProviders(<DoctorCard doctor={baseDoctor()} />);

    expect(screen.getByText('전문의')).toBeInTheDocument();
    expect(screen.getByText('치과보철전문의')).toBeInTheDocument();
  });

  /**
   * 승인 후 전공을 바꾼 전문의: `verificationStatus` 는 여전히 'approved' 지만 서버는
   * `verifiedSpecialty !== specialty` 를 감지해 `isVerifiedSpecialist: false`,
   * `visibleSpecialty: null` 을 내려준다(계약). 컴포넌트는 이 필드를 그대로 따라야 한다 —
   * `verificationStatus === 'approved'` 만 보고 배지를 그리면 이 결함이 재발한다.
   */
  it('승인됐지만 verifiedSpecialty 와 다른 전문의는 배지·전공 어느 것도 그리지 않는다', () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue([]);

    renderWithProviders(
      baseDoctorCard({ verificationStatus: 'approved', isVerifiedSpecialist: false, visibleSpecialty: null })
    );

    expect(screen.queryByText('전문의')).not.toBeInTheDocument();
    expect(screen.queryByText('치과보철전문의')).not.toBeInTheDocument();
  });

  it('rating 이 null 이면(비로그인) 잠금 문구를 보여준다 — 0으로 덮지 않는다', () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue([]);

    renderWithProviders(<DoctorCard doctor={baseDoctor({ rating: null })} />);

    expect(screen.getByText('★ 비공개')).toBeInTheDocument();
  });

  it('rating 이 숫자면 그 숫자를 보여준다', () => {
    vi.spyOn(procedureApi, 'fetchProcedures').mockResolvedValue([]);

    renderWithProviders(<DoctorCard doctor={baseDoctor({ rating: 4.9 })} />);

    expect(screen.getByText('★ 4.9')).toBeInTheDocument();
  });

  function baseDoctorCard(overrides: Partial<Doctor>) {
    return <DoctorCard doctor={baseDoctor(overrides)} />;
  }
});
