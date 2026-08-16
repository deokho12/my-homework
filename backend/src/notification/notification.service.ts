import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from '../common/errors/api-error';
import { buildPageMeta } from '../common/pagination';
import type { PageMeta } from '../common/pagination';
import { projectNotification } from './notification.projection';
import type { AppNotificationResponse } from './notification.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NotificationRepository } from './notification.repository';
import type { ListNotificationsQuery, NotificationAudienceValue } from './notification.schemas';

export interface NotificationListResult {
  items: AppNotificationResponse[];
  meta: PageMeta;
}

export interface UnreadCountResult {
  audience: NotificationAudienceValue;
  unreadCount: number;
}

export interface MarkAllReadResult {
  audience: NotificationAudienceValue;
  updated: number;
}

/** `audience=admin` 알림함을 열 수 있는 역할. 문구에 고객 이름이 들어 있다. */
const ADMIN_MAILBOX_ROLES = new Set(['hospital_admin', 'operator']);

@Injectable()
export class NotificationService {
  constructor(private readonly notifications: NotificationRepository) {}

  /**
   * 알림함 접근 판정. **`@Roles` 로 못 하는 이유는 역할이 아니라 쿼리 값에 달려 있기
   * 때문이다** — 같은 라우트가 `audience=user` 면 누구나, `audience=admin` 이면
   * 담당자·운영자만이다.
   *
   * `audience=user` 를 세 역할 모두에게 여는 것은 계약이 명시했다 — 병원 담당자도
   * 개인으로서 상담을 신청하므로 본인 알림함이 필요하다.
   */
  private assertCanRead(audience: NotificationAudienceValue, actor: AuthenticatedUser): void {
    if (audience === 'admin' && !ADMIN_MAILBOX_ROLES.has(actor.role)) {
      throw new ApiError('FORBIDDEN');
    }
  }

  /**
   * 수신자 스코프. **이 where 가 이 조각의 🔴 을 닫는다** — 내 수신자 행에서만
   * 출발하므로 남의 알림이 구조적으로 섞일 수 없다.
   */
  private scope(
    audience: NotificationAudienceValue,
    actor: AuthenticatedUser,
  ): Prisma.NotificationRecipientWhereInput {
    return { userId: actor.id, notification: { audience } };
  }

  async list(query: ListNotificationsQuery, actor: AuthenticatedUser): Promise<NotificationListResult> {
    this.assertCanRead(query.audience, actor);

    const where = this.scope(query.audience, actor);

    if (query.isRead !== undefined) {
      where.readAt = query.isRead ? { not: null } : null;
    }

    if (query.type !== undefined) {
      where.notification = { audience: query.audience, type: query.type };
    }

    const [rows, totalItems] = await Promise.all([
      this.notifications.findMany(where, {
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.notifications.count(where),
    ]);

    return {
      items: rows.map((row) => projectNotification(row)),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
    };
  }

  async unreadCount(
    audience: NotificationAudienceValue,
    actor: AuthenticatedUser,
  ): Promise<UnreadCountResult> {
    this.assertCanRead(audience, actor);

    const unreadCount = await this.notifications.count({ ...this.scope(audience, actor), readAt: null });

    return { audience, unreadCount };
  }

  /**
   * 하나 읽음. **멱등이다** — 이미 읽었으면 시각을 그대로 두고 현재 상태를 돌려준다.
   *
   * 내 수신자 행이 없으면 `404` 다. 남의 알림과 없는 알림을 구분하지 않는다 — 관리자
   * 알림 문구에는 고객 이름이 들어 있어서, 존재 여부만으로도 알려 줄 것이 아니다.
   */
  async markAsRead(notificationId: string, actor: AuthenticatedUser): Promise<AppNotificationResponse> {
    const existing = await this.notifications.findOneForUser(notificationId, actor.id);

    if (existing === null) {
      throw new ApiError('NOTIFICATION_NOT_FOUND');
    }

    if (existing.readAt !== null) {
      return projectNotification(existing);
    }

    const readAt = new Date();

    await this.notifications.markRead({ notificationId, userId: actor.id }, readAt);

    return projectNotification({ ...existing, readAt });
  }

  /**
   * 모두 읽음. `audience` 가 필수라 **반대쪽 알림함은 건드리지 않는다** — 화면 문서가
   * 양쪽 모두 그렇게 명시한다.
   */
  async markAllAsRead(
    audience: NotificationAudienceValue,
    actor: AuthenticatedUser,
  ): Promise<MarkAllReadResult> {
    this.assertCanRead(audience, actor);

    const updated = await this.notifications.markRead(this.scope(audience, actor), new Date());

    return { audience, updated };
  }
}
