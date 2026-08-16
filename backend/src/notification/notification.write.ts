import { createId } from '@paralleldrive/cuid2';
import type { Prisma } from '@prisma/client';

/**
 * 알림 행 생성 — **트랜잭션 클라이언트를 인자로 받는 헬퍼다.**
 *
 * 알림은 계약상 부수효과로만 생긴다(생성 엔드포인트가 없다). 지금 세 계기가 있다:
 *
 * | 계기 | 수신자 | audience |
 * |---|---|---|
 * | 상담 접수 | 그 병원 담당자 전원 | `admin` |
 * | 상담 상태 변경 | 신청자 | `user` |
 * | 전문의 검수 결정 | 그 병원 담당자 전원 | `admin` |
 *
 * ## 왜 서비스가 아니라 `tx` 를 받는 함수인가
 *
 * 세 계기 모두 **본체와 원자적**이어야 한다. 검수 결정은 검수 이력과, 상담 접수는 상담
 * 행과 같은 트랜잭션 안에 있어야 한다. `NotificationService.emit()` 같은 것을 만들어
 * 부르면 트랜잭션이 갈라져서 "검수는 남았는데 알림은 실패" 가 가능해진다.
 *
 * 그래서 **행 모양은 이 함수 하나가 알고, 트랜잭션은 각 호출자가 자기 것을 연다.**
 * 같은 판정을 두 곳에 두지 않는다는 규칙(`AGENTS.md`)을 트랜잭션 경계를 깨지 않고
 * 지키는 방법이다.
 */

/** `Notification.audience` — 역할이 아니라 알림함이다. 화면이 둘뿐이라 값도 둘이다. */
export type NotificationAudience = 'user' | 'admin';

export interface NotificationDraft {
  audience: NotificationAudience;
  /** `Notification.type` (`consult` · `system` · `promotion` …). 계약의 `NotificationType`. */
  type: string;
  /** 짧은 명사구. 화면에 그대로 보인다. */
  title: string;
  /** 구체적 사실을 담은 한 문장. 마침표를 붙이지 않는다(시드 문구 관례). */
  message: string;
  /** `relatedId` 가 어떤 종류인지. 알림을 눌렀을 때 어디로 갈지의 근거다. */
  relatedType?: string | null;
  relatedId?: string | null;
  hospitalId?: string | null;
  /**
   * 수신자. **비어 있어도 된다** — 담당자가 0명인 병원에서도 알림 자체는 남고,
   * 그 사실이 본체(검수 결정·상담 접수)의 성공을 막지 않는다(계약).
   */
  recipientUserIds: string[];
}

/**
 * 알림 1행 + 수신자 N행을 만든다. 만들어진 알림 id 를 돌려준다.
 *
 * 수신자 목록은 **중복을 제거한다.** `notification_recipients` 에
 * `@@unique([notificationId, userId])` 가 있어서, 같은 사용자가 두 번 들어오면
 * (담당 병원이 겹치는 등) 제약 위반으로 트랜잭션 전체가 되돌아간다.
 */
export async function createNotificationWithRecipients(
  tx: Prisma.TransactionClient,
  draft: NotificationDraft,
  now: Date,
): Promise<string> {
  const notification = await tx.notification.create({
    data: {
      id: createId(),
      audience: draft.audience,
      type: draft.type,
      title: draft.title,
      message: draft.message,
      relatedType: draft.relatedType ?? null,
      relatedId: draft.relatedId ?? null,
      hospitalId: draft.hospitalId ?? null,
      createdAt: now,
    },
  });

  const recipients = [...new Set(draft.recipientUserIds)];

  if (recipients.length > 0) {
    await tx.notificationRecipient.createMany({
      data: recipients.map((userId) => ({
        id: createId(),
        notificationId: notification.id,
        userId,
      })),
    });
  }

  return notification.id;
}

/**
 * 그 병원 담당자들의 `userId`.
 *
 * 상담 접수와 검수 결정이 같은 수신자 집합을 쓴다. 조회를 두 곳에 두면 한쪽만
 * `deletedAt` 같은 조건이 붙는 식으로 갈린다.
 */
export async function findHospitalAdminUserIds(
  tx: Prisma.TransactionClient,
  hospitalId: string,
): Promise<string[]> {
  const admins = await tx.hospitalAdmin.findMany({
    where: { hospitalId },
    select: { userId: true },
    orderBy: { userId: 'asc' },
  });

  return admins.map((admin) => admin.userId);
}
