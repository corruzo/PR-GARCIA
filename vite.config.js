import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg', 'sitemap.xml', 'robots.txt'],
      manifest: {
        name: 'PRGARCÍA · Calculadora de Préstamos',
        short_name: 'PRGARCÍA',
        description: 'Calculadora de préstamos e intereses simple y compuesta en Venezuela con tasa BCV en tiempo real.',
        theme_color: '#10B981',
        background_color: '#0F172A',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin, url }) => {
              if (request.mode === 'navigate') return true;
              if (!sameOrigin) return false;
              return url.pathname.includes('/assets/') || url.pathname.includes('/src/') || request.destination === 'script' || request.destination === 'style';
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-cache',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|webp|gif|ico|json)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https?:\/\/(ve\.dolarapi\.com|open\.er-api\.com|pydolarve\.org|api\.exchangedna\.com)\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bcv-rate-cache',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
