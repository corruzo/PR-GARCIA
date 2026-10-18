import { toDisplayDate } from '../../../shared/finance/dates.js';
import { SITUACION } from '../cartera/helpers';
import { Badge, ErrorBox, Loading, Money } from '../cartera/ui';

/** Tabla de cuotas (o períodos de interés de un préstamo abierto). */
export function TablaCuotas({ cuotas, moneda, abierto }) {
  if (cuotas.loading) return <Loading />;
  if (cuotas.error) return <ErrorBox message={cuotas.error} onRetry={cuotas.reload} />;
  return (
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
                <td className="px-3 py-2 text-right"><Money cents={c.capital_cents + c.interes_cents - c.interes_descontado_cents} currency={moneda} /></td>
                <td className="px-3 py-2 text-right">
                  <Money cents={pend} currency={moneda} />
                  {c.mora_pendiente_cents > 0 && <span className="block text-[10px] text-red-700 dark:text-red-300">mora <Money cents={c.mora_pendiente_cents} currency={moneda} /></span>}
                </td>
                <td className="px-3 py-2"><Badge tone={situacion.tone}>{situacion.label}{c.situacion === 'vencida' ? ` · ${c.dias_atraso} d` : ''}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
