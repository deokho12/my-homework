import { describe, expect, it } from 'vitest';

import {
  CONSULT_DELAY_MS,
  CONSULT_STATUS_TONE,
  consultHistoryLine,
  consultProcedureLabel,
  consultScheduleLine,
  consultVisitLine,
  formatAppliedAt,
  formatDateTimeShort,
  formatVisitAt,
  formatVisitAtLong,
  isConsultDelayed,
  todayInSeoul,
  toVisitAtInputs,
  visitAtFromInputs,
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
      // 예정된 방문이 있다는 뜻의 brand 를 내원완료에 주지 않는다 — 마이페이지가 같은 표를 쓴다.
      visited: 'neutral',
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

describe('formatDateTimeShort', () => {
  it('`M/D HH:MM` 로 적는다 (Asia/Seoul)', () => {
    expect(formatDateTimeShort('2026-10-07T09:20:00Z')).toBe('10/7 18:20');
  });

  it('자정은 24시가 아니라 00시다', () => {
    expect(formatDateTimeShort('2026-10-06T15:30:00Z')).toBe('10/7 00:30');
  });

  it('파싱할 수 없으면 null', () => {
    expect(formatDateTimeShort('어제')).toBeNull();
    expect(formatDateTimeShort(null)).toBeNull();
  });
});

describe('formatVisitAtLong — 환자 알림 문구', () => {
  it('`M월 D일(요일) HH:MM` 로 적는다', () => {
    expect(formatVisitAtLong('2026-10-08T05:00:00Z')).toBe('10월 8일(목) 14:00');
  });
});

describe('todayInSeoul', () => {
  it('기기 시계가 아니라 서울 달력의 오늘이다 (`<input type="date" min>`)', () => {
    // UTC 로는 10/12 이지만 서울에서는 이미 10/13 이다.
    expect(todayInSeoul(new Date('2026-10-12T15:30:00.000Z'))).toBe('2026-10-13');
  });
});

describe('consultVisitLine — 관리자 카드의 네 번째 줄', () => {
  it('확정 일시가 있으면 강조해 보여준다', () => {
    expect(consultVisitLine({ preferredTime: '평일 오후', visitAt: '2026-10-08T05:00:00Z' })).toEqual({
      text: '10/8(목) 14:00 방문',
      emphasized: true,
    });
  });

  it('없으면 희망 연락 시간을 보조 문구로 보여준다', () => {
    expect(consultVisitLine({ preferredTime: '평일 오후', visitAt: null })).toEqual({
      text: '평일 오후 연락 희망',
      emphasized: false,
    });
  });

  it('둘 다 없으면 null — 줄을 그리지 않는다', () => {
    expect(consultVisitLine({ preferredTime: '', visitAt: null })).toBeNull();
  });
});

describe('isConsultDelayed — 신규 24시간', () => {
  const createdAt = '2026-10-07T00:00:00.000Z';

  it('신규로 24시간이 지나면 지연이다 (경계 포함)', () => {
    const exactly24h = new Date('2026-10-08T00:00:00.000Z').getTime();

    expect(isConsultDelayed({ status: 'new', createdAt }, exactly24h - 1)).toBe(false);
    expect(isConsultDelayed({ status: 'new', createdAt }, exactly24h)).toBe(true);
    expect(CONSULT_DELAY_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('신규가 아니면 아무리 오래돼도 지연이 아니다', () => {
    const muchLater = new Date('2026-11-01T00:00:00.000Z').getTime();

    expect(isConsultDelayed({ status: 'contacted', createdAt }, muchLater)).toBe(false);
    expect(isConsultDelayed({ status: 'cancelled', createdAt }, muchLater)).toBe(false);
  });

  it('접수 시각을 읽을 수 없으면 지연이라고 말하지 않는다', () => {
    expect(isConsultDelayed({ status: 'new', createdAt: '언젠가' }, Date.now())).toBe(false);
  });
});

describe('consultHistoryLine', () => {
  it('접수 행은 행위자도 알림도 없다', () => {
    expect(
      consultHistoryLine({ event: 'status_change', status: 'new', changedAt: '2026-10-07T02:30:00Z' })
    ).toBe('10/7 11:30 앱에서 상담 신청');
  });

  it('예약확정은 그때의 확정 일시를 함께 적는다', () => {
    expect(
      consultHistoryLine({
        event: 'status_change',
        status: 'booked',
        changedAt: '2026-10-07T04:00:00Z',
        changedByName: '김민관',
        visitAt: '2026-10-09T05:00:00Z',
        notified: true,
      })
    ).toBe('10/7 13:00 예약확정 10/9(금) 14:00 · 김민관 · 환자 알림 발송');
  });

  it('일시 변경은 상태 이름 대신 `일시 변경` 이다', () => {
    expect(
      consultHistoryLine({
        event: 'reschedule',
        status: 'booked',
        changedAt: '2026-10-08T00:10:00Z',
        changedByName: '김민관',
        visitAt: '2026-10-10T02:00:00Z',
        notified: true,
      })
    ).toBe('10/8 09:10 일시 변경 10/10(토) 11:00 · 김민관 · 환자 알림 발송');
  });

  it('알림이 나가지 않은 변경에는 발송 문구를 붙이지 않는다 — 저장된 사실만 말한다', () => {
    expect(
      consultHistoryLine({
        event: 'status_change',
        status: 'visited',
        changedAt: '2026-10-09T06:02:00Z',
        changedByName: '김민관',
        notified: false,
      })
    ).toBe('10/9 15:02 내원완료 · 김민관');
  });

  it('취소는 사유를 함께 적는다', () => {
    expect(
      consultHistoryLine({
        event: 'status_change',
        status: 'cancelled',
        changedAt: '2026-10-07T00:00:00Z',
        changedByName: '김민관',
        cancelReason: 'no_answer',
        notified: true,
      })
    ).toBe('10/7 09:00 취소 · 연락이 안 됨 · 김민관 · 환자 알림 발송');
  });

  it('모르는 상태 코드는 죽지 않고 원문을 그대로 보여준다', () => {
    expect(
      consultHistoryLine({
        event: 'status_change',
        status: 'rescheduled_by_patient' as never,
        changedAt: '2026-10-07T00:00:00Z',
        changedByName: '김민관',
      })
    ).toBe('10/7 09:00 rescheduled_by_patient · 김민관');
  });
});

describe('확정 일시 ↔ 폼의 두 칸', () => {
  it('저장값(UTC)을 서울 달력의 날짜·시간으로 쪼갠다', () => {
    expect(toVisitAtInputs('2026-10-08T05:00:00.000Z')).toEqual({ date: '2026-10-08', time: '14:00' });
    // 서울에서는 이미 다음 날이다.
    expect(toVisitAtInputs('2026-10-08T15:30:00.000Z')).toEqual({ date: '2026-10-09', time: '00:30' });
  });

  it('비어 있거나 읽을 수 없으면 빈 칸이다 — 틀린 값을 미리 채우지 않는다', () => {
    expect(toVisitAtInputs(null)).toEqual({ date: '', time: '' });
    expect(toVisitAtInputs('내일')).toEqual({ date: '', time: '' });
  });

  it('두 칸이 다 차야 저장값이 된다', () => {
    expect(visitAtFromInputs('2026-10-08', '14:00')).toBe('2026-10-08T05:00:00.000Z');
    expect(visitAtFromInputs('2026-10-08', '')).toBeNull();
    expect(visitAtFromInputs('', '14:00')).toBeNull();
  });
});
