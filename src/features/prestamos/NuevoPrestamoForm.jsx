import { useMemo, useState } from 'react';
import { FREQUENCY_DAYS, buildSchedule, normalizeLoanTerms, openLoanPeriodInterestCents } from '../../../shared/finance/schedule.js';
import { parseAmountInput, parseRateInput } from '../../../shared/finance/input.js';
import { addDaysISO, isISODate, todayCaracas, toDisplayDate } from '../../../shared/finance/dates.js';
import { convertCents } from '../../../shared/finance/money.js';
import * as api from '../cartera/api';
import { useRemote } from '../cartera/useRemote';
import { newIdempotencyKey, requiereConfirmarTasa, tasaInicial } from '../cartera/helpers';
import { TasaCambioField } from '../cartera/TasaCambioField';
import { useTasaReferencia } from '../cartera/useTasaReferencia';
import { tasaATexto, useTasaPersonalizada } from '../../services/tasaPersonalizada';
import { Card, ErrorBox, Field, Loading, Money, SegmentedControl } from '../cartera/ui';
import { ClientePicker } from '../clientes/ClientePicker';
import { FRECUENCIAS as CAT_FRECUENCIAS, METODOS_INTERES, MODALIDADES_TASA, PERIODO, TIPOS_PLAZO, opciones } from '../../../shared/catalogos.js';

const MODALIDADES = opciones(MODALIDADES_TASA);
const FRECUENCIAS = opciones(CAT_FRECUENCIAS);
const PLAZOS = opciones(TIPOS_PLAZO);
const METODOS = opciones(METODOS_INTERES);

function initialForm(clienteId, prefill) {
  const hoy = todayCaracas();
  return {
    clienteId: clienteId || '',
    moneda: prefill?.moneda === 'VES' ? 'VES' : 'USD',
    monto: prefill?.monto ? String(prefill.monto) : '',
    tasa: prefill?.tasa ? String(prefill.tasa) : '8',
    modalidadTasa: prefill?.modalidadTasa || 'semanal',
    frecuenciaPago: prefill?.frecuenciaPago || 'semanal',
    metodoInteres: prefill?.metodoInteres || 'saldo_insoluto',
    tipoPlazo: prefill?.tipoPlazo || 'abierto',
    fechaInicio: prefill?.fechaInicio || hoy,
    fechaFin: prefill?.fechaFin || addDaysISO(hoy, 30),
    // null = sin tocar: se usa la tasa BCV de referencia en cuanto llega.
    tasaCambio: prefill?.tasaBCV ? String(prefill.tasaBCV) : null,
    fuenteTasa: prefill?.tasaBCV ? 'BCV' : null,
    tasaMora: '0',
    diasGracia: '0',
    notas: '',
  };
}

export function NuevoPrestamoForm({ clienteId, prefill, onCreated, onCancel }) {
  const clientes = useRemote(() => api.listClientes(), []);
  const [nuevos, setNuevos] = useState([]);
  const [editarCondiciones, setEditarCondiciones] = useState(!prefill);
  const [form, setForm] = useState(() => initialForm(clienteId, prefill));
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { referencia } = useTasaReferencia();
  const [confirmarTasa, setConfirmarTasa] = useState(false);
  const personalizada = useTasaPersonalizada();
  const tasaTexto = form.tasaCambio ?? (personalizada ? tasaATexto(personalizada.tasa) : tasaInicial(referencia));
  const fuenteTasa = parseRateInput(tasaTexto) === personalizada?.tasa
    ? 'personalizada'
    : form.fuenteTasa ?? (tasaTexto && referencia?.oficial ? 'BCV' : 'manual');
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event?.target ? event.target.value : event }));

  const parsed = useMemo(() => {
    const errors = {};
    const capitalCents = parseAmountInput(form.monto);
    if (!capitalCents) errors.monto = 'Ingresa un monto válido.';
    const tasa = parseRateInput(form.tasa);
    if (!tasa) errors.tasa = 'Ingresa una tasa mayor a 0.';
    const tasaCambio = parseRateInput(tasaTexto);
    if (!tasaCambio) errors.tasaCambio = 'Ingresa la tasa de cambio del día.';
    else if (requiereConfirmarTasa(tasaCambio, referencia) && !confirmarTasa && tasaCambio !== personalizada?.tasa) errors.tasaCambio = 'Confirma la tasa o corrígela.';
    const tasaMora = form.tasaMora.trim() === '' ? 0 : Number(form.tasaMora.replace(',', '.'));
    if (!Number.isFinite(tasaMora) || tasaMora < 0 || tasaMora > 5) errors.tasaMora = 'Entre 0 y 5 % diario.';
    const diasGracia = Number(form.diasGracia || 0);
    if (!Number.isInteger(diasGracia) || diasGracia < 0 || diasGracia > 60) errors.diasGracia = 'Entre 0 y 60 días.';
    if (!form.clienteId) errors.clienteId = 'Selecciona un cliente.';

    const abierto = form.tipoPlazo === 'abierto';
    const intervalo = FREQUENCY_DAYS[form.frecuenciaPago];
    const terms = normalizeLoanTerms({
      principalCents: capitalCents ?? undefined, principal: capitalCents ? undefined : NaN, currency: form.moneda,
      ratePercent: tasa ?? NaN, rateMode: form.modalidadTasa, startDate: form.fechaInicio,
      // Un préstamo abierto se valida sobre su primer período.
      endDate: abierto && isISODate(form.fechaInicio) ? addDaysISO(form.fechaInicio, intervalo) : form.fechaFin,
      frequency: form.frecuenciaPago, method: abierto ? 'saldo_insoluto' : form.metodoInteres,
    });
    if (!terms.ok && !errors.monto && !errors.tasa) errors.terminos = terms.errors.join(' ');
    const plan = terms.ok && !abierto ? buildSchedule(terms.terms) : null;
    const periodo = terms.ok && abierto ? {
      interesCents: openLoanPeriodInterestCents({
        principalCents: terms.terms.principalCents, ratePercent: terms.terms.ratePercent,
        rateMode: form.modalidadTasa, frequency: form.frecuenciaPago,
      }),
      primerVencimiento: addDaysISO(form.fechaInicio, intervalo),
    } : null;
    return { errors, capitalCents, tasa, tasaCambio, tasaMora, diasGracia, plan, periodo };
  }, [form, referencia, confirmarTasa, tasaTexto, personalizada]);

  const listaClientes = [...(clientes.data ?? []), ...nuevos.filter((n) => !(clientes.data ?? []).some((c) => c.id === n.id))];
  const showErrors = touched ? parsed.errors : {};
  const otraMoneda = form.moneda === 'USD' ? 'VES' : 'USD';

  const cambiarTasa = (e) => {
    const value = e.target.value;
    const esReferencia = referencia && parseRateInput(value) === Number(referencia.tasa);
    setForm((prev) => ({ ...prev, tasaCambio: value, fuenteTasa: esReferencia && referencia.oficial ? 'BCV' : 'manual' }));
    setConfirmarTasa(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(parsed.errors).length || !(parsed.plan || parsed.periodo)) return;
    setSaving(true);
    setSubmitError('');
    try {
      const id = await api.emitirPrestamo({
        clienteId: form.clienteId, moneda: form.moneda, capitalCents: parsed.capitalCents, tasaInteres: parsed.tasa,
        modalidadTasa: form.modalidadTasa, frecuenciaPago: form.frecuenciaPago, metodoInteres: form.metodoInteres,
        fechaInicio: form.fechaInicio, fechaFin: form.fechaFin, tasaCambio: parsed.tasaCambio,
        fuenteTasaCambio: fuenteTasa, tasaMoraDiaria: parsed.tasaMora, diasGracia: parsed.diasGracia,
        notas: form.notas.trim(), idempotencyKey, tipoPlazo: form.tipoPlazo,
        confirmarTasa: confirmarTasa || parsed.tasaCambio === personalizada?.tasa,
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
          <ClientePicker
            clientes={listaClientes}
            value={form.clienteId}
            onChange={(id) => setForm((prev) => ({ ...prev, clienteId: id }))}
            onCreated={(nuevo) => setNuevos((prev) => [...prev, nuevo])}
            error={showErrors.clienteId}
          />
        </Card>

        {!editarCondiciones && (
          <Card title="2. Condiciones de la cotización" actions={
            <button type="button" className="btn-ghost" onClick={() => setEditarCondiciones(true)}>Editar</button>
          }>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-600 dark:text-slate-400">Monto</dt>
              <dd className="text-right font-semibold">{parsed.capitalCents ? <Money cents={parsed.capitalCents} currency={form.moneda} /> : '—'}</dd>
              <dt className="text-slate-600 dark:text-slate-400">Tasa</dt>
              <dd className="text-right">{form.tasa} % {form.modalidadTasa}</dd>
              <dt className="text-slate-600 dark:text-slate-400">Plazo</dt>
              <dd className="text-right">{form.tipoPlazo === 'abierto' ? 'Sin fecha de fin' : `Hasta ${toDisplayDate(form.fechaFin)}`}</dd>
              <dt className="text-slate-600 dark:text-slate-400">{form.tipoPlazo === 'abierto' ? 'Cobro de intereses' : 'Cuotas'}</dt>
              <dd className="text-right capitalize">{form.frecuenciaPago}</dd>
            </dl>
            <div className="mt-4">
              <TasaCambioField id="prestamo-tasa-cambio-resumen" value={tasaTexto} tasa={parsed.tasaCambio} referencia={referencia} personalizada={personalizada}
                hint="Queda registrada en el préstamo." onChange={cambiarTasa} confirmada={confirmarTasa} onConfirmar={setConfirmarTasa}
                error={showErrors.tasaCambio} />
            </div>
            {(showErrors.monto || showErrors.tasa || showErrors.terminos) && (
              <div className="mt-3"><ErrorBox message="Revisa las condiciones: pulsa «Editar» para corregirlas." /></div>
            )}
          </Card>
        )}

        {editarCondiciones && (<>
        <Card title="2. Capital y tasa de cambio">
          <div className="space-y-4">
            <SegmentedControl label="Moneda del préstamo" value={form.moneda} onChange={set('moneda')}
              options={[{ value: 'USD', label: '$ USD' }, { value: 'VES', label: 'Bs. VES' }]} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="prestamo-monto" label="Monto" error={showErrors.monto}>
                {(a11y) => <input {...a11y} className="input-base num font-bold" inputMode="decimal" placeholder="0,00" value={form.monto} onChange={set('monto')} />}
              </Field>
              <TasaCambioField id="prestamo-tasa-cambio" value={tasaTexto} tasa={parsed.tasaCambio} referencia={referencia} personalizada={personalizada}
                hint="Queda fija en el préstamo." onChange={cambiarTasa} confirmada={confirmarTasa} onConfirmar={setConfirmarTasa}
                error={showErrors.tasaCambio} />
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
            <SegmentedControl label="Plazo" value={form.tipoPlazo} onChange={set('tipoPlazo')} options={PLAZOS} />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {form.tipoPlazo === 'abierto'
                ? 'Sin fecha de fin: cada período genera interés sobre el capital que aún se debe. Los pagos cubren primero los intereses y lo demás se abona al capital, hasta pagarlo completo.'
                : 'Con fecha de fin: el capital y los intereses se reparten en cuotas hasta la última fecha.'}
            </p>
            <SegmentedControl label={form.tipoPlazo === 'abierto' ? 'Cobro de intereses' : 'Frecuencia de pago'} value={form.frecuenciaPago} onChange={set('frecuenciaPago')} options={FRECUENCIAS} />
            {form.tipoPlazo === 'fijo' && (
              <>
                <SegmentedControl label="Cálculo del interés" value={form.metodoInteres} onChange={set('metodoInteres')} options={METODOS} />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {form.metodoInteres === 'interes_fijo'
                    ? 'Interés sobre el capital inicial durante todo el plazo, aunque el cliente abone a capital.'
                    : 'El interés corre solo sobre el capital que falta por pagar: cada abono deja de generar interés desde el día en que se recibe.'}
                </p>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="prestamo-inicio" label="Fecha de desembolso">
                {(a11y) => <input {...a11y} type="date" className="input-base" value={form.fechaInicio} onChange={set('fechaInicio')} />}
              </Field>
              {form.tipoPlazo === 'fijo' && (
                <Field id="prestamo-fin" label="Fecha de la última cuota">
                  {(a11y) => <input {...a11y} type="date" className="input-base" min={form.fechaInicio} value={form.fechaFin} onChange={set('fechaFin')} />}
                </Field>
              )}
            </div>
            {form.tipoPlazo === 'fijo' && (
              <div className="flex flex-wrap gap-2" aria-label="Plazos rápidos">
                {[15, 30, 45, 60, 90].map((dias) => (
                  <button key={dias} type="button" className="btn-ghost border border-slate-200 dark:border-slate-700"
                    onClick={() => setForm((prev) => ({ ...prev, fechaFin: addDaysISO(prev.fechaInicio, dias) }))}>
                    {dias} días
                  </button>
                ))}
              </div>
            )}
            {showErrors.terminos && <ErrorBox message={showErrors.terminos} />}
          </div>
        </Card>

        </>)}

        <Card title={editarCondiciones ? '4. Mora y notas' : '3. Mora y notas'}>
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
          {parsed.periodo ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">Capital</dt><dd className="text-right"><Money cents={parsed.capitalCents} currency={form.moneda} /></dd>
              <dt className="font-bold">Interés por {PERIODO[form.frecuenciaPago]}</dt><dd className="text-right font-bold"><Money cents={parsed.periodo.interesCents} currency={form.moneda} /></dd>
              <dt className="text-slate-500 dark:text-slate-400">Primer cobro</dt><dd className="text-right">{toDisplayDate(parsed.periodo.primerVencimiento)}</dd>
              <dt className="text-slate-500 dark:text-slate-400">Fecha de fin</dt><dd className="text-right">Abierta</dd>
              <dd className="col-span-2 text-xs text-slate-500 dark:text-slate-400">El interés baja a medida que el cliente abona al capital.</dd>
            </dl>
          ) : parsed.plan ? (
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
          <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Emitiendo…' : 'Emitir préstamo'}</button>
          {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">El servidor recalcula y guarda las condiciones; la tasa de cambio queda registrada en el préstamo.</p>
      </aside>
    </form>
  );
}
