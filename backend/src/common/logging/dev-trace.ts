import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { getRequestId } from '../http/request-id';

/**
 * 개발용 단계 추적 로그. **`NODE_ENV=development` 에서만 한 줄이라도 나간다.**
 *
 * 목적은 하나다 — 요청이 **어느 단계에서 멈췄는지**를 콘솔만 보고 즉시 아는 것.
 *
 * ```
 * K3F9AB → PATCH /api/v1/hospitals/h2
 * K3F9AB   auth ✓ u-admin-h1 (hospital_admin)
 * K3F9AB   roles ✓ allowed=[hospital_admin, operator]
 * K3F9AB   ✗ HOSPITAL_NOT_MANAGED
 * K3F9AB ← 403 (12ms)
 * ```
 *
 * ## 왜 인터셉터가 아니라 미들웨어인가
 *
 * NestJS 의 실행 순서는 **미들웨어 → 가드 → 인터셉터 → 파이프 → 핸들러** 다.
 * 인터셉터로 진입 줄을 찍으면 **가드가 막은 요청은 한 줄도 남지 않는다** — 하필
 * 가장 알고 싶은 경우(`403` 이 왜 났는가)가 통째로 안 보인다. 그래서 진입은
 * 미들웨어에서 찍고, 종료는 `res.on('finish')` 로 잡는다. `finish` 는 가드가 막든
 * 예외 필터가 응답을 쓰든 **응답이 나가면 반드시** 불린다.
 *
 * ## 왜 본문을 찍지 않는가
 *
 * 로그인 요청의 비밀번호와 상담의 개인정보가 콘솔에 남기 때문이다
 * (`docs/decisions/0001-roles-and-pii.md`). 본문이 필요하면 마스킹을 함께 설계해야 한다.
 *
 * ## 왜 `process.env` 를 매번 읽는가
 *
 * 모듈 로드 시점에 한 번 읽어 상수로 굳히면 테스트가 환경을 바꿔도 반영되지 않아
 * "조용한지" 를 검증할 수 없다. 비용은 속성 접근 한 번이고, 이 함수들은 어차피
 * 그 검사에서 곧바로 되돌아간다.
 */

const logger = new Logger('DevTrace');

/** 개발 모드인가. 이 함수가 유일한 게이트다. */
export function isDevTraceEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * 줄 앞머리에 붙는 상관 키. 요청 id 의 뒤 6자다.
 *
 * 전체 id(cuid2, 24자)를 쓰면 줄이 id 로 시작해 내용이 밀린다. 동시 요청을 사람이
 * 눈으로 가르는 데는 6자면 충분하고, 정확한 추적이 필요하면 응답 헤더
 * `X-Request-Id` 의 전체 값으로 서버 로그를 찾으면 된다.
 */
function correlationKey(request: Request): string {
  return getRequestId(request).slice(-6);
}

/** 요청 진입. 미들웨어가 부른다. */
export function traceIn(request: Request): void {
  if (!isDevTraceEnabled()) return;

  logger.log(`${correlationKey(request)} → ${request.method} ${request.originalUrl}`);
}

/**
 * 단계 통과·거절. 가드와 예외 필터가 부른다.
 *
 * `step` 은 `auth ✓` 처럼 이름과 결과를 함께 담는다. 성공 단계만 찍어도 충분하다 —
 * 마지막으로 찍힌 ✓ 가 통과한 마지막 단계이고, 그다음 줄의 `✗ CODE` 가 막은 이유다.
 */
export function traceStep(request: Request, step: string, detail = ''): void {
  if (!isDevTraceEnabled()) return;

  logger.log(`${correlationKey(request)}   ${step}${detail ? ` ${detail}` : ''}`);
}

/** 응답 종료. 미들웨어의 `finish` 훅이 부른다. */
export function traceOut(request: Request, status: number, elapsedMs: number): void {
  if (!isDevTraceEnabled()) return;

  logger.log(`${correlationKey(request)} ← ${status} (${elapsedMs}ms)`);
}

/**
 * 진입 줄을 찍고, 응답이 끝나면 종료 줄을 찍는다.
 *
 * `requestIdMiddleware` **뒤에** 붙어야 한다 — 상관 키가 그 미들웨어가 붙인 id 다
 * (`app-setup.ts`).
 */
export function devTraceMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isDevTraceEnabled()) {
    next();

    return;
  }

  const startedAt = process.hrtime.bigint();

  traceIn(req);

  res.on('finish', () => {
    const elapsedMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);

    traceOut(req, res.statusCode, elapsedMs);
  });

  next();
}
