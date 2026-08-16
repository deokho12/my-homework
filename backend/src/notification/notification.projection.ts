/**
 * DB 행 → 계약 `AppNotification`.
 *
 * 읽음은 **알림이 아니라 수신자에 달려 있다** (`notification_recipients.read_at`).
 * 같은 알림을 담당자 셋이 받으면 각자 읽음 상태가 따로 간다. 그래서 이 투영은
 * 알림 행 하나가 아니라 **내 수신자 행 + 그 알림**을 받는다.
 */

/** `NOTIFICATION_RECIPIENT_INCLUDE` 로 조회한 결과의 모양. */
export interface NotificationRecipientRow {
  readAt: Date | null;
  notification: {
    id: string;
    audience: string;
    type: string;
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
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedId: string | null;
  /**
   * `relatedId` 가 어떤 종류인지. **이게 없으면 알림함이 종류를 구분하지 못한다** —
   * 지금 관리자 알림함은 `relatedId` 만 보고 무조건 상담 상세로 보내서, 전문의 검수
   * 알림을 누르면 엉뚱한 곳으로 간다.
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
      title: true,
      message: true,
      relatedType: true,
      relatedId: true,
      createdAt: true,
    },
  },
} as const;

/**
 * DB 의 `related_type` → 계약의 `relatedResource`.
 *
 * 컬럼은 snake 스타일 도메인 이름(`consult_request`)을 쓰고 계약은 camelCase
 * (`consultRequest`)를 쓴다. 계약이 값 목록을 고정했으므로(`consultRequest` ·
 * `hospital` · `doctor` · `promotion`) **모르는 값은 null 로 떨어뜨린다** — 화면이
 * 모르는 값으로 라우팅을 시도하는 것보다 "이동 대상 없음" 이 낫다.
 */
const RELATED_RESOURCE_BY_TYPE: Record<string, string> = {
  consult_request: 'consultRequest',
  consultRequest: 'consultRequest',
  hospital: 'hospital',
  doctor: 'doctor',
  promotion: 'promotion',
};

export function projectNotification(row: NotificationRecipientRow): AppNotificationResponse {
  const { notification } = row;

  return {
    id: notification.id,
    audience: notification.audience,
    type: notification.type,
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
