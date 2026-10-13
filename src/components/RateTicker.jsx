import { RefreshCw } from 'lucide-react';
import { useBCV } from '../hooks/useBCV';

/**
 * Chip con la tasa BCV del día. Consulta la tasa al cargar la app (y al
 * tocarlo); la guarda en caché para el resto de módulos (préstamos y pagos).
 */
export function RateTicker({ className = '' }) {
  const { tasa, cargando, ultimaConsulta, verificadaBCV, tasaAnticuada, consultarBCV } = useBCV();
  const valor = Number(tasa);
  const fecha = ultimaConsulta && ultimaConsulta.getTime() > 0
    ? ultimaConsulta.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
  const title = cargando
    ? 'Consultando la tasa BCV…'
    : `${fecha ? `Consultada ${fecha}` : 'Sin consultar'}${verificadaBCV ? '' : ' · referencial'}${tasaAnticuada ? ' · última guardada' : ''}. Toca para actualizar.`;

  return (
    <button type="button" title={title} aria-label={`Tasa BCV: ${valor > 0 ? `Bs. ${valor}` : 'sin dato'}. Actualizar`}
      onClick={() => consultarBCV({ force: true })}
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tasaAnticuada ? 'bg-amber-500' : 'bg-brand-700 dark:bg-brand-400'}`} aria-hidden="true" />
      <span className="font-medium text-slate-600 dark:text-slate-400">BCV</span>
      <span className="num font-semibold text-[#222222] dark:text-white" aria-live="polite">
        {valor > 0 ? `Bs. ${valor.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}
      </span>
      {cargando && <RefreshCw size={12} className="animate-spin text-slate-500" aria-hidden="true" />}
    </button>
  );
}
