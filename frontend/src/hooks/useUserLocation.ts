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
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
