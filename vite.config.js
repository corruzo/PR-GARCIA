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
      includeAssets: [
        'favicon.svg', 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png',
        'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
        'sitemap.xml', 'robots.txt',
      ],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        globIgnores: ['**/icon-192.svg', '**/icon-512.svg'],
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
