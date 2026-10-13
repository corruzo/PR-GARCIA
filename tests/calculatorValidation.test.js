import assert from 'node:assert/strict';
import test from 'node:test';
import {
  convertirMoneda,
  formatearMoneda,
  generarCronograma,
  simularPrestamo,
} from '../src/utils/calculator.js';

const validLoan = {
  monto: 100,
  moneda: 'USD',
  tasa: 7,
  modalidadTasa: 'quincenal',
  fechaInicio: '2026-01-01',
  fechaFin: '2026-01-16',
  frecuenciaPago: 'quincenal',
  tasaBCV: 100,
};

function dateAfterDays(startDate, days) {
  const date = new Date(`${startDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeLoan(overrides = {}) {
  return { ...validLoan, ...overrides };
}

test('loan inputs reject non-finite or out-of-range numbers', () => {
  assert.equal(simularPrestamo({ ...validLoan, monto: Number.POSITIVE_INFINITY }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, monto: Number.MAX_SAFE_INTEGER + 1 }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, tasa: Number.NaN }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, tasaBCV: Number.POSITIVE_INFINITY }).valido, false);
});

test('loan due date must be later than issue date', () => {
  assert.equal(simularPrestamo({ ...validLoan, fechaFin: validLoan.fechaInicio }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, fechaFin: '2025-12-31' }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, fechaInicio: 'fecha-inválida' }).valido, false);
});

test('date calculations use actual elapsed days across leap day', () => {
  const resultado = simularPrestamo(makeLoan({
    fechaInicio: '2024-02-28',
    fechaFin: '2024-03-01',
    modalidadTasa: 'diaria',
  }));

  assert.equal(resultado.valido, true);
  assert.equal(resultado.diasTotales, 2);
});

test('simple interest applies the same 10% to one matching period in every modality', () => {
  const periods = [
    ['diaria', 1],
    ['semanal', 7],
    ['quincenal', 15],
    ['mensual', 30],
  ];

  for (const [modalidadTasa, days] of periods) {
    const resultado = simularPrestamo(makeLoan({
      monto: 1000,
      tasa: 10,
      modalidadTasa,
      fechaFin: dateAfterDays(validLoan.fechaInicio, days),
    }));

    assert.equal(resultado.valido, true);
    assert.ok(Math.abs(resultado.interes - 100) < 1e-9, `${modalidadTasa}: expected 100 interest`);
  }
});

test('payment schedules support daily, weekly, fortnightly, and monthly frequencies', () => {
  const frequencies = [
    ['diario', 31],
    ['semanal', 5],
    ['quincenal', 3],
    ['mensual', 2],
  ];

  for (const [frecuenciaPago, expectedCount] of frequencies) {
    const resultado = simularPrestamo(makeLoan({
      monto: 120,
      tasa: 15,
      modalidadTasa: 'quincenal',
      fechaFin: dateAfterDays(validLoan.fechaInicio, 31),
      frecuenciaPago,
    }));
    const schedule = generarCronograma(resultado);

    assert.equal(schedule.length, expectedCount, frecuenciaPago);
    assert.ok(Math.abs(schedule.reduce((sum, payment) => sum + payment.capital, 0) - 120) < 0.01);
    assert.ok(Math.abs(schedule.reduce((sum, payment) => sum + payment.interes, 0) - resultado.interes) < 0.01);
    assert.equal(schedule.at(-1).saldo, 0);
  }
});

test('VES loans convert totals to USD and USD loans convert totals to VES', () => {
  const vesLoan = simularPrestamo(makeLoan({
    monto: 100000,
    moneda: 'VES',
    tasa: 10,
    modalidadTasa: 'mensual',
    fechaFin: dateAfterDays(validLoan.fechaInicio, 30),
    tasaBCV: 100,
  }));
  const usdLoan = simularPrestamo(makeLoan({
    monto: 1000,
    moneda: 'USD',
    tasa: 10,
    modalidadTasa: 'mensual',
    fechaFin: dateAfterDays(validLoan.fechaInicio, 30),
    tasaBCV: 100,
  }));

  assert.equal(vesLoan.valido, true);
  assert.equal(vesLoan.totalPagar, 110000);
  assert.equal(vesLoan.totalAlterna, 1100);
  assert.equal(usdLoan.valido, true);
  assert.equal(usdLoan.totalPagar, 1100);
  assert.equal(usdLoan.totalAlterna, 110000);
  assert.equal(convertirMoneda(1100, 100, 'USD', 'VES'), 110000);
  assert.equal(convertirMoneda(110000, 100, 'VES', 'USD'), 1100);
});

test('schedule rounds capital to cents and assigns the remainder to the last payment', () => {
  const resultado = simularPrestamo(makeLoan({
    monto: 100.01,
    tasa: 0.000001,
    modalidadTasa: 'diaria',
    fechaFin: dateAfterDays(validLoan.fechaInicio, 3),
    frecuenciaPago: 'diario',
  }));
  const schedule = generarCronograma(resultado);

  assert.deepEqual(schedule.map((payment) => payment.capital), [33.34, 33.34, 33.33]);
  assert.match(formatearMoneda(schedule[0].capital, 'USD'), /33[,.]34/);
});

test('zero amount and zero rate are rejected', () => {
  assert.equal(simularPrestamo(makeLoan({ monto: 0 })).valido, false);
  assert.equal(simularPrestamo(makeLoan({ tasa: 0 })).valido, false);
});

test('weekly schedule dates start after the issue date and end on the due date', () => {
  const resultado = simularPrestamo(makeLoan({
    fechaInicio: '2026-01-01',
    fechaFin: '2026-02-01',
    modalidadTasa: 'semanal',
    frecuenciaPago: 'semanal',
  }));
  const schedule = generarCronograma(resultado);

  assert.deepEqual(schedule.map((payment) => payment.fecha), [
    '08/01/2026', '15/01/2026', '22/01/2026', '29/01/2026', '01/02/2026',
  ]);
});
test('open loans (no end date) quote the interest of each period on the principal', () => {
  const r = simularPrestamo({
    monto: 1000, moneda: 'USD', tasa: 8, modalidadTasa: 'semanal', fechaInicio: '2026-01-05',
    fechaFin: '', frecuenciaPago: 'semanal', tasaBCV: 40, tipoPlazo: 'abierto',
  });
  assert.equal(r.valido, true);
  assert.equal(r.abierto, true);
  assert.equal(r.interesPeriodo, 80);
  assert.equal(r.primerVencimiento, '2026-01-12');
  assert.deepEqual(generarCronograma(r), []);
  assert.equal(simularPrestamo({ ...r, monto: 0, tipoPlazo: 'abierto' }).valido, false);
});

test('the calculator works without an exchange rate (no equivalences)', () => {
  const r = simularPrestamo({ ...validLoan, tasaBCV: undefined });
  assert.equal(r.valido, true);
  assert.equal(r.totalAlterna, null);
  assert.equal(generarCronograma(r)[0].totalAlterna, null);
  assert.equal(simularPrestamo({ ...validLoan, tasaBCV: -1 }).valido, false);
});
