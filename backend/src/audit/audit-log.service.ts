import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/auth.types';
import { getResolvedScope } from '../auth/guards/hospital-scope.guard';
import type { ResolvedScope } from '../auth/guards/hospital-scope.guard';
import { ApiError } from '../common/errors/api-error';
import { getRequestId } from '../common/http/request-id';
// 생성자 주입용 값 import (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditLogRepository } from './audit-log.repository';
import type { AuditAction, AuditLogEntry, AuditTargetType } from './audit-log.types';

/**
 * =============================================================================
 * 감사 쓰기 실패 정책 — **여기 한 곳에 모은다** (미결: docs/database/README.md §11.8-3)
 * =============================================================================
 *
 * 제품 결정이 아직 없어서 지금은 아래처럼 구현했다. 바뀌면 이 상수 하나만 고친다.
 *
 * ```
 * piiMasked === false  → 실패 시 행위도 실패시킨다 (fail closed)
 * 그 외 (true | null)  → 실패를 로그로 남기고 행위는 진행시킨다 (fail open)
 * ```
 *
 * 근거:
 *
 * 1. `pii_masked = false` 는 **마스킹되지 않은 개인정보를 봤다** 는 뜻이고, 결정 0001 이
 *    담당 병원 `hospital_admin` 에게 그 노출면을 남긴 대가로 요구한 것이 정확히 "그 열람이
 *    기록된다" 는 것이다. 기록되지 않은 원본 열람은 이 통제가 막으려던 바로 그 상태다.
 * 2. 같은 DB 에 있어서 **트랜잭션으로 묶을 수 있다** (§11.2 마지막 문단). 감사 저장소가
 *    외부였다면 이 선택지가 아예 없다.
 * 3. 반대로 `hospital.create` 처럼 개인정보가 없는 행위까지 fail closed 로 하면, 감사 쓰기
 *    장애가 **쓰기 기능 전체의 장애**로 번진다. 기록 가치와 가용성을 견주면 이쪽은 fail open 이
 *    맞다 (그리고 그 사실이 에러 로그로 남는다).
 * 4. `pii_masked = true`(운영자가 마스킹된 값을 봤다)도 fail open 이다. 마스킹된 값 열람은
 *    개인정보 노출이 아니라 접근 이력이고, 노출면의 크기가 다르다.
 */
export const AUDIT_WRITE_POLICY = {
  /** `pii_masked = false` 행위에서 감사 쓰기 실패 시 그 행위를 실패시키는가 */
  failClosedOnUnmaskedPii: true,
} as const;

/**
 * 감사 로그 기록의 유일한 애플리케이션 진입점.
 *
 * 컨트롤러가 `AuditLogRepository` 를 직접 부르지 않고 이 서비스를 쓴다 — 실패 정책과
 * 요청 컨텍스트(requestId·ip·userAgent) 추출이 한 곳에 있어야 한다.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly repository: AuditLogRepository) {}

  /**
   * 기록한다. 실패하면 위 정책에 따라 던지거나 로그만 남긴다.
   *
   * `tx` 를 주면 그 트랜잭션 안에서 INSERT 한다 — 열람/변경과 원자적으로 묶을 때 쓴다.
   * (그 경우 던지는 것은 트랜잭션 롤백을 의미한다.)
   */
  async record(entry: AuditLogEntry, tx?: Prisma.TransactionClient): Promise<string | null> {
    try {
      return await this.repository.create(entry, tx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `감사 로그 기록 실패 — action=${entry.action} target=${entry.targetType}:${entry.targetId} ` +
          `actor=${entry.actorUserId} requestId=${entry.requestId} pii_masked=${String(entry.piiMasked)}: ${message}`,
      );

      if (AUDIT_WRITE_POLICY.failClosedOnUnmaskedPii && entry.piiMasked === false) {
        // 기록되지 않은 "원본 개인정보 열람" 을 허용하지 않는다. 사용자에게는 일시적 오류로 보인다.
        throw new ApiError('INTERNAL_ERROR');
      }

      return null;
    }
  }

  /**
   * 요청 컨텍스트 + 담당 범위로부터 감사 항목을 만든다. **도메인 컨트롤러의 배선 지점이다.**
   *
   * 상담 상세 열람(`GET /consult-requests/{id}`)이 생기면 이렇게 부른다:
   *
   * ```ts
   * await this.audit.recordFromRequest(request, user, {
   *   action: 'consult_request.view',
   *   targetType: 'consult_request',
   *   targetId: id,
   * });
   * ```
   *
   * `hospitalId` 와 `piiMasked` 는 **`HospitalScopeGuard` 가 request 에 남긴 `ResolvedScope`
   * 에서 나온다** — 컨트롤러가 다시 계산하지 않는다. 다시 계산하면 가드의 판단과 감사 기록이
   * 어긋날 수 있고, 그러면 "무엇을 봤는가" 를 감사 로그가 틀리게 말한다.
   */
  async recordFromRequest(
    request: Request,
    user: AuthenticatedUser,
    action: {
      action: AuditAction;
      targetType: AuditTargetType;
      targetId: string;
      /** 스코프 가드가 없는 라우트에서 명시할 때 (예: 운영자 전용 목록) */
      hospitalId?: string | null;
      /** 열람 행위가 아니면 명시한다. 주지 않으면 스코프에서 유도한다 */
      piiMasked?: boolean | null;
      beforeValue?: string | null;
      afterValue?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<string | null> {
    const scope = getResolvedScope(request);

    return this.record(
      {
        actorUserId: user.id,
        // 행위 시점의 역할 스냅샷. users.role 을 다시 읽지 않는다 (§11.2-(2))
        actorRole: user.role,
        action: action.action,
        targetType: action.targetType,
        targetId: action.targetId,
        hospitalId: action.hospitalId ?? scope?.hospitalId ?? null,
        piiMasked: action.piiMasked !== undefined ? action.piiMasked : piiMaskedFromScope(scope),
        requestId: getRequestId(request),
        ip: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
        beforeValue: action.beforeValue ?? null,
        afterValue: action.afterValue ?? null,
      },
      tx,
    );
  }
}

/**
 * `HospitalScopeGuard` 의 `managed` → `pii_masked` 스냅샷.
 *
 * 가드는 이미 "담당 병원이라서 통과" 와 "운영자라서 통과" 를 구분해 `managed` 로 남긴다
 * (`ResolvedScope.managed` 주석: "마스킹 판단에 쓴다"). 그 값이 곧 마스킹 여부다.
 *
 * ```
 * managed = true  (담당 병원 hospital_admin) → 원본을 본다      → pii_masked = false
 * managed = false (operator)                 → 마스킹된 값을 본다 → pii_masked = true
 * 스코프 없음                                 → 개인정보 자원이 아니다 → null
 * ```
 *
 * 세 번째가 중요하다. 스코프가 없는 라우트에서 `false` 를 기본값으로 두면
 * `WHERE pii_masked = false` 질의가 개인정보와 무관한 행위로 오염된다 (§11.2-(2)).
 */
export function piiMaskedFromScope(scope: ResolvedScope | undefined): boolean | null {
  if (!scope) {
    return null;
  }

  return !scope.managed;
}
