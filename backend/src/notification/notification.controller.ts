import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AppNotificationResponse } from './notification.projection';
import {
  listNotificationsQuerySchema,
  markAllReadSchema,
  unreadCountQuerySchema,
} from './notification.schemas';
import type { ListNotificationsQuery, MarkAllReadDto, UnreadCountQuery } from './notification.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NotificationService } from './notification.service';
import type { MarkAllReadResult, NotificationListResult, UnreadCountResult } from './notification.service';

/**
 * 알림함. **모든 라우트가 인증을 요구한다** — 지금은 로그인하지 않아도
 * `/notifications` 주소로 알림이 보인다(계약이 명시적으로 지적한 상태다).
 *
 * `@Roles` 를 붙이지 않는 이유: 접근 판정이 역할이 아니라 **`audience` 쿼리 값**에
 * 달려 있다. `audience=user` 는 세 역할 모두, `audience=admin` 은 담당자·운영자만이다.
 * 그 판정은 `NotificationService.assertCanRead` 한 곳에 있다.
 *
 * 개인 알림은 캐시하면 안 된다 — 관리자 알림 문구에 고객 이름이 들어 있다.
 * `@Header` 는 **메서드 데코레이터라 클래스에 붙지 않는다.** 조회 라우트마다 붙인다.
 */
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationListResult> {
    return this.notifications.list(query, user);
  }

  /**
   * 배지 전용. 목록과 나눈 이유는 계약에 있다 — 배지는 거의 모든 화면에서 필요한데
   * 그때마다 목록 전체(=고객 이름이 든 문구)를 받아오는 것은 낭비이자 노출이다.
   *
   * **`:notificationId` 라우트보다 먼저 선언한다.** 같은 `GET /notifications/*` 모양이라
   * 순서가 바뀌면 `unread-count` 가 id 로 잡힌다.
   */
  @Get('unread-count')
  @Header('Cache-Control', 'no-store')
  unreadCount(
    @Query(new ZodValidationPipe(unreadCountQuerySchema)) query: UnreadCountQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountResult> {
    return this.notifications.unreadCount(query.audience, user);
  }

  @Patch(':notificationId/read')
  markAsRead(
    @Param('notificationId') notificationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AppNotificationResponse> {
    return this.notifications.markAsRead(notificationId, user);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(
    @Body(new ZodValidationPipe(markAllReadSchema)) dto: MarkAllReadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MarkAllReadResult> {
    return this.notifications.markAllAsRead(dto.audience, user);
  }
}
