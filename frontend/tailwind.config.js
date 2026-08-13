/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      /*
       * 앱이 쓰는 브레이크포인트는 xs / md / lg 셋뿐이고, 이 표가 유일한 기준이다.
       * 화면마다 흩어져 있던 480/768/900/1024 을 여기로 모았다 (900 은 md 로 흡수).
       *
       *   xs 480  큰 폰      — 카드 그리드 2→3열
       *   md 768  태블릿     — 하단탭 → 상단바 전환 (구 WIDE_WEB_BREAKPOINT)
       *   lg 1024 데스크톱   — 최대 열 수
       *
       * 기본 스크린은 그대로 두고 xs 만 얹는다. Tailwind 가 미디어쿼리를 폭 오름차순으로
       * 정렬하므로, 기본값보다 작은 480 을 뒤늦게 추가해도 md/lg 를 덮지 않는다.
       */
      screens: {
        xs: '480px',
      },
      maxWidth: {
        // 본문 최대폭. App.tsx 와 TopNavBar 에 각각 박혀 있던 1200 을 한 곳으로 모았다.
        content: '1200px',
      },
      colors: {
        brand: {
          50: '#eefcf9',
          100: '#d4f6ef',
          200: '#abecdf',
          300: '#79dccb',
          400: '#45c4b0',
          500: '#22a696',
          600: '#17847a',
          700: '#166863',
          800: '#16534f',
          900: '#154543',
        },
      },
    },
  },
  plugins: [],
};
