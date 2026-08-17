import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditLogService } from '../audit/audit-log.service';
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
  constructor(
    private readonly consults: ConsultService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * 상담 신청. `@Roles` 를 붙이지 않는다 — 계약의 `x-role: user` 는 누적형이라
   * 담당자·운영자도 개인으로서 상담을 신청한다 (`backend/README.md` 인가 절).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @Header('Cache-Control', 'no-store')
  async create(
    @Body(new ZodValidationPipe(createConsultRequestSchema)) dto: CreateConsultRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MyConsultRequestResponse> {
    const created = await this.consults.create(dto, user);

    // 계약이 선언한 `Location`. 신청자 시야의 경로를 가리킨다 — 만든 사람이 볼 수 있는
    // 곳이 거기다(관리자 경로는 그 사람에게 403/404 다).
    response.setHeader('Location', `/v1/me/consult-requests/${created.id}`);

    return created;
  }

  @Get()
  @Roles('hospital_admin', 'operator')
  @UseGuards(AuthGuard, RolesGuard)
  @Header('Cache-Control', 'no-store')
  // 같은 URL 이 역할에 따라 다른 본문(마스킹 여부·범위)을 준다. 공유 캐시가 그것을
  // 섞으면 유출이다 — `no-store` 가 1차 방어이고 이것이 2차다 (계약이 둘 다 요구한다).
  @Header('Vary', 'Authorization')
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

  /**
   * 상담 상세. **열람을 감사 로그에 남긴다** (`docs/decisions/0001-roles-and-pii.md` 결정 3).
   *
   * 담당 병원 담당자에게는 마스킹되지 않은 고객 개인정보가 나가는데, 결정 문서가 그
   * 노출면을 허용한 대가로 요구한 것이 정확히 "그 열람이 기록된다" 는 것이다.
   * `hospitalId`·`piiMasked` 는 `HospitalScopeGuard` 가 남긴 `ResolvedScope` 에서 나온다 —
   * 컨트롤러가 다시 계산하면 가드의 판단과 기록이 어긋날 수 있다.
   */
  @Get(':consultRequestId')
  @Roles('hospital_admin', 'operator')
  @HospitalScope({ resource: 'consultRequest' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Header('Cache-Control', 'no-store')
  @Header('Vary', 'Authorization')
  async getById(
    @Param('consultRequestId') consultRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ConsultRequestAdminResponse> {
    const consult = await this.consults.getForAdmin(consultRequestId, user);

    await this.audit.recordFromRequest(request, user, {
      action: 'consult_request.view',
      targetType: 'consult_request',
      targetId: consultRequestId,
    });

    // 계약이 "항상 true" 로 선언한 헤더. 기록이 실패하면 위 호출이 던지거나(마스킹되지
    // 않은 열람) 로그만 남기므로, 여기까지 왔다면 정책대로 처리된 것이다.
    response.setHeader('X-Audit-Logged', 'true');

    return consult;
  }

  @Patch(':consultRequestId/status')
  @Roles('hospital_admin')
  @HospitalScope({ resource: 'consultRequest' })
  @UseGuards(AuthGuard, RolesGuard, HospitalScopeGuard)
  @Header('Cache-Control', 'no-store')
  async updateStatus(
    @Param('consultRequestId') consultRequestId: string,
    @Body(new ZodValidationPipe(updateConsultStatusSchema)) dto: UpdateConsultStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ConsultRequestAdminResponse> {
    const { consult, changed } = await this.consults.updateStatus(consultRequestId, dto, user);

    // 같은 상태 재지정은 `200` 이지만 아무 일도 일어나지 않는다. 응답 본문만으로는
    // 그 둘을 구분할 수 없어서 계약이 이 헤더를 뒀다.
    response.setHeader('X-Status-Changed', String(changed));

    return consult;
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
