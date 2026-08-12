import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { RefreshTokenClientInfo } from './refresh-token.store';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuthService } from './auth.service';
import { logInSchema, refreshSchema, signUpSchema } from './auth.schemas';
import type { LogInDto, RefreshDto, SignUpDto } from './auth.schemas';
import type { AuthenticatedUser, AuthSessionResponse, TokenPairResponse, UserResponse } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthGuard } from './guards/auth.guard';

/**
 * 세션 행(`refresh_tokens`)에 남길 클라이언트 스냅샷.
 *
 * **길이를 자른다.** `User-Agent` 는 클라이언트가 정하는 값이라 제한이 없고, 자르지 않으면
 * 임의 길이 문자열을 DB 에 넣는 경로가 된다. 세션 목록에서 기기를 구분할 정도면 충분하다.
 */
function clientInfo(request: Request): RefreshTokenClientInfo {
  return {
    userAgent: request.header('user-agent')?.slice(0, 255) ?? null,
    ip: request.ip ?? null,
  };
}

/**
 * `POST /api/v1/auth/*`, `GET /api/v1/auth/me` — openapi 의 auth 오퍼레이션.
 *
 * 접두어 `/api/v1` 은 `app-setup.ts` 의 `setGlobalPrefix` 가 붙인다. openapi 의 `servers`
 * 도 같은 값이다 (`/v1` 과 `/api` 로 갈라져 있던 것을 `/api/v1` 로 확정했다).
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 가입 즉시 로그인 상태 (`201` + AuthSession). */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signUp(
    @Body(new ZodValidationPipe(signUpSchema)) dto: SignUpDto,
    @Req() request: Request,
  ): Promise<AuthSessionResponse> {
    return this.auth.signUp(dto, clientInfo(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  logIn(
    @Body(new ZodValidationPipe(logInSchema)) dto: LogInDto,
    @Req() request: Request,
  ): Promise<AuthSessionResponse> {
    return this.auth.logIn(dto, clientInfo(request));
  }

  /**
   * 리프레시 토큰 회전. **인증 헤더를 요구하지 않는다** — 액세스 토큰이 이미 만료된
   * 상태에서 부르는 엔드포인트다 (openapi 에도 security 가 없다).
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
    @Req() request: Request,
  ): Promise<TokenPairResponse> {
    return this.auth.refresh(dto.refreshToken, clientInfo(request));
  }

  /** 리프레시 토큰 폐기. 액세스 토큰은 만료까지 유효하므로 클라이언트가 즉시 버린다. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  async logOut(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
  ): Promise<void> {
    await this.auth.logOut(user, dto.refreshToken);
  }

  /**
   * 앱 부팅 시 세션 복원. `role` 과 `managedHospitalIds` 가 관리자 화면 진입 가드의 근거다
   * (클라이언트 추측이 아니라 이 응답이 근거여야 한다 — openapi `getMe` 설명).
   */
  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    return this.auth.me(user);
  }
}
