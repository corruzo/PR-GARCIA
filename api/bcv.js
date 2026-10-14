import { createInMemoryRateLimiter, isReasonableBCVRate, shouldPersistBCVRate } from '../shared/bcvPolicy.js';
import { getSupabaseClient } from './_lib/db.js';

const CACHE_HEADERS = 's-maxage=120, stale-while-revalidate=300';
const RATE_LIMIT_HEADERS = 'no-store';
const UPSTREAM_TIMEOUT_MS = 8000;
const allowBCVRequest = createInMemoryRateLimiter();

async function fetchRate(url, source, readValue, signal, accept = 'application/json', official = false) {
  const response = await fetch(url, {
    headers: { Accept: accept },
    signal,
  });
  if (!response.ok) throw new Error('upstream response was not successful');

  const payload = accept === 'text/html' ? await response.text() : await response.json();
  const rate = Number(readValue(payload));
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('upstream rate is invalid');
  return { value: rate, source, official };
}

function extractBCVRate(html) {
  const match = html.match(/id=['"]dolar['"][^>]*>[\s\S]*?<strong[^>]*>(.*?)<\/strong>/i)
    || html.match(/(?:>\s*USD\s*<|\bUSD\b)[\s\S]{0,240}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]+)/i);
  const raw = match?.[1]?.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return Number(raw);
}

async function fetchCurrentRate(signal) {
  const strategies = [
    // Primero las fuentes que publican la tasa oficial del BCV; luego proveedores referenciales.
    () => fetchRate('https://ve.dolarapi.com/v1/dolares/oficial', 'dolarapi.com (BCV Oficial)', data => data?.promedio, signal, 'application/json', true),
    () => fetchRate('https://www.bcv.org.ve/', 'BCV oficial', extractBCVRate, signal, 'text/html', true),
    () => fetchRate('https://open.er-api.com/v6/latest/USD', 'open.er-api.com (referencial)', data => data?.rates?.VES, signal),
    () => fetchRate('https://api.exchangerate-api.com/v4/latest/USD', 'exchangerate-api.com (referencial)', data => data?.rates?.VES, signal),
  ];

  for (const strategy of strategies) {
    try {
      return await strategy();
    } catch {
      // Try the next upstream without exposing provider errors to clients.
    }
  }

  throw new Error('upstream unavailable');
}

// `officialOnly`: solo tasas publicadas por el BCV (estado 'ok'); las de
// proveedores referenciales se guardan con estado 'referencial'.
async function readLatestRate(supabase, { officialOnly = false } = {}) {
  let query = supabase
    .from('tasa_bcv')
    .select('tasa,fuente,fecha_hora,estado');
  if (officialOnly) query = query.eq('estado', 'ok');
  const { data, error } = await query
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    value: Number(data.tasa),
    source: data.fuente,
    fetchedAt: data.fecha_hora,
    official: data.estado === 'ok',
  };
}

async function persistRate(supabase, rate, source, official) {
  const { data, error } = await supabase
    .from('tasa_bcv')
    .insert({ tasa: rate, fuente: source, estado: official ? 'ok' : 'referencial' })
    .select('tasa,fuente,fecha_hora')
    .single();

  if (error) throw error;
  return {
    value: Number(data.tasa),
    source: data.fuente,
    fetchedAt: data.fecha_hora,
  };
}

function getClientIp(req) {
  const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'];
  return String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function sendStale(res, latest) {
  if (!latest) {
    return res.status(503).json({ ok: false, error: 'No se pudo obtener una tasa BCV disponible.' });
  }

  return res.status(200).json({
    ok: true,
    value: latest.value,
    source: latest.source,
    fetchedAt: latest.fetchedAt,
    stale: true,
    verifiedAgainstBCV: Boolean(latest.official),
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', CACHE_HEADERS);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', RATE_LIMIT_HEADERS);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!allowBCVRequest(getClientIp(req))) {
    res.setHeader('Cache-Control', RATE_LIMIT_HEADERS);
    res.setHeader('Retry-After', '300');
    return res.status(429).json({ ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' });
  }

  const supabase = getSupabaseClient();
  let latest = null;
  let latestOfficial = null;
  let storageReadable = false;

  if (supabase) {
    try {
      [latest, latestOfficial] = await Promise.all([
        readLatestRate(supabase),
        readLatestRate(supabase, { officialOnly: true }),
      ]);
      storageReadable = true;
    } catch {
      console.warn('[BCV] No se pudo consultar la tasa guardada.');
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let current;

  try {
    current = await fetchCurrentRate(controller.signal);
  } catch {
    return sendStale(res, latestOfficial ?? latest);
  } finally {
    clearTimeout(timeout);
  }

  // El salto máximo se mide contra la última tasa oficial guardada.
  if (!isReasonableBCVRate(current.value, latestOfficial?.value ?? latest?.value)) {
    console.warn('[BCV] Se rechazó una variación de tasa fuera del rango permitido.');
    return sendStale(res, latestOfficial ?? latest);
  }

  const previous = current.official ? latestOfficial : latest;
  if (supabase && storageReadable && shouldPersistBCVRate(previous, current.value)) {
    try {
      latest = await persistRate(supabase, current.value, current.source, current.official);
    } catch {
      console.warn('[BCV] No se pudo persistir la tasa consultada.');
    }
  }

  return res.status(200).json({
    ok: true,
    value: current.value,
    source: current.source,
    fetchedAt: new Date().toISOString(),
    verifiedAgainstBCV: current.official,
  });
}
