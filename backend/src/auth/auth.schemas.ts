import { z } from 'zod';

/**
 * 요청 본문 스키마. openapi `SignUpRequest` / `LogInRequest` / refresh·logout 본문과 1:1 이다.
 *
 * 서버가 다듬는 값 (openapi `signUp` 설명):
 * - `email` — 앞뒤 공백 제거 + 소문자
 * - `name` — 앞뒤 공백 제거
 *
 * 문구는 사용자에게 그대로 보인다 (`details[].message`).
 */
export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력해주세요').max(50, '이름은 50자까지 입력할 수 있어요'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, '이메일이 너무 길어요')
      // 지금 프론트엔드는 형식을 검사하지 않아 `@` 없이도 가입된다. 서버가 막는다.
      .email('이메일 형식이 올바르지 않아요'),
    password: z
      .string()
      .min(6, '비밀번호는 6자 이상이어야 해요')
      .max(128, '비밀번호는 128자까지 입력할 수 있어요'),
    /**
     * 약관 동의. **회원가입 화면에 아직 약관 절차가 없어서** 선택 필드다
     * (openapi 도 같은 이유로 optional). 도입되면 필수가 된다.
     */
    agreedTermsVersions: z
      .array(
        z.object({
          slug: z.enum(['terms', 'privacy', 'location']),
          version: z.string().min(1),
        }),
      )
      .optional(),
  })
  .strict();

export type SignUpDto = z.infer<typeof signUpSchema>;

export const logInSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254, '이메일이 너무 길어요').min(1, '이메일을 입력해주세요'),
    // 로그인은 **형식을 검사하지 않는다.** 입력한 그대로 비교한다 (openapi `LogInRequest`).
    // 여기서 6자 미만을 422 로 거절하면 "짧은 비밀번호 = 없는 계정" 이라는 정보가 새고,
    // 규칙이 바뀌기 전에 만든 계정이 로그인할 수 없게 된다.
    password: z.string().max(128, '비밀번호가 너무 길어요').min(1, '비밀번호를 입력해주세요'),
  })
  .strict();

export type LogInDto = z.infer<typeof logInSchema>;

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, '리프레시 토큰이 필요해요'),
  })
  .strict();

export type RefreshDto = z.infer<typeof refreshSchema>;
