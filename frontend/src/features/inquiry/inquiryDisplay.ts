import type { BadgeTone } from '@/components/Badge';
import type { InquiryStatus } from '@/types/domain';

/**
 * 문의 한 건을 **화면 문자열로 바꾸는 순수 모듈**. React 도 네트워크도 모른다
 * (`features/consult/consultDisplay.ts` 와 같은 자리).
 *
 * 마이페이지 `내 문의` 와 관리자 문의 화면이 같은 제목·같은 색을 쓰게 하려고 모았다.
 */

/**
 * 상태 → 칩 색. 문구는 여기서 정하지 않는다 — 환자용(`INQUIRY_STATUS_LABEL`)과
 * 관리자용(`ADMIN_INQUIRY_STATUS_LABEL`)이 다르지만 **색과 판정은 하나를 공유한다.**
 */
export const INQUIRY_STATUS_TONE: Record<InquiryStatus, BadgeTone> = {
  unanswered: 'info', // 아직 병원이 답하지 않았다 — 눈에 띄되 완료가 아니다
  answered: 'brand', // 문의자가 기다리던 상태
};

/** 목록 카드 제목의 최대 길이. 넘으면 잘라 `…` 를 붙인다. */
const TITLE_MAX = 40;

/**
 * 목록 카드의 제목. **저장되지 않는 값이다** — 작성 화면에 제목 칸이 없어서 본문의
 * 첫 줄을 쓴다 (계약 `HospitalInquiry` 가 `title` 을 두지 않은 이유와 같다).
 */
export function inquiryTitle(content: string): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';

  return firstLine.length > TITLE_MAX ? `${firstLine.slice(0, TITLE_MAX)}…` : firstLine;
}

/* ------------------------------------------------------------------ 날짜 */

/**
 * 관리자 목록·상세의 절대 시각. **기기 시계가 아니라 `Asia/Seoul` 달력**이다 —
 * 해외에서 접속해도 병원이 본 시각과 같아야 한다. 상대 표기(`3시간 전`)는 쓰지 않는다.
 *
 * 환자 쪽 날짜(`10/7`)는 새로 만들지 않고 `consultDisplay.ts` 의 `formatAppliedAt` 을 쓴다.
 */
const INQUIRY_AT_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'numeric',
  day: 'numeric',
  // 자정을 `24:00` 이 아니라 `00:00` 으로 적는 이유는 `consultDisplay.ts` 와 같다.
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

/** `10/7 18:20`. 읽을 수 없으면 `null` — 빈 칸을 지어내지 않는다. */
export function formatInquiryAt(iso: string | null | undefined): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const part of INQUIRY_AT_FORMAT.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }

  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}
