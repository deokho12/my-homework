import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HospitalScope } from '../auth/decorators/hospital-scope.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { HospitalScopeGuard } from '../auth/guards/hospital-scope.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { ConsultRequestAdminResponse, MyConsultRequestResponse } from './consult.projection';
import {
  createConsultMemoSchema,
  createConsultRequestSchema,
  listConsultRequestsQuerySchema,
  updateConsultStatusSchema,
} from './consult.schemas';
import type {
  CreateConsultMemoDto,
  CreateConsultRequestDto,
  ListConsultRequestsQuery,
  UpdateConsultStatusDto,
} from './consult.schemas';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConsultService } from './consult.service';
import type { AdminConsultListResult, ConsultSummaryResult } from './consult.service';

/**
 * 상담 접수(신청자)와 처리(관리자)가 같은 경로 아래 있다. 역할로 갈린다.
 *
 * **처리(`status`·`memos`)는 `hospital_admin` 전용이다** — 운영자는 읽을 수 있지만
 * 바꿀 수 없다(계약의 `x-role`). 운영자에게는 이름·연락처가 마스킹되어 나가므로
 * 고객에게 연락해 처리할 수 있는 주체가 아니다.
 *
 * 상담 응답에는 고객 개인정보가 있어 어떤 경로도 캐시하지 않는다.
 */
@Controller('consult-requests')
export class ConsultController {
  constructor(private readonly consults: ConsultService) {}

  /**
   * 상담 신청. `@Roles` 를 붙이지 않는다 — 계약의 `x-role: user` 는 누적형이라
   * 담당자·운영자도 개인으로서 상담을 신청한다 (`backend/README.md` 인가 절).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  create(
    @Body(new ZodValidationPipe(createConsultRequestSchema)) dto: CreateConsultRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MyConsultRequestResponse> {
    return this.consults.create(dto, user);
  }

  @Get()
  @Roles('hospital_admin', 'operator')
  @UseGuards(AuthGuard, RolesGuard)
  @Header('Cache-Control', 'no-store')
  list(
    @Query(new ZodValidationPipe(listConsultRequestsQuerySchema)) query: ListConsultRequestsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AdminConsultListResult> {
    return this.consults.listForAdmin(query, user);
  }

  /**
   * 관리자 홈의 숫자 카드.
   *
   * **`:consultRequestId` 보다 먼저 선언한다** — 순서가 바뀌면 `summary` 가 상담 id 로
   * 잡혀 `404` 가 된다.
   */
  @Get('summary')
  @Roles('hospital_admin', 'operator')
  @UseGuards(AuthGuard, RolesGuard)
  @Header('Cache-Control', 'no-store')
  summary(@CurrentUser() user: AuthenticatedUser): Promise<ConsultSummaryResult> {
    return this.consults.summary(user);
  }

  @Get(':consultRequestId')
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'consultRequest' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Header('Cache-Control', 'no-store')
  getById(
    @Param('consultRequestId') consultRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsultRequestAdminResponse> {
    return this.consults.getForAdmin(consultRequestId, user);
  }

  @Patch(':consultRequestId/status')
  @Roles('hospital_admin')
  @HospitalScope({ resource: 'consultRequest' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Header('Cache-Control', 'no-store')
  updateStatus(
    @Param('consultRequestId') consultRequestId: string,
    @Body(new ZodValidationPipe(updateConsultStatusSchema)) dto: UpdateConsultStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsultRequestAdminResponse> {
    return this.consults.updateStatus(consultRequestId, dto, user);
  }

  @Post(':consultRequestId/memos')
  @HttpCode(HttpStatus.CREATED)
  @Roles('hospital_admin')
  @HospitalScope({ resource: 'consultRequest' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Header('Cache-Control', 'no-store')
  addMemo(
    @Param('consultRequestId') consultRequestId: string,
    @Body(new ZodValidationPipe(createConsultMemoSchema)) dto: CreateConsultMemoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsultRequestAdminResponse> {
    return this.consults.addMemo(consultRequestId, dto, user);
  }
}
