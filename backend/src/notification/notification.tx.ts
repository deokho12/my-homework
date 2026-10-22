import { createId } from '@paralleldrive/cuid2';
import type { Prisma } from '@prisma/client';

import { buildNotificationRow, buildRecipientRows } from './notification.write';
import type { NotificationDraft } from './notification.write';

/**
 * 알림 행 삽입 — **트랜잭션 클라이언트를 인자로 받는 헬퍼다.**
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: 행 모양을 `notification.write.ts` 의 순수 함수로 떼어내고, 이 파일에는
 *  **삽입만** 남겼다. main 의 `*.write.ts` 는 DB 를 모르는 변환이라는 규약을 지키기 위해서다.)
 *
 * 세 계기(상담 접수·상태 변경·검수 결정)가 모두 본체와 원자적이어야 해서 서비스가 아니라
 * `tx` 를 받는 함수다 — 근거는 `notification.write.ts` 머리말에 있다.
 */
export async function createNotificationWithRecipients(
  tx: Prisma.TransactionClient,
  draft: NotificationDraft,
  now: Date,
): Promise<string> {
  const row = buildNotificationRow(createId(), draft, now);

  await tx.notification.create({ data: row });

  const recipients = buildRecipientRows(row.id, draft.recipientUserIds, createId);

  if (recipients.length > 0) {
    await tx.notificationRecipient.createMany({ data: recipients });
  }

  return row.id;
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
