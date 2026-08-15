/**
 * 백엔드 HTTP 클라이언트. `fetch` 만 쓴다 (axios 를 넣지 않는다 — 필요한 것이 이 파일 하나다).
 *
 * 책임 네 가지:
 *
 * 1. `Authorization: Bearer` 부착
 * 2. `401 ACCESS_TOKEN_EXPIRED` 면 리프레시 후 원 요청을 **1회** 재시도
 * 3. 동시 요청이 여러 개 401 을 받아도 **리프레시는 한 번만** 실행 (아래 §회전 경합)
 * 4. 에러 응답을 `{ error: { code, message, details?, requestId } }` 계약대로 파싱해서
 *    화면이 `code` 로 분기하고 `message`(한국어)를 그대로 보여줄 수 있게 한다
 *
 * ## 회전 경합 (rotation race)
 *
 * 백엔드는 리프레시 토큰을 **회전**시키고, 같은 토큰의 두 번째 사용을 공격으로 보아
 * **계열 전체를 폐기**한다 (`401 REFRESH_TOKEN_REUSED`). 그래서 두 가지를 반드시 지킨다:
 *
 * - **리프레시 요청은 재시도하지 않는다.** 네트워크 오류로 응답만 잃은 경우 서버에서는
 *   회전이 이미 성공했을 수 있고, 같은 토큰으로 다시 보내면 정상 사용자가 로그아웃된다.
 * - **진행 중인 리프레시 Promise 를 공유한다.** 401 을 받은 요청이 각자 리프레시를 부르면
 *   두 번째 호출이 이미 폐기된 토큰을 보내게 되어 같은 사고가 난다.
 */
import { clearTokens, readTokens, writeTokens, type TokenPair } from '@/lib/authTokens';

/**
 * API 기본 경로. `VITE_API_BASE_URL` 로 받는다 (`frontend/.env.example` 참고).
 *
 * 기본값이 상대 경로인 이유: 같은 오리진에 붙거나 리버스 프록시를 두는 배포에서
 * 환경변수 없이도 동작해야 한다. `/health` 는 이 접두어 밖이라 이 클라이언트로 부르지 않는다.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, '');

/** openapi `ErrorDetail`. `422` 의 필드별 사유. */
export interface ApiErrorDetail {
  /** 점 표기 경로. 배열은 `agreedTermsVersions[0].version`. */
  field: string;
  code: string;
  message: string;
}

/**
 * 서버 에러 본문을 그대로 옮긴 예외.
 *
 * `message` 는 **사용자에게 보여줄 수 있는 한국어**다 (백엔드 `ERROR_CATALOG`).
 * 화면은 문구 사전을 다시 만들지 않고 이 값을 쓰고, 분기가 필요할 때만 `code` 를 본다.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
    cause?: unknown;
  }) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause });

    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON 으로 직렬화해 본문에 싣는다. */
  body?: unknown;
  /**
   * 액세스 토큰을 붙이고 만료 시 재발급을 시도할지. 기본 `true`.
   * 로그인·가입·리프레시는 `false` 다 (토큰이 아직 없거나 본문으로 넘긴다).
   */
  auth?: boolean;
  signal?: AbortSignal;
}

/* ------------------------------------------------------------ 세션 무효화 알림 */

type SessionInvalidatedListener = (error: ApiError) => void;

const sessionInvalidatedListeners = new Set<SessionInvalidatedListener>();

/**
 * 서버가 리프레시를 거절해(`REFRESH_TOKEN_REUSED` / `REFRESH_TOKEN_INVALID`) 세션을
 * 되살릴 수 없을 때 호출된다. 상태 스토어가 사용자 정보를 비우고, 화면이 로그인으로 보낸다.
 */
export function subscribeToSessionInvalidated(listener: SessionInvalidatedListener): () => void {
  sessionInvalidatedListeners.add(listener);

  return () => {
    sessionInvalidatedListeners.delete(listener);
  };
}

function invalidateSession(error: ApiError): void {
  clearTokens();
  sessionInvalidatedListeners.forEach((listener) => {
    listener(error);
  });
}

/* ------------------------------------------------------------------- 요청·응답 */

function codeFromStatus(status: number): string {
  if (status === 400) return 'MALFORMED_REQUEST';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';

  return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
}

async function sendRequest(
  path: string,
  options: ApiRequestOptions,
  accessToken: string | null
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    // 취소는 오류가 아니다 — TanStack Query 가 그대로 처리해야 한다.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;

    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: '연결에 문제가 있어요. 잠시 후 다시 시도해주세요',
      cause,
    });
  }
}

function isErrorBody(value: unknown): value is { error: { code: string; message: string; details?: ApiErrorDetail[]; requestId?: string } } {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;

  const error = (value as { error: unknown }).error;

  if (typeof error !== 'object' || error === null) return false;

  const candidate = error as { code?: unknown; message?: unknown };

  return typeof candidate.code === 'string' && typeof candidate.message === 'string';
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;

  try {
    const text = await response.text();

    body = text ? JSON.parse(text) : null;
  } catch {
    // 본문이 JSON 이 아닌 경우(프록시의 HTML 오류 페이지 등)는 상태 코드만으로 판단한다.
  }

  if (isErrorBody(body)) {
    return new ApiError({
      status: response.status,
      code: body.error.code,
      message: body.error.message,
      details: body.error.details,
      requestId: body.error.requestId,
    });
  }

  return new ApiError({
    status: response.status,
    code: codeFromStatus(response.status),
    message: '요청을 처리할 수 없어요. 잠시 후 다시 시도해주세요',
  });
}

async function readBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const text = await response.text();

  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch (cause) {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: '서버 응답을 이해할 수 없어요. 잠시 후 다시 시도해주세요',
      cause,
    });
  }
}

/* ------------------------------------------------------------------- 리프레시 */

/** 진행 중인 리프레시. 동시 401 이 이 하나를 공유한다 (§회전 경합). */
let inFlightRefresh: Promise<TokenPair> | null = null;

interface TokenPairResponse {
  accessToken?: unknown;
  refreshToken?: unknown;
}

async function performRefresh(): Promise<TokenPair> {
  const stored = readTokens();

  if (!stored) {
    throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: '로그인이 필요해요' });
  }

  // ⚠ 이 요청은 **재시도하지 않는다.** 같은 리프레시 토큰의 두 번째 사용은 백엔드가
  //   재사용(공격)으로 판정해 계열 전체를 끊는다 — 네트워크 실패로 응답을 잃은 뒤
  //   다시 보내면 정상 사용자가 로그아웃된다. 실패는 그대로 호출부로 올린다.
  const response = await sendRequest(
    '/auth/refresh',
    { method: 'POST', body: { refreshToken: stored.refreshToken }, auth: false },
    null
  );

  if (!response.ok) {
    const error = await toApiError(response);

    // 리프레시가 거절되면(재사용·위조·만료) 되살릴 방법이 없다. 세션을 비우고 알린다.
    if (response.status === 401) invalidateSession(error);

    throw error;
  }

  const pair = await readBody<TokenPairResponse>(response);

  if (typeof pair?.accessToken !== 'string' || typeof pair.refreshToken !== 'string') {
    throw new ApiError({
      status: response.status,
      code: 'INVALID_RESPONSE',
      message: '서버 응답을 이해할 수 없어요. 잠시 후 다시 시도해주세요',
    });
  }

  const tokens: TokenPair = { accessToken: pair.accessToken, refreshToken: pair.refreshToken };

  writeTokens(tokens);

  return tokens;
}

/**
 * 액세스 토큰을 재발급한다. **여러 번 불려도 진행 중인 것 하나만 실행된다.**
 *
 * `finally` 로 비우므로, 끝난 뒤의 호출은 새 회전을 시작한다 (그때는 저장된 리프레시
 * 토큰도 새것이라 재사용이 아니다).
 */
export function refreshSession(): Promise<TokenPair> {
  inFlightRefresh ??= performRefresh().finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

async function accessTokenForRetry(previousToken: string | null): Promise<string> {
  const current = readTokens();

  if (!current) {
    throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: '로그인이 필요해요' });
  }

  // 내 요청이 나가는 동안 다른 요청이 이미 회전을 끝냈다면 새 액세스 토큰으로 재시도만 한다.
  // 여기서 리프레시를 다시 부르면 **폐기된 토큰**을 보내게 되고 계열이 끊긴다.
  if (previousToken !== null && current.accessToken !== previousToken) return current.accessToken;

  const refreshed = await refreshSession();

  return refreshed.accessToken;
}

/* ----------------------------------------------------------------------- 진입점 */

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const withAuth = options.auth ?? true;
  const attemptToken = withAuth ? (readTokens()?.accessToken ?? null) : null;

  let response = await sendRequest(path, options, attemptToken);

  if (withAuth && response.status === 401) {
    const error = await toApiError(response);

    // **`ACCESS_TOKEN_EXPIRED` 만 재발급 대상이다.** `UNAUTHENTICATED`(토큰 없음·위조)는
    // 재발급해도 결과가 같으므로 재시도하지 않는다 — 백엔드가 두 코드를 나눠 주는 이유다.
    if (error.code !== 'ACCESS_TOKEN_EXPIRED') throw error;

    response = await sendRequest(path, options, await accessTokenForRetry(attemptToken));
  }

  if (!response.ok) throw await toApiError(response);

  return readBody<T>(response);
}
