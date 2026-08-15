import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ERROR_CATALOG } from '../errors/api-error';
import type { ApiErrorCode, ApiErrorDetail } from '../errors/api-error';
import { getRequestId } from '../http/request-id';
import { traceStep } from '../logging/dev-trace';

/**
 * 모든 4xx/5xx 응답 본문. docs/api/openapi.yaml `components.schemas.Error` 와 같은 모양이다.
 *
 * 초기 골격은 평평한 `{ statusCode, code, message, path, timestamp }` 였는데,
 * OpenAPI 계약은 `{ error: { code, message, details?, requestId } }` 다.
 * **계약을 따른다** — 프론트엔드와 Flutter 앱이 생성된 타입으로 이 모양을 읽는다.
 */
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

/**
 * 전역 예외 필터. 세 가지를 보장한다.
 *
 * 1. **에러 응답 모양이 하나다.** Nest 기본 응답은 `message` 가 문자열일 때와
 *    배열일 때가 갈리는데, 그걸 프론트가 분기하게 두지 않는다.
 * 2. **내부 정보가 새지 않는다.** HttpException 이 아닌 것(Prisma 오류,
 *    TypeError 등)은 500 + 고정 문구로만 나가고, 실제 스택은 서버 로그에 남는다.
 * 3. **요청 id 가 항상 실린다.** 사용자가 캡처한 화면의 문구로 서버 로그를 찾을 수 있다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.toResponse(exception, getRequestId(request));

    // 막은 이유를 단계 추적에 남긴다 (개발 모드 밖에서는 no-op). 마지막으로 찍힌 `✓` 가
    // 통과한 마지막 단계이므로, 이 한 줄이 "어느 단계에서 왜 멈췄는가" 를 완성한다.
    traceStep(
      request,
      `✗ ${body.error.code}`,
      body.error.details?.map((detail) => detail.field).join(', ') ?? '',
    );

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} (requestId=${body.error.requestId})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private toResponse(exception: unknown, requestId: string): { status: number; body: ErrorResponseBody } {
    // body-parser 가 던지는 JSON 파싱 오류. HttpException 이 아니라서 그냥 두면 500 이 된다.
    // 문서 규약상 "본문이 JSON 이 아님" 은 400 MALFORMED_REQUEST 다 (§11).
    if (isBodyParseError(exception)) {
      return this.fromCode('MALFORMED_REQUEST', requestId);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return {
          status,
          body: { error: { code: codeFromStatus(status), message: payload, requestId } },
        };
      }

      const record = payload as Record<string, unknown>;
      // `code` 가 있는 것은 우리가 던진 ApiError 다 → 문구도 우리 것(사용자용 한국어)이다.
      const ownCode = typeof record.code === 'string' ? record.code : null;
      const code = ownCode ?? codeFromStatus(status);
      const rawMessage = Array.isArray(record.message)
        ? (record.message as string[]).join(', ')
        : typeof record.message === 'string'
          ? record.message
          : exception.message;
      const details = Array.isArray(record.details) ? (record.details as ApiErrorDetail[]) : undefined;

      // Nest 내장 예외(라우터의 NotFoundException, body-parser 의 BadRequestException 등)는
      // 영어 내부 문구를 들고 온다(`Cannot POST /api/x`, `Unexpected end of JSON input`).
      // 그대로 내보내면 ① 사용자에게 영어가 보이고 ② 내부 구현이 새므로 카탈로그 문구로 바꾼다.
      const message = ownCode ? rawMessage : fallbackMessage(code, status);

      if (!ownCode && rawMessage && rawMessage !== message) {
        this.logger.debug(`원래 예외 문구: ${status} ${code} — ${rawMessage} (requestId=${requestId})`);
      }

      return {
        status,
        body: { error: { code, message, ...(details ? { details } : {}), requestId } },
      };
    }

    return this.fromCode('INTERNAL_ERROR', requestId);
  }

  private fromCode(code: ApiErrorCode, requestId: string): { status: number; body: ErrorResponseBody } {
    const entry = ERROR_CATALOG[code];

    return { status: entry.status, body: { error: { code, message: entry.message, requestId } } };
  }
}

/** Nest 기본 예외(NotFoundException 등)가 코드를 안 들고 올 때의 대체값. */
function codeFromStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'MALFORMED_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_FAILED';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

/** 카탈로그에 있는 코드면 그 문구, 없으면 상태에 맞는 일반 문구. */
function fallbackMessage(code: string, status: number): string {
  const entry = (ERROR_CATALOG as Record<string, { status: number; message: string } | undefined>)[code];

  if (entry) return entry.message;

  return status >= HttpStatus.INTERNAL_SERVER_ERROR
    ? ERROR_CATALOG.INTERNAL_ERROR.message
    : '요청을 처리할 수 없어요';
}

function isBodyParseError(exception: unknown): boolean {
  if (!(exception instanceof Error)) return false;

  const candidate = exception as Error & { type?: unknown; status?: unknown };

  return candidate.type === 'entity.parse.failed' || (exception instanceof SyntaxError && candidate.status === 400);
}
