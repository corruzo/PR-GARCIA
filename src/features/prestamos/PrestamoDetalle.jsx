import { ArrowLeft, MessageCircle } from 'lucide-react';
import { toDisplayDate } from '../../../shared/finance/dates.js';
import { buildPaymentReminder, toWhatsAppNumber } from '../../../shared/finance/report.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { useAccion } from '../cartera/useAccion';
import { useMotivoDialog } from '../cartera/useMotivoDialog';
import { Card, ErrorBox, Loading, Money, PageHeader, PrestamoBadge } from '../cartera/ui';
import { RegistrarPagoForm } from './RegistrarPagoForm';
import { PagosRecibidos } from './PagosRecibidos';
import { TablaCuotas } from './TablaCuotas';
import { interesAdelantadoCents, interesExigibleCents } from './cuotas';

function Stat({ label, children, tone }) {
  return (
    <div className="result-card compact-result-card">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</span>
      <div className={`mt-1 text-base font-bold ${tone === 'red' ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>{children}</div>
    </div>
  );
}

export function PrestamoDetalle({ id, navigate }) {
  const prestamo = useRemote(() => api.getPrestamo(id), [id]);
  const cuotas = useRemote(() => api.listCuotas(id), [id]);
  const pagos = useRemote(() => api.listPagos(id), [id]);
  const accion = useAccion();
  const motivo = useMotivoDialog();

  const reloadAll = () => { prestamo.reload(); cuotas.reload(); pagos.reload(); };

  if (prestamo.loading) return <Loading label="Cargando préstamo…" />;
  if (prestamo.error) return <ErrorBox message={prestamo.error} onRetry={prestamo.reload} />;
  const p = prestamo.data;
  const abierto = p.tipo_plazo === 'abierto';
  const pendiente = p.capital_pendiente_cents + p.interes_pendiente_cents + p.mora_pendiente_cents;
  const pagosAplicados = (pagos.data ?? []).filter((pg) => pg.estado === 'aplicado');
  const whatsapp = toWhatsAppNumber(p.cliente_telefono);
  const recordatorio = buildPaymentReminder({
    clienteNombre: p.cliente_nombre, numero: p.numero, moneda: p.moneda,
    exigibleCents: p.exigible_hoy_cents || 0, moraCents: p.mora_pendiente_cents,
    proximoVencimiento: p.proximo_vencimiento, diasAtraso: p.cuotas_vencidas > 0 ? p.dias_atraso : 0,
  });

  const anularPago = async (pago) => {
    const texto = await motivo.pedir({ titulo: 'Anular pago', aviso: 'Se revierten su aplicación y su asiento contable.' });
    if (texto) accion.run(() => api.anularPago(pago.id, texto), reloadAll);
  };

  // Corregir un pago antiguo: se anulan también los posteriores (se aplican en orden).
  const anularDesde = async (pago) => {
    const posteriores = pagosAplicados.indexOf(pago);
    const cuantos = posteriores === 1 ? 'el pago posterior' : `los ${posteriores} pagos posteriores`;
    const texto = await motivo.pedir({
      titulo: 'Anular este pago y los posteriores',
      aviso: `Para corregir este pago se anulará también ${cuantos}. Luego podrás registrarlos de nuevo.`,
    });
    if (texto) accion.run(() => api.anularPagosDesde(pago.id, texto), reloadAll);
  };

  const anularPrestamo = async () => {
    const texto = await motivo.pedir({ titulo: 'Anular préstamo', aviso: 'El préstamo queda anulado y se revierte el desembolso.' });
    if (texto) accion.run(() => api.anularPrestamo(p.id, texto), reloadAll);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <button type="button" className="btn-ghost -ml-3" onClick={() => navigate('prestamos')}><ArrowLeft size={16} /> Préstamos</button>
      <PageHeader
        title={`Préstamo #${p.numero}`}
        subtitle={(
          <button type="button" className="underline" onClick={() => navigate('clientes', p.cliente_id)}>{p.cliente_nombre}{p.cliente_documento ? ` · ${p.cliente_documento}` : ''}</button>
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

      <ErrorBox message={accion.error} />

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6">
        <Card title={abierto ? 'Intereses por período' : 'Cronograma'} className="mb-5 lg:mb-0">
          {abierto && (
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Capital pendiente: <Money className="font-semibold" cents={p.capital_pendiente_cents} currency={p.moneda} />.
              Cada período cobra interés sobre lo que se debe al empezar; los abonos lo reducen desde el día del pago.
            </p>
          )}
          <TablaCuotas cuotas={cuotas} moneda={p.moneda} abierto={abierto} />
        </Card>

        {p.estado === 'activo' && (
          <Card title="Registrar pago">
            <RegistrarPagoForm prestamo={p} onSaved={reloadAll}
              interesExigibleCents={interesExigibleCents(cuotas.data ?? [])}
              interesAdelantadoCents={interesAdelantadoCents(cuotas.data ?? [])} />
          </Card>
        )}
      </div>

      <Card title="Pagos recibidos">
        <PagosRecibidos pagos={pagos} moneda={p.moneda} busy={accion.busy} onAnular={anularPago} onAnularDesde={anularDesde} />
      </Card>

      {p.estado === 'activo' && pagosAplicados.length === 0 && !pagos.loading && (
        <button type="button" className="btn-ghost text-red-700 dark:text-red-300" disabled={accion.busy} onClick={anularPrestamo}>Anular préstamo</button>
      )}
      {motivo.dialogo}
    </div>
  );
}
