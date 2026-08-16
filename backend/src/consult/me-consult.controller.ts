import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { MyConsultRequestResponse } from './consult.projection';
import { listMyConsultRequestsQuerySchema } from './consult.schemas';
import type { ListMyConsultRequestsQuery } from './consult.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConsultService } from './consult.service';
import type { MyConsultListResult } from './consult.service';

/**
 * 내 상담 내역. **마이페이지와 로그인 화면이 "상담 신청 내역을 확인할 수 있어요" 라고
 * 안내하지만 지금 그 화면이 없다** (known-issues) — 이 엔드포인트가 그것을 가능하게 한다.
 *
 * 경로가 `/me/*` 라 주체를 토큰만 정한다. 신청자 시야라 내부 메모와 처리자 이름은
 * 응답에 들어가지 않는다 (`consult.projection.ts` 참고).
 */
@Controller('me/consult-requests')
@UseGuards(AuthGuard)
export class MeConsultController {
  constructor(private readonly consults: ConsultService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Query(new ZodValidationPipe(listMyConsultRequestsQuerySchema)) query: ListMyConsultRequestsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyConsultListResult> {
    return this.consults.listMine(query, user);
  }

  @Get(':consultRequestId')
  @Header('Cache-Control', 'no-store')
  getById(
    @Param('consultRequestId') consultRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyConsultRequestResponse> {
    return this.consults.getMine(consultRequestId, user);
  }
}
