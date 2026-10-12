import assert from 'node:assert/strict';
import test from 'node:test';
import { generarCronograma, simularPrestamo } from '../src/utils/calculator.js';
import { buildQuoteMessage } from '../src/utils/quoteMessage.js';

const base = {
  monto: 1000, tasa: 8, modalidadTasa: 'semanal', frecuenciaPago: 'semanal',
  fechaInicio: '2026-01-05', fechaFin: '2026-01-26', tasaBCV: 40,
};

test('fixed USD quote lists installments only in dollars and the payment rules', () => {
  const resultado = simularPrestamo({ ...base, moneda: 'USD', tipoPlazo: 'fijo' });
  const text = buildQuoteMessage({ resultado, cronograma: generarCronograma(resultado), nombreCliente: 'Ana', fechaHoy: '05/01/2026' });
  assert.match(text, /Hola Ana/);
  assert.match(text, /Cuota 1 \(12\/01\/2026\): \$ /);
  assert.doesNotMatch(text, /Bs\./, 'sin equivalentes en bolívares');
  assert.match(text, /tasa oficial del dólar \(BCV\) vigente el día del pago/);
  assert.match(text, /capital se paga únicamente en dólares/);
  assert.doesNotMatch(text, /Sujeta a verificación|estimad[ao] con/i);
});

test('VES quote allows paying in both currencies', () => {
  const resultado = simularPrestamo({ ...base, monto: 40000, moneda: 'VES', tipoPlazo: 'fijo' });
  const text = buildQuoteMessage({ resultado, cronograma: generarCronograma(resultado), fechaHoy: '05/01/2026' });
  assert.match(text, /Puedes pagar en bolívares o en dólares/);
  assert.doesNotMatch(text, /\$ /, 'los montos van solo en bolívares');
});

test('open-loan quote explains weekly interest and paying capital whenever possible', () => {
  const resultado = simularPrestamo({ ...base, moneda: 'USD', tipoPlazo: 'abierto' });
  const text = buildQuoteMessage({ resultado, nombreCliente: 'Luis', fechaHoy: '05/01/2026' });
  assert.match(text, /Intereses por semana: \$ 80,00 mientras debas \$ 1\.000,00/);
  assert.match(text, /Primer pago de intereses: 12\/01\/2026/);
  assert.match(text, /Sin fecha de fin/);
  assert.match(text, /intereses puedes pagarlos en bolívares/);
});
