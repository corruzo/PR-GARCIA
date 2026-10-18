import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, PencilLine, RefreshCw } from 'lucide-react';
import { useBCV } from '../hooks/useBCV';
import { formatRateString } from '../services/bcvService';
import { parseRateInput } from '../../shared/finance/input.js';
import { toDisplayDateTimeCaracas } from '../../shared/finance/dates.js';
import { clearTasaPersonalizada, setTasaPersonalizada, tasaATexto, useTasaPersonalizada } from '../services/tasaPersonalizada';


/**
 * Tasa BCV del día (Bs por USD): se consulta sola al abrir, se puede actualizar
 * y, si hace falta, escribir a mano. Sirve para ver equivalencias en bolívares
 * y pasa al préstamo al pulsar «Convertir en préstamo».
 */
export function BCVField({ value, onChange }) {
  const [errorConsulta, setErrorConsulta] = useState('');
  const { cargando, tasa, error, fuente, cacheInfo, online, tasaAnticuada, verificadaBCV, consultarBCV } = useBCV();
  const personalizada = useTasaPersonalizada();
  const tasaInicialAplicada = useRef(false);

  const personalizadaAplicada = useRef(null);

  // La tasa personalizada manda: al abrir y cada vez que se elige otra.
  useEffect(() => {
    const propia = personalizada?.tasa ?? null;
    if (propia && personalizadaAplicada.current !== propia) {
      personalizadaAplicada.current = propia;
      tasaInicialAplicada.current = true;
      if (parseRateInput(value) !== propia) onChange(tasaATexto(propia));
    }
    // Se volvió a la BCV: si el campo seguía con la tasa propia, se reemplaza.
    if (!propia && personalizadaAplicada.current !== null) {
      if (parseRateInput(value) === personalizadaAplicada.current && tasa) onChange(formatRateString(tasa));
      personalizadaAplicada.current = null;
    }
  }, [onChange, value, personalizada, tasa]);

  // Sin tasa personalizada: la BCV del día si el campo está vacío.
  useEffect(() => {
    if (tasaInicialAplicada.current || value || personalizada) return;
    if (tasa) { tasaInicialAplicada.current = true; onChange(formatRateString(tasa)); }
  }, [onChange, tasa, value, personalizada]);

  const actualizar = async () => {
    setErrorConsulta('');
    const res = await consultarBCV({ force: true });
    if (res.ok) {
      clearTasaPersonalizada();
      onChange(formatRateString(res.tasa));
    }
    else setErrorConsulta('No pudimos actualizar la tasa. Revisa tu conexión; puedes escribirla a mano.');
  };

  const consultada = cacheInfo?.fetchedAt ? new Date(cacheInfo.fetchedAt) : null;
  const escrita = parseRateInput(value);
  const esPersonalizada = Boolean(personalizada && escrita === personalizada.tasa);
  const manual = value !== '' && cacheInfo?.rate && Math.abs(Number(String(value).replace(',', '.')) - Number(cacheInfo.rate)) > 0.01;
  const estado = esPersonalizada
    ? { texto: 'Tu tasa personalizada', detalle: 'se usa en préstamos y pagos', color: 'text-amber-700 dark:text-amber-400', icon: PencilLine }
    : manual
    ? { texto: 'Tasa escrita a mano', detalle: 'no coincide con la tasa BCV consultada', color: 'text-brand-700 dark:text-brand-400', icon: PencilLine }
    : verificadaBCV
      ? { texto: 'Tasa oficial del BCV', detalle: fuente || 'consultada', color: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 }
      : tasaAnticuada || error
        ? { texto: 'Última tasa guardada', detalle: 'podría haber cambiado', color: 'text-amber-700 dark:text-amber-400', icon: Clock3 }
        : fuente
          ? { texto: 'Tasa referencial', detalle: fuente, color: 'text-slate-600 dark:text-slate-400', icon: Clock3 }
          : { texto: 'Sin tasa', detalle: 'pulsa Actualizar o escríbela', color: 'text-slate-600 dark:text-slate-400', icon: AlertCircle };
  const Icono = estado.icon;

  return (
    <div className="space-y-1.5">
      <label htmlFor="input-tasa-bcv" className="label-base">Tasa BCV del día (Bs por USD)</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-xs font-semibold text-slate-400">Bs.</span>
          <input id="input-tasa-bcv" type="text" inputMode="decimal" placeholder="Ej: 215,50" value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))} className="input-base num pl-9" />
        </div>
        <button type="button" onClick={actualizar} disabled={cargando}
          className="btn-ghost shrink-0 gap-1.5 border border-slate-300 px-3 dark:border-slate-700" title="Consultar la tasa BCV actual">
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} aria-hidden="true" />
          <span className="text-xs">{cargando ? 'Consultando…' : 'Cargar BCV'}</span>
        </button>
      </div>
      <p className={`flex items-start gap-1 text-xs ${estado.color}`} role="status" aria-live="polite">
        <Icono size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">{estado.texto}</strong> · {estado.detalle}
          {consultada && consultada.getTime() > 0 && <span className="block text-[11px] opacity-80">Consultada: {toDisplayDateTimeCaracas(consultada)}{!online ? ' · sin conexión' : ''}</span>}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {escrita && !esPersonalizada && manual && (
          <button type="button" className="btn-ghost border border-slate-200 text-xs dark:border-slate-700" onClick={() => setTasaPersonalizada(escrita)}>
            Guardar como mi tasa
          </button>
        )}
        {personalizada && (
          <button type="button" className="btn-ghost border border-slate-200 text-xs dark:border-slate-700"
            onClick={() => { clearTasaPersonalizada(); if (tasa) onChange(formatRateString(tasa)); }}>
            Volver a la tasa BCV
          </button>
        )}
      </div>
      {errorConsulta && <p className="text-xs text-red-700 dark:text-red-300" role="alert">{errorConsulta}</p>}
    </div>
  );
}
