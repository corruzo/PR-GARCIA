import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase, dropTestDatabase, psql, skipDb } from './helpers/pg.js';

const ANA = '11111111-1111-1111-1111-111111111111';
const BETO = '22222222-2222-2222-2222-222222222222';
let db;
let cliente;

before(() => {
  if (skipDb) return;
  db = createTestDatabase();
  psql(db, `insert into auth.users (id) values ('${ANA}'), ('${BETO}');`);
  cliente = psql(db, asUser(ANA, `insert into public.clientes (tipo_documento, numero_documento, nombre, telefono) values ('V', '50000001', 'Pedro Abierto', '04141234567') returning id;`));
});
after(() => { if (db) dropTestDatabase(db); });

// $1.000 al 8 % semanal, cobro semanal, sin fecha de fin, desde el 05/01/2026.
function abrir({ hoy = '2026-01-05', mora = 0, gracia = 0, capital = 100000, moneda = 'USD' } = {}) {
  return psql(db, asUser(ANA, `select public.emitir_prestamo('${cliente}', '${moneda}', ${capital}, 8, 'semanal', 'semanal',
    'interes_fijo', '2026-01-05', null, 40, 'BCV', ${mora}, ${gracia}, null, null, null, 'abierto');`, { today: hoy }));
}
const pagar = (id, fecha, monto, tipo = 'cuota') => psql(db, asUser(ANA,
  `select public.registrar_pago('${id}', '${fecha}', 'USD', ${monto}, 40, '${tipo}');`, { today: fecha }));
const sync = (hoy) => psql(db, asUser(ANA, 'select public.sincronizar_prestamos_abiertos();', { today: hoy }));
const periodos = (id) => psql(db, `select coalesce(json_agg(json_build_array(numero, fecha_vencimiento, interes_cents, interes_pagado_cents, interes_descontado_cents, estado) order by numero), '[]') from public.cuotas where prestamo_id = '${id}';`, { json: true });
const resumen = (id, hoy) => psql(db, asUser(ANA, `select row_to_json(v) from public.v_prestamos_resumen v where id = '${id}';`, { today: hoy }), { json: true });
const cancelacion = (id, fecha) => Number(psql(db, asUser(ANA, `select public.monto_cancelacion('${id}', '${fecha}');`, { today: fecha })));

test('an open loan has no end date, uses declining balance and starts its first interest period', { skip: skipDb }, () => {
  const id = abrir();
  const p = psql(db, `select json_build_array(tipo_plazo, fecha_fin, metodo_interes, interes_total_cents) from public.prestamos where id = '${id}';`, { json: true });
  assert.deepEqual(p, ['abierto', null, 'saldo_insoluto', 0]);
  assert.deepEqual(periodos(id), [[1, '2026-01-12', 8000, 0, 0, 'pendiente']]);
  assert.throws(() => psql(db, asUser(ANA, `select public.emitir_prestamo('${cliente}', 'USD', 100, 8, 'semanal', 'semanal', 'saldo_insoluto', '2026-01-05', '2026-02-05', 40, 'BCV', 0, 0, null, null, null, 'abierto');`, { today: '2026-01-05' })), /no lleva fecha de fin/);
});

test('reading the portfolio generates the periods that have started and shows overdue interest', { skip: skipDb }, () => {
  const id = abrir({ mora: 1 });
  sync('2026-01-20');
  assert.deepEqual(periodos(id).map((c) => c.slice(0, 3)), [[1, '2026-01-12', 8000], [2, '2026-01-19', 8000], [3, '2026-01-26', 8000]]);
  const r = resumen(id, '2026-01-20');
  assert.equal(r.capital_pendiente_cents, 100000);
  assert.equal(r.cuotas_vencidas, 2);
  assert.equal(r.proximo_vencimiento, '2026-01-12');
  // Mora 1 % diario sobre interés vencido: 8 días sobre 80,00 + 1 día sobre 80,00.
  assert.equal(r.mora_pendiente_cents, Math.round(8000 * 0.01 * 8) + Math.round(8000 * 0.01 * 1));
  assert.equal(sync('2026-01-20'), '0', 'sincronizar dos veces no duplica períodos');
});

test('paying only the weekly interest keeps the capital and closes that period', { skip: skipDb }, () => {
  const id = abrir();
  pagar(id, '2026-01-12', 8000);
  const ps = periodos(id);
  assert.deepEqual(ps[0].slice(3), [8000, 0, 'pagada']);
  assert.equal(ps.length, 2, 'el período siguiente ya comenzó');
  assert.equal(resumen(id, '2026-01-12').capital_pendiente_cents, 100000);
});

test('money beyond the due interest goes to capital and stops interest from that day', { skip: skipDb }, () => {
  const id = abrir();
  pagar(id, '2026-01-12', 8000 + 30000); // paga el interés de la semana 1 y abona 300 al capital
  const ps = periodos(id);
  // Período 2 (12→19) se creó con capital 1.000 (8 % = 80,00) y se descuenta el interés de 300 por 7 días = 24,00.
  assert.deepEqual(ps[1].slice(2, 5), [8000, 0, 2400]);
  assert.equal(resumen(id, '2026-01-12').capital_pendiente_cents, 70000);
  sync('2026-01-19');
  assert.equal(periodos(id)[2][2], 5600, 'el período 3 se calcula sobre el nuevo capital (700 × 8 %)');
});

test('a mid-period capital payment discounts only the remaining days', { skip: skipDb }, () => {
  const id = abrir();
  pagar(id, '2026-01-12', 8000);
  pagar(id, '2026-01-15', 50000); // 3 de 7 días transcurridos del período 2
  const p2 = periodos(id)[1];
  assert.equal(p2[4], Math.round(50000 * 0.08 * 4 / 7));
  assert.equal(resumen(id, '2026-01-15').capital_pendiente_cents, 50000);
});

test('the payoff amount closes an open loan charging only interest earned to date', { skip: skipDb }, () => {
  const id = abrir();
  pagar(id, '2026-01-12', 8000);
  const monto = cancelacion(id, '2026-01-16'); // 4 días del período 2 sobre 1.000
  assert.equal(monto, 100000 + (8000 - Math.round(100000 * 0.08 * 3 / 7)));
  assert.throws(() => pagar(id, '2026-01-16', monto + 1), /excede/);
  pagar(id, '2026-01-16', monto);
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'pagado');
  const antes = periodos(id).length;
  sync('2026-03-01');
  assert.equal(periodos(id).length, antes, 'un préstamo pagado no genera más períodos');
});

test('payoff also covers periods not generated yet, with their mora', { skip: skipDb }, () => {
  const id = abrir({ mora: 1, gracia: 2 });
  const monto = cancelacion(id, '2026-01-21'); // períodos 1 y 2 vencidos sin generar el 2, período 3 en curso
  pagar(id, '2026-01-21', monto);
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'pagado');
});

test('voiding a capital payment restores the open balance', { skip: skipDb }, () => {
  const id = abrir();
  const pago = pagar(id, '2026-01-12', 8000 + 20000);
  assert.equal(resumen(id, '2026-01-12').capital_pendiente_cents, 80000);
  assert.throws(() => psql(db, asUser(ANA, `select public.anular_prestamo('${id}', 'x');`, { today: '2026-01-12' })), /pagos aplicados/);
  psql(db, asUser(ANA, `select public.anular_pago('${pago}', 'Error');`, { today: '2026-01-12' }));
  assert.equal(resumen(id, '2026-01-12').capital_pendiente_cents, 100000);
  const p2 = periodos(id)[1];
  assert.equal(p2[4], 0, 'se revierte el descuento de interés');
  psql(db, asUser(ANA, `select public.anular_prestamo('${id}', 'Sin pagos vigentes');`, { today: '2026-01-12' }));
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'anulado');
});

test('fixed-term loans keep working and other users cannot sync foreign loans', { skip: skipDb }, () => {
  const fijo = psql(db, asUser(ANA, `select public.emitir_prestamo('${cliente}', 'USD', 100000, 10, 'quincenal', 'quincenal',
    'interes_fijo', '2026-01-01', '2026-02-07', 40, 'BCV', 0, 0);`, { today: '2026-01-01' }));
  assert.equal(psql(db, `select count(*) from public.cuotas where prestamo_id = '${fijo}';`), '3');
  assert.equal(resumen(fijo, '2026-01-01').tipo_plazo, 'fijo');
  assert.equal(psql(db, asUser(BETO, 'select public.sincronizar_prestamos_abiertos();', { today: '2026-06-01' })), '0');
  assert.throws(() => psql(db, asUser(ANA, `select public.fin_sincronizar_abierto('${fijo}', '2030-01-01');`)), /permission denied/);
});
