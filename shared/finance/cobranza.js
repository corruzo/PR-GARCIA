/**
 * cobranza.js — Agenda de cobro y resumen por cliente (funciones puras).
 * Trabaja con filas de v_prestamos_resumen y v_cuotas_estado.
 */

const pendiente = (c) => c.capital_pendiente_cents + c.interes_pendiente_cents + c.mora_pendiente_cents;

function totalVacio() {
  return { atrasadoCents: 0, hoyCents: 0, semanaCents: 0, prestamosAtrasados: 0 };
}

/**
 * Agrupa por préstamo lo que hay que cobrar:
 *   - atrasados: tienen cuotas vencidas (más días de atraso primero)
 *   - hoy: vencen hoy y no tienen atraso
 *   - semana: vencen en los próximos 7 días
 * y suma los totales por moneda.
 */
export function agendaCobranza(prestamos, cuotas) {
  const activos = new Map(prestamos.filter((p) => p.estado === 'activo').map((p) => [p.id, p]));
  const porPrestamo = new Map();

  for (const c of cuotas) {
    const prestamo = activos.get(c.prestamo_id);
    if (!prestamo || !['vencida', 'vence_hoy', 'por_vencer'].includes(c.situacion)) continue;
    const item = porPrestamo.get(c.prestamo_id) ?? {
      prestamo, atrasadoCents: 0, hoyCents: 0, semanaCents: 0, moraCents: 0,
      diasAtraso: 0, proximaFecha: null, cuotasVencidas: 0,
    };
    const monto = pendiente(c);
    if (c.situacion === 'vencida') {
      item.atrasadoCents += monto;
      item.moraCents += c.mora_pendiente_cents;
      item.cuotasVencidas += 1;
      item.diasAtraso = Math.max(item.diasAtraso, c.dias_atraso);
    } else if (c.situacion === 'vence_hoy') {
      item.hoyCents += monto;
    } else {
      item.semanaCents += monto;
      if (!item.proximaFecha || c.fecha_vencimiento < item.proximaFecha) item.proximaFecha = c.fecha_vencimiento;
    }
    porPrestamo.set(c.prestamo_id, item);
  }

  const items = [...porPrestamo.values()];
  const atrasados = items.filter((i) => i.atrasadoCents > 0)
    .sort((a, b) => b.diasAtraso - a.diasAtraso || b.atrasadoCents - a.atrasadoCents);
  const hoy = items.filter((i) => i.atrasadoCents === 0 && i.hoyCents > 0)
    .sort((a, b) => b.hoyCents - a.hoyCents);
  const semana = items.filter((i) => i.atrasadoCents === 0 && i.hoyCents === 0 && i.semanaCents > 0)
    .sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha));

  // Cada total coincide con su lista: el atraso incluye lo que además vence hoy
  // a esos clientes; «hoy» es solo de clientes sin atraso; la semana suma todo
  // lo que vence en los próximos 7 días.
  const totales = {};
  const total = (moneda) => (totales[moneda] ??= totalVacio());
  for (const i of atrasados) {
    total(i.prestamo.moneda).atrasadoCents += i.atrasadoCents + i.hoyCents;
    total(i.prestamo.moneda).prestamosAtrasados += 1;
  }
  for (const i of hoy) total(i.prestamo.moneda).hoyCents += i.hoyCents;
  for (const i of items) if (i.semanaCents > 0) total(i.prestamo.moneda).semanaCents += i.semanaCents;
  const conVencimientoSemana = items.filter((i) => i.semanaCents > 0).length;

  return { atrasados, hoy, semana, totales, conVencimientoSemana };
}

/** Resumen de préstamos activos por cliente: saldo por moneda y atraso. */
export function resumenPorCliente(prestamos) {
  const map = new Map();
  for (const p of prestamos) {
    if (p.estado !== 'activo') continue;
    const r = map.get(p.cliente_id) ?? { activos: 0, saldo: {}, diasAtraso: 0, enMora: false };
    r.activos += 1;
    r.saldo[p.moneda] = (r.saldo[p.moneda] ?? 0) + p.capital_pendiente_cents + p.interes_pendiente_cents + p.mora_pendiente_cents;
    if (p.cuotas_vencidas > 0) {
      r.enMora = true;
      r.diasAtraso = Math.max(r.diasAtraso, p.dias_atraso);
    }
    map.set(p.cliente_id, r);
  }
  return map;
}

/** Iniciales para el avatar del cliente ("María Pérez" → "MP"). */
export function iniciales(nombre) {
  return String(nombre ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('') || '?';
}
