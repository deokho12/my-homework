/**
 * 알림 시드 데이터. 조각 2 에서 `frontend/src/mocks/fixtures/notifications.ts` 에서
 * 옮겨왔다 — 알림이 서버로 이관되면서 DB 가 원본이 됐다.
 *
 * **프론트의 `AppNotification` 타입을 쓰지 않는다.** 그 타입은 이제 *응답* 모양이라
 * `isRead`(수신자별 계산 필드)와 `relatedResource`(서버가 `related_type` 에서 투영)를
 * 포함한다. 시드는 *저장* 모양이다.
 *
 * `isRead` 는 여기 남는다 — 시드가 이 값으로 `notification_recipients.read_at` 을
 * 채운다. 읽음은 알림이 아니라 **수신자**에 달려 있어서, 같은 알림을 받은 담당자
 * 셋의 읽음 상태가 각자 간다.
 *
 * `relatedType` 은 여기 없다. 시드가 `relatedId` 가 상담 id 인지 보고 유도한다
 * (`prisma/seed.ts` §11) — fixture 에 적으면 두 곳이 갈릴 수 있다.
 */

export interface NotificationSeedRow {
  id: string;
  /** 역할이 아니라 알림함이다. 화면이 둘뿐이라 값도 둘이다. */
  audience: 'user' | 'admin';
  type: 'consult-status' | 'event' | 'system';
  /** 짧은 명사구. */
  title: string;
  /** 구체적 사실을 담은 한 문장. 마침표를 붙이지 않는다. */
  message: string;
  isRead: boolean;
  createdAt: string;
  /** 상담 id 이면 시드가 `related_type='consult_request'` 를 함께 넣는다. */
  relatedId: string | null;
}

// 사용자·관리자 알림함과 배지가 처음부터 의미 있는 상태를 보이도록 audience/type/isRead 를
// 섞어 두었다. `consult-status` 의 `relatedId` 는 `./consult-requests.ts` 의 상담을 가리킨다.
export const notifications: NotificationSeedRow[] = [
  {
    id: 'notif1',
    audience: 'user',
    type: 'consult-status',
    title: '상담 상태 변경',
    message: "상담 상태가 '예약완료'(으)로 변경되었어요",
    isRead: false,
    createdAt: '2026-07-18T11:45:00.000Z',
    relatedId: 'cr3',
  },
  {
    id: 'notif2',
    audience: 'user',
    type: 'event',
    title: '여름 이벤트 오픈',
    message: '임플란트 무료상담 이벤트가 진행중이에요',
    isRead: true,
    createdAt: '2026-07-10T02:00:00.000Z',
    relatedId: null,
  },
  {
    id: 'notif3',
    audience: 'user',
    type: 'system',
    title: '앱 업데이트 안내',
    message: '새로운 기능이 추가되었어요',
    isRead: true,
    createdAt: '2026-06-30T01:00:00.000Z',
    relatedId: null,
  },
  {
    id: 'notif4',
    audience: 'admin',
    type: 'consult-status',
    title: '새로운 상담 신청',
    message: '김민준님이 상담을 신청했어요',
    isRead: false,
    createdAt: '2026-07-28T09:15:00.000Z',
    relatedId: 'cr1',
  },
  {
    id: 'notif5',
    audience: 'admin',
    type: 'consult-status',
    title: '새로운 상담 신청',
    message: '이서연님이 상담을 신청했어요',
    isRead: false,
    createdAt: '2026-07-29T13:40:00.000Z',
    relatedId: 'cr6',
  },
  {
    id: 'notif6',
    audience: 'admin',
    type: 'system',
    title: '정기 점검 안내',
    message: '7/31 새벽 서버 점검이 예정되어 있어요',
    isRead: true,
    createdAt: '2026-07-25T15:00:00.000Z',
    relatedId: null,
  },
  {
    id: 'notif7',
    audience: 'user',
    type: 'consult-status',
    title: '상담 상태 변경',
    message: "상담 상태가 '연락중'(으)로 변경되었어요",
    isRead: true,
    createdAt: '2026-07-22T10:30:00.000Z',
    relatedId: 'cr2',
  },
];
