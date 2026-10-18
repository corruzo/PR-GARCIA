import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase, dropTestDatabase, psql, skipDb } from './helpers/pg.js';

// Conciliación contable sobre una cartera realista: el libro mayor debe
// coincidir con el detalle de préstamos, cuotas y pagos, y los reportes deben
// sumar lo mismo que la cartera.
const ANA = '11111111-1111-1111-1111-111111111111';
let db;

const sql = (q, today = '2026-04-30') => psql(db, asUser(ANA, q, { today }));
const json = (q, today = '2026-04-30') => psql(db, asUser(ANA, q, { today }), { json: true });

function cliente(nombre) {
  return sql(`insert into public.clientes (nombre) values ('${nombre}') returning id;`);
}
function emitir(cl, { moneda = 'USD', capital, tasa = 10, modalidad = 'mensual', frecuencia = 'mensual', metodo = 'saldo_insoluto', inicio, fin = null, cambio = 40, mora = 0.5, plazo = 'fijo' }) {
  return sql(`select public.emitir_prestamo('${cl}', '${moneda}', ${capital}, ${tasa}, '${modalidad}', '${frecuencia}', '${metodo}',
    '${inicio}', ${fin ? `'${fin}'` : 'null'}, ${cambio}, 'BCV', ${mora}, 0, null, null, null, '${plazo}', true);`, inicio);
}
function pagar(id, fecha, monto, { moneda = 'USD', cambio = 40, tipo = 'cuota' } = {}) {
  return sql(`select public.registrar_pago('${id}', '${fecha}', '${moneda}', ${monto}, ${cambio}, '${tipo}', 'reducir_plazo', 'efectivo', null, null, null, true);`, fecha);
}

before(() => {
  if (skipDb) return;
  db = createTestDatabase();
  psql(db, `insert into auth.users (id) values ('${ANA}');`);
  const a = cliente('Ana Cartera');
  const b = cliente('Beto Cartera');
  const c = cliente('Carla Cartera');
  // 1) Fijo USD sobre saldo, pagado a tiempo una cuota, con abono y un pago anulado.
  const p1 = emitir(a, { capital: 120000, inicio: '2026-01-01', fin: '2026-04-01' });
  pagar(p1, '2026-01-31', 52000);
  pagar(p1, '2026-02-10', 30000, { tipo: 'abono_capital' });
  const errado = pagar(p1, '2026-03-05', 1000);
  sql(`select public.anular_pago('${errado}', 'error');`, '2026-03-05');
  // 2) Fijo USD interés fijo, atrasado (genera mora) y pago tardío parcial.
  const p2 = emitir(b, { capital: 60000, metodo: 'interes_fijo', inicio: '2026-01-15', fin: '2026-03-16' });
  pagar(p2, '2026-03-20', 20000);
  // 3) Préstamo en bolívares con pagos en Bs a distintas tasas.
  const p3 = emitir(c, { moneda: 'VES', capital: 4000000, inicio: '2026-02-01', fin: '2026-05-02', cambio: 40 });
  pagar(p3, '2026-03-03', 1500000, { moneda: 'VES', cambio: 45 });
  // 4) Préstamo abierto USD semanal: intereses en Bs y abono a capital en USD.
  const p4 = emitir(a, { capital: 100000, tasa: 8, modalidad: 'semanal', frecuencia: 'semanal', inicio: '2026-03-02', plazo: 'abierto' });
  pagar(p4, '2026-03-09', 320000, { moneda: 'VES', cambio: 40 });
  pagar(p4, '2026-03-16', 58000);
  // 5) Préstamo anulado sin pagos.
  const p5 = emitir(b, { capital: 10000, inicio: '2026-04-01', fin: '2026-05-01' });
  sql(`select public.anular_prestamo('${p5}', 'desistió');`, '2026-04-01');
  // 6) Préstamo cancelado por completo.
  const p6 = emitir(c, { capital: 50000, inicio: '2026-01-10', fin: '2026-02-09' });
  pagar(p6, '2026-02-09', Number(sql(`select public.monto_cancelacion('${p6}', '2026-02-09');`, '2026-02-09')), { tipo: 'abono_capital' });
  sql('select public.sincronizar_prestamos_abiertos();');
});
after(() => { if (db) dropTestDatabase(db); });

const mayor = (moneda) => Object.fromEntries((json(`select coalesce(json_agg(json_build_array(cuenta, saldo_cents)), '[]') from public.v_libro_mayor where moneda = '${moneda}';`) ?? []).map(([k, v]) => [k, Number(v)]));

test('every journal entry balances and none is left without lines', { skip: skipDb }, () => {
  const descuadrados = sql(`select count(*) from (select a.id from public.asientos a left join public.asiento_lineas l on l.asiento_id = a.id
    group by a.id having coalesce(sum(l.debe_cents), 0) <> coalesce(sum(l.haber_cents), 0) or count(l.id) = 0) x;`);
  assert.equal(descuadrados, '0');
});

for (const moneda of ['USD', 'VES']) {
  test(`${moneda}: ledger reconciles with the loan subledger`, { skip: skipDb }, () => {
    const m = mayor(moneda);
    const capital = Number(sql(`select coalesce(sum(capital_pendiente_cents), 0) from public.v_prestamos_resumen where moneda = '${moneda}' and estado <> 'anulado';`));
    assert.equal(m.cartera_capital ?? 0, capital, 'capital por cobrar = capital pendiente de los préstamos');

    const interes = Number(sql(`select coalesce(sum(c.interes_pagado_cents), 0) from public.cuotas c join public.prestamos p on p.id = c.prestamo_id where p.moneda = '${moneda}';`));
    assert.equal(0 - (m.ingreso_interes ?? 0) || 0, interes, 'ingresos por interés = interés cobrado en las cuotas');

    const mora = Number(sql(`select coalesce(sum(c.mora_pagada_cents), 0) from public.cuotas c join public.prestamos p on p.id = c.prestamo_id where p.moneda = '${moneda}';`));
    assert.equal(0 - (m.ingreso_mora ?? 0) || 0, mora, 'ingresos por mora = mora cobrada');

    const cobros = Number(sql(`select coalesce(sum(pg.monto_prestamo_cents), 0) from public.pagos pg join public.prestamos p on p.id = pg.prestamo_id where p.moneda = '${moneda}' and pg.estado = 'aplicado';`));
    const desembolsos = Number(sql(`select coalesce(sum(capital_cents), 0) from public.prestamos where moneda = '${moneda}' and estado <> 'anulado';`));
    assert.equal(m.caja ?? 0, cobros - desembolsos, 'caja = cobros − desembolsos');
  });
}

test('every applied payment is fully explained by its applications', { skip: skipDb }, () => {
  const sinCuadrar = sql(`select count(*) from public.pagos pg where pg.estado = 'aplicado' and pg.monto_prestamo_cents <>
    (select coalesce(sum(monto_cents), 0) from public.aplicaciones_pago a where a.pago_id = pg.id and a.concepto <> 'descuento_interes');`);
  assert.equal(sinCuadrar, '0');
});

test('reports add up to the same portfolio', { skip: skipDb }, () => {
  for (const moneda of ['USD', 'VES']) {
    const resumen = json(`select json_build_array(coalesce(sum(capital_pendiente_cents), 0), coalesce(sum(exigible_hoy_cents), 0)) from public.v_prestamos_resumen where moneda = '${moneda}' and estado = 'activo';`);
    const antiguedad = json(`select json_build_array(coalesce(sum(capital_pendiente_cents), 0), coalesce(sum(exigible_hoy_cents), 0)) from public.v_cartera_antiguedad where moneda = '${moneda}';`);
    assert.deepEqual(antiguedad.map(Number), resumen.map(Number), `antigüedad de cartera ${moneda}`);
    const cobrado = Number(sql(`select coalesce(sum(cobrado_cents), 0) from public.v_cobranza_mensual where moneda = '${moneda}';`));
    const pagos = Number(sql(`select coalesce(sum(pg.monto_prestamo_cents), 0) from public.pagos pg join public.prestamos p on p.id = pg.prestamo_id where p.moneda = '${moneda}' and pg.estado = 'aplicado';`));
    assert.equal(cobrado, pagos, `cobranza mensual ${moneda}`);
  }
});

test('loan states are consistent with their balances', { skip: skipDb }, () => {
  const estados = json(`select json_object_agg(estado, n) from (select estado, count(*) n from public.prestamos group by estado) x;`);
  assert.deepEqual(estados, { activo: 4, pagado: 1, anulado: 1 });
  const pagadoConSaldo = sql(`select count(*) from public.v_prestamos_resumen where estado = 'pagado' and capital_pendiente_cents + interes_pendiente_cents + mora_pendiente_cents > 0;`);
  assert.equal(pagadoConSaldo, '0');
  const mora = Number(sql(`select mora_pendiente_cents from public.v_prestamos_resumen where cliente_nombre = 'Beto Cartera' and estado = 'activo';`));
  assert.ok(mora > 0, 'el préstamo atrasado acumula mora');
});
