import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { ApiError } from '../../common/errors/api-error';
import type { AuthenticatedUser } from '../auth.types';
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { TokenService } from '../token.service';
import { UsersRepository } from '../users.repository';
/* eslint-enable @typescript-eslint/consistent-type-imports */

/** `request` 에 주체를 붙이는 키. 데코레이터·다른 가드가 이 상수로 읽는다. */
export const AUTH_USER_KEY = 'authUser';

/** 요청에서 인증된 주체를 꺼낸다. 가드를 통과했으면 항상 있다. */
export function getAuthUser(request: Request): AuthenticatedUser | undefined {
  const value = (request as Request & Record<string, unknown>)[AUTH_USER_KEY];

  return value as AuthenticatedUser | undefined;
}

/**
 * =============================================================================
 * 1층 — 인증 (docs/api/README.md §3 "인가 규칙 세 층")
 * =============================================================================
 *
 * - 토큰 없음/형식 오류 → `401 UNAUTHENTICATED` (`로그인이 필요해요`)
 * - 만료 → `401 ACCESS_TOKEN_EXPIRED` — 클라이언트가 이 코드에서만 자동 재발급을 시도한다.
 *   두 경우를 같은 코드로 내면 클라이언트가 "재발급해도 되는 상황" 을 알 수 없다.
 *
 * **판단: 클레임의 `role` 을 그대로 신뢰하지 않고 DB 의 현재 역할을 읽는다.**
 *
 * 문서(§3)는 "`role` 은 클레임에 있고, 승격·해제 시 리프레시 토큰을 폐기해 최대 15분 안에
 * 반영된다" 고 적는다. 계약은 그대로 지키되(클레임에 `role` 을 넣는다), 검증에서는 PK 조회
 * 한 번으로 현재 값을 확인한다. 이유:
 *
 *   1. **15분의 낡은 권한을 0으로 만든다.** 담당자 해제·강등이 즉시 반영된다.
 *   2. **탈퇴(soft delete)한 계정의 토큰이 즉시 무효가 된다.** 무상태 검증만으로는
 *      탈퇴 후에도 최대 15분간 API 를 쓸 수 있다.
 *   3. **CLI 승격이 실제로 반영된다.** 리프레시 토큰 저장소가 프로세스 메모리라
 *      별도 프로세스인 CLI 는 토큰을 폐기할 수 없다. 클레임만 믿으면 강등이 반영되지 않는다.
 *
 * 대가는 요청당 인덱스 PK 조회 1회다. 이 조회는 어차피 `email`/`name`(감사 로그·메모
 * 작성자 표시)에 필요하다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request.header('authorization'));

    if (!token) {
      throw new ApiError('UNAUTHENTICATED');
    }

    const verified = this.tokens.verifyAccessToken(token);

    if (!verified.ok) {
      throw new ApiError(verified.reason === 'expired' ? 'ACCESS_TOKEN_EXPIRED' : 'UNAUTHENTICATED');
    }

    const account = await this.users.findById(verified.claims.sub);

    if (!account) {
      // 토큰은 유효하지만 계정이 없거나 탈퇴했다. 만료가 아니므로 재발급을 유도하지 않는다.
      throw new ApiError('UNAUTHENTICATED');
    }

    (request as Request & Record<string, unknown>)[AUTH_USER_KEY] = {
      id: account.id,
      email: account.email,
      name: account.name,
      provider: account.provider,
      role: account.role,
    } satisfies AuthenticatedUser;

    return true;
  }
}

/**
 * `Authorization: Bearer <token>` 파싱.
 *
 * 스킴 비교는 대소문자를 구분하지 않는다(RFC 7235). 토큰이 빈 문자열이면 없는 것으로 본다.
 */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, ...rest] = header.trim().split(/\s+/);

  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;

  const token = rest.join(' ').trim();

  return token.length > 0 ? token : null;
}
