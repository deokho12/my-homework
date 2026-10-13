import { useEffect, useState } from 'react';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

interface UserLocationState {
  location: { latitude: number; longitude: number };
  status: LocationStatus;
}

// Seoul City Hall — used whenever we can't get a real fix (permission denied, unsupported browser, etc).
//
// **Only the map may use this fallback**: a map needs some centre to draw at all, and the
// screen says so ("위치 권한을 확인할 수 없어 서울시청을 기준으로…"). Distances must never be
// computed from it — that's what `point` (below) is for.
const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

/**
 * `maximumAge` 5분: 탐색 ↔ 카테고리를 오갈 때마다 이 훅이 다시 마운트되는데, 캐시된 좌표를
 * 즉시 받으면 두 번째 화면부터 거리가 깜빡이지 않는다. `timeout` 이 없으면 응답하지 않는
 * 브라우저에서 `loading` 이 영원히 남는다. 고정밀 측위는 거리 표시에 필요 없다(배터리만 쓴다).
 */
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 300000,
};

/**
 * Browser geolocation, replacing expo-location. The permission prompt is implicit in
 * `getCurrentPosition`, so unlike the native version there's no separate request step —
 * the resulting `status` values are the same.
 *
 * Only the explore and category screens call this — their cards show a distance, so the
 * permission prompt appears when those screens mount. Every other screen never asks.
 * (There used to be an `enabled` flag that deferred the prompt until the map view opened;
 * no caller needs it now that the list itself wants coordinates.)
 */
export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({ location: DEFAULT_CENTER, status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    if (!navigator.geolocation) {
      setState({ location: DEFAULT_CENTER, status: 'error' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setState({
          location: { latitude: position.coords.latitude, longitude: position.coords.longitude },
          status: 'granted',
        });
      },
      (error) => {
        if (cancelled) return;
        setState({
          location: DEFAULT_CENTER,
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'error',
        });
      },
      POSITION_OPTIONS
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    ...state,
    /**
     * 거리 계산에 **써도 되는** 좌표, 또는 `null`. "서울시청 폴백으로 거짓 거리를 그리지
     * 않는다" 는 판정은 여기 한 곳에만 있다 — 화면들이 각자 `status` 를 다시 보면
     * 한 곳만 고쳐도 다른 곳이 조용히 거짓말을 계속한다.
     */
    point: state.status === 'granted' ? state.location : null,
  };
}
