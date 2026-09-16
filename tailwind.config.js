/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Cambria', 'Georgia', '"Times New Roman"', 'serif'],
      },
      colors: {
        ink: {
          900: '#232C42',
          800: '#333D55',
          700: '#414B62',
          600: '#5A6376',
          500: '#65708C',
          400: '#7A84A0',
          300: '#9AA3BA',
          200: '#CBD2E0',
        },
        surface: {
          bg: '#E4E8F0',
          card: '#ECEFF6',
          card2: '#F6F7FB',
          soft: '#E7EAF2',
          line: '#D9DEE9',
        },
        brand: {
          400: '#3B82F6',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          accent: '#3B5BDB',
        },
        good: '#15803D',
        warn: '#B45309',
        danger: '#DC2626',
      },
      boxShadow: {
        neu: '9px 9px 22px rgba(166,175,195,.5),-9px -9px 22px rgba(255,255,255,.95)',
        'neu-sm': '6px 6px 14px rgba(166,175,195,.45),-6px -6px 14px rgba(255,255,255,.95)',
        'neu-in': 'inset 3px 3px 7px rgba(166,175,195,.5),inset -3px -3px 7px rgba(255,255,255,.95)',
        'neu-in-sm': 'inset 2px 2px 5px rgba(166,175,195,.4),inset -2px -2px 5px rgba(255,255,255,.9)',
        primary: '0 8px 22px rgba(37,99,235,.45)',
      },
      keyframes: {
        fcFloat: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-9px)' },
        },
        fcFade: { from: { opacity: '0' }, to: { opacity: '1' } },
        fcPulse: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.4', transform: 'scale(.78)' },
        },
      },
      animation: {
        fcFloat: 'fcFloat 6.5s ease-in-out infinite',
        fcFade: 'fcFade .25s ease',
        fcPulse: 'fcPulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
