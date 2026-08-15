import { Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { devTraceMiddleware, traceIn, traceOut, traceStep } from '../src/common/logging/dev-trace';

/**
 * 개발용 단계 추적 로그.
 *
 * 이 스펙이 지키는 것은 **두 가지**이고, 첫 번째가 더 중요하다.
 *
 * 1. `development` 가 아니면 **한 줄도 나가지 않는다.** 이게 깨지면 운영 로그에 요청마다
 *    네댓 줄이 섞여 들어가고, 그 상태는 조용해서 한참 뒤에나 발견된다.
 * 2. `development` 면 진입 → 단계 → 종료가 실제로 찍힌다.
 */

/** `getRequestId` 는 `req.requestId` 를 읽는다 (`common/http/request-id.ts`). */
function fakeRequest(overrides: Record<string, unknown> = {}): Request {
  return {
    method: 'PATCH',
    originalUrl: '/api/v1/hospitals/h2',
    requestId: 'ZZZZZZK3F9AB',
    ...overrides,
  } as unknown as Request;
}

/** `res.on('finish')` 만 흉내낸다. `finish()` 로 응답 완료를 일으킨다. */
function fakeResponse(statusCode: number): { response: Response; finish: () => void } {
  const handlers: (() => void)[] = [];
  const response = {
    statusCode,
    on(event: string, handler: () => void) {
      if (event === 'finish') handlers.push(handler);

      return response;
    },
  } as unknown as Response;

  return { response, finish: () => handlers.forEach((handler) => handler()) };
}

describe('개발용 단계 추적 (dev-trace)', () => {
  const originalEnv = process.env.NODE_ENV;
  let logSpy: MockInstance<(message: unknown, ...rest: unknown[]) => void>;

  beforeEach(() => {
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  describe('★ development 밖에서는 완전히 조용하다', () => {
    it.each(['test', 'production'])('NODE_ENV=%s 이면 한 줄도 내보내지 않는다', (env) => {
      process.env.NODE_ENV = env;

      traceIn(fakeRequest());
      traceStep(fakeRequest(), 'auth ✓', 'u-admin-h1 (hospital_admin)');
      traceOut(fakeRequest(), 403, 12);

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('NODE_ENV 가 아예 없어도 조용하다 (기본값에 기대지 않는다)', () => {
      delete process.env.NODE_ENV;

      traceIn(fakeRequest());
      traceStep(fakeRequest(), 'auth ✓');

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('미들웨어도 조용하고, next 는 그대로 부른다', () => {
      process.env.NODE_ENV = 'production';
      const next = vi.fn();
      const { response, finish } = fakeResponse(200);

      devTraceMiddleware(fakeRequest(), response, next);
      finish();

      expect(logSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('development 이면 단계가 보인다', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('진입 줄에 메서드와 경로가 있다', () => {
      traceIn(fakeRequest());

      expect(String(logSpy.mock.calls[0]?.[0])).toContain('→ PATCH /api/v1/hospitals/h2');
    });

    it('단계 줄에 단계 이름과 상세가 있다', () => {
      traceStep(fakeRequest(), 'scope ✗', 'HOSPITAL_NOT_MANAGED managed=[h1]');

      const line = String(logSpy.mock.calls[0]?.[0]);

      expect(line).toContain('scope ✗');
      expect(line).toContain('HOSPITAL_NOT_MANAGED managed=[h1]');
    });

    it('종료 줄에 상태코드와 소요시간이 있다', () => {
      traceOut(fakeRequest(), 403, 12);

      const line = String(logSpy.mock.calls[0]?.[0]);

      expect(line).toContain('← 403');
      expect(line).toContain('12ms');
    });

    it('★ 같은 요청의 줄들은 같은 상관 키를 달고 나온다 (동시 요청이 섞여도 읽히게)', () => {
      const request = fakeRequest();

      traceIn(request);
      traceStep(request, 'auth ✓');
      traceOut(request, 200, 3);

      const keys = logSpy.mock.calls.map((call) => String(call[0]).trim().split(/\s+/)[0]);

      expect(keys).toHaveLength(3);
      expect(new Set(keys).size).toBe(1);
    });

    it('요청마다 상관 키가 다르다', () => {
      traceIn(fakeRequest({ requestId: 'AAAAAAAAAAAA' }));
      traceIn(fakeRequest({ requestId: 'BBBBBBBBBBBB' }));

      const [first, second] = logSpy.mock.calls.map((call) => String(call[0]).trim().split(/\s+/)[0]);

      expect(first).not.toBe(second);
    });

    it('미들웨어가 응답 완료 시점에 종료 줄을 찍는다 — 가드가 막아도 찍혀야 한다', () => {
      const next = vi.fn();
      const { response, finish } = fakeResponse(403);

      devTraceMiddleware(fakeRequest(), response, next);

      expect(next).toHaveBeenCalledTimes(1);
      // 아직 응답 전이라 진입 줄만 있다
      expect(logSpy).toHaveBeenCalledTimes(1);

      finish();

      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(String(logSpy.mock.calls[1]?.[0])).toContain('← 403');
    });
  });
});
