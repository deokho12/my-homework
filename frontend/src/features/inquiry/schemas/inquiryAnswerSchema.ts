import { z } from 'zod';

/**
 * 답변 등록 폼 스키마 (계약 `HospitalInquiryAnswerRequest`).
 *
 * 길이 경계는 문의 본문과 같다 (trim 후 5~1000자). `isPublic` 은 **필수이고 기본값이 없다** —
 * 폼에서는 체크박스가 늘 `true`/`false` 중 하나라 스키마가 막을 일이 없지만,
 * 값을 보내지 않는 경로가 생기면 서버가 `422 ANSWER_PUBLIC_REQUIRED` 로 막는다.
 */

export const ANSWER_CONTENT_MIN = 5;
export const ANSWER_CONTENT_MAX = 1000;

/** 문의 쪽과 같은 규약 — 폼과 api 가 **계약 문구 한 벌**을 함께 쓴다. */
export const ANSWER_CONTENT_SHORT_MESSAGE = `답변 내용을 ${ANSWER_CONTENT_MIN}자 이상 입력해주세요`;
export const ANSWER_CONTENT_LONG_MESSAGE = `답변 내용은 ${ANSWER_CONTENT_MAX}자까지 쓸 수 있어요`;

export const inquiryAnswerSchema = z.object({
  content: z
    .string()
    .trim()
    .min(ANSWER_CONTENT_MIN, ANSWER_CONTENT_SHORT_MESSAGE)
    .max(ANSWER_CONTENT_MAX, ANSWER_CONTENT_LONG_MESSAGE),
  isPublic: z.boolean(),
});

export type InquiryAnswerFormInput = z.infer<typeof inquiryAnswerSchema>;

/**
 * `자주 쓰는 답변` 의 빈칸(`[진료시간]`)이 그대로 남았는지. 남은 **첫 조각**을 돌려준다 —
 * 경고 문구와 제출 확인창이 같은 조각을 가리켜야 담당자가 어디를 고칠지 안다.
 *
 * 차단이 아니라 확인이다. 대괄호가 정상인 문장(`[본원 2층]`)도 있을 수 있어서
 * 규칙으로 막으면 멀쩡한 답변이 등록되지 않는다.
 */
export function remainingPlaceholder(content: string): string | null {
  return /\[[^\]]+\]/.exec(content)?.[0] ?? null;
}
