import { describe, expect, it } from 'vitest';

import { hasSpecialistBadge } from '../src/doctor/specialty-badge';

describe('hasSpecialistBadge', () => {
  it('승인 + 검증된 전공이 일치하면 true', () => {
    expect(
      hasSpecialistBadge({
        specialty: '치과보철전문의',
        verifiedSpecialty: '치과보철전문의',
        verificationStatus: 'approved',
      })
    ).toBe(true);
  });

  it('미승인이면 false', () => {
    expect(
      hasSpecialistBadge({
        specialty: '치과보철전문의',
        verifiedSpecialty: '치과보철전문의',
        verificationStatus: 'pending',
      })
    ).toBe(false);
  });

  it('일반의면 false', () => {
    expect(
      hasSpecialistBadge({
        specialty: '일반의',
        verifiedSpecialty: '일반의',
        verificationStatus: 'approved',
      })
    ).toBe(false);
  });

  it('승인됐지만 verifiedSpecialty 가 현재 specialty 와 다르면 false', () => {
    expect(
      hasSpecialistBadge({
        specialty: '치과교정전문의',
        verifiedSpecialty: '치과보철전문의',
        verificationStatus: 'approved',
      })
    ).toBe(false);
  });
});
