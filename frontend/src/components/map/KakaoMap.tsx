import { useEffect, useRef, useState } from 'react';

import { KAKAO_MAP_JS_KEY } from '@/config/kakaoMap';
import { Text, View } from '@/primitives';

import type { KakaoMapProps } from './types';

declare global {
  interface Window {
    kakao: any;
  }
}

let sdkLoadPromise: Promise<void> | null = null;

function loadKakaoMapSdk(): Promise<void> {
  if (window.kakao?.maps) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_JS_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () => reject(new Error('카카오맵 SDK를 불러오지 못했어요'));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

export function KakaoMap({ center, markers, onMarkerPress, style }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerObjectsRef = useRef<Map<string, any>>(new Map());
  const onMarkerPressRef = useRef(onMarkerPress);
  onMarkerPressRef.current = onMarkerPress;

  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!KAKAO_MAP_JS_KEY) {
      setError('카카오맵 API 키가 설정되지 않았어요');
      return;
    }

    let cancelled = false;
    loadKakaoMapSdk()
      .then(() => {
        if (cancelled) return;
        const node = containerRef.current;
        if (!node) return;
        mapRef.current = new window.kakao.maps.Map(node, {
          center: new window.kakao.maps.LatLng(center.latitude, center.longitude),
          level: 5,
        });
        setReady(true);
      })
      .catch((err: Error) => setError(err.message));

    return () => {
      cancelled = true;
    };
    // Map is created once; center/marker updates are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setCenter(new window.kakao.maps.LatLng(center.latitude, center.longitude));
  }, [ready, center.latitude, center.longitude]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const kakao = window.kakao;
    const existingMarkers = markerObjectsRef.current;

    for (const [id, marker] of existingMarkers) {
      if (!markers.some((item) => item.id === id)) {
        marker.setMap(null);
        existingMarkers.delete(id);
      }
    }

    markers.forEach((markerData) => {
      const position = new kakao.maps.LatLng(markerData.latitude, markerData.longitude);
      const existing = existingMarkers.get(markerData.id);
      if (existing) {
        existing.setPosition(position);
        return;
      }
      const marker = new kakao.maps.Marker({ position, map: mapRef.current, title: markerData.label });
      kakao.maps.event.addListener(marker, 'click', () => onMarkerPressRef.current(markerData.id));
      existingMarkers.set(markerData.id, marker);
    });
  }, [ready, markers]);

  if (error) {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text className="px-6 text-center text-sm text-neutral-500">{error}</Text>
      </View>
    );
  }

  return <View ref={containerRef} style={[{ flex: 1 }, style]} />;
}
