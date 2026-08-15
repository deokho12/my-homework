import { HttpException } from '@nestjs/common';

/**
 * =============================================================================
 * 에러 코드 카탈로그 — docs/api/README.md §11 "에러 응답 형식과 코드 체계"
 * =============================================================================
 *
 * 코드 하나가 **HTTP 상태와 사용자 문구를 함께** 들고 있다. 두 곳에 흩어지면
 * 같은 코드가 라우트마다 다른 상태·다른 문구로 나가게 되고, 프론트엔드가
 * 코드별 문구 사전을 다시 만들어야 한다 (문서가 명시적으로 피하려는 상황이다).
 *
 * `message` 는 **사용자에게 그대로 보여주는 한국어**다. 화면 문서의 문구와
 * 어긋나면 안 되므로 문구를 바꿀 때는 docs/features/*.md 를 함께 확인한다.
 */
export const ERROR_CATALOG = {
  // ------------------------------------------------------------------ 공통
  MALFORMED_REQUEST: { status: 400, message: '요청 형식이 올바르지 않아요' },
  /** 라우트 자체가 없을 때. 도메인 자원의 404 는 각자 전용 코드를 쓴다. */
  NOT_FOUND: { status: 404, message: '요청한 경로를 찾을 수 없어요' },
  UNAUTHENTICATED: { status: 401, message: '로그인이 필요해요' },
  ACCESS_TOKEN_EXPIRED: { status: 401, message: '로그인이 만료되었어요. 다시 로그인해주세요' },
  FORBIDDEN: { status: 403, message: '이 작업을 수행할 권한이 없어요' },
  VALIDATION_FAILED: { status: 422, message: '입력값을 확인해주세요' },
  FIELD_NOT_WRITABLE: { status: 422, message: '수정할 수 없는 항목이에요' },
  RATE_LIMITED: { status: 429, message: '요청이 너무 많아요. 잠시 후 다시 시도해주세요' },
  INTERNAL_ERROR: { status: 500, message: '일시적인 문제가 발생했어요. 잠시 후 다시 시도해주세요' },

  // ------------------------------------------------------------------ 인증
  /** 계정 없음과 비밀번호 불일치가 **같은 코드·같은 문구**다 (계정 열거 방지). */
  INVALID_CREDENTIALS: { status: 401, message: '이메일 또는 비밀번호가 올바르지 않아요' },
  EMAIL_ALREADY_REGISTERED: { status: 409, message: '이미 가입된 이메일이에요' },
  REFRESH_TOKEN_INVALID: { status: 401, message: '로그인이 만료되었어요. 다시 로그인해주세요' },
  REFRESH_TOKEN_REUSED: { status: 401, message: '보안을 위해 로그아웃되었어요. 다시 로그인해주세요' },
  PROVIDER_MISMATCH: { status: 409, message: '이 이메일은 다른 방법으로 가입되어 있어요' },

  // ------------------------------------------------- 병원 / 전문의 / 담당자
  HOSPITAL_NOT_FOUND: { status: 404, message: '병원 정보를 찾을 수 없어요' },
  /** 공개 리소스(병원·전문의)의 담당 범위 밖 접근. 존재를 숨겨서 얻는 것이 없다. */
  HOSPITAL_NOT_MANAGED: { status: 403, message: '담당하지 않는 병원이에요' },
  DOCTOR_NOT_FOUND: { status: 404, message: '전문의 정보를 찾을 수 없어요' },
  USER_NOT_FOUND: {
    status: 404,
    message: '그 이메일로 가입된 계정이 없어요. 먼저 회원가입을 안내해주세요',
  },
  CANNOT_ASSIGN_OPERATOR: { status: 422, message: '운영자 계정은 병원 담당자로 지정할 수 없어요' },

  // ------------------------------------------------------------------ 상담
  /**
   * **없는 상담과 "담당 병원의 상담이 아님" 을 구분하지 않는다.** 상담 id 는
   * 고객 개인정보와 1:1 대응이라, 403 을 주면 id 순차 대입으로 건수가 새어 나간다.
   */
  CONSULT_REQUEST_NOT_FOUND: { status: 404, message: '상담 정보를 찾을 수 없어요' },
  CONSULT_CLOSED: { status: 409, message: '지금은 이 병원의 상담 신청을 받지 않아요' },

  // ------------------------------------------------------------ 입점 문의
  PARTNER_INQUIRY_NOT_FOUND: { status: 404, message: '입점 문의를 찾을 수 없어요' },
} as const satisfies Record<string, { status: number; message: string }>;

export type ApiErrorCode = keyof typeof ERROR_CATALOG;

/** `VALIDATION_FAILED` 의 `details[]` 한 항목. docs/api/openapi.yaml `ErrorDetail`. */
export interface ApiErrorDetail {
  /** 점 표기 경로. 배열은 `doctors[2].name`. */
  field: string;
  code: string;
  message: string;
}

/**
 * 도메인 코드로 던지는 예외. 상태 코드와 문구를 호출부가 다시 적지 않는다.
 *
 * ```ts
 * throw new ApiError('CONSULT_REQUEST_NOT_FOUND');
 * throw new ApiError('VALIDATION_FAILED', { details });
 * ```
 *
 * `AllExceptionsFilter` 가 이 payload 를 `{ error: { code, message, details, requestId } }`
 * 로 직렬화한다.
 */
export class ApiError extends HttpException {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, options?: { message?: string; details?: ApiErrorDetail[] }) {
    const entry = ERROR_CATALOG[code];

    super(
      {
        code,
        message: options?.message ?? entry.message,
        ...(options?.details ? { details: options.details } : {}),
      },
      entry.status,
    );

    this.code = code;
  }
}
