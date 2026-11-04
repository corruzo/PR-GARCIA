import assert from 'node:assert/strict';
import test from 'node:test';
import { generarCronograma, simularPrestamo } from '../src/utils/calculator.js';
import { buildQuoteMessage } from '../src/utils/quoteMessage.js';
import { parseRateInput } from '../shared/finance/input.js';
import { tasaATexto } from '../src/services/tasaPersonalizada.js';
import { cuotasTexto } from '../shared/catalogos.js';

// Casos de la auditoría de la calculadora (04/11/2026).
const base = {
  monto: 1000, moneda: 'USD', tasa: 8, modalidadTasa: 'semanal', fechaInicio: '2026-01-01',
  fechaFin: '2026-02-01', frecuenciaPago: 'semanal', metodoInteres: 'saldo_insoluto', tipoPlazo: 'fijo',
};

test('equivalences in the other currency add up to the converted installments', () => {
  for (const [monto, tasaBCV] of [[107.13, 36.5], [100, 215.37], [1234.56, 0.987654]]) {
    const r = simularPrestamo({ ...base, monto, tasaBCV, modalidadTasa: 'quincenal', frecuenciaPago: 'quincenal', fechaFin: '2026-03-01' });
    const filas = generarCronograma(r);
    const suma = Math.round(filas.reduce((s, c) => s + Math.round(c.totalAlterna * 100), 0)) / 100;
    assert.equal(r.totalAlterna, suma, `${monto} a ${tasaBCV}`);
  }
});

test('huge or tiny amounts give a clear error instead of crashing', () => {
  const enorme = simularPrestamo({ ...base, moneda: 'VES', monto: 3e9, tasa: 1000, modalidadTasa: 'diaria', metodoInteres: 'interes_fijo', fechaFin: '2035-12-31', frecuenciaPago: 'mensual' });
  assert.equal(enorme.valido, false);
  assert.match(enorme.errores.join(' '), /demasiado grande/);
  const centavo = simularPrestamo({ ...base, monto: 0.01, fechaFin: '2026-12-31' });
  assert.equal(centavo.valido, false);
  assert.match(centavo.errores.join(' '), /muy pequeño/);
});

test('exchange rates accept Venezuelan thousands separators and round-trip without scientific notation', () => {
  assert.equal(parseRateInput('1.234,56'), 1234.56);
  assert.equal(parseRateInput('1.234.567'), 1234567);
  assert.equal(parseRateInput('215,5'), 215.5);
  assert.equal(parseRateInput('215,'), 215);
  assert.equal(parseRateInput('abc'), null);
  for (const tasa of [1e-7, 215.5, 36.12345678]) assert.equal(parseRateInput(tasaATexto(tasa)), tasa);
});

test('a hand-typed unreadable BCV rate is reported instead of silently ignored', () => {
  const r = simularPrestamo({ ...base, tasaBCV: NaN });
  assert.equal(r.valido, false);
  assert.match(r.errores.join(' '), /tasa BCV/);
});

test('installment wording is singular or plural', () => {
  assert.equal(cuotasTexto(1, 'mensual'), '1 cuota mensual');
  assert.equal(cuotasTexto(5, 'semanal'), '5 cuotas semanales');
});

test('long schedules are summarized in the WhatsApp text', () => {
  const r = simularPrestamo({ ...base, frecuenciaPago: 'diario', fechaFin: '2027-08-24' });
  const mensaje = buildQuoteMessage({ resultado: r, cronograma: generarCronograma(r), fechaHoy: '04/11/2026' });
  assert.equal(r.numeroCuotas, 600);
  assert.ok(mensaje.length < 2000, `${mensaje.length} caracteres`);
  assert.match(mensaje, /… 589 cuotas más/);
  assert.match(mensaje, /Cuota 600 \(24\/08\/2027\)/);
  assert.match(mensaje, /600 cuotas diarias/);
});
