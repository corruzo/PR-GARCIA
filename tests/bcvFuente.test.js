import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { after, before, test } from 'node:test';
import { extraerTasaBCV, numeroBCV } from '../api/_lib/bcvPagina.js';
import { _olvidarIntermedios, obtenerTexto } from '../api/_lib/httpsVerificado.js';
import { fetchCurrentRate } from '../api/bcv.js';

const fixture = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url));

test('reads the USD rate and value date from the BCV front page (not EUR or CNY)', () => {
  assert.deepEqual(extraerTasaBCV(fixture('bcv-portada.html').toString()), { tasa: 216.4725, fechaValor: '2026-10-20' });
});

test('BCV number format is parsed strictly', () => {
  assert.equal(numeroBCV(' 216,47250000 '), 216.4725);
  assert.equal(numeroBCV('1.216,47'), 1216.47);
  for (const malo of ['216.47', 'abc', '', '216,', ',5', '1.21,5', '-5,00']) assert.equal(numeroBCV(malo), null, malo);
});

test('a page without the USD box is rejected', () => {
  assert.equal(extraerTasaBCV('<div id="euro"><span>EUR</span><strong>251,3</strong></div>'), null);
  assert.equal(extraerTasaBCV('<div id="dolar"><span>USD</span><strong>sin dato</strong></div>'), null);
});

test('the BCV page is the official source; other providers are only referential fallbacks', async () => {
  const bcv = async () => ({ value: 216.47, source: 'BCV oficial (bcv.org.ve)', official: true });
  const otra = async () => ({ value: 230, source: 'dolarapi.com (referencial)', official: false });
  const falla = async () => { throw new Error('caído'); };
  assert.deepEqual(await fetchCurrentRate(undefined, [bcv, otra]), { value: 216.47, source: 'BCV oficial (bcv.org.ve)', official: true });
  assert.equal((await fetchCurrentRate(undefined, [falla, otra])).official, false);
  await assert.rejects(fetchCurrentRate(undefined, [falla, falla]), /upstream unavailable/);
});

// ── TLS: servidor que omite su certificado intermedio (como www.bcv.org.ve) ──
const raiz = fixture('tls/raiz.pem').toString();
let intermedioServido = fixture('tls/intermedio.der');
let https;
let aia;
let url;

before(async () => {
  aia = createHttpServer((req, res) => { res.writeHead(200, { 'Content-Type': 'application/pkix-cert' }); res.end(intermedioServido); });
  await new Promise((r) => aia.listen(47811, '127.0.0.1', r));
  https = createHttpsServer({ key: fixture('tls/servidor.key'), cert: fixture('tls/servidor.pem') }, (req, res) => res.end('hola BCV'));
  await new Promise((r) => https.listen(0, '127.0.0.1', r));
  url = `https://localhost:${https.address().port}/`;
});
after(() => { https?.close(); aia?.close(); });

test('a server that omits its intermediate is completed through AIA with full verification', async () => {
  _olvidarIntermedios();
  intermedioServido = fixture('tls/intermedio.der');
  const { status, texto } = await obtenerTexto(url, { raices: [raiz], timeoutMs: 3000 });
  assert.equal(status, 200);
  assert.equal(texto, 'hola BCV');
});

test('a downloaded intermediate that does not chain to a trusted root is rejected', async () => {
  _olvidarIntermedios();
  intermedioServido = fixture('tls/intermedio-falso.der');
  await assert.rejects(obtenerTexto(url, { raices: [raiz], timeoutMs: 3000 }), /no firma|raíz de confianza/);
});

test('without the right root the certificate is never accepted', async () => {
  _olvidarIntermedios();
  intermedioServido = fixture('tls/intermedio.der');
  await assert.rejects(obtenerTexto(url, { timeoutMs: 3000 }));
});
