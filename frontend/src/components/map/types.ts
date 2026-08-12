import type { RNStyle } from '@/primitives';

export interface KakaoMapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
}

export interface KakaoMapProps {
  center: { latitude: number; longitude: number };
  markers: KakaoMapMarker[];
  onMarkerPress: (id: string) => void;
  style?: RNStyle;
}
