import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

/** 모든 에러 응답이 갖는 모양. 프론트엔드가 이 형태 하나만 다루면 된다. */
export interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

/**
 * 전역 예외 필터. 두 가지를 보장한다.
 *
 * 1. **에러 응답 모양이 하나다.** Nest 기본 응답은 `message` 가 문자열일 때와
 *    배열일 때가 갈리는데, 그걸 프론트가 분기하게 두지 않는다.
 * 2. **내부 정보가 새지 않는다.** HttpException 이 아닌 것(Prisma 오류,
 *    TypeError 등)은 500 + 고정 문구로만 나가고, 실제 스택은 서버 로그에 남는다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toBody(exception, request.url);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, path: string): ErrorResponseBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { statusCode, code: codeFromStatus(statusCode), message: payload, path, timestamp };
      }

      const record = payload as Record<string, unknown>;
      const message = Array.isArray(record.message)
        ? (record.message as string[]).join(', ')
        : typeof record.message === 'string'
          ? record.message
          : exception.message;

      return {
        statusCode,
        code: typeof record.code === 'string' ? record.code : codeFromStatus(statusCode),
        message,
        ...(record.details !== undefined ? { details: record.details } : {}),
        path,
        timestamp,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: '서버 오류가 발생했습니다.',
      path,
      timestamp,
    };
  }
}

function codeFromStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_ENTITY';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'TOO_MANY_REQUESTS';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
