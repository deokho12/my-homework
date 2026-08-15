import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
import { decideVerificationSchema, listDoctorsQuerySchema, updateDoctorSchema, verificationQueueQuerySchema } from './doctor.schemas';
import type { DecideVerificationDto, ListDoctorsQuery, UpdateDoctorDto, VerificationQueueQuery } from './doctor.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorService } from './doctor.service';
import type { DoctorListResult } from './doctor.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VerificationService } from './verification.service';
import type { VerificationQueueResult } from './verification.service';

@Controller('doctors')
export class DoctorController {
  constructor(
    private readonly doctors: DoctorService,
    private readonly verification: VerificationService,
    private readonly tokens: TokenService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listDoctorsQuerySchema)) query: ListDoctorsQuery,
    @Req() request: Request,
  ): Promise<DoctorListResult> {
    return this.doctors.list(query, { authenticated: resolveAuthenticated(request, this.tokens) });
  }

  /**
   * 전문의 인증 검수 목록. `operator` 전용 — `/admin/specialists` 는 모든 병원의 전문의를
   * 심사하는 화면이라 `hospital_admin` 에게 열면 남의 병원 전문의를 심사하게 되고 자기 병원
   * 전문의를 스스로 승인할 수도 있다 (역할 분리 결정 1). `@HospitalScope` 를 쓰지 않는다 —
   * 담당 범위 개념이 없다.
   *
   * ★ `@Get(':doctorId')` **앞에** 선언한다 — NestJS 는 선언 순서로 매칭하므로 뒤에 두면
   *   `verification-queue` 가 `doctorId` 로 잡혀 `404 DOCTOR_NOT_FOUND` 가 난다
   *   (`test/doctor-verification.e2e.spec.ts` 가 이 순서를 e2e 로 고정한다).
   */
  @Get('verification-queue')
  @Header('Cache-Control', 'no-store')
  @Roles('operator')
  @UseGuards(AuthGuard, RolesGuard)
  listVerificationQueue(
    @Query(new ZodValidationPipe(verificationQueueQuerySchema)) query: VerificationQueueQuery,
  ): Promise<VerificationQueueResult> {
    return this.verification.listQueue(query);
  }

  @Get(':doctorId')
  getById(@Param('doctorId') doctorId: string, @Req() request: Request): Promise<DoctorPublicResponse> {
    return this.doctors.getById(doctorId, { authenticated: resolveAuthenticated(request, this.tokens) });
  }

  /**
   * 전문의 인증 승인·반려. `operator` 전용 — 플랫폼이 자격증을 검증하는 행위이고 병원
   * 담당자는 신청(등록)만 하고 판정에는 관여하지 않는다. 리터럴 세그먼트(`verification`)가
   * `:doctorId` **뒤**에 오고 메서드도 `PUT`이라 `getById`(`GET :doctorId`)와 선언 순서
   * 충돌이 없다. 존재 확인은 서비스가 하고 `404 DOCTOR_NOT_FOUND` 를 던진다 —
   * `@HospitalScope` 를 쓰지 않는다(담당 범위 개념이 없다).
   */
  @Put(':doctorId/verification')
  @Roles('operator')
  @UseGuards(AuthGuard, RolesGuard)
  decideVerification(
    @Param('doctorId') doctorId: string,
    @Body(new ZodValidationPipe(decideVerificationSchema)) dto: DecideVerificationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<DoctorAdminResponse> {
    return this.verification.decide(doctorId, dto, actor.id);
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
