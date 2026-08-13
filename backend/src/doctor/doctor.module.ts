import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DoctorController } from './doctor.controller';
import { DoctorRepository } from './doctor.repository';
import { DoctorService } from './doctor.service';

/**
 * 전문의는 병원 서비스를 필요로 하지 않는다 — `HospitalModule` 을 import 하지 않는다.
 * `HospitalModule` 이 이 모듈을 import 한다 (`GET /hospitals/:hospitalId/doctors` 가
 * `HospitalController` 에 살기 때문). 반대로 여기서 `HospitalModule` 을 import 하면
 * 순환 참조가 된다 — 병원 존재 확인은 `HospitalController` 쪽에서 한다.
 */
@Module({
  imports: [AuthModule],
  controllers: [DoctorController],
  providers: [DoctorService, DoctorRepository],
  exports: [DoctorService, DoctorRepository],
})
export class DoctorModule {}
