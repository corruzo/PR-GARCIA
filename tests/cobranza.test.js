import assert from 'node:assert/strict';
import test from 'node:test';
import { agendaCobranza, iniciales, resumenPorCliente } from '../shared/finance/cobranza.js';

const prestamo = (id, extra = {}) => ({
  id, cliente_id: `c-${id}`, moneda: 'USD', estado: 'activo', capital_pendiente_cents: 0,
  interes_pendiente_cents: 0, mora_pendiente_cents: 0, cuotas_vencidas: 0, dias_atraso: 0, ...extra,
});
const cuota = (prestamoId, situacion, cents, extra = {}) => ({
  prestamo_id: prestamoId, situacion, capital_pendiente_cents: cents, interes_pendiente_cents: 0,
  mora_pendiente_cents: 0, dias_atraso: 0, fecha_vencimiento: '2026-10-20', ...extra,
});

test('collection agenda groups by loan and prioritizes the most overdue', () => {
  const prestamos = [prestamo('a'), prestamo('b'), prestamo('c'), prestamo('d', { moneda: 'VES' }), prestamo('x', { estado: 'pagado' })];
  const cuotas = [
    cuota('a', 'vencida', 1000, { dias_atraso: 3, mora_pendiente_cents: 50 }),
    cuota('a', 'vencida', 1000, { dias_atraso: 10 }),
    cuota('a', 'por_vencer', 500),
    cuota('a', 'vence_hoy', 100),
    cuota('b', 'vencida', 300, { dias_atraso: 20 }),
    cuota('c', 'vence_hoy', 700),
    cuota('d', 'por_vencer', 9000, { fecha_vencimiento: '2026-10-18' }),
    cuota('x', 'vencida', 999, { dias_atraso: 99 }),
  ];
  const agenda = agendaCobranza(prestamos, cuotas);
  assert.deepEqual(agenda.atrasados.map((i) => i.prestamo.id), ['b', 'a']);
  assert.equal(agenda.atrasados[1].atrasadoCents, 2050);
  assert.equal(agenda.atrasados[1].hoyCents, 100);
  assert.equal(agenda.atrasados[1].diasAtraso, 10);
  assert.deepEqual(agenda.hoy.map((i) => i.prestamo.id), ['c']);
  assert.deepEqual(agenda.semana.map((i) => i.prestamo.id), ['d']);
  // El atraso incluye lo que vence hoy a clientes atrasados; «hoy» solo a los demás.
  assert.deepEqual(agenda.totales.USD, { atrasadoCents: 2450, hoyCents: 700, semanaCents: 500, prestamosAtrasados: 2 });
  assert.equal(agenda.conVencimientoSemana, 2);
  assert.equal(agenda.totales.VES.semanaCents, 9000);
});

test('client summary adds active balances per currency and flags arrears', () => {
  const r = resumenPorCliente([
    prestamo('a', { cliente_id: 'ana', capital_pendiente_cents: 1000, interes_pendiente_cents: 80 }),
    prestamo('b', { cliente_id: 'ana', moneda: 'VES', capital_pendiente_cents: 5000, cuotas_vencidas: 1, dias_atraso: 4 }),
    prestamo('c', { cliente_id: 'ana', estado: 'pagado', capital_pendiente_cents: 999 }),
  ]).get('ana');
  assert.deepEqual(r, { activos: 2, saldo: { USD: 1080, VES: 5000 }, diasAtraso: 4, enMora: true });
  assert.equal(iniciales('María  Pérez Gómez'), 'MP');
  assert.equal(iniciales(''), '?');
});
