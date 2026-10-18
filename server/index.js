/**
 * API local de desarrollo: sirve las mismas funciones de api/ que Vercel
 * (una sola implementación). Vite reenvía /api a este puerto.
 *
 * Variables (opcionales, en el entorno o .env.local): SUPABASE_URL y
 * SUPABASE_SERVICE_ROLE_KEY para guardar y leer la tasa en Supabase. Sin
 * ellas, /api/bcv consulta la tasa en vivo sin guardarla y /api/bcv/latest
 * responde que el servicio no está disponible.
 */
import { createServer } from 'node:http';
import bcvHandler from '../api/bcv.js';
import latestHandler from '../api/bcv/latest.js';

const port = Number(process.env.API_PORT || 8787);
const routes = { '/api/bcv': bcvHandler, '/api/bcv/latest': latestHandler };

/** Adapta la respuesta de Node al estilo de Vercel (res.status().json()). */
function vercelResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

createServer(async (req, res) => {
  const handler = routes[new URL(req.url, 'http://localhost').pathname];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
    return;
  }
  try {
    await handler(req, vercelResponse(res));
  } catch {
    if (!res.headersSent) vercelResponse(res).status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
}).listen(port, () => {
  console.log(`API local en http://localhost:${port} (mismas funciones que Vercel)`);
});
