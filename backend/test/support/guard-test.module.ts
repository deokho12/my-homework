import { Controller, Get, Module, Patch, Put, UseGuards } from '@nestjs/common';

import { AuthModule } from '../../src/auth/auth.module';
import type { AuthenticatedUser } from '../../src/auth/auth.types';
import { CurrentUser, Scope } from '../../src/auth/decorators/current-user.decorator';
import { HospitalScope } from '../../src/auth/decorators/hospital-scope.decorator';
import { Roles } from '../../src/auth/decorators/roles.decorator';
import { AuthGuard } from '../../src/auth/guards/auth.guard';
import type { ResolvedScope } from '../../src/auth/guards/hospital-scope.guard';
import { HospitalScopeGuard } from '../../src/auth/guards/hospital-scope.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

/**
 * =============================================================================
 * 인가 테스트 전용 컨트롤러
 * =============================================================================
 *
 * 도메인 API(병원·전문의·상담)는 다음 Task 다. 그런데 인가는 **막아야 할 것을 막는지**를
 * 증명해야 하고, 그 증명에는 보호된 라우트가 필요하다. 그래서 openapi 오퍼레이션의
 * `x-role` 과 403/404 규칙만 그대로 옮긴 라우트를 `test/` 안에 둔다.
 * (`src/` 에 두면 실제로 도달 가능한 엔드포인트가 되어 버린다)
 *
 * 각 라우트가 어떤 오퍼레이션을 대신하는지 주석에 적었다. 도메인 구현이 들어올 때
 * **이 데코레이터 조합을 그대로 옮기면 된다.**
 *
 * 가드 순서 = 인가 3층 순서다. `AuthGuard`(401) → `RolesGuard`(403) → `HospitalScopeGuard`(403/404).
 */
@Controller('test-guards')
export class GuardTestController {
  /** 인증만 필요한 라우트. `x-role` 이 없는 `security: bearerAuth` 오퍼레이션(예: `POST /auth/logout`). */
  @Get('authenticated')
  @UseGuards(AuthGuard)
  authenticated(@CurrentUser() user: AuthenticatedUser): { userId: string; role: string } {
    return { userId: user.id, role: user.role };
  }

  /** `GET /doctors/verification-queue` — x-role: operator */
  @Get('doctor-verification-queue')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('operator')
  verificationQueue(): { ok: true } {
    return { ok: true };
  }

  /**
   * `PUT /doctors/{doctorId}/verification` — x-role: operator
   *
   * 담당 병원 검사를 붙이지 않는다. 운영자는 **전 병원의** 전문의를 검수하는 것이
   * 이 역할이 만들어진 이유다 (docs/decisions/0001-roles-and-pii.md 배경).
   */
  @Put('doctors/:doctorId/verification')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('operator')
  verifyDoctor(): { ok: true } {
    return { ok: true };
  }

  /**
   * `PATCH /hospitals/{hospitalId}` — x-role: [hospital_admin, operator]
   * 담당 병원이 아니면 **403 HOSPITAL_NOT_MANAGED** (병원은 공개 자원이다).
   */
  @Patch('hospitals/:hospitalId')
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'hospital' })
  updateHospital(@Scope() scope: ResolvedScope): ResolvedScope {
    return scope;
  }

  /**
   * `PATCH /doctors/{doctorId}` — x-role: [hospital_admin, operator]
   * 전문의도 공개 자원이라 담당 범위 밖은 **403** 이다.
   */
  @Patch('doctors/:doctorId')
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'doctor' })
  updateDoctor(@Scope() scope: ResolvedScope): ResolvedScope {
    return scope;
  }

  /**
   * `GET /consult-requests/{consultRequestId}` — x-role: [hospital_admin, operator]
   * 담당 병원의 상담이 아니면 **404 CONSULT_REQUEST_NOT_FOUND** (403 이 아니다).
   * 상담 id 가 고객 개인정보와 1:1 이라 존재 자체를 숨긴다.
   */
  @Get('consult-requests/:consultRequestId')
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'consultRequest' })
  getConsultRequest(@Scope() scope: ResolvedScope): ResolvedScope {
    return scope;
  }

  /**
   * `PATCH /consult-requests/{consultRequestId}/status` — x-role: hospital_admin
   *
   * **운영자는 상태를 바꿀 수 없다 (403).** 조회(GET)와 변경(PATCH)의 역할 범위가
   * 다른 것은 의도된 비대칭이다 (docs/api/README.md §3).
   */
  @Patch('consult-requests/:consultRequestId/status')
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Roles('hospital_admin')
  @HospitalScope({ resource: 'consultRequest' })
  updateConsultStatus(@Scope() scope: ResolvedScope): ResolvedScope {
    return scope;
  }

  /**
   * `@Roles` 를 빠뜨린 라우트. `HospitalScopeGuard` 가 최후 방어선으로 동작하는지 확인한다
   * (일반 사용자가 병원 자원에 닿으면 담당이 아니므로 403).
   */
  @Patch('misconfigured/hospitals/:hospitalId')
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @HospitalScope({ resource: 'hospital' })
  misconfigured(@Scope() scope: ResolvedScope): ResolvedScope {
    return scope;
  }
}

@Module({
  imports: [AuthModule],
  controllers: [GuardTestController],
})
export class GuardTestModule {}
