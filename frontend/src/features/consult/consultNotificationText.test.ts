import { describe, expect, it } from 'vitest';

import {
  consultNotificationText,
  type ConsultNotificationInput,
} from '@/features/consult/consultNotificationText';
import type { ConsultCancelReason } from '@/types/domain';

/** 2026-10-09 14:00 (Asia/Seoul). */
const VISIT_AT = '2026-10-09T05:00:00.000Z';

function input(overrides: Partial<ConsultNotificationInput> = {}): ConsultNotificationInput {
  return {
    event: 'status_change',
    status: 'booked',
    visitAt: VISIT_AT,
    cancelReason: null,
    hospitalName: '강남 스마일 치과',
    ...overrides,
  };
}

describe('consultNotificationText — 상태별 문구 (명세 §4.1)', () => {
  it('예약확정은 병원·일시·전화 안내 한 줄이다', () => {
    expect(consultNotificationText(input())).toEqual({
      title: '상담 예약이 확정됐어요',
      message: '강남 스마일 치과 · 10/9(금) 14:00 방문. 변경이 필요하면 병원에 전화해 주세요',
    });
  });

  it('예약확정인데 일시를 읽을 수 없으면 날짜를 지어내지 않는다', () => {
    expect(consultNotificationText(input({ visitAt: null }))).toEqual({
      title: '상담 예약이 확정됐어요',
      message: '강남 스마일 치과 · 방문 일시는 병원에서 다시 알려드려요',
    });
    expect(consultNotificationText(input({ visitAt: 'not-a-date' })).message).toBe(
      '강남 스마일 치과 · 방문 일시는 병원에서 다시 알려드려요'
    );
  });

  it('예약 일시 변경은 제목만 다르고 본문 형식은 예약확정과 같다', () => {
    expect(consultNotificationText(input({ event: 'reschedule', visitAt: '2026-10-10T06:00:00.000Z' }))).toEqual({
      title: '예약 일시가 바뀌었어요',
      message: '강남 스마일 치과 · 10/10(토) 15:00 방문. 변경이 필요하면 병원에 전화해 주세요',
    });
  });

  it('연락중은 병원 이름에 받침에 맞는 조사를 붙인다', () => {
    expect(consultNotificationText(input({ status: 'contacted' }))).toEqual({
      title: '병원이 연락 중이에요',
      message: '강남 스마일 치과가 상담 신청을 확인했어요. 곧 전화가 올 거예요',
    });
    expect(consultNotificationText(input({ status: 'contacted', hospitalName: '○○치과의원' })).message).toBe(
      '○○치과의원이 상담 신청을 확인했어요. 곧 전화가 올 거예요'
    );
  });

  const cancelled: [ConsultCancelReason | null, string][] = [
    ['no_answer', '강남 스마일 치과 · 연락이 닿지 않아 취소됐어요'],
    ['patient_request', '강남 스마일 치과 · 요청하신 대로 취소했어요'],
    ['procedure_unavailable', '강남 스마일 치과 · 이 병원에서 진료하지 않는 시술이에요'],
    ['duplicate', '강남 스마일 치과 · 같은 신청이 있어 하나로 정리했어요'],
    ['etc', '강남 스마일 치과 · 자세한 사유는 병원에 문의해 주세요'],
    // 사유가 없거나 우리가 모르는 코드여도 같은 한 줄로 떨어진다 (계약 §15 의 enum 방어).
    [null, '강남 스마일 치과 · 자세한 사유는 병원에 문의해 주세요'],
  ];

  it.each(cancelled)('취소 사유 %s 는 환자 말로 적는다', (cancelReason, message) => {
    expect(consultNotificationText(input({ status: 'cancelled', cancelReason }))).toEqual({
      title: '상담이 취소됐어요',
      message,
    });
  });

  it('모르는 취소 사유 코드도 기타와 같은 줄로 떨어진다', () => {
    expect(
      consultNotificationText(input({ status: 'cancelled', cancelReason: 'bogus' as ConsultCancelReason })).message
    ).toBe('강남 스마일 치과 · 자세한 사유는 병원에 문의해 주세요');
  });

  it('관리자 용어와 사유 코드 원문은 환자 문구에 나오지 않는다', () => {
    for (const cancelReason of ['no_answer', 'patient_request', 'procedure_unavailable', 'duplicate', 'etc'] as const) {
      const { title, message } = consultNotificationText(input({ status: 'cancelled', cancelReason }));
      const text = `${title} ${message}`;

      expect(text).not.toMatch(/상태|전이|처리|_/);
      // 관리자 라벨(`연락이 안 됨`·`환자 요청`...)을 그대로 쓰지 않는다 — 두 독자의 문장이다.
      expect(text).not.toMatch(/연락이 안 됨|환자 요청|진료 불가 시술|중복 신청|기타/);
    }
  });

  it('내원완료·신규는 지금 문구를 그대로 둔다 (요청서 범위 밖)', () => {
    expect(consultNotificationText(input({ status: 'visited', visitAt: null }))).toEqual({
      title: '상담 상태 변경',
      message: "상담 상태가 '내원완료'(으)로 변경되었어요",
    });
    expect(consultNotificationText(input({ status: 'new', visitAt: null }))).toEqual({
      title: '상담 상태 변경',
      message: "상담 상태가 '신규'(으)로 변경되었어요",
    });
  });
});

describe('consultNotificationText — 병원 이름 폴백', () => {
  it.each([null, '', '   '])('이름이 %o 면 `병원` 으로 적는다 — 빈 자리를 남기지 않는다', (hospitalName) => {
    const { message } = consultNotificationText(input({ hospitalName }));

    expect(message).toBe('병원 · 10/9(금) 14:00 방문. 변경이 필요하면 병원에 전화해 주세요');
    expect(message).not.toMatch(/undefined|null|· ·/);
  });

  it('폴백 이름에도 조사가 맞는다', () => {
    expect(consultNotificationText(input({ status: 'contacted', hospitalName: null })).message).toBe(
      '병원이 상담 신청을 확인했어요. 곧 전화가 올 거예요'
    );
  });
});
