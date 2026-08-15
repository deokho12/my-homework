/**
 * auth 오퍼레이션 5개의 호출부 (`docs/api/openapi.yaml` §auth).
 * 요청·응답 형태의 근거는 백엔드 구현이다 — `backend/src/auth/auth.{controller,service,schemas}.ts`.
 *
 * 컴포넌트가 이 파일을 직접 부르지 않는다. 스토어(`useAuthStore`)만 부른다.
 */
import { apiRequest } from '@/lib/apiClient';
import type { TokenPair } from '@/lib/authTokens';
import { isUserRole, type AuthProvider, type User } from '@/types/domain';

/** openapi `SignUpRequest.agreedTermsVersions[]`. */
export interface AgreedTermsVersion {
  slug: 'terms' | 'privacy' | 'location';
  version: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  /**
   * 서버에 없는 버전을 보내면 `422 VALIDATION_FAILED` +
   * `details[].field = 'agreedTermsVersions[0].version'` 이다. 그래서 화면은 값을 추측하지 않고
   * `GET /legal-documents/{slug}` 로 받은 것만 보낸다 (`legalApi.ts`).
   */
  agreedTermsVersions?: AgreedTermsVersion[];
}

export interface LogInInput {
  email: string;
  password: string;
}

/** openapi `AuthSession`. */
export interface AuthSession {
  user: User;
  tokens: TokenPair;
}

interface RawUser {
  id?: unknown;
  email?: unknown;
  name?: unknown;
  provider?: unknown;
  role?: unknown;
  managedHospitalIds?: unknown;
}

interface RawSession {
  user?: RawUser;
  tokens?: { accessToken?: unknown; refreshToken?: unknown };
}

function toProvider(value: unknown): AuthProvider {
  return value === 'google' || value === 'kakao' ? value : 'email';
}

/**
 * 응답 → 도메인 `User`.
 *
 * **모르는 `role` 은 `user` 로 떨어뜨린다.** 서버가 나중에 역할을 추가했을 때
 * 프론트엔드가 그것을 관리자 권한으로 오인하는 것보다, 권한이 없는 쪽으로 기우는 것이 안전하다.
 */
export function toUser(raw: RawUser | undefined): User {
  return {
    id: typeof raw?.id === 'string' ? raw.id : '',
    email: typeof raw?.email === 'string' ? raw.email : '',
    name: typeof raw?.name === 'string' ? raw.name : '',
    provider: toProvider(raw?.provider),
    role: isUserRole(raw?.role) ? raw.role : 'user',
    managedHospitalIds: Array.isArray(raw?.managedHospitalIds)
      ? raw.managedHospitalIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

function toSession(raw: RawSession): AuthSession {
  return {
    user: toUser(raw.user),
    tokens: {
      accessToken: typeof raw.tokens?.accessToken === 'string' ? raw.tokens.accessToken : '',
      refreshToken: typeof raw.tokens?.refreshToken === 'string' ? raw.tokens.refreshToken : '',
    },
  };
}

/** `POST /auth/signup` — 가입 즉시 로그인 상태가 된다 (`201` + AuthSession). */
export async function signUp(input: SignUpInput): Promise<AuthSession> {
  const raw = await apiRequest<RawSession>('/auth/signup', {
    method: 'POST',
    auth: false,
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      // 백엔드 스키마가 `.strict()` 라 빈 배열이라도 뜻이 달라진다. 없으면 아예 보내지 않는다.
      ...(input.agreedTermsVersions?.length ? { agreedTermsVersions: input.agreedTermsVersions } : {}),
    },
  });

  return toSession(raw);
}

/** `POST /auth/login`. 이메일·비밀번호 중 무엇이 틀렸는지는 서버가 구분해 주지 않는다. */
export async function logIn(input: LogInInput): Promise<AuthSession> {
  const raw = await apiRequest<RawSession>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: input.email, password: input.password },
  });

  return toSession(raw);
}

/**
 * `POST /auth/logout` — 서버의 리프레시 토큰을 폐기한다 (`204`).
 *
 * 액세스 토큰은 만료까지 유효하므로 클라이언트가 즉시 버려야 한다.
 */
export async function logOut(refreshToken: string): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken } });
}

/** `GET /auth/me` — 부팅 시 세션 복원. `role`·`managedHospitalIds` 가 가드의 근거다. */
export async function getMe(): Promise<User> {
  return toUser(await apiRequest<RawUser>('/auth/me'));
}
