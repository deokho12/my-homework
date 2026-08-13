import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
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
import { ApiError } from '../common/errors/api-error';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { replaceDoctorsSchema } from '../doctor/doctor.schemas';
import type { ReplaceDoctorsDto } from '../doctor/doctor.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorService } from '../doctor/doctor.service';
import type { DoctorAdminResponse, DoctorPublicResponse } from '../doctor/doctor.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReviewService } from '../review/review.service';
import type { ReviewListResult } from '../review/review.service';
import { listReviewsQuerySchema } from '../review/review.schemas';
import type { ListReviewsQuery } from '../review/review.schemas';
import type { HospitalResponse } from './hospital.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from './hospital.repository';
import { createHospitalSchema, listHospitalsQuerySchema, updateHospitalSchema } from './hospital.schemas';
import type { CreateHospitalDto, ListHospitalsQuery, UpdateHospitalDto } from './hospital.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalService } from './hospital.service';
import type { HospitalListResult } from './hospital.service';

@Controller('hospitals')
export class HospitalController {
  constructor(
    private readonly hospitals: HospitalService,
    private readonly hospitalRepository: HospitalRepository,
    private readonly doctors: DoctorService,
    private readonly reviews: ReviewService,
    private readonly tokens: TokenService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listHospitalsQuerySchema)) query: ListHospitalsQuery
  ): Promise<HospitalListResult> {
    return this.hospitals.list(query);
  }

  @Get(':hospitalId')
  getById(@Param('hospitalId') hospitalId: string): Promise<HospitalResponse> {
    return this.hospitals.getById(hospitalId);
  }

  /** `operator` 만 병원을 만들 수 있다 — 아무나 병원을 만들 수 있으면 안 된다. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('operator')
  @UseGuards(AuthGuard, RolesGuard)
  create(@Body(new ZodValidationPipe(createHospitalSchema)) dto: CreateHospitalDto): Promise<HospitalResponse> {
    return this.hospitals.create(dto);
  }

  /**
   * `hospital_admin`(담당 병원만) · `operator`(전 병원). 지금은 주소의 병원 id 만 바꾸면
   * 남의 병원을 고칠 수 있다 — `HospitalScopeGuard` 가 그것을 막는다.
   *
   * `@Body()` 를 **두 번** 받는다: `dto` 는 zod 검증본, `rawBody` 는 원본이다. 쓰기 금지
   * 필드 판정(`FIELD_NOT_WRITABLE`)은 zod 가 모르는 키까지 봐야 하므로 원본으로 한다.
   */
  @Patch(':hospitalId')
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'hospital' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  update(
    @Param('hospitalId') hospitalId: string,
    @Body(new ZodValidationPipe(updateHospitalSchema)) dto: UpdateHospitalDto,
    @Body() rawBody: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HospitalResponse> {
    return this.hospitals.update(hospitalId, dto, rawBody, user);
  }

  /**
   * 경로 소유자는 병원이라 여기 둔다 (`DoctorModule` 이 `HospitalModule` 을 import 하면
   * 순환 참조가 되므로 반대로 뒀다 — `hospital.module.ts` 주석 참고). 병원 존재 확인을
   * 여기서 먼저 해 `404 HOSPITAL_NOT_FOUND` 를 낸다 — `DoctorService` 는 `hospitalId` 만 받는다.
   */
  @Get(':hospitalId/doctors')
  async listDoctors(
    @Param('hospitalId') hospitalId: string,
    @Req() request: Request,
  ): Promise<DoctorPublicResponse[]> {
    const hospital = await this.hospitalRepository.findById(hospitalId);

    if (hospital === null) {
      throw new ApiError('HOSPITAL_NOT_FOUND');
    }

    return this.doctors.listByHospital(hospitalId, { authenticated: resolveAuthenticated(request, this.tokens) });
  }

  /**
   * 병원 소속 전문의 일괄 교체. 경로 소유자는 병원이라 여기 둔다(`GET .../doctors` 와 같은
   * 이유). `HospitalScopeGuard` 가 `resource: 'hospital'` 로 병원 존재·담당 여부를 이미
   * 확인했다 — `listDoctors` 처럼 여기서 다시 조회하지 않는다.
   *
   * 관리자 병원 폼의 저장 동작 그대로다 — "화면에 남겨둔 전문의 목록이 그대로 정답이 된다".
   * `id` 있는 항목은 갱신, 없는 항목은 신규(→ `pending`), 목록에서 빠진 항목은 삭제된다
   * (`DoctorService.replaceForHospital` 주석 참고).
   */
  @Put(':hospitalId/doctors')
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'hospital' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  replaceDoctors(
    @Param('hospitalId') hospitalId: string,
    @Body(new ZodValidationPipe(replaceDoctorsSchema)) dto: ReplaceDoctorsDto,
  ): Promise<DoctorAdminResponse[]> {
    return this.doctors.replaceForHospital(hospitalId, dto.doctors);
  }

  /**
   * 경로 소유자는 병원이라 여기 둔다 (`ReviewModule` 이 `HospitalModule` 을 import 하면
   * 순환 참조가 되므로 반대로 뒀다 — `review.module.ts` 주석 참고). 병원 존재 확인을
   * 여기서 먼저 해 `404 HOSPITAL_NOT_FOUND` 를 낸다 — `ReviewService` 는 `hospitalId` 만 받는다.
   * 작성 엔드포인트는 없다 — 어느 화면에도 후기 작성 기능이 없다.
   */
  @Get(':hospitalId/reviews')
  async listReviews(
    @Param('hospitalId') hospitalId: string,
    @Query(new ZodValidationPipe(listReviewsQuerySchema)) query: ListReviewsQuery,
  ): Promise<ReviewListResult> {
    const hospital = await this.hospitalRepository.findById(hospitalId);

    if (hospital === null) {
      throw new ApiError('HOSPITAL_NOT_FOUND');
    }

    return this.reviews.listByHospital(hospitalId, query);
  }
}
