import type { PrismaClient } from '@prisma/client';

/**
 * =============================================================================
 * 감사 로그 보존기간 삭제 — **유일하게 허용된 삭제 경로**
 * =============================================================================
 *
 * `audit_logs` 는 append-only 다 (docs/database/README.md §11.2-(4)). 그래서 삭제 코드는
 * 이 파일 하나에만 있고, 요청 경로가 쓰는 `AuditLogRepository` 에는 없다.
 *
 * ☆ **보존 기간(일)의 기본값을 두지 않았다.** 아직 미결이고(§11.8-1), 무엇보다
 *   **감사 보존기간이 상담 보존기간보다 짧으면 안 된다** — 짧게 잡은 기본값이 코드에 박히면
 *   그것이 사실상의 정책이 된다. 그래서 호출부가 `cutoff` 를 명시해야 한다.
 *   자동 스케줄도 붙이지 않았다 (기간이 정해지면 그때 붙인다 — 리프레시 토큰 정리와 다른 점이다).
 *
 * 스케줄이 생기면 **앱과 다른 자격증명**으로 접속해야 한다. PostgreSQL 이전 후
 * `REVOKE DELETE ON audit_logs FROM app_role` + `GRANT DELETE TO retention_role` 이
 * 성립하려면 삭제 주체가 앱 커넥션과 분리되어 있어야 한다 (§11.2-(4)).
 */
export type AuditLogRetentionClient = Pick<PrismaClient, 'auditLog'>;

export interface AuditLogRetentionResult {
  deleted: number;
  cutoff: Date;
}

/** `created_at < cutoff` 인 행을 지운다. (created_at) 인덱스가 받는다. */
export async function purgeAuditLogsBefore(
  prisma: AuditLogRetentionClient,
  cutoff: Date,
): Promise<AuditLogRetentionResult> {
  const result = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });

  return { deleted: result.count, cutoff };
}
