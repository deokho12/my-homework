// NestJS DI 가 데코레이터 메타데이터를 읽기 위해 필요하다. 가장 먼저 평가된다.
import 'reflect-metadata';

// 테스트는 `.env` 의 DATABASE_URL 을 쓴다 (개발용 SQLite 파일).
// 즉 테스트를 돌리기 전에 마이그레이션 + 시드가 적용되어 있어야 한다:
//   npm run prisma:migrate && npm run prisma:seed
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL 이 없습니다. `cp .env.example .env` 후 `npm run prisma:migrate && npm run prisma:seed` 를 먼저 실행하세요.',
  );
}
