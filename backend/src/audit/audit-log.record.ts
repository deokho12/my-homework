import type { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

import type { AuditLogEntry } from './audit-log.types';

/**
 * `audit_logs` 에 한 줄 넣는다. **INSERT 만 하는 함수다.**
 *
 * Nest 리포지토리(`AuditLogRepository`)와 CLI(`operator-role.ts`)가 같은 코드를 써야 하므로
 * 순수 함수로 뒀다. CLI 는 Nest 를 부팅하지 않는다.
 *
 * ☆ 이 파일에는 `update`/`delete`/`upsert` 가 없고, 앞으로도 두지 않는다
 *   (append-only — docs/database/README.md §11.2-(4)). 유일하게 허용된 삭제는
 *   보존기간 배치이고, 그것은 `audit-log-retention.ts` 에만 있다.
 */
export type AuditLogClient = Pick<PrismaClient, 'auditLog'>;

export async function insertAuditLog(
  prisma: AuditLogClient,
  entry: AuditLogEntry,
  now: Date = new Date(),
): Promise<string> {
  const id = createId();

  await prisma.auditLog.create({
    data: {
      id,
      actorUserId: entry.actorUserId,
      actorRole: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      hospitalId: entry.hospitalId ?? null,
      // `?? null` 을 쓰지 않는다 — piiMasked 는 3값(true/false/null)이고 null 이 의미를 가진다
      piiMasked: entry.piiMasked,
      requestId: entry.requestId,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      beforeValue: entry.beforeValue ?? null,
      afterValue: entry.afterValue ?? null,
      createdAt: now,
    },
  });

  return id;
}
