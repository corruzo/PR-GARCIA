import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const homepage = read('../index.html');
const schemaScripts = [...homepage.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
const schema = JSON.parse(schemaScripts[0][1]);
const webApplication = schema['@graph'].find((item) => item['@type'] === 'WebApplication');
const faqPage = schema['@graph'].find((item) => item['@type'] === 'FAQPage');

test('the welcome page has server-delivered content and one H1', () => {
  assert.match(homepage, /<html lang="es-VE">/);
  assert.match(homepage, /<h1[^>]*>Simula préstamos en dólares y bolívares<\/h1>/);
  assert.equal([...homepage.matchAll(/<h1(?:\s|>)/g)].length, 1);
  assert.match(homepage, /Cómo funciona/);
  assert.match(homepage, /Por qué consultar una referencia BCV/);
  assert.match(homepage, /Para quién es/);
  assert.match(homepage, /Crear una cuenta/);
});

test('visible FAQs match FAQPage JSON-LD without a price offer', () => {
  assert.equal(schemaScripts.length, 1);
  assert.equal(webApplication.applicationCategory, 'FinanceApplication');
  assert.equal(webApplication.inLanguage, 'es');
  assert.equal(webApplication.url, 'https://prgarcia.app/');
  assert.equal(webApplication.image, 'https://prgarcia.app/og-image.png');
  assert.equal(Object.hasOwn(webApplication, 'offers'), false);
  assert.ok(faqPage.mainEntity.length >= 6);

  for (const item of faqPage.mainEntity) {
    assert.ok(homepage.includes(item.name), `Missing visible question: ${item.name}`);
    assert.ok(homepage.includes(item.acceptedAnswer.text), `Missing visible answer: ${item.name}`);
  }
});

test('the sitemap lists only the welcome and public legal pages', () => {
  const sitemap = read('../public/sitemap.xml');
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

  assert.deepEqual(locations, [
    'https://prgarcia.app/',
    'https://prgarcia.app/terminos',
    'https://prgarcia.app/privacidad',
    'https://prgarcia.app/aviso-legal',
  ]);
  assert.match(read('../public/robots.txt'), /Allow: \/[\s\S]*Sitemap: https:\/\/prgarcia\.app\/sitemap\.xml/);
});

test('unknown routes have a noindex 404 and Vercel has no SPA catch-all', () => {
  const notFound = read('../public/404.html');
  const vercel = JSON.parse(read('../vercel.json'));

  assert.match(notFound, /name="robots" content="noindex,follow"/);
  assert.match(notFound, /<h1>No encontramos esa página<\/h1>/);
  assert.match(notFound, /href="\/"/);
  assert.equal(vercel.rewrites.some((rewrite) => rewrite.source.includes('(?!api/).*)')), false);
});

test('legal placeholders stay out of search results until the next phase', () => {
  for (const page of ['terminos.html', 'privacidad.html', 'aviso-legal.html']) {
    assert.match(read(`../public/${page}`), /name="robots" content="noindex,follow"/);
  }
});

test('public HTML pages have distinct titles, descriptions, and canonical URLs', () => {
  const pages = [
    ['welcome', homepage],
    ['terms', read('../public/terminos.html')],
    ['privacy', read('../public/privacidad.html')],
    ['legal notice', read('../public/aviso-legal.html')],
    ['404', read('../public/404.html')],
  ];
  const titles = pages.map(([, html]) => html.match(/<title>(.*?)<\/title>/)?.[1]);
  const canonicals = pages.slice(1).map(([, html]) => html.match(/<link rel="canonical" href="(.*?)"/u)?.[1]);

  assert.ok(pages.every(([, html]) => /<meta name="description" content="[^"]+"/.test(html)));
  assert.equal(new Set(titles).size, pages.length);
  assert.equal(new Set(canonicals).size, canonicals.length);
  assert.match(homepage, /<link rel="canonical" href="https:\/\/prgarcia\.app\/"/);
});