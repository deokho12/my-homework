import { formatVisitAt } from '@/features/consult/consultDisplay';
import { withSubjectParticle } from '@/lib/josa';
import {
  CONSULT_STATUS_LABEL,
  type ConsultCancelReason,
  type ConsultEvent,
  type ConsultStatus,
} from '@/types/domain';

/**
 * 상담 상태 변경 한 건을 **환자가 받을 알림 문구로 바꾸는 순수 모듈**. React 도 DB 도
 * 요청도 모른다 (`consultDisplay.ts` 와 같은 규약).
 *
 * **문구를 만드는 곳은 여기 하나다.** 지금 호출부는 `updateConsultStatus` 의 알림 생성
 * 직전 한 줄뿐이고, 서버가 알림을 만들게 되면 이 파일이 통째로
 * `backend/src/consult/consult-notification.text.ts` 로 간다 — 그때 바뀌는 것은 import
 * 경로다. 문구가 두 곳에서 만들어지는 상태를 만들지 않는다.
 *
 * 화면은 **저장된 문자열을 그대로 그린다.** 알림을 그릴 때 이 함수를 다시 부르지 않는다 —
 * 보낸 문구는 기록이라, 병원이 개명하거나 문장을 다듬어도 과거 알림이 바뀌면 안 된다.
 */

export interface ConsultNotificationInput {
  /** `reschedule` 은 상태가 그대로이고 일시만 바뀐 이벤트다 (`lib/transition.ts`). */
  event: ConsultEvent;
  /** **바뀐 뒤의** 상태. 알림 행의 `consultStatus` 로도 저장된다. */
  status: ConsultStatus;
  visitAt: string | null;
  cancelReason: ConsultCancelReason | null;
  /** 없거나 빈 문자열이면 `병원`. */
  hospitalName: string | null;
}

export interface ConsultNotificationText {
  title: string;
  message: string;
}

/** 병원 이름을 알 수 없을 때. `inquiryApi` 의 `?? '병원'` 과 같은 말을 쓴다. */
const FALLBACK_HOSPITAL_NAME = '병원';

/**
 * 취소 사유 → 환자에게 보이는 꼬리말.
 *
 * `CONSULT_CANCEL_REASON_LABEL`(관리자 select 의 라벨)을 **쓰지 않는다.** 같은 코드의 두
 * 독자용 문장이라, 한쪽을 다듬어도 다른 쪽이 흔들리면 안 된다 — 관리자는 사유를 고르고,
 * 환자는 사정을 듣는다.
 */
const CANCEL_TAIL: Record<ConsultCancelReason, string> = {
  no_answer: '연락이 닿지 않아 취소됐어요',
  patient_request: '요청하신 대로 취소했어요',
  procedure_unavailable: '이 병원에서 진료하지 않는 시술이에요',
  duplicate: '같은 신청이 있어 하나로 정리했어요',
  etc: '자세한 사유는 병원에 문의해 주세요',
};

/** 사유가 없거나 우리가 모르는 코드일 때도 `기타` 와 같은 한 줄이다 (계약 §15 enum 방어). */
const CANCEL_TAIL_FALLBACK = CANCEL_TAIL.etc;

export function consultNotificationText({
  event,
  status,
  visitAt,
  cancelReason,
  hospitalName,
}: ConsultNotificationInput): ConsultNotificationText {
  const hospital = (hospitalName ?? '').trim() || FALLBACK_HOSPITAL_NAME;

  if (event === 'reschedule') {
    return { title: '예약 일시가 바뀌었어요', message: visitMessage(hospital, visitAt) };
  }

  switch (status) {
    case 'booked':
      return { title: '상담 예약이 확정됐어요', message: visitMessage(hospital, visitAt) };

    case 'contacted':
      return {
        title: '병원이 연락 중이에요',
        message: `${withSubjectParticle(hospital)} 상담 신청을 확인했어요. 곧 전화가 올 거예요`,
      };

    case 'cancelled':
      return {
        title: '상담이 취소됐어요',
        message: `${hospital} · ${(cancelReason && CANCEL_TAIL[cancelReason]) || CANCEL_TAIL_FALLBACK}`,
      };

    // 내원완료·신규는 요청서 08 의 범위 밖이라 지금 문구를 그대로 둔다 (2026-10-13 결정).
    default:
      return {
        title: '상담 상태 변경',
        message: `상담 상태가 '${CONSULT_STATUS_LABEL[status]}'(으)로 변경되었어요`,
      };
  }
}

/**
 * 꼭 필요한 정보(병원 · 일시)를 앞에, 꼬리말을 뒤에 둔다 — 알림함 본문이 3줄에서 잘려도
 * 잘리는 쪽이 꼬리말이 되도록 설계한 순서다 (명세 §2.4).
 */
function visitMessage(hospital: string, visitAt: string | null): string {
  const visit = formatVisitAt(visitAt);

  return visit
    ? `${hospital} · ${visit} 방문. 변경이 필요하면 병원에 전화해 주세요`
    : // 읽을 수 없는 일시로 날짜를 지어내지 않는다.
      `${hospital} · 방문 일시는 병원에서 다시 알려드려요`;
}
