import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HospitalModule } from '../hospital/hospital.module';
import { ConsultController } from './consult.controller';
import { ConsultRepository } from './consult.repository';
import { ConsultService } from './consult.service';
import { MeConsultController } from './me-consult.controller';

/**
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: `AuditModule` 이 상세 열람뿐 아니라 **상태 변경·일시 변경·메모 작성**까지
 *  받는다는 것을 주석에 반영했다. provider 구성은 그대로다.)
 *
 * `AuthModule` — 인가 3층의 가드들과, 서비스가 담당 병원 범위를 구할 때 쓰는
 * `UsersRepository`, 지목한 전문의의 소속을 확인할 때 쓰는 `ResourceScopeService`.
 * **전문의 조회를 여기서 다시 만들지 않는다** — `HospitalScopeGuard` 가 쓰는 것과 같은 함수다.
 *
 * `HospitalModule` — 상담 신청이 병원 존재·상담 마감·취급 시술을 확인할 때 쓰는
 * `HospitalRepository`. `HospitalModule` 은 이 모듈을 import 하지 않는다(순환 참조 방지).
 *
 * `AuditModule` — 감사 대상 네 가지가 전부 이 모듈에 있다 (`docs/api/README.md` §4):
 * 상세 열람(`consult_request.view`) · 상태 변경(`status_change`) · 일시 변경(`reschedule`) ·
 * 메모 작성(`memo_create`). 뒤 셋은 **쓰기와 같은 트랜잭션**에 들어간다.
 */
@Module({
  imports: [AuthModule, HospitalModule, AuditModule],
  controllers: [ConsultController, MeConsultController],
  providers: [ConsultService, ConsultRepository],
  exports: [ConsultService],
})
export class ConsultModule {}
