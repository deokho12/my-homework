import { Module } from '@nestjs/common';

import { HospitalController } from './hospital.controller';
import { HospitalRepository } from './hospital.repository';
import { HospitalService } from './hospital.service';

@Module({
  controllers: [HospitalController],
  providers: [HospitalService, HospitalRepository],
  exports: [HospitalService, HospitalRepository],
})
export class HospitalModule {}
