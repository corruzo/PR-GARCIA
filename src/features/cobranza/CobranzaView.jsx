import { useMemo } from 'react';
import { MessageCircle } from 'lucide-react';
import { addDaysISO, todayCaracas, toDisplayDate } from '../../../shared/finance/dates.js';
import { AGING_LABELS, buildPaymentReminder, toWhatsAppNumber } from '../../../shared/finance/report.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { Badge, Card, Empty, ErrorBox, Loading, Money, PageHeader } from '../cartera/ui';

const GRUPOS = [
  { key: 'vencida', title: 'Vencidas', tone: 'red' },
  { key: 'vence_hoy', title: 'Vencen hoy', tone: 'amber' },
  { key: 'por_vencer', title: 'Próximos 7 días', tone: 'blue' },
];

function loadCobranza() {
  const hasta = addDaysISO(todayCaracas(), 7);
  return Promise.all([api.listCuotasPendientes({ hasta }), api.listPrestamos(), api.getAntiguedad()])
    .then(([cuotas, prestamos, antiguedad]) => ({ cuotas, prestamos, antiguedad }));
}

export function CobranzaView({ navigate }) {
  const remote = useRemote(loadCobranza, []);

  const grupos = useMemo(() => {
    if (!remote.data) return null;
    const porId = new Map(remote.data.prestamos.filter((p) => p.estado === 'activo').map((p) => [p.id, p]));
    const result = Object.fromEntries(GRUPOS.map((g) => [g.key, []]));
    for (const cuota of remote.data.cuotas) {
      const prestamo = porId.get(cuota.prestamo_id);
      if (prestamo && result[cuota.situacion]) result[cuota.situacion].push({ ...cuota, prestamo });
    }
    result.vencida.sort((a, b) => b.dias_atraso - a.dias_atraso);
    return result;
  }, [remote.data]);

  const antiguedad = useMemo(() => {
    const byCurrency = {};
    for (const row of remote.data?.antiguedad ?? []) {
      (byCurrency[row.moneda] ??= []).push(row);
    }
    for (const rows of Object.values(byCurrency)) rows.sort((a, b) => a.tramo.localeCompare(b.tramo));
    return byCurrency;
  }, [remote.data]);

  if (remote.loading) return <Loading label="Preparando la agenda de cobranza…" />;
  if (remote.error) return <ErrorBox message={remote.error} onRetry={remote.reload} />;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Cobranza" subtitle={`Agenda al ${toDisplayDate(todayCaracas())}: atrasos y vencimientos de la semana.`}
        actions={<button type="button" className="btn-secondary" onClick={remote.reload}>Actualizar</button>} />

      {Object.keys(antiguedad).length > 0 && (
        <Card title="Antigüedad de la cartera">
          <div className="space-y-4">
            {Object.entries(antiguedad).map(([moneda, rows]) => (
              <div key={moneda} className="-mx-5 overflow-x-auto">
                <table className="w-full text-xs">
                  <caption className="px-5 pb-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200">Préstamos en {moneda}</caption>
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th scope="col" className="px-5 py-2">Atraso</th>
                      <th scope="col" className="px-3 py-2 text-right">Préstamos</th>
                      <th scope="col" className="px-3 py-2 text-right">Capital pendiente</th>
                      <th scope="col" className="px-5 py-2 text-right">Exigible hoy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.tramo} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <th scope="row" className="px-5 py-2 text-left font-semibold">{AGING_LABELS[row.tramo]}</th>
                        <td className="px-3 py-2 text-right num">{row.prestamos}</td>
                        <td className="px-3 py-2 text-right"><Money cents={row.capital_pendiente_cents} currency={moneda} /></td>
                        <td className="px-5 py-2 text-right"><Money cents={row.exigible_hoy_cents} currency={moneda} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Card>
      )}

      {GRUPOS.map((grupo) => (
        <Card key={grupo.key} title={`${grupo.title} (${grupos[grupo.key].length})`}>
          {grupos[grupo.key].length === 0 ? (
            <Empty title={grupo.key === 'vencida' ? 'Sin cuotas vencidas 🎉' : 'Nada en este grupo'} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {grupos[grupo.key].map((c) => {
                const p = c.prestamo;
                const pendiente = c.capital_pendiente_cents + c.interes_pendiente_cents + c.mora_pendiente_cents;
                const whatsapp = toWhatsAppNumber(p.cliente_telefono);
                const mensaje = buildPaymentReminder({
                  clienteNombre: p.cliente_nombre, numero: p.numero, moneda: p.moneda,
                  exigibleCents: grupo.key === 'vencida' ? p.exigible_hoy_cents : pendiente,
                  moraCents: grupo.key === 'vencida' ? p.mora_pendiente_cents : 0,
                  proximoVencimiento: c.fecha_vencimiento, diasAtraso: grupo.key === 'vencida' ? c.dias_atraso : 0,
                });
                return (
                  <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <button type="button" className="text-left" onClick={() => navigate('prestamos', p.id)}>
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">{p.cliente_nombre}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Préstamo #{p.numero} · cuota {c.numero} · {toDisplayDate(c.fecha_vencimiento)}
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-right">
                        <Money className="block text-sm font-bold" cents={pendiente} currency={p.moneda} />
                        {c.mora_pendiente_cents > 0 && <span className="text-[11px] text-red-700 dark:text-red-300">incl. mora <Money cents={c.mora_pendiente_cents} currency={p.moneda} /></span>}
                      </span>
                      {grupo.key === 'vencida' && <Badge tone="red">{c.dias_atraso} d</Badge>}
                      {whatsapp ? (
                        <a className="btn-ghost border border-slate-200 dark:border-slate-700" href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(mensaje)}`}
                          target="_blank" rel="noopener noreferrer" aria-label={`Enviar recordatorio por WhatsApp a ${p.cliente_nombre}`}>
                          <MessageCircle size={16} /> WhatsApp
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Sin teléfono</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}
