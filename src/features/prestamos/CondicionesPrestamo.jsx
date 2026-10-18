import { ArrowRightLeft, CalendarDays, Landmark, Percent, ShieldAlert, Wallet } from 'lucide-react';
import { toDisplayDate } from '../../../shared/finance/dates.js';
import { FRECUENCIA_ADJETIVO, MODALIDADES_TASA } from '../../../shared/catalogos.js';
import { Card, Money } from '../cartera/ui';

function Condicion({ icono: Icono, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        <Icono size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
        <dd className="text-sm font-semibold text-[#222222] dark:text-white">{children}</dd>
      </div>
    </div>
  );
}

/** Condiciones pactadas del préstamo, con iconos para leerlas rápido. */
export function CondicionesPrestamo({ p }) {
  const abierto = p.tipo_plazo === 'abierto';
  const mora = Number(p.tasa_mora_diaria);
  return (
    <Card title="Condiciones">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Condicion icono={Wallet} label="Capital prestado"><Money cents={p.capital_cents} currency={p.moneda} /></Condicion>
        <Condicion icono={Landmark} label={abierto ? 'Interés generado' : 'Interés pactado'}>
          <Money cents={abierto ? p.interes_generado_cents : p.interes_total_cents} currency={p.moneda} />
        </Condicion>
        <Condicion icono={Percent} label="Tasa">
          {Number(p.tasa_interes).toLocaleString('es-VE')} % {MODALIDADES_TASA[p.modalidad_tasa]?.toLowerCase()} · {p.metodo_interes === 'saldo_insoluto' ? 'sobre saldo' : 'fijo'}
        </Condicion>
        <Condicion icono={CalendarDays} label="Vigencia">
          {abierto
            ? `Desde ${toDisplayDate(p.fecha_inicio)} · sin fecha de fin · cobro ${FRECUENCIA_ADJETIVO[p.frecuencia_pago]}`
            : `${toDisplayDate(p.fecha_inicio)} → ${toDisplayDate(p.fecha_fin)} · cuotas ${FRECUENCIA_ADJETIVO[p.frecuencia_pago]}s`}
        </Condicion>
        <Condicion icono={ArrowRightLeft} label="Tasa de cambio al desembolso">
          {Number(p.tasa_cambio).toLocaleString('es-VE')} Bs/USD <span className="font-normal text-slate-500 dark:text-slate-400">({p.fuente_tasa_cambio})</span>
        </Condicion>
        <Condicion icono={ShieldAlert} label="Mora por atraso">
          {mora > 0 ? `${mora.toLocaleString('es-VE')} % diario · ${p.dias_gracia} días de gracia` : 'Sin mora'}
        </Condicion>
      </dl>
      {p.notas && <p className="mt-4 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">{p.notas}</p>}
    </Card>
  );
}
