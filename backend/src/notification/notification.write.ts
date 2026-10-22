/**
 * 알림 행의 **모양**을 정하는 순수 변환. DB 도 트랜잭션도 모른다.
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: ① 트랜잭션 삽입을 `notification.tx.ts` 로 떼어내 이 파일을 **순수 변환**으로
 *  남겼다 — main 의 `*.write.ts` 규약이 그것이다(`doctor.write.ts`·`hospital.write.ts`).
 *  ② `consultStatus` 를 **필수 키**로 더했다(값은 nullable). ③ `type` 을 계약의
 *  `NotificationType` 유니온으로 좁혔다.)
 *
 * ## 왜 서비스가 아닌가
 *
 * 알림은 계약상 **부수효과로만** 생긴다(생성 엔드포인트가 없다). 지금 세 계기가 있고
 * 전부 **본체와 원자적**이어야 한다:
 *
 * | 계기 | 수신자 | `audience` | `type` |
 * |---|---|---|---|
 * | 상담 접수 (`POST /consult-requests`) | 그 병원 담당자 전원 | `admin` | `consult-status` |
 * | 상담 상태·일시 변경 (`PATCH .../status`) | 신청자 1명 | `user` | `consult-status` |
 * | 전문의 검수 결정 (`PUT /doctors/{id}/verification`) | 그 병원 담당자 전원 | `admin` | `system` |
 *
 * `NotificationService.emit()` 같은 것을 만들어 부르면 트랜잭션이 갈라져 "검수는 남았는데
 * 알림은 실패" 가 가능해진다. 그래서 **행 모양은 이 파일이 알고, 트랜잭션은 각 호출자가
 * 연다** (`notification.tx.ts`).
 */

/** `Notification.audience` — 역할이 아니라 알림함이다. 화면이 둘뿐이라 값도 둘이다. */
export type NotificationAudience = 'user' | 'admin';

/**
 * 계약 `NotificationType`. `inquiry-answer` 를 **만드는 쪽은 요청서 16**(병원 문의)이라
 * 15 와 16 사이에는 그 값의 행이 한 건도 생기지 않는다 — 그래도 유니온에 둔다
 * (계약의 값 집합이고, 읽는 쪽은 이미 네 값을 다룬다).
 */
export type NotificationType = 'consult-status' | 'inquiry-answer' | 'event' | 'system';

/**
 * 저장 쪽 `related_type` (snake_case). 계약의 `relatedResource`(camelCase)로 바꾸는 것은
 * 투영의 몫이다 — `notification.projection.ts`.
 */
export type NotificationRelatedType =
  | 'consult_request'
  | 'hospital'
  | 'doctor'
  | 'promotion'
  | 'hospital_inquiry';

export interface NotificationDraft {
  audience: NotificationAudience;
  type: NotificationType;
  /** 짧은 명사구. 화면에 그대로 보인다. 조립은 `consult/notification-text.ts` 가 한다. */
  title: string;
  /** 구체적 사실을 담은 한 문장. 마침표를 붙이지 않는다(문구 관례). */
  message: string;
  /**
   * **그 알림을 낳은 이벤트 직후의 상담 상태** (`docs/database/README.md` §15.1).
   *
   * 선택이 아니라 **필수 키**다 — 저장된 행에서는 nullable 이지만(칸이 생기기 전 행),
   * **새로 만드는 행은 반드시 적는다**는 것이 쓰기 경로의 불변식이다. 타입이 그것을
   * 강제하면 통로가 하나 더 생기는 날 컴파일 에러로 잡힌다.
   */
  consultStatus: string | null;
  /** `relatedId` 가 어떤 종류인지. 알림을 눌렀을 때 어디로 갈지의 근거다. */
  relatedType?: NotificationRelatedType | null;
  relatedId?: string | null;
  hospitalId?: string | null;
  /**
   * 수신자. **비어 있어도 된다** — 담당자가 0명인 병원에서도 알림 자체는 남고,
   * 그 사실이 본체(검수 결정·상담 접수)의 성공을 막지 않는다(계약).
   */
  recipientUserIds: string[];
}

/** `notifications` INSERT 한 줄. */
export interface NotificationRow {
  id: string;
  audience: string;
  type: string;
  title: string;
  message: string;
  consultStatus: string | null;
  relatedType: string | null;
  relatedId: string | null;
  hospitalId: string | null;
  createdAt: Date;
}

/** `notification_recipients` INSERT 한 줄. `readAt` 은 새 알림이라 항상 null 이다. */
export interface NotificationRecipientInsert {
  id: string;
  notificationId: string;
  userId: string;
}

/**
 * 초안 → 알림 행. 선택 필드를 **명시적으로 `null`** 로 채운다 — 키가 없는 것과 `null` 인
 * 것이 섞이면 "기록이 없다" 와 "아직 안 쓴다" 를 DB 에서도 구분할 수 없다.
 */
export function buildNotificationRow(id: string, draft: NotificationDraft, now: Date): NotificationRow {
  return {
    id,
    audience: draft.audience,
    type: draft.type,
    title: draft.title,
    message: draft.message,
    consultStatus: draft.consultStatus,
    relatedType: draft.relatedType ?? null,
    relatedId: draft.relatedId ?? null,
    hospitalId: draft.hospitalId ?? null,
    createdAt: now,
  };
}

/**
 * 수신자 목록 → 수신자 행들. **중복을 제거한다.** `notification_recipients` 에
 * `@@unique([notificationId, userId])` 가 있어서, 같은 사용자가 두 번 들어오면(담당 병원이
 * 겹치는 등) 제약 위반으로 트랜잭션 전체가 되돌아간다.
 *
 * `createRowId` 를 인자로 받는 이유는 이 함수를 **순수하게** 두기 위해서다 — id 생성기를
 * 직접 부르면 같은 입력이 매번 다른 결과를 내 테스트가 모양을 고정할 수 없다.
 */
export function buildRecipientRows(
  notificationId: string,
  recipientUserIds: readonly string[],
  createRowId: () => string,
): NotificationRecipientInsert[] {
  return [...new Set(recipientUserIds)].map((userId) => ({
    id: createRowId(),
    notificationId,
    userId,
  }));
}
