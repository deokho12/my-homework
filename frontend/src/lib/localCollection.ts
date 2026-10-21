import { resolveLegacyProcedureId } from '@/features/procedure/taxonomy';
import { consultRequests as seedConsultRequests } from '@/mocks/fixtures/consultRequests';
import { notifications as seedNotifications } from '@/mocks/fixtures/notifications';
import { qaPosts as seedQaPosts } from '@/mocks/fixtures/qaPosts';
import type {
  AppNotification,
  ConsultRequest,
  ConsultStatusChange,
  HospitalInquiryAnswer,
  InquiryTopic,
  Paged,
  QAPost,
} from '@/types/domain';

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

/**
 * 저장된 상담 한 건. **도메인 타입이 아니다** — 서버라면 토큰에서 알아낼 "누가 신청했는가" 를
 * 로컬에서는 행에 적어 두는 수밖에 없어서 붙인 저장 전용 필드가 하나 있다.
 *
 * 선택 필드인 이유: `mocks/fixtures/consultRequests.ts`(백엔드 seed 가 import 하는 파일)에는
 * 이 값이 없고, 이 앱을 이미 쓴 브라우저에 남아 있는 행에도 없다.
 * 주인이 없는 행은 **누구의 것도 아니다** (`fetchMyConsultRequests` 가 걸러낸다).
 *
 * 서버 전환 시 삭제: `userId` 는 서버가 토큰에서 채운다.
 */
export interface StoredConsultRequest extends Omit<ConsultRequest, 'statusHistory'> {
  ownerUserId?: string;
  statusHistory: StoredConsultStatusChange[];
}

/**
 * 저장된 처리 이력 한 줄. 투영(`ConsultStatusChange`)과 다른 점은 하나다 — **어느 알림이
 * 이 이벤트로 나갔는지**를 들고 있고, 응답에는 boolean(`notified`)만 내려간다
 * (계약: 알림 상세로 가는 화면이 없는데 id 를 내리면 그 자리가 "갈 수 있다" 는 약속이 된다).
 *
 * 서버 전환 시 삭제: 서버는 `consult_status_changes.notification_id` 로 같은 것을 들고 있다.
 */
export interface StoredConsultStatusChange extends ConsultStatusChange {
  notificationId?: string;
}

/**
 * 저장된 병원 문의 한 건 (`docs/api/README.md` §14 `hospital_inquiries`).
 *
 * **상태(`status`)와 공개 노출 여부를 저장하지 않는다** — 둘 다 `answer` 에서 파생된다
 * (`features/inquiry/inquiryVisibility.ts`). 저장하면 같은 사실의 복사본이 둘이 되고,
 * 어긋날 때 **비공개 문의가 공개 목록에 뜬다.**
 *
 * 서버라면 조인으로 알아낼 값 셋이 로컬에서는 행에 적혀 있다 (서버 전환 시 삭제):
 * `ownerUserId`(토큰 주체), `askerDisplayName`(`users.name`), `hospitalName`(`hospitals.name`).
 */
export interface StoredHospitalInquiry {
  id: string;
  hospitalId: string;
  topic: InquiryTopic;
  content: string;
  /** **환자가 작성 시점에 고른 공개 여부** (계약 `is_public_by_user`, 기본 `true`). */
  isPublic: boolean;
  /** 미답변이면 `null`. 답변은 1건이고 수정이 없다. */
  answer: HospitalInquiryAnswer | null;
  createdAt: string;
  /** 서버 전환 시 삭제: 문의자는 서버가 토큰에서 알아낸다. */
  ownerUserId?: string;
  /**
   * 서버 전환 시 삭제: 서버는 `users.name` 을 조인해 마스킹한다 (**스냅샷 컬럼이 없다**).
   * 로컬에는 사용자 테이블이 없어 작성 시점 이름을 적어 둔다 — 계정 이름이 바뀌어도
   * 옛 이름의 마스킹이 남는 것이 계약과 다른 점이다.
   */
  askerDisplayName?: string;
  /** 서버 전환 시 삭제: 서버는 `hospitals.name` 을 조인한다. */
  hospitalName?: string;
}

interface LocalCollections {
  consultRequests: StoredConsultRequest[];
  communityPosts: QAPost[];
  notifications: AppNotification[];
  /** 병원 문의. **시드가 없다** — 빈 목록에서 시작하는 것이 이 기능의 원래 상태다. */
  inquiries: StoredHospitalInquiry[];
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
  // 문의도 시드가 없다. `mocks/fixtures/` 는 백엔드 seed 가 import 하는 폴더라
  // 아직 서버에 없는 테이블의 가짜 행을 거기 넣지 않는다.
  inquiries: [],
};

/**
 * 이 앱을 이미 써 본 브라우저에는 zustand `persist` 가 만든 키에 사용자 데이터가 들어 있다.
 * 그대로 버리면 신청했던 상담·작성한 글·찜이 사라지므로 **최초 1회만** 흡수한다.
 * 키와 안쪽 필드 이름은 삭제된 각 스토어의 persist 설정에서 그대로 가져온 값이다.
 *
 * **새로 생긴 컬렉션은 여기 없다** (`inquiries`). 흡수할 과거 데이터가 없는데 키를 적어 두면
 * 읽히지 않는 이름이 하나 남아, 다음 사람이 그 키를 진짜 있었던 것으로 읽는다.
 */
const LEGACY_SOURCES: Partial<Record<LocalCollectionName, { key: string; field: string }>> = {
  consultRequests: { key: 'molarmolar-consult-requests', field: 'requests' },
  communityPosts: { key: 'molarmolar-community-posts', field: 'posts' },
  notifications: { key: 'molarmolar-notifications', field: 'notifications' },
  favoriteHospitalIds: { key: 'molarmolar-favorites', field: 'hospitalIds' },
};

function readLegacy<K extends LocalCollectionName>(name: K): LocalCollections[K] | null {
  const source = LEGACY_SOURCES[name];
  if (!source) return null;

  const raw = safeGetItem(source.key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    const rows = parsed.state?.[source.field];

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

  rows = normalizeProcedureIds(name, rows);
  cache.set(name, rows);

  return rows;
}

/**
 * **옛 시술 id 를 읽는 순간 한 번에 푼다** (2026-10-21 요청 14).
 *
 * 이 앱을 오늘 이전에 쓴 브라우저에는 `procedureId: 'implant'` 같은 옛 값을 가진 상담·질문
 * 행이 남아 있다. 서버 시술 id 가 31개 세부 시술로 바뀌면서 그 값들은 라벨이 안 붙고
 * (`procedureDisplayName` 이 `null`), 관리자 상담 분야 필터에도 걸리지 않는다.
 *
 * **읽을 때 한 곳에서** 바꾼다 — 화면·훅·api 함수가 각자 풀면 한 군데를 빠뜨린다. 쓰기는
 * 이미 새 id 라 변환이 필요 없고, 변환된 값은 다음 `writeCollection` 때 저장소에도 남는다.
 */
function normalizeProcedureIds<K extends LocalCollectionName>(
  name: K,
  rows: LocalCollections[K]
): LocalCollections[K] {
  if (name !== 'consultRequests' && name !== 'communityPosts') return rows;

  return (rows as readonly { procedureId?: string | null }[]).map((row) => {
    if (typeof row.procedureId !== 'string') return row;
    const resolved = resolveLegacyProcedureId(row.procedureId);

    // 풀 수 없는 값은 그대로 둔다 — 지어내지 않는다. 라벨 없는 줄로 보일 뿐이다.
    return resolved === null || resolved === row.procedureId ? row : { ...row, procedureId: resolved };
  }) as LocalCollections[K];
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
