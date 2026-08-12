import { Injectable, Logger } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ApiError } from '../../common/errors/api-error';
import { HOSPITAL_SCOPE_METADATA_KEY } from '../decorators/hospital-scope.decorator';
import type { HospitalScopeOptions, HospitalScopeResource } from '../decorators/hospital-scope.decorator';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ResourceScopeService } from '../scope/resource-scope.service';
import { UsersRepository } from '../users.repository';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { RESOURCE_RULES } from '../scope/resource-scope.service';
import { getAuthUser } from './auth.guard';

/** 가드가 요청에 남기는 결과. 핸들러가 병원 id 를 다시 조회하지 않아도 된다. */
export interface ResolvedScope {
  resource: HospitalScopeResource;
  resourceId: string;
  hospitalId: string;
  /** `hospital_admin` 의 담당 병원이라 통과한 것인지 (운영자 통과와 구분). 마스킹 판단에 쓴다. */
  managed: boolean;
}

export const SCOPE_KEY = 'mola:scope';

export function getResolvedScope(request: Request): ResolvedScope | undefined {
  return (request as Request & Record<string, unknown>)[SCOPE_KEY] as ResolvedScope | undefined;
}

/**
 * =============================================================================
 * 3층 — 담당 범위 (docs/api/README.md §3)
 * =============================================================================
 *
 * `hospital_admin` 은 `hospital_admins` 에 있는 병원의 자원만 다룰 수 있다.
 * **지금은 주소의 병원 id 만 바꾸면 남의 병원을 고칠 수 있다. 그것을 막는 검사가 이것이다.**
 *
 * 판단 세 가지:
 *
 * 1. **담당 병원 목록을 토큰에서 읽지 않는다.** 매 요청 `hospital_admins` 를 조회한다
 *    (단건 unique 조회). 토큰에 넣으면 해제가 토큰 만료까지 반영되지 않는다.
 * 2. **`operator` 는 담당 검사를 건너뛰지만 존재 검사는 받는다.** 없는 id 에 200 을
 *    돌려주면 오퍼레이터 콘솔의 오타가 조용히 성공하게 된다.
 * 3. **역할이 `user` 인 경우도 막는다.** 보통 `RolesGuard` 가 먼저 걸러내지만,
 *    `@Roles` 를 빠뜨린 라우트에서 이 가드가 최후 방어선이 되어야 한다 (fail closed).
 */
@Injectable()
export class HospitalScopeGuard implements CanActivate {
  private readonly logger = new Logger(HospitalScopeGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly scope: ResourceScopeService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<HospitalScopeOptions | undefined>(
      HOSPITAL_SCOPE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = getAuthUser(request);

    if (!user) {
      throw new ApiError('UNAUTHENTICATED');
    }

    const rule = RESOURCE_RULES[options.resource];
    const paramName = options.param ?? rule.param;
    const resourceId = (request.params as Record<string, string | undefined>)[paramName];

    if (!resourceId) {
      // 라우트 경로와 데코레이터가 어긋난 구성 오류. 통과시키지 않는다.
      this.logger.error(
        `@HospitalScope 의 파라미터 '${paramName}' 가 경로에 없습니다 ` +
          `(${request.method} ${request.route?.path ?? request.url})`,
      );

      throw new ApiError(rule.notFound);
    }

    const hospitalId = await this.scope.findOwningHospitalId(options.resource, resourceId);

    if (!hospitalId) {
      throw new ApiError(rule.notFound);
    }

    if (user.role === 'operator') {
      this.attach(request, { resource: options.resource, resourceId, hospitalId, managed: false });

      return true;
    }

    const managed =
      user.role === 'hospital_admin' && (await this.users.isManagingHospital(user.id, hospitalId));

    if (!managed) {
      throw new ApiError(rule.notManaged);
    }

    this.attach(request, { resource: options.resource, resourceId, hospitalId, managed: true });

    return true;
  }

  private attach(request: Request, scope: ResolvedScope): void {
    (request as Request & Record<string, unknown>)[SCOPE_KEY] = scope;
  }
}
