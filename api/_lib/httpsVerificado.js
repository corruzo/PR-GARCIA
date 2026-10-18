/**
 * GET por HTTPS sin desactivar nunca la verificación del certificado.
 *
 * Algunos sitios (como www.bcv.org.ve) envían solo su certificado y omiten
 * el intermedio. Los navegadores lo resuelven descargando el intermedio desde
 * la dirección «CA Issuers» del propio certificado (AIA); Node no lo hace y
 * falla con UNABLE_TO_VERIFY_LEAF_SIGNATURE. Aquí se hace lo mismo que el
 * navegador, con una condición: el intermedio descargado solo se usa si su
 * firma se verifica contra una raíz de confianza de Node. La petición real
 * se hace siempre con verificación completa (cadena y nombre del host).
 */
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { X509Certificate } from 'node:crypto';

const ERRORES_DE_CADENA = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_NIVELES = 3;

/** Intermedios ya verificados, por host (duran lo que viva la función). */
const intermediosPorHost = new Map();

function descargar(url, { ca, signal, timeoutMs, headers = {}, redirecciones = 2, verificar = true }) {
  const destino = new URL(url);
  const cliente = destino.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const req = cliente.get(destino, {
      ca: destino.protocol === 'https:' ? ca : undefined,
      rejectUnauthorized: verificar,
      signal,
      timeout: timeoutMs,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRGARCIA/1.0)', ...headers },
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirecciones > 0) {
        res.resume();
        const siguiente = new URL(res.headers.location, destino);
        // Solo se siguen redirecciones dentro del mismo dominio y nunca a http si se pidió https.
        if (siguiente.hostname.replace(/^www\./, '') !== destino.hostname.replace(/^www\./, '')
          || (destino.protocol === 'https:' && siguiente.protocol !== 'https:')) {
          reject(new Error('redirección no permitida'));
          return;
        }
        descargar(siguiente.href, { ca, signal, timeoutMs, headers, redirecciones: redirecciones - 1, verificar }).then(resolve, reject);
        return;
      }
      const partes = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_BYTES) { req.destroy(new Error('respuesta demasiado grande')); return; }
        partes.push(chunk);
      });
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(partes) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('tiempo de espera agotado')));
    req.on('error', reject);
  });
}

/** Certificados de la cadena que presenta el servidor (solo para leer su AIA; no se envía ni acepta ningún dato). */
function certificadoDelServidor(hostname, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false, timeout: timeoutMs }, () => {
      const cert = socket.getPeerCertificate(true);
      socket.end();
      resolve(cert);
    });
    socket.on('timeout', () => socket.destroy(new Error('tiempo de espera agotado')));
    socket.on('error', reject);
  });
}

function urlEmisor(info) {
  const uri = info?.['CA Issuers - URI'];
  const lista = Array.isArray(uri) ? uri : uri ? [uri] : [];
  return lista.find((u) => /^https?:\/\//i.test(u)) ?? null;
}

/** ¿`cert` está firmado por alguno de `emisores`? Devuelve el emisor o null. */
function emisorQueFirma(cert, emisores) {
  return emisores.find((e) => cert.checkIssued(e) && cert.verify(e.publicKey)) ?? null;
}

/**
 * Descarga los intermedios que faltan siguiendo AIA y los devuelve en PEM
 * solo si forman una cadena firmada hasta una raíz de `raicesPem`.
 */
async function intermediosVerificados(url, { raicesPem, timeoutMs, signal }) {
  const { hostname, port } = new URL(url);
  const peer = await certificadoDelServidor(hostname, Number(port) || 443, timeoutMs);
  const raices = raicesPem.map((pem) => new X509Certificate(pem));
  const cadena = [];
  let actual = new X509Certificate(peer.raw);
  let aia = urlEmisor(peer.infoAccess);

  for (let nivel = 0; nivel < MAX_NIVELES; nivel += 1) {
    if (emisorQueFirma(actual, raices)) return cadena.map((c) => c.toString());
    if (!aia) break;
    const { status, body } = await descargar(aia, { signal, timeoutMs });
    if (status !== 200) break;
    const intermedio = new X509Certificate(body);
    if (!intermedio.ca || !actual.checkIssued(intermedio) || !actual.verify(intermedio.publicKey)) {
      throw new Error('el intermedio descargado no firma el certificado del servidor');
    }
    cadena.push(intermedio);
    actual = intermedio;
    aia = urlEmisor(intermedio.infoAccess?.split('\n').reduce((acc, linea) => {
      const [clave, ...valor] = linea.split(':');
      if (clave && valor.length) acc[clave.trim()] = valor.join(':').trim();
      return acc;
    }, {}));
  }
  throw new Error('no se pudo completar la cadena hasta una raíz de confianza');
}

/**
 * Descarga `url` como texto con verificación TLS completa. Si el servidor
 * omite su certificado intermedio, lo completa por AIA (verificado).
 * @param {object} [opciones]
 * @param {string[]} [opciones.raices] Raíces de confianza en PEM (por defecto, las de Node).
 */
export async function obtenerTexto(url, { signal, timeoutMs = 7000, headers, raices = tls.rootCertificates } = {}) {
  const { hostname } = new URL(url);
  const conocidos = intermediosPorHost.get(hostname) ?? [];
  const ca = [...raices, ...conocidos];
  try {
    const { status, body } = await descargar(url, { ca, signal, timeoutMs, headers });
    return { status, texto: body.toString('utf8') };
  } catch (error) {
    if (!ERRORES_DE_CADENA.has(error?.code)) throw error;
    const intermedios = await intermediosVerificados(url, { raicesPem: raices, timeoutMs, signal });
    intermediosPorHost.set(hostname, intermedios);
    const { status, body } = await descargar(url, { ca: [...raices, ...intermedios], signal, timeoutMs, headers });
    return { status, texto: body.toString('utf8') };
  }
}

/** Solo para pruebas: olvida los intermedios aprendidos. */
export function _olvidarIntermedios() {
  intermediosPorHost.clear();
}
