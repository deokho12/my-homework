/**
 * 상담 처리 이벤트 한 건을 **알림 문구로 바꾸는 순수 모듈**. DB 도 요청도 NestJS 도 모른다.
 *
 * 원본은 프런트의 `frontend/src/features/consult/consultNotificationText.ts` 와 그 함수가
 * 부르던 `consultDisplay.ts` 의 `formatVisitAt` · `lib/josa.ts` 의 `withSubjectParticle` 이다.
 * 셋을 한 파일로 모은 이유는 아래 ★ 제약 때문이다 — 문구를 만드는 데 필요한 것이 전부
 * 여기 있어야 import 가 0 이 된다.
 *
 * ★★ **이 파일은 import 가 0 이어야 한다** (`./transition` 같은 **상대 경로**만 예외).
 *    프런트의 동기화 테스트가 이 파일을 상대 경로로 읽어 "같은 문장이 나오는가" 를 고정한다.
 *
 * **문구를 만드는 곳은 이제 서버의 여기 하나다** (계약 `AppNotification.title`/`message` 표,
 * `docs/api/README.md` §9). 호출부는 셋이다:
 *   1. `POST /consult-requests` → `adminConsultNotificationText` (접수 알림, `audience=admin`)
 *   2. `PATCH /consult-requests/{id}/status` → `consultNotificationText` (환자 알림)
 *   3. **시드** (`prisma/seed/data/notifications.ts`) — 문자열을 적는 대신 이 함수를 부른다.
 *      적어 두면 문구를 다듬는 날 시드와 런타임이 조용히 갈린다 (`docs/database/README.md` §12.13-D)
 *
 * 화면은 **저장된 문자열을 그대로 그린다.** 알림을 그릴 때 이 함수를 다시 부르지 않는다 —
 * 보낸 문구는 기록이라, 병원이 개명하거나 문장을 다듬어도 과거 알림이 바뀌면 안 된다.
 */
import type { ConsultCancelReason, ConsultEvent, ConsultStatus } from './transition';

/** 상태 라벨. 되돌림·내원완료 문구(`'{라벨}'(으)로 변경되었어요`)가 이 표를 쓴다. */
export const CONSULT_STATUS_LABEL: Record<ConsultStatus, string> = {
  new: '신규',
  contacted: '연락중',
  booked: '예약확정',
  visited: '내원완료',
  cancelled: '취소',
};

export interface ConsultNotificationInput {
  /** `reschedule` 은 상태가 그대로이고 일시만 바뀐 이벤트다 (`./transition`). */
  event: ConsultEvent;
  /** **바뀐 뒤의** 상태. 알림 행의 `consultStatus` 로도 저장된다. */
  status: ConsultStatus;
  visitAt: string | null;
  cancelReason: ConsultCancelReason | null;
  /** 없거나 빈 문자열이면 `병원`. 서버는 `hospitals` 를 조인해 채운다. */
  hospitalName: string | null;
}

export interface ConsultNotificationText {
  title: string;
  message: string;
}

/** 병원 이름을 알 수 없을 때. */
const FALLBACK_HOSPITAL_NAME = '병원';

/**
 * 취소 사유 → 환자에게 보이는 꼬리말.
 *
 * 관리자 라벨(`연락이 안 됨`·`중복 신청`)을 **쓰지 않는다.** 같은 코드의 두 독자용 문장이라,
 * 한쪽을 다듬어도 다른 쪽이 흔들리면 안 된다 — 관리자는 사유를 고르고, 환자는 사정을 듣는다.
 */
const CANCEL_TAIL: Record<ConsultCancelReason, string> = {
  no_answer: '연락이 닿지 않아 취소됐어요',
  patient_request: '요청하신 대로 취소했어요',
  procedure_unavailable: '이 병원에서 진료하지 않는 시술이에요',
  duplicate: '같은 신청이 있어 하나로 정리했어요',
  etc: '자세한 사유는 병원에 문의해 주세요',
};

/** 사유가 없거나 우리가 모르는 코드일 때도 `기타` 와 같은 한 줄이다 (계약 §15 enum 방어). */
const CANCEL_TAIL_FALLBACK = CANCEL_TAIL.etc;

/**
 * 환자에게 가는 상담 알림 문구 (계약의 `title`/`message` 표, 요청 08).
 *
 * `내원완료` 와 되돌림(`new` 등)은 **기존 문구를 유지한다** — 요청서가 그 두 경우의 문장을
 * 적지 않았고, 지어내면 요청자가 검수하지 않은 문장이 환자에게 나간다.
 */
export function consultNotificationText({
  event,
  status,
  visitAt,
  cancelReason,
  hospitalName,
}: ConsultNotificationInput): ConsultNotificationText {
  const hospital = (hospitalName ?? '').trim() || FALLBACK_HOSPITAL_NAME;

  if (event === 'reschedule') {
    return { title: '예약 일시가 바뀌었어요', message: visitMessage(hospital, visitAt) };
  }

  switch (status) {
    case 'booked':
      return { title: '상담 예약이 확정됐어요', message: visitMessage(hospital, visitAt) };

    case 'contacted':
      return {
        title: '병원이 연락 중이에요',
        message: `${withSubjectParticle(hospital)} 상담 신청을 확인했어요. 곧 전화가 올 거예요`,
      };

    case 'cancelled':
      return {
        title: '상담이 취소됐어요',
        message: `${hospital} · ${(cancelReason && CANCEL_TAIL[cancelReason]) || CANCEL_TAIL_FALLBACK}`,
      };

    // 내원완료·신규는 요청서 08 의 범위 밖이라 지금 문구를 그대로 둔다 (2026-10-13 결정).
    default:
      return {
        title: '상담 상태 변경',
        message: `상담 상태가 '${CONSULT_STATUS_LABEL[status]}'(으)로 변경되었어요`,
      };
  }
}

/**
 * 접수 알림 문구 (`audience=admin`, 계약 `POST /consult-requests` 의 부수효과).
 *
 * **`{name}` 은 폼에 입력된 이름 그대로이며 마스킹하지 않는다** — 수신자가 그 병원 담당자
 * 뿐이기 때문이고, 그것이 운영자를 수신자에서 뺀 이유다 (계약 · `docs/api/README.md` §4).
 */
export function adminConsultNotificationText(applicantName: string): ConsultNotificationText {
  return { title: '새로운 상담 신청', message: `${applicantName}님이 상담을 신청했어요` };
}

/**
 * 꼭 필요한 정보(병원 · 일시)를 앞에, 꼬리말을 뒤에 둔다 — 알림함 본문이 3줄에서 잘려도
 * 잘리는 쪽이 꼬리말이 되도록 설계한 순서다.
 */
function visitMessage(hospital: string, visitAt: string | null): string {
  const visit = formatVisitAt(visitAt);

  return visit
    ? `${hospital} · ${visit} 방문. 변경이 필요하면 병원에 전화해 주세요`
    : // 읽을 수 없는 일시로 날짜를 지어내지 않는다.
      `${hospital} · 방문 일시는 병원에서 다시 알려드려요`;
}

/* ------------------------------------------------------------------ 일시 표기 */

const SEOUL = 'Asia/Seoul';

const VISIT_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: SEOUL,
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  // 자정을 `24:00` 이 아니라 `00:00` 으로 적는 것은 `hour12: false` 가 ko-KR 에서 h23 으로
  // 풀리기 때문이다. ECMA-402 는 `hour12` 가 있으면 `hourCycle` 을 무시한다 — 아래 줄은 그
  // 동작을 문서로 남길 뿐이다.
  hour12: false,
  hourCycle: 'h23',
});

/**
 * 로케일이 끼우는 구두점(`10. 9.`)을 버리고 값만 꺼낸다 — 표기(`10/9(금) 14:00`)는 우리가 정한다.
 */
function dateParts(format: Intl.DateTimeFormat, iso: string | null | undefined): Record<string, string> | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts: Record<string, string> = {};

  for (const part of format.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  return parts;
}

/**
 * `10/9(금) 14:00`. 읽을 수 없으면 `null`. **표기는 이것 하나다** (계약 2026-10-22 확정) —
 * 마이페이지 상담 내역의 `10/9(금) 14:00 방문` 과 같은 기준이어야 한다.
 */
export function formatVisitAt(iso: string | null | undefined): string | null {
  const parts = dateParts(VISIT_FORMAT, iso);

  return parts ? `${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute}` : null;
}

/* ------------------------------------------------------------------ 조사 */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 초성 19 × 중성 21 × 종성 28 로 짜인 완성형이라, 종성은 28 로 나눈 나머지다. */
const JONGSEONG_COUNT = 28;

/**
 * 이름 + 주격 조사. 받침이 있으면 `이`, 없으면 `가`.
 *
 * **끝 글자가 한글 음절이 아니면 `이(가)`** 다 (`Smile Dental이(가)`). 영문·숫자는 읽는 법이
 * 사람마다 갈려서(`101`→`백한`/`일공일`) 한쪽을 고르면 틀리는 쪽이 생긴다.
 */
export function withSubjectParticle(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';

  // 서러게이트 쌍(이모지 등)이 끝에 와도 반쪽만 보지 않도록 코드포인트로 쪼갠다.
  const last = [...trimmed].at(-1) as string;
  const code = last.codePointAt(0) as number;

  if (code < HANGUL_FIRST || code > HANGUL_LAST) return `${trimmed}이(가)`;

  return `${trimmed}${(code - HANGUL_FIRST) % JONGSEONG_COUNT === 0 ? '가' : '이'}`;
}
