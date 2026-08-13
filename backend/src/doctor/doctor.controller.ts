import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { HospitalScope } from '../auth/decorators/hospital-scope.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { HospitalScopeGuard } from '../auth/guards/hospital-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { resolveAuthenticated } from '../auth/optional-auth';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TokenService } from '../auth/token.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { DoctorAdminResponse, DoctorPublicResponse } from './doctor.projection';
import { listDoctorsQuerySchema, updateDoctorSchema } from './doctor.schemas';
import type { ListDoctorsQuery, UpdateDoctorDto } from './doctor.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorService } from './doctor.service';
import type { DoctorListResult } from './doctor.service';

@Controller('doctors')
export class DoctorController {
  constructor(
    private readonly doctors: DoctorService,
    private readonly tokens: TokenService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listDoctorsQuerySchema)) query: ListDoctorsQuery,
    @Req() request: Request,
  ): Promise<DoctorListResult> {
    return this.doctors.list(query, { authenticated: resolveAuthenticated(request, this.tokens) });
  }

  // ★ 새 GET 라우트는 이 주석 위에 선언한다. `@Get(':doctorId')` 가 마지막이어야 한다 —
  //   NestJS 는 선언 순서로 매칭하므로 아래에 두면 리터럴 경로가 doctorId 로 잡혀 404 가 난다.
  //   (`GET /doctors/verification-queue` 가 이 자리에 들어온다)

  @Get(':doctorId')
  getById(@Param('doctorId') doctorId: string, @Req() request: Request): Promise<DoctorPublicResponse> {
    return this.doctors.getById(doctorId, { authenticated: resolveAuthenticated(request, this.tokens) });
  }

  /**
   * `PUT /hospitals/:hospitalId/doctors` 의 낱개 버전. 재검수 규칙(`specialty`/
   * `certificateUrl` 변경 → `pending` 복귀)이 동일하게 적용된다 (`doctor.write.ts`).
   *
   * 인가: `hospital_admin` 은 그 전문의의 소속 병원이 담당 병원일 때만
   * (`403 HOSPITAL_NOT_MANAGED`, `HospitalScopeGuard` 가 `doctors.hospital_id` 로 판단),
   * `operator` 는 전체.
   */
  @Patch(':doctorId')
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'doctor' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  update(
    @Param('doctorId') doctorId: string,
    @Body(new ZodValidationPipe(updateDoctorSchema)) dto: UpdateDoctorDto,
  ): Promise<DoctorAdminResponse> {
    return this.doctors.update(doctorId, dto);
  }

  /**
   * **soft delete 다.** `ConsultRequest.doctor` 가 `onDelete: SetNull` 이라 물리 삭제하면
   * 그 전문의를 지목한 상담들의 `doctorId` 가 전부 사라진다 — 계약 문구("되돌릴 수 없다")는
   * 사용자 관점 문구일 뿐 물리 삭제 지시가 아니다.
   */
  @Delete(':doctorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'doctor' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  async remove(@Param('doctorId') doctorId: string): Promise<void> {
    await this.doctors.softDelete(doctorId);
  }
}
