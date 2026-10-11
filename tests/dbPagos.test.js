import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase, dropTestDatabase, psql, skipDb } from './helpers/pg.js';

const ANA = '11111111-1111-1111-1111-111111111111';
const BETO = '22222222-2222-2222-2222-222222222222';
let db;
let docSeq = 30000000;

before(() => {
  if (skipDb) return;
  db = createTestDatabase();
  psql(db, `insert into auth.users (id) values ('${ANA}'), ('${BETO}');`);
});
after(() => { if (db) dropTestDatabase(db); });

function nuevoPrestamo(overrides = {}) {
  const p = {
    moneda: 'USD', capital: 100000, tasa: 10, modalidad: 'quincenal', frecuencia: 'quincenal',
    metodo: 'interes_fijo', inicio: '2026-01-01', fin: '2026-02-07', tasaCambio: 40, mora: 1, gracia: 0, ...overrides,
  };
  docSeq += 1;
  const cliente = psql(db, asUser(ANA, `insert into public.clientes (tipo_documento, numero_documento, nombre) values ('V', '${docSeq}', 'Cliente ${docSeq}') returning id;`));
  return psql(db, asUser(ANA, `select public.emitir_prestamo('${cliente}', '${p.moneda}', ${p.capital}, ${p.tasa}, '${p.modalidad}',
    '${p.frecuencia}', '${p.metodo}', '${p.inicio}', '${p.fin}', ${p.tasaCambio}, 'BCV', ${p.mora}, ${p.gracia});`, { today: '2026-01-01' }));
}

function pagar(prestamo, { fecha, moneda = 'USD', monto, tasa = 40, tipo = 'cuota', modo = 'reducir_plazo', hoy = fecha, key = null, user = ANA }) {
  return psql(db, asUser(user, `select public.registrar_pago('${prestamo}', '${fecha}', '${moneda}', ${monto}, ${tasa}, '${tipo}', '${modo}', 'efectivo', null, null, ${key ? `'${key}'` : 'null'});`, { today: hoy }));
}

function cuotas(prestamo) {
  return psql(db, `select json_agg(json_build_object('n', numero, 'cap', capital_pagado_cents, 'int', interes_pagado_cents,
    'desc', interes_descontado_cents, 'moraDev', mora_devengada_cents, 'moraPag', mora_pagada_cents, 'estado', estado) order by numero)
    from public.cuotas where prestamo_id = '${prestamo}';`, { json: true });
}

function ledgerBalance(prestamo) {
  return psql(db, `select json_object_agg(cuenta, saldo) from (select cuenta, sum(debe_cents) - sum(haber_cents) as saldo
    from public.asiento_lineas l join public.asientos a on a.id = l.asiento_id where a.prestamo_id = '${prestamo}' group by cuenta) s;`, { json: true });
}

test('on-time payment applies interest before capital and settles the installment', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  pagar(id, { fecha: '2026-01-16', monto: 43334 });
  const [c1, c2] = cuotas(id);
  assert.deepEqual([c1.int, c1.cap, c1.estado], [10000, 33334, 'pagada']);
  assert.equal(c2.estado, 'pendiente');
  assert.deepEqual(ledgerBalance(id), { caja: -100000 + 43334, cartera_capital: 100000 - 33334, ingreso_interes: -10000 });
});

test('partial payment covers interest first and leaves the installment partial', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  pagar(id, { fecha: '2026-01-10', monto: 12000 });
  const [c1] = cuotas(id);
  assert.deepEqual([c1.int, c1.cap, c1.estado], [10000, 2000, 'parcial']);
});

test('VES payment is converted with the payment-day rate', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  pagar(id, { fecha: '2026-01-16', moneda: 'VES', monto: 1733360, tasa: 40 }); // 43334 USD cents
  assert.equal(cuotas(id)[0].estado, 'pagada');
  const pago = psql(db, `select json_build_array(moneda_pago, monto_pago_cents, monto_prestamo_cents) from public.pagos where prestamo_id = '${id}';`, { json: true });
  assert.deepEqual(pago, ['VES', 1733360, 43334]);
  const caja = psql(db, `select json_build_array(moneda_original, monto_original_cents, debe_cents) from public.asiento_lineas l join public.asientos a on a.id = l.asiento_id where a.prestamo_id = '${id}' and a.tipo = 'cobro' and cuenta = 'caja';`, { json: true });
  assert.deepEqual(caja, ['VES', 1733360, 43334]);
});

test('late payment accrues daily default interest after the grace period and pays it first', { skip: skipDb }, () => {
  const id = nuevoPrestamo({ gracia: 2 });
  // Cuota 1 vence 2026-01-16; con 2 días de gracia la mora corre desde el 18: 5 días × 1 % × 43334.
  const mora = Math.round(43334 * 0.01 * 5);
  const vista = psql(db, asUser(ANA, `select json_build_array(dias_atraso, mora_pendiente_cents, situacion) from public.v_cuotas_estado where prestamo_id = '${id}' and numero = 1;`, { today: '2026-01-23' }), { json: true });
  assert.deepEqual(vista, [7, mora, 'vencida']);
  pagar(id, { fecha: '2026-01-23', monto: 43334 + mora });
  const [c1] = cuotas(id);
  assert.deepEqual([c1.moraDev, c1.moraPag, c1.int, c1.cap, c1.estado], [mora, mora, 10000, 33334, 'pagada']);
  assert.equal(ledgerBalance(id).ingreso_mora, -mora);
});

test('mora stops growing once overdue principal and interest are paid', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  pagar(id, { fecha: '2026-01-20', monto: 43334 }); // cubre la mora de 4 días primero, deja capital pendiente
  const [c1] = cuotas(id);
  assert.equal(c1.moraPag, c1.moraDev);
  assert.ok(c1.cap < 33334);
  const before = psql(db, asUser(ANA, `select mora_pendiente_cents from public.v_cuotas_estado where prestamo_id = '${id}' and numero = 1;`, { today: '2026-01-20' }));
  assert.equal(before, '0');
  const later = Number(psql(db, asUser(ANA, `select mora_pendiente_cents from public.v_cuotas_estado where prestamo_id = '${id}' and numero = 1;`, { today: '2026-01-30' })));
  assert.equal(later, Math.round((33334 - c1.cap) * 0.01 * 10));
});

test('paying the whole balance closes the loan; overpayment is rejected atomically', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  assert.throws(() => pagar(id, { fecha: '2026-01-05', monto: 124668 }), /excede el saldo pendiente por 1 centavos/);
  assert.equal(psql(db, `select count(*) from public.pagos where prestamo_id = '${id}';`), '0');
  pagar(id, { fecha: '2026-01-05', monto: 124667 });
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'pagado');
  assert.throws(() => pagar(id, { fecha: '2026-01-06', monto: 1 }), /no está activo/);
});

test('capital prepayment can shorten the term or lower every installment', { skip: skipDb }, () => {
  const plazo = nuevoPrestamo();
  pagar(plazo, { fecha: '2026-01-05', monto: 40000, tipo: 'abono_capital', modo: 'reducir_plazo' });
  assert.deepEqual(cuotas(plazo).map((c) => c.cap), [0, 6667, 33333]);
  assert.equal(cuotas(plazo)[2].estado, 'parcial'); // aún debe el interés pactado

  const cuota = nuevoPrestamo();
  pagar(cuota, { fecha: '2026-01-05', monto: 30000, tipo: 'abono_capital', modo: 'reducir_cuota' });
  assert.deepEqual(cuotas(cuota).map((c) => c.cap), [10000, 10000, 10000]);
});

test('declining-balance loans discount future interest after a capital prepayment', { skip: skipDb }, () => {
  const id = nuevoPrestamo({ metodo: 'saldo_insoluto' });
  // Intereses originales: [10000, 6667, 1556]. Abono de 50 000 el día 16 tras pagar la cuota 1.
  pagar(id, { fecha: '2026-01-16', monto: 43334 + 50000, tipo: 'abono_capital', modo: 'reducir_cuota' });
  const cs = cuotas(id);
  assert.equal(cs[0].estado, 'pagada');
  const saldo = 100000 - 33334 - 50000; // 16666
  const esperado2 = Math.round(saldo * 0.10 * 15 / 15);
  assert.equal(6667 - cs[1].desc, esperado2);
  assert.ok(cs[2].desc > 0);
});

test('payments must be chronological, not future, and are idempotent', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  pagar(id, { fecha: '2026-01-10', monto: 1000 });
  assert.throws(() => pagar(id, { fecha: '2026-01-09', monto: 1000 }), /orden cronológico/);
  assert.throws(() => pagar(id, { fecha: '2026-01-20', monto: 1000, hoy: '2026-01-15' }), /futura/);
  const key = '44444444-4444-4444-4444-444444444444';
  const a = pagar(id, { fecha: '2026-01-11', monto: 1000, key });
  const b = pagar(id, { fecha: '2026-01-11', monto: 1000, key });
  assert.equal(a, b);
  assert.equal(psql(db, `select count(*) from public.pagos where prestamo_id = '${id}';`), '2');
});

test('voiding the last payment restores balances and posts a mirror ledger entry', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  const first = pagar(id, { fecha: '2026-01-16', monto: 43334 });
  const before = cuotas(id);
  const second = pagar(id, { fecha: '2026-01-25', monto: 124667 - 43334 });
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'pagado');
  assert.throws(() => psql(db, asUser(ANA, `select public.anular_pago('${first}', 'x');`, { today: '2026-01-25' })), /último pago/);
  psql(db, asUser(ANA, `select public.anular_pago('${second}', 'Transferencia rechazada');`, { today: '2026-01-25' }));
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'activo');
  assert.deepEqual(cuotas(id).map(({ cap, int, moraPag, estado }) => ({ cap, int, moraPag, estado })),
    before.map(({ cap, int, moraPag, estado }) => ({ cap, int, moraPag, estado })));
  assert.deepEqual(ledgerBalance(id), { caja: -100000 + 43334, cartera_capital: 100000 - 33334, ingreso_interes: -10000 });
  assert.throws(() => psql(db, asUser(ANA, `select public.anular_pago('${second}', 'otra vez');`)), /ya está anulado/);
});

test('other users cannot pay, void or read foreign payments', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  const pago = pagar(id, { fecha: '2026-01-10', monto: 1000 });
  assert.throws(() => pagar(id, { fecha: '2026-01-10', monto: 1000, user: BETO }), /Préstamo no encontrado/);
  assert.throws(() => psql(db, asUser(BETO, `select public.anular_pago('${pago}', 'hack');`)), /Pago no encontrado/);
  assert.equal(psql(db, asUser(BETO, `select count(*) from public.pagos;`)), '0');
  assert.equal(psql(db, asUser(BETO, `select count(*) from public.v_prestamos_resumen;`)), '0');
  assert.throws(() => psql(db, asUser(ANA, `select public.fin_devengar_mora('${id}', '2030-01-01');`)), /permission denied/);
});

test('loan summary view aggregates pending balances', { skip: skipDb }, () => {
  const id = nuevoPrestamo();
  pagar(id, { fecha: '2026-01-16', monto: 43334 });
  const r = psql(db, asUser(ANA, `select row_to_json(v) from public.v_prestamos_resumen v where id = '${id}';`, { today: '2026-01-16' }), { json: true });
  assert.equal(r.capital_pendiente_cents, 66666);
  assert.equal(r.interes_pendiente_cents, 14667);
  assert.equal(r.cuotas_pagadas, 1);
  assert.equal(r.proximo_vencimiento, '2026-01-31');
  assert.equal(r.cobrado_cents, 43334);
});
