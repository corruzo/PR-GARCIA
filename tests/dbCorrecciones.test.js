import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase, dropTestDatabase, psql, skipDb } from './helpers/pg.js';

// Correcciones de la auditoría: tasa de cambio, mora reversible, préstamos
// abiertos, límite de crédito, permisos, inmutabilidad y anulación en cascada.
const ANA = '11111111-1111-1111-1111-111111111111';
const CARLA = '33333333-3333-3333-3333-333333333333';
let db;
let seq = 0;

before(() => {
  if (skipDb) return;
  db = createTestDatabase();
  psql(db, `insert into auth.users (id) values ('${ANA}'), ('${CARLA}');`);
});
after(() => { if (db) dropTestDatabase(db); });

function cliente({ user = ANA, limite = null, monedaLimite = 'USD' } = {}) {
  seq += 1;
  return psql(db, asUser(user, `insert into public.clientes (nombre, limite_credito_cents, moneda_limite)
    values ('Cliente ${seq}', ${limite ?? 'null'}, '${monedaLimite}') returning id;`));
}

function emitir(cl, { moneda = 'USD', capital = 100000, tasaCambio = 40, plazo = 'fijo', confirmar = false, mora = 0, hoy = '2026-01-05', user = ANA } = {}) {
  const fin = plazo === 'abierto' ? 'null' : `'2026-02-04'`;
  return psql(db, asUser(user, `select public.emitir_prestamo('${cl}', '${moneda}', ${capital}, 8, 'semanal', 'semanal',
    'interes_fijo', '2026-01-05', ${fin}, ${tasaCambio}, 'BCV', ${mora}, 0, null, null, null, '${plazo}', ${confirmar});`, { today: hoy }));
}

function pagar(id, { fecha, monto, moneda = 'USD', tasa = 40, tipo = 'cuota', confirmar = false, hoy = fecha }) {
  return psql(db, asUser(ANA, `select public.registrar_pago('${id}', '${fecha}', '${moneda}', ${monto}, ${tasa}, '${tipo}',
    'reducir_plazo', 'efectivo', null, null, null, ${confirmar});`, { today: hoy }));
}

const anular = (pago, hoy) => psql(db, asUser(ANA, `select public.anular_pago('${pago}', 'error');`, { today: hoy }));
const periodos = (id) => psql(db, `select json_agg(interes_cents order by numero) from public.cuotas where prestamo_id = '${id}';`, { json: true });

function conTasaBCV(tasa, fn) {
  psql(db, `insert into public.tasa_bcv (tasa, fuente, estado) values (${tasa}, 'BCV', 'ok');`);
  try { return fn(); } finally { psql(db, 'delete from public.tasa_bcv;'); }
}

test('a payment rate far from the stored BCV rate needs explicit confirmation', { skip: skipDb }, () => {
  conTasaBCV(40, () => {
    const cl = cliente();
    const id = emitir(cl, { moneda: 'VES', capital: 4000000 });
    assert.throws(() => pagar(id, { fecha: '2026-01-10', monto: 1100, moneda: 'VES', tasa: 0.01 }), /se aleja más del 20 %/);
    // Una tasa cercana a la oficial no pide confirmación.
    pagar(id, { fecha: '2026-01-10', monto: 10000, moneda: 'VES', tasa: 41 });
    // Confirmada explícitamente, se acepta (p. ej. tasa pactada distinta).
    pagar(id, { fecha: '2026-01-10', monto: 10000, moneda: 'VES', tasa: 55, confirmar: true });
    // En un préstamo en dólares pagado en dólares la tasa no altera el monto: no se valida.
    const usd = emitir(cl);
    pagar(usd, { fecha: '2026-01-10', monto: 1000, tasa: 1 });
  });
});

test('issuing a loan with a rate far from BCV needs confirmation; referential rates are ignored', { skip: skipDb }, () => {
  const cl = cliente();
  conTasaBCV(40, () => {
    assert.throws(() => emitir(cl, { tasaCambio: 400 }), /confirma que es correcta/);
    assert.ok(emitir(cl, { tasaCambio: 400, confirmar: true }));
  });
  psql(db, `insert into public.tasa_bcv (tasa, fuente, estado) values (40, 'open.er-api.com (referencial)', 'referencial');`);
  assert.ok(emitir(cl, { tasaCambio: 400 }), 'una tasa referencial no sirve de base para rechazar');
  assert.equal(psql(db, asUser(ANA, 'select public.fin_tasa_actual();')), '');
  psql(db, 'delete from public.tasa_bcv;');
});

test('a USD loan only receives interest and mora in bolívares', { skip: skipDb }, () => {
  const id = emitir(cliente(), { plazo: 'abierto' });
  // Interés del primer período: 8 % de $1.000 = $80 = Bs 3.200 a 40.
  pagar(id, { fecha: '2026-01-12', monto: 320000, moneda: 'VES' });
  assert.throws(() => pagar(id, { fecha: '2026-01-12', monto: 400000, moneda: 'VES' }), /solo se reciben intereses y mora/);
  const capital = psql(db, `select capital_pagado_cents from public.prestamos where id = '${id}';`);
  assert.equal(capital, '0');
});

test('voiding a capital payment on an open loan restores the interest of later periods', { skip: skipDb }, () => {
  const id = emitir(cliente(), { plazo: 'abierto' });
  const pago = pagar(id, { fecha: '2026-01-12', monto: 58000 }); // $80 interés + $500 capital
  psql(db, asUser(ANA, 'select public.sincronizar_prestamos_abiertos();', { today: '2026-02-02' }));
  assert.deepEqual(periodos(id), [8000, 8000, 4000, 4000, 4000]);
  anular(pago, '2026-02-02');
  assert.deepEqual(periodos(id), [8000, 8000, 8000, 8000, 8000]);
  const r = psql(db, asUser(ANA, `select json_build_array(capital_pendiente_cents, interes_pendiente_cents) from public.v_prestamos_resumen where id = '${id}';`, { today: '2026-02-02' }), { json: true });
  assert.deepEqual(r, [100000, 40000]);
});

test('voiding a fully paid open loan reopens it and generates the missing periods', { skip: skipDb }, () => {
  const id = emitir(cliente(), { plazo: 'abierto' });
  const pago = pagar(id, { fecha: '2026-01-12', monto: 108000 }); // interés + todo el capital
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'pagado');
  anular(pago, '2026-01-27');
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'activo');
  assert.deepEqual(periodos(id), [8000, 8000, 8000, 8000]);
});

test('voiding a late payment reverts the mora it accrued, so an earlier date is charged correctly', { skip: skipDb }, () => {
  const id = emitir(cliente(), { mora: 1 });
  // Cuota 1 vence el 12/01. Pago registrado por error el 22/01.
  const errado = pagar(id, { fecha: '2026-01-22', monto: 1000, hoy: '2026-01-22' });
  const moraErrada = Number(psql(db, `select mora_devengada_cents from public.cuotas where prestamo_id = '${id}' and numero = 1;`));
  assert.ok(moraErrada > 0);
  anular(errado, '2026-01-22');
  assert.equal(psql(db, `select mora_devengada_cents || '|' || coalesce(mora_calculada_hasta::text, '') from public.cuotas where prestamo_id = '${id}' and numero = 1;`), '0|');
  // El pago real fue el 14/01: solo 2 días de mora.
  pagar(id, { fecha: '2026-01-14', monto: 1000, hoy: '2026-01-22' });
  const mora = Number(psql(db, `select mora_devengada_cents from public.cuotas where prestamo_id = '${id}' and numero = 1;`));
  assert.ok(mora < moraErrada);
  const base = Number(psql(db, `select capital_cents + interes_cents from public.cuotas where prestamo_id = '${id}' and numero = 1;`));
  assert.equal(mora, Math.round(base * 0.01 * 2));
});

test('the credit limit is enforced across active loans and currencies', { skip: skipDb }, () => {
  const cl = cliente({ limite: 150000 });
  emitir(cl, { capital: 100000 });
  assert.throws(() => emitir(cl, { capital: 60000 }), /límite de crédito.*disponible 500,00 USD/);
  // Bs 20.000 a 40 = $500: cabe exactamente.
  assert.ok(emitir(cl, { moneda: 'VES', capital: 2000000 }));
  assert.throws(() => emitir(cl, { capital: 1 }), /límite de crédito/);
});

test('cascade voiding removes an old payment and every later one', { skip: skipDb }, () => {
  const id = emitir(cliente());
  const p1 = pagar(id, { fecha: '2026-01-06', monto: 1000 });
  pagar(id, { fecha: '2026-01-07', monto: 1000 });
  pagar(id, { fecha: '2026-01-08', monto: 1000 });
  assert.throws(() => anular(p1, '2026-01-08'), /último pago/);
  assert.equal(psql(db, asUser(ANA, `select public.anular_pagos_desde('${p1}', 'monto equivocado');`, { today: '2026-01-08' })), '3');
  assert.equal(psql(db, `select count(*) from public.pagos where prestamo_id = '${id}' and estado = 'aplicado';`), '0');
  assert.throws(() => psql(db, asUser(CARLA, `select public.anular_pagos_desde('${p1}', 'x');`)), /Pago no encontrado/);
});

test('anonymous users cannot run internal functions; authenticated views keep working', { skip: skipDb }, () => {
  for (const sql of [
    "select public.previsualizar_cronograma(100000, 5, 'diaria', '2026-01-01', '2027-08-01', 'diario', 'saldo_insoluto');",
    "select public.fin_repartir(10, array[1, 2]::bigint[]);",
    "select public.fin_cronograma(100000, 5, 'diaria', '2026-01-01', '2026-02-01', 'diario', 'saldo_insoluto');",
    'select public.fin_hoy();',
  ]) {
    assert.throws(() => psql(db, `set role anon; ${sql}`), /permission denied/, sql);
  }
  assert.throws(() => psql(db, asUser(ANA, `select public.fin_validar_tasa_cambio(1, false);`)), /permission denied/);
  const id = emitir(cliente());
  assert.ok(psql(db, asUser(ANA, `select count(*) from public.v_cuotas_estado where prestamo_id = '${id}';`)));
  assert.ok(Number(psql(db, asUser(ANA, `select public.monto_cancelacion('${id}');`))) > 0);
  assert.ok(psql(db, asUser(ANA, "select count(*) from public.previsualizar_cronograma(100000, 5, 'diaria', '2026-01-01', '2026-02-01', 'diario', 'saldo_insoluto');")));
});

test('the simulated date only works outside the API (session_user authenticator)', { skip: skipDb }, () => {
  psql(db, `do $$ begin if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit; end if; end $$;
    grant authenticated to authenticator;`);
  assert.equal(psql(db, "set app.fecha_hoy = '2001-01-01'; select public.fin_hoy();"), '2001-01-01');
  const viaApi = psql(db, "set session authorization authenticator; set app.fecha_hoy = '2001-01-01'; set role authenticated; select public.fin_hoy();");
  assert.notEqual(viaApi, '2001-01-01');
});

test('ledger, applications, payments and audit cannot be edited or deleted, except by deleting the account', { skip: skipDb }, () => {
  const cl = cliente({ user: CARLA });
  const id = emitir(cl, { user: CARLA });
  psql(db, asUser(CARLA, `select public.registrar_pago('${id}', '2026-01-06', 'USD', 1000, 40);`, { today: '2026-01-06' }));
  for (const sql of [
    'update public.asiento_lineas set debe_cents = debe_cents + 1;',
    'delete from public.asientos;',
    'delete from public.aplicaciones_pago;',
    'update public.auditoria set accion = accion;',
    'delete from public.auditoria;',
    'update public.pagos set monto_pago_cents = 1;',
    'delete from public.pagos;',
    `delete from public.prestamos where id = '${id}';`,
  ]) {
    assert.throws(() => psql(db, sql), /no se pueden|solo admite/, sql);
  }
  psql(db, `delete from auth.users where id = '${CARLA}';`);
  const restos = psql(db, `select (select count(*) from public.prestamos where user_id = '${CARLA}') + (select count(*) from public.auditoria where user_id = '${CARLA}');`);
  assert.equal(restos, '0');
});

test('migrations are tracked in app_migraciones', { skip: skipDb }, () => {
  const versiones = psql(db, 'select count(*) from public.app_migraciones;');
  assert.ok(Number(versiones) >= 10);
});

test('a voided loan shows no pending balance', { skip: skipDb }, () => {
  const id = emitir(cliente());
  psql(db, asUser(ANA, `select public.anular_prestamo('${id}', 'desistió');`, { today: '2026-01-05' }));
  const r = psql(db, asUser(ANA, `select json_build_array(estado, capital_pendiente_cents, interes_pendiente_cents, mora_pendiente_cents, exigible_hoy_cents) from public.v_prestamos_resumen where id = '${id}';`, { today: '2026-03-01' }), { json: true });
  assert.deepEqual(r, ['anulado', 0, 0, 0, 0]);
});
