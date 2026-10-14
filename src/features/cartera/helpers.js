/** Constantes y utilidades de la interfaz de cartera (sin componentes). */

export const SITUACION = {
  pagada: { label: 'Pagada', tone: 'green' },
  vencida: { label: 'Vencida', tone: 'red' },
  vence_hoy: { label: 'Vence hoy', tone: 'amber' },
  por_vencer: { label: 'Por vencer', tone: 'blue' },
  al_dia: { label: 'Al día', tone: 'gray' },
  anulada: { label: 'Anulada', tone: 'gray' },
};

export const ESTADO_PRESTAMO = {
  activo: { label: 'Activo', tone: 'blue' },
  pagado: { label: 'Pagado', tone: 'green' },
  anulado: { label: 'Anulado', tone: 'gray' },
};

export function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function newIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? null;
}

/** Desvío relativo máximo de la tasa de cambio frente a la BCV sin pedir confirmación (igual que el servidor). */
export const MAX_DESVIO_TASA = 0.2;

/** Desvío relativo (0,25 = 25 %) de una tasa frente a la de referencia; null si no hay referencia. */
export function desvioTasa(tasa, referencia) {
  if (!tasa || !referencia || referencia <= 0) return null;
  return Math.abs(tasa - referencia) / referencia;
}

/** Una tasa de referencia sirve si tiene menos de `maxHoras` horas. */
export function tasaVigente(fechaISO, maxHoras = 24, now = Date.now()) {
  const t = Date.parse(fechaISO || '');
  return Number.isFinite(t) && now - t <= maxHoras * 3600 * 1000;
}

/** ¿La tasa requiere confirmación? Mismo criterio que el servidor (20 %, referencia oficial de ≤ 15 días). */
export function requiereConfirmarTasa(tasa, referencia) {
  if (!referencia?.oficial || !tasaVigente(referencia.fecha, 15 * 24)) return false;
  const desvio = desvioTasa(tasa, referencia.tasa);
  return desvio !== null && desvio > MAX_DESVIO_TASA;
}

/** Texto de la tasa de referencia para precargar un formulario (solo si tiene ≤ 48 h). */
export function tasaInicial(referencia) {
  return referencia && tasaVigente(referencia.fecha, 48) ? String(referencia.tasa).replace('.', ',') : '';
}
