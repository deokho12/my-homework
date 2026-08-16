import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../common/pagination';

/**
 * `audience` 는 **역할이 아니라 알림함**이다. 역할은 셋이지만 화면은 둘뿐이라
 * (`/notifications`, `/admin/notifications`) 값도 둘이다.
 *
 * 계약이 이 값을 **필수**로 둔 이유는 `모두 읽음` 때문이다 — 한쪽 알림함만 처리해야
 * 하는데 생략을 허용하면 그 규칙이 우연히 깨진다.
 */
export const notificationAudienceSchema = z.enum(['user', 'admin']);

export type NotificationAudienceValue = z.infer<typeof notificationAudienceSchema>;

export const listNotificationsQuerySchema = z.object({
  audience: notificationAudienceSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  /** 화면에는 아직 없다. 계약이 미리 열어 둔 필터다. */
  isRead: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  type: z.enum(['consult-status', 'event', 'system']).optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const unreadCountQuerySchema = z.object({ audience: notificationAudienceSchema });

export type UnreadCountQuery = z.infer<typeof unreadCountQuerySchema>;

export const markAllReadSchema = z.object({ audience: notificationAudienceSchema });

export type MarkAllReadDto = z.infer<typeof markAllReadSchema>;
