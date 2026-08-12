import { z } from 'zod';

import { AGREEMENT_SLUGS, type AgreementSlug } from '@/features/auth/api/legalApi';

/**
 * 로그인·회원가입 폼 스키마. **문구까지 백엔드 `auth.schemas.ts` 와 맞춘다** —
 * 같은 입력이 클라이언트에서 막힐 때와 서버에서 막힐 때 다른 문장이 뜨면 사용자는
 * 두 규칙이 있다고 이해한다.
 */

const email = z
  .string()
  .trim()
  .min(1, '이메일을 입력해주세요')
  .max(254, '이메일이 너무 길어요')
  .email('이메일 형식이 올바르지 않아요');

export const loginSchema = z.object({
  /**
   * **서버는 로그인에서 이메일 형식을 검사하지 않는다** (형식 위반을 422 로 거절하면
   * "짧은 비밀번호 = 없는 계정" 처럼 계정 존재 여부가 새기 때문이다 — 백엔드 주석).
   * 클라이언트는 오타를 바로 알려주려고 형식을 본다. 서버 동작을 바꾸지는 않는다.
   */
  email,
  password: z.string().min(1, '비밀번호를 입력해주세요').max(128, '비밀번호가 너무 길어요'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * 약관 동의 체크박스. 서버는 없는 버전에 동의하면 `422` 를 낸다 (`legalApi.ts` 참고).
 *
 * `z.literal(true)` 대신 `boolean` + `refine` 을 쓴다. 전자는 추론 타입이 `true` 라
 * 폼의 기본값(`false`)을 넣을 수 없다.
 */
const agreementField = z.boolean().refine((value) => value, { message: '동의가 필요해요' });

const agreementFields = Object.fromEntries(
  AGREEMENT_SLUGS.map((slug) => [slug, agreementField])
) as Record<AgreementSlug, typeof agreementField>;

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해주세요').max(50, '이름은 50자까지 입력할 수 있어요'),
    email,
    password: z
      .string()
      .min(6, '비밀번호는 6자 이상이어야 해요')
      .max(128, '비밀번호는 128자까지 입력할 수 있어요'),
    passwordConfirm: z.string().min(1, '비밀번호를 다시 입력해주세요'),
    agreements: z.object(agreementFields),
  })
  .refine((values) => values.password === values.passwordConfirm, {
    message: '비밀번호가 일치하지 않아요',
    // 오류를 확인 칸 아래에 붙인다. 폼 전체 오류로 두면 어느 칸을 고쳐야 할지 알 수 없다.
    path: ['passwordConfirm'],
  });

export type SignupInput = z.infer<typeof signupSchema>;
