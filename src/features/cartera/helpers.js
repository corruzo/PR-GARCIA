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
