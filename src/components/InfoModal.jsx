import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, X } from 'lucide-react';

export function InfoModal({ open, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 p-3 backdrop-blur-sm sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="formula-title"
        aria-describedby="formula-description"
        className="notice-modal modal-surface max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:max-h-[88dvh] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="formula-title" className="text-lg font-bold text-gray-900 dark:text-white">Cómo se calcula tu préstamo</h2>
            <p id="formula-description" className="mt-1 text-sm text-gray-500 dark:text-gray-400">PRGARCIA utiliza interés simple y días reales para estimar cada pago.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Cerrar información" className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={18} />
          </button>
        </header>

        <div className="mt-5 space-y-5 text-sm text-gray-700 dark:text-gray-300">
          <article>
            <h3 className="formula-heading">1. Días del préstamo</h3>
            <p>Se cuentan los días exactos entre la fecha de inicio y la fecha de vencimiento.</p>
            <code className="formula-code">días = fecha de fin − fecha de inicio</code>
          </article>

          <article>
            <h3 className="formula-heading">2. Interés simple</h3>
            <p>El interés se calcula sobre el capital inicial, sin sumar intereses sobre intereses.</p>
            <code className="formula-code">interés = capital × (tasa ÷ 100) × (días ÷ días de la modalidad)</code>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">La modalidad usa 1 día para diaria, 7 días para semanal y 15 días para quincenal.</p>
          </article>

          <article>
            <h3 className="formula-heading">3. Total a pagar</h3>
            <p>El total combina el capital solicitado y el interés calculado.</p>
            <code className="formula-code">total = capital + interés</code>
          </article>

          <article>
            <h3 className="formula-heading">4. Número y monto de cuotas</h3>
            <p>Las cuotas dependen de la frecuencia elegida. Si quedan días incompletos, se agrega una última cuota con el interés correspondiente únicamente a esos días.</p>
            <code className="formula-code">número de cuotas = techo(días ÷ intervalo de pago)</code>
            <code className="formula-code">interés de la cuota = interés total × (días del período ÷ días totales)</code>
            <code className="formula-code">cuota = capital asignado + interés del período</code>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Los intervalos son: diario 1 día, semanal 7 días y quincenal 15 días.</p>
          </article>

          <article>
            <h3 className="formula-heading">5. Conversión USD y VES</h3>
            <p>La tasa BCV representa cuántos bolívares equivalen a 1 dólar.</p>
            <code className="formula-code">USD a VES = monto en USD × tasa BCV</code>
            <code className="formula-code">VES a USD = monto en VES ÷ tasa BCV</code>
          </article>

          <article>
            <h3 className="formula-heading">6. Cronograma</h3>
            <p>Cada fila muestra la fecha de pago, capital, interés, total de la cuota y saldo restante. La última cuota ajusta cualquier diferencia de redondeo.</p>
          </article>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            PRGARCÍA es una herramienta informativa: no otorga préstamos ni es una entidad financiera. Los cálculos son estimaciones y pueden diferir de los de un banco o de tu contrato. La tasa proviene del BCV y puede tener retrasos. Confirma siempre los términos por escrito con la otra parte.
          </div>
        </div>

        <button type="button" onClick={onClose} className="btn-primary mt-6 w-full">Entendido</button>
      </section>
    </div>,
    document.body,
  );
}
