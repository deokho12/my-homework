import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ApiError } from '../../common/errors/api-error';
import type { UserRole } from '../auth.types';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator';
import { getAuthUser } from './auth.guard';

/**
 * =============================================================================
 * 2층 — 역할 (docs/api/README.md §3)
 * =============================================================================
 *
 * `@Roles(...)` 에 없는 역할이면 `403 FORBIDDEN`.
 *
 * **3층(담당 범위)보다 먼저 돈다.** 순서가 응답 코드를 바꾼다: `operator` 가
 * `PATCH /consult-requests/{id}/status`(x-role: hospital_admin)를 호출하면 역할 부족이므로
 * `403` 이고, 상담의 존재 여부를 조회하지 않는다. 반대로 `hospital_admin` 이 남의 병원 상담을
 * 호출하면 역할은 통과하고 3층에서 `404` 가 된다. 문서가 요구하는 비대칭이 이 순서에서 나온다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = getAuthUser(request);

    if (!user) {
      // AuthGuard 를 붙이지 않은 라우트에 @Roles 가 붙어 있는 구성 오류.
      // 통과시키지 않는다 — 인가는 "설정을 빠뜨리면 막힌다" 쪽으로 실패해야 한다.
      throw new ApiError('UNAUTHENTICATED');
    }

    if (!required.includes(user.role)) {
      throw new ApiError('FORBIDDEN');
    }

    return true;
  }
}
