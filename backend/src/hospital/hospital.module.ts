import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DoctorModule } from '../doctor/doctor.module';
import { ProcedureModule } from '../procedure/procedure.module';
import { ReviewModule } from '../review/review.module';
import { HospitalController } from './hospital.controller';
import { HospitalRepository } from './hospital.repository';
import { HospitalService } from './hospital.service';

/**
 * `GET /hospitals/:hospitalId/doctors` 와 `GET /hospitals/:hospitalId/reviews` 가
 * `HospitalController` 에 살기 때문에 `DoctorModule`·`ReviewModule` 을 import 한다
 * (경로 소유자가 병원이다). 두 모듈은 이 모듈을 다시 import 하지 않는다 — 순환 참조 방지
 * (`doctor.module.ts`·`review.module.ts` 주석 참고).
 *
 * `AuthModule` 은 두 가지 이유로 import 한다:
 * 1. `HospitalController` 가 선택 인증(`GET /hospitals/:hospitalId/doctors|reviews`)에
 *    쓰는 `TokenService` — `DoctorModule` 이 이를 export 하지 않으므로(캡슐화) 여기서 다시 받는다.
 * 2. **쓰기 엔드포인트(`POST /hospitals`·`PATCH /hospitals/:hospitalId`)의 인가 3층**
 *    (`AuthGuard`·`RolesGuard`·`HospitalScopeGuard`) — 이 가드들이 주입받는
 *    `UsersRepository`·`ResourceScopeService`·`TokenService` 도 `AuthModule` 이 export 한다.
 *
 * `ProcedureModule` 은 `HospitalService` 가 쓰기 경로에서 `procedureIds` 존재를 확인하는
 * `ProcedureRepository.findExistingIds` 를 얻으려고 import 한다 — FK 위반을 만나기 전에
 * `422 VALIDATION_FAILED` 로 거절해야 오타 난 id 가 원인 없는 500 이 되지 않는다.
 */
@Module({
  imports: [DoctorModule, ReviewModule, AuthModule, ProcedureModule],
  controllers: [HospitalController],
  providers: [HospitalService, HospitalRepository],
  exports: [HospitalService, HospitalRepository],
})
export class HospitalModule {}
