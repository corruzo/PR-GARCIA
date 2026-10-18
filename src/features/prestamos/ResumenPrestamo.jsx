import { AlertTriangle, CalendarClock, CheckCircle2, Clock } from 'lucide-react';
import { toDisplayDate } from '../../../shared/finance/dates.js';
import { PERIODO } from '../../../shared/catalogos.js';
import { Money } from '../cartera/ui';

const porcentaje = (v) => `${Math.round(v)} %`;

/**
 * Barra de avance: relleno y pista son pasos del mismo color de marca, así el
 * estado se lee en toda la barra. El texto (no el color) lleva el dato.
 */
function Meter({ valor, etiqueta, detalle, pie }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{etiqueta}</span>
        <span className="text-slate-500 dark:text-slate-400">{detalle}</span>
      </div>
      <div className="h-2.5 rounded-full bg-brand-100 dark:bg-brand-950" role="progressbar"
        aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(valor)}>
        <div className="h-full rounded-full bg-brand-700 transition-[width] duration-500 dark:bg-brand-400" style={{ width: `${valor}%` }} />
      </div>
      {pie && <div className="mt-1.5 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">{pie}</div>}
    </div>
  );
}

function Dato({ label, children, tono }) {
  const color = tono === 'alerta' ? 'text-red-700 dark:text-red-300' : 'text-[#222222] dark:text-white';
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 sm:p-3">
      <span className="block truncate text-[10px] font-semibold uppercase tracking-wide sm:text-[11px] text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`mt-0.5 block truncate text-sm font-bold sm:text-base ${color}`}>{children}</span>
    </div>
  );
}

function enDias(dias) {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias > 1) return `en ${dias} días`;
  return dias === -1 ? 'hace 1 día' : `hace ${-dias} días`;
}

/** Próximo vencimiento o aviso de atraso (icono + texto, nunca solo color). */
function Proximo({ p, proxima }) {
  if (p.estado === 'pagado') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <CheckCircle2 size={20} aria-hidden="true" /> <span><strong>Préstamo pagado.</strong> No hay saldo pendiente.</span>
      </div>
    );
  }
  if (!proxima) return null;
  const atrasado = p.cuotas_vencidas > 0;
  const estilo = atrasado
    ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100'
    : proxima.dias <= 2
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
      : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100';
  const Icono = atrasado ? AlertTriangle : proxima.dias <= 2 ? Clock : CalendarClock;
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${estilo}`} role={atrasado ? 'alert' : undefined}>
      <Icono size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {atrasado ? (
          <p><strong>En mora: {p.cuotas_vencidas} {p.cuotas_vencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'}</strong> · {p.dias_atraso} días de atraso.
            {' '}Exigible hoy <Money className="font-bold" cents={p.exigible_hoy_cents} currency={p.moneda} />.</p>
        ) : (
          <p><strong>Próximo cobro {enDias(proxima.dias)}</strong> ({toDisplayDate(proxima.fecha)}) · <Money className="font-bold" cents={proxima.montoCents} currency={p.moneda} /></p>
        )}
      </div>
    </div>
  );
}

/**
 * Cabecera visual del préstamo: saldo pendiente como cifra principal, avance
 * de cobro y de plazo, próximo vencimiento y datos clave.
 */
export function ResumenPrestamo({ p, progreso }) {
  const abierto = p.tipo_plazo === 'abierto';
  const { plazo } = progreso;
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Saldo pendiente</span>
          <p className="mt-1 text-4xl font-bold leading-none text-[#222222] dark:text-white sm:text-5xl">
            <Money cents={p.estado === 'anulado' ? 0 : progreso.pendienteCents} currency={p.moneda} className="[font-variant-numeric:normal]" />
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Capital <Money cents={p.capital_pendiente_cents} currency={p.moneda} /> · Interés <Money cents={p.interes_pendiente_cents} currency={p.moneda} />
            {p.mora_pendiente_cents > 0 && <> · Mora <Money cents={p.mora_pendiente_cents} currency={p.moneda} /></>}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[22rem]">
          <Dato label="Exigible hoy" tono={p.exigible_hoy_cents > 0 ? 'alerta' : undefined}><Money cents={p.exigible_hoy_cents} currency={p.moneda} /></Dato>
          <Dato label="Mora" tono={p.mora_pendiente_cents > 0 ? 'alerta' : undefined}><Money cents={p.mora_pendiente_cents} currency={p.moneda} /></Dato>
          <Dato label="Cobrado"><Money cents={p.cobrado_cents} currency={p.moneda} /></Dato>
        </div>
      </div>

      {p.estado !== 'anulado' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {abierto ? (
            <Meter valor={progreso.capitalDevueltoPct} etiqueta="Capital devuelto"
              detalle={<><Money cents={progreso.capitalDevueltoCents} currency={p.moneda} /> de <Money cents={p.capital_cents} currency={p.moneda} /> · {porcentaje(progreso.capitalDevueltoPct)}</>} />
          ) : (
            <Meter valor={progreso.cobradoPct} etiqueta="Cobrado del total"
              detalle={<><Money cents={p.cobrado_cents} currency={p.moneda} /> · {porcentaje(progreso.cobradoPct)}</>} />
          )}
          {plazo.abierto ? (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="mb-1.5 block font-semibold text-slate-700 dark:text-slate-200">Plazo</span>
              Sin fecha de fin · desde {toDisplayDate(p.fecha_inicio)} ({plazo.transcurridos} días) · interés cada {PERIODO[p.frecuencia_pago]}.
              {' '}{p.cuotas_pagadas} de {p.cuotas_total} {p.cuotas_total === 1 ? 'período pagado' : 'períodos pagados'}.
            </div>
          ) : (
            <Meter valor={plazo.pct} etiqueta="Tiempo del préstamo"
              detalle={plazo.restantes >= 0
                ? `Día ${plazo.transcurridos} de ${plazo.dias} · faltan ${plazo.restantes} · ${p.cuotas_pagadas}/${p.cuotas_total} cuotas`
                : `Terminó el ${toDisplayDate(p.fecha_fin)} · ${p.cuotas_pagadas}/${p.cuotas_total} cuotas`}
              pie={<><span>{toDisplayDate(p.fecha_inicio)}</span><span>{toDisplayDate(p.fecha_fin)}</span></>} />
          )}
        </div>
      )}

      <Proximo p={p} proxima={progreso.proxima} />
    </section>
  );
}
