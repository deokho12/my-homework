import { describe, expect, it } from 'vitest';

import { projectDoctorAdmin, projectDoctorPublic } from '../src/doctor/doctor.projection';
import type { DoctorRow } from '../src/doctor/doctor.projection';

function row(overrides: Partial<DoctorRow> = {}): DoctorRow {
  return {
    id: 'd1',
    hospitalId: 'h1',
    name: '김치과',
    nameNormalized: '김치과',
    title: '원장',
    specialty: '치과보철전문의',
    verifiedSpecialty: '치과보철전문의',
    verificationStatus: 'approved',
    certificateUrl: 'https://example.test/cert.pdf',
    rejectionReason: null,
    photo: 'https://example.test/photo.jpg',
    rating: 4.7,
    reviewCount: 180,
    consultCount: 90,
    yearsOfExperience: 15,
    isRecommended: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    procedures: [{ procedureId: 'implant' }],
    careers: [{ content: '서울대 치의학 박사', sortOrder: 0 }],
    ...overrides,
  } as DoctorRow;
}

describe('projectDoctorPublic', () => {
  it('승인된 전공은 specialty 와 visibleSpecialty 를 모두 싣는다', () => {
    const result = projectDoctorPublic(row(), { authenticated: true });

    expect(result.specialty).toBe('치과보철전문의');
    expect(result.visibleSpecialty).toBe('치과보철전문의');
    expect(result.isVerifiedSpecialist).toBe(true);
  });

  it('검수 대기 중이면 specialty 원본을 응답에서 뺀다', () => {
    const result = projectDoctorPublic(row({ verificationStatus: 'pending', verifiedSpecialty: null }), {
      authenticated: true,
    });

    expect(result).not.toHaveProperty('specialty');
    expect(result.visibleSpecialty).toBeNull();
    expect(result.isVerifiedSpecialist).toBe(false);
  });

  it('반려된 전공도 응답에서 뺀다', () => {
    const result = projectDoctorPublic(
      row({ verificationStatus: 'rejected', verifiedSpecialty: null, rejectionReason: '자격증 불명확' }),
      { authenticated: true }
    );

    expect(result).not.toHaveProperty('specialty');
    expect(result.visibleSpecialty).toBeNull();
  });

  it('일반의는 검수 대상이 아니라 항상 표시된다', () => {
    const result = projectDoctorPublic(
      row({ specialty: '일반의', verifiedSpecialty: null, verificationStatus: 'pending' }),
      { authenticated: true }
    );

    expect(result.specialty).toBe('일반의');
    expect(result.visibleSpecialty).toBe('일반의');
    expect(result.isVerifiedSpecialist).toBe(false);
  });

  it('승인 후 전공이 바뀌면 배지를 잃는다 (verifiedSpecialty 불일치)', () => {
    const result = projectDoctorPublic(
      row({ specialty: '치과교정전문의', verifiedSpecialty: '치과보철전문의' }),
      { authenticated: true }
    );

    expect(result.isVerifiedSpecialist).toBe(false);
    expect(result.visibleSpecialty).toBeNull();
  });

  it('비로그인은 rating 이 null 이고 reviewCount 는 그대로다', () => {
    const result = projectDoctorPublic(row(), { authenticated: false });

    expect(result.rating).toBeNull();
    expect(result.reviewCount).toBe(180);
  });

  it('자격증 URL 과 반려 사유를 절대 담지 않는다', () => {
    const result = projectDoctorPublic(row({ rejectionReason: '흐릿함' }), { authenticated: true });

    expect(result).not.toHaveProperty('certificateUrl');
    expect(result).not.toHaveProperty('rejectionReason');
  });

  it('경력을 sortOrder 순 문자열 배열로 되돌린다', () => {
    const result = projectDoctorPublic(
      row({ careers: [{ content: '두번째', sortOrder: 1 }, { content: '첫번째', sortOrder: 0 }] }),
      { authenticated: true }
    );

    expect(result.career).toEqual(['첫번째', '두번째']);
  });
});

describe('projectDoctorAdmin', () => {
  it('자격증 URL 과 반려 사유를 담는다', () => {
    const result = projectDoctorAdmin(row({ rejectionReason: '흐릿함' }));

    expect(result.certificateUrl).toBe('https://example.test/cert.pdf');
    expect(result.rejectionReason).toBe('흐릿함');
  });

  it('검수 화면은 미승인 전공도 그대로 본다', () => {
    const result = projectDoctorAdmin(row({ verificationStatus: 'pending', verifiedSpecialty: null }));

    expect(result.specialty).toBe('치과보철전문의');
  });

  it('rating 을 잠그지 않는다', () => {
    expect(projectDoctorAdmin(row()).rating).toBe(4.7);
  });
});
