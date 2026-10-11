/** @type {import('tailwindcss').Config} */
// Identidad PRGARCÍA: azul marino institucional + oro. Ver docs/MARCA.md.
const marino = {
  50: '#F0F5FB',
  100: '#DCE7F5',
  200: '#B9CFEA',
  300: '#8CB0DB',
  400: '#5A88C6',
  500: '#3467AE',
  600: '#1F4F93',
  700: '#163E78',
  800: '#112F5C',
  900: '#0B2140',
  950: '#06142A',
};

const oro = {
  50: '#FBF7E9',
  100: '#F5EBC6',
  200: '#EEDC97',
  300: '#E9CF7A',
  400: '#DDB94A',
  500: '#C9A227',
  600: '#A8851A',
  700: '#7F6413',
  800: '#5C480E',
  900: '#3D3009',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'Arial', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: marino,
        oro,
        // Verde sobrio solo para estados positivos (pagado, cobrado).
        gain: { 500: '#2F9E7A', 600: '#1F7A5C' },
        surface: {
          light: '#F3F5F8',
          dark: '#071426',
          cardLight: '#FFFFFF',
          cardDark: '#0D1E36',
        },
      },
      borderRadius: {
        // Formas más sobrias, de estilo bancario.
        lg: '0.375rem',
        xl: '0.5rem',
        '2xl': '0.625rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(11, 33, 64, 0.06)',
        saas: '0 4px 16px -4px rgba(11, 33, 64, 0.10)',
        'saas-hover': '0 8px 20px -6px rgba(22, 62, 120, 0.25)',
        'saas-modal': '0 25px 50px -12px rgba(6, 20, 42, 0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
