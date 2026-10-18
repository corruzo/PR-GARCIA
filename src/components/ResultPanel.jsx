import { useState } from 'react';
import { AlertCircle, Check, Copy, Info, Landmark, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { formatearMoneda, generarCronograma } from '../utils/calculator';
import { buildQuoteMessage } from '../utils/quoteMessage';
import { paymentTermsNote } from '../../shared/finance/report.js';
import { toDisplayDate } from '../../shared/finance/dates.js';

const PERIODO = { diario: 'día', semanal: 'semana', quincenal: 'quincena', mensual: 'mes' };
const FRECUENCIA = { diario: 'diarias', semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' };

function Dato({ label, children, sub }) {
  return (
    <div className="result-card compact-result-card">
      <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="mt-0.5 block text-lg font-bold">{children}</span>
      {sub && <span className="block text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
    </div>
  );
}

const WhatsAppIcon = () => (
  <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.004 3.67 3.747-.983zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

/** Resultado de la calculadora: estimación, compartir y pasar a préstamo real. */
export function ResultPanel({ resultado, onConvertir }) {
  const [copiado, setCopiado] = useState(false);

  if (!resultado) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-gray-500 dark:text-gray-400">
        <TrendingUp size={36} className="opacity-40" aria-hidden="true" />
        <p className="text-sm font-medium">Escribe el monto para ver la estimación</p>
      </div>
    );
  }

  if (!resultado.valido) {
    return (
      <div className="space-y-2 py-4">
        {resultado.errores.map((err) => (
          <div key={err} className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
            <span className="text-xs text-red-800 dark:text-red-300">{err}</span>
          </div>
        ))}
      </div>
    );
  }

  const { moneda, frecuenciaPago, monedaAlterna } = resultado;
  const fmt = (v) => formatearMoneda(v, moneda);
  // Equivalencia a la tasa BCV escrita en la calculadora (si hay).
  const eq = (v) => (v === null || v === undefined ? null : `≈ ${formatearMoneda(v, monedaAlterna)}`);
  const aTasa = `a Bs. ${Number(resultado.tasaBCV).toLocaleString('es-VE', { maximumFractionDigits: 4 })} por USD`;
  const mensaje = buildQuoteMessage({
    resultado,
    cronograma: generarCronograma(resultado),
    fechaHoy: format(new Date(), 'dd/MM/yyyy'),
  });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // El navegador no permitió copiar; el botón de WhatsApp sigue disponible.
    }
  };

  return (
    <div className="space-y-3 animate-fade-in">
      {resultado.abierto ? (
        <>
          <div className="result-card border-l-4 border-l-brand-700">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Intereses por {PERIODO[frecuenciaPago]}</span>
            <span className="result-value block text-brand-700 dark:text-brand-400">{fmt(resultado.interesPeriodo)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">mientras deba {fmt(resultado.monto)}</span>
            {eq(resultado.interesPeriodoAlterna) && <span className="block text-xs font-semibold text-gray-600 dark:text-gray-300">{eq(resultado.interesPeriodoAlterna)} {aTasa}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Dato label="Capital" sub={eq(resultado.montoAlterna) ?? undefined}>{fmt(resultado.monto)}</Dato>
            <Dato label="Primer cobro">{toDisplayDate(resultado.primerVencimiento)}</Dato>
          </div>
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            Sin fecha de fin: paga los intereses cada {PERIODO[frecuenciaPago]} y abona al capital cuando pueda;
            cada abono reduce los intereses desde ese día.
          </p>
        </>
      ) : (
        <>
          <div className="result-card border-l-4 border-l-brand-700">
            <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">Total a pagar</span>
            <span className="result-value block text-brand-700 dark:text-brand-400">{fmt(resultado.totalPagar)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">en {resultado.diasTotales} días</span>
            {eq(resultado.totalAlterna) && <span className="block text-xs font-semibold text-gray-600 dark:text-gray-300">{eq(resultado.totalAlterna)} {aTasa}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Dato label="Intereses" sub={eq(resultado.interesAlterna) ?? undefined}>{fmt(resultado.interes)}</Dato>
            <Dato label={`${resultado.numeroCuotas} cuota(s) ${FRECUENCIA[frecuenciaPago]}`}
              sub={resultado.cuotaFinal !== resultado.montoCuota ? `última: ${fmt(resultado.cuotaFinal)}` : undefined}>
              {fmt(resultado.montoCuota)}
            </Dato>
          </div>
        </>
      )}

      <p className="flex items-start gap-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        {paymentTermsNote(moneda)}
      </p>

      <div className="space-y-2 pt-2">
        <button type="button" onClick={onConvertir} className="btn-primary w-full">
          <Landmark size={18} aria-hidden="true" /> Convertir en préstamo
        </button>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            <WhatsAppIcon /> Compartir por WhatsApp
          </a>
          <button type="button" onClick={copiar} className="btn-secondary" aria-label="Copiar el mensaje">
            {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            <span className="hidden sm:inline">{copiado ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
