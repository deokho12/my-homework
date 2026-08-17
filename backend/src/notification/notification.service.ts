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
  /**
   * 이 알림함의 안 읽은 **전체** 개수. 페이지네이션과 무관하다.
   *
   * 계약이 목록 응답에 이 값을 넣은 이유는 왕복을 줄이기 위해서다 — 알림함 화면은
   * 목록과 배지를 함께 그리는데, 없으면 `unread-count` 를 한 번 더 불러야 한다.
   */
  unreadCount: number;
}

export interface UnreadCountResult {
  audience: NotificationAudienceValue;
  unreadCount: number;
}

export interface MarkAllReadResult {
  audience: NotificationAudienceValue;
  /** 이번 호출로 읽음이 된 개수. */
  markedCount: number;
  /** 처리 후 남은 안 읽은 개수. 이 알림함을 다 읽었으므로 항상 0 이다(계약). */
  unreadCount: number;
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

    const [rows, totalItems, unreadCount] = await Promise.all([
      this.notifications.findMany(where, {
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.notifications.count(where),
      // 안 읽은 수는 **필터와 무관하게** 그 알림함 전체를 센다 — 배지가 목록 필터에
      // 따라 달라지면 세 화면이 같은 숫자를 보여야 한다는 규칙이 깨진다.
      this.notifications.count({ ...this.scope(query.audience, actor), readAt: null }),
    ]);

    return {
      items: rows.map((row) => projectNotification(row)),
      meta: buildPageMeta({ page: query.page, pageSize: query.pageSize, totalItems }),
      unreadCount,
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

    // 목록과 같은 알림함 규칙을 여기에도 적용한다. 담당자였다가 일반 사용자로 강등된
    // 계정은 수신자 행이 남아 있어서, 이 검사가 없으면 목록으로는 못 보는 관리자 알림
    // 본문(고객 실명이 들어 있다)을 id 만으로 응답에서 읽을 수 있다.
    this.assertCanRead(existing.notification.audience as NotificationAudienceValue, actor);

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

    const markedCount = await this.notifications.markRead(this.scope(audience, actor), new Date());

    // 이 알림함을 다 읽었으므로 0 이다. 계약이 값을 함께 요구하는 이유는 화면이 배지를
    // 다시 조회하지 않고 바로 지울 수 있게 하기 위해서다.
    return { audience, markedCount, unreadCount: 0 };
  }
}
