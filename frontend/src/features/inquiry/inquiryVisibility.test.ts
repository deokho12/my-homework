import { describe, expect, it } from 'vitest';

import { inquiryStatus, isPubliclyVisible } from '@/features/inquiry/inquiryVisibility';

function inquiry(overrides: {
  isPublic?: boolean;
  answer?: { isPublic: boolean; answeredAt: string } | null;
} = {}) {
  return {
    isPublic: true,
    answer: null as { isPublic: boolean; answeredAt: string } | null,
    ...overrides,
  };
}

describe('inquiryStatus', () => {
  it('답변이 없으면 unanswered 다', () => {
    expect(inquiryStatus(inquiry())).toBe('unanswered');
  });

  it('답변 시각이 있으면 answered 다 (저장된 컬럼이 아니라 파생값)', () => {
    expect(
      inquiryStatus(inquiry({ answer: { isPublic: true, answeredAt: '2026-10-12T06:10:00.000Z' } }))
    ).toBe('answered');
  });
});

describe('isPubliclyVisible — 세 조건의 AND', () => {
  it('환자 공개 + 병원 공개 + 답변완료 면 보인다', () => {
    expect(
      isPubliclyVisible(inquiry({ isPublic: true, answer: { isPublic: true, answeredAt: '2026-10-12T06:10:00.000Z' } }))
    ).toBe(true);
  });

  it('환자가 비공개로 남겼으면 병원이 공개로 답해도 보이지 않는다', () => {
    expect(
      isPubliclyVisible(inquiry({ isPublic: false, answer: { isPublic: true, answeredAt: '2026-10-12T06:10:00.000Z' } }))
    ).toBe(false);
  });

  it('병원이 비공개로 답했으면 보이지 않는다', () => {
    expect(
      isPubliclyVisible(inquiry({ isPublic: true, answer: { isPublic: false, answeredAt: '2026-10-12T06:10:00.000Z' } }))
    ).toBe(false);
  });

  it('아직 답변이 없으면 둘 다 공개여도 보이지 않는다', () => {
    expect(isPubliclyVisible(inquiry({ isPublic: true, answer: null }))).toBe(false);
  });
});
