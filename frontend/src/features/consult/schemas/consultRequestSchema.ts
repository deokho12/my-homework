import { z } from 'zod';

import { isProcedureId } from '@/features/procedure';
import { CONSULT_PREFERRED_TIMES, type ProcedureId } from '@/types/domain';

/**
 * 상담 신청 폼 스키마.
 *
 * **계약(`ConsultRequestCreateRequest`)과 같은 규칙·같은 문구를 쓴다** — 화면에서 막힐 때와
 * 서버에서 막힐 때 다른 문장이 뜨면 사용자는 규칙이 두 개라고 이해한다 (`authSchemas.ts` 와
 * 같은 원칙). 판정의 주체는 여전히 서버다. 여기 검사는 왕복 전에 알려주는 UX 다.
 *
 * 이 스키마는 **버튼 활성 여부의 단일 근거**이기도 하다 — 화면이 `이름이 비었나 / 번호가
 * 맞나` 를 따로 적으면 같은 판정이 두 곳으로 갈린다.
 */

/** 계약 `ConsultRequestCreateRequest.phone` 의 pattern 과 **같은 정규식**이다. */
export const CONSULT_PHONE_PATTERN = /^01[016789]-?\d{3,4}-?\d{4}$/;

/** 계약 `422 VALIDATION_FAILED` 의 `details[].message`(`INVALID_PHONE_FORMAT`)와 같은 문구. */
export const INVALID_PHONE_MESSAGE = '휴대폰 번호 형식이 아니에요. 010-1234-5678 처럼 입력해주세요';

export const consultRequestSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요').max(50, '이름은 50자까지 입력할 수 있어요'),
  /**
   * 빈 값과 형식 오류를 **다른 문구로** 가른다 — 아직 쓰지 않은 칸과 틀리게 쓴 칸은
   * 사용자가 해야 할 일이 다르다.
   */
  phone: z
    .string()
    .trim()
    .min(1, '연락처를 입력해주세요')
    .regex(CONSULT_PHONE_PATTERN, INVALID_PHONE_MESSAGE),
  /** `null` 은 화면 기본 선택지 `잘 모르겠어요` 다 (계약도 같은 뜻). */
  procedureId: z
    .custom<ProcedureId>((value) => isProcedureId(typeof value === 'string' ? value : null), {
      message: '알 수 없는 시술이에요',
    })
    .nullable(),
  preferredTime: z.enum(CONSULT_PREFERRED_TIMES),
  message: z.string().max(2000, '남기고 싶은 말은 2000자까지 입력할 수 있어요'),
  /**
   * `[필수] 개인정보 제3자 제공 동의`. `z.literal(true)` 대신 `boolean` + `refine` 인 이유는
   * `authSchemas.ts` 의 약관 체크박스와 같다 — 폼 기본값 `false` 를 넣을 수 있어야 한다.
   */
  thirdPartyConsent: z.boolean().refine((value) => value, { message: '동의가 필요해요' }),
});

export type ConsultRequestFormInput = z.infer<typeof consultRequestSchema>;
