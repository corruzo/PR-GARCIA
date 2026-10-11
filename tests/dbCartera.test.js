import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase, dropTestDatabase, psql, skipDb } from './helpers/pg.js';
import { buildSchedule, normalizeLoanTerms } from '../shared/finance/schedule.js';
import { convertCents } from '../shared/finance/money.js';

const ANA = '11111111-1111-1111-1111-111111111111';
const BETO = '22222222-2222-2222-2222-222222222222';
let db;

before(() => {
  if (skipDb) return;
  db = createTestDatabase();
  psql(db, `insert into auth.users (id) values ('${ANA}'), ('${BETO}');`);
});

after(() => {
  if (db) dropTestDatabase(db);
});

function crearCliente(user, documento, extra = '') {
  return psql(db, asUser(user, `
    insert into public.clientes (tipo_documento, numero_documento, nombre ${extra ? ', estado' : ''})
    values ('V', '${documento}', 'Cliente ${documento}' ${extra ? `, '${extra}'` : ''}) returning id;`));
}

function emitir(user, clienteId, overrides = {}) {
  const p = {
    moneda: 'USD', capital: 100000, tasa: 10, modalidad: 'quincenal', frecuencia: 'quincenal',
    metodo: 'interes_fijo', inicio: '2026-01-01', fin: '2026-02-07', tasaCambio: 36.5,
    mora: 0.5, gracia: 0, key: null, ...overrides,
  };
  return psql(db, asUser(user, `select public.emitir_prestamo(
    '${clienteId}', '${p.moneda}', ${p.capital}, ${p.tasa}, '${p.modalidad}', '${p.frecuencia}', '${p.metodo}',
    '${p.inicio}', '${p.fin}', ${p.tasaCambio}, 'BCV', ${p.mora}, ${p.gracia}, null, null,
    ${p.key ? `'${p.key}'` : 'null'});`, { today: '2026-01-01' }));
}

test('SQL helpers match the JavaScript finance core exactly', { skip: skipDb }, () => {
  const cases = [];
  const modes = ['diaria', 'semanal', 'quincenal', 'mensual'];
  const freqs = ['diario', 'semanal', 'quincenal', 'mensual'];
  let seed = 7;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 40; i += 1) {
    const days = 1 + rand(200);
    const end = new Date(Date.UTC(2026, 0, 1 + days)).toISOString().slice(0, 10);
    cases.push({
      principalCents: 1 + rand(50_000_000), ratePercent: (1 + rand(40000)) / 1000,
      rateMode: modes[rand(4)], frequency: freqs[rand(4)], method: rand(2) ? 'interes_fijo' : 'saldo_insoluto',
      startDate: '2026-01-01', endDate: end, currency: 'USD',
    });
  }
  const sql = `select json_agg(r) from (${cases.map((c, i) => `
    select ${i} as caso, json_agg(json_build_array(numero, fecha_vencimiento, dias, capital_cents, interes_cents, saldo_cents) order by numero) as cuotas
    from public.fin_cronograma(${c.principalCents}, ${c.ratePercent}, '${c.rateMode}', '${c.startDate}', '${c.endDate}', '${c.frequency}', '${c.method}')`).join(' union all ')}) r;`;
  const rows = psql(db, sql, { json: true });
  for (const row of rows) {
    const terms = normalizeLoanTerms(cases[row.caso]);
    assert.ok(terms.ok);
    const expected = buildSchedule(terms.terms).installments
      .map((c) => [c.number, c.dueDate, c.days, c.principalCents, c.interestCents, c.balanceCents]);
    assert.deepEqual(row.cuotas, expected, JSON.stringify(cases[row.caso]));
  }

  const conversions = [[10000, '36.5', 'USD', 'VES'], [365001, '36.5', 'VES', 'USD'], [12345, '852.4168', 'USD', 'VES'], [999999, '852.4168', 'VES', 'USD']];
  const converted = psql(db, `select json_agg(public.fin_convertir(c, t, de, a) order by o) from (values ${conversions.map((c, i) => `(${i}, ${c[0]}::bigint, ${c[1]}::numeric, '${c[2]}', '${c[3]}')`).join(',')}) v(o, c, t, de, a);`, { json: true });
  assert.deepEqual(converted, conversions.map(([c, t, de, a]) => convertCents(c, t, de, a)));
});

test('emitir_prestamo persists the server-computed schedule and a balanced ledger entry', { skip: skipDb }, () => {
  const cliente = crearCliente(ANA, '10000001');
  const id = emitir(ANA, cliente);
  const loan = psql(db, `select row_to_json(p) from public.prestamos p where id = '${id}';`, { json: true });
  assert.equal(loan.numero, 1);
  assert.equal(loan.interes_total_cents, 24667);
  assert.equal(loan.total_cents, 124667);
  const cuotas = psql(db, `select json_agg(json_build_array(dias, capital_cents, interes_cents) order by numero) from public.cuotas where prestamo_id = '${id}';`, { json: true });
  assert.deepEqual(cuotas, [[15, 33334, 10000], [15, 33333, 10000], [7, 33333, 4667]]);
  const ledger = psql(db, `select json_build_array(sum(debe_cents), sum(haber_cents)) from public.asiento_lineas l join public.asientos a on a.id = l.asiento_id where a.prestamo_id = '${id}';`, { json: true });
  assert.deepEqual(ledger, [100000, 100000]);
});

test('emitir_prestamo is idempotent and numbers loans per user', { skip: skipDb }, () => {
  const cliente = crearCliente(ANA, '10000002');
  const key = '33333333-3333-3333-3333-333333333333';
  const first = emitir(ANA, cliente, { key });
  const second = emitir(ANA, cliente, { key });
  assert.equal(first, second);
  const clienteBeto = crearCliente(BETO, '10000002');
  const betoLoan = emitir(BETO, clienteBeto);
  assert.equal(psql(db, `select numero from public.prestamos where id = '${betoLoan}';`), '1');
});

test('emitir_prestamo rejects invalid terms, foreign clients and inactive clients', { skip: skipDb }, () => {
  const cliente = crearCliente(ANA, '10000003');
  assert.throws(() => emitir(ANA, cliente, { capital: 0 }), /Monto fuera del rango/);
  assert.throws(() => emitir(ANA, cliente, { tasa: 5000 }), /tasa debe ser mayor/);
  assert.throws(() => emitir(ANA, cliente, { fin: '2025-12-01' }), /posterior/);
  assert.throws(() => emitir(ANA, cliente, { tasaCambio: 0 }), /Tasa de cambio/);
  assert.throws(() => emitir(ANA, cliente, { mora: 10 }), /mora diaria/);
  assert.throws(() => emitir(BETO, cliente), /Cliente no encontrado/);
  const bloqueado = crearCliente(ANA, '10000004', 'bloqueado');
  assert.throws(() => emitir(ANA, bloqueado), /no está activo/);
});

test('RLS isolates users and blocks direct writes to loans, installments and ledger', { skip: skipDb }, () => {
  const cliente = crearCliente(ANA, '10000005');
  const id = emitir(ANA, cliente);
  assert.equal(psql(db, asUser(BETO, `select count(*) from public.prestamos where id = '${id}';`)), '0');
  assert.equal(psql(db, asUser(BETO, `select count(*) from public.clientes where id = '${cliente}';`)), '0');
  assert.equal(psql(db, asUser(BETO, `update public.clientes set nombre = 'Hack' where id = '${cliente}' returning id;`)), '');
  assert.throws(() => psql(db, asUser(ANA, `update public.cuotas set capital_pagado_cents = 1 where prestamo_id = '${id}';`)), /permission denied/);
  assert.throws(() => psql(db, asUser(ANA, `delete from public.prestamos where id = '${id}';`)), /permission denied/);
  assert.throws(() => psql(db, asUser(ANA, `insert into public.clientes (user_id, tipo_documento, numero_documento, nombre) values ('${BETO}', 'V', '99999999', 'Ajeno');`)), /row-level security/);
  assert.throws(() => psql(db, `set role anon; select * from public.clientes;`), /permission denied/);
  assert.throws(() => psql(db, `set role anon; select public.emitir_prestamo(null, 'USD', 1, 1, 'diaria', 'diario', 'interes_fijo', '2026-01-01', '2026-01-02', 1, 'x');`), /permission denied/);
});

test('client data is validated by database constraints', { skip: skipDb }, () => {
  assert.throws(() => psql(db, asUser(ANA, `insert into public.clientes (tipo_documento, numero_documento, nombre) values ('V', '12', 'Corto');`)), /check constraint/);
  assert.throws(() => psql(db, asUser(ANA, `insert into public.clientes (tipo_documento, numero_documento, nombre) values ('V', '12345678', '<script>');`)), /check constraint/);
  crearCliente(ANA, '20000001');
  assert.throws(() => crearCliente(ANA, '20000001'), /duplicate key/);
});

test('anular_prestamo reverses an unpaid loan with a balanced entry', { skip: skipDb }, () => {
  const cliente = crearCliente(ANA, '10000006');
  const id = emitir(ANA, cliente);
  assert.throws(() => psql(db, asUser(ANA, `select public.anular_prestamo('${id}', '');`)), /motivo/);
  psql(db, asUser(ANA, `select public.anular_prestamo('${id}', 'Error de carga');`));
  assert.equal(psql(db, `select estado from public.prestamos where id = '${id}';`), 'anulado');
  assert.equal(psql(db, `select count(*) from public.cuotas where prestamo_id = '${id}' and estado <> 'anulada';`), '0');
  const saldo = psql(db, `select sum(debe_cents) - sum(haber_cents) from public.asiento_lineas l join public.asientos a on a.id = l.asiento_id where a.prestamo_id = '${id}' and l.cuenta = 'cartera_capital';`);
  assert.equal(saldo, '0');
});
