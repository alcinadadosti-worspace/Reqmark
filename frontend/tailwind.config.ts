import type { Config } from 'tailwindcss';

/**
 * Tokens da identidade AM Marketing (secao 5 da especificacao).
 * O tema e escuro fixo — nao ha variante clara.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        onyx: {
          950: '#0B0B0D', // base
          900: '#121216', // superficie
          800: '#1A1A20', // elevado
          700: '#24242C', // borda neutra / hover
          600: '#33333D',
        },
        gold: {
          300: '#F3D28C',
          400: '#E2B96F',
          500: '#CEA15C', // principal
          600: '#B8894A',
          700: '#A5793D',
          800: '#7E5C2C',
        },
        ivory: '#F5F1EA',
        muted: '#A8A39A',
        status: {
          pending: '#CEA15C',
          approved: '#34D399',
          rejected: '#F43F5E',
          cancelled: '#71717A',
          returned: '#60A5FA',
        },
      },
      borderColor: {
        gold: 'rgba(206, 161, 92, 0.18)',
        'gold-strong': 'rgba(206, 161, 92, 0.38)',
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #F3D28C 0%, #CEA15C 45%, #A5793D 100%)',
        'brand-gradient-soft':
          'linear-gradient(135deg, rgba(243,210,140,0.16) 0%, rgba(206,161,92,0.10) 45%, rgba(165,121,61,0.06) 100%)',
        'onyx-fade': 'linear-gradient(180deg, rgba(11,11,13,0) 0%, #0B0B0D 82%)',
      },
      boxShadow: {
        glass: '0 1px 0 0 rgba(243,210,140,0.10) inset, 0 18px 40px -24px rgba(0,0,0,0.9)',
        'glass-lg': '0 1px 0 0 rgba(243,210,140,0.14) inset, 0 32px 70px -32px rgba(0,0,0,0.95)',
        gold: '0 0 0 1px rgba(206,161,92,0.30), 0 12px 32px -12px rgba(206,161,92,0.35)',
        'gold-glow': '0 0 28px -6px rgba(226,185,111,0.45)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        dock: '5.5rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        'gold-sweep': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'fade-up': 'fade-up 320ms cubic-bezier(0.22, 1, 0.36, 1) both',
        shake: 'shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'gold-sweep': 'gold-sweep 3.5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
