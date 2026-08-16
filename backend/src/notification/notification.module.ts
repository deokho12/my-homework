import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

/**
 * 알림 **조회** 모듈. 생성 엔드포인트는 없다 — 알림은 상담 접수·상태 변경·전문의 검수의
 * 부수효과로만 생긴다(계약).
 *
 * 그 부수효과가 쓰는 것은 이 모듈의 provider 가 아니라 `notification.write.ts` 의
 * 순수 함수다. 트랜잭션 클라이언트를 인자로 받아야 해서 DI 로 묶지 않는다 —
 * 그 파일의 주석 참고.
 */
@Module({
  // 모든 라우트가 `AuthGuard` 를 쓴다. 그 가드가 주입받는 `TokenService`·`UsersRepository`
  // 를 `AuthModule` 이 export 한다 (`hospital.module.ts` 와 같은 이유).
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
