import { Injectable, Logger } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';

import { ApiError } from '../common/errors/api-error';
import type { AuthenticatedUser, AuthSessionResponse, TokenPairResponse, UserResponse } from './auth.types';
import type { LogInDto, SignUpDto } from './auth.schemas';
// 생성자 주입용 값 import (emitDecoratorMetadata)
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { LegalDocumentsRepository } from '../legal/legal-documents.repository';
import { PasswordService } from './password.service';
import { RefreshTokenStore } from './refresh-token.store';
import { TokenService } from './token.service';
import { UsersRepository } from './users.repository';
/* eslint-enable @typescript-eslint/consistent-type-imports */
import type { RefreshTokenClientInfo } from './refresh-token.store';
import type { AccountRecord } from './users.repository';

/**
 * 인증 유스케이스. openapi 의 auth 오퍼레이션 5개에 대응한다.
 *
 * 이 서비스는 **역할을 바꾸지 않는다.** 승격 경로는 HTTP 에 존재하지 않는다
 * (docs/decisions/0001-roles-and-pii.md 결정 4 — `npm run operator:grant` CLI 만).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly refreshTokens: RefreshTokenStore,
    private readonly legalDocuments: LegalDocumentsRepository,
  ) {}

  /**
   * `POST /auth/signup` — 가입 즉시 로그인 상태가 된다 (openapi 201 AuthSession).
   *
   * `agreedTermsVersions` 는 **계정 생성과 같은 트랜잭션**으로 `user_agreements` 에 기록된다
   * (docs/database/README.md §11.3). 없는 버전이면 `422` 다 — 클라이언트가 캐시된 낡은
   * 버전에 동의하고 보낼 수 있고, 통과시키면 "동의하지 않은 버전으로 가입" 이 된다.
   */
  async signUp(dto: SignUpDto, client?: RefreshTokenClientInfo): Promise<AuthSessionResponse> {
    const email = UsersRepository.normalizeEmail(dto.email);

    if (await this.users.existsByEmail(email)) {
      throw new ApiError('EMAIL_ALREADY_REGISTERED');
    }

    // 동의 대상 문서를 **계정을 만들기 전에** 해석한다. 뒤에서 하면 422 를 내기 위해
    // 계정을 지워야 하고, 그 삭제가 실패하면 동의 없는 계정이 남는다.
    const agreedLegalDocumentIds = await this.resolveAgreedDocumentIds(dto.agreedTermsVersions);
    const passwordHash = await this.passwords.hash(dto.password);
    const now = new Date();

    // id 는 애플리케이션이 만든다 — 스키마에 @default 가 없다 (docs/database/README.md §3.4)
    const account = await this.users.create({
      id: createId(),
      email,
      name: dto.name.trim(),
      passwordHash,
      now,
      agreedLegalDocumentIds,
    });

    return this.buildSession(account, client);
  }

  /**
   * `{slug, version}` → `legal_documents.id`.
   *
   * - 없는 버전이 하나라도 있으면 `422 VALIDATION_FAILED` (항목별 `details`).
   * - 같은 문서를 두 번 보내면 한 번만 기록한다 — `(user_id, legal_document_id)` 유니크가
   *   있어 그대로 넣으면 제약 위반으로 500 이 된다.
   */
  private async resolveAgreedDocumentIds(refs: SignUpDto['agreedTermsVersions']): Promise<string[]> {
    if (!refs?.length) {
      return [];
    }

    const documents = await this.legalDocuments.findByRefs(refs);
    const byKey = new Map(documents.map((doc) => [`${doc.slug}@${doc.version}`, doc]));
    const details = refs
      .map((ref, index) => ({ ref, index }))
      .filter(({ ref }) => !byKey.has(`${ref.slug}@${ref.version}`))
      .map(({ ref, index }) => ({
        field: `agreedTermsVersions[${index}].version`,
        code: 'UNKNOWN_TERMS_VERSION',
        message: `'${ref.slug}' 약관의 '${ref.version}' 버전이 없어요. 최신 약관을 다시 확인해주세요`,
      }));

    if (details.length > 0) {
      this.logger.warn(
        `존재하지 않는 약관 버전으로 가입을 시도했습니다 — ${details.map((d) => d.field).join(', ')}`,
      );

      throw new ApiError('VALIDATION_FAILED', { details });
    }

    return [...new Set(refs.map((ref) => byKey.get(`${ref.slug}@${ref.version}`)!.id))];
  }

  /**
   * `POST /auth/login`
   *
   * **계정 없음과 비밀번호 불일치를 구분하지 않는다.** 같은 코드(`INVALID_CREDENTIALS`),
   * 같은 문구, 그리고 **같은 응답 시간**이다 (PasswordService.burnTime 주석 참고).
   */
  async logIn(dto: LogInDto, client?: RefreshTokenClientInfo): Promise<AuthSessionResponse> {
    const account = await this.users.findByEmailWithSecret(dto.email);

    if (!account) {
      await this.passwords.burnTime(dto.password);

      throw new ApiError('INVALID_CREDENTIALS');
    }

    const matches = await this.passwords.verify(dto.password, account.passwordHash);

    if (!matches) {
      throw new ApiError('INVALID_CREDENTIALS');
    }

    return this.buildSession(
      {
        id: account.id,
        email: account.email,
        name: account.name,
        provider: account.provider,
        role: account.role,
      },
      client,
    );
  }

  /**
   * `POST /auth/refresh` — 회전.
   *
   * 순서가 중요하다: **서명 검증 → 저장소 소비 → 새 쌍 발급.** 저장소 소비가 먼저
   * 성공해야 새 토큰이 나가므로, 같은 토큰으로 두 번 호출하면 두 번째는 반드시 재사용으로 잡힌다.
   *
   * 역할은 **DB 에서 다시 읽는다.** 리프레시 토큰에 `role` 을 넣지 않은 이유이며,
   * CLI 로 역할이 바뀐 계정이 재발급 한 번으로 올바른 역할을 갖게 된다.
   */
  async refresh(refreshToken: string, client?: RefreshTokenClientInfo): Promise<TokenPairResponse> {
    const verified = this.tokens.verifyRefreshToken(refreshToken);

    if (!verified.ok) {
      // 만료와 위조를 같은 코드로 낸다. 클라이언트의 대응(재로그인)이 같다.
      throw new ApiError('REFRESH_TOKEN_INVALID');
    }

    const consumed = await this.refreshTokens.consume(verified.claims.jti);

    if (consumed.outcome === 'reused') {
      throw new ApiError('REFRESH_TOKEN_REUSED');
    }

    if (consumed.outcome === 'unknown') {
      throw new ApiError('REFRESH_TOKEN_INVALID');
    }

    const account = await this.users.findById(verified.claims.sub);

    if (!account) {
      // 탈퇴한 계정. 계열을 정리하고 재로그인을 요구한다.
      await this.refreshTokens.revokeAllForUser(verified.claims.sub);

      throw new ApiError('REFRESH_TOKEN_INVALID');
    }

    return this.issueTokens(account, consumed.familyId, client);
  }

  /**
   * `POST /auth/logout` — 전달한 리프레시 토큰을 폐기한다.
   *
   * **다른 사람의 토큰은 폐기하지 않는다.** 그 검사가 없으면 아무 로그인 계정이 남의
   * 리프레시 토큰 문자열만 알아내 세션을 끊을 수 있다. 소유자가 아니어도 `204` 를 주는 이유는
   * "그 토큰이 존재한다" 를 알려주지 않기 위해서다.
   *
   * 이미 없는 토큰이어도 `204` 다 (멱등). 액세스 토큰은 만료까지 유효하므로
   * 클라이언트가 즉시 버려야 한다 — openapi 설명과 같다.
   */
  async logOut(user: AuthenticatedUser, refreshToken: string): Promise<void> {
    const verified = this.tokens.verifyRefreshToken(refreshToken);

    if (!verified.ok || verified.claims.sub !== user.id) {
      return;
    }

    await this.refreshTokens.revoke(verified.claims.jti);
  }

  /** `GET /auth/me` — 세션 복원용. `role` + `managedHospitalIds` 가 화면 가드의 근거다. */
  async me(user: AuthenticatedUser): Promise<UserResponse> {
    return this.toUserResponse(user);
  }

  /** 로그인·가입 공통 — 사용자 정보와 새 토큰 쌍. */
  private async buildSession(
    account: AccountRecord,
    client?: RefreshTokenClientInfo,
  ): Promise<AuthSessionResponse> {
    const [user, tokens] = await Promise.all([
      this.toUserResponse(account),
      this.issueTokens(account, undefined, client),
    ]);

    return { user, tokens };
  }

  private async issueTokens(
    account: AccountRecord,
    familyId?: string,
    client?: RefreshTokenClientInfo,
  ): Promise<TokenPairResponse> {
    const accessToken = this.tokens.issueAccessToken(account);
    const refresh = this.tokens.issueRefreshToken(account.id, familyId);

    await this.refreshTokens.register({
      jti: refresh.jti,
      userId: account.id,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
      // 세션 목록·이상 징후 확인용 스냅샷. 헤더가 없으면 null 이다 (컬럼이 nullable 인 이유)
      client,
    });

    return {
      accessToken,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresIn: this.tokens.accessTtlSeconds,
      refreshExpiresIn: this.tokens.refreshTtlSeconds,
    };
  }

  /**
   * openapi `User` 로의 투영. **여기가 유일한 사용자 직렬화 경로다** —
   * `passwordHash` 가 응답에 실릴 수 없게 필드를 명시적으로 나열한다
   * (`...account` 스프레드를 쓰지 않는 이유).
   */
  private async toUserResponse(account: AccountRecord): Promise<UserResponse> {
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      provider: account.provider,
      role: account.role,
      managedHospitalIds: await this.users.findManagedHospitalIds(account.id),
    };
  }
}
