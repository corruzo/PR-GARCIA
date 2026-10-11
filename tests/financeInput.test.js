import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAmountInput, parseRateInput, validateCliente } from '../shared/finance/input.js';
import { agingBucket, buildPaymentReminder, centsToCSV, formatCents, toCSV, toWhatsAppNumber } from '../shared/finance/report.js';

test('amount input accepts common Venezuelan and international formats', () => {
  assert.equal(parseAmountInput('1234.56'), 123456);
  assert.equal(parseAmountInput('1234,56'), 123456);
  assert.equal(parseAmountInput('1.234,56'), 123456);
  assert.equal(parseAmountInput('1,234.56'), 123456);
  assert.equal(parseAmountInput('1.234'), 123400);
  assert.equal(parseAmountInput('Bs. 12.345.678,9'), 1234567890);
  assert.equal(parseAmountInput('$ 50'), 5000);
  assert.equal(parseAmountInput('0,5'), 50);
  assert.equal(parseAmountInput('-5'), null);
  assert.equal(parseAmountInput('abc'), null);
  assert.equal(parseAmountInput(''), null);
  assert.equal(parseAmountInput('1e5'), null);
});

test('rate input accepts comma decimals and rejects zero', () => {
  assert.equal(parseRateInput('36,5'), 36.5);
  assert.equal(parseRateInput('852.41680000'), 852.4168);
  assert.equal(parseRateInput('0'), null);
  assert.equal(parseRateInput('1,2,3'), null);
});

test('client validation mirrors database constraints', () => {
  const ok = validateCliente({ tipo_documento: 'v', numero_documento: '12.345.678', nombre: '  Ana   Pérez ', telefono: '0414-1234567' });
  assert.equal(ok.ok, true);
  assert.equal(ok.value.numero_documento, '12345678');
  assert.equal(ok.value.nombre, 'Ana Pérez');
  assert.equal(ok.value.tipo_documento, 'V');
  const bad = validateCliente({ tipo_documento: 'X', numero_documento: '1', nombre: '<b>', telefono: 'abc', email: 'no', limite_credito: 'x', notas: '<script>' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['email', 'limite_credito', 'nombre', 'notas', 'numero_documento', 'telefono', 'tipo_documento']);
});

test('report helpers format, bucket and escape safely', () => {
  assert.match(formatCents(123456, 'VES'), /^Bs\. 1\.234,56$/);
  assert.equal(formatCents(null), '—');
  assert.equal(agingBucket(0), '0_al_dia');
  assert.equal(agingBucket(31), '2_31_60');
  assert.equal(agingBucket(120), '4_mas_90');
  assert.equal(toWhatsAppNumber('0414-123.45.67'), '584141234567');
  assert.equal(toWhatsAppNumber('+58 414 1234567'), '584141234567');
  assert.equal(toWhatsAppNumber(''), null);
  assert.equal(centsToCSV(-123405), '-1234,05');
  const csv = toCSV([{ label: 'Nombre', value: 'n' }, { label: 'Monto', value: 'm' }], [{ n: '=HYPERLINK("x")', m: '-12,50' }, { n: 'Ana; "la jefa"', m: '5' }]);
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[1], `"'=HYPERLINK(""x"")";-12,50`);
  assert.equal(lines[2], '"Ana; ""la jefa""";5');
});

test('payment reminder mentions arrears and default interest', () => {
  const text = buildPaymentReminder({ clienteNombre: 'Ana', numero: 7, moneda: 'USD', exigibleCents: 5000, moraCents: 200, diasAtraso: 3 });
  assert.match(text, /préstamo #7 tiene 3 día\(s\) de atraso/);
  assert.match(text, /incluye \$ 2,00 de mora/);
  const upcoming = buildPaymentReminder({ clienteNombre: 'Ana', numero: 7, moneda: 'VES', exigibleCents: 0, proximoVencimiento: '2026-02-01' });
  assert.match(upcoming, /01\/02\/2026/);
});
