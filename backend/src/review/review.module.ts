import { Module } from '@nestjs/common';

import { ReviewRepository } from './review.repository';
import { ReviewService } from './review.service';

/**
 * 후기는 `/reviews` 단독 라우트가 없다 — `GET /hospitals/:hospitalId/doctors` 와 달리
 * 이 모듈은 컨트롤러를 갖지 않는다. `GET /hospitals/:hospitalId/reviews` 가
 * `HospitalController` 에 살기 때문에(경로 소유자가 병원이다) `HospitalModule` 만
 * 이 모듈을 import 한다. 병원 서비스를 필요로 하지 않아 `HospitalModule` 을 import 하지
 * 않는다 — 반대로 하면 순환 참조가 된다 (`doctor.module.ts` 와 같은 패턴).
 */
@Module({
  providers: [ReviewService, ReviewRepository],
  exports: [ReviewService],
})
export class ReviewModule {}
