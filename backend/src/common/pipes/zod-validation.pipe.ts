import { BadRequestException, Injectable } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** 400 응답의 `details` 에 들어가는 필드별 오류. */
export interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Zod 스키마로 요청 body/query/param 을 검증하는 파이프.
 *
 * ```ts
 * @Post()
 * create(@Body(new ZodValidationPipe(createConsultSchema)) dto: CreateConsultDto) {}
 * ```
 *
 * nestjs-zod 같은 래퍼 패키지를 쓰지 않은 이유: 필요한 코드가 이 30줄이고,
 * 래퍼는 Nest/Zod 메이저 버전에 각각 묶여서 업그레이드를 한 번 더 막는다.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const details: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: '요청 값이 올바르지 않습니다.',
        details,
      });
    }

    return result.data;
  }
}
