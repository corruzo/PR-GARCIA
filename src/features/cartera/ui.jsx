import { AlertCircle, Inbox } from 'lucide-react';
import { formatCents } from '../../../shared/finance/report.js';
import { ESTADO_PRESTAMO } from './helpers';

export function Money({ cents, currency, className = '' }) {
  return <span className={`num whitespace-nowrap ${className}`}>{formatCents(cents, currency)}</span>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900/90 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-5 py-3.5 dark:border-slate-800">
          {title && <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Loading({ label = 'Cargando…' }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <span className="flex items-start gap-2"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="btn-secondary">Reintentar</button>}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
      <Inbox size={28} className="text-slate-400" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {children && <div className="text-xs text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

const BADGE_STYLES = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
  red: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800',
  amber: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  gray: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  blue: 'bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800',
};

export function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${BADGE_STYLES[tone]}`}>
      {children}
    </span>
  );
}

export function PrestamoBadge({ prestamo }) {
  if (prestamo.estado === 'activo' && prestamo.cuotas_vencidas > 0) {
    return <Badge tone="red">En mora · {prestamo.dias_atraso} d</Badge>;
  }
  const estado = ESTADO_PRESTAMO[prestamo.estado] ?? ESTADO_PRESTAMO.activo;
  return <Badge tone={estado.tone}>{estado.label}</Badge>;
}

/** Campo de formulario con etiqueta, ayuda y error asociados. */
export function Field({ id, label, error, hint, children }) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="label-base">{label}</label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

export function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div>
      <span className="label-base">{label}</span>
      <div role="group" aria-label={label} className="grid gap-1 rounded-xl border border-slate-200/60 bg-slate-100 p-1 dark:border-slate-700/60 dark:bg-slate-800/80" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-2 py-2 text-xs font-bold transition-all ${value === option.value ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
