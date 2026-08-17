import { NotificationInbox } from '@/features/notification/components/NotificationInbox';

/**
 * 관리자 알림함. `audience=admin` 은 담당자·운영자만 열 수 있다(서버가 403 으로 막는다) —
 * 알림 문구에 고객 이름이 들어 있기 때문이다.
 *
 * 담당자에게는 **담당 병원에 들어온 알림**만 보인다. 운영자는 현재 어떤 알림도 수신자로
 * 지정하지 않으므로 빈 목록이 정상이다.
 */
export default function AdminNotificationsScreen() {
  return <NotificationInbox audience="admin" />;
}
