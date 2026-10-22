import { describe, expect, it } from 'vitest';

import {
  adminConsultNotificationText,
  consultNotificationText,
  formatVisitAt,
  withSubjectParticle,
} from '../src/consult/notification-text';

/**
 * 알림 문구 — **순수 함수**다. 계약(`AppNotification.title`/`message` 의 표)이 문장을 그대로
 * 적어 두었고, 이미 나간 알림은 소급 수정되지 않으므로 **문장이 곧 명세**다.
 *
 * 프런트의 `features/consult/consultNotificationText.ts` 와 같은 답이어야 한다 (그쪽 동기화
 * 테스트가 이 파일을 상대 경로로 읽는다). 요청서 15 이후 **문구를 만드는 곳은 서버 하나**다.
 */

const HOSPITAL = '강남 스마일 치과';
const VISIT = '2026-10-09T05:00:00.000Z';

describe('consultNotificationText — 상태별 환자 문구 (요청 08)', () => {
  it('예약확정', () => {
    expect(
      consultNotificationText({
        event: 'status_change',
        status: 'booked',
        visitAt: VISIT,
        cancelReason: null,
        hospitalName: HOSPITAL,
      }),
    ).toEqual({
      title: '상담 예약이 확정됐어요',
      message: '강남 스마일 치과 · 10/9(금) 14:00 방문. 변경이 필요하면 병원에 전화해 주세요',
    });
  });

  it('★ 일시 변경은 제목만 다르고 본문은 같다', () => {
    const rescheduled = consultNotificationText({
      event: 'reschedule',
      status: 'booked',
      visitAt: VISIT,
      cancelReason: null,
      hospitalName: HOSPITAL,
    });

    expect(rescheduled.title).toBe('예약 일시가 바뀌었어요');
    expect(rescheduled.message).toBe(
      '강남 스마일 치과 · 10/9(금) 14:00 방문. 변경이 필요하면 병원에 전화해 주세요',
    );
  });

  it('★ 예약확정인데 일시를 읽을 수 없으면 날짜를 지어내지 않는다', () => {
    expect(
      consultNotificationText({
        event: 'status_change',
        status: 'booked',
        visitAt: null,
        cancelReason: null,
        hospitalName: HOSPITAL,
      }).message,
    ).toBe('강남 스마일 치과 · 방문 일시는 병원에서 다시 알려드려요');
  });

  it('연락중 — 조사는 받침 판정이 정한다', () => {
    expect(
      consultNotificationText({
        event: 'status_change',
        status: 'contacted',
        visitAt: null,
        cancelReason: null,
        hospitalName: HOSPITAL,
      }),
    ).toEqual({
      title: '병원이 연락 중이에요',
      // 끝 글자 `과` 에 받침이 없어 `가` 다 (`이(가)` 로 고정하지 않는 이유).
      message: '강남 스마일 치과가 상담 신청을 확인했어요. 곧 전화가 올 거예요',
    });
  });

  it('취소 — 사유마다 환자용 꼬리말이 다르고 관리자 라벨을 쓰지 않는다', () => {
    const tails = {
      no_answer: '연락이 닿지 않아 취소됐어요',
      patient_request: '요청하신 대로 취소했어요',
      procedure_unavailable: '이 병원에서 진료하지 않는 시술이에요',
      duplicate: '같은 신청이 있어 하나로 정리했어요',
      etc: '자세한 사유는 병원에 문의해 주세요',
    } as const;

    for (const [reason, tail] of Object.entries(tails)) {
      const text = consultNotificationText({
        event: 'status_change',
        status: 'cancelled',
        visitAt: null,
        cancelReason: reason as keyof typeof tails,
        hospitalName: HOSPITAL,
      });

      expect(text.title).toBe('상담이 취소됐어요');
      expect(text.message).toBe(`강남 스마일 치과 · ${tail}`);
      // 관리자 select 의 라벨은 환자에게 나가지 않는다.
      expect(text.message).not.toContain('연락이 안 됨');
      expect(text.message).not.toContain('중복 신청');
    }
  });

  it('★ 사유가 없으면 기타와 같은 한 줄이다 (enum 방어)', () => {
    expect(
      consultNotificationText({
        event: 'status_change',
        status: 'cancelled',
        visitAt: null,
        cancelReason: null,
        hospitalName: HOSPITAL,
      }).message,
    ).toBe('강남 스마일 치과 · 자세한 사유는 병원에 문의해 주세요');
  });

  it('★ 내원완료·되돌림은 기존 문구를 유지한다 — 요청서가 그 두 문장을 적지 않았다', () => {
    expect(
      consultNotificationText({
        event: 'status_change',
        status: 'visited',
        visitAt: VISIT,
        cancelReason: null,
        hospitalName: HOSPITAL,
      }),
    ).toEqual({ title: '상담 상태 변경', message: "상담 상태가 '내원완료'(으)로 변경되었어요" });

    expect(
      consultNotificationText({
        event: 'status_change',
        status: 'new',
        visitAt: null,
        cancelReason: null,
        hospitalName: HOSPITAL,
      }).message,
    ).toBe("상담 상태가 '신규'(으)로 변경되었어요");
  });

  it('병원 이름이 없거나 공백뿐이면 `병원` 이다', () => {
    for (const name of [null, '', '   ']) {
      expect(
        consultNotificationText({
          event: 'status_change',
          status: 'cancelled',
          visitAt: null,
          cancelReason: 'etc',
          hospitalName: name,
        }).message,
      ).toBe('병원 · 자세한 사유는 병원에 문의해 주세요');
    }
  });
});

describe('adminConsultNotificationText — 접수 알림', () => {
  it('계약의 문구 그대로이고 **이름을 마스킹하지 않는다** (수신자가 담당자뿐이다)', () => {
    expect(adminConsultNotificationText('박서영')).toEqual({
      title: '새로운 상담 신청',
      message: '박서영님이 상담을 신청했어요',
    });
  });
});

describe('formatVisitAt — 표기는 `10/9(금) 14:00` 하나다', () => {
  it('UTC 를 KST 로 바꿔 적는다', () => {
    expect(formatVisitAt('2026-10-09T05:00:00.000Z')).toBe('10/9(금) 14:00');
  });

  it('★ 자정은 24:00 이 아니라 00:00 이다', () => {
    expect(formatVisitAt('2026-10-08T15:00:00.000Z')).toBe('10/9(금) 00:00');
  });

  it('읽을 수 없으면 null 이다', () => {
    expect(formatVisitAt(null)).toBeNull();
    expect(formatVisitAt('언젠가')).toBeNull();
  });
});

describe('withSubjectParticle — 받침 판정', () => {
  it('받침이 없으면 가, 있으면 이', () => {
    expect(withSubjectParticle('강남 스마일 치과')).toBe('강남 스마일 치과가');
    expect(withSubjectParticle('○○치과의원')).toBe('○○치과의원이');
    expect(withSubjectParticle('병원')).toBe('병원이');
  });

  it('★ 끝 글자가 한글이 아니면 이(가) 다 — 읽는 법이 사람마다 갈린다', () => {
    expect(withSubjectParticle('Smile Dental')).toBe('Smile Dental이(가)');
    expect(withSubjectParticle('치과101')).toBe('치과101이(가)');
  });
});
