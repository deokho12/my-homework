import { Module } from '@nestjs/common';

import { AuditLogRepository } from './audit-log.repository';
import { AuditLogService } from './audit-log.service';

/**
 * 감사 로그 모듈.
 *
 * 도메인 모듈(상담·입점 문의·병원 …)이 `imports: [AuditModule]` 후 `AuditLogService` 를
 * 주입해서 쓴다. **`AuditLogRepository` 도 내보내지만 조회(`findMany`/`count`)용이다** —
 * 기록은 실패 정책이 들어 있는 `AuditLogService` 를 거쳐야 한다.
 */
@Module({
  providers: [AuditLogRepository, AuditLogService],
  exports: [AuditLogRepository, AuditLogService],
})
export class AuditModule {}
