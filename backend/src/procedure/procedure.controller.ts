import { Controller, Get, Header } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProcedureRepository } from './procedure.repository';
import type { ProcedureResponse } from './procedure.repository';

/**
 * `GET /api/v1/procedures` — 시술 마스터 13종.
 *
 * 인증이 없다. 홈·탐색·커뮤니티 작성·상담 신청이 모두 이 하나의 목록을 쓴다.
 * 거의 변하지 않으므로 캐시 헤더를 붙인다 (계약 `listProcedures`).
 */
@Controller('procedures')
export class ProcedureController {
  constructor(private readonly procedures: ProcedureRepository) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  findAll(): Promise<ProcedureResponse[]> {
    return this.procedures.findAll();
  }
}
