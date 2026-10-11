export const BCV_CACHE_KEY = 'prgarcia.bcv.v2.cache';

export const BCV_ENDPOINTS = [
  {
    nombre: 'BCV oficial',
    url: '/api/bcv',
    parsear: (payload) => {
      if (!payload) return 0;
      if (typeof payload === 'object') {
        return Number(payload.value || payload.tasa || payload.promedio || 0);
      }
      if (typeof payload === 'string') {
        const match = payload.match(/<div[^>]*id=['"]dolar['"][^>]*>[\s\S]*?<strong[^>]*>(.*?)<\/strong>/i);
        const raw = match?.[1]?.replace(/[^0-9,.-]/g, '').replace(',', '.');
        return Number(raw || 0);
      }
      return 0;
    },
  },
  {
    nombre: 'open.er-api.com (referencial)',
    url: 'https://open.er-api.com/v6/latest/USD',
    parsear: (payload) => {
      if (!payload) return 0;
      if (typeof payload === 'object' && payload.rates) {
        return Number(payload.rates.VES || 0);
      }
      return 0;
    },
  },
  {
    nombre: 'DolarApi Venezuela',
    url: 'https://ve.dolarapi.com/v1/dolares/oficial',
    parsear: (payload) => {
      if (!payload) return 0;
      if (typeof payload === 'object') {
        return Number(payload.promedio || payload.price || payload.tasa || 0);
      }
      return 0;
    },
  },
];

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getCachedBCV() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(BCV_CACHE_KEY);
  const parsed = safeJsonParse(raw);
  if (!parsed || !parsed.rate || parsed.rate <= 0) return null;
  return {
    rate: Number(parsed.rate),
    fetchedAt: parsed.fetchedAt || new Date(0).toISOString(),
    source: parsed.source || 'cache',
    stale: Boolean(parsed.stale),
    verifiedAgainstBCV: Boolean(parsed.verifiedAgainstBCV),
    changed: Boolean(parsed.changed),
  };
}

export function saveBCVCache(rate, source, stale = false, fetchedAt = null, verifiedAgainstBCV = false, changed = false) {
  if (typeof window === 'undefined' || !rate || rate <= 0) return null;
  const payload = {
    rate: Number(rate),
    fetchedAt: fetchedAt || new Date().toISOString(),
    source,
    stale: Boolean(stale),
    verifiedAgainstBCV: Boolean(verifiedAgainstBCV),
    changed: Boolean(changed),
  };
  localStorage.setItem(BCV_CACHE_KEY, JSON.stringify(payload));
  return payload;
}

export async function fetchBCVRate() {
  const tasks = BCV_ENDPOINTS.map(async (endpoint) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpoint.url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeout);

      if (!res || !res.ok) {
        return null;
      }

      const contentType = res.headers.get('content-type') || '';
      const raw = contentType.includes('application/json') ? await res.json() : await res.text();
      const valor = Number(endpoint.parsear(raw));

      if (valor > 0) {
        return {
          ok: true,
          tasa: valor,
          fuente: raw?.source || endpoint.nombre,
          cached: Boolean(raw?.stale),
          stale: Boolean(raw?.stale),
          verifiedAgainstBCV: Boolean(raw?.verifiedAgainstBCV),
          changed: Boolean(raw?.changed),
          fetchedAt: raw?.fetchedAt || null,
        };
      }

      return null;
    } catch {
      return null;
    }
  });

  const results = await Promise.all(tasks);
  const firstOk = results.find(Boolean);

  if (firstOk) {
    return firstOk;
  }

  return { ok: false, error: 'No se pudo obtener la tasa BCV.' };
}

export function formatRateString(val) {
  if (!val || isNaN(val)) return '';
  const num = Number(val);
  const str = num.toString();
  const parts = str.split('.');
  if (parts.length === 1) return num.toFixed(2);
  if (parts[1].length < 2) return num.toFixed(2);
  return str;
}
