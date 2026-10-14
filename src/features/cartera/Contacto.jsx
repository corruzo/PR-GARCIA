import { MessageCircle, Phone } from 'lucide-react';
import { toWhatsAppNumber } from '../../../shared/finance/report.js';

/** Botones grandes (≥ 48 px) para llamar o escribir por WhatsApp a un cliente. */
export function Contacto({ telefono, nombre, mensaje = '', compact = false }) {
  const numero = toWhatsAppNumber(telefono);
  if (!numero) return null;
  const base = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 text-base font-semibold transition-colors';
  const size = compact ? 'w-12' : 'px-4';
  return (
    <div className="flex gap-2">
      <a href={`tel:+${numero}`} aria-label={`Llamar a ${nombre}`}
        className={`${base} ${size} border-slate-300 text-[#222222] hover:bg-slate-100 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800`}>
        <Phone size={20} aria-hidden="true" />{!compact && 'Llamar'}
      </a>
      <a href={`https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`} target="_blank" rel="noopener noreferrer"
        aria-label={`Escribir por WhatsApp a ${nombre}`}
        className={`${base} ${size} border-emerald-700 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40`}>
        <MessageCircle size={20} aria-hidden="true" />{!compact && 'WhatsApp'}
      </a>
    </div>
  );
}
