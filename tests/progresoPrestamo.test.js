import assert from 'node:assert/strict';
import test from 'node:test';
import { conteoCuotas, progresoPrestamo, proximaCuota } from '../src/features/prestamos/progreso.js';

const base = {
  estado: 'activo', tipo_plazo: 'fijo', fecha_inicio: '2026-01-01', fecha_fin: '2026-04-01',
  capital_cents: 120000, capital_pendiente_cents: 80000, interes_pendiente_cents: 6000, mora_pendiente_cents: 500,
  cobrado_cents: 49500,
};
const cuotas = [
  { numero: 1, fecha_vencimiento: '2026-01-31', situacion: 'pagada', capital_pendiente_cents: 0, interes_pendiente_cents: 0, mora_pendiente_cents: 0 },
  { numero: 2, fecha_vencimiento: '2026-03-02', situacion: 'vencida', capital_pendiente_cents: 40000, interes_pendiente_cents: 3000, mora_pendiente_cents: 500 },
  { numero: 3, fecha_vencimiento: '2026-04-01', situacion: 'al_dia', capital_pendiente_cents: 40000, interes_pendiente_cents: 3000, mora_pendiente_cents: 0 },
];

test('progress of a fixed loan: collected, principal returned and elapsed term', () => {
  const r = progresoPrestamo(base, cuotas, '2026-03-12');
  assert.equal(r.pendienteCents, 86500);
  assert.equal(Math.round(r.cobradoPct), 36);
  assert.equal(r.capitalDevueltoCents, 40000);
  assert.equal(Math.round(r.capitalDevueltoPct), 33);
  assert.deepEqual(r.plazo, { dias: 90, transcurridos: 70, restantes: 20, pct: (70 / 90) * 100 });
});

test('the next unpaid installment can be overdue (negative days)', () => {
  assert.deepEqual(proximaCuota(cuotas, '2026-03-12'), { numero: 2, fecha: '2026-03-02', dias: -10, montoCents: 43500 });
  assert.equal(proximaCuota([cuotas[0]], '2026-03-12'), null);
});

test('installments are grouped for the legend', () => {
  assert.deepEqual(conteoCuotas(cuotas), { pagada: 1, vencida: 1, proxima: 0, pendiente: 1 });
});

test('an open loan has no end date; the term past the end is capped at 100 %', () => {
  const abierto = progresoPrestamo({ ...base, tipo_plazo: 'abierto', fecha_fin: null }, [], '2026-02-01');
  assert.deepEqual(abierto.plazo, { abierto: true, transcurridos: 31 });
  const vencido = progresoPrestamo(base, cuotas, '2026-05-01');
  assert.equal(vencido.plazo.pct, 100);
  assert.equal(vencido.plazo.restantes, -30);
});
