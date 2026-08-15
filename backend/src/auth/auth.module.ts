import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { LegalDocumentsRepository } from '../legal/legal-documents.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { HospitalScopeGuard } from './guards/hospital-scope.guard';
import { RolesGuard } from './guards/roles.guard';
import { PasswordService } from './password.service';
import { PrismaRefreshTokenStore } from './prisma-refresh-token.store';
import { RefreshTokenCleanupService } from './refresh-token-cleanup.service';
import { RefreshTokenStore } from './refresh-token.store';
import { ResourceScopeService } from './scope/resource-scope.service';
import { TokenService } from './token.service';
import { UsersRepository } from './users.repository';

/**
 * 인증·인가 모듈.
 *
 * **가드를 전역(`APP_GUARD`)으로 걸지 않는다.** 이 API 는 비로그인으로 열려 있는
 * 오퍼레이션이 절반 이상이다(병원·전문의·후기·꿀팁·커뮤니티 조회 …). 전역 가드 + `@Public()`
 * 예외 방식은 "공개 라우트를 만들 때마다 데코레이터를 붙인다" 는 뜻이고, 붙이는 것을 잊으면
 * 공개 화면이 401 로 죽는다. 반대로 **보호가 필요한 라우트에 가드를 붙이는 방식**은 잊었을 때
 * 데이터가 새므로 더 위험해 보이지만, 그 실수는 인가 테스트가 잡는다 —
 * `test/authorization.e2e.spec.ts` 가 오퍼레이션별 기대 코드를 고정한다.
 *
 * 도메인 모듈은 `imports: [AuthModule]` 후 `@UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)`
 * 를 쓴다. **가드 순서 = 인가 3층 순서**이고, 그 순서가 403/404 구분을 만든다.
 */
@Module({
  imports: [
    // 전역 secret 을 두지 않는다. 액세스/리프레시가 서로 다른 키를 쓰므로
    // 서명·검증할 때마다 명시적으로 넘긴다 (TokenService).
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    UsersRepository,
    // 가입 시 약관 동의 기록에 필요하다 (`{slug, version}` → legal_documents.id)
    LegalDocumentsRepository,
    ResourceScopeService,
    AuthGuard,
    RolesGuard,
    HospitalScopeGuard,
    // 리프레시 토큰 상태 저장소. **추상 클래스가 DI 토큰이라 교체 지점이 이 한 줄이다.**
    // 프로세스 메모리 구현은 지웠다 (docs/database/README.md §11.1).
    { provide: RefreshTokenStore, useClass: PrismaRefreshTokenStore },
    // 만료·소비 행 정리 배치 (04:00 KST). 같은 로직을 `npm run tokens:cleanup` 도 쓴다.
    RefreshTokenCleanupService,
  ],
  exports: [
    AuthGuard,
    RolesGuard,
    HospitalScopeGuard,
    UsersRepository,
    ResourceScopeService,
    TokenService,
    RefreshTokenStore,
    RefreshTokenCleanupService,
  ],
})
export class AuthModule {}
