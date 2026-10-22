import type { Prisma } from '@prisma/client';

import { applyPiiPolicy } from './masking';
import type { ConsultProjectionView } from './masking';
import { cancelReasonOf } from './transition';
import type { ConsultCancelReason } from './transition';

/**
 * DB 행 → 계약 응답. **투영이 둘이다.**
 *
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: `visitAt`·파생 `cancelReason`·`thirdPartyConsent` 추가, 이력 행에
 *  `event`·`visitAt`·`cancelReason`·`notified` 추가, 신청자 투영에서 `reschedule` 행 제외,
 *  마스킹에 **투영 축**(목록/상세) 전달.)
 *
 * | | 관리자 (`ConsultRequest`) | 신청자 (`MyConsultRequest`) |
 * |---|---|---|
 * | `memos` | 있다 | **없다** (내부 공유용) |
 * | `statusHistory[].changedByName` | 있다 | **없다** |
 * | `statusHistory` 의 `reschedule` 행 | 있다 | **없다** — `예약확정` 중복으로 보인다 |
 * | `cancelReason` | 있다 (이력에서 파생) | **없다** — 병원의 내부 처리 분류다 |
 * | `name`·`phone` | 역할 × 투영에 따라 마스킹 | 본인 것이라 원본 |
 * | `hospitalThumbnail` | 없다 | 있다 (내역 카드가 병원을 다시 조회하지 않게) |
 *
 * **구조가 다를 때만 투영을 나눈다.** 반대로 마스킹은 값 변환이라 스키마를 나누지 않는다 —
 * 계약이 그 기준을 명시했고 여기서 일관되게 적용한다.
 */

/** `CONSULT_INCLUDE` 로 조회한 결과의 모양. */
export interface ConsultRequestRow {
  id: string;
  /** 신청자. 응답에는 나가지 않지만 "내 상담인가" 와 알림 수신자 판정에 쓴다. */
  userId: string;
  hospitalId: string;
  doctorId: string | null;
  procedureId: string | null;
  name: string;
  phone: string;
  preferredTime: string;
  message: string | null;
  status: string;
  visitAt: Date | null;
  thirdPartyConsentAgreedAt: Date | null;
  thirdPartyConsentNoticeVersion: string | null;
  createdAt: Date;
  hospital: { name: string; thumbnail: string } | null;
  doctor: { name: string } | null;
  procedure: { name: string } | null;
  statusChanges: {
    event: string;
    status: string;
    changedAt: Date;
    visitAt: Date | null;
    cancelReason: string | null;
    notificationId: string | null;
    changedBy: { name: string } | null;
  }[];
  memos: { id: string; content: string; createdAt: Date; author: { name: string } | null }[];
}

/** 병원을 찾지 못했을 때의 표시. 화면 문서의 문구 그대로다. */
const UNKNOWN_HOSPITAL = '알 수 없는 병원';

export interface ConsultStatusChangeResponse {
  event: string;
  status: string;
  changedAt: string;
  changedByName: string | null;
  /** 이 이벤트 **직후**의 확정 일시 스냅샷. 현재 값이 아니다. */
  visitAt: string | null;
  cancelReason: string | null;
  /**
   * 이 이벤트로 환자에게 알림이 나갔는지. **저장된 사실**(`notification_id` 의 존재)을 그대로
   * 내려준다 — 규칙("모든 변경은 알림을 보낸다")으로 파생하면, 억제 규칙이 생기는 날 과거
   * 이력의 표시가 소급해 거짓이 된다. **알림 id 자체는 내려주지 않는다** (갈 화면이 없다).
   */
  notified: boolean;
}

export interface ConsultMemoResponse {
  id: string;
  content: string;
  createdAt: string;
  authorName: string | null;
}

export interface ConsultThirdPartyConsentResponse {
  agreedAt: string;
  noticeVersion: string;
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
  visitAt: string | null;
  cancelReason: ConsultCancelReason | null;
  statusHistory: ConsultStatusChangeResponse[];
  thirdPartyConsent: ConsultThirdPartyConsentResponse | null;
  memos: ConsultMemoResponse[];
}

export interface MyConsultRequestResponse {
  id: string;
  hospitalId: string;
  hospitalName: string;
  /** 계약상 `format: uri` 인 **선택** 필드다. 값이 없으면 키를 아예 넣지 않는다. */
  hospitalThumbnail?: string;
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
  visitAt: string | null;
  statusHistory: { status: string; changedAt: string; visitAt: string | null }[];
  thirdPartyConsent: ConsultThirdPartyConsentResponse | null;
}

/** 리포지토리가 쓰는 include. 두 투영이 요구하는 관계를 한 곳에 모은다. */
export const CONSULT_INCLUDE = {
  hospital: { select: { name: true, thumbnail: true } },
  doctor: { select: { name: true } },
  procedure: { select: { name: true } },
  statusChanges: {
    select: {
      event: true,
      status: true,
      changedAt: true,
      visitAt: true,
      cancelReason: true,
      notificationId: true,
      changedBy: { select: { name: true } },
    },
    // 저장·응답은 시간순. 최신순 표시는 화면의 표현이다 (계약).
    // 같은 시각의 두 이벤트가 뒤집히지 않게 id 타이브레이커를 둔다 — 파생 취소 사유가
    // "가장 최근 취소 행" 을 뒤에서부터 찾기 때문에 순서가 곧 답이다.
    orderBy: [{ changedAt: 'asc' }, { id: 'asc' }],
  },
  memos: {
    select: { id: true, content: true, createdAt: true, author: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  // `as const` 가 아니라 `satisfies` 다 — `as const` 는 `orderBy` 배열을 readonly 로 만들어
  // Prisma 의 include 타입에 맞지 않는다 (이력의 타이브레이커가 배열을 요구한다).
} satisfies Prisma.ConsultRequestInclude;

/** 동의 기록. **둘은 함께 채워지거나 함께 null 이다** (앱 불변식, DB §12.12). */
function projectConsent(row: ConsultRequestRow): ConsultThirdPartyConsentResponse | null {
  if (row.thirdPartyConsentAgreedAt === null || row.thirdPartyConsentNoticeVersion === null) {
    return null;
  }

  return {
    agreedAt: row.thirdPartyConsentAgreedAt.toISOString(),
    noticeVersion: row.thirdPartyConsentNoticeVersion,
  };
}

/**
 * 관리자 시야. `actorRole` 과 **투영(목록/상세)** 으로 마스킹이 갈린다 — 담당 병원의
 * `hospital_admin` 이 **상세를 볼 때만** 원본 번호가 나간다. 담당 여부 자체는
 * `HospitalScopeGuard` 와 스코프 질의가 이미 판정했다.
 */
export function projectConsultForAdmin(
  row: ConsultRequestRow,
  actorRole: string,
  view: ConsultProjectionView,
): ConsultRequestAdminResponse {
  const pii = applyPiiPolicy({ name: row.name, phone: row.phone }, actorRole, view);

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
    visitAt: row.visitAt?.toISOString() ?? null,
    // 저장된 컬럼이 아니라 이력에서 파생한다 — 재오픈하면 저절로 null 이 된다 (DB §12.4).
    cancelReason: cancelReasonOf(row.status, row.statusChanges),
    statusHistory: row.statusChanges.map((change) => ({
      event: change.event,
      status: change.status,
      changedAt: change.changedAt.toISOString(),
      changedByName: change.changedBy?.name ?? null,
      visitAt: change.visitAt?.toISOString() ?? null,
      cancelReason: change.cancelReason,
      notified: change.notificationId !== null,
    })),
    thirdPartyConsent: projectConsent(row),
    memos: row.memos.map((memo) => ({
      id: memo.id,
      content: memo.content,
      createdAt: memo.createdAt.toISOString(),
      authorName: memo.author?.name ?? null,
    })),
  };
}

/**
 * 신청자 시야. **`memos`·`changedByName`·`cancelReason` 이 여기 들어오면 안 된다** —
 * 내부 메모에는 담당자가 적은 내용이 그대로 있고, `연락이 안 됨` 같은 취소 사유는 환자에게
 * 비난으로 읽힌다.
 *
 * 본인 것이므로 이름·연락처는 마스킹하지 않는다.
 */
export function projectConsultForOwner(row: ConsultRequestRow): MyConsultRequestResponse {
  const thumbnail = row.hospital?.thumbnail ?? '';

  return {
    id: row.id,
    hospitalId: row.hospitalId,
    hospitalName: row.hospital?.name ?? UNKNOWN_HOSPITAL,
    // 빈 문자열은 uri 가 아니다 — 계약이 선택 필드로 둔 이유가 이것이라, 없으면 생략한다.
    ...(thumbnail === '' ? {} : { hospitalThumbnail: thumbnail }),
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
    visitAt: row.visitAt?.toISOString() ?? null,
    statusHistory: row.statusChanges
      // 일시 변경 행은 신청자에게 `예약확정` 중복으로 보인다. 변경 사실은 **알림으로 이미
      // 전달됐고** 결과는 위 `visitAt` 이 들고 있다 (계약 `MyConsultRequest`).
      .filter((change) => change.event !== 'reschedule')
      .map((change) => ({
        status: change.status,
        changedAt: change.changedAt.toISOString(),
        visitAt: change.visitAt?.toISOString() ?? null,
      })),
    thirdPartyConsent: projectConsent(row),
  };
}
