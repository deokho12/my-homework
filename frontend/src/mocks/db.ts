import { consultRequests as seedConsultRequests } from '@/mocks/fixtures/consultRequests';
import { notifications as seedNotifications } from '@/mocks/fixtures/notifications';
import { qaPosts as seedQaPosts } from '@/mocks/fixtures/qaPosts';
import type {
  AppNotification,
  ConsultRequest,
  QAPost,
} from '@/types/domain';

/**
 * 백엔드 대역. 실제 서버가 생기면 features/{f}/api/ 가 HTTP 를 부르게 되고
 * 이 모듈은 삭제된다. 그때까지 영속화 책임은 여기에 있다 — Zustand persist 가
 * 아니다. 서버성 데이터를 TanStack Query 가 관리하는데 Zustand 도 같은 값을
 * 붙들고 있으면 두 캐시가 어긋나기 때문이다.
 *
 * `hospitals`·`doctors` 는 실제 API 로 옮겨가며 여기서 빠졌다(Task 20). 남은 세
 * 테이블(`consultRequests`·`communityPosts`·`notifications`)은 아직 이 목 DB 가
 * 원본이다 — 각자의 이전 조각이 끝나면 함께 빠진다.
 */
interface Tables {
  consultRequests: ConsultRequest[];
  communityPosts: QAPost[];
  notifications: AppNotification[];
}

export type MockTable = keyof Tables;

const STORAGE_PREFIX = 'molarmolar-mockdb-';

const SEEDS: Tables = {
  consultRequests: seedConsultRequests,
  communityPosts: seedQaPosts,
  notifications: seedNotifications,
};

/**
 * 이 앱을 이미 써 본 브라우저에는 zustand persist 가 만든 키에 사용자 데이터가 있다.
 * 목 DB 로 옮기면서 그걸 버리면 신청했던 상담과 작성한 글이 사라지므로 최초 1회 흡수한다.
 * 키와 안쪽 필드 이름은 각 스토어의 persist 설정에서 그대로 가져온 값이다.
 */
const LEGACY_SOURCES: Record<MockTable, { key: string; field: string }> = {
  consultRequests: { key: 'molarmolar-consult-requests', field: 'requests' },
  communityPosts: { key: 'molarmolar-community-posts', field: 'posts' },
  notifications: { key: 'molarmolar-notifications', field: 'notifications' },
};

function readLegacy<K extends MockTable>(table: K): Tables[K] | null {
  const { key, field } = LEGACY_SOURCES[table];

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const rows = parsed.state?.[field];
    return Array.isArray(rows) ? (rows as Tables[K]) : null;
  } catch {
    // 손상된 값 때문에 앱이 뜨지 않는 것보다 seed 로 떨어지는 편이 낫다.
    return null;
  }
}

const cache = new Map<MockTable, unknown>();

export const mockDb = {
  read<K extends MockTable>(table: K): Tables[K] {
    const cached = cache.get(table);
    if (cached) return cached as Tables[K];

    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${table}`);
    let rows: Tables[K];

    if (raw) {
      rows = JSON.parse(raw) as Tables[K];
    } else {
      rows = readLegacy(table) ?? (SEEDS[table] as Tables[K]);
      window.localStorage.setItem(`${STORAGE_PREFIX}${table}`, JSON.stringify(rows));
    }

    cache.set(table, rows);
    return rows;
  },

  write<K extends MockTable>(table: K, rows: Tables[K]): void {
    cache.set(table, rows);
    window.localStorage.setItem(`${STORAGE_PREFIX}${table}`, JSON.stringify(rows));
  },

  /** 메모리 캐시만 비운다. localStorage 는 유지된다. 테스트용. */
  reset(): void {
    cache.clear();
  },
};
