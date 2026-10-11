import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase, dropTestDatabase, psql, skipDb } from './helpers/pg.js';
import { convertCents } from '../shared/finance/money.js';

const ANA = '11111111-1111-1111-1111-111111111111';
const BETO = '22222222-2222-2222-2222-222222222222';
let db;
let cliente;

before(() => {
  if (skipDb) return;
  db = createTestDatabase();
  psql(db, `insert into auth.users (id) values ('${ANA}'), ('${BETO}');
    insert into public.tasa_bcv (tasa, fuente) values (50, 'BCV');`);
  cliente = psql(db, asUser(ANA, `insert into public.clientes (tipo_documento, numero_documento, nombre) values ('V', '40000001', 'María Pérez') returning id;`));
});
after(() => { if (db) dropTestDatabase(db); });

function emitir(moneda, capital, tasaCambio) {
  return psql(db, asUser(ANA, `select public.emitir_prestamo('${cliente}', '${moneda}', ${capital}, 10, 'quincenal', 'quincenal',
    'interes_fijo', '2026-01-01', '2026-02-07', ${tasaCambio}, 'BCV', 1, 0);`, { today: '2026-01-01' }));
}

test('exchange differential compares VES balances at disbursement vs current rates', { skip: skipDb }, () => {
  const id = emitir('VES', 4000000, 40); // Bs 40 000 = $1 000 al desembolso
  psql(db, asUser(ANA, `select public.registrar_pago('${id}', '2026-01-16', 'VES', 1733334, 45, 'cuota');`, { today: '2026-01-16' }));
  const r = psql(db, asUser(ANA, `select row_to_json(x) from public.reporte_diferencial_cambiario() x;`), { json: true });
  const pendiente = 4000000 - 1333334;
  assert.equal(r.tasa_actual, 50);
  assert.equal(r.capital_pendiente_ves_cents, pendiente);
  assert.equal(r.pendiente_usd_desembolso_cents, convertCents(pendiente, 40, 'VES', 'USD'));
  assert.equal(r.pendiente_usd_actual_cents, convertCents(pendiente, 50, 'VES', 'USD'));
  assert.ok(r.diferencial_no_realizado_usd_cents < 0, 'devaluación = pérdida en USD');
  assert.equal(r.capital_cobrado_ves_cents, 1333334);
  assert.equal(r.diferencial_realizado_usd_cents, convertCents(1333334, 45, 'VES', 'USD') - convertCents(1333334, 40, 'VES', 'USD'));
  const custom = psql(db, asUser(ANA, `select tasa_actual from public.reporte_diferencial_cambiario(60);`));
  assert.equal(Number(custom), 60);
});

test('aging, monthly collection and ledger views are consistent', { skip: skipDb }, () => {
  const id = emitir('USD', 100000, 40);
  const aging = psql(db, asUser(ANA, `select json_agg(row_to_json(a) order by moneda, tramo) from public.v_cartera_antiguedad a where moneda = 'USD';`, { today: '2026-03-01' }), { json: true });
  assert.equal(aging.length, 1);
  assert.equal(aging[0].tramo, '2_31_60'); // la cuota 1 venció el 16/01
  assert.equal(aging[0].capital_pendiente_cents, 100000);
  const cobranza = psql(db, asUser(ANA, `select json_agg(json_build_array(mes, esperado_cents) order by mes) from public.v_cobranza_mensual where moneda = 'USD';`), { json: true });
  assert.deepEqual(cobranza, [['2026-01-01', 86667], ['2026-02-01', 38000]]);
  const mayor = psql(db, asUser(ANA, `select json_object_agg(cuenta, saldo_cents) from public.v_libro_mayor where moneda = 'USD';`), { json: true });
  assert.deepEqual(mayor, { caja: -100000, cartera_capital: 100000 });
  assert.equal(psql(db, asUser(BETO, `select count(*) from public.v_libro_mayor;`)), '0');
  assert.ok(id);
});

test('audit log records changes and cannot be altered by users', { skip: skipDb }, () => {
  psql(db, asUser(ANA, `update public.clientes set telefono = '0414-1234567' where id = '${cliente}';`));
  const log = psql(db, asUser(ANA, `select json_build_array(accion, antes->>'telefono', despues->>'telefono', actor_id) from public.auditoria where registro_id = '${cliente}' and accion = 'UPDATE' order by id desc limit 1;`), { json: true });
  assert.deepEqual(log, ['UPDATE', null, '0414-1234567', ANA]);
  assert.ok(Number(psql(db, asUser(ANA, `select count(*) from public.auditoria where tabla = 'prestamos';`))) > 0);
  assert.throws(() => psql(db, asUser(ANA, `delete from public.auditoria;`)), /permission denied/);
  assert.equal(psql(db, asUser(BETO, `select count(*) from public.auditoria;`)), '0');
});
