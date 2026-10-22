/**
 * =============================================================================
 * 공지 알림 3건 — **상담에서 파생되지 않는 알림만 여기 있다** (요청서 15, DB §12.13-D)
 * =============================================================================
 *
 * 상담 알림(접수·상태 변경·일시 변경)은 **여기 없다.** `data/consult-requests.ts` 의 처리
 * 이벤트에서 시드가 파생시키고(id `ntf-{상담id}-{i}`), **문구는 서버의 순수 함수
 * `src/consult/notification-text.ts` 를 불러서 만든다** — 문자열을 적어 두면 문구를 다듬는
 * 날 시드와 런타임이 조용히 갈린다 (AGENTS.md "같은 판정을 두 곳에 두지 않는다").
 *
 * 이 3건이 남아 있는 이유는 **알림함의 나머지 아이콘 두 종류(`이벤트`·`안내`)와 fan-out
 * 경로**를 살려 두기 위해서다. 상담 알림은 수신자가 1~1명이라, 한 알림이 여러 계정에
 * 꽂히는 경로는 이 셋으로만 확인된다.
 *
 * **브랜치 `origin/hospital-doctor-domain-api` 의 같은 이름 파일은 쓰지 않고 새로 썼다.**
 * 그쪽 파일은 옛 fixture 의 `notif1`~`notif7` 을 그대로 옮긴 것이라, 상담 알림을 이벤트에서
 * 파생시키는 지금 설계(문구는 `src/consult/notification-text.ts` 가 만든다)와 맞지 않는다.
 *
 * 옛 fixture 의 `notif1`~`notif7` 은 **버린다** (§8.1 원칙 1 의 예외). 알림 id 를 가리키는
 * URL·화면 문서가 없고(알림은 `relatedId` 로 이동한다), 이벤트에서 파생되는 결정적 id 라야
 * 샘플을 고칠 때 재실행이 중복을 만들지 않는다.
 */
import type { SeedMoment } from './consult-requests';

export interface SeedAnnouncement {
  id: string;
  audience: 'user' | 'admin';
  /** `event` = 이벤트 안내, `system` = 서비스 공지. 상담과 무관하다. */
  type: 'event' | 'system';
  title: string;
  message: string;
  createdAt: SeedMoment;
  /**
   * 수신자 집합. `applicants` = 사용자 7명, `hospitalAdmins` = 병원 담당자 11명.
   * **운영자는 어느 쪽에도 없다** — 지금 운영자를 수신자로 지정하는 알림이 없고,
   * 운영자의 관리자 알림함이 비어 있는 것이 정상이다 (계약).
   */
  recipients: 'applicants' | 'hospitalAdmins';
}

/**
 * 공지 3건은 **읽음**이다(`read_at` = 생성 시각). 상담에서 파생된 알림이 전부 안 읽음이라,
 * 상단 🔔 배지와 알림함의 안 읽음 표시가 첫 로그인부터 보이고 `PATCH .../read` 를 QA 가
 * 눌러 볼 대상도 그쪽이다.
 */
export const announcements: SeedAnnouncement[] = [
  {
    id: 'ntf-event-1',
    audience: 'user',
    type: 'event',
    title: '여름 이벤트 오픈',
    message: '임플란트 무료상담 이벤트가 진행중이에요',
    createdAt: { day: -2, time: '11:00' },
    recipients: 'applicants',
  },
  {
    id: 'ntf-system-1',
    audience: 'user',
    type: 'system',
    title: '앱 업데이트 안내',
    message: '새로운 기능이 추가되었어요',
    createdAt: { day: -6, time: '10:00' },
    recipients: 'applicants',
  },
  {
    id: 'ntf-system-2',
    audience: 'admin',
    type: 'system',
    title: '정기 점검 안내',
    // 날짜를 문구에 박지 않는다 — 시드 날짜가 매번 달라서 `7/31` 같은 값은 반드시 거짓이 된다.
    message: '이번 주 새벽 서버 점검이 예정되어 있어요',
    createdAt: { day: -1, time: '09:00' },
    recipients: 'hospitalAdmins',
  },
];
