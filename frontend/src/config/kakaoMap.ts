// Populated from EXPO_PUBLIC_KAKAO_MAP_* in .env (see .env.example). Expo inlines EXPO_PUBLIC_ vars
// into the client bundle automatically — no extra config needed beyond restarting the dev server.
export const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY ?? '';
export const KAKAO_MAP_NATIVE_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_NATIVE_KEY ?? '';

// REST API key for server-side-style calls made from the client (Kakao Local address search).
// Falls back to the mock implementation in src/services/geocoding.ts when empty.
export const KAKAO_REST_API_KEY = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY ?? '';
