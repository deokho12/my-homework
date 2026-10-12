import { describe, expect, it } from 'vitest';

import {
  CONSULT_STATUS_TONE,
  consultProcedureLabel,
  consultScheduleLine,
  formatAppliedAt,
  formatVisitAt,
} from '@/features/consult/consultDisplay';
import { CONSULT_STATUSES } from '@/types/domain';

describe('CONSULT_STATUS_TONE', () => {
  it('모든 상태에 톤이 있다', () => {
    for (const status of CONSULT_STATUSES) {
      expect(CONSULT_STATUS_TONE[status]).toBeTruthy();
    }
  });

  it('진행 단계를 색으로도 구분한다 — 마이페이지와 관리자 목록이 같은 표를 쓴다', () => {
    expect(CONSULT_STATUS_TONE).toEqual({
      new: 'info',
      contacted: 'warning',
      booked: 'brand',
      cancelled: 'neutral',
    });
  });
});

describe('consultProcedureLabel', () => {
  it('아는 시술 id 는 `{대분류} · {세부시술}` 로 적는다', () => {
    expect(consultProcedureLabel('cavity')).toBe('충치치료 · 레진');
    expect(consultProcedureLabel('implant')).toBe('임플란트 · 일반 임플란트');
  });

  it('고르지 않은 상담(null)은 `시술 미지정`', () => {
    expect(consultProcedureLabel(null)).toBe('시술 미지정');
  });

  it('taxonomy 가 모르는 id 는 null — 줄을 그리지 않는다 ("미지정"이라 적으면 거짓말)', () => {
    expect(consultProcedureLabel('made-up-procedure' as never)).toBeNull();
  });
});

describe('formatAppliedAt', () => {
  it('`M/D` 로 적는다 (연도 없음)', () => {
    expect(formatAppliedAt('2026-10-09T05:00:00Z')).toBe('10/9');
  });

  it('Asia/Seoul 달력으로 판정한다 — UTC 로는 전날인 시각도 한국 날짜로 적는다', () => {
    expect(formatAppliedAt('2026-10-06T15:30:00Z')).toBe('10/7');
  });

  it('파싱할 수 없으면 null', () => {
    expect(formatAppliedAt('어제')).toBeNull();
    expect(formatAppliedAt('')).toBeNull();
    expect(formatAppliedAt(null)).toBeNull();
  });
});

describe('formatVisitAt', () => {
  it('`M/D(요일) HH:MM` 로 적는다 — 호출부가 " 방문" 을 붙인다', () => {
    expect(formatVisitAt('2026-10-08T05:00:00Z')).toBe('10/8(목) 14:00');
  });

  it('자정은 24시가 아니라 00시다', () => {
    expect(formatVisitAt('2026-10-06T15:30:00Z')).toBe('10/7(수) 00:30');
  });

  it('파싱할 수 없으면 null', () => {
    expect(formatVisitAt('내일 2시')).toBeNull();
    expect(formatVisitAt(null)).toBeNull();
  });
});

describe('consultScheduleLine', () => {
  it('확정 방문 일시가 있으면 그것을 강조해 보여준다', () => {
    expect(
      consultScheduleLine({
        createdAt: '2026-10-06T15:30:00Z',
        preferredTime: '평일 저녁',
        visitAt: '2026-10-08T05:00:00Z',
      })
    ).toEqual({ text: '10/8(목) 14:00 방문', emphasized: true });
  });

  it('확정 일시가 없으면 신청일과 희망 연락 시간을 보조 문구로 보여준다', () => {
    expect(
      consultScheduleLine({
        createdAt: '2026-10-06T15:30:00Z',
        preferredTime: '평일 저녁',
        visitAt: null,
      })
    ).toEqual({ text: '10/7 신청 · 평일 저녁 연락 희망', emphasized: false });
  });

  it('희망 연락 시간이 비어 있으면(예전 데이터) 신청일만 적는다', () => {
    expect(
      consultScheduleLine({ createdAt: '2026-10-06T15:30:00Z', preferredTime: '', visitAt: null })
    ).toEqual({ text: '10/7 신청', emphasized: false });
  });

  it('읽을 수 있는 값이 하나도 없으면 null — 줄을 그리지 않는다', () => {
    expect(consultScheduleLine({ createdAt: '언젠가', preferredTime: '', visitAt: null })).toBeNull();
  });

  it('방문 일시를 읽을 수 없으면 보조 문구로 떨어진다', () => {
    expect(
      consultScheduleLine({
        createdAt: '2026-10-06T15:30:00Z',
        preferredTime: '주말',
        visitAt: '확정되면 연락',
      })
    ).toEqual({ text: '10/7 신청 · 주말 연락 희망', emphasized: false });
  });
});
