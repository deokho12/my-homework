import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { HospitalModule } from '../hospital/hospital.module';
import { FavoriteController } from './favorite.controller';
import { FavoriteRepository } from './favorite.repository';
import { FavoriteService } from './favorite.service';

/**
 * `AuthModule` 은 `AuthGuard` 가 주입받는 것들 때문에, `HospitalModule` 은
 * `expand=hospital` 이 병원 본문을 실을 때 `HospitalRepository` 와 투영을 재사용하려고
 * import 한다 — 병원 응답 모양을 여기서 다시 만들지 않는다.
 *
 * `HospitalModule` 은 이 모듈을 import 하지 않는다 (순환 참조 방지).
 */
@Module({
  imports: [AuthModule, HospitalModule],
  controllers: [FavoriteController],
  providers: [FavoriteService, FavoriteRepository],
  exports: [FavoriteService],
})
export class FavoriteModule {}
