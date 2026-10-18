import { useState } from 'react';
import { Download } from 'lucide-react';
import { parseRateInput } from '../../../shared/finance/input.js';
import { centsToCSV, toCSV } from '../../../shared/finance/report.js';
import { toDisplayDateTimeCaracas, todayCaracas } from '../../../shared/finance/dates.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { downloadText } from '../cartera/helpers';
import { METODOS_PAGO } from '../../../shared/catalogos.js';
import { Card, Empty, ErrorBox, Field, Loading, Money, PageHeader } from '../cartera/ui';

const CUENTAS = {
  caja: 'Caja (entradas − salidas)',
  cartera_capital: 'Capital prestado por cobrar',
  ingreso_interes: 'Ingresos por intereses',
  ingreso_mora: 'Ingresos por mora',
};
const ACCIONES = { INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Baja' };
const TABLAS = { clientes: 'Cliente', prestamos: 'Préstamo', pagos: 'Pago' };

function mesLabel(iso) {
  const [y, m] = iso.split('-');
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString('es-VE', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function Tabla({ caption, headers, children }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {headers.map((h, i) => <th key={h} scope="col" className={`px-5 py-2 ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function DiferencialCambiario() {
  // Vacío = la última tasa BCV oficial guardada en el servidor (no una caché vieja).
  const [tasaTexto, setTasaTexto] = useState('');
  const tasa = parseRateInput(tasaTexto);
  const remote = useRemote(() => api.getDiferencialCambiario(tasa), [tasa]);
  const rows = remote.data ?? [];
  const total = (key) => rows.reduce((s, r) => s + r[key], 0);

  const exportar = () => downloadText(`diferencial-cambiario-${todayCaracas()}.csv`, toCSV([
    { label: 'Préstamo', value: 'numero' }, { label: 'Cliente', value: 'cliente_nombre' },
    { label: 'Tasa desembolso', value: (r) => String(r.tasa_desembolso).replace('.', ',') },
    { label: 'Tasa actual', value: (r) => String(r.tasa_actual).replace('.', ',') },
    { label: 'Capital pendiente Bs', value: (r) => centsToCSV(r.capital_pendiente_ves_cents) },
    { label: 'USD a tasa desembolso', value: (r) => centsToCSV(r.pendiente_usd_desembolso_cents) },
    { label: 'USD a tasa actual', value: (r) => centsToCSV(r.pendiente_usd_actual_cents) },
    { label: 'Diferencial no realizado USD', value: (r) => centsToCSV(r.diferencial_no_realizado_usd_cents) },
    { label: 'Diferencial realizado USD', value: (r) => centsToCSV(r.diferencial_realizado_usd_cents) },
  ], rows));

  return (
    <Card title="Diferencial cambiario (préstamos en Bs.)" actions={rows.length > 0 && <button type="button" className="btn-ghost" onClick={exportar}><Download size={14} /> CSV</button>}>
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cuánto valen en dólares los bolívares prestados. <strong>No realizado</strong>: capital pendiente valorado a la tasa de hoy frente a la del desembolso.
          <strong> Realizado</strong>: capital ya cobrado, valorado a la tasa de cada pago. Un valor negativo es pérdida por devaluación.
        </p>
        <div className="max-w-xs">
          <Field id="reporte-tasa" label="Tasa actual (Bs/USD)" hint="Vacío = última tasa BCV guardada en el servidor.">
            {(a11y) => <input {...a11y} className="input-base num" inputMode="decimal" value={tasaTexto} onChange={(e) => setTasaTexto(e.target.value)} />}
          </Field>
        </div>
        {remote.loading ? <Loading /> : remote.error ? <ErrorBox message={remote.error} onRetry={remote.reload} /> : rows.length === 0 ? (
          <Empty title="No hay préstamos en bolívares" />
        ) : (
          <Tabla caption="Diferencial cambiario por préstamo" headers={['Préstamo', 'Pendiente Bs', 'USD desembolso', 'USD hoy', 'No realizado', 'Realizado']}>
            {rows.map((r) => (
              <tr key={r.prestamo_id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <th scope="row" className="px-5 py-2 text-left font-semibold">#{r.numero} · {r.cliente_nombre}</th>
                <td className="px-5 py-2 text-right"><Money cents={r.capital_pendiente_ves_cents} currency="VES" /></td>
                <td className="px-5 py-2 text-right"><Money cents={r.pendiente_usd_desembolso_cents} currency="USD" /></td>
                <td className="px-5 py-2 text-right"><Money cents={r.pendiente_usd_actual_cents} currency="USD" /></td>
                <td className={`px-5 py-2 text-right ${r.diferencial_no_realizado_usd_cents < 0 ? 'text-red-700 dark:text-red-300' : ''}`}><Money cents={r.diferencial_no_realizado_usd_cents} currency="USD" /></td>
                <td className={`px-5 py-2 text-right ${r.diferencial_realizado_usd_cents < 0 ? 'text-red-700 dark:text-red-300' : ''}`}><Money cents={r.diferencial_realizado_usd_cents} currency="USD" /></td>
              </tr>
            ))}
            <tr className="font-bold">
              <th scope="row" className="px-5 py-2 text-left">Total</th>
              <td className="px-5 py-2 text-right"><Money cents={total('capital_pendiente_ves_cents')} currency="VES" /></td>
              <td className="px-5 py-2 text-right"><Money cents={total('pendiente_usd_desembolso_cents')} currency="USD" /></td>
              <td className="px-5 py-2 text-right"><Money cents={total('pendiente_usd_actual_cents')} currency="USD" /></td>
              <td className="px-5 py-2 text-right"><Money cents={total('diferencial_no_realizado_usd_cents')} currency="USD" /></td>
              <td className="px-5 py-2 text-right"><Money cents={total('diferencial_realizado_usd_cents')} currency="USD" /></td>
            </tr>
          </Tabla>
        )}
      </div>
    </Card>
  );
}


/** Copia de seguridad en CSV (se abre en Excel o Google Sheets). */
function RespaldoDatos({ prestamos }) {
  const [estado, setEstado] = useState({ cargando: '', error: '' });
  const numeroPorId = Object.fromEntries(prestamos.map((p) => [p.id, p.numero]));

  const exportar = async (tipo) => {
    setEstado({ cargando: tipo, error: '' });
    try {
      if (tipo === 'clientes') {
        const rows = await api.listClientes();
        downloadText(`clientes-${todayCaracas()}.csv`, toCSV([
          { label: 'Nombre', value: 'nombre' },
          { label: 'Documento', value: (r) => (r.numero_documento ? `${r.tipo_documento}-${r.numero_documento}` : '') },
          { label: 'Teléfono', value: 'telefono' }, { label: 'Correo', value: 'email' }, { label: 'Dirección', value: 'direccion' },
          { label: 'Referencia', value: 'referencia' }, { label: 'Notas', value: 'notas' }, { label: 'Estado', value: 'estado' },
          { label: 'Límite de crédito', value: (r) => (r.limite_credito_cents == null ? '' : centsToCSV(r.limite_credito_cents)) },
          { label: 'Moneda del límite', value: 'moneda_limite' },
        ], rows));
      } else {
        const rows = await api.listTodosLosPagos();
        downloadText(`pagos-${todayCaracas()}.csv`, toCSV([
          { label: 'Fecha', value: 'fecha' }, { label: 'Préstamo', value: (r) => numeroPorId[r.prestamo_id] ?? '' },
          { label: 'Tipo', value: (r) => (r.tipo === 'abono_capital' ? 'Abono a capital' : 'Cuota') },
          { label: 'Método', value: (r) => METODOS_PAGO[r.metodo] ?? r.metodo }, { label: 'Referencia', value: 'referencia' },
          { label: 'Moneda recibida', value: 'moneda_pago' }, { label: 'Monto recibido', value: (r) => centsToCSV(r.monto_pago_cents) },
          { label: 'Tasa', value: (r) => String(r.tasa_cambio).replace('.', ',') },
          { label: 'Monto en moneda del préstamo', value: (r) => centsToCSV(r.monto_prestamo_cents) },
          { label: 'Estado', value: 'estado' }, { label: 'Motivo de anulación', value: 'anulado_motivo' },
          { label: 'Registrado', value: (r) => toDisplayDateTimeCaracas(r.created_at) },
        ], rows));
      }
      setEstado({ cargando: '', error: '' });
    } catch (error) {
      setEstado({ cargando: '', error: error.message });
    }
  };

  return (
    <Card title="Respaldo de datos">
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Descarga tus datos en CSV para guardarlos o abrirlos en una hoja de cálculo.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={Boolean(estado.cargando)} onClick={() => exportar('clientes')}>
          <Download size={16} /> {estado.cargando === 'clientes' ? 'Preparando…' : 'Clientes'}
        </button>
        <button type="button" className="btn-secondary" disabled={Boolean(estado.cargando)} onClick={() => exportar('pagos')}>
          <Download size={16} /> {estado.cargando === 'pagos' ? 'Preparando…' : 'Pagos'}
        </button>
      </div>
      {estado.error && <div className="mt-3"><ErrorBox message={estado.error} /></div>}
    </Card>
  );
}

function loadReportes() {
  return Promise.all([api.getCobranzaMensual(), api.getLibroMayor(), api.listPrestamos(), api.listAuditoria({ limit: 30 })])
    .then(([cobranza, mayor, prestamos, auditoria]) => ({ cobranza, mayor, prestamos, auditoria }));
}

export function ReportesView() {
  const remote = useRemote(loadReportes, []);

  if (remote.loading) return <Loading label="Calculando reportes…" />;
  if (remote.error) return <ErrorBox message={remote.error} onRetry={remote.reload} />;
  const { cobranza, mayor, prestamos, auditoria } = remote.data;

  const exportarCartera = () => downloadText(`cartera-${todayCaracas()}.csv`, toCSV([
    { label: 'Número', value: 'numero' }, { label: 'Cliente', value: 'cliente_nombre' }, { label: 'Documento', value: 'cliente_documento' },
    { label: 'Estado', value: 'estado' }, { label: 'Moneda', value: 'moneda' },
    { label: 'Capital', value: (r) => centsToCSV(r.capital_cents) },
    { label: 'Interés pactado', value: (r) => centsToCSV(r.interes_total_cents) },
    { label: 'Capital pendiente', value: (r) => centsToCSV(r.capital_pendiente_cents) },
    { label: 'Interés pendiente', value: (r) => centsToCSV(r.interes_pendiente_cents) },
    { label: 'Mora pendiente', value: (r) => centsToCSV(r.mora_pendiente_cents) },
    { label: 'Cobrado', value: (r) => centsToCSV(r.cobrado_cents) },
    { label: 'Días de atraso', value: 'dias_atraso' }, { label: 'Inicio', value: 'fecha_inicio' }, { label: 'Fin', value: 'fecha_fin' },
    { label: 'Tasa de cambio', value: (r) => String(r.tasa_cambio).replace('.', ',') },
  ], prestamos));

  const mayorPorMoneda = mayor.reduce((acc, row) => ({ ...acc, [row.moneda]: [...(acc[row.moneda] ?? []), row] }), {});

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Reportes" subtitle="Cobranza, contabilidad y efecto de la tasa de cambio."
        actions={<button type="button" className="btn-secondary" onClick={exportarCartera} disabled={!prestamos.length}><Download size={16} /> Exportar cartera (CSV)</button>} />

      <Card title="Cobranza mensual: esperado vs. cobrado">
        {cobranza.length === 0 ? <Empty title="Aún no hay movimientos" /> : (
          <Tabla caption="Cobranza mensual" headers={['Mes', 'Esperado', 'Cobrado', 'Cobrado en USD']}>
            {cobranza.map((r) => (
              <tr key={`${r.mes}-${r.moneda}`} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <th scope="row" className="px-5 py-2 text-left font-semibold capitalize">{mesLabel(r.mes)} · {r.moneda}</th>
                <td className="px-5 py-2 text-right"><Money cents={r.esperado_cents} currency={r.moneda} /></td>
                <td className="px-5 py-2 text-right"><Money cents={r.cobrado_cents} currency={r.moneda} /></td>
                <td className="px-5 py-2 text-right"><Money cents={r.cobrado_usd_cents} currency="USD" /></td>
              </tr>
            ))}
          </Tabla>
        )}
      </Card>

      <Card title="Libro mayor">
        {Object.keys(mayorPorMoneda).length === 0 ? <Empty title="Sin asientos contables" /> : Object.entries(mayorPorMoneda).map(([moneda, rows]) => (
          <div key={moneda} className="mb-4 last:mb-0">
            <h3 className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-200">Préstamos en {moneda}</h3>
            <Tabla caption={`Libro mayor ${moneda}`} headers={['Cuenta', 'Debe', 'Haber', 'Saldo', 'Saldo USD histórico']}>
              {rows.sort((a, b) => a.cuenta.localeCompare(b.cuenta)).map((r) => (
                <tr key={r.cuenta} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <th scope="row" className="px-5 py-2 text-left font-semibold">{CUENTAS[r.cuenta] ?? r.cuenta}</th>
                  <td className="px-5 py-2 text-right"><Money cents={r.debe_cents} currency={moneda} /></td>
                  <td className="px-5 py-2 text-right"><Money cents={r.haber_cents} currency={moneda} /></td>
                  <td className="px-5 py-2 text-right font-bold"><Money cents={r.saldo_cents} currency={moneda} /></td>
                  <td className="px-5 py-2 text-right"><Money cents={r.saldo_usd_historico_cents} currency="USD" /></td>
                </tr>
              ))}
            </Tabla>
          </div>
        ))}
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Contabilidad de caja: los intereses se reconocen al cobrarse. El saldo USD histórico usa la tasa de cada operación.</p>
      </Card>

      <DiferencialCambiario />

      <RespaldoDatos prestamos={prestamos} />

      <Card title="Actividad reciente">
        {auditoria.length === 0 ? <Empty title="Sin actividad registrada" /> : (
          <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
            {auditoria.map((a) => {
              const fila = a.despues ?? a.antes ?? {};
              const detalle = a.tabla === 'clientes' ? fila.nombre : a.tabla === 'prestamos' ? `#${fila.numero} · ${fila.estado}` : `${fila.fecha} · ${fila.estado}`;
              return (
                <li key={a.id} className="flex justify-between gap-3 py-2">
                  <span><strong>{ACCIONES[a.accion]} de {TABLAS[a.tabla] ?? a.tabla}</strong> · {detalle}</span>
                  <time className="shrink-0 text-slate-500 dark:text-slate-400" dateTime={a.creado_en}>{new Date(a.creado_en).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
