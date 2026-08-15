// Prisma CLI 설정.
//
// Prisma 6.19 부터 `package.json#prisma` 는 deprecated 다(7 에서 제거). 그래서
// 시드 명령을 이 파일에 둔다. 대신 이 파일을 쓰면 Prisma 가 `.env` 를 자동으로
// 읽어 주지 않으므로 dotenv 를 직접 불러야 한다 — DATABASE_URL 과 SEED_PASSWORD
// 가 여기서 process.env 로 들어온다.
import 'dotenv/config';

import path from 'node:path';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    // 시드는 프론트엔드 fixture 를 import 하므로 별칭이 있는 전용 tsconfig 로 돌린다.
    seed: 'tsx --tsconfig prisma/tsconfig.seed.json prisma/seed.ts',
  },
});
