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
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 overlay-safe backdrop-blur-sm sm:items-center"
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
            <h3 className="formula-heading">1. Días y períodos</h3>
            <p>Se cuentan los días exactos entre la fecha de inicio y la de fin. Cada modalidad de tasa y cada frecuencia de pago equivale a un número fijo de días: diaria 1, semanal 7, quincenal 15 y mensual 30 (un «mes» son 30 días, no el mismo día del mes siguiente).</p>
            <code className="formula-code">días = fecha de fin − fecha de inicio</code>
          </article>

          <article>
            <h3 className="formula-heading">2. Interés simple</h3>
            <p>Nunca se cobra interés sobre interés. El interés de un tramo de días es:</p>
            <code className="formula-code">interés = capital × (tasa ÷ 100) × (días ÷ días de la modalidad)</code>
            <p className="mt-2"><strong>Sobre saldo pendiente</strong> (recomendado): cada cuota cobra el interés de sus días sobre el capital que aún se debe, así que las cuotas bajan a medida que se paga el capital.</p>
            <p className="mt-1"><strong>Interés fijo</strong>: el interés de todo el plazo se calcula sobre el capital inicial y se reparte entre las cuotas según sus días.</p>
          </article>

          <article>
            <h3 className="formula-heading">3. Cuotas</h3>
            <p>Hay una cuota por cada período completo de la frecuencia elegida, y la última vence el día de fin. Si sobran días, forman una cuota más corta; si sobra menos de un tercio de período (por ejemplo, menos de 10 días en un préstamo mensual), esos días se suman a la última cuota en lugar de crear una cuota de pocos días.</p>
            <code className="formula-code">cuota = capital ÷ número de cuotas + interés de sus días</code>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">El capital se divide en partes iguales; si no da exacto, los centavos que sobran van en las primeras cuotas.</p>
          </article>

          <article>
            <h3 className="formula-heading">4. Sin fecha de fin</h3>
            <p>Cada período (día, semana, quincena o mes) genera el interés del capital pendiente. El cliente paga ese interés en cada período y abona al capital cuando pueda; cada abono reduce el interés desde el día en que lo hace.</p>
          </article>

          <article>
            <h3 className="formula-heading">5. Conversión USD y VES</h3>
            <p>La tasa BCV indica cuántos bolívares equivalen a 1 dólar. Cada cuota se convierte y redondea al céntimo, y el total es la suma de las cuotas convertidas.</p>
            <code className="formula-code">USD a VES = monto en USD × tasa BCV</code>
            <code className="formula-code">VES a USD = monto en VES ÷ tasa BCV</code>
          </article>

          <article>
            <h3 className="formula-heading">6. Igual que el préstamo real</h3>
            <p>Al pulsar «Convertir en préstamo», el cronograma que se guarda es el mismo que muestra la calculadora: la base de datos lo recalcula con las mismas reglas, al céntimo.</p>
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
