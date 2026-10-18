/** Cálculos sobre las cuotas de v_cuotas_estado. */

const exigible = (c) => c.situacion === 'vencida' || c.situacion === 'vence_hoy';

/** Intereses y mora de las cuotas vencidas o que vencen hoy. */
export function interesExigibleCents(cuotas = []) {
  return cuotas.filter(exigible).reduce((s, c) => s + c.interes_pendiente_cents + c.mora_pendiente_cents, 0);
}

/** Interés ya cobrado de períodos que todavía no vencen. */
export function interesAdelantadoCents(cuotas = []) {
  return cuotas.filter((c) => !exigible(c) && c.situacion !== 'anulada').reduce((s, c) => s + c.interes_pagado_cents, 0);
}
