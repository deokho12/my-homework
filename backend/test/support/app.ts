import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { configureApp } from '../../src/app-setup';
import { AppModule } from '../../src/app.module';
import { GuardTestModule } from './guard-test.module';

/** 시드가 만든 개발 계정 (backend/README.md "개발용 계정"). 비밀번호는 `.env` 의 SEED_PASSWORD. */
export const SEED_ACCOUNTS = {
  operator: 'ops@molarmolar.example',
  /** h1 담당자 */
  adminH1: 'admin-h1@molarmolar.example',
  /** h2 담당자 — "담당이 아닌 병원" 쪽 대조군 */
  adminH2: 'admin-h2@molarmolar.example',
  /** 일반 사용자 (cr1 신청자) */
  user: 'seed-1@molarmolar.example',
} as const;

/** 시드 데이터의 고정 id. seed-data.spec.ts 가 이 값들이 살아 있음을 보장한다. */
export const SEED_FIXTURES = {
  hospitalManagedByH1Admin: 'h1',
  hospitalNotManagedByH1Admin: 'h2',
  doctorAtH1: 'd1',
  doctorAtH11: 'd14',
  /** h1 의 상담 */
  consultAtH1: 'cr1',
  /** h2 의 상담 — h1 담당자에게는 "존재하지 않아야" 한다 */
  consultAtH2: 'cr2',
  /** 존재하지 않는 상담 id. 404 응답이 위와 **구분되지 않아야** 한다 */
  consultMissing: 'cr-does-not-exist',
} as const;

export function seedPassword(): string {
  const password = process.env.SEED_PASSWORD?.trim();

  if (!password) {
    throw new Error('SEED_PASSWORD 가 없습니다. `.env` 를 확인하세요 (테스트는 시드 계정으로 로그인합니다).');
  }

  return password;
}

/**
 * 테스트용 Nest 앱.
 *
 * `configureApp()` 을 그대로 쓴다 — 운영과 같은 전역 접두어·예외 필터·요청 id 를 거친
 * 응답을 검증해야 한다. `GuardTestModule` 은 인가 규칙만 옮긴 테스트 전용 라우트다.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule, GuardTestModule] }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    managedHospitalIds: string[];
  };
}

/** 시드 계정으로 로그인해 세션을 얻는다. 실패하면 원인이 보이게 응답을 그대로 던진다. */
export async function logIn(app: INestApplication, email: string): Promise<Session> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: seedPassword() });

  if (response.status !== 200) {
    throw new Error(`로그인 실패 (${email}): ${response.status} ${JSON.stringify(response.body)}`);
  }

  return {
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
    user: response.body.user,
  };
}

/** `Authorization: Bearer …` 헤더 값. */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}
