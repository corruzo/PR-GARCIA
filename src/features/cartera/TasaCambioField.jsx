import { requiereConfirmarTasa } from './helpers';
import { tasaATexto } from '../../services/tasaPersonalizada';
import { Field } from './ui';
import { toDisplayDateCaracas } from '../../../shared/finance/dates.js';

/**
 * Campo de tasa de cambio con la tasa BCV de referencia a la vista. Si la tasa
 * escrita se aleja más del 20 % de la BCV, pide confirmarla (evita errores de
 * tipeo como 3,6 en lugar de 36).
 */
export function TasaCambioField({ id, label = 'Tasa del día (Bs/USD)', value, tasa, onChange, referencia, personalizada, confirmada, onConfirmar, error, hint }) {
  // La tasa personalizada guardada por la persona ya está confirmada.
  const esPersonalizada = Boolean(personalizada && tasa === personalizada.tasa);
  const confirmar = !esPersonalizada && requiereConfirmarTasa(tasa, referencia);
  const refTexto = referencia
    ? `${referencia.oficial ? 'BCV' : 'Referencial'} del ${toDisplayDateCaracas(referencia.fecha)}: ${Number(referencia.tasa).toLocaleString('es-VE', { maximumFractionDigits: 4 })}`
    : 'Sin tasa BCV guardada: escríbela.';
  return (
    <div className="space-y-2">
      <Field id={id} label={label} error={error} hint={hint ? `${hint} ${refTexto}` : refTexto}>
        {(a11y) => <input {...a11y} className="input-base num" inputMode="decimal" value={value} onChange={onChange} />}
      </Field>
      {referencia && Number(referencia.tasa) !== tasa && (
        <button type="button" className="btn-ghost border border-slate-200 text-xs dark:border-slate-700"
          onClick={() => onChange({ target: { value: String(referencia.tasa).replace('.', ',') } })}>
          Usar tasa {referencia.oficial ? 'BCV' : 'de referencia'}
        </button>
      )}
      {personalizada && !esPersonalizada && (
        <button type="button" className="btn-ghost ml-2 border border-slate-200 text-xs dark:border-slate-700"
          onClick={() => onChange({ target: { value: tasaATexto(personalizada.tasa) } })}>
          Usar mi tasa ({Number(personalizada.tasa).toLocaleString('es-VE', { maximumFractionDigits: 4 })})
        </button>
      )}
      {esPersonalizada && (
        <p className="text-xs font-semibold text-brand-700 dark:text-brand-400">Tu tasa personalizada (se cambia tocando la tasa del encabezado).</p>
      )}
      {confirmar && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <input type="checkbox" className="mt-0.5" checked={Boolean(confirmada)} onChange={(e) => onConfirmar(e.target.checked)} />
          <span>Esta tasa se aleja más del 20 % de la tasa BCV. Confirmo que es correcta.</span>
        </label>
      )}
    </div>
  );
}
