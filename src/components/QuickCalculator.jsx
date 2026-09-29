import { useState, useMemo } from 'react';
import { Zap, DollarSign, Send, RotateCcw, Percent, Calendar } from 'lucide-react';
import { simularPrestamo, formatearMoneda, convertirMoneda } from '../utils/calculator';
import { format } from 'date-fns';
import { MAX_PERSON_NAME_LENGTH, normalizePlainText } from '../utils/inputValidation';

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];
const PRESET_DAYS = [7, 15, 30];

export function QuickCalculator({ tasaBCV = 36.5 }) {
  const [moneda, setMoneda] = useState('USD');
  const [monto, setMonto] = useState('100');
  const [tasa, setTasa] = useState('10');
  const [modalidadTasa, setModalidadTasa] = useState('quincenal');
  const [dias, setDias] = useState('15');
  const [frecuenciaPago, setFrecuenciaPago] = useState('quincenal');
  const [nombreCliente, setNombreCliente] = useState('');

  const hoy = new Date();
  const fechaInicioStr = format(hoy, 'yyyy-MM-dd');
  const fechaFinDate = new Date();
  fechaFinDate.setDate(fechaFinDate.getDate() + (parseInt(dias, 10) || 15));
  const fechaFinStr = format(fechaFinDate, 'yyyy-MM-dd');

  const resultado = useMemo(() => {
    const m = parseFloat(monto) || 0;
    const t = parseFloat(tasa) || 0;
    const bcv = parseFloat(tasaBCV) || 1;
    if (m <= 0 || t <= 0) return null;

    return simularPrestamo({
      monto: m,
      moneda,
      tasa: t,
      modalidadTasa,
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      frecuenciaPago,
      tasaBCV: bcv,
    });
  }, [monto, tasa, moneda, modalidadTasa, dias, frecuenciaPago, fechaInicioStr, fechaFinStr, tasaBCV]);

  const fmtP = (v) => formatearMoneda(v, moneda);
  const fmtA = (v) => formatearMoneda(v, moneda === 'USD' ? 'VES' : 'USD');

  const whatsappMessage = useMemo(() => {
    if (!resultado?.valido) return '';
    const clienteStr = nombreCliente.trim() ? ` a ${nombreCliente.trim()}` : '';
    const altMoneda = moneda === 'USD' ? 'VES' : 'USD';
    const altTotal = convertirMoneda(resultado.totalPagar, tasaBCV, moneda, altMoneda);

    return encodeURIComponent(
      `⚡ *PRGARCÍA - Cotización Rápida*${clienteStr}\n\n` +
      `• *Capital:* ${fmtP(resultado.monto)}\n` +
      `• *Plazo:* ${resultado.diasTotales} días\n` +
      `• *Tasa:* ${resultado.tasa}% (${resultado.modalidadTasa})\n` +
      `• *Interés:* ${fmtP(resultado.interes)}\n` +
      `• *Total a Cobrar:* ${fmtP(resultado.totalPagar)} (≈ ${formatearMoneda(altTotal, altMoneda)})\n` +
      `• *Cuotas (${resultado.frecuenciaPago}):* ${resultado.numeroCuotas} cuota(s) de ${fmtP(resultado.montoCuota)}\n\n` +
      `Tasa BCV referencia: Bs. ${parseFloat(tasaBCV).toFixed(2)} / USD.`
    );
  }, [resultado, nombreCliente, moneda, tasaBCV, fmtP]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Banner de Modo Callejero */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 p-4 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur shrink-0">
            <Zap size={22} className="fill-white" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide">Calculadora Rápida de Calle</h2>
            <p className="text-[11px] text-amber-100">Sin consumo de datos · Cálculo instantáneo en pantalla</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMonto('100');
            setTasa('10');
            setDias('15');
            setNombreCliente('');
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
          title="Reiniciar valores"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Formulario Ultrarrápido */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm space-y-4">
          
          {/* Cliente opcional */}
          <div>
            <label htmlFor="quick-client" className="label-base">Cliente (Opcional)</label>
            <input
              id="quick-client"
              type="text"
              maxLength={MAX_PERSON_NAME_LENGTH}
              placeholder="Ej: Pedro Pérez"
              value={nombreCliente}
              onChange={(e) => setNombreCliente(normalizePlainText(e.target.value))}
              className="input-base"
            />
          </div>

          {/* Toggle Moneda */}
          <div role="group" aria-label="Moneda del préstamo" className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
            <button
              type="button"
              aria-pressed={moneda === 'USD'}
              onClick={() => setMoneda('USD')}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                moneda === 'USD'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              $ USD (Divisa)
            </button>
            <button
              type="button"
              aria-pressed={moneda === 'VES'}
              onClick={() => setMoneda('VES')}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                moneda === 'VES'
                  ? 'bg-brand-700 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Bs. VES (Digital)
            </button>
          </div>

          {/* Monto con Atajos de 1 toque */}
          <div>
            <label htmlFor="quick-amount" className="label-base">Monto a Prestar</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                {moneda === 'USD' ? '$' : 'Bs.'}
              </span>
              <input
                id="quick-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={Number.MAX_SAFE_INTEGER}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="100"
                className="input-base pl-9 text-lg font-bold font-mono text-gray-900 dark:text-white"
              />
            </div>
            {/* Presets de monto */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] text-gray-400 font-semibold self-center mr-1">Rápido:</span>
              {PRESET_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMonto(val.toString())}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                    monto === val.toString()
                      ? 'bg-brand-700 text-white border-brand-700 shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-500'
                  }`}
                >
                  {moneda === 'USD' ? `$${val}` : `Bs.${val}`}
                </button>
              ))}
            </div>
          </div>

          {/* Tasa % y Modalidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-rate" className="label-base">Tasa (%)</label>
              <div className="relative">
                <input
                  id="quick-rate"
                  type="number"
                  inputMode="decimal"
                  min="0.000001"
                  max={Number.MAX_SAFE_INTEGER}
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  placeholder="10"
                  className="input-base pr-7 font-mono font-bold text-base"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">%</span>
              </div>
            </div>
            <div>
              <label htmlFor="quick-rate-modality" className="label-base">Modalidad Tasa</label>
              <select
                id="quick-rate-modality"
                value={modalidadTasa}
                onChange={(e) => setModalidadTasa(e.target.value)}
                className="input-base cursor-pointer font-semibold"
              >
                <option value="quincenal">Quincenal (15d)</option>
                <option value="semanal">Semanal (7d)</option>
                <option value="diaria">Diaria (1d)</option>
              </select>
            </div>
          </div>

          {/* Plazo en Días y Frecuencia de Cobro */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-duration" className="label-base">Plazo (Días)</label>
              <input
                id="quick-duration"
                type="number"
                inputMode="numeric"
                min="1"
                max="36500"
                value={dias}
                onChange={(e) => setDias(e.target.value)}
                placeholder="15"
                className="input-base font-mono font-bold text-base"
              />
              <div className="flex gap-1 mt-1.5">
                {PRESET_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDias(d.toString())}
                    className={`flex-1 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                      dias === d.toString()
                        ? 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="quick-payment-frequency" className="label-base">Cobro</label>
              <select
                id="quick-payment-frequency"
                value={frecuenciaPago}
                onChange={(e) => setFrecuenciaPago(e.target.value)}
                className="input-base cursor-pointer font-semibold"
              >
                <option value="quincenal">Quincenal</option>
                <option value="semanal">Semanal</option>
                <option value="diario">Diario</option>
              </select>
            </div>
          </div>

        </div>

        {/* Resumen Visual Directo para Sol / Exteriores */}
        <div className="flex flex-col justify-between rounded-2xl border-2 border-brand-500/40 bg-gradient-to-b from-white to-blue-50/40 dark:from-gray-900 dark:to-gray-950 p-5 shadow-lg space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Resultado Inmediato</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                Sin latencia
              </span>
            </div>

            {resultado?.valido ? (
              <div className="space-y-4 mt-4">
                {/* Total a cobrar gigante */}
                <div className="rounded-xl bg-brand-700 text-white p-4 text-center shadow-md">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white block">Total a pagar</span>
                  <span className="font-mono text-3xl sm:text-4xl font-extrabold block mt-0.5">
                    {fmtP(resultado.totalPagar)}
                  </span>
                  <span className="text-xs text-white font-mono mt-0.5 block">
                    ≈ {fmtA(convertirMoneda(resultado.totalPagar, tasaBCV, moneda, moneda === 'USD' ? 'VES' : 'USD'))}
                  </span>
                </div>

                {/* Desglose de Ganancia y Cuotas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 p-3">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">Total de intereses</span>
                    <span className="font-mono text-xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                      {fmtP(resultado.interes)}
                    </span>
                    <span className="text-[10px] text-gray-500 block">+{resultado.rendimientoPorcentaje.toFixed(1)}% retorno</span>
                  </div>

                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 p-3">
                    <span className="text-[10px] font-bold uppercase text-brand-700 dark:text-brand-400 block">Cuota ({resultado.frecuenciaPago})</span>
                    <span className="font-mono text-xl font-extrabold text-brand-600 dark:text-brand-400 block mt-0.5">
                      {fmtP(resultado.montoCuota)}
                    </span>
                    <span className="text-[10px] text-gray-500 block">{resultado.numeroCuotas} cuota(s)</span>
                  </div>
                </div>

                {/* Nota de días exactos */}
                <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-800/60 text-[11px] text-gray-600 dark:text-gray-300">
                  <strong>Plazo:</strong> {resultado.diasTotales} días exactos calculados. Tasa BCV hoy: <span className="font-mono font-bold">Bs. {parseFloat(tasaBCV).toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                Ingresa el monto y la tasa para ver el presupuesto inmediato.
              </div>
            )}
          </div>

          {/* Botón WhatsApp Inmediato de 1 solo clic */}
          {resultado?.valido && (
            <a
              href={`https://wa.me/?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition-all active:scale-95 mt-4"
            >
              <Send size={18} />
              <span>Enviar Presupuesto por WhatsApp</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
