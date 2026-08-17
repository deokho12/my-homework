import { NotificationInbox } from '@/features/notification/components/NotificationInbox';

/**
 * 사용자 알림함. 본체는 관리자 알림함과 공유한다 — 다른 것은 `audience` 하나뿐이고
 * 그 값이 서버 쿼리와 이동 경로를 함께 정한다.
 */
export default function NotificationsScreen() {
  return <NotificationInbox audience="user" />;
}
