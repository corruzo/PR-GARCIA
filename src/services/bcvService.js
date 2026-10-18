/**
 * Tasa BCV desde la API propia (/api/bcv). El servidor es el único que habla
 * con el BCV y los proveedores referenciales: el navegador no llama a
 * terceros (menos superficie de ataque y una sola lógica de validación).
 */
export const BCV_CACHE_KEY = 'prgarcia.bcv.v2.cache';

const ENDPOINTS = ['/api/bcv', '/api/bcv/latest'];
const TIMEOUT_MS = 8000;

function safeJsonParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento (ventana privada): la app sigue sin caché.
  }
}

export function getCachedBCV() {
  if (typeof window === 'undefined') return null;
  const parsed = safeJsonParse(readStorage(BCV_CACHE_KEY));
  if (!parsed || !(Number(parsed.rate) > 0)) return null;
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
  if (typeof window === 'undefined' || !(Number(rate) > 0)) return null;
  const payload = {
    rate: Number(rate),
    fetchedAt: fetchedAt || new Date().toISOString(),
    source,
    stale: Boolean(stale),
    verifiedAgainstBCV: Boolean(verifiedAgainstBCV),
    changed: Boolean(changed),
  };
  writeStorage(BCV_CACHE_KEY, JSON.stringify(payload));
  return payload;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Consulta /api/bcv y, si falla, la última tasa guardada (/api/bcv/latest). */
export async function fetchBCVRate() {
  for (const url of ENDPOINTS) {
    const payload = await fetchJson(url);
    const valor = Number(payload?.value);
    if (payload?.ok && valor > 0) {
      return {
        ok: true,
        tasa: valor,
        fuente: payload.source || 'BCV',
        cached: Boolean(payload.stale) || url.endsWith('/latest'),
        stale: Boolean(payload.stale) || url.endsWith('/latest'),
        verifiedAgainstBCV: Boolean(payload.verifiedAgainstBCV),
        changed: Boolean(payload.changed),
        fetchedAt: payload.fetchedAt || null,
      };
    }
  }
  return { ok: false, error: 'No se pudo obtener la tasa BCV.' };
}

export function formatRateString(val) {
  const num = Number(val);
  if (!num || Number.isNaN(num)) return '';
  const [, dec = ''] = String(num).split('.');
  return dec.length < 2 ? num.toFixed(2) : String(num);
}
