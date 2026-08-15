import { create } from 'zustand';

import { queryClient } from '@/app/providers';
import * as authApi from '@/features/auth/api/authApi';
import type { AgreedTermsVersion } from '@/features/auth/api/authApi';
import { isApiError, subscribeToSessionInvalidated } from '@/lib/apiClient';
import type { ApiError, ApiErrorDetail } from '@/lib/apiClient';
import {
  clearTokens,
  hasTokens,
  purgeLegacyMockAuthStorage,
  readTokens,
  writeTokens,
} from '@/lib/authTokens';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import type { User } from '@/types/domain';

/**
 * 실제 인증 상태. **계정 목록과 비밀번호를 저장하지 않는다** — 이전 구현은 브라우저에
 * 계정과 평문 비밀번호를 담고 있었다 (`docs/features/known-issues.md` 🔴).
 *
 * 저장되는 것은 토큰뿐이며 그 위치도 이 파일이 아니다 (`src/lib/authTokens.ts`).
 * 사용자 정보는 부팅 때마다 `GET /auth/me` 로 받는다 — 개인정보를 브라우저에 남기지 않고,
 * 역할이 바뀌었을 때 낡은 값으로 관리자 화면을 가드하지 않기 위해서다.
 */

/** 목 인증이 남긴 계정·평문 비밀번호를 모듈 로드 시점에 지운다. */
purgeLegacyMockAuthStorage();

export interface AuthErrorInfo {
  /** 서버 에러 코드. 화면 분기용 (`INVALID_CREDENTIALS`, `EMAIL_ALREADY_REGISTERED`, …). */
  code: string;
  /** 사용자에게 그대로 보여줄 수 있는 한국어 문구. */
  message: string;
  /** `422` 의 필드별 사유. 폼이 해당 입력 칸 아래에 뿌린다. */
  details?: ApiErrorDetail[];
}

export type AuthResult = { ok: true } | { ok: false; error: AuthErrorInfo };

/**
 * `restoring` 은 저장된 토큰으로 `GET /auth/me` 를 부르는 중이라는 뜻이다.
 * **가드가 이 상태를 "권한 없음" 으로 판정하면 안 된다** — 새로고침마다 관리자가 튕긴다.
 */
export type SessionStatus = 'restoring' | 'ready';

interface AuthState {
  user: User | null;
  status: SessionStatus;
  signUp: (params: {
    name: string;
    email: string;
    password: string;
    agreedTermsVersions?: AgreedTermsVersion[];
  }) => Promise<AuthResult>;
  logIn: (params: { email: string; password: string }) => Promise<AuthResult>;
  logOut: () => Promise<void>;
  /** 저장된 토큰으로 세션을 되살린다. 실패하면 조용히 비운다. */
  restoreSession: () => Promise<void>;
  /** 토큰·사용자·계정별 캐시를 지운다. 서버 호출은 하지 않는다. */
  clearSession: () => void;
}

function toErrorInfo(error: unknown): AuthErrorInfo {
  if (isApiError(error)) {
    return { code: error.code, message: error.message, details: error.details };
  }

  return { code: 'UNKNOWN_ERROR', message: '잠시 후 다시 시도해주세요' };
}

/**
 * 계정에 딸린 클라이언트 상태를 비운다.
 *
 * ⚠ **임시 조치다.** 찜 목록은 원래 서버(`GET/PUT/DELETE /me/favorites`)로 가야 하지만
 * favorites API 가 아직 없다. 그때까지는 로그아웃 때 비워서 계정 간 유출만 막는다 —
 * 지금은 A 계정으로 찜하고 로그아웃한 뒤 B 계정으로 들어가면 A 의 찜이 그대로 보인다
 * (`docs/features/known-issues.md` 🔴 "다른 사람의 찜 목록이 보입니다").
 * favorites API 가 생기면 이 줄을 지우고 서버 목록으로 바꾼다.
 */
function clearAccountScopedState(): void {
  useFavoritesStore.getState().clear();

  // 계정별·역할별 서버 상태의 잔상도 유출이다 (`docs/api/README.md` §1).
  queryClient.clear();
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  // 토큰이 있으면 첫 렌더부터 '복원 중' 이다. 'ready' 로 시작하면 `GET /auth/me` 가
  // 끝나기 전에 가드가 "권한 없음" 을 렌더한다.
  status: hasTokens() ? 'restoring' : 'ready',

  signUp: async ({ name, email, password, agreedTermsVersions }) => {
    try {
      const session = await authApi.signUp({ name, email, password, agreedTermsVersions });

      writeTokens(session.tokens);
      set({ user: session.user, status: 'ready' });

      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorInfo(error) };
    }
  },

  logIn: async ({ email, password }) => {
    try {
      const session = await authApi.logIn({ email, password });

      writeTokens(session.tokens);
      // 이전 계정의 찜·캐시가 남아 있으면 새 계정 화면에 그대로 보인다.
      clearAccountScopedState();
      set({ user: session.user, status: 'ready' });

      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorInfo(error) };
    }
  },

  logOut: async () => {
    const refreshToken = readTokens()?.refreshToken;

    if (refreshToken) {
      try {
        await authApi.logOut(refreshToken);
      } catch {
        // 서버 폐기가 실패해도 로컬은 반드시 비운다. 실패를 이유로 로그인 상태를
        // 유지하면 "로그아웃을 눌렀는데 로그인돼 있다" 가 된다.
      }
    }

    get().clearSession();
  },

  restoreSession: async () => {
    if (!hasTokens()) {
      set({ user: null, status: 'ready' });

      return;
    }

    try {
      set({ status: 'restoring' });

      const user = await authApi.getMe();

      set({ user, status: 'ready' });
    } catch {
      // 만료·폐기된 토큰이면 조용히 비운다. 부팅 화면에 오류를 띄울 이유가 없다.
      clearTokens();
      set({ user: null, status: 'ready' });
    }
  },

  clearSession: () => {
    clearTokens();
    clearAccountScopedState();
    set({ user: null, status: 'ready' });
  },
}));

/**
 * 리프레시가 거절되면(`REFRESH_TOKEN_REUSED` / `REFRESH_TOKEN_INVALID`) 세션을 비운다.
 * 화면 이동은 `SessionWatcher` 가 맡는다 — 스토어가 라우터를 부르지 않게 둔다.
 */
subscribeToSessionInvalidated((_error: ApiError) => {
  useAuthStore.getState().clearSession();
});
