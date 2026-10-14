import { requiereConfirmarTasa } from './helpers';
import { Field } from './ui';

// La tasa se guarda con hora UTC; se muestra el día de Caracas.
const fechaCaracas = (iso) => new Date(iso).toLocaleDateString('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Campo de tasa de cambio con la tasa BCV de referencia a la vista. Si la tasa
 * escrita se aleja más del 20 % de la BCV, pide confirmarla (evita errores de
 * tipeo como 3,6 en lugar de 36).
 */
export function TasaCambioField({ id, label = 'Tasa del día (Bs/USD)', value, tasa, onChange, referencia, confirmada, onConfirmar, error, hint }) {
  const confirmar = requiereConfirmarTasa(tasa, referencia);
  const refTexto = referencia
    ? `${referencia.oficial ? 'BCV' : 'Referencial'} del ${fechaCaracas(referencia.fecha)}: ${Number(referencia.tasa).toLocaleString('es-VE', { maximumFractionDigits: 4 })}`
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
      {confirmar && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <input type="checkbox" className="mt-0.5" checked={Boolean(confirmada)} onChange={(e) => onConfirmar(e.target.checked)} />
          <span>Esta tasa se aleja más del 20 % de la tasa BCV. Confirmo que es correcta.</span>
        </label>
      )}
    </div>
  );
}
