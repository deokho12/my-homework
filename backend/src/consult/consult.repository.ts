import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import type { Prisma } from '@prisma/client';

import { createNotificationWithRecipients, findHospitalAdminUserIds } from '../notification/notification.tx';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { CONSULT_INCLUDE } from './consult.projection';
import type { ConsultRequestRow } from './consult.projection';
import { CONSULT_STATUSES } from './transition';
import type { ConsultEvent, ConsultStatus } from './transition';

/**
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: 새 컬럼 6개, 이벤트 종류·확정 일시·취소 사유·알림 id 를 쓰는 이력 행,
 *  상태 탭 집계(`countByStatus`), **감사 행을 같은 트랜잭션에 넣는 통로**(`writeAudit`),
 *  `summaryCounts` 삭제(소비 화면이 없어 만들지 않는 오퍼레이션이다 — `backend/README.md`).)
 *
 * 쓰기 셋이 전부 **한 트랜잭션**이다. 계약이 요구하는 것이 "상담은 접수됐는데 담당자가
 * 모르는 상태" 와 "이력은 남았는데 알림이 없는 상태" 를 만들지 않는 것이다.
 */

export interface FindManyOptions {
  skip: number;
  take: number;
}

/**
 * 같은 트랜잭션 안에서 감사 행을 쓰는 통로.
 *
 * 리포지토리가 `AuditLogService` 를 주입받지 않는 이유: 감사 항목에는 요청 컨텍스트
 * (requestId·ip·user-agent·스코프)가 들어가고 그것은 **컨트롤러만** 안다. 그래서 행위자
 * 쪽이 함수를 만들어 내려보내고, 리포지토리는 자기 트랜잭션을 빌려줄 뿐이다.
 */
export type AuditWriter = (tx: Prisma.TransactionClient) => Promise<unknown>;

export interface CreateConsultParams {
  userId: string;
  hospitalId: string;
  doctorId: string | null;
  procedureId: string | null;
  name: string;
  /** 이미 정규화된 값 (`010-1234-5678`). 정규화는 서비스가 한다. */
  phone: string;
  /** 숫자만 남긴 값. 관리자 목록의 번호 검색이 거는 컬럼이다 (DB §12.5). */
  phoneDigits: string;
  preferredTime: string;
  message: string;
  /** 동의 안내문 버전. **동의 시각은 서버 시계**라 여기 없다 (계약). */
  consentNoticeVersion: string;
  /** 담당자 알림 문구. 조립은 `notification-text.ts` 가 한다. */
  notificationTitle: string;
  notificationMessage: string;
}

export interface UpdateStatusParams {
  consultRequestId: string;
  status: ConsultStatus;
  /** `status_change` 인가 `reschedule` 인가. no-op 은 여기까지 오지 않는다. */
  event: ConsultEvent;
  /** 이 이벤트 **직후**의 확정 일시. 상태가 정한 결과값이다. */
  visitAt: Date | null;
  /** 취소 이벤트 행에만 값이 있다. */
  cancelReason: string | null;
  changedByUserId: string;
  /** 환자 알림의 수신자 — 그 상담의 신청자 **한 명**이다. */
  requesterUserId: string;
  notificationTitle: string;
  notificationMessage: string;
  /** 알림 행의 `consult_status` — 상태 변경이면 새 상태, 일시 변경이면 `booked`. */
  notificationConsultStatus: ConsultStatus;
  writeAudit: AuditWriter;
}

@Injectable()
export class ConsultRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: Prisma.ConsultRequestWhereInput,
    options: FindManyOptions,
  ): Promise<ConsultRequestRow[]> {
    return this.prisma.consultRequest.findMany({
      where,
      include: CONSULT_INCLUDE,
      // 신청일시 최신순. 같은 시각이 가능하므로 id tiebreaker 를 더한다.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  async count(where: Prisma.ConsultRequestWhereInput): Promise<number> {
    return this.prisma.consultRequest.count({ where });
  }

  /**
   * 상태 탭의 건수. **모집단은 호출부가 준다** — "지금 걸린 필터에서 `status` 만 뺀 범위" 다
   * (계약 `ConsultStatusCounts`). 한 번의 `groupBy` 라 목록과 같은 시점을 본다.
   *
   * 0건인 상태도 키가 있어야 한다 — 탭이 숫자 없이 그려지면 화면이 "모름" 과 "0" 을
   * 구분할 수 없다. 그래서 5개를 0 으로 깔고 덮어쓴다.
   */
  async countByStatus(
    where: Prisma.ConsultRequestWhereInput,
  ): Promise<Record<ConsultStatus, number> & { total: number }> {
    const rows = await this.prisma.consultRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    const counts = Object.fromEntries(CONSULT_STATUSES.map((status) => [status, 0])) as Record<
      ConsultStatus,
      number
    >;
    let total = 0;

    for (const row of rows) {
      total += row._count._all;

      if (row.status in counts) {
        counts[row.status as ConsultStatus] = row._count._all;
      }
    }

    // `total` 을 따로 내려주는 이유: 화면이 다섯 수를 더하는 순간 그 덧셈이 또 하나의
    // 판정 지점이 된다 (계약). 모르는 상태 코드가 섞여도 `total` 은 실제 건수다.
    return { ...counts, total };
  }

  async findById(id: string): Promise<ConsultRequestRow | null> {
    return this.prisma.consultRequest.findUnique({ where: { id }, include: CONSULT_INCLUDE });
  }

  /**
   * 상담 접수 한 트랜잭션.
   * 1. `consult_requests` 행 (+ 동의 기록 2칸)
   * 2. 접수 이력 행 — `changed_by_user_id`·`notification_id` 가 **null** 이다.
   *    접수 알림은 `audience='admin'` 이라 **환자 알림이 아니다** (DB §15.2-ⓑ)
   * 3. 담당자 전원에게 `audience='admin'` 알림
   *
   * 셋이 한 트랜잭션인 이유: 상담은 접수됐는데 담당자가 모르는 상태를 만들지 않는다.
   */
  async create(params: CreateConsultParams): Promise<string> {
    const now = new Date();
    const id = createId();

    await this.prisma.$transaction(async (tx) => {
      await tx.consultRequest.create({
        data: {
          id,
          userId: params.userId,
          hospitalId: params.hospitalId,
          doctorId: params.doctorId,
          procedureId: params.procedureId,
          name: params.name,
          phone: params.phone,
          phoneDigits: params.phoneDigits,
          preferredTime: params.preferredTime,
          message: params.message,
          status: 'new',
          visitAt: null,
          // **서버 시계**로 찍는다 — 기기 시계는 사용자가 바꿀 수 있어 증빙이 되지 않는다(계약).
          thirdPartyConsentAgreedAt: now,
          thirdPartyConsentNoticeVersion: params.consentNoticeVersion,
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.consultStatusChange.create({
        data: {
          id: createId(),
          consultRequestId: id,
          event: 'status_change',
          status: 'new',
          changedAt: now,
          changedByUserId: null,
          visitAt: null,
          cancelReason: null,
          notificationId: null,
        },
      });

      await createNotificationWithRecipients(
        tx,
        {
          audience: 'admin',
          type: 'consult-status',
          title: params.notificationTitle,
          message: params.notificationMessage,
          // 접수 알림이 말하는 상태는 그 상담이 방금 놓인 상태다.
          consultStatus: 'new',
          relatedType: 'consult_request',
          relatedId: id,
          hospitalId: params.hospitalId,
          // **운영자는 수신자가 아니다** — 문구에 신청자 이름이 그대로 들어가기 때문이다(계약).
          recipientUserIds: await findHospitalAdminUserIds(tx, params.hospitalId),
        },
        now,
      );
    });

    return id;
  }

  /**
   * 상태 변경 · 일시 변경 한 트랜잭션. 상담 갱신 + 이력 + 신청자 알림 + **감사 행**.
   *
   * **no-op 판정은 서비스가 한다.** 여기까지 오면 실제로 이력 행이 생기는 것이다 — 그래야
   * 이력·알림·감사가 항상 셋이 짝을 이룬다 (계약의 "부수효과는 이력 행이 생길 때만").
   */
  async updateStatus(params: UpdateStatusParams): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 알림을 먼저 만든다 — 이력 행이 그 id 를 들고 `notified` 를 설명한다 (DB §12.8).
      const notificationId = await createNotificationWithRecipients(
        tx,
        {
          audience: 'user',
          type: 'consult-status',
          title: params.notificationTitle,
          message: params.notificationMessage,
          consultStatus: params.notificationConsultStatus,
          relatedType: 'consult_request',
          relatedId: params.consultRequestId,
          // 사용자 알림에는 병원 id 를 채우지 않는다 — 그 칸은 관리자 알림함의 필터 키다(§9).
          hospitalId: null,
          recipientUserIds: [params.requesterUserId],
        },
        now,
      );

      await tx.consultRequest.update({
        where: { id: params.consultRequestId },
        data: { status: params.status, visitAt: params.visitAt, updatedAt: now },
      });

      await tx.consultStatusChange.create({
        data: {
          id: createId(),
          consultRequestId: params.consultRequestId,
          event: params.event,
          // `reschedule` 행의 상태는 그 시점의 상태(`booked`)다 — 행이 스스로를 설명한다.
          status: params.status,
          changedAt: now,
          changedByUserId: params.changedByUserId,
          visitAt: params.visitAt,
          cancelReason: params.cancelReason,
          notificationId,
        },
      });

      await params.writeAudit(tx);
    });
  }

  /** 메모 추가 + 감사 행. 같은 트랜잭션이라 "메모는 남았는데 기록이 없는" 상태가 없다. */
  async addMemo(
    consultRequestId: string,
    content: string,
    authorUserId: string,
    writeAudit: AuditWriter,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.consultMemo.create({
        data: { id: createId(), consultRequestId, content, authorUserId, createdAt: now },
      });

      // 메모는 상담을 만졌다는 뜻이라 `updatedAt` 을 함께 민다.
      await tx.consultRequest.update({ where: { id: consultRequestId }, data: { updatedAt: now } });

      await writeAudit(tx);
    });
  }
}
