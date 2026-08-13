import { useEffect, useState } from 'react';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

interface UserLocationState {
  location: { latitude: number; longitude: number };
  status: LocationStatus;
}

// Seoul City Hall — used whenever we can't get a real fix (permission denied, unsupported browser, etc).
const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

/**
 * Browser geolocation, replacing expo-location. The permission prompt is implicit in
 * `getCurrentPosition`, so unlike the native version there's no separate request step —
 * the resulting `status` values are the same.
 *
 * `enabled` (default `true`) lets a caller defer the permission prompt until it's actually
 * needed — e.g. the explore screen's map view only wants a fix once the user switches to
 * "지도 보기", not the moment the screen mounts in list view.
 */
export function useUserLocation(enabled: boolean = true) {
  const [state, setState] = useState<UserLocationState>({ location: DEFAULT_CENTER, status: 'loading' });

  useEffect(() => {
    if (!enabled) return;

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
      }
    );

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
