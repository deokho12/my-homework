/**
 * =============================================================================
 * 상담 샘플 8건 — **원본이 서버로 왔다** (요청서 15, docs/database/README.md §12.13)
 * =============================================================================
 *
 * 예전에는 `frontend/src/mocks/fixtures/consultRequests.ts` 를 시드가 import 했다. 새 샘플이
 * 요구하는 것(`visited`·`reschedule`·취소 사유·`visit_at`·동의 기록)은 **그 fixture 의 타입에
 * 없는 필드**라, 프런트에 넣으면 화면이 쓰지 않는 값을 목 데이터에 만드는 꼴이 된다.
 * 요청 14 가 시술 분류에 한 절차(§17.8)와 같다 — 소유권이 넘어오면 그 제약이 사라진다.
 * (프런트의 `consultRequests.ts` 는 **같은 작업에서 삭제됐다** — 읽는 코드가 남지 않았다.
 *  이 저장소에 MSW 는 없다.)
 *
 * **브랜치 `origin/hospital-doctor-domain-api` 의 같은 이름 파일은 쓰지 않고 새로 썼다**
 * (`src/consult/consult.schemas.ts` 와 같은 사정이다). 그쪽 샘플의 상태는 4개뿐이고
 * `visited`·`reschedule`·취소 사유·`visit_at`·동의 기록이 타입에 아예 없다.
 *
 * ## 날짜는 `SEED_TODAY` 기준 **오프셋**이다 (§8.4 쪽, §8.5 아님)
 *
 * §8.5(기준일 하나로 통째로 민다)는 **fixture 에 날짜가 있는 것**의 규칙이고, 이 샘플들은
 * 밀 원본이 애초에 없다. 그래서 `{ day, time }` 으로 적고 시드가 `clock.seoulAt` 으로 푼다 —
 * `day` 는 SEED_TODAY 로부터의 일수, `time` 은 **KST 벽시계**다.
 *
 * ## 왜 이 8건인가 (§12.13-C)
 *
 * **오늘(오프셋 0) 접수 건에 `visited`·`cancelled` 를 하나씩 둔 것이 설계의 핵심**이다.
 * `이번 달` 은 SEED_TODAY 의 일(日)에 달려 있어서 1일에 시드하면 D−1 이하가 전부 지난달로
 * 빠지는데, **오프셋 0 은 어느 날 시드해도 이번 달**이다. 그래서 대시보드의 다섯 숫자가
 * 어느 날 시드해도 0 이 아니다.
 *
 * | 보증하는 것 | 건 |
 * |---|---|
 * | `오늘 들어온 상담` 3 | cr1·cr4·cr5 (전부 오프셋 0) |
 * | `지연`(신규 24시간) 1 | cr2 (D−3 인데 아직 `new`) |
 * | `오늘 내원 예정` 1 | cr3 (오늘 14:00 · `booked`). cr4 는 `visited` 라 빠진다 |
 * | 동의 기록 없는 과거 건 | cr2 (**둘 다 null** — 절차 도입 이전 접수) |
 * | 일시 변경(`reschedule`) 이력 | cr8 |
 * | 범위(스코프) 확인 | cr7·cr8 이 **h2** — `u-admin-h1` 에게는 6건만 보여야 한다 |
 * | 한 사람의 두 병원 신청 | cr1(h1)·cr8(h2) 둘 다 `u-seed-1` |
 *
 * 상담 id `cr1`~`cr8` 은 그대로 유지한다 — `/admin/consultations/cr1` 같은 예시 URL 과 QA
 * 시나리오가 그 값에 걸려 있다 (§8.1 원칙 1).
 *
 * `phone` 의 **뒤 4자리가 전부 다르다** — 운영자의 접미 일치 검색(§12.9)을 한 건씩 재현할 수 있다.
 */

/** SEED_TODAY 로부터 `day` 일 떨어진 날의 **KST 벽시계 시각**. 시드가 UTC 로 푼다. */
export interface SeedMoment {
  /** 0 = SEED_TODAY, 음수 = 과거, 양수 = 미래 */
  day: number;
  /** `HH:mm` (KST) */
  time: string;
}

/**
 * 신청자 계정 7명. **상담 건수로 만들지 않는다** — `cr1`·`cr8` 이 같은 사람이라 "상담 1건 =
 * 계정 1개" 가입이 깨졌다 (§12.13-E). id 체계(`u-seed-1`~`7`)와 이름은 그대로다.
 */
export interface SeedConsultApplicant {
  /** `u-seed-{index}` · `seed-{index}@molarmolar.example` */
  index: number;
  name: string;
}

export const consultApplicants: SeedConsultApplicant[] = [
  { index: 1, name: '김민준' },
  { index: 2, name: '박서준' },
  { index: 3, name: '최지훈' },
  { index: 4, name: '정하윤' },
  { index: 5, name: '강도윤' },
  { index: 6, name: '이서연' },
  { index: 7, name: '한소율' },
];

export interface SeedConsultStatusChange {
  /** `reschedule` 은 상태가 `booked` 그대로이고 일시만 바뀐 이벤트다. */
  event: 'status_change' | 'reschedule';
  status: 'new' | 'contacted' | 'booked' | 'visited' | 'cancelled';
  at: SeedMoment;
  /**
   * 처리한 담당자의 **병원 id** (`u-admin-{hospitalId}` 로 푼다). 접수 행은 `null` 이다 —
   * 환자가 스스로 한 일이고, 화면도 그 줄만 `앱에서 상담 신청` 으로 그린다.
   */
  byAdminOfHospital: string | null;
  /** 이 이벤트 **직후**의 확정 일시 스냅샷. */
  visitAt: SeedMoment | null;
  /** `status: 'cancelled'` 인 행에만 값이 있다. */
  cancelReason: 'no_answer' | 'patient_request' | 'procedure_unavailable' | 'duplicate' | 'etc' | null;
}

export interface SeedConsultMemo {
  id: string;
  content: string;
  at: SeedMoment;
  /** 작성자 담당자의 병원 id. **`author_user_id` 가 채워진 메모가 처음 생긴다.** */
  byAdminOfHospital: string;
}

export interface SeedConsultRequest {
  id: string;
  hospitalId: string;
  /** `consultApplicants` 의 `index`. 이름은 그 계정에서 가져온다 (§12.13-C). */
  applicantIndex: number;
  /** 지목 전문의. 화면은 아직 보내지 않지만 서버는 받으면 저장한다 (계약). */
  doctorId: string | null;
  /** `null` 은 `잘 모르겠어요` — 화면에 `시술 미지정`. */
  procedureId: string | null;
  phone: string;
  preferredTime: '평일 오전' | '평일 오후' | '평일 저녁' | '주말';
  message: string;
  status: 'new' | 'contacted' | 'booked' | 'visited' | 'cancelled';
  createdAt: SeedMoment;
  /** 현재 확정 일시. 취소·연락중으로 나가면 `null` 이다. */
  visitAt: SeedMoment | null;
  /**
   * 동의 기록. **`null` 은 거절이 아니라 동의 절차 도입 이전 접수**다 (소급해 채울 방법이
   * 없다). 시각은 접수 시각과 같게 둔다 — 서버도 접수를 받아들인 시각으로 찍는다.
   */
  thirdPartyConsentNoticeVersion: string | null;
  statusHistory: SeedConsultStatusChange[];
  memos: SeedConsultMemo[];
}

/** 현재 안내문 개정일. 계약의 유일한 유효 값이다. */
const NOTICE_VERSION = '2026-10-12';

export const consultRequests: SeedConsultRequest[] = [
  {
    id: 'cr1',
    hospitalId: 'h1',
    applicantIndex: 1,
    doctorId: null,
    procedureId: 'implant-general',
    phone: '010-1234-5601',
    preferredTime: '평일 오전',
    message: '임플란트 비용이 궁금해요',
    status: 'new',
    createdAt: { day: 0, time: '09:15' },
    visitAt: null,
    thirdPartyConsentNoticeVersion: NOTICE_VERSION,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: 0, time: '09:15' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
    ],
    memos: [],
  },
  {
    // **동의 절차 도입 이전 접수** — `third_party_consent_*` 둘 다 null 인 유일한 건이고,
    // D−3 인데 아직 `new` 라 `지연` 모집단의 유일한 건이기도 하다.
    id: 'cr2',
    hospitalId: 'h1',
    applicantIndex: 7,
    doctorId: null,
    procedureId: 'laminate',
    phone: '010-1234-5602',
    preferredTime: '평일 오후',
    message: '',
    status: 'new',
    createdAt: { day: -3, time: '10:20' },
    visitAt: null,
    thirdPartyConsentNoticeVersion: null,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: -3, time: '10:20' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
    ],
    memos: [],
  },
  {
    // **오늘 내원 예정 1건**. 전문의를 지목한 유일한 건이기도 하다 (`d7` = 이하윤 / h1).
    id: 'cr3',
    hospitalId: 'h1',
    applicantIndex: 3,
    doctorId: 'd7',
    procedureId: 'implant-general',
    phone: '010-1234-5603',
    preferredTime: '주말',
    message: '이하윤 원장님께 상담받고 싶어요',
    status: 'booked',
    createdAt: { day: -2, time: '11:05' },
    visitAt: { day: 0, time: '14:00' },
    thirdPartyConsentNoticeVersion: NOTICE_VERSION,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: -2, time: '11:05' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'contacted',
        at: { day: -1, time: '10:00' },
        byAdminOfHospital: 'h1',
        visitAt: null,
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'booked',
        at: { day: 0, time: '09:40' },
        byAdminOfHospital: 'h1',
        visitAt: { day: 0, time: '14:00' },
        cancelReason: null,
      },
    ],
    memos: [
      {
        id: 'memo-cr3-1',
        content: '예약 일시 안내 완료',
        at: { day: 0, time: '09:41' },
        byAdminOfHospital: 'h1',
      },
    ],
  },
  {
    // `visited` 샘플. **오늘 접수 → 오늘 내원**이라 깔때기의 위 세 단계를 한꺼번에 채운다.
    // `visit_at` 이 유지되는 것이 `visited` 의 규칙이다 (취소와 다르다).
    id: 'cr4',
    hospitalId: 'h1',
    applicantIndex: 4,
    doctorId: null,
    procedureId: 'bruxism-botox',
    phone: '010-1234-5604',
    preferredTime: '평일 오전',
    message: '이갈이가 심해요',
    status: 'visited',
    createdAt: { day: 0, time: '08:00' },
    visitAt: { day: 0, time: '11:00' },
    thirdPartyConsentNoticeVersion: NOTICE_VERSION,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: 0, time: '08:00' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'booked',
        at: { day: 0, time: '08:30' },
        byAdminOfHospital: 'h1',
        visitAt: { day: 0, time: '11:00' },
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'visited',
        at: { day: 0, time: '11:20' },
        byAdminOfHospital: 'h1',
        visitAt: { day: 0, time: '11:00' },
        cancelReason: null,
      },
    ],
    memos: [],
  },
  {
    // 취소 사유가 있는 유일한 건. **시술 미지정**(`procedureId: null`)도 여기서 재현된다.
    id: 'cr5',
    hospitalId: 'h1',
    applicantIndex: 5,
    doctorId: null,
    procedureId: null,
    phone: '010-1234-5605',
    preferredTime: '평일 저녁',
    message: '어떤 시술이 맞는지 상담받고 싶어요',
    status: 'cancelled',
    createdAt: { day: 0, time: '07:30' },
    // 취소가 확정 일시를 비운다 — 취소된 건에 지난 약속이 `예정` 으로 남으면 환자에게 거짓이다.
    visitAt: null,
    thirdPartyConsentNoticeVersion: NOTICE_VERSION,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: 0, time: '07:30' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'cancelled',
        at: { day: 0, time: '09:00' },
        byAdminOfHospital: 'h1',
        visitAt: null,
        cancelReason: 'duplicate',
      },
    ],
    memos: [
      {
        id: 'memo-cr5-1',
        content: '같은 번호로 중복 접수 확인',
        at: { day: 0, time: '09:01' },
        byAdminOfHospital: 'h1',
      },
    ],
  },
  {
    id: 'cr6',
    hospitalId: 'h1',
    applicantIndex: 2,
    doctorId: null,
    procedureId: 'laminate',
    phone: '010-1234-5606',
    preferredTime: '평일 오후',
    message: '',
    status: 'contacted',
    createdAt: { day: -1, time: '13:40' },
    visitAt: null,
    thirdPartyConsentNoticeVersion: NOTICE_VERSION,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: -1, time: '13:40' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'contacted',
        at: { day: 0, time: '09:05' },
        byAdminOfHospital: 'h1',
        visitAt: null,
        cancelReason: null,
      },
    ],
    memos: [],
  },
  {
    // ↓ 여기부터 **h2** 다. `u-admin-h1` 에게는 보이지 않아야 한다.
    id: 'cr7',
    hospitalId: 'h2',
    applicantIndex: 6,
    doctorId: null,
    procedureId: 'bracket-braces',
    phone: '010-1234-5607',
    preferredTime: '평일 오후',
    message: '교정 상담 원해요',
    status: 'new',
    createdAt: { day: -1, time: '15:00' },
    visitAt: null,
    thirdPartyConsentNoticeVersion: NOTICE_VERSION,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: -1, time: '15:00' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
    ],
    memos: [],
  },
  {
    // **일시 변경(`reschedule`)이 있는 유일한 건.** `cr1` 과 신청자가 같아(`u-seed-1`)
    // 마이페이지가 병원을 가로질러 2건을 보여주는 것도 이 쌍으로 확인된다.
    id: 'cr8',
    hospitalId: 'h2',
    applicantIndex: 1,
    doctorId: null,
    procedureId: 'laminate',
    phone: '010-1234-5608',
    preferredTime: '주말',
    message: '',
    status: 'booked',
    createdAt: { day: -5, time: '16:30' },
    visitAt: { day: 3, time: '10:00' },
    thirdPartyConsentNoticeVersion: NOTICE_VERSION,
    statusHistory: [
      {
        event: 'status_change',
        status: 'new',
        at: { day: -5, time: '16:30' },
        byAdminOfHospital: null,
        visitAt: null,
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'contacted',
        at: { day: -4, time: '09:00' },
        byAdminOfHospital: 'h2',
        visitAt: null,
        cancelReason: null,
      },
      {
        event: 'status_change',
        status: 'booked',
        at: { day: -4, time: '09:30' },
        byAdminOfHospital: 'h2',
        // 그때의 약속. 뒤에 바뀌어도 이 스냅샷은 고쳐지지 않는다 (§12.3).
        visitAt: { day: 2, time: '10:00' },
        cancelReason: null,
      },
      {
        event: 'reschedule',
        // `reschedule` 행의 상태에는 **그 시점의 상태(`booked`)를 그대로** 넣는다.
        status: 'booked',
        at: { day: -1, time: '14:00' },
        byAdminOfHospital: 'h2',
        visitAt: { day: 3, time: '10:00' },
        cancelReason: null,
      },
    ],
    memos: [],
  },
];
