import { useEffect, useState } from 'react';
import { getCachedBCV } from '../services/bcvService';

/** Chip con la última tasa BCV conocida. */
export function RateTicker({ className = '' }) {
  const [rate, setRate] = useState(() => getCachedBCV());

  useEffect(() => {
    const refresh = () => setRate(getCachedBCV());
    const interval = setInterval(refresh, 60 * 1000);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const fecha = rate ? new Date(rate.fetchedAt) : null;
  const title = fecha && fecha.getTime() > 0
    ? `Consultada ${fecha.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${rate.verifiedAgainstBCV ? '' : ' · referencial'}`
    : 'Aún no se ha consultado la tasa';

  return (
    <span title={title} aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-brand-700 dark:bg-brand-400" aria-hidden="true" />
      <span className="font-medium text-slate-600 dark:text-slate-400">BCV</span>
      <span className="num font-semibold text-[#222222] dark:text-white">
        {rate ? `Bs. ${Number(rate.rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}
      </span>
    </span>
  );
}
