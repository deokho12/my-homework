import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { KAKAO_MAP_JS_KEY, KAKAO_MAP_NATIVE_KEY } from '@/config/kakaoMap';

import type { KakaoMapProps } from './types';

// No mature RN Kakao Maps SDK exists yet, so native falls back to the same JS SDK inside a WebView.
// This rebuilds the whole page on every marker/center change (simple, but reloads pan/zoom state) —
// fine at this app's scale; a postMessage-based marker diff would be the next step if that matters.
function buildMapHtml(center: KakaoMapProps['center'], markers: KakaoMapProps['markers'], appKey: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false"></script>
  <script>
    kakao.maps.load(function () {
      var map = new kakao.maps.Map(document.getElementById('map'), {
        center: new kakao.maps.LatLng(${center.latitude}, ${center.longitude}),
        level: 6,
      });
      var markers = ${JSON.stringify(markers)};
      markers.forEach(function (m) {
        var marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(m.latitude, m.longitude),
          map: map,
          title: m.label,
        });
        kakao.maps.event.addListener(marker, 'click', function () {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerPress', id: m.id }));
        });
      });
    });
  </script>
</body>
</html>`;
}

export function KakaoMap({ center, markers, onMarkerPress, style }: KakaoMapProps) {
  const appKey = KAKAO_MAP_JS_KEY || KAKAO_MAP_NATIVE_KEY;
  const html = useMemo(
    () => buildMapHtml(center, markers, appKey),
    [center, markers, appKey]
  );

  if (!appKey) {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Text className="px-6 text-center text-sm text-neutral-500">카카오맵 API 키가 설정되지 않았어요</Text>
      </View>
    );
  }

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerPress' && typeof data.id === 'string') onMarkerPress(data.id);
    } catch {
      // Ignore malformed bridge messages.
    }
  };

  return <WebView source={{ html }} style={[{ flex: 1 }, style]} onMessage={handleMessage} />;
}
