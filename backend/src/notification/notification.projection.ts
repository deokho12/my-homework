/**
 * DB 행 → 계약 `AppNotification`.
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: ① `consultStatus` 를 **required + nullable** 로 더했다. ② `relatedResource`
 *  표에 `hospital_inquiry → hospitalInquiry` 를 더했다 — 계약의 값 집합과 맞춘다.)
 *
 * 읽음은 **알림이 아니라 수신자에 달려 있다** (`notification_recipients.read_at`).
 * 같은 알림을 담당자 셋이 받으면 각자 읽음 상태가 따로 간다. 그래서 이 투영은 알림 행
 * 하나가 아니라 **내 수신자 행 + 그 알림**을 받는다.
 */

/** `NOTIFICATION_RECIPIENT_INCLUDE` 로 조회한 결과의 모양. */
export interface NotificationRecipientRow {
  readAt: Date | null;
  notification: {
    id: string;
    audience: string;
    type: string;
    consultStatus: string | null;
    title: string;
    message: string;
    relatedType: string | null;
    relatedId: string | null;
    createdAt: Date;
  };
}

export interface AppNotificationResponse {
  id: string;
  audience: string;
  type: string;
  /**
   * 그 알림을 낳은 이벤트 **직후의 상담 상태**. `type='consult-status'` 가 아닌 알림과
   * 칸이 생기기 전의 행은 `null` 이다 — **키는 항상 있다** (계약 `required`).
   */
  consultStatus: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId: string | null;
  /**
   * `relatedId` 가 어떤 종류인지. **관리자 알림함의 이동 분기가 이 값이다** —
   * `type` 으로 가르면 접수 알림(`consult-status`)과 검수 결과 알림(`system`)이 같은
   * 알림함에 섞여 들어오는 것을 다룰 수 없다 (계약 2026-10-22).
   */
  relatedResource: string | null;
}

/** 리포지토리가 쓰는 include. 투영이 요구하는 것만 고른다. */
export const NOTIFICATION_RECIPIENT_INCLUDE = {
  notification: {
    select: {
      id: true,
      audience: true,
      type: true,
      consultStatus: true,
      title: true,
      message: true,
      relatedType: true,
      relatedId: true,
      createdAt: true,
    },
  },
} as const;

/**
 * DB 의 `related_type`(snake) → 계약의 `relatedResource`(camel).
 *
 * **DB 값을 그대로 흘리면 화면의 분기가 조용히 전부 거짓이 된다.** 지금까지 서버가 만들던
 * 유일한 알림(검수 결과)의 값이 `doctor` 라 두 표기가 우연히 같았고, 그래서 이 차이가 드러난
 * 적이 없다. 계약이 값 목록을 고정했으므로 **모르는 값은 `null` 로 떨어뜨린다** — 화면이
 * 모르는 값으로 라우팅을 시도하는 것보다 "이동 대상 없음" 이 낫다.
 */
const RELATED_RESOURCE_BY_TYPE: Record<string, string> = {
  consult_request: 'consultRequest',
  consultRequest: 'consultRequest',
  hospital: 'hospital',
  doctor: 'doctor',
  promotion: 'promotion',
  hospital_inquiry: 'hospitalInquiry',
  hospitalInquiry: 'hospitalInquiry',
};

export function projectNotification(row: NotificationRecipientRow): AppNotificationResponse {
  const { notification } = row;

  return {
    id: notification.id,
    audience: notification.audience,
    type: notification.type,
    consultStatus: notification.consultStatus,
    title: notification.title,
    message: notification.message,
    isRead: row.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
    relatedId: notification.relatedId,
    relatedResource:
      notification.relatedType === null
        ? null
        : (RELATED_RESOURCE_BY_TYPE[notification.relatedType] ?? null),
  };
}
