import type { Request } from 'express';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TokenService } from './token.service';

/**
 * 선택 인증(`security: [{}, bearerAuth]`) 라우트의 열람자 판정.
 *
 * **실패에 401 을 내지 않는다.** 공개 화면이므로 토큰이 만료·위조여도 조회는 성공해야 하고,
 * 잠긴 필드(전문의 평점)만 닫힌 채로 내려간다. `verifyAccessToken` 이 예외를 던지지 않고
 * 결과 타입을 돌려주는 것이 이 판정을 가능하게 한다.
 *
 * `AuthGuard` 를 쓸 수 없는 이유: 가드는 인증 실패를 401 로 바꾼다.
 */
export function resolveAuthenticated(request: Request, tokens: TokenService): boolean {
  const header = request.header('authorization');
  if (header === undefined || !header.toLowerCase().startsWith('bearer ')) return false;

  return tokens.verifyAccessToken(header.slice(7).trim()).ok;
}
