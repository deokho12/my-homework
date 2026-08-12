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
/**
 * 불리언 환경변수. **`z.coerce.boolean()` 을 쓰지 않는다** — 그것은 `'false'` 도 `true` 로
 * 만든다(빈 문자열이 아닌 모든 문자열이 truthy). 허용값을 못 박아 오타가 조용히 켜짐이
 * 되지 않게 한다.
 */
const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Prisma datasource. SQLite 는 `file:`, PostgreSQL 은 `postgresql://` */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 이 비어 있습니다. .env.example 을 참고하세요'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /** 쉼표로 구분한 CORS 허용 오리진 목록 */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // ---------------------------------------------------------------------------
  // JWT — docs/api/README.md §3, docs/api/openapi.yaml components.securitySchemes
  // ---------------------------------------------------------------------------
  /**
   * 액세스 토큰 서명 키(HS256). **기본값을 두지 않는다** — 기본 키가 있으면
   * 그 키로 서명한 토큰이 어디서나 통하는 백도어가 된다. 값이 없으면 부팅이 실패한다.
   * 생성: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   */
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET 은 32자 이상이어야 합니다 (.env.example 의 생성 명령 참고)'),

  /** 리프레시 토큰 서명 키. 액세스 키와 **달라야** 한다 (아래 refine 에서 검사). */
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET 은 32자 이상이어야 합니다 (.env.example 의 생성 명령 참고)'),

  /** `iss` 클레임 */
  JWT_ISSUER: z.string().min(1).default('molamola-api'),
  /** `aud` 클레임 */
  JWT_AUDIENCE: z.string().min(1).default('molamola-app'),

  /** 액세스 토큰 수명(초). 문서 기준 15분 = 900. */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  /** 리프레시 토큰 수명(초). 문서 기준 30일 = 2592000. */
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).default(2_592_000),

  // ---------------------------------------------------------------------------
  // 리프레시 토큰 정리 배치 — docs/database/README.md §11.1
  // ---------------------------------------------------------------------------
  /**
   * 일 1회 정리 스케줄(04:00 KST)을 켤지. 배치가 주 수단이므로 기본은 켜짐이고,
   * 여러 인스턴스를 띄울 때 한 대만 돌리고 싶으면 나머지를 `false` 로 둔다
   * (같은 `deleteMany` 가 여러 번 돌아도 결과는 같지만, 불필요한 부하다).
   */
  REFRESH_TOKEN_CLEANUP_ENABLED: booleanFlag.default('true'),

  /**
   * 소비된(회전된) 행을 며칠 뒤에 지울지. `0` 이면 만료까지 남긴다.
   * 탈취된 토큰은 즉시 쓰이므로 이 기간이 지나면 재사용 감지의 가치가 급감한다 (§11.1 2차 정리).
   */
  REFRESH_TOKEN_CONSUMED_RETENTION_DAYS: z.coerce.number().int().min(0).max(365).default(7),
});

export type Env = z.infer<typeof envSchema>;

/**
 * 두 서명 키가 같으면 **리프레시 토큰을 액세스 토큰으로 위조**할 수 있다
 * (`typ` 클레임 검사가 유일한 방어선이 되어, 그 검사를 한 번 빠뜨리면 즉시 뚫린다).
 * 키를 나누는 것이 방어를 두 겹으로 만든다.
 */
const envSchemaChecked = envSchema.refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
  path: ['JWT_REFRESH_SECRET'],
  message: 'JWT_REFRESH_SECRET 은 JWT_ACCESS_SECRET 과 달라야 합니다',
});

/** ConfigModule 이 부팅 시 호출한다. 실패하면 어떤 키가 왜 틀렸는지 그대로 던진다. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchemaChecked.safeParse(raw);

  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`환경변수 검증 실패:\n${lines.join('\n')}`);
  }

  return parsed.data;
}
