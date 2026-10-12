import { z } from 'zod';

import { isInquiryTopic, type InquiryTopic } from '@/types/domain';

/**
 * 문의 작성 폼 스키마.
 *
 * **계약(`HospitalInquiryCreateRequest`)과 같은 경계값을 쓴다** — trim 후 5~1000자,
 * 주제는 기본값 없음. 판정의 주체는 여전히 서버(여기서는 `api/inquiryApi.ts`)이고,
 * 이 스키마는 왕복 전에 알려주는 UX 이자 **`문의 남기기` 버튼 활성의 단일 근거**다.
 */

/** 계약 `HospitalInquiryCreateRequest.content` 의 `minLength`/`maxLength`. */
export const INQUIRY_CONTENT_MIN = 5;
export const INQUIRY_CONTENT_MAX = 1000;

/**
 * 거절 문구는 **화면과 api 가 같은 문장을 쓴다** (`consultRequestSchema` 의
 * `INVALID_PHONE_MESSAGE` 와 같은 자리). 값은 계약의 `details[].message` 그대로다
 * (`TOPIC_REQUIRED` / `CONTENT_TOO_SHORT` / `CONTENT_TOO_LONG`) — 서버로 바뀌는 날
 * 같은 입력에 다른 문장이 뜨면 그것이 회귀다.
 */
export const INQUIRY_TOPIC_REQUIRED_MESSAGE = '문의 주제를 선택해주세요';
export const INQUIRY_CONTENT_SHORT_MESSAGE = `문의 내용을 ${INQUIRY_CONTENT_MIN}자 이상 입력해주세요`;
export const INQUIRY_CONTENT_LONG_MESSAGE = `문의 내용은 ${INQUIRY_CONTENT_MAX}자까지 쓸 수 있어요`;

export const inquirySchema = z.object({
  /**
   * 초기값은 `null`(아무것도 고르지 않음)이다. `z.enum` 대신 `custom` 인 이유는 상담 폼의
   * `procedureId` 와 같다 — 폼 기본값으로 `null` 을 넣을 수 있어야 한다.
   */
  topic: z.custom<InquiryTopic>((value) => isInquiryTopic(value), {
    message: INQUIRY_TOPIC_REQUIRED_MESSAGE,
  }),
  content: z
    .string()
    .trim()
    .min(INQUIRY_CONTENT_MIN, INQUIRY_CONTENT_SHORT_MESSAGE)
    .max(INQUIRY_CONTENT_MAX, INQUIRY_CONTENT_LONG_MESSAGE),
  /** `다른 사람도 볼 수 있게 공개` (기본 켜짐). 켜도 병원이 공개로 답해야 실제로 공개된다. */
  isPublic: z.boolean(),
});

export type InquiryFormInput = z.infer<typeof inquirySchema>;
