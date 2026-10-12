import { describe, expect, it } from 'vitest';

import { INQUIRY_STATUS_TONE, formatInquiryAt, inquiryTitle } from '@/features/inquiry/inquiryDisplay';

describe('INQUIRY_STATUS_TONE', () => {
  it('미답변은 info, 답변완료는 brand — 환자 화면과 관리자 화면이 같은 색표를 쓴다', () => {
    expect(INQUIRY_STATUS_TONE.unanswered).toBe('info');
    expect(INQUIRY_STATUS_TONE.answered).toBe('brand');
  });
});

describe('inquiryTitle — 저장되지 않는 제목을 본문에서 만든다', () => {
  it('첫 줄만 쓴다', () => {
    expect(inquiryTitle('임플란트 비용이 궁금해요\n뼈이식도 필요할까요?')).toBe('임플란트 비용이 궁금해요');
  });

  it('앞뒤 공백을 떼고, 40자를 넘으면 잘라 … 를 붙인다', () => {
    const long = 'ㄱ'.repeat(45);

    expect(inquiryTitle(`  ${long}  `)).toBe(`${'ㄱ'.repeat(40)}…`);
  });

  it('정확히 40자면 자르지 않는다', () => {
    const exact = 'ㄱ'.repeat(40);

    expect(inquiryTitle(exact)).toBe(exact);
  });

  it('빈 본문은 빈 문자열이다 — 제목을 지어내지 않는다', () => {
    expect(inquiryTitle('\n  \n')).toBe('');
  });
});

describe('formatInquiryAt — 관리자 목록·상세의 절대 시각', () => {
  it('기기 시계가 아니라 Asia/Seoul 달력으로 10/7 18:20 처럼 적는다', () => {
    // 09:20 UTC = 18:20 Asia/Seoul
    expect(formatInquiryAt('2026-10-07T09:20:00.000Z')).toBe('10/7 18:20');
  });

  it('자정은 24:00 이 아니라 00:00 이다', () => {
    expect(formatInquiryAt('2026-10-07T15:00:00.000Z')).toBe('10/8 00:00');
  });

  it('읽을 수 없는 값은 null — 빈 칸을 지어내지 않는다', () => {
    expect(formatInquiryAt('어제')).toBeNull();
    expect(formatInquiryAt(null)).toBeNull();
  });
});
