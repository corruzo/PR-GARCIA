/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      colors: {
        brand: {
          esmeralda: '#10B981',
          profundo: '#047857',
          tinta: '#0B1F3A',
          menta: '#ECFDF5',
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        primary: {
          DEFAULT: '#10b981',
          dark: '#059669',
          light: '#34d399',
        },
        gain: {
          500: '#10b981',
          600: '#059669',
        },
        surface: {
          light: '#f8fafc',
          dark:  '#0f172a',
          cardLight: '#ffffff',
          cardDark: '#1e293b',
        },
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'saas': '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        'saas-hover': '0 10px 25px -3px rgba(16, 185, 129, 0.12)',
        'saas-modal': '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
