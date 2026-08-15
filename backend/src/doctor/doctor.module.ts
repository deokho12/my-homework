import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ProcedureModule } from '../procedure/procedure.module';
import { DoctorController } from './doctor.controller';
import { DoctorRepository } from './doctor.repository';
import { DoctorService } from './doctor.service';
import { VerificationService } from './verification.service';

/**
 * 전문의는 병원 서비스를 필요로 하지 않는다 — `HospitalModule` 을 import 하지 않는다.
 * `HospitalModule` 이 이 모듈을 import 한다 (`GET /hospitals/:hospitalId/doctors`,
 * `PUT /hospitals/:hospitalId/doctors` 가 `HospitalController` 에 살기 때문). 반대로
 * 여기서 `HospitalModule` 을 import 하면 순환 참조가 된다 — 병원 존재·담당 확인은
 * `HospitalController`/`HospitalScopeGuard` 쪽에서 한다.
 *
 * `ProcedureModule` 은 `DoctorService` 가 쓰기 경로에서 `procedureIds` 존재를 확인하는
 * `ProcedureRepository.findExistingIds` 를 얻으려고 import 한다 — 병원 쓰기가 이미 쓰는
 * 같은 검증을 재사용한다(복제하면 두 검증이 갈린다).
 */
@Module({
  imports: [AuthModule, ProcedureModule],
  controllers: [DoctorController],
  providers: [DoctorService, DoctorRepository, VerificationService],
  exports: [DoctorService, DoctorRepository],
})
export class DoctorModule {}
