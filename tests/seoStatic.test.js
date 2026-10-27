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
  assert.match(homepage, /<h1[^>]*>Tus préstamos y cobros en dólares y bolívares, en orden\.<\/h1>/);
  assert.equal([...homepage.matchAll(/<h1(?:\s|>)/g)].length, 1);
  assert.match(homepage, /Todo lo que necesitas para prestar con orden/);
  assert.match(homepage, /Cómo funciona/);
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

  const welcome = read('../src/components/WelcomeHome.jsx');
  for (const item of faqPage.mainEntity) {
    assert.ok(homepage.includes(item.name), `Missing visible question: ${item.name}`);
    assert.ok(homepage.includes(item.acceptedAnswer.text), `Missing visible answer: ${item.name}`);
    assert.ok(welcome.includes(item.name), `Question missing in WelcomeHome: ${item.name}`);
    assert.ok(welcome.includes(item.acceptedAnswer.text), `Answer missing in WelcomeHome: ${item.name}`);
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

test('legal pages have real content, stay noindex, and safe-area aware', () => {
  for (const page of ['terminos.html', 'privacidad.html', 'aviso-legal.html']) {
    const html = read(`../public/${page}`);
    assert.match(html, /name="robots" content="noindex,follow"/);
    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /href="\/legal\.css"/);
    assert.doesNotMatch(html, /próxima fase|pendiente de revisión/);
    assert.match(html, /Última actualización/);
    // El correo se inserta al compilar (vite.config.js) solo con este marcador exacto.
    for (const placeholder of html.match(/\{\{[^}]*\}\}/g) ?? []) assert.equal(placeholder, '{{EMAIL_CONTACTO}}');
  }
  assert.match(read('../public/legal.css'), /env\(safe-area-inset-top\)/);
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

test('the interactive welcome uses approved informational copy and reserves TM for that page', () => {
  const welcome = read('../src/components/WelcomeHome.jsx');
  const app = read('../src/App.jsx');

  assert.match(welcome, /PRGARCÍA™/);
  assert.match(welcome, /no está afiliada al Banco Central de Venezuela/);
  assert.match(welcome, /Tus préstamos y cobros en dólares y bolívares, en orden\./);
  assert.doesNotMatch(welcome, /Protección cambiaria garantizada/);
  assert.doesNotMatch(app, /PRGARCÍA™/);
  assert.doesNotMatch(welcome, /PRGARCÍA®/);
});