import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DoctorModule } from '../doctor/doctor.module';
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
 * `AuthModule` 은 `HospitalController` 가 선택 인증에 쓰는 `TokenService` 를 얻으려고
 * 직접 import 한다 — `DoctorModule` 이 `TokenService` 를 export 하지 않으므로
 * (캡슐화, `AuthModule` 만이 export 한다) 여기서 다시 받아야 한다.
 */
@Module({
  imports: [DoctorModule, ReviewModule, AuthModule],
  controllers: [HospitalController],
  providers: [HospitalService, HospitalRepository],
  exports: [HospitalService, HospitalRepository],
})
export class HospitalModule {}
