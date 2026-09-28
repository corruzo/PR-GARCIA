import { createServer } from 'node:http';
import { getLatestBCVRate, saveBCVRate } from './db.js';
import { fetchOfficialBCVRate } from './bcv.js';
import { createInMemoryRateLimiter, isReasonableBCVRate, shouldPersistBCVRate } from '../shared/bcvPolicy.js';

const port = Number(process.env.API_PORT || 8787);
const isProduction = process.env.NODE_ENV === 'production';
const allowBCVRequest = createInMemoryRateLimiter();

if (!isProduction && !getLatestBCVRate()) {
  const developmentRate = Number(process.env.BCV_DEV_RATE || 852.4168);

  if (Number.isFinite(developmentRate) && developmentRate > 0) {
    saveBCVRate({
      rate: developmentRate,
      source: 'BCV local (desarrollo)',
    });
  }
}

function sendJson(response, statusCode, payload, cacheControl = 'no-store') {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
  });
  response.end(JSON.stringify(payload));
}

async function handleBCV(request, response) {
  if (!allowBCVRequest(request.socket.remoteAddress)) {
    response.setHeader('Retry-After', '300');
    sendJson(response, 429, { ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' });
    return;
  }

  try {
    const previous = getLatestBCVRate();
    const { rate, source } = await fetchOfficialBCVRate();
    if (!isReasonableBCVRate(rate, Number(previous?.value))) {
      if (previous) {
        sendJson(response, 200, {
          ok: true,
          value: Number(previous.value),
          source: previous.source,
          fetchedAt: previous.fetchedAt,
          storage: 'sqlite',
          stale: true,
          verifiedAgainstBCV: false,
          changed: false,
        });
        return;
      }
      throw new Error('La tasa recibida no está dentro del rango permitido.');
    }

    const changed = Boolean(previous && Number(previous.value) !== rate);
    const saved = shouldPersistBCVRate(previous, rate)
      ? saveBCVRate({ rate, source })
      : previous;

    sendJson(response, 200, {
      ok: true,
      value: Number(rate),
      source,
      fetchedAt: saved.fetchedAt,
      storage: 'sqlite',
      verifiedAgainstBCV: true,
      changed,
    });
  } catch (error) {
    console.error('[api/bcv]', error.message);
    const latest = getLatestBCVRate();

    if (latest) {
      sendJson(response, 200, {
        ok: true,
        value: Number(latest.value),
        source: latest.source,
        fetchedAt: latest.fetchedAt,
        storage: 'sqlite',
        stale: true,
        verifiedAgainstBCV: false,
        changed: false,
      });
      return;
    }

    sendJson(response, 502, {
      ok: false,
      error: 'No se pudo obtener la tasa oficial del BCV y no hay una tasa local.',
    });
  }
}

function handleLatest(response) {
  const latest = getLatestBCVRate();

  if (!latest) {
    sendJson(response, 404, {
      ok: false,
      error: 'No hay una tasa BCV guardada todavía.',
    });
    return;
  }

  sendJson(response, 200, {
    ok: true,
    value: Number(latest.value),
    source: latest.source,
    fetchedAt: latest.fetchedAt,
    storage: 'sqlite',
  }, 's-maxage=300, stale-while-revalidate=600');
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendJson(response, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (url.pathname === '/api/bcv') {
    await handleBCV(request, response);
    return;
  }

  if (url.pathname === '/api/bcv/latest') {
    handleLatest(response);
    return;
  }

  sendJson(response, 404, { ok: false, error: 'Not found' });
});

server.listen(port, () => {
  console.log(`Local API listening on http://localhost:${port}`);
});
