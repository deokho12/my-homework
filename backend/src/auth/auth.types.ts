/**
 * 인증·인가의 타입 정의. docs/decisions/0001-roles-and-pii.md 결정 1 의 역할 3개가 여기서 시작한다.
 */

/** `users.role` 의 허용값. 스키마가 enum 을 쓰지 않으므로(이식성 규칙) 애플리케이션이 검증한다. */
export const USER_ROLES = ['user', 'hospital_admin', 'operator'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/** `users.provider` 의 허용값. */
export const AUTH_PROVIDERS = ['email', 'google', 'kakao'] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/**
 * `AuthGuard` 가 요청에 붙이는 주체(subject).
 *
 * **`role` 은 DB 값이다** (토큰 클레임이 아니다) — 아래 auth.guard.ts 주석의 판단 참고.
 * `managedHospitalIds` 는 여기에 넣지 않는다. 담당 병원 검사는 필요한 요청에서만
 * `hospital_admins` 를 조회한다 (docs/api/README.md §3).
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  provider: string;
  role: UserRole;
}

/** 액세스 토큰 페이로드. 문서가 정한 클레임 + 토큰 종류 구분자. */
export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  /** 'access' — 리프레시 토큰을 액세스 토큰 자리에 넣는 것을 막는다. */
  typ: 'access';
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

/**
 * 리프레시 토큰 페이로드.
 *
 * `role` 을 넣지 않는다 — 재발급 때 DB 에서 현재 역할을 읽어 새 액세스 토큰에 넣는다.
 * 그래야 CLI 로 역할이 바뀐 계정이 재발급 한 번으로 올바른 역할을 갖는다.
 *
 * `sid` 는 **계열(family) id** 다. 회전할 때 같은 `sid` 를 물려주고, 재사용이
 * 감지되면 그 `sid` 계열 전체를 폐기한다 (docs/api/openapi.yaml `POST /auth/refresh`).
 */
export interface RefreshTokenClaims {
  sub: string;
  sid: string;
  typ: 'refresh';
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

/** openapi `TokenPair`. */
export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
}

/** openapi `User`. **`passwordHash` 는 이 타입에 존재하지 않는다** — 응답 경로에 오를 수 없다. */
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  provider: string;
  role: UserRole;
  managedHospitalIds: string[];
}

/** openapi `AuthSession`. */
export interface AuthSessionResponse {
  user: UserResponse;
  tokens: TokenPairResponse;
}
