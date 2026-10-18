import { useCallback, useState } from 'react';
import { MotivoDialog } from './MotivoDialog';

/**
 * Diálogo accesible para confirmar acciones delicadas. Reemplaza
 * window.prompt/confirm: muestra el aviso, valida el motivo (si se pide) y se
 * cancela con Escape.
 *   const motivo = useMotivoDialog();
 *   const texto = await motivo.pedir({ titulo: 'Anular pago', aviso: '…' });   // texto o null
 *   const ok = await motivo.pedir({ titulo: 'Eliminar', conMotivo: false });  // true o null
 *   {motivo.dialogo}
 */
export function useMotivoDialog() {
  const [solicitud, setSolicitud] = useState(null);

  const pedir = useCallback((opciones) => new Promise((resolve) => setSolicitud({ ...opciones, resolve })), []);
  const cerrar = (valor) => {
    solicitud?.resolve(valor);
    setSolicitud(null);
  };

  const dialogo = solicitud ? <MotivoDialog {...solicitud} onCancel={() => cerrar(null)} onConfirm={(texto) => cerrar(texto)} /> : null;
  return { pedir, dialogo };
}
