import { useCallback, useState } from 'react';

/**
 * Ejecuta acciones que escriben en el servidor con un solo estado de
 * «ocupado» y error, sin repetir try/catch en cada botón.
 *   const accion = useAccion();
 *   accion.run(() => api.anularPago(id, motivo), recargar);
 */
export function useAccion() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(async (tarea, onDone) => {
    setBusy(true);
    setError('');
    try {
      const resultado = await tarea();
      onDone?.(resultado);
      return resultado;
    } catch (err) {
      setError(err?.message || 'Ocurrió un error inesperado.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error };
}
