import type { InquiryStatus } from '@/types/domain';

/**
 * 문의의 **파생 규칙 두 개**. 저장소도 요청도 모르는 순수 함수다
 * (`docs/api/README.md` §14 의 `inquiryStatus` / `isPubliclyVisible` 를 그대로 옮긴 것).
 *
 * 목록·상세·카운트·공개 노출 네 곳이 **전부 이 둘을 쓴다.** 한쪽만 다른 규칙을 들면
 * 비공개 문의가 공개 목록에 뜬다 — 병원 카드 배지가 두 곳에서 갈렸던 전례(AGENTS.md)가
 * 여기서는 개인정보 사고가 된다.
 */

/** 상태 판정에 필요한 최소 모양. 답변의 존재 여부 하나가 근거다. */
export interface InquiryStatusInput {
  answer: { answeredAt: string } | null;
}

/** 공개 노출 판정에 필요한 최소 모양. */
export interface InquiryVisibilityInput extends InquiryStatusInput {
  /** 환자가 작성 시점에 고른 공개 여부. */
  isPublic: boolean;
  answer: { answeredAt: string; isPublic: boolean } | null;
}

/** 상태는 저장하지 않고 `answeredAt` 에서 파생한다. */
export function inquiryStatus(inquiry: InquiryStatusInput): InquiryStatus {
  return inquiry.answer === null ? 'unanswered' : 'answered';
}

/**
 * 공개 Q/A 노출: **환자가 공개로 남겼고 + 병원이 공개를 허용했고 + 답변완료.**
 *
 * 마지막 조건은 `answer !== null` 과 사실상 같지만 그대로 남긴다 — 읽는 사람이
 * "답변 전에도 공개될 수 있나" 를 함수 본문에서 바로 확인할 수 있어야 한다.
 */
export function isPubliclyVisible(inquiry: InquiryVisibilityInput): boolean {
  return (
    inquiry.isPublic === true &&
    inquiry.answer?.isPublic === true &&
    inquiryStatus(inquiry) === 'answered'
  );
}
