// Populated from VITE_KAKAO_* in frontend/.env (see .env.example). Vite inlines VITE_-prefixed
// vars into the client bundle at build time — no extra config needed beyond restarting the dev
// server. Empty values are the supported "no key configured" state: the map surface shows a
// friendly message and address search falls back to its deterministic mock (src/services/geocoding.ts).
export const KAKAO_MAP_JS_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY ?? '';
export const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY ?? '';
