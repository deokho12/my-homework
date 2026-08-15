import { Injectable, Logger } from '@nestjs/common';

// 생성자 주입은 런타임 값이 필요하다. `import type` 으로 바꾸면
// emitDecoratorMetadata 가 남기는 파라미터 타입이 Object 가 되어
// Nest 가 의존성을 해결하지 못한다.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PrismaService } from '../prisma/prisma.service';

export interface DatabaseHealth {
  /** 'up' | 'down' */
  status: 'up' | 'down';
  /** 확인 쿼리에 걸린 시간(ms) */
  latencyMs: number;
  /**
   * 참조 테이블 `procedures` 의 행 수. 이 값이 있다는 것은
   * "커넥션이 열렸다" 가 아니라 **실제로 테이블을 읽었다** 는 뜻이다.
   * 마이그레이션이 적용되지 않았으면 이 쿼리가 실패한다.
   */
  procedureCount?: number;
  /** status='down' 일 때만 채운다 */
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  database: DatabaseHealth;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * DB 를 실제로 한 번 읽는다.
   *
   * `$queryRaw('SELECT 1')` 를 쓰지 않는 이유는 이식성 규칙(docs/database/README.md §3.8)
   * 때문이다. `procedures` 카운트는 Prisma Client 만으로 같은 것을 확인해 주고,
   * 덤으로 "스키마가 마이그레이션된 상태인가" 까지 확인한다.
   */
  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();

    return {
      status: database.status === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      database,
    };
  }

  private async checkDatabase(): Promise<DatabaseHealth> {
    const startedAt = Date.now();

    try {
      const procedureCount = await this.prisma.procedure.count();

      return { status: 'up', latencyMs: Date.now() - startedAt, procedureCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`헬스체크 DB 확인 실패: ${message}`);

      return { status: 'down', latencyMs: Date.now() - startedAt, error: message };
    }
  }
}
