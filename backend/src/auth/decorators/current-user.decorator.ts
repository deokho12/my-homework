import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { ApiError } from '../../common/errors/api-error';
import type { AuthenticatedUser } from '../auth.types';
import { getAuthUser } from '../guards/auth.guard';
import { getResolvedScope } from '../guards/hospital-scope.guard';
import type { ResolvedScope } from '../guards/hospital-scope.guard';

/**
 * 인증된 주체를 핸들러 인자로 받는다.
 *
 * ```ts
 * @Get('me')
 * me(@CurrentUser() user: AuthenticatedUser) {}
 * ```
 *
 * `AuthGuard` 없이 쓰면 `401` 을 던진다 — `undefined` 를 넘겨서 핸들러가
 * "로그인 안 한 사용자" 를 처리하게 만들지 않는다.
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const user = getAuthUser(context.switchToHttp().getRequest<Request>());

  if (!user) {
    throw new ApiError('UNAUTHENTICATED');
  }

  return user satisfies AuthenticatedUser;
});

/**
 * `HospitalScopeGuard` 가 이미 푼 병원 범위를 핸들러 인자로 받는다.
 * 핸들러가 같은 조회를 반복하지 않게 하고, **마스킹 판단(`managed`)의 근거를 한 곳으로 모은다.**
 */
export const Scope = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const scope = getResolvedScope(context.switchToHttp().getRequest<Request>());

  if (!scope) {
    throw new ApiError('FORBIDDEN');
  }

  return scope satisfies ResolvedScope;
});
