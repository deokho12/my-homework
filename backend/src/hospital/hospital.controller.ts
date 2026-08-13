import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { resolveAuthenticated } from '../auth/optional-auth';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TokenService } from '../auth/token.service';
import { ApiError } from '../common/errors/api-error';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorService } from '../doctor/doctor.service';
import type { DoctorPublicResponse } from '../doctor/doctor.projection';
import type { HospitalResponse } from './hospital.projection';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalRepository } from './hospital.repository';
import { listHospitalsQuerySchema } from './hospital.schemas';
import type { ListHospitalsQuery } from './hospital.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalService } from './hospital.service';
import type { HospitalListResult } from './hospital.service';

@Controller('hospitals')
export class HospitalController {
  constructor(
    private readonly hospitals: HospitalService,
    private readonly hospitalRepository: HospitalRepository,
    private readonly doctors: DoctorService,
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
}
