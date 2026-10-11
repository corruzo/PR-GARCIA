import { useMemo, useState } from 'react';
import { parseAmountInput, parseRateInput } from '../../../shared/finance/input.js';
import { convertCents } from '../../../shared/finance/money.js';
import { todayCaracas } from '../../../shared/finance/dates.js';
import { getCachedBCV } from '../../services/bcvService';
import * as api from '../cartera/api';
import { newIdempotencyKey } from '../cartera/helpers';
import { ErrorBox, Field, Money, SegmentedControl } from '../cartera/ui';

const METODOS = [
  ['efectivo', 'Efectivo'], ['pago_movil', 'Pago móvil'], ['transferencia', 'Transferencia'], ['zelle', 'Zelle'], ['otro', 'Otro'],
];

export function RegistrarPagoForm({ prestamo, onSaved }) {
  const cached = getCachedBCV();
  const [form, setForm] = useState(() => ({
    moneda: prestamo.moneda, monto: '', tasaCambio: cached?.rate ? String(cached.rate) : String(prestamo.tasa_cambio),
    fecha: todayCaracas(), tipo: 'cuota', modoAbono: 'reducir_plazo', metodo: 'efectivo', referencia: '', notas: '',
  }));
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }));

  const parsed = useMemo(() => {
    const errors = {};
    const montoCents = parseAmountInput(form.monto);
    if (!montoCents) errors.monto = 'Ingresa un monto válido.';
    const tasaCambio = parseRateInput(form.tasaCambio);
    if (!tasaCambio) errors.tasaCambio = 'Ingresa la tasa del día.';
    if (!form.fecha || form.fecha > todayCaracas()) errors.fecha = 'La fecha no puede ser futura.';
    if (form.fecha && form.fecha < prestamo.fecha_inicio) errors.fecha = 'No puede ser anterior al desembolso.';
    if (form.referencia.length > 80 || /[<>]/.test(form.referencia)) errors.referencia = 'Máximo 80 caracteres, sin < ni >.';
    const enMonedaPrestamo = montoCents && tasaCambio ? convertCents(montoCents, tasaCambio, form.moneda, prestamo.moneda) : null;
    return { errors, montoCents, tasaCambio, enMonedaPrestamo };
  }, [form, prestamo]);

  const [cancelacion, setCancelacion] = useState({ loading: false, error: '' });
  const showErrors = touched ? parsed.errors : {};

  const fill = (cents) => {
    const tasa = parseRateInput(form.tasaCambio) || prestamo.tasa_cambio;
    const value = convertCents(cents, tasa, prestamo.moneda, form.moneda);
    setForm((prev) => ({ ...prev, monto: (value / 100).toFixed(2) }));
  };

  // Cancelación total: el servidor calcula capital + interés ganado + mora a la fecha.
  const cargarCancelacion = async () => {
    setCancelacion({ loading: true, error: '' });
    try {
      const cents = await api.montoCancelacion(prestamo.id, form.fecha);
      fill(cents);
      setForm((prev) => ({ ...prev, tipo: 'abono_capital', modoAbono: 'reducir_plazo' }));
      setCancelacion({ loading: false, error: '' });
    } catch (error) {
      setCancelacion({ loading: false, error: error.message });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(parsed.errors).length) return;
    setSaving(true);
    setSubmitError('');
    try {
      await api.registrarPago({
        prestamoId: prestamo.id, fecha: form.fecha, moneda: form.moneda, montoCents: parsed.montoCents,
        tasaCambio: parsed.tasaCambio, tipo: form.tipo, modoAbono: form.modoAbono, metodo: form.metodo,
        referencia: form.referencia.trim(), notas: form.notas.trim(), idempotencyKey,
      });
      setIdempotencyKey(newIdempotencyKey());
      setTouched(false);
      setForm((prev) => ({ ...prev, monto: '', referencia: '', notas: '' }));
      onSaved();
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <SegmentedControl label="Tipo" value={form.tipo} onChange={set('tipo')}
        options={[{ value: 'cuota', label: 'Pago de cuotas' }, { value: 'abono_capital', label: 'Abono a capital' }]} />
      {form.tipo === 'abono_capital' && (
        <SegmentedControl label="El abono reduce" value={form.modoAbono} onChange={set('modoAbono')}
          options={[{ value: 'reducir_plazo', label: 'El plazo' }, { value: 'reducir_cuota', label: 'Cada cuota' }]} />
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {form.tipo === 'cuota'
          ? 'Se aplica a la cuota más antigua: primero mora, luego interés y por último capital.'
          : 'Primero se cubre lo vencido; el resto se descuenta del capital pendiente.'}
      </p>

      <SegmentedControl label="Moneda recibida" value={form.moneda} onChange={set('moneda')}
        options={[{ value: 'USD', label: '$ USD' }, { value: 'VES', label: 'Bs. VES' }]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pago-monto" label="Monto recibido" error={showErrors.monto}>
          {(a11y) => <input {...a11y} className="input-base num font-bold" inputMode="decimal" placeholder="0,00" value={form.monto} onChange={set('monto')} />}
        </Field>
        <Field id="pago-tasa" label="Tasa del día (Bs/USD)" error={showErrors.tasaCambio}>
          {(a11y) => <input {...a11y} className="input-base num" inputMode="decimal" value={form.tasaCambio} onChange={set('tasaCambio')} />}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        {prestamo.exigible_hoy_cents > 0 && (
          <button type="button" className="btn-ghost border border-slate-200 dark:border-slate-700" onClick={() => fill(prestamo.exigible_hoy_cents)}>
            Exigible hoy (<Money cents={prestamo.exigible_hoy_cents} currency={prestamo.moneda} />)
          </button>
        )}
        <button type="button" className="btn-ghost border border-slate-200 dark:border-slate-700" disabled={cancelacion.loading} onClick={cargarCancelacion}>
          {cancelacion.loading ? 'Calculando…' : 'Cancelación total'}
        </button>
      </div>
      {cancelacion.error && <ErrorBox message={cancelacion.error} />}
      {prestamo.metodo_interes === 'saldo_insoluto' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Interés sobre saldo: lo que abone a capital deja de generar interés desde la fecha del pago. «Cancelación total» cobra solo el interés ganado hasta ese día.
        </p>
      )}
      {form.moneda !== prestamo.moneda && parsed.enMonedaPrestamo !== null && (
        <p className="text-sm text-slate-700 dark:text-slate-200">Se abonarán <strong><Money cents={parsed.enMonedaPrestamo} currency={prestamo.moneda} /></strong> al préstamo.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pago-fecha" label="Fecha del pago" error={showErrors.fecha}>
          {(a11y) => <input {...a11y} type="date" className="input-base" min={prestamo.fecha_inicio} max={todayCaracas()} value={form.fecha} onChange={set('fecha')} />}
        </Field>
        <Field id="pago-metodo" label="Método">
          {(a11y) => (
            <select {...a11y} className="input-base" value={form.metodo} onChange={set('metodo')}>
              {METODOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
        </Field>
      </div>
      <Field id="pago-referencia" label="Referencia (opcional)" error={showErrors.referencia}>
        {(a11y) => <input {...a11y} className="input-base" maxLength={80} value={form.referencia} onChange={set('referencia')} />}
      </Field>
      <ErrorBox message={submitError} />
      <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? 'Registrando…' : 'Registrar pago'}</button>
    </form>
  );
}
