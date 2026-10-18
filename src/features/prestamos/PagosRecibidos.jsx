import { toDisplayDate } from '../../../shared/finance/dates.js';
import { METODOS_PAGO } from '../../../shared/catalogos.js';
import { Empty, ErrorBox, Loading, Money } from '../cartera/ui';

const CONCEPTOS = ['mora', 'interes', 'capital', 'descuento_interes'];

function totalesPorConcepto(pago) {
  return Object.fromEntries(CONCEPTOS.map((k) => [k,
    pago.aplicaciones_pago.filter((a) => a.concepto === k).reduce((s, a) => s + a.monto_cents, 0)]));
}

/**
 * Pagos recibidos de un préstamo. Solo el último pago aplicado se anula solo;
 * los anteriores se corrigen anulando también los posteriores.
 */
export function PagosRecibidos({ pagos, moneda, busy, onAnular, onAnularDesde }) {
  if (pagos.loading) return <Loading />;
  if (pagos.error) return <ErrorBox message={pagos.error} onRetry={pagos.reload} />;
  if (pagos.data.length === 0) return <Empty title="Sin pagos registrados" />;
  const ultimoAplicado = pagos.data.find((pg) => pg.estado === 'aplicado');
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {pagos.data.map((pg) => {
        const t = totalesPorConcepto(pg);
        return (
          <li key={pg.id} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${pg.estado === 'anulado' ? 'opacity-60' : ''}`}>
            <div className="text-sm">
              <p className="font-bold text-slate-900 dark:text-white">
                <Money cents={pg.monto_pago_cents} currency={pg.moneda_pago} />
                {pg.moneda_pago !== moneda && <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">→ <Money cents={pg.monto_prestamo_cents} currency={moneda} /> a {Number(pg.tasa_cambio).toLocaleString('es-VE')}</span>}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {toDisplayDate(pg.fecha)} · {METODOS_PAGO[pg.metodo]}{pg.referencia ? ` · Ref. ${pg.referencia}` : ''}{pg.tipo === 'abono_capital' ? ' · Abono a capital' : ''}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Capital <Money cents={t.capital} currency={moneda} /> · Interés <Money cents={t.interes} currency={moneda} />
                {t.mora > 0 && <> · Mora <Money cents={t.mora} currency={moneda} /></>}
                {t.descuento_interes > 0 && <> · Interés descontado <Money cents={t.descuento_interes} currency={moneda} /></>}
              </p>
              {pg.estado === 'anulado' && <p className="text-xs font-semibold text-red-700 dark:text-red-300">Anulado: {pg.anulado_motivo}</p>}
            </div>
            {pg === ultimoAplicado && (
              <button type="button" className="btn-ghost self-start text-red-700 dark:text-red-300" disabled={busy} onClick={() => onAnular(pg)}>Anular pago</button>
            )}
            {pg.estado === 'aplicado' && pg !== ultimoAplicado && (
              <button type="button" className="btn-ghost self-start text-xs text-red-700 dark:text-red-300" disabled={busy} onClick={() => onAnularDesde(pg)}>Anular este y los posteriores</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
