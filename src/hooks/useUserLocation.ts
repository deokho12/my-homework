import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

interface UserLocationState {
  location: { latitude: number; longitude: number };
  status: LocationStatus;
}

// Seoul City Hall — used whenever we can't get a real fix (permission denied, unsupported platform, etc).
const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({ location: DEFAULT_CENTER, status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setState({ location: DEFAULT_CENTER, status: 'denied' });
          return;
        }

        const position = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setState({
            location: { latitude: position.coords.latitude, longitude: position.coords.longitude },
            status: 'granted',
          });
        }
      } catch {
        if (!cancelled) setState({ location: DEFAULT_CENTER, status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
