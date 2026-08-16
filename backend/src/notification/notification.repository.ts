import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_RECIPIENT_INCLUDE } from './notification.projection';
import type { NotificationRecipientRow } from './notification.projection';

export interface FindManyOptions {
  skip: number;
  take: number;
}

/**
 * 알림 조회는 전부 **`notification_recipients` 에서 출발한다.**
 *
 * `notifications` 에서 출발하면 "나에게 온 것" 을 알 수 없어 전체가 보인다 —
 * 지금 화면이 정확히 그 상태다(로그인한 아무 계정이나 모든 알림을 본다).
 * 수신자 행에서 시작하면 스코프가 쿼리 구조 자체로 보장된다.
 */
@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(
    where: Prisma.NotificationRecipientWhereInput,
    options: FindManyOptions,
  ): Promise<NotificationRecipientRow[]> {
    return this.prisma.notificationRecipient.findMany({
      where,
      include: NOTIFICATION_RECIPIENT_INCLUDE,
      // 최신순. 같은 시각이 가능하므로 id tiebreaker 를 더한다.
      orderBy: [{ notification: { createdAt: 'desc' } }, { id: 'asc' }],
      skip: options.skip,
      take: options.take,
    });
  }

  async count(where: Prisma.NotificationRecipientWhereInput): Promise<number> {
    return this.prisma.notificationRecipient.count({ where });
  }

  /** 내 수신자 행 하나. 없으면 `null` — 남의 알림도 없는 알림도 똑같이 null 이다. */
  async findOneForUser(notificationId: string, userId: string): Promise<NotificationRecipientRow | null> {
    return this.prisma.notificationRecipient.findUnique({
      where: { notificationId_userId: { notificationId, userId } },
      include: NOTIFICATION_RECIPIENT_INCLUDE,
    });
  }

  /**
   * 안 읽은 것만 읽음으로 바꾼다.
   *
   * `readAt: null` 조건을 빼면 이미 읽은 알림의 시각이 갱신되어, "언제 읽었나" 가
   * `모두 읽음` 을 누를 때마다 뒤로 밀린다.
   */
  async markRead(where: Prisma.NotificationRecipientWhereInput, readAt: Date): Promise<number> {
    const result = await this.prisma.notificationRecipient.updateMany({
      where: { ...where, readAt: null },
      data: { readAt },
    });

    return result.count;
  }
}
