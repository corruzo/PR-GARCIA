/**
 * useBCV.js — Tasa BCV del día (vía /api/bcv) con caché local y soporte sin conexión.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  BCV_CACHE_KEY,
  fetchBCVRate,
  formatRateString,
  getCachedBCV,
  saveBCVCache,
} from '../services/bcvService';

export function useBCV() {
  // El estado arranca con la última tasa guardada en el equipo (si hay).
  const [inicial] = useState(() => getCachedBCV());
  const [tasa, setTasa] = useState(() => (inicial ? formatRateString(inicial.rate) : ''));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fuente, setFuente] = useState(() => inicial?.source || null);
  const [ultimaConsulta, setUltima] = useState(() => (inicial ? new Date(inicial.fetchedAt) : null));
  const [tasaAnticuada, setTasaAnticuada] = useState(() => Boolean(inicial?.stale));
  const [tiempoRespuesta, setTiempoRespuesta] = useState(null);
  const [verificadaBCV, setVerificadaBCV] = useState(() => Boolean(inicial?.verifiedAgainstBCV));
  const [cambioBCV, setCambioBCV] = useState(false);
  const [cacheInfo, setCacheInfo] = useState(inicial);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const consultarBCV = useCallback(async ({ force = false } = {}) => {
    const startedAt = performance.now();
    setCargando(true);
    setError(null);

    if (!force) {
      const cached = getCachedBCV();
      if (cached) {
        setTasa(formatRateString(cached.rate));
        setFuente(cached.source || 'caché local');
        setUltima(new Date(cached.fetchedAt));
        setTasaAnticuada(Boolean(cached.stale));
        setVerificadaBCV(Boolean(cached.verifiedAgainstBCV));
        setCacheInfo(cached);
      }
    }

    const live = await fetchBCVRate();

    if (live.ok) {
      const persisted = saveBCVCache(
        live.tasa,
        live.fuente,
        live.stale,
        live.fetchedAt,
        live.verifiedAgainstBCV,
        live.changed,
      );
      const nextDate = new Date(persisted?.fetchedAt || Date.now());

      setTasa(formatRateString(live.tasa));
      setFuente(live.fuente);
      setUltima(nextDate);
      setTasaAnticuada(Boolean(live.stale));
      setVerificadaBCV(Boolean(live.verifiedAgainstBCV));
      setCambioBCV(Boolean(live.changed));
      setTiempoRespuesta(Math.round(performance.now() - startedAt));
      setCacheInfo(persisted || {
        rate: live.tasa,
        fetchedAt: live.fetchedAt || nextDate.toISOString(),
        source: live.fuente,
        stale: Boolean(live.stale),
        verifiedAgainstBCV: Boolean(live.verifiedAgainstBCV),
        changed: Boolean(live.changed),
      });
      setCargando(false);
      return {
        ok: true,
        tasa: live.tasa,
        fuente: live.fuente,
        cached: Boolean(live.stale),
        stale: Boolean(live.stale),
        fetchedAt: nextDate,
      };
    }

    const cachedFallback = getCachedBCV();
    if (cachedFallback) {
      setTasa(formatRateString(cachedFallback.rate));
      setFuente(cachedFallback.source || 'caché local');
      setUltima(new Date(cachedFallback.fetchedAt));
      setTasaAnticuada(true);
      setVerificadaBCV(false);
      setCambioBCV(false);
      setTiempoRespuesta(Math.round(performance.now() - startedAt));
      setCacheInfo(cachedFallback);
      setError('Sin conexión. Se cargó la última tasa guardada en caché.');
      setCargando(false);
      return {
        ok: true,
        tasa: cachedFallback.rate,
        fuente: cachedFallback.source || 'caché local',
        cached: true,
        stale: true,
        fetchedAt: new Date(cachedFallback.fetchedAt),
      };
    }

    const msg = 'No se pudo obtener la tasa BCV y no hay una tasa guardada.';
    setError(msg);
    setTiempoRespuesta(Math.round(performance.now() - startedAt));
    setCargando(false);
    return { ok: false, error: msg };
  }, []);

  // Consulta la tasa en vivo al montar (asíncrono: no bloquea el primer render).
  useEffect(() => {
    const id = setTimeout(() => { consultarBCV(); }, 0);
    return () => clearTimeout(id);
  }, [consultarBCV]);

  return {
    tasa,
    setTasa,
    cargando,
    error,
    fuente,
    ultimaConsulta,
    cacheInfo,
    online,
    tasaAnticuada,
    verificadaBCV,
    cambioBCV,
    tiempoRespuesta,
    consultarBCV,
    hasCachedBCV: !!cacheInfo,
    BCV_CACHE_KEY,
  };
}
