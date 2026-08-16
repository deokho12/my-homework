import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import type { Prisma } from '@prisma/client';

import {
  createNotificationWithRecipients,
  findHospitalAdminUserIds,
} from '../notification/notification.write';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { CONSULT_INCLUDE } from './consult.projection';
import type { ConsultRequestRow } from './consult.projection';

export interface FindManyOptions {
  skip: number;
  take: number;
}

export interface CreateConsultParams {
  userId: string;
  hospitalId: string;
  doctorId: string | null;
  procedureId: string | null;
  name: string;
  /** 이미 정규화된 값. 정규화는 서비스가 한다. */
  phone: string;
  preferredTime: string;
  message: string;
  /** 담당자 알림 문구. 문구 조립은 서비스의 몫이다. */
  notificationTitle: string;
  notificationMessage: string;
}

export interface UpdateStatusParams {
  consultRequestId: string;
  status: string;
  changedByUserId: string;
  /** 신청자에게 갈 알림. */
  requesterUserId: string;
  notificationTitle: string;
  notificationMessage: string;
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
      // 최신순. 같은 시각이 가능하므로 id tiebreaker 를 더한다.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  async count(where: Prisma.ConsultRequestWhereInput): Promise<number> {
    return this.prisma.consultRequest.count({ where });
  }

  async findById(id: string): Promise<ConsultRequestRow | null> {
    return this.prisma.consultRequest.findUnique({ where: { id }, include: CONSULT_INCLUDE });
  }

  /**
   * 상담 접수 한 트랜잭션.
   * 1. `consult_requests` 행
   * 2. `new` 상태 이력 — 시드 데이터가 전부 이 형태다(생성 시각 = 첫 이력 시각)
   * 3. 담당자 전원에게 알림
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
          preferredTime: params.preferredTime,
          message: params.message,
          status: 'new',
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.consultStatusChange.create({
        data: { id: createId(), consultRequestId: id, status: 'new', changedAt: now, changedByUserId: null },
      });

      await createNotificationWithRecipients(
        tx,
        {
          audience: 'admin',
          type: 'consult-status',
          title: params.notificationTitle,
          message: params.notificationMessage,
          relatedType: 'consult_request',
          relatedId: id,
          hospitalId: params.hospitalId,
          recipientUserIds: await findHospitalAdminUserIds(tx, params.hospitalId),
        },
        now,
      );
    });

    return id;
  }

  /**
   * 상태 변경 한 트랜잭션. 상태 갱신 + 이력 + 신청자 알림.
   *
   * **같은 상태인지 판정은 서비스가 한다.** 여기까지 오면 실제로 바뀌는 것이다 —
   * 그래야 이력과 알림이 항상 짝을 이룬다.
   */
  async updateStatus(params: UpdateStatusParams): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.consultRequest.update({
        where: { id: params.consultRequestId },
        data: { status: params.status, updatedAt: now },
      });

      await tx.consultStatusChange.create({
        data: {
          id: createId(),
          consultRequestId: params.consultRequestId,
          status: params.status,
          changedAt: now,
          changedByUserId: params.changedByUserId,
        },
      });

      await createNotificationWithRecipients(
        tx,
        {
          audience: 'user',
          type: 'consult-status',
          title: params.notificationTitle,
          message: params.notificationMessage,
          relatedType: 'consult_request',
          relatedId: params.consultRequestId,
          recipientUserIds: [params.requesterUserId],
        },
        now,
      );
    });
  }

  async addMemo(consultRequestId: string, content: string, authorUserId: string): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.consultMemo.create({
        data: { id: createId(), consultRequestId, content, authorUserId, createdAt: now },
      });

      // 메모는 상담을 만졌다는 뜻이라 `updatedAt` 을 함께 민다 — 목록의 "최근 처리" 판단 근거다.
      await tx.consultRequest.update({ where: { id: consultRequestId }, data: { updatedAt: now } });
    });
  }

  /** 요약 카드용 두 숫자. 달 경계는 서비스가 `Asia/Seoul` 로 계산해 넘긴다. */
  async summaryCounts(
    scope: Prisma.ConsultRequestWhereInput,
    monthStart: Date,
  ): Promise<{ newThisMonth: number; pending: number }> {
    const [newThisMonth, pending] = await Promise.all([
      this.prisma.consultRequest.count({ where: { ...scope, createdAt: { gte: monthStart } } }),
      this.prisma.consultRequest.count({ where: { ...scope, status: 'new' } }),
    ]);

    return { newThisMonth, pending };
  }

  /** 신청자 id 만. 상태 변경 알림의 수신자를 찾는 용도다. */
  async findOwnerUserId(consultRequestId: string): Promise<string | null> {
    const row = await this.prisma.consultRequest.findUnique({
      where: { id: consultRequestId },
      select: { userId: true },
    });

    return row?.userId ?? null;
  }
}
