/**
 * 상담 신청 시드 데이터. 조각 2 에서 `frontend/src/mocks/fixtures/consultRequests.ts`
 * 에서 옮겨왔다 — 상담이 서버로 이관되면서 DB 가 원본이 됐다.
 *
 * **프론트의 `ConsultRequest` 타입을 쓰지 않는다.** 그 타입은 이제 *응답* 모양이라
 * 서버가 계산하는 필드(`hospitalName`·`procedureName`·`piiMasked`·`memos[].authorName`)를
 * 포함한다. 시드는 *저장* 모양이므로 여기서 행의 모양을 직접 선언한다
 * (`./doctors.ts` 와 같은 이유).
 *
 * 날짜는 `SEED_TODAY` 기준 상대 오프셋으로 다시 계산된다 (`../dates.ts`). 여기 적힌
 * 고정 날짜는 그 계산의 기준점이다 — 그대로 들어가지 않는다.
 */

export type ConsultStatusValue = 'new' | 'contacted' | 'booked' | 'cancelled';

export interface ConsultStatusChangeSeedRow {
  status: ConsultStatusValue;
  changedAt: string;
}

export interface ConsultMemoSeedRow {
  id: string;
  content: string;
  createdAt: string;
}

export interface ConsultRequestSeedRow {
  id: string;
  hospitalId: string;
  procedureId: string;
  name: string;
  phone: string;
  preferredTime: string;
  message: string;
  createdAt: string;
  status: ConsultStatusValue;
  statusHistory: ConsultStatusChangeSeedRow[];
  memos: ConsultMemoSeedRow[];
}

// 관리자 대시보드의 `이번 달 신규 상담` / `처리 대기 중인 상담` 카드가 0 이 되지 않도록
// 섞어 두었다 — 7월 5건 / 6월 2건, `new` 3건.
export const consultRequests: ConsultRequestSeedRow[] = [
  {
    id: 'cr1',
    hospitalId: 'h1',
    procedureId: 'implant',
    name: '김민준',
    phone: '010-1234-5601',
    preferredTime: '평일 오전',
    message: '임플란트 비용이 궁금해서 상담 신청합니다.',
    createdAt: '2026-07-28T09:15:00.000Z',
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: '2026-07-28T09:15:00.000Z' }],
    memos: [],
  },
  {
    id: 'cr2',
    hospitalId: 'h2',
    procedureId: 'orthodontics',
    name: '박서준',
    phone: '010-1234-5602',
    preferredTime: '평일 오후',
    message: '성인 투명교정 상담 받고 싶어요.',
    createdAt: '2026-07-20T08:00:00.000Z',
    status: 'contacted',
    statusHistory: [
      { status: 'new', changedAt: '2026-07-20T08:00:00.000Z' },
      { status: 'contacted', changedAt: '2026-07-22T10:30:00.000Z' },
    ],
    memos: [{ id: 'memo-cr2-1', content: '전화 연결 시도, 부재중', createdAt: '2026-07-22T10:31:00.000Z' }],
  },
  {
    id: 'cr3',
    hospitalId: 'h1',
    procedureId: 'laminate',
    name: '최지훈',
    phone: '010-1234-5603',
    preferredTime: '주말',
    message: '라미네이트 견적 및 일정 상담 원해요.',
    createdAt: '2026-07-15T07:20:00.000Z',
    status: 'booked',
    statusHistory: [
      { status: 'new', changedAt: '2026-07-15T07:20:00.000Z' },
      { status: 'contacted', changedAt: '2026-07-16T09:00:00.000Z' },
      { status: 'booked', changedAt: '2026-07-18T11:45:00.000Z' },
    ],
    memos: [{ id: 'memo-cr3-1', content: '8/2 14:00 예약 확정', createdAt: '2026-07-18T11:46:00.000Z' }],
  },
  {
    id: 'cr4',
    hospitalId: 'h3',
    procedureId: 'cavity',
    name: '정하윤',
    phone: '010-1234-5604',
    preferredTime: '평일 오후',
    message: '충치 치료 상담이요.',
    createdAt: '2026-06-25T06:00:00.000Z',
    status: 'cancelled',
    statusHistory: [
      { status: 'new', changedAt: '2026-06-25T06:00:00.000Z' },
      { status: 'contacted', changedAt: '2026-06-26T08:10:00.000Z' },
      { status: 'cancelled', changedAt: '2026-06-27T12:00:00.000Z' },
    ],
    memos: [{ id: 'memo-cr4-1', content: '타 병원으로 결정하셨다고 함', createdAt: '2026-06-27T12:01:00.000Z' }],
  },
  {
    id: 'cr5',
    hospitalId: 'h4',
    procedureId: 'snoring-device',
    name: '강도윤',
    phone: '010-1234-5605',
    preferredTime: '평일 오전',
    message: '코골이 장치 제작 문의드려요.',
    createdAt: '2026-06-10T05:30:00.000Z',
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: '2026-06-10T05:30:00.000Z' }],
    memos: [],
  },
  {
    id: 'cr6',
    hospitalId: 'h5',
    procedureId: 'gum-disease',
    name: '이서연',
    phone: '010-1234-5606',
    preferredTime: '평일 오후',
    message: '잇몸치료 관련해서 상담받고 싶습니다.',
    createdAt: '2026-07-29T13:40:00.000Z',
    status: 'contacted',
    statusHistory: [
      { status: 'new', changedAt: '2026-07-29T13:40:00.000Z' },
      { status: 'contacted', changedAt: '2026-07-30T09:00:00.000Z' },
    ],
    memos: [
      { id: 'memo-cr6-1', content: '상담 일정 조율중', createdAt: '2026-07-30T09:01:00.000Z' },
      { id: 'memo-cr6-2', content: '다음주 화요일 재통화 예정', createdAt: '2026-07-30T09:05:00.000Z' },
    ],
  },
  {
    id: 'cr7',
    hospitalId: 'h6',
    procedureId: 'whitening',
    name: '한소율',
    phone: '010-1234-5607',
    preferredTime: '주말',
    message: '미백 시술 가격이 궁금해요.',
    createdAt: '2026-07-05T04:00:00.000Z',
    status: 'new',
    statusHistory: [{ status: 'new', changedAt: '2026-07-05T04:00:00.000Z' }],
    memos: [],
  },
];
