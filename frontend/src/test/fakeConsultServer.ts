import { vi } from 'vitest';

import * as consultApi from '@/features/consult/api/consultApi';
import type {
  AdminConsultRequest,
  ConsultRequestFilters,
  ConsultRequestList,
  ConsultStatusChangeView,
  ConsultStatusUpdateInput,
} from '@/features/consult/api/consultApi';
import {
  cancelReasonOf,
  classifyEvent,
  nextVisitAt,
  periodRange,
  requiredInputs,
  truncateToMinute,
} from '@/features/consult/lib/transition';
import { ApiError } from '@/lib/apiClient';
import { useAuthStore } from '@/store/useAuthStore';
import {
  CONSULT_STATUSES,
  isConsultCancelReason,
  type ConsultCancelReason,
  type ConsultStatus,
} from '@/types/domain';
import { maskPersonName, maskPhoneMiddle } from '@/utils/pii';

/**
 * **화면 테스트용 상담 서버 대역.** 요청서 15 로 상담이 서버에 가면서, 관리자 상담 화면
 * 테스트가 쓰던 브라우저 저장소가 사라졌다. 그 자리를 메모리 한 벌이 대신한다.
 *
 * 흉내 내는 범위는 계약이 정한 것뿐이다 — 스코프(담당 병원/전체), 목록·상세의 마스킹 차이,
 * 필터·정렬·페이지, `statusCounts` 의 모집단, 상태 변경의 **필수 입력 → no-op → 이력** 순서.
 * **판정은 하나도 새로 적지 않는다** — 전이 규칙은 화면과 같은 순수 모듈
 * (`features/consult/lib/transition.ts`)을 부르고, 그 모듈이 서버의 같은 이름 파일과 같은
 * 답을 낸다는 것은 `features/consult/consultServerRules.sync.test.ts` 가 고정한다.
 *
 * 서버가 실제로 하는 일 중 여기 없는 것: 감사 로그, 환자 알림 행(알림함은 따로 목한다),
 * 접수(`POST`) — 화면 테스트가 접수 응답을 직접 목한다.
 */

export interface FakeConsultRow {
  id: string;
  hospitalId: string;
  hospitalName?: string;
  procedureId: string | null;
  name: string;
  phone: string;
  preferredTime: string;
  message: string;
  createdAt: string;
  status: ConsultStatus;
  visitAt?: string | null;
  statusHistory: ConsultStatusChangeView[];
  memos: { id: string; content: string; createdAt: string }[];
}

let rows: FakeConsultRow[] = [];
let memoSequence = 0;

/** 이 서버가 들고 있는 상담을 통째로 갈아끼운다. */
export function seedConsults(next: FakeConsultRow[]): void {
  rows = next.map((row) => ({ ...row }));
  memoSequence = 0;
}

/** 저장된 행 한 건 — "저장이 실제로 바뀌었는가" 를 보는 테스트가 쓴다. */
export function storedConsult(id = rows[0]?.id): FakeConsultRow {
  const found = rows.find((row) => row.id === id);

  if (!found) throw new Error(`fake consult server: ${id} 가 없다`);

  return found;
}

function currentUser() {
  return useAuthStore.getState().user;
}

function notFound(): ApiError {
  return new ApiError({ status: 404, code: 'CONSULT_REQUEST_NOT_FOUND', message: '상담 정보를 찾을 수 없어요' });
}

function forbidden(): ApiError {
  return new ApiError({ status: 403, code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없어요' });
}

function validationFailed(field: string, code: string, message: string): ApiError {
  return new ApiError({
    status: 422,
    code: 'VALIDATION_FAILED',
    message: '입력값을 확인해주세요',
    details: [{ field, code, message }],
  });
}

function scopedRows(hospitalId?: string): { rows: FakeConsultRow[]; scope: 'managed' | 'all' } {
  const user = currentUser();

  if (!user) throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: '로그인이 필요해요' });
  if (user.role !== 'hospital_admin' && user.role !== 'operator') throw forbidden();

  if (user.role === 'operator') {
    return { rows: hospitalId ? rows.filter((row) => row.hospitalId === hospitalId) : rows, scope: 'all' };
  }

  if (hospitalId !== undefined && !user.managedHospitalIds.includes(hospitalId)) {
    throw new ApiError({ status: 403, code: 'HOSPITAL_NOT_MANAGED', message: '담당하지 않는 병원이에요' });
  }

  return {
    rows: rows.filter((row) =>
      hospitalId === undefined ? user.managedHospitalIds.includes(row.hospitalId) : row.hospitalId === hospitalId
    ),
    scope: 'managed',
  };
}

function project(row: FakeConsultRow, mask: { name: boolean; phone: boolean }): AdminConsultRequest {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    hospitalName: row.hospitalName ?? '알 수 없는 병원',
    procedureId: row.procedureId as AdminConsultRequest['procedureId'],
    name: mask.name ? maskPersonName(row.name) : row.name,
    phone: mask.phone ? maskPhoneMiddle(row.phone) : row.phone,
    piiMasked: mask.name || mask.phone,
    preferredTime: row.preferredTime,
    message: row.message,
    createdAt: row.createdAt,
    status: row.status,
    visitAt: row.visitAt ?? null,
    cancelReason: cancelReasonOf(row.status, row.statusHistory),
    statusHistory: row.statusHistory,
    thirdPartyConsent: null,
    memos: row.memos,
  };
}

function matchesQuery(row: FakeConsultRow, q: string, scope: 'managed' | 'all'): boolean {
  if (row.name.includes(q)) return true;

  const digits = q.replace(/\D/g, '');
  if (digits.length < 2) return false;

  const phoneDigits = row.phone.replace(/\D/g, '');

  return scope === 'all'
    ? phoneDigits.endsWith(digits.length > 4 ? digits.slice(-4) : digits)
    : phoneDigits.includes(digits);
}

function matches(row: FakeConsultRow, filters: ConsultRequestFilters, scope: 'managed' | 'all'): boolean {
  if (filters.period) {
    const [from, to] = periodRange(filters.period, new Date());
    const at = new Date(row.createdAt).getTime();

    if (at < from.getTime() || at >= to.getTime()) return false;
  }

  if (filters.procedureId && filters.procedureId.length > 0) {
    if (row.procedureId === null || !filters.procedureId.includes(row.procedureId as never)) return false;
  }

  const q = filters.q?.trim() ?? '';

  return q.length === 0 || matchesQuery(row, q, scope);
}

function list(filters: ConsultRequestFilters = {}): ConsultRequestList {
  const scoped = scopedRows(filters.hospitalId);
  const base = scoped.rows
    .filter((row) => matches(row, filters, scoped.scope))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const statuses = filters.status === undefined ? null : [filters.status].flat();
  const matched = statuses === null ? base : base.filter((row) => statuses.includes(row.status));
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const counts = Object.fromEntries(
    CONSULT_STATUSES.map((status) => [status, base.filter((row) => row.status === status).length])
  ) as Record<ConsultStatus, number>;

  return {
    items: matched
      .slice((page - 1) * pageSize, page * pageSize)
      // 목록은 두 역할 모두 번호를 가린다. 이름은 운영자에게만 가린다.
      .map((row) => project(row, { name: scoped.scope === 'all', phone: true })),
    meta: {
      page,
      pageSize,
      totalItems: matched.length,
      totalPages: Math.ceil(matched.length / pageSize),
    },
    scope: scoped.scope,
    statusCounts: { ...counts, total: base.length },
  };
}

function detail(id: string): AdminConsultRequest {
  const scoped = scopedRows();
  const found = scoped.rows.find((row) => row.id === id);

  if (!found) throw notFound();

  const maskAll = scoped.scope === 'all';

  return project(found, { name: maskAll, phone: maskAll });
}

/**
 * 쓰기(`PATCH …/status` · `POST …/memos`)의 응답은 **목록 투영**이다 — 담당 병원 관리자에게도
 * 번호를 가린다 (계약 §4, 2026-10-22). 전체 번호가 실리면 아무것도 바꾸지 않는 no-op `PATCH` 를
 * 반복해 **열람 기록 없이** 번호를 모을 수 있기 때문이다. 쓰기를 부르는 화면은 응답에서
 * `statusHistory`·`visitAt` 만 읽으므로 잃는 것이 없다 (번호는 상세 조회가 다시 받아온다).
 * 여기 오는 요청은 `writable()` 을 지난 담당 병원 관리자뿐이라 이름은 원본이다.
 */
function writeResponse(row: FakeConsultRow): AdminConsultRequest {
  return project(row, { name: false, phone: true });
}

/** 상태를 바꿀 수 있는 주체는 담당 병원 관리자뿐이다 (운영자는 403). */
function writable(id: string): FakeConsultRow {
  const user = currentUser();

  if (!user) throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: '로그인이 필요해요' });
  if (user.role !== 'hospital_admin') throw forbidden();

  const found = rows.find((row) => row.id === id && user.managedHospitalIds.includes(row.hospitalId));

  if (!found) throw notFound();

  return found;
}

function updateStatus(id: string, input: ConsultStatusUpdateInput): AdminConsultRequest {
  const target = writable(id);
  const required = requiredInputs(input.status);
  const visitAt = nextVisitAt(input.status, target.visitAt ?? null, input.visitAt);

  if (required.includes('visitAt') && visitAt === null) {
    throw validationFailed('visitAt', 'VISIT_AT_REQUIRED', '확정 일시를 입력해주세요');
  }
  if (required.includes('cancelReason') && !isConsultCancelReason(input.cancelReason)) {
    throw validationFailed('cancelReason', 'CANCEL_REASON_REQUIRED', '취소 사유를 선택해주세요');
  }

  const cancelReason: ConsultCancelReason | null =
    input.status === 'cancelled' ? ((input.cancelReason ?? null) as ConsultCancelReason | null) : null;
  const event = classifyEvent(
    {
      status: target.status,
      visitAt: truncateToMinute(target.visitAt ?? null),
      cancelReason: cancelReasonOf(target.status, target.statusHistory),
    },
    { status: input.status, visitAt, cancelReason }
  );

  if (event === 'noop') return writeResponse(target);

  target.status = input.status;
  target.visitAt = visitAt;
  target.statusHistory = [
    ...target.statusHistory,
    {
      event,
      status: input.status,
      changedAt: new Date().toISOString(),
      changedByName: currentUser()?.name ?? null,
      visitAt,
      cancelReason,
      // 서버는 같은 트랜잭션에서 환자 알림을 만든다 — 이력 줄의 `환자 알림 발송` 이 그 사실이다.
      notified: true,
    },
  ];

  return writeResponse(target);
}

function addMemo(id: string, content: string): AdminConsultRequest {
  const target = writable(id);

  memoSequence += 1;
  target.memos = [...target.memos, { id: `memo-${memoSequence}`, content, createdAt: new Date().toISOString() }];

  return writeResponse(target);
}

/**
 * 상담 api 네 함수를 이 대역으로 바꾼다. `vi.restoreAllMocks()` 가 되돌린다 —
 * 테스트의 `beforeEach` 에서 `seedConsults` 와 함께 부른다.
 */
export function installFakeConsultServer(): void {
  vi.spyOn(consultApi, 'fetchConsultRequests').mockImplementation(async (filters) => list(filters));
  vi.spyOn(consultApi, 'fetchConsultRequestById').mockImplementation(async (id) => detail(id));
  vi.spyOn(consultApi, 'updateConsultStatus').mockImplementation(async (id, input) => updateStatus(id, input));
  vi.spyOn(consultApi, 'addConsultMemo').mockImplementation(async (id, content) => addMemo(id, content));
}
