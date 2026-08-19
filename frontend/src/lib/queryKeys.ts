import type { NotificationAudience } from '@/types/domain';

/**
 * 쿼리 키의 단일 출처. 무효화 대상을 문자열 리터럴로 흩뿌리면
 * mutation 이 어느 캐시를 깨야 하는지 추적할 수 없게 되므로 한 곳에 모은다.
 * 새 feature 를 추가할 때 여기에 항목을 더한다.
 */
export const queryKeys = {
  hospitals: {
    all: ['hospitals'] as const,
    /** 필터별로 캐시를 가른다. `all` 은 무효화 접두사로 남긴다 — mutation 이 목록·상세를 한 번에 깬다. */
    list: (filters: object = {}) => ['hospitals', 'list', filters] as const,
    /** 상세. 형제 키(`'list'`·`'managed'`)와 섞이지 않도록 `detail` 을 낀다 — 네 리소스가 같은 모양이다. */
    detail: (id: string) => ['hospitals', 'detail', id] as const,
    /** `GET /admin/hospitals`. `all` 로 시작하므로 병원 mutation 이 함께 무효화한다. */
    managed: (filters: object = {}) => ['hospitals', 'managed', filters] as const,
  },
  doctors: {
    all: ['doctors'] as const,
    /** 필터별로 캐시를 가른다. `all` 은 무효화 접두사로 남긴다 — mutation 이 목록·상세를 한 번에 깬다. */
    list: (filters: object = {}) => ['doctors', 'list', filters] as const,
    /** 상세. 형제 키(`'list'`·`'byHospital'`·`'verification-queue'`)와 섞이지 않도록 `detail` 을 낀다. */
    detail: (id: string) => ['doctors', 'detail', id] as const,
    byHospital: (hospitalId: string) => ['doctors', 'byHospital', hospitalId] as const,
    /** `GET /doctors/verification-queue`. `all` 로 시작하므로 전문의 mutation 이 함께 무효화한다. */
    verificationQueue: (filters: object = {}) => ['doctors', 'verification-queue', filters] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    byHospital: (hospitalId: string, filters: object = {}) => ['reviews', 'byHospital', hospitalId, filters] as const,
  },
  consultRequests: {
    all: ['consultRequests'] as const,
    /** `GET /consult-requests` (관리자 목록). 상태 필터별로 캐시를 가른다. */
    list: (filters: object = {}) => ['consultRequests', 'list', filters] as const,
    /** `GET /consult-requests/summary`. 상태 변경이 이 숫자를 바꾸므로 `all` 무효화에 함께 걸린다. */
    summary: ['consultRequests', 'summary'] as const,
    /** `GET /me/consult-requests`. 관리자 목록과 투영이 달라 캐시도 따로 둔다. */
    mine: (filters: object = {}) => ['consultRequests', 'mine', filters] as const,
    /**
     * 상세. **`'list'`·`'summary'`·`'mine'` 같은 형제 키와 섞이지 않도록 `detail` 을 낀다** —
     * `['consultRequests', id]` 형태였을 때는 id 가 `'summary'` 이기만 하면 두 캐시가 같은 키였다.
     */
    detail: (id: string) => ['consultRequests', 'detail', id] as const,
  },
  communityPosts: {
    all: ['communityPosts'] as const,
    list: (filters: object = {}) => ['communityPosts', 'list', filters] as const,
    /** 형제 키(`'list'`)와 섞이지 않도록 `detail` 을 낀다. `consultRequests.detail` 과 같은 이유다. */
    detail: (id: string) => ['communityPosts', 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    /** 알림함(mailbox)별로 캐시를 가른다 — `모두 읽음` 이 한쪽만 처리해야 하는 것과 같은 단위다. */
    byAudience: (audience: NotificationAudience, filters: object = {}) =>
      ['notifications', audience, 'list', filters] as const,
    /**
     * `GET /notifications/unread-count`. 목록과 다른 키인 이유: 배지(마이페이지·상단바·관리자 홈)는
     * 목록 없이 숫자만 필요하다. 접두사가 `['notifications', audience]` 라 알림함 단위 무효화에 함께 걸린다.
     */
    unreadCount: (audience: NotificationAudience) => ['notifications', audience, 'unread-count'] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    /** `GET /me/favorites`. 계정에 딸린 목록이라 로그아웃 시 캐시째 사라져야 한다. */
    mine: ['favorites', 'mine'] as const,
  },
  legalDocuments: {
    /** 회원가입 동의에 실을 현재 약관 버전 3개. */
    agreementVersions: ['legalDocuments', 'agreementVersions'] as const,
  },
  procedures: {
    /** 13종 고정 마스터 데이터. 필터가 없어 무효화 접두사와 조회 키가 같다. */
    all: ['procedures'] as const,
  },
} as const;
