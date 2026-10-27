import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MAX_MOTIVO = 300;

/** Diálogo de confirmación (con o sin motivo). Se usa a través de useMotivoDialog(). */
export function MotivoDialog({ titulo, aviso, confirmar = 'Anular', conMotivo = true, onCancel, onConfirm }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const campo = useRef(null);

  const botonConfirmar = useRef(null);
  useEffect(() => { (campo.current ?? botonConfirmar.current)?.focus(); }, []);
  useEffect(() => {
    const alPresionar = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  }, [onCancel]);

  const enviar = (e) => {
    e.preventDefault();
    if (!conMotivo) { onConfirm(true); return; }
    const motivo = texto.trim();
    if (!motivo) { setError('Escribe el motivo.'); return; }
    if (motivo.length > MAX_MOTIVO || /[<>]/.test(motivo)) { setError(`Máximo ${MAX_MOTIVO} caracteres, sin < ni >.`); return; }
    onConfirm(motivo);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 overlay-safe sm:items-center" role="presentation" onClick={onCancel}>
      <form role="dialog" aria-modal="true" aria-labelledby="motivo-titulo" onSubmit={enviar} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <h2 id="motivo-titulo" className="text-base font-semibold">{titulo}</h2>
        {aviso && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{aviso}</p>}
        {conMotivo && <div>
          <label htmlFor="motivo-texto" className="label-base">Motivo (obligatorio)</label>
          <textarea id="motivo-texto" ref={campo} className="input-base min-h-20" maxLength={MAX_MOTIVO} value={texto}
            aria-invalid={Boolean(error)} aria-describedby={error ? 'motivo-error' : undefined}
            onChange={(e) => { setTexto(e.target.value); setError(''); }} />
          {error && <p id="motivo-error" className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
        </div>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="submit" ref={botonConfirmar} className="btn-primary bg-red-700 hover:bg-red-800">{confirmar}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
