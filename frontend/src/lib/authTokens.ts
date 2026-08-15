/**
 * 액세스·리프레시 토큰 보관소.
 *
 * **localStorage 를 동기로 읽는다.** Zustand persist(=`AsyncStorage` 어댑터)를 쓰지 않는 이유:
 * 모든 요청이 헤더를 만들 때 토큰을 읽으므로 rehydrate 를 기다릴 수 없고, 앱 부팅 직후의
 * 첫 요청이 토큰 없이 나가면 그 자체로 401 이 된다.
 *
 * 저장 위치가 localStorage 인 것은 백엔드 설계가 **본문 전송**을 전제하기 때문이다
 * (쿠키가 아니다 — `mobile/` 의 Flutter 앱이 같은 API 를 쓴다). 대가는 XSS 노출이고,
 * 액세스 15분 + 리프레시 회전 + 재사용 감지로 완화한다 (`backend/README.md` §토큰).
 *
 * **사용자 정보는 여기에 저장하지 않는다.** 이름·이메일·역할은 부팅 시 `GET /auth/me` 로
 * 받는다. 브라우저에 개인정보를 남기지 않고, 역할이 바뀌었을 때 낡은 값으로 화면을
 * 가드하지 않기 위한 것이다.
 */

const TOKEN_STORAGE_KEY = 'molarmolar-auth-tokens';

/**
 * 목 인증 시절의 저장 키. 계정 목록과 **평문 비밀번호**가 들어 있었다
 * (`docs/features/known-issues.md` 🔴 "비밀번호가 브라우저에 그대로 저장됩니다").
 *
 * 코드를 바꿔도 이미 저장된 값은 남으므로, 부팅 시 한 번 지운다.
 */
const LEGACY_MOCK_AUTH_KEY = 'molarmolar-auth';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<TokenPair>;

  return typeof candidate.accessToken === 'string' && typeof candidate.refreshToken === 'string';
}

export function readTokens(): TokenPair | null {
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    // 형태가 깨진 값(수동 편집·구버전)은 없는 것으로 취급한다. 그대로 헤더에 실으면
    // 매 요청이 401 이 되고 원인을 알 수 없다.
    return isTokenPair(parsed) ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken } : null;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: TokenPair): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // 저장 실패(용량 초과·시크릿 모드)는 세션이 이 탭에서만 유지되는 것으로 끝난다.
  }
}

export function clearTokens(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasTokens(): boolean {
  return readTokens() !== null;
}

/** 목 인증이 남긴 계정 목록·평문 비밀번호를 지운다. 부팅 시 한 번 호출한다. */
export function purgeLegacyMockAuthStorage(): void {
  try {
    window.localStorage.removeItem(LEGACY_MOCK_AUTH_KEY);
  } catch {
    // ignore
  }
}

export { LEGACY_MOCK_AUTH_KEY, TOKEN_STORAGE_KEY };
