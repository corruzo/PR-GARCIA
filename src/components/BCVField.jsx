import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, PencilLine, RefreshCw } from 'lucide-react';
import { useBCV } from '../hooks/useBCV';
import { formatRateString } from '../services/bcvService';
import { NoticeModal } from './NoticeModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function BCVField({ value, onChange }) {
  const [notice, setNotice] = useState(null);
  const {
    cargando,
    tasa,
    error,
    fuente,
    cacheInfo,
    online,
    tasaAnticuada,
    verificadaBCV,
    cambioBCV,
    consultarBCV,
  } = useBCV();

  const tasaInicialAplicada = useRef(false);

  useEffect(() => {
    if (!tasaInicialAplicada.current && !value && tasa) {
      tasaInicialAplicada.current = true;
      onChange(formatRateString(tasa));
    }
  }, [onChange, tasa, value]);

  const handleConsultar = async () => {
    const res = await consultarBCV({ force: true });
    if (res.ok) {
      onChange(formatRateString(res.tasa));
      return;
    }

    setNotice({
      title: 'No pudimos actualizar la tasa',
      message: 'Revisa tu conexión e inténtalo de nuevo. Puedes continuar usando la última tasa guardada.',
    });
  };

  const cacheTimestamp = cacheInfo?.fetchedAt ? new Date(cacheInfo.fetchedAt) : null;
  const valorManual = value !== '' && cacheInfo?.rate && Math.abs(Number(value) - Number(cacheInfo.rate)) > 0.01;
  const estado = valorManual
    ? { texto: 'Tasa personalizada', detalle: 'No coincide con la tasa del BCV guardada', color: 'text-blue-600 dark:text-blue-400', icon: PencilLine }
    : cambioBCV && verificadaBCV
      ? { texto: 'El BCV actualizó su tasa', detalle: 'La nueva tasa coincide con la publicada oficialmente', color: 'text-amber-600 dark:text-amber-400', icon: AlertCircle }
      : verificadaBCV
        ? { texto: 'Tasa igual a la publicada por el BCV', detalle: 'Confirmada en la última consulta', color: 'text-gain-600 dark:text-gain-500', icon: CheckCircle2 }
    : tasaAnticuada || error
      ? { texto: 'Última tasa BCV guardada', detalle: 'Podría haber cambiado desde la última consulta', color: 'text-amber-600 dark:text-amber-400', icon: Clock3 }
      : fuente
        ? { texto: 'Tasa consultada', detalle: 'Pendiente de confirmación', color: 'text-gray-500 dark:text-gray-400', icon: Clock3 }
        : { texto: 'Tasa sin confirmar', detalle: 'Pulsa Actualizar para consultar el BCV', color: 'text-gray-500 dark:text-gray-400', icon: RefreshCw };
  const EstadoIcon = estado.icon;

  return (
    <div className="space-y-1.5">
      <label htmlFor="input-tasa-bcv" className="label-base">Tasa BCV del día (VES / USD)</label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 select-none">Bs.</span>
          <input
            id="input-tasa-bcv"
            type="number"
            inputMode="decimal"
            min="0"
            max={Number.MAX_SAFE_INTEGER}
            step="any"
            placeholder="Ej: 855.66"
            value={value}
            onChange={e => {
              const val = e.target.value;
              onChange(typeof val === 'string' ? val.replace(',', '.') : val);
            }}
            className="input-base pl-9 font-mono"
          />
        </div>
        <button
          onClick={handleConsultar}
          disabled={cargando}
          className="btn-ghost border border-gray-300 dark:border-gray-700 px-3 gap-1.5 shrink-0"
          title="Consultar tasa BCV actual"
        >
          <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          <span className="text-xs">{cargando ? 'Consultando…' : 'Actualizar tasa'}</span>
        </button>
      </div>

      <div className="flex flex-col gap-1 min-h-4">
        {cacheTimestamp && (error || !online) && (
          <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100" role="status" aria-live="polite">
            {!online
              ? `Sin conexión: mostrando la última tasa guardada (${format(cacheTimestamp, 'dd/MM/yyyy HH:mm', { locale: es })}).`
              : `No pudimos consultar la fuente; mostramos la última tasa guardada (${format(cacheTimestamp, 'dd/MM/yyyy HH:mm', { locale: es })}).`}
          </p>
        )}
        {error && !cacheTimestamp && (
          <p className="text-xs text-red-700 dark:text-red-300" role="alert">No pudimos obtener la tasa y todavía no hay una guardada. Revisa tu conexión e inténtalo de nuevo.</p>
        )}
        {cargando ? (
          <span className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400">
            <RefreshCw size={11} className="animate-spin" /> Consultando la tasa oficial del BCV…
          </span>
        ) : (
          <span className={`flex items-start gap-1 text-xs ${estado.color}`}>
            <EstadoIcon size={11} className="mt-0.5 shrink-0" />
            <span>
              <strong className="font-semibold">{estado.texto}</strong>
              <span className="ml-1">· {estado.detalle}</span>
              {cacheTimestamp && (tasaAnticuada || valorManual) && (
                <span className="block mt-0.5 text-[11px] opacity-80">
                  Consultada: {format(cacheTimestamp, 'dd/MM/yyyy HH:mm', { locale: es })}
                </span>
              )}
            </span>
          </span>
        )}
      </div>

      <NoticeModal
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}
