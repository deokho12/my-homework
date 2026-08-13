import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TokenService } from '../auth/token.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { DoctorPublicResponse } from './doctor.projection';
import { listDoctorsQuerySchema } from './doctor.schemas';
import type { ListDoctorsQuery } from './doctor.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DoctorService } from './doctor.service';
import type { DoctorListResult } from './doctor.service';

@Controller('doctors')
export class DoctorController {
  constructor(
    private readonly doctors: DoctorService,
    private readonly tokens: TokenService,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listDoctorsQuerySchema)) query: ListDoctorsQuery,
    @Req() request: Request,
  ): Promise<DoctorListResult> {
    return this.doctors.list(query, { authenticated: this.authenticatedFrom(request) });
  }

  // ★ 새 GET 라우트는 이 주석 위에 선언한다. `@Get(':doctorId')` 가 마지막이어야 한다 —
  //   NestJS 는 선언 순서로 매칭하므로 아래에 두면 리터럴 경로가 doctorId 로 잡혀 404 가 난다.
  //   (`GET /doctors/verification-queue` 가 이 자리에 들어온다)

  @Get(':doctorId')
  getById(@Param('doctorId') doctorId: string, @Req() request: Request): Promise<DoctorPublicResponse> {
    return this.doctors.getById(doctorId, { authenticated: this.authenticatedFrom(request) });
  }

  /**
   * 선택 인증(`security: [{}, bearerAuth]`). `AuthGuard` 를 붙이지 않고 토큰을 직접 해석해
   * `authenticated` 만 판정한다. 만료·위조 토큰이어도 401 을 내지 않는다 — 공개 화면이라
   * 로그인 실패가 조회 실패가 되면 안 된다.
   */
  private authenticatedFrom(request: Request): boolean {
    const header = request.header('authorization');

    if (header === undefined || !header.toLowerCase().startsWith('bearer ')) return false;

    return this.tokens.verifyAccessToken(header.slice(7).trim()).ok;
  }
}
