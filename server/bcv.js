function normalizeRate(value) {
  if (!value) return null;

  const normalized = String(value)
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  const rate = Number(normalized);

  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function extractBCVDollarRate(html) {
  if (!html || typeof html !== 'string') return null;

  const dollarMatch = html.match(/<div[^>]*id=['"]dolar['"][^>]*>[\s\S]*?<strong[^>]*>(.*?)<\/strong>/i);
  const officialCardRate = normalizeRate(dollarMatch?.[1]);
  if (officialCardRate) return officialCardRate;

  // Supports the BCV currency table when USD appears before its numeric value.
  const usdRow = html.match(/(?:>\s*USD\s*<|\bUSD\b)[\s\S]{0,240}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]+|[0-9]+(?:[.,][0-9]+))/i);
  return normalizeRate(usdRow?.[1]);
}

export async function fetchOfficialBCVRate() {
  // 1. DolarApi Venezuela (publica la tasa oficial del BCV)
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const val = Number(data?.promedio);
      if (Number.isFinite(val) && val > 0) return { rate: val, source: 'DolarApi (BCV Oficial)', official: true };
    }
  } catch (err) {
    console.warn('[server/bcv] Falló DolarApi:', err.message);
  }

  // 2. Web oficial del BCV
  try {
    const response = await fetch('https://www.bcv.org.ve/', {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; PrestamoCalc/1.0)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const rate = extractBCVDollarRate(await response.text());
      if (rate) return { rate, source: 'BCV Oficial', official: true };
    }
  } catch (err) {
    console.warn('[server/bcv] Falló bcv.org.ve:', err.message);
  }

  // 3. Proveedor internacional: solo referencial, no es la publicación del BCV.
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(6000),
  });
  const data = res.ok ? await res.json() : null;
  const val = Number(data?.rates?.VES);
  if (Number.isFinite(val) && val > 0) return { rate: val, source: 'open.er-api.com (referencial)', official: false };

  throw new Error('No se encontró la tasa USD en ninguna de las fuentes');
}
