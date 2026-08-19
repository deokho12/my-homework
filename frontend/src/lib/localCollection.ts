import { consultRequests as seedConsultRequests } from '@/mocks/fixtures/consultRequests';
import { notifications as seedNotifications } from '@/mocks/fixtures/notifications';
import { qaPosts as seedQaPosts } from '@/mocks/fixtures/qaPosts';
import type { AppNotification, ConsultRequest, Paged, QAPost } from '@/types/domain';

/**
 * 아직 서버가 없는 도메인(상담·찜·알림·커뮤니티)의 **저장소 대역**이다.
 *
 * ## 이 파일의 존재 이유
 *
 * **앱에서 `localStorage` 를 만지는 유일한 파일이다** — 예외는 토큰을 다루는
 * `lib/authTokens.ts` 하나뿐이다. 각 feature 의 `api` 폴더(그리고 로그아웃 때 찜을 비우는
 * `store/useAuthStore.ts`)만 이 모듈을 부르고, 훅·화면·컴포넌트는 저장 위치를 모른다.
 * 그래서 백엔드가 생기면
 * **api 함수 본문을 `apiRequest(...)` 로 바꾸고 이 파일을 통째로 지우면** 끝이고,
 * 화면 코드는 한 줄도 바뀌지 않는다.
 *
 * Zustand `persist` 를 걷어낸 이유도 같다 — 서버성 데이터를 TanStack Query 가 캐시하는데
 * Zustand 도 같은 값을 붙들고 있으면 두 캐시가 조용히 어긋난다.
 */

interface LocalCollections {
  consultRequests: ConsultRequest[];
  communityPosts: QAPost[];
  notifications: AppNotification[];
  /** 찜한 병원 id. 최근에 찜한 것이 앞이다 (`FavoriteList.hospitalIds` 와 같은 순서 규약). */
  favoriteHospitalIds: string[];
}

export type LocalCollectionName = keyof LocalCollections;

const STORAGE_PREFIX = 'molarmolar-local-';

const SEEDS: LocalCollections = {
  consultRequests: seedConsultRequests,
  communityPosts: seedQaPosts,
  notifications: seedNotifications,
  // 찜은 목업 시드가 없다. 빈 목록에서 시작하는 것이 원래 동작이다.
  favoriteHospitalIds: [],
};

/**
 * 이 앱을 이미 써 본 브라우저에는 zustand `persist` 가 만든 키에 사용자 데이터가 들어 있다.
 * 그대로 버리면 신청했던 상담·작성한 글·찜이 사라지므로 **최초 1회만** 흡수한다.
 * 키와 안쪽 필드 이름은 삭제된 각 스토어의 persist 설정에서 그대로 가져온 값이다.
 */
const LEGACY_SOURCES: Record<LocalCollectionName, { key: string; field: string }> = {
  consultRequests: { key: 'molarmolar-consult-requests', field: 'requests' },
  communityPosts: { key: 'molarmolar-community-posts', field: 'posts' },
  notifications: { key: 'molarmolar-notifications', field: 'notifications' },
  favoriteHospitalIds: { key: 'molarmolar-favorites', field: 'hospitalIds' },
};

function readLegacy<K extends LocalCollectionName>(name: K): LocalCollections[K] | null {
  const { key, field } = LEGACY_SOURCES[name];

  const raw = safeGetItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const rows = parsed.state?.[field];

    return Array.isArray(rows) ? (rows as LocalCollections[K]) : null;
  } catch {
    // 손상된 값 하나 때문에 앱이 뜨지 않는 것보다 seed 로 떨어지는 편이 낫다.
    return null;
  }
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // 사생활 보호 모드 등에서 접근이 막힐 수 있다. 저장은 best-effort 다.
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 용량 초과·접근 차단. 메모리 캐시만으로도 그 세션 동안은 동작한다.
  }
}

/** 읽을 때마다 JSON 파싱을 반복하지 않도록 들고 있는다. 쓰기와 항상 함께 갱신된다. */
const cache = new Map<LocalCollectionName, unknown>();

export function readCollection<K extends LocalCollectionName>(name: K): LocalCollections[K] {
  const cached = cache.get(name);
  if (cached) return cached as LocalCollections[K];

  const raw = safeGetItem(`${STORAGE_PREFIX}${name}`);
  let rows: LocalCollections[K];

  if (raw) {
    try {
      rows = JSON.parse(raw) as LocalCollections[K];
    } catch {
      // 시드는 import 된 모듈 배열이다. 사본을 넣지 않으면 캐시가 그 원본을 들고 있게 되어,
      // 누군가 반환값을 제자리 정렬하면 fixture 가 세션 내내 오염된다.
      rows = cloneSeed(name);
    }
  } else {
    rows = readLegacy(name) ?? cloneSeed(name);
    safeSetItem(`${STORAGE_PREFIX}${name}`, JSON.stringify(rows));
  }

  cache.set(name, rows);

  return rows;
}

/** 시드 배열의 얕은 사본. 캐시가 import 된 fixture 원본을 참조하지 않게 한다. */
function cloneSeed<K extends LocalCollectionName>(name: K): LocalCollections[K] {
  return [...(SEEDS[name] as readonly unknown[])] as LocalCollections[K];
}

export function writeCollection<K extends LocalCollectionName>(name: K, rows: LocalCollections[K]): void {
  cache.set(name, rows);
  safeSetItem(`${STORAGE_PREFIX}${name}`, JSON.stringify(rows));
}

/** 메모리 캐시만 비운다. localStorage 는 그대로다. 테스트용. */
export function resetCollectionCache(): void {
  cache.clear();
}

/**
 * 컬렉션 하나를 빈 값으로 되돌린다. **엔드포인트가 없는 로컬 전용 조작이라 feature 의 `api`
 * 폴더가 아니라 여기 있다** — `api/*` 는 계약 함수만 담아 서버가 생기면 파일째 지울 수 있어야 한다.
 *
 * 지금 쓰는 곳은 로그아웃/로그인 시의 찜 비우기 하나다 (`store/useAuthStore.ts`).
 * 찜 목록이 계정과 연결되어 있지 않아 비우지 않으면 다음 계정에 이전 계정의 찜이 그대로 보인다.
 * 서버가 토큰 주체로 목록을 스코프하기 시작하면 그 호출은 사라지고 캐시만 비우면 된다.
 */
export function clearCollection(name: 'favoriteHospitalIds'): void {
  writeCollection(name, []);
}

/**
 * 로컬 배열을 계약의 `Paged<T>` 모양으로 자른다. 서버가 생기면 이 함수도 함께 사라진다 —
 * 페이지네이션은 서버의 책임이고, api 함수는 응답을 그대로 돌려주게 된다.
 *
 * 기본값은 openapi 의 `Page`/`PageSize` 파라미터와 같다 (`page=1`, `pageSize=20`, 상한 100).
 */
export function pageLocalRows<T>(rows: T[], page = 1, pageSize = 20): Paged<T> {
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);
  const safePage = Math.max(page, 1);
  const start = (safePage - 1) * safePageSize;

  return {
    items: rows.slice(start, start + safePageSize),
    meta: {
      page: safePage,
      pageSize: safePageSize,
      totalItems: rows.length,
      totalPages: Math.ceil(rows.length / safePageSize),
    },
  };
}

/**
 * 로컬에서 만든 레코드의 id. `Date.now()` 만 쓰면 같은 밀리초에 두 건이 생겼을 때 겹치므로
 * 증가 수열을 덧붙인다. 서버가 id 를 발급하기 시작하면 이 함수도 함께 사라진다.
 */
let idSequence = 0;

export function nextLocalId(prefix: string): string {
  idSequence += 1;

  return `${prefix}-${Date.now()}-${idSequence}`;
}
