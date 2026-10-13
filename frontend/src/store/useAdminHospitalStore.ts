import { create } from 'zustand';

/**
 * 관리자 화면이 보고 있는 **담당 병원 하나**.
 *
 * 주소(`?hospitalId=`)가 아니라 기억된 선택이다 — 화면을 옮겨도 따라가야 하고, "기본값은
 * 주소에 적지 않는다" 는 이 앱의 규칙(상담 목록의 기본 탭·기간과 같은 판단)을 지킨다.
 * 서버는 이 값을 기억하지 않는다 (`docs/database/README.md` §13.10 — 기기마다 달라도 되는 값).
 *
 * ⚠ **`lib/localCollection.ts`·`lib/authTokens.ts` 말고 localStorage 를 쓰는 세 번째
 * 자리다.** 두 파일의 규약(저장소 대역 / 토큰)에 속하지 않는, 기기에 남는 **화면 설정**이라
 * 여기 둔다. 서버 데이터가 아니므로 백엔드가 생겨도 사라지지 않는다.
 *
 * **계정이 바뀌면 비운다** — `useAuthStore.clearAccountScopedState()` 가 `clear()` 를 부른다.
 * 비우지 않으면 A 계정이 고른 병원 id 가 B 계정의 화면에 남고, B 가 담당하지 않는 병원이면
 * 읽는 쪽에서 버려지긴 하지만 **두 계정이 같은 기기에서 서로의 선택을 보는 상태**가 된다.
 */

const STORAGE_KEY = 'mola.admin.hospitalId';

/** localStorage 가 막힌 환경(사생활 보호 모드)에서도 화면은 그대로 동작해야 한다. */
function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function write(value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 기억하지 못할 뿐이다 — 이번 세션의 선택은 메모리에 남는다.
  }
}

interface AdminHospitalState {
  /**
   * 마지막으로 고른 병원. **그대로 믿지 않는다** — 읽는 쪽(`useAdminHospital`)이
   * `managedHospitalIds` 로 검증하고, 범위 밖이면 버린다.
   */
  hospitalId: string | null;
  select: (hospitalId: string) => void;
  clear: () => void;
}

export const useAdminHospitalStore = create<AdminHospitalState>()((set) => ({
  hospitalId: read(),
  select: (hospitalId) => {
    write(hospitalId);
    set({ hospitalId });
  },
  clear: () => {
    write(null);
    set({ hospitalId: null });
  },
}));
