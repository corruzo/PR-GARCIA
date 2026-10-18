/**
 * Tasa oficial del dólar publicada en la portada de www.bcv.org.ve.
 *
 * La portada muestra el recuadro:
 *   <div id="dolar"> … <span> USD </span> … <strong> 216,47250000 </strong> …
 * y la fecha valor:
 *   Fecha Valor: <span class="date-display-single" content="2026-10-20T00:00:00-04:00">…
 * El BCV publica por la tarde la tasa que rige desde la «fecha valor».
 */
import { obtenerTexto } from './httpsVerificado.js';

export const URL_BCV = 'https://www.bcv.org.ve/';

/** "216,47250000" o "1.216,47" → 216.4725; null si el formato no es el del BCV. */
export function numeroBCV(texto) {
  const limpio = String(texto ?? '').replace(/\s+/g, '');
  if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{1,8}$/.test(limpio)) return null;
  const valor = Number(limpio.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(valor) && valor > 0 && valor < 1e9 ? valor : null;
}

/**
 * Extrae la tasa USD y la fecha valor del HTML de la portada.
 * @returns {{ tasa: number, fechaValor: string|null } | null}
 */
export function extraerTasaBCV(html) {
  if (typeof html !== 'string') return null;
  const bloque = html.match(/<div[^>]*\bid=["']dolar["'][^>]*>([\s\S]*?)<\/strong>/i);
  if (!bloque || !/\bUSD\b/i.test(bloque[1])) return null;
  const strong = bloque[1].match(/<strong[^>]*>([^<]*)$/i);
  const tasa = numeroBCV(strong?.[1]);
  if (!tasa) return null;
  const fecha = html.match(/Fecha\s+Valor:?[\s\S]{0,200}?content=["'](\d{4}-\d{2}-\d{2})/i);
  return { tasa, fechaValor: fecha?.[1] ?? null };
}

/** Consulta la portada del BCV y devuelve { tasa, fechaValor }. Lanza un error si no se puede leer. */
export async function obtenerTasaBCV({ signal, timeoutMs = 7000 } = {}) {
  const { status, texto } = await obtenerTexto(URL_BCV, { signal, timeoutMs, headers: { Accept: 'text/html' } });
  if (status !== 200) throw new Error(`el BCV respondió ${status}`);
  const resultado = extraerTasaBCV(texto);
  if (!resultado) throw new Error('no se encontró la tasa USD en la página del BCV');
  return resultado;
}
