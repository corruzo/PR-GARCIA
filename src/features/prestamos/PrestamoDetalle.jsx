import { ArrowLeft, MessageCircle } from 'lucide-react';
import { todayCaracas } from '../../../shared/finance/dates.js';
import { buildPaymentReminder, toWhatsAppNumber } from '../../../shared/finance/report.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { useAccion } from '../cartera/useAccion';
import { useMotivoDialog } from '../cartera/useMotivoDialog';
import { Card, ErrorBox, Loading, Money, PageHeader, PrestamoBadge } from '../cartera/ui';
import { RegistrarPagoForm } from './RegistrarPagoForm';
import { PagosRecibidos } from './PagosRecibidos';
import { TablaCuotas } from './TablaCuotas';
import { ResumenPrestamo } from './ResumenPrestamo';
import { CondicionesPrestamo } from './CondicionesPrestamo';
import { LineaCuotas } from './LineaCuotas';
import { progresoPrestamo } from './progreso';
import { interesAdelantadoCents, interesExigibleCents } from './cuotas';

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
  const progreso = progresoPrestamo(p, cuotas.data ?? [], todayCaracas());
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

      <ResumenPrestamo p={p} progreso={progreso} />

      <CondicionesPrestamo p={p} />

      <ErrorBox message={accion.error} />

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6">
        <Card title={abierto ? 'Intereses por período' : 'Cronograma'} className="mb-5 lg:mb-0">
          {abierto && (
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Capital pendiente: <Money className="font-semibold" cents={p.capital_pendiente_cents} currency={p.moneda} />.
              Cada período cobra interés sobre lo que se debe al empezar; los abonos lo reducen desde el día del pago.
            </p>
          )}
          {cuotas.data && <LineaCuotas cuotas={cuotas.data} conteo={progreso.conteo} abierto={abierto} />}
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
