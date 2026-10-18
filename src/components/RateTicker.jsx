import { useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X } from 'lucide-react';
import { useBCV } from '../hooks/useBCV';
import { parseRateInput } from '../../shared/finance/input.js';
import { toDisplayDateTimeCaracas } from '../../shared/finance/dates.js';
import { clearTasaPersonalizada, setTasaPersonalizada, tasaATexto, useTasaPersonalizada } from '../services/tasaPersonalizada';

const fmt = (v) => Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });

/**
 * Chip de la tasa de cambio en el encabezado. Muestra la tasa BCV del día o,
 * si se eligió, la tasa personalizada. Al tocarlo abre el panel para
 * actualizar la BCV y escribir, usar o quitar una tasa personalizada.
 */
export function RateTicker({ className = '' }) {
  const bcv = useBCV();
  const personalizada = useTasaPersonalizada();
  const [abierto, setAbierto] = useState(false);
  const valorBCV = Number(bcv.tasa);
  const valor = personalizada ? personalizada.tasa : valorBCV;

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        aria-label={`Tasa de cambio: ${valor > 0 ? `Bs. ${fmt(valor)}` : 'sin dato'}${personalizada ? ' (personalizada)' : ''}. Cambiar`}
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${personalizada ? 'bg-amber-500' : bcv.tasaAnticuada ? 'bg-amber-500' : 'bg-brand-700 dark:bg-brand-400'}`} aria-hidden="true" />
        <span className="font-medium text-slate-600 dark:text-slate-400">{personalizada ? 'Mi tasa' : 'BCV'}</span>
        <span className="num font-semibold text-[#222222] dark:text-white" aria-live="polite">{valor > 0 ? `Bs. ${fmt(valor)}` : '—'}</span>
        {bcv.cargando && <RefreshCw size={12} className="animate-spin text-slate-500" aria-hidden="true" />}
      </button>
      {abierto && <PanelTasa bcv={bcv} personalizada={personalizada} onClose={() => setAbierto(false)} />}
    </>
  );
}

function PanelTasa({ bcv, personalizada, onClose }) {
  const [texto, setTexto] = useState(personalizada ? tasaATexto(personalizada.tasa) : '');
  const [error, setError] = useState('');
  const valorBCV = Number(bcv.tasa);
  const consultada = bcv.ultimaConsulta && bcv.ultimaConsulta.getTime() > 0
    ? toDisplayDateTimeCaracas(bcv.ultimaConsulta)
    : '';

  const guardar = (event) => {
    event.preventDefault();
    const tasa = parseRateInput(texto);
    if (!tasa) { setError('Escribe una tasa válida, por ejemplo 230,50.'); return; }
    setTasaPersonalizada(tasa);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="presentation" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="panel-tasa-titulo" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 id="panel-tasa-titulo" className="text-base font-semibold">Tasa de cambio</h2>
          <button type="button" className="btn-ghost h-8 w-8 p-0" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tasa BCV {bcv.verificadaBCV ? 'oficial' : 'consultada'}</p>
          <p className="num text-lg font-bold">{valorBCV > 0 ? `Bs. ${fmt(valorBCV)}` : '—'}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {consultada ? `Consultada ${consultada}` : 'Sin consultar'}{bcv.tasaAnticuada ? ' · última guardada' : ''}{bcv.fuente ? ` · ${bcv.fuente}` : ''}
          </p>
          <button type="button" className="btn-ghost mt-2 gap-1.5 border border-slate-200 text-xs dark:border-slate-700" disabled={bcv.cargando}
            onClick={() => bcv.consultarBCV({ force: true })}>
            <RefreshCw size={12} className={bcv.cargando ? 'animate-spin' : ''} aria-hidden="true" /> {bcv.cargando ? 'Consultando…' : 'Actualizar tasa BCV'}
          </button>
          {bcv.error && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{bcv.error}</p>}
        </div>

        <form onSubmit={guardar} className="space-y-2">
          <label htmlFor="tasa-personalizada" className="label-base">Tasa personalizada (opcional)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">Bs.</span>
              <input id="tasa-personalizada" className="input-base num pl-9" inputMode="decimal" placeholder={valorBCV > 0 ? tasaATexto(valorBCV) : '230,50'}
                value={texto} onChange={(e) => { setTexto(e.target.value.replace(/[^0-9.,]/g, '')); setError(''); }} />
            </div>
            <button type="submit" className="btn-primary shrink-0">Usar esta tasa</button>
          </div>
          {error && <p className="text-xs text-red-700 dark:text-red-300" role="alert">{error}</p>}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mientras esté activa, la calculadora, los préstamos y los pagos la proponen en lugar de la BCV (puedes cambiarla en cada operación).
            Se guarda solo en este equipo.
          </p>
        </form>

        {personalizada && (
          <button type="button" className="btn-secondary w-full" onClick={() => { clearTasaPersonalizada(); onClose(); }}>
            Volver a la tasa BCV
          </button>
        )}
      </section>
    </div>,
    document.body,
  );
}
