/** @type {import('tailwindcss').Config} */
// Identidad PRGARCÍA: interfaz blanca y limpia con acento vinotinto.
// El color de marca vive en variables CSS (src/index.css → :root) para
// poder ajustarlo en un solo lugar. Ver docs/MARCA.md.
const brandScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
    .map((step) => [step, `rgb(var(--brand-${step}) / <alpha-value>)`]),
);

// Grises neutros (sin tinte azul): claros para el modo claro y
// gris muy oscuro —no negro ni azul— para el modo oscuro.
const neutral = {
  50: '#F7F7F7',
  100: '#F2F2F2',
  200: '#EBEBEB',
  300: '#DDDDDD',
  400: '#A1A1A6',
  500: '#717171',
  600: '#6A6A6A',
  700: '#4A4A4D',
  800: '#3A3A3C',
  900: '#262628',
  950: '#1C1C1E',
};

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Las cifras usan la misma fuente con números tabulares (ver .num en index.css).
        mono: ['Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: brandScale,
        slate: neutral,
        gray: neutral,
        gain: { 500: '#3BA776', 600: '#1F7A54' },
        surface: {
          light: '#FFFFFF',
          dark: '#1C1C1E',
          cardLight: '#FFFFFF',
          cardDark: '#262628',
          muted: '#F7F7F7',
        },
      },
      boxShadow: {
        xs: '0 1px 2px rgba(0, 0, 0, 0.06)',
        card: '0 6px 16px rgba(0, 0, 0, 0.12)',
        saas: '0 6px 16px rgba(0, 0, 0, 0.12)',
        'saas-hover': '0 6px 20px rgba(0, 0, 0, 0.18)',
        'saas-modal': '0 8px 28px rgba(0, 0, 0, 0.28)',
        pill: '0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05)',
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
