import type { NotificationAudience } from '@/types/domain';

/**
 * 쿼리 키의 단일 출처. 무효화 대상을 문자열 리터럴로 흩뿌리면
 * mutation 이 어느 캐시를 깨야 하는지 추적할 수 없게 되므로 한 곳에 모은다.
 * 새 feature 를 추가할 때 여기에 항목을 더한다.
 */
export const queryKeys = {
  hospitals: {
    all: ['hospitals'] as const,
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
} as const;
