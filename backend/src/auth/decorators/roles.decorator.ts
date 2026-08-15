import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../auth.types';

export const ROLES_METADATA_KEY = 'mola:roles';

/**
 * 오퍼레이션의 `x-role` 을 코드로 옮긴 것.
 *
 * ```ts
 * @Roles('operator')                        // x-role: operator
 * @Roles('hospital_admin', 'operator')      // x-role: [hospital_admin, operator]
 * ```
 *
 * 이 데코레이터가 없는 라우트는 `RolesGuard` 가 통과시킨다 — "역할 제한 없음" 이
 * 기본값이다. 그러나 `AuthGuard` 가 붙어 있지 않으면 애초에 인증도 없다는 뜻이므로,
 * 보호가 필요한 라우트에는 **두 가드를 함께** 붙인다.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
