import { useMemo, useState } from 'react';
import { buildSchedule, normalizeLoanTerms } from '../../../shared/finance/schedule.js';
import { parseAmountInput, parseRateInput } from '../../../shared/finance/input.js';
import { addDaysISO, todayCaracas, toDisplayDate } from '../../../shared/finance/dates.js';
import { convertCents } from '../../../shared/finance/money.js';
import { getCachedBCV } from '../../services/bcvService';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { newIdempotencyKey } from '../cartera/helpers';
import { Card, ErrorBox, Field, Loading, Money, SegmentedControl } from '../cartera/ui';

const MODALIDADES = [
  { value: 'diaria', label: 'Diaria' }, { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' }, { value: 'mensual', label: 'Mensual' },
];
const FRECUENCIAS = [
  { value: 'diario', label: 'Diario' }, { value: 'semanal', label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' }, { value: 'mensual', label: 'Mensual' },
];
const METODOS = [
  { value: 'interes_fijo', label: 'Interés fijo' },
  { value: 'saldo_insoluto', label: 'Sobre saldo' },
];

function initialForm(clienteId, prefill) {
  const hoy = todayCaracas();
  const cached = getCachedBCV();
  return {
    clienteId: clienteId || '',
    moneda: prefill?.moneda === 'VES' ? 'VES' : 'USD',
    monto: prefill?.monto ? String(prefill.monto) : '',
    tasa: prefill?.tasa ? String(prefill.tasa) : '10',
    modalidadTasa: prefill?.modalidadTasa || 'quincenal',
    frecuenciaPago: prefill?.frecuenciaPago || 'quincenal',
    metodoInteres: prefill?.metodoInteres || 'interes_fijo',
    fechaInicio: prefill?.fechaInicio || hoy,
    fechaFin: prefill?.fechaFin || addDaysISO(hoy, 30),
    tasaCambio: prefill?.tasaBCV ? String(prefill.tasaBCV) : cached?.rate ? String(cached.rate) : '',
    fuenteTasa: cached?.verifiedAgainstBCV ? 'BCV' : 'manual',
    tasaMora: '0',
    diasGracia: '0',
    notas: '',
  };
}

export function NuevoPrestamoForm({ clienteId, prefill, onCreated, onCancel }) {
  const clientes = useRemote(() => api.listClientes(), []);
  const [form, setForm] = useState(() => initialForm(clienteId, prefill));
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }));

  const parsed = useMemo(() => {
    const errors = {};
    const capitalCents = parseAmountInput(form.monto);
    if (!capitalCents) errors.monto = 'Ingresa un monto válido.';
    const tasa = parseRateInput(form.tasa);
    if (!tasa) errors.tasa = 'Ingresa una tasa mayor a 0.';
    const tasaCambio = parseRateInput(form.tasaCambio);
    if (!tasaCambio) errors.tasaCambio = 'Ingresa la tasa de cambio del día.';
    const tasaMora = form.tasaMora.trim() === '' ? 0 : Number(form.tasaMora.replace(',', '.'));
    if (!Number.isFinite(tasaMora) || tasaMora < 0 || tasaMora > 5) errors.tasaMora = 'Entre 0 y 5 % diario.';
    const diasGracia = Number(form.diasGracia || 0);
    if (!Number.isInteger(diasGracia) || diasGracia < 0 || diasGracia > 60) errors.diasGracia = 'Entre 0 y 60 días.';
    if (!form.clienteId) errors.clienteId = 'Selecciona un cliente.';

    const terms = normalizeLoanTerms({
      principalCents: capitalCents ?? undefined, principal: capitalCents ? undefined : NaN, currency: form.moneda,
      ratePercent: tasa ?? NaN, rateMode: form.modalidadTasa, startDate: form.fechaInicio,
      endDate: form.fechaFin, frequency: form.frecuenciaPago, method: form.metodoInteres,
    });
    if (!terms.ok && !errors.monto && !errors.tasa) errors.terminos = terms.errors.join(' ');
    const plan = terms.ok ? buildSchedule(terms.terms) : null;
    return { errors, capitalCents, tasa, tasaCambio, tasaMora, diasGracia, plan };
  }, [form]);

  const activos = (clientes.data ?? []).filter((c) => c.estado === 'activo');
  const showErrors = touched ? parsed.errors : {};
  const otraMoneda = form.moneda === 'USD' ? 'VES' : 'USD';

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(parsed.errors).length || !parsed.plan) return;
    setSaving(true);
    setSubmitError('');
    try {
      const id = await api.emitirPrestamo({
        clienteId: form.clienteId, moneda: form.moneda, capitalCents: parsed.capitalCents, tasaInteres: parsed.tasa,
        modalidadTasa: form.modalidadTasa, frecuenciaPago: form.frecuenciaPago, metodoInteres: form.metodoInteres,
        fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, tasaCambio: parsed.tasaCambio,
        fuenteTasaCambio: form.fuenteTasa, tasaMoraDiaria: parsed.tasaMora, diasGracia: parsed.diasGracia,
        notas: form.notas.trim(), idempotencyKey,
      });
      onCreated(id);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (clientes.loading) return <Loading label="Cargando clientes…" />;
  if (clientes.error) return <ErrorBox message={clientes.error} onRetry={clientes.reload} />;

  return (
    <form onSubmit={submit} noValidate className="space-y-5 lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-5">
        <Card title="1. Cliente">
          {activos.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">No tienes clientes activos. Registra uno en la sección Clientes.</p>
          ) : (
            <Field id="prestamo-cliente" label="Cliente" error={showErrors.clienteId}>
              {(a11y) => (
                <select {...a11y} className="input-base" value={form.clienteId} onChange={set('clienteId')}>
                  <option value="">Selecciona…</option>
                  {activos.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {c.tipo_documento}-{c.numero_documento}</option>)}
                </select>
              )}
            </Field>
          )}
        </Card>

        <Card title="2. Capital y tasa de cambio">
          <div className="space-y-4">
            <SegmentedControl label="Moneda del préstamo" value={form.moneda} onChange={set('moneda')}
              options={[{ value: 'USD', label: '$ USD' }, { value: 'VES', label: 'Bs. VES' }]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="prestamo-monto" label="Monto" error={showErrors.monto}>
                {(a11y) => <input {...a11y} className="input-base num font-bold" inputMode="decimal" placeholder="0,00" value={form.monto} onChange={set('monto')} />}
              </Field>
              <Field id="prestamo-tasa-cambio" label="Tasa del día (Bs/USD)" error={showErrors.tasaCambio}
                hint={form.fuenteTasa === 'BCV' ? 'Tasa BCV guardada; queda fija en el préstamo.' : 'Queda fija en el préstamo.'}>
                {(a11y) => <input {...a11y} className="input-base num" inputMode="decimal" value={form.tasaCambio}
                  onChange={(e) => setForm((prev) => ({ ...prev, tasaCambio: e.target.value, fuenteTasa: 'manual' }))} />}
              </Field>
            </div>
          </div>
        </Card>

        <Card title="3. Condiciones">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="prestamo-tasa" label="Tasa de interés (%)" error={showErrors.tasa}>
                {(a11y) => <input {...a11y} className="input-base num" inputMode="decimal" value={form.tasa} onChange={set('tasa')} />}
              </Field>
              <Field id="prestamo-modalidad" label="La tasa es">
                {(a11y) => (
                  <select {...a11y} className="input-base" value={form.modalidadTasa} onChange={set('modalidadTasa')}>
                    {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <SegmentedControl label="Frecuencia de pago" value={form.frecuenciaPago} onChange={set('frecuenciaPago')} options={FRECUENCIAS} />
            <SegmentedControl label="Cálculo del interés" value={form.metodoInteres} onChange={set('metodoInteres')} options={METODOS} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {form.metodoInteres === 'interes_fijo'
                ? 'Interés sobre el capital inicial durante todo el plazo (lo habitual en préstamos personales).'
                : 'Interés de cada período sobre el saldo pendiente; los abonos a capital reducen el interés futuro.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="prestamo-inicio" label="Fecha de desembolso">
                {(a11y) => <input {...a11y} type="date" className="input-base" value={form.fechaInicio} onChange={set('fechaInicio')} />}
              </Field>
              <Field id="prestamo-fin" label="Fecha de la última cuota">
                {(a11y) => <input {...a11y} type="date" className="input-base" min={form.fechaInicio} value={form.fechaFin} onChange={set('fechaFin')} />}
              </Field>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Plazos rápidos">
              {[15, 30, 45, 60, 90].map((dias) => (
                <button key={dias} type="button" className="btn-ghost border border-slate-200 dark:border-slate-700"
                  onClick={() => setForm((prev) => ({ ...prev, fechaFin: addDaysISO(prev.fechaInicio, dias) }))}>
                  {dias} días
                </button>
              ))}
            </div>
            {showErrors.terminos && <ErrorBox message={showErrors.terminos} />}
          </div>
        </Card>

        <Card title="4. Mora y notas">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="prestamo-mora" label="Mora diaria (%)" error={showErrors.tasaMora}
                hint={parsed.tasaMora > 0 ? `≈ ${(parsed.tasaMora * 30).toLocaleString('es-VE')} % mensual sobre lo vencido.` : 'Sin mora por atraso.'}>
                {(a11y) => <input {...a11y} className="input-base num" inputMode="decimal" value={form.tasaMora} onChange={set('tasaMora')} />}
              </Field>
              <Field id="prestamo-gracia" label="Días de gracia" error={showErrors.diasGracia}>
                {(a11y) => <input {...a11y} type="number" min="0" max="60" className="input-base num" value={form.diasGracia} onChange={set('diasGracia')} />}
              </Field>
            </div>
            <Field id="prestamo-notas" label="Notas (opcional)">
              {(a11y) => <textarea {...a11y} className="input-base min-h-20" maxLength={1000} value={form.notas} onChange={set('notas')} />}
            </Field>
          </div>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <Card title="Resumen">
          {parsed.plan ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-slate-500 dark:text-slate-400">Capital</dt><dd className="text-right"><Money cents={parsed.capitalCents} currency={form.moneda} /></dd>
                <dt className="text-slate-500 dark:text-slate-400">Interés</dt><dd className="text-right"><Money cents={parsed.plan.interestCents} currency={form.moneda} /></dd>
                <dt className="font-bold">Total a cobrar</dt><dd className="text-right font-bold"><Money cents={parsed.plan.totalCents} currency={form.moneda} /></dd>
                {parsed.tasaCambio && (
                  <>
                    <dt className="text-slate-500 dark:text-slate-400">Equivale a</dt>
                    <dd className="text-right text-slate-500 dark:text-slate-400"><Money cents={convertCents(parsed.plan.totalCents, parsed.tasaCambio, form.moneda, otraMoneda)} currency={otraMoneda} /></dd>
                  </>
                )}
                <dt className="text-slate-500 dark:text-slate-400">Plazo</dt><dd className="text-right">{parsed.plan.totalDays} días · {parsed.plan.installments.length} cuotas</dd>
              </dl>
              <details>
                <summary className="cursor-pointer text-xs font-bold text-brand-700 dark:text-brand-300">Ver cronograma</summary>
                <ol className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
                  {parsed.plan.installments.map((c) => (
                    <li key={c.number} className="flex justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
                      <span>#{c.number} · {toDisplayDate(c.dueDate)}</span>
                      <Money cents={c.totalCents} currency={form.moneda} />
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Completa monto, tasa y fechas para ver el resumen.</p>
          )}
        </Card>
        <ErrorBox message={submitError} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={saving || activos.length === 0}>{saving ? 'Emitiendo…' : 'Emitir préstamo'}</button>
          {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">El servidor recalcula y guarda el cronograma; la tasa de cambio queda registrada en el préstamo.</p>
      </aside>
    </form>
  );
}
