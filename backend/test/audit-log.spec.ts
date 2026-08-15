import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { createId } from '@paralleldrive/cuid2';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { purgeAuditLogsBefore } from '../src/audit/audit-log-retention';
import { AuditLogRepository } from '../src/audit/audit-log.repository';
import { AuditLogService, AUDIT_WRITE_POLICY, piiMaskedFromScope } from '../src/audit/audit-log.service';
import type { AuditLogEntry } from '../src/audit/audit-log.types';
import { AuditModule } from '../src/audit/audit.module';
import { SCOPE_KEY } from '../src/auth/guards/hospital-scope.guard';
import type { ResolvedScope } from '../src/auth/guards/hospital-scope.guard';
import { ApiError } from '../src/common/errors/api-error';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * =============================================================================
 * 감사 로그 — 스냅샷, append-only, 쓰기 실패 정책
 * =============================================================================
 *
 * docs/database/README.md §11.2 가 요구한 것 세 가지를 고정한다.
 *
 *   1. `actor_role` / `pii_masked` 는 **스냅샷**이다 (`users.role` 을 조인하지 않는다)
 *   2. 리포지토리는 **`create`/`findMany`/`count` 만** 노출한다 (고칠 수 있으면 감사가 아니다)
 *   3. `pii_masked` 의 세 값이 서로 다른 의미다 — `null` 이 `false` 로 뭉개지면
 *      "누가 마스킹 안 된 개인정보를 봤나" 질의가 오염된다
 */
describe('감사 로그', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: AuditLogRepository;
  let service: AuditLogService;

  /** 이 파일이 만든 행만 구분하는 표식 */
  const TARGET = `audit-spec-${createId()}`;

  function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
    return {
      actorUserId: 'u-operator',
      actorRole: 'operator',
      action: 'consult_request.view',
      targetType: 'consult_request',
      targetId: TARGET,
      hospitalId: null,
      piiMasked: true,
      requestId: createId().toUpperCase(),
      ...overrides,
    };
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [PrismaModule, AuditModule] }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(AuditLogRepository);
    service = moduleRef.get(AuditLogService);
  });

  afterEach(async () => {
    await prisma.auditLog.deleteMany({ where: { targetId: { startsWith: 'audit-spec-' } } });
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  describe('기록', () => {
    it('행이 실제로 남고 스냅샷 컬럼이 준 값 그대로다', async () => {
      const id = await repository.create(
        entry({
          actorUserId: 'u-admin-h1',
          // ☆ 스냅샷 — 이 계정의 현재 users.role 을 조인하지 않는다
          actorRole: 'hospital_admin',
          hospitalId: 'h1',
          piiMasked: false,
          ip: '127.0.0.1',
          userAgent: 'vitest',
        }),
      );

      const row = await prisma.auditLog.findUniqueOrThrow({ where: { id } });

      expect(row).toMatchObject({
        actorUserId: 'u-admin-h1',
        actorRole: 'hospital_admin',
        action: 'consult_request.view',
        targetType: 'consult_request',
        targetId: TARGET,
        hospitalId: 'h1',
        piiMasked: false,
        ip: '127.0.0.1',
        userAgent: 'vitest',
        beforeValue: null,
        afterValue: null,
      });
      expect(row.createdAt).toBeInstanceOf(Date);
    });

    it('상태 전이는 before/after 실 컬럼 2개로 남는다 (JSON metadata 가 없다)', async () => {
      const id = await repository.create(
        entry({
          action: 'doctor.verify',
          targetType: 'doctor',
          hospitalId: 'h1',
          // 검수 결정 응답에는 개인정보가 없다 → null
          piiMasked: null,
          beforeValue: 'pending',
          afterValue: 'approved',
        }),
      );

      const row = await prisma.auditLog.findUniqueOrThrow({ where: { id } });

      expect(row.beforeValue).toBe('pending');
      expect(row.afterValue).toBe('approved');
      expect(row.piiMasked).toBeNull();
    });

    it('행위자 계정이 없으면 기록이 실패한다 (FK — 존재하지 않는 행위자를 남기지 않는다)', async () => {
      await expect(repository.create(entry({ actorUserId: `ghost-${createId()}` }))).rejects.toThrow();
    });

    it('열람과 감사 쓰기를 한 트랜잭션에 묶을 수 있다 (롤백되면 감사도 사라진다)', async () => {
      // §11.2 마지막 문단: audit_logs 를 같은 DB 에 둔 덕에 이 선택지가 존재한다.
      await expect(
        prisma.$transaction(async (tx) => {
          await repository.create(entry(), tx);

          throw new Error('열람 처리 실패');
        }),
      ).rejects.toThrow('열람 처리 실패');

      expect(await repository.count({ targetId: TARGET })).toBe(0);
    });
  });

  describe('★ append-only — 리포지토리에 고치는 수단이 없다', () => {
    it('노출 메서드가 create / findMany / count 뿐이다', () => {
      const methods = Object.getOwnPropertyNames(AuditLogRepository.prototype)
        .filter((name) => name !== 'constructor')
        // private static 헬퍼는 프로토타입이 아니라 클래스에 붙는다
        .sort();

      expect(methods).toEqual(['count', 'create', 'findMany']);

      for (const forbidden of ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'] as const) {
        expect((repository as unknown as Record<string, unknown>)[forbidden]).toBeUndefined();
      }
    });

    it('삭제 경로는 보존기간 배치 하나뿐이고 cutoff 를 명시해야 한다', async () => {
      const old = await repository.create(entry());

      await prisma.auditLog.update({
        where: { id: old },
        data: { createdAt: new Date('2020-01-01T00:00:00.000Z') },
      });
      const recent = await repository.create(entry());

      const result = await purgeAuditLogsBefore(prisma, new Date('2021-01-01T00:00:00.000Z'));

      expect(result.deleted).toBe(1);
      expect(await prisma.auditLog.findUnique({ where: { id: old } })).toBeNull();
      expect(await prisma.auditLog.findUnique({ where: { id: recent } })).not.toBeNull();
    });
  });

  describe('조회', () => {
    it('행위자·행위·대상·병원으로 좁힐 수 있다 (인덱스가 있는 축)', async () => {
      await repository.create(entry({ actorUserId: 'u-operator', action: 'consult_request.view' }));
      await repository.create(
        entry({
          actorUserId: 'u-admin-h1',
          actorRole: 'hospital_admin',
          action: 'consult_request.memo_create',
          hospitalId: 'h1',
          piiMasked: false,
        }),
      );

      expect(await repository.count({ targetId: TARGET })).toBe(2);
      expect(await repository.count({ targetId: TARGET, actorUserId: 'u-admin-h1' })).toBe(1);
      expect(await repository.count({ targetId: TARGET, action: 'consult_request.view' })).toBe(1);
      expect(await repository.count({ targetId: TARGET, hospitalId: 'h1' })).toBe(1);

      const rows = await repository.findMany({ targetId: TARGET, targetType: 'consult_request' });

      expect(rows).toHaveLength(2);
      // 최신순 + id 타이브레이커
      expect(rows[0].createdAt.getTime()).toBeGreaterThanOrEqual(rows[1].createdAt.getTime());
    });

    it('★ pii_masked = false 질의가 "개인정보 없는 행위" 에 오염되지 않는다', async () => {
      await repository.create(entry({ piiMasked: false })); // 담당자가 원본을 봤다
      await repository.create(entry({ piiMasked: true })); // 운영자가 마스킹된 값을 봤다
      await repository.create(entry({ action: 'hospital.create', targetType: 'hospital', piiMasked: null }));

      // 감사의 핵심 질의
      expect(await repository.count({ targetId: TARGET, piiMasked: false })).toBe(1);
      expect(await repository.count({ targetId: TARGET, piiMasked: true })).toBe(1);
      // null 도 필터할 수 있다 (undefined 와 구분된다)
      expect(await repository.count({ targetId: TARGET, piiMasked: null })).toBe(1);
      expect(await repository.count({ targetId: TARGET })).toBe(3);
    });

    it('limit 상한이 있고 기간으로 좁힐 수 있다', async () => {
      await repository.create(entry());

      expect(await repository.findMany({ targetId: TARGET, limit: 10_000 })).toHaveLength(1);
      expect(
        await repository.findMany({ targetId: TARGET, from: new Date(Date.now() + 60_000) }),
      ).toHaveLength(0);
    });
  });

  describe('HospitalScopeGuard 의 managed → pii_masked 스냅샷', () => {
    function scope(managed: boolean): ResolvedScope {
      return { resource: 'consultRequest', resourceId: 'cr1', hospitalId: 'h1', managed };
    }

    it('담당 병원(managed=true)은 원본을 보므로 false, 운영자는 마스킹이라 true', () => {
      expect(piiMaskedFromScope(scope(true))).toBe(false);
      expect(piiMaskedFromScope(scope(false))).toBe(true);
    });

    it('스코프가 없는 라우트는 null 이다 (기본값 false 로 두면 핵심 질의가 오염된다)', () => {
      expect(piiMaskedFromScope(undefined)).toBeNull();
    });

    it('★ recordFromRequest 가 가드의 스코프·요청 컨텍스트를 그대로 옮긴다 (도메인 컨트롤러 배선 지점)', async () => {
      // 상담 상세 열람 컨트롤러가 생기면 이 호출 하나를 붙인다. 지금 확인하는 것은
      // "붙이면 무엇이 기록되는가" 다 — hospital_id 와 pii_masked 를 컨트롤러가 다시
      // 계산하지 않고 가드의 판단(ResolvedScope)에서 가져오는 것이 요점이다.
      const request = {
        requestId: 'REQ-AUDIT-SPEC',
        ip: '10.0.0.9',
        header: (name: string) => (name.toLowerCase() === 'user-agent' ? 'mola-app/1.0' : undefined),
        [SCOPE_KEY]: scope(true),
      };

      const id = await service.recordFromRequest(
        request as unknown as Parameters<typeof service.recordFromRequest>[0],
        { id: 'u-admin-h1', email: 'admin-h1@molarmolar.example', name: 'h1', provider: 'email', role: 'hospital_admin' },
        { action: 'consult_request.view', targetType: 'consult_request', targetId: TARGET },
      );

      const row = await prisma.auditLog.findUniqueOrThrow({ where: { id: id as string } });

      expect(row).toMatchObject({
        actorUserId: 'u-admin-h1',
        actorRole: 'hospital_admin',
        action: 'consult_request.view',
        // 가드가 찾아 둔 소유 병원
        hospitalId: 'h1',
        // managed=true → 원본 개인정보를 봤다
        piiMasked: false,
        requestId: 'REQ-AUDIT-SPEC',
        ip: '10.0.0.9',
        userAgent: 'mola-app/1.0',
      });
    });

    it('운영자 열람(managed=false)은 같은 라우트에서 pii_masked=true 로 남는다', async () => {
      const request = {
        requestId: 'REQ-AUDIT-SPEC-OPS',
        header: () => undefined,
        [SCOPE_KEY]: scope(false),
      };

      const id = await service.recordFromRequest(
        request as unknown as Parameters<typeof service.recordFromRequest>[0],
        { id: 'u-operator', email: 'ops@molarmolar.example', name: 'ops', provider: 'email', role: 'operator' },
        { action: 'consult_request.view', targetType: 'consult_request', targetId: TARGET },
      );

      const row = await prisma.auditLog.findUniqueOrThrow({ where: { id: id as string } });

      expect(row.piiMasked).toBe(true);
      expect(row.actorRole).toBe('operator');
      // 헤더가 없는 클라이언트면 null 이다 (컬럼이 nullable 인 이유)
      expect(row.userAgent).toBeNull();
    });
  });

  describe('쓰기 실패 정책 (미결 — 지금의 선택)', () => {
    /** 항상 실패하는 리포지토리로 정책만 검증한다 */
    class FailingRepository {
      async create(): Promise<string> {
        throw new Error('DB 쓰기 실패 (테스트)');
      }
    }

    const failing = new AuditLogService(new FailingRepository() as unknown as AuditLogRepository);

    it('정책이 한 곳에 있다', () => {
      expect(AUDIT_WRITE_POLICY.failClosedOnUnmaskedPii).toBe(true);
    });

    it('★ pii_masked=false 인 행위는 감사 쓰기가 실패하면 행위도 실패한다 (fail closed)', async () => {
      await expect(failing.record(entry({ piiMasked: false }))).rejects.toBeInstanceOf(ApiError);
    });

    it('개인정보가 없는 행위(null)·마스킹된 열람(true)은 진행한다 (fail open, 로그만)', async () => {
      expect(await failing.record(entry({ piiMasked: null }))).toBeNull();
      expect(await failing.record(entry({ piiMasked: true }))).toBeNull();
    });

    it('성공하면 새 행의 id 를 돌려준다', async () => {
      const id = await service.record(entry());

      expect(id).toBeTruthy();
      expect(await prisma.auditLog.findUnique({ where: { id: id as string } })).not.toBeNull();
    });
  });
});
