import { createId } from '@paralleldrive/cuid2';
import type { NextFunction, Request, Response } from 'express';

/** 요청마다 하나. 에러 본문의 `requestId` 와 응답 헤더 `X-Request-Id` 가 같은 값이다. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** `req` 에 붙는 필드 이름. Express 타입을 전역 확장하지 않기 위해 헬퍼로 감싼다. */
const REQUEST_ID_KEY = 'requestId';

/**
 * 요청 id 미들웨어.
 *
 * - 클라이언트/게이트웨이가 `X-Request-Id` 를 보냈으면 **그 값을 이어 쓴다**
 *   (프록시 로그와 API 로그를 같은 키로 이을 수 있어야 한다). 단, 길이를 잘라
 *   로그 주입을 막는다.
 * - 없으면 새로 만든다.
 *
 * docs/api/README.md §11: `requestId` 는 응답 헤더 `X-Request-Id` 와 같은 값이다.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id =
    typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : createId().toUpperCase();

  (req as Request & Record<string, unknown>)[REQUEST_ID_KEY] = id;
  res.setHeader(REQUEST_ID_HEADER, id);

  next();
}

/** 미들웨어가 붙인 요청 id. 아직 안 붙었으면 즉석에서 만든다(에러 본문이 비지 않게). */
export function getRequestId(req: Request): string {
  const value = (req as Request & Record<string, unknown>)[REQUEST_ID_KEY];

  return typeof value === 'string' ? value : createId().toUpperCase();
}
