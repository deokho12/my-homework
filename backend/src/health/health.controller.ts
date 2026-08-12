import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

// 생성자 주입용이라 값 import 여야 한다 (health.service.ts 의 같은 주석 참고)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HealthService } from './health.service';
import type { HealthReport } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * `GET /health`
   *
   * - DB 를 읽을 수 있으면 **200** + `status: 'ok'`
   * - DB 가 죽었거나 마이그레이션이 안 됐으면 **503** + `status: 'error'`
   *   (200 을 주면서 본문에만 실패를 적으면 로드밸런서·모니터링이 알아채지 못한다)
   *
   * 응답 코드를 직접 정하기 위해 `@Res({ passthrough: true })` 를 쓴다.
   */
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const report = await this.health.check();

    res.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return report;
  }
}
