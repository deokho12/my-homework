import { Injectable } from '@nestjs/common';
// 생성자 주입은 런타임 값이 필요하다 (emitDecoratorMetadata 가 남기는 파라미터 타입)
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import { createId } from '@paralleldrive/cuid2';

import type { Env } from '../config/env.schema';
import { isUserRole } from './auth.types';
import type { AccessTokenClaims, RefreshTokenClaims, UserRole } from './auth.types';

/** 서명 검증 결과. 호출부가 각 실패를 다른 에러 코드로 바꾼다. */
export type VerifyResult<T> =
  | { ok: true; claims: T }
  | { ok: false; reason: 'expired' }
  /** 서명 불일치, 발급자/대상 불일치, 토큰 종류 불일치, 형식 오류 */
  | { ok: false; reason: 'invalid' };

/**
 * JWT 발급·검증. **토큰의 모양을 아는 유일한 곳**이다.
 *
 * 설계 판단 (docs/api/README.md §3 과 openapi `components.securitySchemes` 를 따른다):
 *
 * - **액세스 토큰 15분.** 짧게 두는 이유는 폐기 수단이 없기 때문이다(무상태 검증).
 *   역할 해제·탈퇴가 반영되기까지의 최악 지연이 이 값이다.
 * - **리프레시 토큰 30일 + 회전.** 본문으로 오가는 토큰이므로 탈취 시 무제한 사용을
 *   막는 장치가 회전과 재사용 감지다.
 * - **알고리즘은 HS256 고정.** `alg: none`/알고리즘 혼용 공격을 막기 위해 검증 시
 *   허용 알고리즘을 명시한다. 비대칭키(RS256)는 검증자가 여러 서비스로 늘어날 때 의미가 있는데
 *   지금은 발급자와 검증자가 같은 프로세스다.
 * - **`iss`/`aud` 를 검증한다.** 다른 환경(스테이징) 토큰이 운영에서 통하지 않게 한다.
 * - **클레임에 `role` 은 넣지만 `managedHospitalIds` 는 넣지 않는다** (문서 판단).
 *   담당 병원은 매 요청 `hospital_admins` 조회로 판단한다.
 */
@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly issuer: string;
  private readonly audience: string;

  /** 액세스 토큰 수명(초). openapi `TokenPair.expiresIn` 으로 그대로 내려간다. */
  readonly accessTtlSeconds: number;
  /** 리프레시 토큰 수명(초). openapi `TokenPair.refreshExpiresIn`. */
  readonly refreshTtlSeconds: number;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessSecret = config.get('JWT_ACCESS_SECRET', { infer: true });
    this.refreshSecret = config.get('JWT_REFRESH_SECRET', { infer: true });
    this.issuer = config.get('JWT_ISSUER', { infer: true });
    this.audience = config.get('JWT_AUDIENCE', { infer: true });
    this.accessTtlSeconds = config.get('ACCESS_TOKEN_TTL_SECONDS', { infer: true });
    this.refreshTtlSeconds = config.get('REFRESH_TOKEN_TTL_SECONDS', { infer: true });
  }

  /**
   * 액세스 토큰 발급.
   *
   * `expiresInSeconds` 는 **만료 동작을 테스트하기 위한** 재정의다 (음수를 주면 이미 만료된
   * 토큰이 나온다). 운영 코드는 넘기지 않는다.
   */
  issueAccessToken(user: { id: string; role: UserRole }, options?: { expiresInSeconds?: number }): string {
    return this.jwt.sign(
      { role: user.role, typ: 'access' },
      {
        secret: this.accessSecret,
        algorithm: 'HS256',
        subject: user.id,
        jwtid: createId(),
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: options?.expiresInSeconds ?? this.accessTtlSeconds,
      },
    );
  }

  /** 리프레시 토큰 발급. `familyId` 를 넘기지 않으면 새 계열이 시작된다(= 새 로그인). */
  issueRefreshToken(userId: string, familyId?: string): { token: string; jti: string; familyId: string; expiresAt: Date } {
    const jti = createId();
    const sid = familyId ?? createId();
    const token = this.jwt.sign(
      { sid, typ: 'refresh' },
      {
        secret: this.refreshSecret,
        algorithm: 'HS256',
        subject: userId,
        jwtid: jti,
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: this.refreshTtlSeconds,
      },
    );

    return {
      token,
      jti,
      familyId: sid,
      expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
    };
  }

  verifyAccessToken(token: string): VerifyResult<AccessTokenClaims> {
    return this.verify<AccessTokenClaims>(
      token,
      this.accessSecret,
      'access',
      (payload) =>
        typeof payload.sub === 'string' && typeof payload.jti === 'string' && isUserRole(payload.role),
    );
  }

  verifyRefreshToken(token: string): VerifyResult<RefreshTokenClaims> {
    return this.verify<RefreshTokenClaims>(
      token,
      this.refreshSecret,
      'refresh',
      (payload) =>
        typeof payload.sub === 'string' && typeof payload.jti === 'string' && typeof payload.sid === 'string',
    );
  }

  private verify<T>(
    token: string,
    secret: string,
    expectedType: 'access' | 'refresh',
    isShape: (payload: Record<string, unknown>) => boolean,
  ): VerifyResult<T> {
    try {
      const payload = this.jwt.verify<Record<string, unknown>>(token, {
        secret,
        // 허용 알고리즘을 못 박는다. 명시하지 않으면 토큰 헤더의 alg 를 따라가게 된다.
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      });

      // 종류가 다른 토큰(리프레시를 Authorization 헤더에 넣는 등)은 무효다.
      // 서명 키도 분리되어 있어 이 검사는 두 번째 방어선이다.
      if (payload.typ !== expectedType || !isShape(payload)) {
        return { ok: false, reason: 'invalid' };
      }

      return { ok: true, claims: payload as unknown as T };
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        return { ok: false, reason: 'expired' };
      }

      return { ok: false, reason: 'invalid' };
    }
  }
}
