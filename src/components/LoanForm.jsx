import { DollarSign, Calendar, Percent, CheckCircle2 } from 'lucide-react';
import { handleRadioKeyDown } from '../utils/keyboardTabs';
import { FRECUENCIAS as CAT_FRECUENCIAS, METODOS_INTERES, MODALIDADES_TASA, TIPOS_PLAZO, opciones } from '../../shared/catalogos.js';

const MODALIDADES = opciones(MODALIDADES_TASA);
const METODOS = opciones(METODOS_INTERES);
const PLAZOS = opciones(TIPOS_PLAZO);
const FRECUENCIAS = opciones(CAT_FRECUENCIAS);

export function LoanForm({ values, onChange }) {
  const set = (key) => (e) => {
    let val = e?.target ? e.target.value : e;
    if (typeof val === 'string') {
      val = val.replace(',', '.');
    }
    onChange(key, val);
  };

  const hasCapital = parseFloat(values.monto) > 0;
  const hasCondiciones = hasCapital && parseFloat(values.tasa) > 0;
  const esAbierto = values.tipoPlazo === 'abierto';
  const hasFechas = hasCondiciones && values.fechaInicio
    && (esAbierto || (values.fechaFin && new Date(values.fechaFin) >= new Date(values.fechaInicio)));

  return (
    <div className="space-y-5">
      
      {/* ── SECCIÓN 1: CAPITAL Y MONEDA ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs overflow-hidden transition-all duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <DollarSign size={18} />
            </div>
            <h3 className="text-base font-semibold text-[#222222] dark:text-white">
              1. Monto
            </h3>
          </div>
          {hasCapital && (
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2.5 py-1 rounded-full border border-brand-200/60 dark:border-brand-800/60">
              <CheckCircle2 size={14} />
              <span>Completo</span>
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Selector de Moneda */}
          <div>
            <span id="label-moneda-prestamo" className="label-base">Moneda de Préstamo</span>
            <div role="group" aria-labelledby="label-moneda-prestamo" className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                aria-pressed={values.moneda === 'USD'}
                onClick={() => onChange('moneda', 'USD')}
                className={`py-2 px-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  values.moneda === 'USD'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>$ USD</span>
                <span className="text-[10px] font-normal opacity-80 uppercase tracking-wider">(Dólares)</span>
              </button>
              <button
                type="button"
                aria-pressed={values.moneda === 'VES'}
                onClick={() => onChange('moneda', 'VES')}
                className={`py-2 px-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                  values.moneda === 'VES'
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Bs. VES</span>
                <span className="text-[10px] font-normal opacity-80 uppercase tracking-wider">(Bolívares)</span>
              </button>
            </div>
          </div>

          {/* Campo de Monto */}
          <div>
            <label htmlFor="input-monto" className="label-base">Monto del Préstamo</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-500 dark:text-slate-400 font-bold text-sm select-none">
                {values.moneda === 'USD' ? '$' : 'Bs.'}
              </span>
              <input
                id="input-monto"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={Number.MAX_SAFE_INTEGER}
                placeholder="0.00"
                value={values.monto}
                onChange={set('monto')}
                className="input-base pl-10 text-base font-bold tabular-nums"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 2: CONDICIONES DEL INTERÉS ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs overflow-hidden transition-all duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Percent size={18} />
            </div>
            <h3 className="text-base font-semibold text-[#222222] dark:text-white">
              2. Tasa
            </h3>
          </div>
          {hasCondiciones && (
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2.5 py-1 rounded-full border border-brand-200/60 dark:border-brand-800/60">
              <CheckCircle2 size={14} />
              <span>Completo</span>
            </span>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tasa de interés */}
          <div>
            <label htmlFor="input-tasa" className="label-base">Tasa de Interés (%)</label>
            <div className="relative flex items-center">
              <input
                id="input-tasa"
                type="number"
                inputMode="decimal"
                min="0.000001"
                max={Number.MAX_SAFE_INTEGER}
                placeholder="Ej. 7"
                value={values.tasa}
                onChange={set('tasa')}
                className="input-base pr-8 font-bold tabular-nums"
              />
              <span className="absolute right-3.5 text-slate-400 font-bold text-sm select-none">%</span>
            </div>
          </div>

          {/* Modalidad de Tasa */}
          <div>
            <label htmlFor="input-modalidad" className="label-base">Modalidad de Tasa</label>
            <div className="relative flex items-center">
              <select
                id="input-modalidad"
                value={values.modalidadTasa}
                onChange={set('modalidadTasa')}
                className="input-base appearance-none cursor-pointer pr-9 font-medium"
              >
                {MODALIDADES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3.5 text-slate-400">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Método de interés (los préstamos abiertos siempre cobran sobre el saldo) */}
          {!esAbierto && <div className="sm:col-span-2">
            <span id="label-metodo-interes" className="label-base">Cálculo del Interés</span>
            <div role="radiogroup" aria-labelledby="label-metodo-interes" className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {METODOS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={values.metodoInteres === m.value}
                  tabIndex={values.metodoInteres === m.value ? 0 : -1}
                  onKeyDown={handleRadioKeyDown}
                  onClick={() => onChange('metodoInteres', m.value)}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                    values.metodoInteres === m.value
                      ? 'bg-brand-700 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {values.metodoInteres === 'saldo_insoluto'
                ? 'El interés se calcula solo sobre el capital que falta por pagar: cada abono reduce los intereses.'
                : 'El interés se calcula sobre el capital inicial durante todo el plazo, aunque haya abonos.'}
            </p>
          </div>}
        </div>
      </div>

      {/* ── SECCIÓN 3: FRECUENCIA Y PLAZOS ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs overflow-hidden transition-all duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Calendar size={18} />
            </div>
            <h3 className="text-base font-semibold text-[#222222] dark:text-white">
              3. Plazo
            </h3>
          </div>
          {hasFechas && (
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 px-2.5 py-1 rounded-full border border-brand-200/60 dark:border-brand-800/60">
              <CheckCircle2 size={14} />
              <span>Completo</span>
            </span>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo de plazo */}
          <div>
            <span id="label-tipo-plazo" className="label-base">Plazo</span>
            <div role="radiogroup" aria-labelledby="label-tipo-plazo" className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {PLAZOS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={values.tipoPlazo === p.value}
                  tabIndex={values.tipoPlazo === p.value ? 0 : -1}
                  onKeyDown={handleRadioKeyDown}
                  onClick={() => onChange('tipoPlazo', p.value)}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                    values.tipoPlazo === p.value
                      ? 'bg-brand-700 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              {esAbierto
                ? 'El cliente paga cuando pueda: cada período genera interés sobre el capital que aún debe, hasta que lo pague completo.'
                : 'El capital y los intereses se reparten en cuotas hasta la fecha de vencimiento.'}
            </p>
          </div>

          {/* Frecuencia de Cobro */}
          <div>
            <span id="label-frecuencia-cuotas" className="label-base">{esAbierto ? 'Cobro de intereses' : 'Frecuencia de Cuotas'}</span>
            <div role="radiogroup" aria-labelledby="label-frecuencia-cuotas" className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              {FRECUENCIAS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  role="radio"
                  aria-checked={values.frecuenciaPago === f.value}
                  tabIndex={values.frecuenciaPago === f.value ? 0 : -1}
                  onKeyDown={handleRadioKeyDown}
                  onClick={() => onChange('frecuenciaPago', f.value)}
                  className={`py-2 px-2 text-xs font-bold rounded-lg transition-all text-center ${
                    values.frecuenciaPago === f.value
                      ? 'bg-brand-700 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas de Emisión y Vencimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-fecha-inicio" className="label-base">Fecha de Emisión</label>
              <div className="relative flex items-center">
                <input
                  id="input-fecha-inicio"
                  type="date"
                  value={values.fechaInicio}
                  onChange={set('fechaInicio')}
                  className="input-base cursor-pointer font-medium"
                />
              </div>
            </div>

            {!esAbierto && (
              <div>
                <label htmlFor="input-fecha-fin" className="label-base">Fecha de Vencimiento</label>
                <div className="relative flex items-center">
                  <input
                    id="input-fecha-fin"
                    type="date"
                    value={values.fechaFin}
                    onChange={set('fechaFin')}
                    min={values.fechaInicio}
                    className="input-base cursor-pointer font-medium"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

