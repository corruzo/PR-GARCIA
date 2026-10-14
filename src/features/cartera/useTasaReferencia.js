import { useEffect, useState } from 'react';
import { getCachedBCV } from '../../services/bcvService';
import { getTasaReferencia } from './api';
import { tasaVigente } from './helpers';

/**
 * Tasa BCV de referencia para precargar formularios: la oficial guardada en el
 * servidor o, si no hay, la de la caché local con menos de 24 horas. Nunca
 * propone una tasa vieja (p. ej. la del desembolso) como «tasa del día».
 */
export function useTasaReferencia() {
  const [ref, setRef] = useState(() => {
    const cached = getCachedBCV();
    return cached && tasaVigente(cached.fetchedAt) ? { tasa: cached.rate, fecha: cached.fetchedAt, fuente: cached.source, oficial: cached.verifiedAgainstBCV } : null;
  });
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancel = false;
    getTasaReferencia()
      .then((r) => { if (!cancel && r) setRef({ ...r, oficial: true }); })
      .catch(() => {})
      .finally(() => { if (!cancel) setCargando(false); });
    return () => { cancel = true; };
  }, []);

  return { referencia: ref, cargando };
}
