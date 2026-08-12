import { Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { ZodIssue, ZodType } from 'zod';

import { ApiError } from '../errors/api-error';
import type { ApiErrorDetail } from '../errors/api-error';

/**
 * Zod 스키마로 요청 body/query/param 을 검증하는 파이프.
 *
 * ```ts
 * @Post()
 * create(@Body(new ZodValidationPipe(createConsultSchema)) dto: CreateConsultDto) {}
 * ```
 *
 * **422 VALIDATION_FAILED** 를 던진다 (400 이 아니다). docs/api/README.md §11 이
 * 두 코드를 나눈 이유를 명시한다: `400` 은 클라이언트 버그라 화면이 뭉뚱그리고,
 * `422` 는 `details` 를 필드 밑에 뿌려야 한다. 본문이 JSON 이 아닌 경우(구조적 오류)만
 * `400 MALFORMED_REQUEST` 이며 그것은 전역 필터가 처리한다.
 *
 * nestjs-zod 같은 래퍼 패키지를 쓰지 않은 이유: 필요한 코드가 이 몇 줄이고,
 * 래퍼는 Nest/Zod 메이저 버전에 각각 묶여서 업그레이드를 한 번 더 막는다.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const details: ApiErrorDetail[] = result.error.issues.map((issue) => ({
        field: fieldPath(issue),
        code: detailCode(issue),
        message: issue.message,
      }));

      throw new ApiError('VALIDATION_FAILED', { details });
    }

    return result.data;
  }
}

/** 점 표기 경로. 배열 인덱스는 `doctors[2].name` 형태다 (openapi `ErrorDetail`). */
function fieldPath(issue: ZodIssue): string {
  return issue.path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;

    return acc ? `${acc}.${segment}` : String(segment);
  }, '');
}

/**
 * Zod issue → 문서의 detail 코드(대문자 SNAKE_CASE).
 *
 * 문서 예시(`REQUIRED`, `NOT_A_NUMBER`, `INVALID_PHONE_FORMAT`)에 맞추려면
 * "값이 아예 없음" 과 "형식 위반" 을 나눠야 한다. 프론트엔드가 필드별 문구를
 * 서버 문구로 그대로 쓰기 때문에(§11) 코드는 분기용으로만 쓰인다.
 */
function detailCode(issue: ZodIssue): string {
  if (issue.code === 'invalid_type') {
    if (issue.received === 'undefined' || issue.received === 'null') return 'REQUIRED';
    if (issue.expected === 'number') return 'NOT_A_NUMBER';

    return 'INVALID_TYPE';
  }

  if (issue.code === 'invalid_string') {
    if (issue.validation === 'email') return 'INVALID_EMAIL_FORMAT';

    return 'INVALID_FORMAT';
  }

  if (issue.code === 'too_small') {
    // 문자열 최소 1자는 "필수" 와 같은 의미다 (trim 후 빈 문자열)
    if (issue.type === 'string' && Number(issue.minimum) <= 1) return 'REQUIRED';

    return 'TOO_SHORT';
  }

  if (issue.code === 'too_big') return 'TOO_LONG';

  return issue.code.toUpperCase();
}
