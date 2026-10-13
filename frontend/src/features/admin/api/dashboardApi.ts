import {
  fetchConsultRequests,
  type AdminConsultRequest,
} from '@/features/consult/api/consultApi';
import { isConsultDelayed } from '@/features/consult/consultDisplay';
import { funnelOf, type Funnel } from '@/features/consult/lib/funnel';
import { cancelReasonOf, periodRange } from '@/features/consult/lib/transition';
import { fetchHospitalDoctors } from '@/features/doctor/api/doctorApi';
import { fetchHospitalById } from '@/features/hospital/api/hospitalApi';
import { completenessOf, type Completeness } from '@/features/hospital/lib/completeness';
import { inquiryStatus } from '@/features/inquiry/inquiryVisibility';
import { ApiError } from '@/lib/apiClient';
import { readCollection, type StoredConsultRequest } from '@/lib/localCollection';
import { useAuthStore } from '@/store/useAuthStore';
import { SEOUL_TIMEZONE } from '@/lib/dateFormat';
import type { ProcedureId } from '@/types/domain';

/**
 * 병원 관리자 대시보드 집계.
 *
 * | 함수 | 대응 엔드포인트 |
 * |---|---|
 * | `fetchAdminDashboard` | `GET /admin/dashboard?hospitalId=` |
 *
 * **지금은 서버에 dashboard·consult·inquiry 모듈이 없다.** 그래서 이 함수가 계약의 응답
 * 모양을 흉내 낸다 — 상담·문의는 `lib/localCollection.ts`(localStorage)에서, 병원과 소속
 * 전문의는 **실제 서버**(`GET /hospitals/{id}`, `GET /hospitals/{id}/doctors`)에서 읽는다.
 * 서버가 생기면 이 파일의 본문만 `apiRequest('/admin/dashboard...')` 로 갈아끼우면 되고,
 * 훅과 화면은 한 줄도 바뀌지 않는다.
 *
 * **판정 규칙은 여기 없다.** 전부 이미 있던 순수 함수를 부른다 — 기간 경계 `periodRange`,
 * 지연 `isConsultDelayed`, 파생 취소 사유 `cancelReasonOf`, 깔때기 `funnelOf`, 문의 상태
 * `inquiryStatus`, 완성도 `completenessOf`, 목록 투영·마스킹은 `fetchConsultRequests` 그대로.
 * **이 오퍼레이션이 새로 만든 규칙은 하나도 없다.**
 *
 * **불변식 하나**: 숫자 카드 = 사이드 메뉴 배지 = 그 카드를 눌렀을 때 열리는 목록의 건수.
 * `dashboardApi.test.ts` 가 숫자마다 그 목록 질의와 대조해 고정한다.
 *
 * **로컬 구현이 계약과 다른 점:**
 * - **인가가 진짜가 아니다.** 역할·담당 병원은 토큰이 아니라 스토어의 현재 사용자에서 온다
 *   (`consultApi`·`inquiryApi` 와 같은 한계). 판정 자체는 계약대로다 — 운영자는
 *   `403 OPERATOR_CANNOT_USE_DASHBOARD`, 담당 병원 밖은 `403 HOSPITAL_NOT_MANAGED`,
 *   `hospitalId` 생략 + 담당 2곳 이상은 `422 HOSPITAL_ID_REQUIRED`.
 * - **담당 병원이 0곳인데 `hospitalId` 를 생략한 경우를 계약이 적지 않았다.** 여기서는
 *   `422 HOSPITAL_ID_REQUIRED` 로 떨어뜨린다 ("정확히 1곳" 이 아닌 모든 경우). 화면은 그
 *   상태에서 아예 호출하지 않고 빈 상태를 그린다.
 * - **한 트랜잭션이 아니다.** 상담·문의는 localStorage 에서, 병원·전문의는 네트워크에서
 *   오므로 엄밀히는 한 시점이 아니다. 대신 `now` 를 **함수 진입 때 한 번만** 읽어 모든
 *   달력 경계·지연 판정이 같은 시점을 쓰게 한다 (`calculatedAt` 이 그 값이다).
 * - **`Cache-Control`·감사 로그가 없다.** 둘 다 서버가 생겨야 생기는 것이다.
 */

/** `AdminDashboardNumbers`. 숫자 카드 4개(+보조 줄)와 사이드 배지 2개가 읽는 숫자 전부. */
export interface AdminDashboardNumbers {
  todayNew: number;
  statusNew: number;
  pending: number;
  delayed: number;
  unansweredInquiries: number;
  oldestUnansweredAt: string | null;
  newThisMonth: number;
  bookedThisMonth: number;
}

/** `AdminDashboardTodoConsult`. 목록보다 좁은 투영 — **연락처 필드가 아예 없다.** */
export interface AdminDashboardTodoConsult {
  id: string;
  name: string;
  procedureId: ProcedureId | null;
  createdAt: string;
}

/** `AdminDashboardVisit`. 같은 이유로 좁힌 투영이고, 기준 시각만 `visitAt` 이다. */
export interface AdminDashboardVisit {
  id: string;
  name: string;
  procedureId: ProcedureId | null;
  visitAt: string;
}

/** `AdminDashboardRejectedDoctor`. **id 와 이름뿐이다** — 반려 사유는 담지 않는다. */
export interface AdminDashboardRejectedDoctor {
  id: string;
  name: string;
}

/** `AdminDashboardTodo`. `오늘 할 일` 네 줄 중 **`numbers` 에 없는 것만** 담는다. */
export interface AdminDashboardTodo {
  delayedConsults: AdminDashboardTodoConsult[];
  /** `외 N건`. **서버가 빼 준다** — 화면이 빼면 그 뺄셈이 또 하나의 판정 지점이 된다. */
  delayedRemaining: number;
  rejectedDoctors: AdminDashboardRejectedDoctor[];
}

export interface AdminDashboard {
  /** **실제로 집계한 병원.** 각 카드의 링크가 이 값을 그대로 쓴다. */
  hospitalId: string;
  hospitalName: string;
  numbers: AdminDashboardNumbers;
  funnel: Funnel;
  todo: AdminDashboardTodo;
  /** 상담 **목록과 같은 투영**이다 (이름 전체 · 번호 마스킹 · `piiMasked: true`). */
  recentConsults: AdminConsultRequest[];
  todayVisits: AdminDashboardVisit[];
  completeness: Completeness;
  timezone: string;
  calculatedAt: string;
}

export interface AdminDashboardParams {
  hospitalId?: string;
}

/** `오늘 할 일` 의 지연 줄 상한. `delayedRemaining` 이 이 값에서 파생된다. */
const DELAYED_TODO_LIMIT = 5;

/** `최근 상담 예약` 줄 수. */
const RECENT_CONSULT_LIMIT = 5;

// 서버 전환 시 삭제: 역할·담당 병원은 서버가 토큰 주체로 판정한다
function currentUser() {
  return useAuthStore.getState().user;
}

function inRange(iso: string | null | undefined, [from, to]: readonly [Date, Date]): boolean {
  if (!iso) return false;

  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return false;

  // 반열린 구간 `[from, to)`.
  return at >= from.getTime() && at < to.getTime();
}

function byCreatedAtAsc(a: { createdAt: string }, b: { createdAt: string }): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

/**
 * **어느 병원의 대시보드인가.** 서버가 "첫 번째 병원" 을 골라 주지 않는다 — 그 순간 화면
 * 드롭다운의 값과 숫자가 갈리고, 고른 적 없는 병원의 할 일이 보인다.
 */
function resolveHospitalId(requested: string | undefined): string {
  const user = currentUser();

  if (!user) {
    throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: '로그인이 필요해요' });
  }

  if (user.role === 'operator') {
    throw new ApiError({
      status: 403,
      code: 'OPERATOR_CANNOT_USE_DASHBOARD',
      message: '운영자는 병원 대시보드를 쓸 수 없어요. 병원 목록에서 병원을 선택해주세요',
    });
  }

  if (user.role !== 'hospital_admin') {
    throw new ApiError({ status: 403, code: 'FORBIDDEN', message: '이 작업을 수행할 권한이 없어요' });
  }

  if (requested === undefined) {
    if (user.managedHospitalIds.length !== 1) {
      throw new ApiError({
        status: 422,
        code: 'HOSPITAL_ID_REQUIRED',
        message: '담당 병원이 여러 곳이에요. 어느 병원의 대시보드를 볼지 선택해주세요',
      });
    }

    return user.managedHospitalIds[0];
  }

  // **존재하지 않는 id 도 같은 403 이다** — 판정은 "담당 목록에 있는가" 하나이고,
  // 병원 존재는 공개 `GET /hospitals/{id}` 가 답하는 공개 정보다.
  if (!user.managedHospitalIds.includes(requested)) {
    throw new ApiError({ status: 403, code: 'HOSPITAL_NOT_MANAGED', message: '담당하지 않는 병원이에요' });
  }

  return requested;
}

export async function fetchAdminDashboard(params: AdminDashboardParams = {}): Promise<AdminDashboard> {
  const hospitalId = resolveHospitalId(params.hospitalId);
  // **시계는 한 번만 읽는다.** 달력 경계 다섯과 지연 판정이 같은 시점을 가리켜야 한다.
  const now = new Date();

  const consults: StoredConsultRequest[] = readCollection('consultRequests').filter(
    (row) => row.hospitalId === hospitalId
  );
  const inquiries = readCollection('inquiries').filter((row) => row.hospitalId === hospitalId);

  const today = periodRange('today', now);
  const thisMonth = periodRange('thisMonth', now);

  const monthCohort = consults.filter((row) => inRange(row.createdAt, thisMonth));
  const bookedThisMonth = monthCohort.filter((row) => row.status === 'booked' || row.status === 'visited').length;
  const delayed = consults.filter((row) => isConsultDelayed(row, now.getTime())).sort(byCreatedAtAsc);

  const unanswered = inquiries.filter((row) => inquiryStatus(row) === 'unanswered');
  const oldestUnansweredAt = unanswered.reduce<string | null>(
    (oldest, row) => (oldest === null || row.createdAt < oldest ? row.createdAt : oldest),
    null
  );

  const numbers: AdminDashboardNumbers = {
    todayNew: consults.filter((row) => inRange(row.createdAt, today)).length,
    statusNew: consults.filter((row) => row.status === 'new').length,
    pending: consults.filter((row) => row.status === 'new' || row.status === 'contacted').length,
    delayed: delayed.length,
    unansweredInquiries: unanswered.length,
    oldestUnansweredAt,
    newThisMonth: monthCohort.length,
    bookedThisMonth,
  };

  const funnel = funnelOf(
    monthCohort.map((row) => ({ status: row.status, cancelReason: cancelReasonOf(row.status, row.statusHistory) }))
  );

  const todo: AdminDashboardTodo = {
    delayedConsults: delayed.slice(0, DELAYED_TODO_LIMIT).map((row) => ({
      id: row.id,
      name: row.name,
      procedureId: row.procedureId,
      createdAt: row.createdAt,
    })),
    delayedRemaining: Math.max(0, delayed.length - DELAYED_TODO_LIMIT),
    rejectedDoctors: [],
  };

  const todayVisits: AdminDashboardVisit[] = consults
    // `예정` 이므로 내원 처리를 하면 줄이 사라진다 — `visited` 는 넣지 않는다.
    .filter((row) => row.status === 'booked' && inRange(row.visitAt, today))
    .sort((a, b) => new Date(a.visitAt as string).getTime() - new Date(b.visitAt as string).getTime())
    .map((row) => ({
      id: row.id,
      name: row.name,
      procedureId: row.procedureId,
      visitAt: row.visitAt as string,
    }));

  // `최근 상담 예약` 은 **목록 오퍼레이션을 그대로 부른다** — 같은 투영·같은 마스킹이라고
  // 적는 대신 같은 함수를 쓴다 (`전체 보기` 가 여는 목록의 1페이지와 같은 질의다).
  const recent = await fetchConsultRequests({ hospitalId, pageSize: RECENT_CONSULT_LIMIT });

  const [hospital, doctors] = await Promise.all([fetchHospitalById(hospitalId), fetchHospitalDoctors(hospitalId)]);

  todo.rejectedDoctors = doctors
    .filter((doctor) => doctor.verificationStatus === 'rejected')
    .map((doctor) => ({ id: doctor.id, name: doctor.name }));

  return {
    hospitalId,
    hospitalName: hospital.name,
    numbers,
    funnel,
    todo,
    recentConsults: recent.items,
    todayVisits,
    completeness: completenessOf({
      name: hospital.name,
      region: hospital.region,
      address: hospital.address,
      latitude: hospital.latitude,
      longitude: hospital.longitude,
      specialty: hospital.specialty,
      businessHours: hospital.businessHours,
      procedureIds: hospital.procedureIds,
      thumbnail: hospital.thumbnail,
      introduction: hospital.introduction,
      directions: hospital.directions,
      doctorCount: doctors.length,
    }),
    timezone: SEOUL_TIMEZONE,
    calculatedAt: now.toISOString(),
  };
}
