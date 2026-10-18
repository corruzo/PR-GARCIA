import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark, RotateCcw } from 'lucide-react';
import { parseRateInput } from '../../../shared/finance/input.js';
import { todayCaracas } from '../../../shared/finance/dates.js';
import { generarCronograma, simularPrestamo } from '../../utils/calculator';
import { LoanForm } from '../../components/LoanForm';
import { ResultPanel } from '../../components/ResultPanel';
import { CronogramaTable } from '../../components/CronogramaTable';
import { BCVField } from '../../components/BCVField';

const DRAFT_KEY = 'prgarcia.calculadora.v2';
const DRAFT_EXPIRATION_MS = 30 * 60 * 1000;

function defaults() {
  return {
    monto: '',
    moneda: 'USD',
    tasa: '8',
    modalidadTasa: 'semanal',
    tipoPlazo: 'abierto',
    frecuenciaPago: 'semanal',
    metodoInteres: 'saldo_insoluto',
    fechaInicio: todayCaracas(),
    fechaFin: '',
    tasaBCV: '',
  };
}

/** Borrador temporal (30 min) para no perder lo escrito al cambiar de módulo. */
function loadDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (!saved || Date.now() - saved.timestamp > DRAFT_EXPIRATION_MS) return defaults();
    return { ...defaults(), ...saved.values };
  } catch {
    return defaults();
  }
}

/**
 * Calculadora: estima un préstamo y lo comparte. Para registrarlo de verdad,
 * «Convertir en préstamo» lleva estas condiciones al formulario de préstamo.
 */
export function CalculadoraView({ onConvertir }) {
  const [values, setValues] = useState(loadDraft);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ values, timestamp: Date.now() }));
    } catch {
      // Ventana privada sin almacenamiento: la calculadora funciona igual.
    }
  }, [values]);

  const resultado = useMemo(() => {
    const monto = parseFloat(values.monto);
    const tasa = parseFloat(values.tasa);
    if (!monto || !tasa || (values.tipoPlazo !== 'abierto' && !values.fechaFin)) return null;
    // La tasa BCV es opcional: sin ella no se muestran equivalencias en la otra moneda.
    const tasaBCV = parseRateInput(values.tasaBCV) ?? undefined;
    return simularPrestamo({ ...values, monto, tasa, tasaBCV });
  }, [values]);

  const setTasaBCV = useCallback((value) => setValues((prev) => ({ ...prev, tasaBCV: value })), []);
  const cronograma = useMemo(() => generarCronograma(resultado), [resultado]);
  const dirty = Boolean(values.monto || values.fechaFin);

  const convertir = () => {
    if (!resultado?.valido) return;
    onConvertir({
      moneda: resultado.moneda,
      monto: resultado.monto,
      tasa: resultado.tasa,
      modalidadTasa: resultado.modalidadTasa,
      frecuenciaPago: resultado.frecuenciaPago,
      metodoInteres: resultado.metodoInteres,
      tipoPlazo: resultado.tipoPlazo,
      fechaInicio: resultado.fechaInicio,
      fechaFin: resultado.fechaFin,
      tasaBCV: resultado.tasaBCV,
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:items-start lg:gap-8">
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold leading-tight">Calculadora</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Estima un préstamo y compártelo.</p>
            </div>
            {dirty && (
              <button type="button" className="btn-ghost" onClick={() => setValues((prev) => ({ ...defaults(), tasaBCV: prev.tasaBCV }))}>
                <RotateCcw size={14} aria-hidden="true" /> Limpiar
              </button>
            )}
          </div>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <Landmark size={18} className="text-brand-700 dark:text-brand-400" aria-hidden="true" /> Tasa de cambio
            </h2>
            <BCVField value={values.tasaBCV} onChange={setTasaBCV} />
          </div>
          <LoanForm values={values} onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))} />
        </section>

        <aside className="mt-6 lg:sticky lg:top-24 lg:mt-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-surface-cardDark">
            <h2 className="mb-4 text-base font-semibold">Estimación</h2>
            <ResultPanel resultado={resultado} onConvertir={convertir} />
          </div>
        </aside>
      </div>

      {resultado?.valido && !resultado.abierto && <CronogramaTable resultado={resultado} cronograma={cronograma} />}
    </div>
  );
}
