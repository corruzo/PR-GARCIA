/**
 * Indicadores visuales de un préstamo (sin React): cuánto se ha cobrado,
 * cuánto capital se devolvió, avance del plazo y próximo vencimiento.
 * `p` es una fila de v_prestamos_resumen y `cuotas` de v_cuotas_estado.
 */
import { daysBetween } from '../../../shared/finance/dates.js';

const pct = (parte, total) => (total > 0 ? Math.min(100, Math.max(0, (parte / total) * 100)) : 0);

export function pendienteTotal(p) {
  return p.capital_pendiente_cents + p.interes_pendiente_cents + p.mora_pendiente_cents;
}

/** Próxima cuota sin pagar: fecha, días que faltan (negativo = vencida) y monto pendiente. */
export function proximaCuota(cuotas = [], hoy) {
  const c = cuotas.find((x) => x.situacion !== 'pagada' && x.situacion !== 'anulada');
  if (!c) return null;
  return {
    numero: c.numero,
    fecha: c.fecha_vencimiento,
    dias: daysBetween(hoy, c.fecha_vencimiento),
    montoCents: c.capital_pendiente_cents + c.interes_pendiente_cents + c.mora_pendiente_cents,
  };
}

/** Cuántas cuotas hay en cada situación (para la leyenda de la línea de cuotas). */
export function conteoCuotas(cuotas = []) {
  const n = { pagada: 0, vencida: 0, proxima: 0, pendiente: 0 };
  for (const c of cuotas) {
    if (c.situacion === 'pagada') n.pagada += 1;
    else if (c.situacion === 'vencida') n.vencida += 1;
    else if (c.situacion === 'vence_hoy' || c.situacion === 'por_vencer') n.proxima += 1;
    else if (c.situacion !== 'anulada') n.pendiente += 1;
  }
  return n;
}

export function progresoPrestamo(p, cuotas, hoy) {
  const pendiente = pendienteTotal(p);
  const capitalDevuelto = p.capital_cents - p.capital_pendiente_cents;
  const resultado = {
    pendienteCents: pendiente,
    cobradoPct: pct(p.cobrado_cents, p.cobrado_cents + pendiente),
    capitalDevueltoCents: capitalDevuelto,
    capitalDevueltoPct: pct(capitalDevuelto, p.capital_cents),
    proxima: p.estado === 'activo' ? proximaCuota(cuotas, hoy) : null,
    conteo: conteoCuotas(cuotas),
    plazo: null,
  };
  if (p.tipo_plazo !== 'abierto' && p.fecha_fin) {
    const dias = daysBetween(p.fecha_inicio, p.fecha_fin);
    const transcurridos = Math.max(0, daysBetween(p.fecha_inicio, hoy));
    resultado.plazo = {
      dias,
      transcurridos: Math.min(transcurridos, dias),
      restantes: daysBetween(hoy, p.fecha_fin),
      pct: pct(transcurridos, dias),
    };
  } else {
    resultado.plazo = { abierto: true, transcurridos: Math.max(0, daysBetween(p.fecha_inicio, hoy)) };
  }
  return resultado;
}
