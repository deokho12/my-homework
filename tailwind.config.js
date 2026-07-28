/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
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
