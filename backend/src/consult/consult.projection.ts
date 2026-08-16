import { applyPiiPolicy } from './masking';

/**
 * DB 행 → 계약 응답. **투영이 둘이다.**
 *
 * | | 관리자 (`ConsultRequest`) | 신청자 (`MyConsultRequest`) |
 * |---|---|---|
 * | `memos` | 있다 | **없다** (내부 공유용) |
 * | `statusHistory[].changedByName` | 있다 | **없다** (누가 처리했는지 알릴 이유가 없다) |
 * | `name`·`phone` | 역할에 따라 마스킹 | 본인 것이라 원본 |
 * | `hospitalThumbnail` | 없다 | 있다 (내역 카드가 병원을 다시 조회하지 않게) |
 *
 * **구조가 다를 때만 투영을 나눈다.** 반대로 마스킹은 값 변환이라 스키마를 나누지 않는다 —
 * 계약이 그 기준을 명시했고 여기서 일관되게 적용한다.
 */

/** `CONSULT_INCLUDE` 로 조회한 결과의 모양. */
export interface ConsultRequestRow {
  id: string;
  /** 신청자. 응답에는 나가지 않지만 "내 상담인가" 판정에 쓴다. */
  userId: string;
  hospitalId: string;
  doctorId: string | null;
  procedureId: string | null;
  name: string;
  phone: string;
  preferredTime: string;
  message: string | null;
  status: string;
  createdAt: Date;
  hospital: { name: string; thumbnail: string } | null;
  doctor: { name: string } | null;
  procedure: { name: string } | null;
  statusChanges: { status: string; changedAt: Date; changedBy: { name: string } | null }[];
  memos: { id: string; content: string; createdAt: Date; author: { name: string } | null }[];
}

/** 병원을 찾지 못했을 때의 표시. 화면 문서의 문구 그대로다. */
const UNKNOWN_HOSPITAL = '알 수 없는 병원';

export interface ConsultStatusChangeResponse {
  status: string;
  changedAt: string;
  changedByName?: string | null;
}

export interface ConsultMemoResponse {
  id: string;
  content: string;
  createdAt: string;
  authorName: string | null;
}

export interface ConsultRequestAdminResponse {
  id: string;
  hospitalId: string;
  hospitalName: string;
  doctorId: string | null;
  doctorName: string | null;
  procedureId: string | null;
  procedureName: string | null;
  name: string;
  phone: string;
  piiMasked: boolean;
  preferredTime: string;
  message: string;
  createdAt: string;
  status: string;
  statusHistory: ConsultStatusChangeResponse[];
  memos: ConsultMemoResponse[];
}

export interface MyConsultRequestResponse {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalThumbnail: string;
  doctorId: string | null;
  doctorName: string | null;
  procedureId: string | null;
  procedureName: string | null;
  name: string;
  phone: string;
  preferredTime: string;
  message: string;
  createdAt: string;
  status: string;
  statusHistory: { status: string; changedAt: string }[];
}

/** 리포지토리가 쓰는 include. 두 투영이 요구하는 관계를 한 곳에 모은다. */
export const CONSULT_INCLUDE = {
  hospital: { select: { name: true, thumbnail: true } },
  doctor: { select: { name: true } },
  procedure: { select: { name: true } },
  statusChanges: {
    select: { status: true, changedAt: true, changedBy: { select: { name: true } } },
    // 저장은 시간순. 최신순 표시는 화면의 표현이다 (계약).
    orderBy: { changedAt: 'asc' },
  },
  memos: {
    select: { id: true, content: true, createdAt: true, author: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  },
} as const;

/**
 * 관리자 시야. `actorRole` 로 마스킹 여부가 갈린다 — 담당 병원의 `hospital_admin` 만
 * 원본을 본다. 담당 여부 자체는 `HospitalScopeGuard` 가 이미 판정했다.
 */
export function projectConsultForAdmin(
  row: ConsultRequestRow,
  actorRole: string,
): ConsultRequestAdminResponse {
  const pii = applyPiiPolicy({ name: row.name, phone: row.phone }, actorRole);

  return {
    id: row.id,
    hospitalId: row.hospitalId,
    hospitalName: row.hospital?.name ?? UNKNOWN_HOSPITAL,
    doctorId: row.doctorId,
    doctorName: row.doctor?.name ?? null,
    procedureId: row.procedureId,
    procedureName: row.procedure?.name ?? null,
    name: pii.name,
    phone: pii.phone,
    piiMasked: pii.piiMasked,
    preferredTime: row.preferredTime,
    message: row.message ?? '',
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    statusHistory: row.statusChanges.map((change) => ({
      status: change.status,
      changedAt: change.changedAt.toISOString(),
      changedByName: change.changedBy?.name ?? null,
    })),
    memos: row.memos.map((memo) => ({
      id: memo.id,
      content: memo.content,
      createdAt: memo.createdAt.toISOString(),
      authorName: memo.author?.name ?? null,
    })),
  };
}

/**
 * 신청자 시야. **`memos` 와 `changedByName` 이 여기 들어오면 안 된다** — 내부 공유용
 * 메모에는 담당자가 적은 내용이 그대로 있고, 처리자 이름은 신청자에게 알릴 것이 아니다.
 *
 * 본인 것이므로 이름·연락처는 마스킹하지 않는다.
 */
export function projectConsultForOwner(row: ConsultRequestRow): MyConsultRequestResponse {
  return {
    id: row.id,
    hospitalId: row.hospitalId,
    hospitalName: row.hospital?.name ?? UNKNOWN_HOSPITAL,
    hospitalThumbnail: row.hospital?.thumbnail ?? '',
    doctorId: row.doctorId,
    doctorName: row.doctor?.name ?? null,
    procedureId: row.procedureId,
    procedureName: row.procedure?.name ?? null,
    name: row.name,
    phone: row.phone,
    preferredTime: row.preferredTime,
    message: row.message ?? '',
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    statusHistory: row.statusChanges.map((change) => ({
      status: change.status,
      changedAt: change.changedAt.toISOString(),
    })),
  };
}
