import { useMemo, useState } from 'react';
import { ArrowLeft, MessageCircle, Plus, Search } from 'lucide-react';
import { toDisplayDate } from '../../../shared/finance/dates.js';
import { buildPaymentReminder, toWhatsAppNumber } from '../../../shared/finance/report.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { SITUACION } from '../cartera/helpers';
import { Badge, Card, Empty, ErrorBox, Loading, Money, PageHeader, SegmentedControl, PrestamoBadge } from '../cartera/ui';
import { NuevoPrestamoForm } from './NuevoPrestamoForm';
import { RegistrarPagoForm } from './RegistrarPagoForm';

const METODO_PAGO = { efectivo: 'Efectivo', pago_movil: 'Pago móvil', transferencia: 'Transferencia', zelle: 'Zelle', otro: 'Otro' };
const FRECUENCIA = { diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' };

export function PrestamosView({ route, navigate, prefill, onPrefillUsed }) {
  if (route.id === 'nuevo') {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Nuevo préstamo" subtitle="Los datos se validan y se guardan en el servidor." />
        <NuevoPrestamoForm
          clienteId={route.params.cliente}
          prefill={prefill}
          onCreated={(id) => { onPrefillUsed?.(); navigate('prestamos', id); }}
          onCancel={() => { onPrefillUsed?.(); window.history.back(); }}
        />
      </div>
    );
  }
  if (route.id) return <PrestamoDetalle id={route.id} navigate={navigate} />;
  return <PrestamosLista navigate={navigate} />;
}

const FILTROS = [
  { value: 'activos', label: 'Activos' },
  { value: 'mora', label: 'En mora' },
  { value: 'pagados', label: 'Pagados' },
  { value: 'todos', label: 'Todos' },
];

function PrestamosLista({ navigate }) {
  const prestamos = useRemote(() => api.listPrestamos(), []);
  const [filtro, setFiltro] = useState('activos');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (prestamos.data ?? []).filter((p) => {
      if (filtro === 'activos' && p.estado !== 'activo') return false;
      if (filtro === 'mora' && !(p.estado === 'activo' && p.cuotas_vencidas > 0)) return false;
      if (filtro === 'pagados' && p.estado !== 'pagado') return false;
      if (!term) return true;
      return p.cliente_nombre.toLowerCase().includes(term) || String(p.numero) === term.replace('#', '')
        || p.cliente_documento.toLowerCase().includes(term);
    });
  }, [prestamos.data, filtro, search]);

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Préstamos" subtitle="Cartera emitida, saldos y vencimientos."
        actions={<button type="button" className="btn-primary" onClick={() => navigate('prestamos', 'nuevo')}><Plus size={16} /> Nuevo préstamo</button>} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <label htmlFor="prestamos-buscar" className="sr-only">Buscar préstamos</label>
          <input id="prestamos-buscar" className="input-base pl-10" placeholder="Cliente, cédula o número…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <SegmentedControl label="Mostrar" value={filtro} onChange={setFiltro} options={FILTROS} />
      </div>
      {prestamos.loading ? <Loading label="Cargando préstamos…" /> : prestamos.error ? (
        <ErrorBox message={prestamos.error} onRetry={prestamos.reload} />
      ) : filtered.length === 0 ? (
        <Empty title="No hay préstamos en esta vista">Emite un préstamo desde aquí o desde la ficha de un cliente.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => navigate('prestamos', p.id)} className="glass-card glass-card-hover flex w-full flex-col gap-3 rounded-2xl p-4 text-left">
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">#{p.numero} · {p.cliente_nombre}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Capital <Money cents={p.capital_cents} currency={p.moneda} /> · {p.tipo_plazo === 'abierto' ? `sin fecha de fin · interés ${FRECUENCIA[p.frecuencia_pago]}` : FRECUENCIA[p.frecuencia_pago]}</span>
                  </span>
                  <PrestamoBadge prestamo={p} />
                </span>
                {p.estado === 'activo' && (
                  <span className="grid w-full grid-cols-2 gap-2 text-xs">
                    <span><span className="block text-slate-500 dark:text-slate-400">Pendiente</span><Money className="font-bold" cents={p.capital_pendiente_cents + p.interes_pendiente_cents + p.mora_pendiente_cents} currency={p.moneda} /></span>
                    <span><span className="block text-slate-500 dark:text-slate-400">Próximo vencimiento</span>{p.proximo_vencimiento ? toDisplayDate(p.proximo_vencimiento) : '—'}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, children, tone }) {
  return (
    <div className="result-card compact-result-card">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <div className={`mt-1 text-base font-bold ${tone === 'red' ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{children}</div>
    </div>
  );
}

function PrestamoDetalle({ id, navigate }) {
  const prestamo = useRemote(() => api.getPrestamo(id), [id]);
  const cuotas = useRemote(() => api.listCuotas(id), [id]);
  const pagos = useRemote(() => api.listPagos(id), [id]);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const reloadAll = () => { prestamo.reload(); cuotas.reload(); pagos.reload(); };

  if (prestamo.loading) return <Loading label="Cargando préstamo…" />;
  if (prestamo.error) return <ErrorBox message={prestamo.error} onRetry={prestamo.reload} />;
  const p = prestamo.data;
  const abierto = p.tipo_plazo === 'abierto';
  const pendiente = p.capital_pendiente_cents + p.interes_pendiente_cents + p.mora_pendiente_cents;
  const pagosAplicados = (pagos.data ?? []).filter((pg) => pg.estado === 'aplicado');
  const ultimoPago = pagosAplicados[0];
  const whatsapp = toWhatsAppNumber(p.cliente_telefono);
  const recordatorio = buildPaymentReminder({
    clienteNombre: p.cliente_nombre, numero: p.numero, moneda: p.moneda,
    exigibleCents: p.exigible_hoy_cents || 0, moraCents: p.mora_pendiente_cents,
    proximoVencimiento: p.proximo_vencimiento, diasAtraso: p.cuotas_vencidas > 0 ? p.dias_atraso : 0,
  });

  const confirmarMotivo = (pregunta) => {
    const motivo = window.prompt(pregunta);
    return motivo && motivo.trim() ? motivo.trim().slice(0, 300) : null;
  };

  const anularPago = async (pago) => {
    const motivo = confirmarMotivo('Motivo de la anulación del pago (obligatorio):');
    if (!motivo) return;
    setBusy(true);
    setActionError('');
    try {
      await api.anularPago(pago.id, motivo);
      reloadAll();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const anularPrestamo = async () => {
    const motivo = confirmarMotivo('Motivo de la anulación del préstamo (obligatorio):');
    if (!motivo) return;
    setBusy(true);
    setActionError('');
    try {
      await api.anularPrestamo(p.id, motivo);
      reloadAll();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button type="button" className="btn-ghost -ml-3" onClick={() => navigate('prestamos')}><ArrowLeft size={16} /> Préstamos</button>
      <PageHeader
        title={`Préstamo #${p.numero}`}
        subtitle={(
          <button type="button" className="underline" onClick={() => navigate('clientes', p.cliente_id)}>{p.cliente_nombre} · {p.cliente_documento}</button>
        )}
        actions={(
          <>
            <PrestamoBadge prestamo={p} />
            {p.estado === 'activo' && whatsapp && (
              <a className="btn-secondary" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(recordatorio)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={16} /> Recordatorio
              </a>
            )}
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pendiente total"><Money cents={pendiente} currency={p.moneda} /></Stat>
        <Stat label="Exigible hoy" tone={p.exigible_hoy_cents > 0 ? 'red' : undefined}><Money cents={p.exigible_hoy_cents} currency={p.moneda} /></Stat>
        <Stat label="Mora acumulada" tone={p.mora_pendiente_cents > 0 ? 'red' : undefined}><Money cents={p.mora_pendiente_cents} currency={p.moneda} /></Stat>
        <Stat label="Cobrado"><Money cents={p.cobrado_cents} currency={p.moneda} /></Stat>
      </div>

      <Card title="Condiciones">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Capital</dt><dd><Money cents={p.capital_cents} currency={p.moneda} /></dd></div>
          {abierto ? (
            <div><dt className="text-xs text-slate-500 dark:text-slate-400">Interés generado</dt><dd><Money cents={p.interes_generado_cents} currency={p.moneda} /></dd></div>
          ) : (
            <div><dt className="text-xs text-slate-500 dark:text-slate-400">Interés pactado</dt><dd><Money cents={p.interes_total_cents} currency={p.moneda} /></dd></div>
          )}
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Tasa</dt><dd>{Number(p.tasa_interes).toLocaleString('es-VE')} % {p.modalidad_tasa} · {p.metodo_interes === 'saldo_insoluto' ? 'sobre saldo' : 'fijo'}</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Vigencia</dt><dd>{abierto ? `Desde ${toDisplayDate(p.fecha_inicio)} · sin fecha de fin` : `${toDisplayDate(p.fecha_inicio)} → ${toDisplayDate(p.fecha_fin)}`}</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Tasa de cambio al desembolso</dt><dd className="num">{Number(p.tasa_cambio).toLocaleString('es-VE')} Bs/USD ({p.fuente_tasa_cambio})</dd></div>
          <div><dt className="text-xs text-slate-500 dark:text-slate-400">Mora</dt><dd>{Number(p.tasa_mora_diaria) > 0 ? `${Number(p.tasa_mora_diaria).toLocaleString('es-VE')} % diario · ${p.dias_gracia} días de gracia` : 'Sin mora'}</dd></div>
        </dl>
        {p.notas && <p className="mt-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{p.notas}</p>}
      </Card>

      <ErrorBox message={actionError} />

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6">
        <Card title={abierto ? 'Intereses por período' : 'Cronograma'} className="mb-5 lg:mb-0">
          {abierto && (
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Capital pendiente: <Money className="font-semibold" cents={p.capital_pendiente_cents} currency={p.moneda} />.
              Cada período cobra interés sobre lo que se debe al empezar; los abonos lo reducen desde el día del pago.
            </p>
          )}
          {cuotas.loading ? <Loading /> : cuotas.error ? <ErrorBox message={cuotas.error} onRetry={cuotas.reload} /> : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Cuotas del préstamo</caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <th scope="col" className="px-3 py-2">#</th>
                    <th scope="col" className="px-3 py-2">Vence</th>
                    <th scope="col" className="px-3 py-2 text-right">{abierto ? 'Interés' : 'Cuota'}</th>
                    <th scope="col" className="px-3 py-2 text-right">Pendiente</th>
                    <th scope="col" className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.data.map((c) => {
                    const situacion = SITUACION[c.situacion] ?? SITUACION.al_dia;
                    const pend = c.capital_pendiente_cents + c.interes_pendiente_cents + c.mora_pendiente_cents;
                    return (
                      <tr key={c.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="px-3 py-2 num text-slate-500">{c.numero}</td>
                        <td className="whitespace-nowrap px-3 py-2">{toDisplayDate(c.fecha_vencimiento)}</td>
                        <td className="px-3 py-2 text-right"><Money cents={c.capital_cents + c.interes_cents - c.interes_descontado_cents} currency={p.moneda} /></td>
                        <td className="px-3 py-2 text-right">
                          <Money cents={pend} currency={p.moneda} />
                          {c.mora_pendiente_cents > 0 && <span className="block text-[10px] text-red-700 dark:text-red-300">mora <Money cents={c.mora_pendiente_cents} currency={p.moneda} /></span>}
                        </td>
                        <td className="px-3 py-2"><Badge tone={situacion.tone}>{situacion.label}{c.situacion === 'vencida' ? ` · ${c.dias_atraso} d` : ''}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {p.estado === 'activo' && (
          <Card title="Registrar pago">
            <RegistrarPagoForm prestamo={p} onSaved={reloadAll} />
          </Card>
        )}
      </div>

      <Card title="Pagos recibidos">
        {pagos.loading ? <Loading /> : pagos.error ? <ErrorBox message={pagos.error} onRetry={pagos.reload} /> : pagos.data.length === 0 ? (
          <Empty title="Sin pagos registrados" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pagos.data.map((pg) => {
              const porConcepto = Object.fromEntries(['mora', 'interes', 'capital', 'descuento_interes'].map((k) => [k,
                pg.aplicaciones_pago.filter((a) => a.concepto === k).reduce((s, a) => s + a.monto_cents, 0)]));
              return (
                <li key={pg.id} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${pg.estado === 'anulado' ? 'opacity-60' : ''}`}>
                  <div className="text-sm">
                    <p className="font-bold text-slate-900 dark:text-white">
                      <Money cents={pg.monto_pago_cents} currency={pg.moneda_pago} />
                      {pg.moneda_pago !== p.moneda && <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">→ <Money cents={pg.monto_prestamo_cents} currency={p.moneda} /> a {Number(pg.tasa_cambio).toLocaleString('es-VE')}</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {toDisplayDate(pg.fecha)} · {METODO_PAGO[pg.metodo]}{pg.referencia ? ` · Ref. ${pg.referencia}` : ''}{pg.tipo === 'abono_capital' ? ' · Abono a capital' : ''}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Capital <Money cents={porConcepto.capital} currency={p.moneda} /> · Interés <Money cents={porConcepto.interes} currency={p.moneda} />
                      {porConcepto.mora > 0 && <> · Mora <Money cents={porConcepto.mora} currency={p.moneda} /></>}
                      {porConcepto.descuento_interes > 0 && <> · Interés descontado <Money cents={porConcepto.descuento_interes} currency={p.moneda} /></>}
                    </p>
                    {pg.estado === 'anulado' && <p className="text-xs font-semibold text-red-700 dark:text-red-300">Anulado: {pg.anulado_motivo}</p>}
                  </div>
                  {pg === ultimoPago && (
                    <button type="button" className="btn-ghost self-start text-red-700 dark:text-red-300" disabled={busy} onClick={() => anularPago(pg)}>Anular pago</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {p.estado === 'activo' && pagosAplicados.length === 0 && !pagos.loading && (
        <button type="button" className="btn-ghost text-red-700 dark:text-red-300" disabled={busy} onClick={anularPrestamo}>Anular préstamo</button>
      )}
    </div>
  );
}
