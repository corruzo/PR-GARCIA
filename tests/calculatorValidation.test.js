import assert from 'node:assert/strict';
import test from 'node:test';
import { simularPrestamo } from '../src/utils/calculator.js';

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

test('loan inputs reject non-finite or out-of-range numbers', () => {
  assert.equal(simularPrestamo({ ...validLoan, monto: Number.POSITIVE_INFINITY }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, monto: Number.MAX_SAFE_INTEGER + 1 }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, tasa: Number.NaN }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, tasaBCV: Number.POSITIVE_INFINITY }).valido, false);
});

test('loan due date must be later than issue date', () => {
  assert.equal(simularPrestamo({ ...validLoan, fechaFin: validLoan.fechaInicio }).valido, false);
  assert.equal(simularPrestamo({ ...validLoan, fechaFin: '2025-12-31' }).valido, false);
});