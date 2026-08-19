export {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type MarkAllReadResult,
  type NotificationFilters,
  type NotificationList,
  type UnreadNotificationCount,
} from '@/features/notification/api/notificationApi';
export { useMarkAllNotificationsAsRead } from '@/features/notification/hooks/useMarkAllNotificationsAsRead';
export { useMarkNotificationAsRead } from '@/features/notification/hooks/useMarkNotificationAsRead';
export { useNotifications } from '@/features/notification/hooks/useNotifications';
export { useUnreadNotificationCount } from '@/features/notification/hooks/useUnreadNotificationCount';
