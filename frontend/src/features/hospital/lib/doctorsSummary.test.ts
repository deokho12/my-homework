import { describe, expect, it } from 'vitest';

import { summarizeDoctors } from '@/features/hospital/lib/doctorsSummary';
import type { Doctor } from '@/types/domain';

function doctor(overrides: Partial<Doctor> = {}): Doctor {
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

describe('summarizeDoctors — 요약 카드의 의료진 한 줄', () => {
  it('등록된 의료진이 없으면 적을 것이 없다', () => {
    expect(summarizeDoctors([])).toEqual({ headline: null, specialties: null });
  });

  it('인증된 전문의 수와 전공을 적는다', () => {
    const summary = summarizeDoctors([
      doctor({ id: 'd1', visibleSpecialty: '치과보철전문의' }),
      doctor({ id: 'd2', visibleSpecialty: '치과교정전문의' }),
    ]);

    expect(summary).toEqual({ headline: '전문의 2명', specialties: '치과보철전문의 · 치과교정전문의' });
  });

  it('같은 전공은 한 번만 적는다', () => {
    expect(
      summarizeDoctors([
        doctor({ id: 'd1', visibleSpecialty: '치과보철전문의' }),
        doctor({ id: 'd2', visibleSpecialty: '치과보철전문의' }),
      ])
    ).toEqual({ headline: '전문의 2명', specialties: '치과보철전문의' });
  });

  it('인증 전문의가 없으면 전체 인원만 적는다 — 전문의라고 부르지 않는다', () => {
    expect(
      summarizeDoctors([
        doctor({ id: 'd1', isVerifiedSpecialist: false, visibleSpecialty: '일반의' }),
        doctor({ id: 'd2', isVerifiedSpecialist: false, visibleSpecialty: null }),
      ])
    ).toEqual({ headline: '의료진 2명', specialties: null });
  });

  it('전문의 수는 인증된 사람만 센다', () => {
    expect(
      summarizeDoctors([
        doctor({ id: 'd1' }),
        doctor({ id: 'd2', isVerifiedSpecialist: false, visibleSpecialty: '일반의' }),
      ])
    ).toEqual({ headline: '전문의 1명', specialties: '치과보철전문의' });
  });

  it('전공이 비어 있는 전문의만 있으면 전공 줄은 비운다', () => {
    expect(summarizeDoctors([doctor({ visibleSpecialty: null })])).toEqual({
      headline: '전문의 1명',
      specialties: null,
    });
  });
});
