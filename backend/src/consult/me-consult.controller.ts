import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { listMyConsultRequestsQuerySchema } from './consult.schemas';
import type { ListMyConsultRequestsQuery } from './consult.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConsultService } from './consult.service';
import type { MyConsultListResult } from './consult.service';

/**
 * 원작성: 협업자(2026-08 hospital-doctor-domain-api 브랜치), 가져와 수정
 * (수정한 것: **`GET /me/consult-requests/{id}` 라우트를 뺐다** — 부르는 프런트 함수가
 *  하나도 없다. 상담 알림의 이동 대상이 목록 + `relatedId` 강조로 정해지면서 소비 화면이
 *  사라졌다(요청 08). 계약에서 지우지는 않았고, 상담 상세 화면이 생기는 날 그 화면의 것이
 *  된다 — `backend/README.md` 의 미룬 것들.)
 *
 * 내 상담 내역. 경로가 `/me/*` 라 주체를 **토큰만** 정한다. 신청자 시야라 내부 메모와
 * 처리자 이름, 취소 사유, 일시 변경 이력은 응답에 들어가지 않는다 (`consult.projection.ts`).
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
}
