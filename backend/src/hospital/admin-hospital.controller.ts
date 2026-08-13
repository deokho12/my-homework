import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { listManagedHospitalsQuerySchema } from './hospital.schemas';
import type { ListManagedHospitalsQuery } from './hospital.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalService } from './hospital.service';
import type { AdminHospitalListResult } from './hospital.service';

/**
 * 관리자 병원 목록. **공개 목록(`HospitalController.list`)과 경로가 분리돼 있다** —
 * 지금 관리자 홈은 등록된 모든 병원을 보여주고 전부 수정할 수 있다(확인된 결함).
 * 경로가 분리돼 있으면 "관리자 화면이 공개 목록을 쓰다가 스코프를 잃는" 회귀가
 * 구조적으로 불가능해진다.
 *
 * 경로에 병원 id 가 없고 범위가 목록 쿼리로 표현되므로 `@HospitalScope` 를 쓰지 않는다
 * (`HospitalScopeGuard` 는 `:hospitalId` 파라미터를 전제한다) — `AuthGuard`·`RolesGuard`
 * 두 개만으로 충분하다.
 */
@Controller('admin/hospitals')
export class AdminHospitalController {
  constructor(private readonly hospitals: HospitalService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles('hospital_admin', 'operator')
  @UseGuards(AuthGuard, RolesGuard)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query(new ZodValidationPipe(listManagedHospitalsQuerySchema)) query: ListManagedHospitalsQuery,
  ): Promise<AdminHospitalListResult> {
    return this.hospitals.listForAdmin(query, actor);
  }
}
