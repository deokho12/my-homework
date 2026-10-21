import { createHash } from 'node:crypto';

import { Controller, Get, Header, Headers, Res } from '@nestjs/common';
import type { Response } from 'express';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ProcedureService } from './procedure.service';
import type { ProcedureResponse } from './procedure.service';

/**
 * `GET /api/v1/procedures` — 시술 마스터 31종 (계약 `listProcedures`).
 *
 * 인증이 없다. 홈·탐색·커뮤니티 작성·상담 신청·관리자 병원 폼이 모두 이 하나의 목록을 쓴다.
 *
 * **캐시는 `no-cache` + ETag 다** (2026-10-21 요청 14 — 이전 값은 `public, max-age=3600`).
 * `isAvailable` 은 병원 담당자가 시술 체크를 저장하는 순간 바뀌는 값이라 더 이상 "거의
 * 변하지 않는 마스터 데이터" 가 아니다. `max-age` 가 남아 있으면 프런트가 쿼리를
 * 무효화해도 **브라우저 HTTP 캐시가 옛 본문을 돌려주고**, 담당자는 "저장했는데 홈이
 * 그대로" 를 본다 (계약 §22.5). `no-store` 가 아닌 이유: 개인정보가 아니고, 매 요청
 * 재검증하되 **ETag 로 304 를 받는 쪽**이 31행을 매번 내려보내는 것보다 싸다.
 */
@Controller('procedures')
export class ProcedureController {
  constructor(private readonly procedures: ProcedureService) {}

  @Get()
  @Header('Cache-Control', 'no-cache')
  async findAll(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ProcedureResponse[] | undefined> {
    const items = await this.procedures.list();
    // 본문에서 만든다 — `updated_at` 같은 별도 사실에 기대면 `isAvailable`(파생값)이
    // 바뀌어도 ETag 가 그대로여서 304 가 틀린 답이 된다.
    const etag = `"${createHash('sha1').update(JSON.stringify(items)).digest('base64')}"`;

    response.setHeader('ETag', etag);

    if (ifNoneMatch === etag) {
      response.status(304);

      return undefined;
    }

    return items;
  }
}
