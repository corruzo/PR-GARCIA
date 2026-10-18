/**
 * Catálogos de la app: valores válidos (iguales a los CHECK de la base de
 * datos) y sus textos en español. Única fuente para formularios, listas,
 * mensajes y reportes; no repetir estos mapas en los componentes.
 */

export const METODOS_PAGO = Object.freeze({
  efectivo: 'Efectivo',
  pago_movil: 'Pago móvil',
  transferencia: 'Transferencia',
  zelle: 'Zelle',
  otro: 'Otro',
});

/** Frecuencia de pago (diario, semanal…). */
export const FRECUENCIAS = Object.freeze({ diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' });
/** «Intereses por semana». */
export const PERIODO = Object.freeze({ diario: 'día', semanal: 'semana', quincenal: 'quincena', mensual: 'mes' });
/** «Cobro semanal». */
export const FRECUENCIA_ADJETIVO = Object.freeze({ diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' });
/** «3 cuotas semanales». */
export const FRECUENCIA_PLURAL = Object.freeze({ diario: 'diarias', semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' });

/** Período de la tasa de interés (8 % semanal). */
export const MODALIDADES_TASA = Object.freeze({ diaria: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' });

export const METODOS_INTERES = Object.freeze({
  saldo_insoluto: 'Sobre saldo pendiente',
  interes_fijo: 'Fijo sobre capital inicial',
});

export const TIPOS_PLAZO = Object.freeze({ abierto: 'Sin fecha de fin', fijo: 'Con fecha de fin' });

/** { clave: texto } → [{ value, label }] para selects y controles segmentados. */
export function opciones(catalogo) {
  return Object.entries(catalogo).map(([value, label]) => ({ value, label }));
}
