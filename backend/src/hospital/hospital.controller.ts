import { Controller, Get, Param, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { HospitalResponse } from './hospital.projection';
import { listHospitalsQuerySchema } from './hospital.schemas';
import type { ListHospitalsQuery } from './hospital.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HospitalService } from './hospital.service';
import type { HospitalListResult } from './hospital.service';

@Controller('hospitals')
export class HospitalController {
  constructor(private readonly hospitals: HospitalService) {}

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
}
