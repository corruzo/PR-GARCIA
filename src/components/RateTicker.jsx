import { useEffect, useState } from 'react';
import { getCachedBCV } from '../services/bcvService';

function formatFecha(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return '';
  return date.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Franja superior con la última tasa BCV conocida (estilo banca en línea). */
export function RateTicker() {
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

  return (
    <div className="bg-brand-950 text-[11px] text-brand-100">
      <div className="mx-auto flex h-8 max-w-6xl items-center justify-between gap-3 px-4 lg:px-6">
        <span className="truncate">Gestión de préstamos en USD y Bs.</span>
        <span className="flex shrink-0 items-center gap-1.5" aria-live="polite">
          <span className="font-semibold uppercase tracking-wider text-oro-300">Tasa BCV</span>
          {rate ? (
            <>
              <span className="num font-semibold text-white">Bs. {Number(rate.rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
              <span className="hidden sm:inline text-brand-200">· {formatFecha(rate.fetchedAt)}{rate.verifiedAgainstBCV ? '' : ' · referencial'}</span>
            </>
          ) : (
            <span className="text-brand-200">sin consultar</span>
          )}
        </span>
      </div>
    </div>
  );
}
