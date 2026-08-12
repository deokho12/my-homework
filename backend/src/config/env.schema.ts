import { z } from 'zod';

/**
 * 환경변수 스키마. `ConfigModule` 의 `validate` 에 연결되어 있어서
 * 값이 빠졌거나 형식이 틀리면 **부팅이 실패**한다 (요청 처리 중에 발견되지 않는다).
 *
 * 검증기로 Zod 를 고른 이유는 docs/decisions 가 아니라 이 저장소의 현실이다:
 * 프론트엔드가 이미 zod ^3.25 를 쓰고 있어(react-hook-form + @hookform/resolvers)
 * 상담 신청 폼 같은 곳의 스키마를 나중에 공유할 여지가 남는다.
 * class-validator 는 DTO 클래스 + 데코레이터가 필요해서 그 공유가 불가능하다.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Prisma datasource. SQLite 는 `file:`, PostgreSQL 은 `postgresql://` */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 이 비어 있습니다. .env.example 을 참고하세요'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /** 쉼표로 구분한 CORS 허용 오리진 목록 */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule 이 부팅 시 호출한다. 실패하면 어떤 키가 왜 틀렸는지 그대로 던진다. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`환경변수 검증 실패:\n${lines.join('\n')}`);
  }

  return parsed.data;
}
