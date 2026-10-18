import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const headers = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));
const csp = headers['Content-Security-Policy'];

test('production security headers are present', () => {
  for (const key of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) {
    assert.ok(headers[key], `falta ${key}`);
  }
});

test('CSP only allows own scripts and the Supabase API', () => {
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  const connect = csp.match(/connect-src ([^;]+)/)[1].trim().split(/\s+/);
  assert.deepEqual(connect.sort(), ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'].sort(),
    'el navegador no debe conectarse a terceros: la tasa BCV llega por /api/bcv');
});

test('the browser never embeds the service role key', () => {
  const fuentes = ['src/utils/supabase/client.js', 'src/features/cartera/api.js', 'src/services/bcvService.js'];
  for (const f of fuentes) {
    assert.doesNotMatch(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'), /SERVICE_ROLE/, f);
  }
});
