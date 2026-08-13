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
    detail: (id: string) => ['hospitals', id] as const,
  },
  doctors: {
    all: ['doctors'] as const,
    detail: (id: string) => ['doctors', id] as const,
    byHospital: (hospitalId: string) => ['doctors', 'byHospital', hospitalId] as const,
  },
  consultRequests: {
    all: ['consultRequests'] as const,
    detail: (id: string) => ['consultRequests', id] as const,
  },
  communityPosts: {
    all: ['communityPosts'] as const,
    detail: (id: string) => ['communityPosts', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    byAudience: (audience: NotificationAudience) => ['notifications', audience] as const,
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
