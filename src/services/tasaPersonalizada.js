/**
 * Tasa de cambio personalizada (Bs por USD) elegida por la persona que usa la
 * app, por ejemplo una tasa pactada distinta a la del BCV. Se guarda en este
 * equipo y, mientras esté activa, los formularios la proponen en lugar de la
 * tasa BCV.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'prgarcia.tasa.personalizada';
const EVENTO = 'prgarcia:tasa-personalizada';

function leerRaw() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

function parse(raw) {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return v && Number(v.tasa) > 0 ? { tasa: Number(v.tasa), fecha: v.fecha || null } : null;
  } catch {
    return null;
  }
}

export function getTasaPersonalizada() {
  return parse(leerRaw());
}

export function setTasaPersonalizada(tasa) {
  if (!(Number(tasa) > 0)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ tasa: Number(tasa), fecha: new Date().toISOString() }));
  } catch {
    // Sin almacenamiento (ventana privada): no se puede recordar.
  }
  window.dispatchEvent(new Event(EVENTO));
}

export function clearTasaPersonalizada() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nada que borrar.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function subscribe(callback) {
  window.addEventListener(EVENTO, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(EVENTO, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Tasa personalizada activa ({ tasa, fecha }) o null; se actualiza en toda la app. */
export function useTasaPersonalizada() {
  const raw = useSyncExternalStore(subscribe, leerRaw, () => '');
  return parse(raw);
}

/** Texto con coma decimal para los campos de la app. */
export function tasaATexto(tasa) {
  return String(tasa).replace('.', ',');
}
