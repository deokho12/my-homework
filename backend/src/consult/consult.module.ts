import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { HospitalModule } from '../hospital/hospital.module';
import { ConsultController } from './consult.controller';
import { ConsultRepository } from './consult.repository';
import { ConsultService } from './consult.service';
import { MeConsultController } from './me-consult.controller';

/**
 * `AuthModule` — 인가 3층의 가드들과, 서비스가 담당 병원 범위를 구할 때 쓰는
 * `UsersRepository`, 지목한 전문의의 소속을 확인할 때 쓰는 `ResourceScopeService`.
 * **전문의 조회를 여기서 다시 만들지 않는다** — `HospitalScopeGuard` 가 쓰는 것과
 * 같은 함수를 쓴다.
 *
 * `HospitalModule` — 상담 신청이 병원 존재·상담 마감·취급 시술을 확인할 때 쓰는
 * `HospitalRepository`. `HospitalModule` 은 이 모듈을 import 하지 않는다(순환 참조 방지).
 */
@Module({
  imports: [AuthModule, HospitalModule],
  controllers: [ConsultController, MeConsultController],
  providers: [ConsultService, ConsultRepository],
  exports: [ConsultService],
})
export class ConsultModule {}
