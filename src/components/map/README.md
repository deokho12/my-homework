# KakaoMap

Platform-split component, resolved automatically by Metro's bundler:

- `KakaoMap.web.tsx` — web build. Loads the Kakao Maps JavaScript SDK into the page and renders a real
  `kakao.maps.Map` inside a plain DOM node.
- `KakaoMap.tsx` — native (iOS/Android) fallback. No mature RN Kakao Maps library exists, so this wraps
  `react-native-webview` and loads a small HTML page that pulls in the same JS SDK. It re-renders the
  whole page on every marker/center change (no incremental update), which is fine for this app's scale
  but would need a postMessage-based diffing bridge for something with frequently moving markers.

Both read their app key from `src/config/kakaoMap.ts` (`EXPO_PUBLIC_KAKAO_MAP_JS_KEY`). The native file
also accepts `EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY` as a fallback, reserved for if this ever moves to a real
native Kakao Maps SDK instead of the WebView shim — the JS SDK key is what's actually used today.

Register your app's origin (including `http://localhost:<port>` for local dev) in the Kakao Developers
console under the JavaScript key's allowed domains, or the web map will fail to load.
