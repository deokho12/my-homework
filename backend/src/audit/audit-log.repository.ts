import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// 생성자 주입용 값 import (emitDecoratorMetadata)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { insertAuditLog } from './audit-log.record';
import type { AuditLogEntry } from './audit-log.types';

/** 조회 필터. 인덱스가 받는 축만 노출한다 (docs/database/README.md §11.2 "인덱스 5개"). */
export interface AuditLogQuery {
  actorUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  hospitalId?: string;
  /** "누가 마스킹되지 않은 개인정보를 봤나" — `false` 가 감사의 핵심 질의다 */
  piiMasked?: boolean | null;
  from?: Date;
  to?: Date;
  /** 기본 50, 최대 200. 감사 조회 화면이 아직 없어 상한만 걸어 둔다 */
  limit?: number;
  offset?: number;
}

/** 조회 결과 한 줄. Prisma 모델 타입을 그대로 노출하지 않고 필요한 필드만 고른다. */
export interface AuditLogRow {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  hospitalId: string | null;
  piiMasked: boolean | null;
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: Date;
}

/**
 * =============================================================================
 * `audit_logs` 접근 — **create / findMany / count 만 있다**
 * =============================================================================
 *
 * ☆ **`update`/`delete`/`upsert` 메서드를 만들지 않는다.** 고칠 수 있으면 감사가 아니다.
 *   Prisma/SQLite 로는 append-only 를 강제할 수 없으므로(트리거는 raw SQL 금지 규칙에 걸린다)
 *   애플리케이션이 지킨다 — 그 "애플리케이션" 이 이 클래스 하나다
 *   (docs/database/README.md §11.2-(4)).
 *
 *   - 삭제는 보존기간 배치 하나만 한다 → `audit-log-retention.ts` (이 클래스에 넣지 않은 것도
 *     같은 이유다. 배치가 부르는 코드와 요청 경로가 부르는 코드가 섞이면 "여기 delete 가 있으니
 *     써도 되겠다" 가 된다)
 *   - PostgreSQL 이전 후에는 `REVOKE UPDATE, DELETE ON audit_logs FROM app_role` 로
 *     DB 권한으로 굳힌다. 그때 처음으로 진짜 강제가 된다
 *
 * 이 클래스를 우회해 `prisma.auditLog.update(...)` 를 부르는 것은 막을 수 없지만,
 * 그것은 리뷰에서 보이는 종류의 변경이다 (`audit-log.spec.ts` 가 노출 메서드 목록을 고정한다).
 */
@Injectable()
export class AuditLogRepository {
  private static readonly DEFAULT_LIMIT = 50;
  private static readonly MAX_LIMIT = 200;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 감사 로그를 남긴다. 반환값은 새 행의 id (로그 상관관계 추적용).
   *
   * `tx` 를 받는 이유: **열람/변경과 감사 쓰기를 같은 트랜잭션에 묶을 수 있어야 한다**
   * (§11.2 마지막 문단 — 같은 DB 에 두었기 때문에 가능한 선택이다).
   */
  async create(entry: AuditLogEntry, tx?: Prisma.TransactionClient): Promise<string> {
    return insertAuditLog(tx ?? this.prisma, entry);
  }

  async findMany(query: AuditLogQuery = {}): Promise<AuditLogRow[]> {
    return this.prisma.auditLog.findMany({
      where: AuditLogRepository.toWhere(query),
      // 타이브레이커를 둔다 — 같은 밀리초의 순서가 DB 마다 다르지 않게 (docs §7.5)
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(query.limit ?? AuditLogRepository.DEFAULT_LIMIT, AuditLogRepository.MAX_LIMIT),
      skip: query.offset ?? 0,
    });
  }

  async count(query: AuditLogQuery = {}): Promise<number> {
    return this.prisma.auditLog.count({ where: AuditLogRepository.toWhere(query) });
  }

  private static toWhere(query: AuditLogQuery): Prisma.AuditLogWhereInput {
    const createdAt =
      query.from || query.to
        ? { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lt: query.to } : {}) }
        : undefined;

    return {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
      ...(query.hospitalId ? { hospitalId: query.hospitalId } : {}),
      // `piiMasked: null` 은 "개인정보 없는 행위" 를 찾는 유효한 조건이므로
      // undefined 와 구분해야 한다 (`?? null` 로 뭉개면 필터를 걸 수 없다)
      ...(query.piiMasked !== undefined ? { piiMasked: query.piiMasked } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  }
}
