import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://open.er-api.com https://ve.dolarapi.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    headers: securityHeaders,
  },
  build: {
    sourcemap: false,
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
        globIgnores: ['**/icon-192.svg', '**/icon-512.svg', '**/icon-maskable.svg'],
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
            // Lecturas de la cartera (Supabase REST): con red se piden siempre al
            // servidor; sin red se muestra lo último consultado. La caché se
            // borra al cerrar sesión (AuthContext) para no dejar datos en el equipo.
            urlPattern: ({ request, url, sameOrigin }) => !sameOrigin && request.method === 'GET' && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cartera-cache',
              networkTimeoutSeconds: 6,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 3600 },
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
