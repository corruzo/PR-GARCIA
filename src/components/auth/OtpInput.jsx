import { useRef } from 'react';

const LONGITUD = 6;

/**
 * Código de 6 dígitos en casillas: avanza solo al escribir, retrocede con
 * Borrar y acepta pegar el código completo.
 */
export function OtpInput({ digits, onChange }) {
  const refs = useRef([]);

  const cambiar = (index, value) => {
    const limpio = value.replace(/[^0-9]/g, '');
    if (limpio.length > 1) {
      // Código pegado: se reparte en las casillas.
      const siguiente = Array.from({ length: LONGITUD }, (_, i) => limpio[i] ?? '');
      onChange(siguiente);
      refs.current[Math.min(limpio.length, LONGITUD) - 1]?.focus();
      return;
    }
    const siguiente = [...digits];
    siguiente[index] = limpio;
    onChange(siguiente);
    if (limpio && index < LONGITUD - 1) refs.current[index + 1]?.focus();
  };

  const tecla = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus();
  };

  return (
    <div className="my-4 flex items-center justify-center gap-2">
      {digits.map((digit, idx) => (
        <input
          key={idx}
          ref={(el) => { refs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={idx === 0 ? 'one-time-code' : 'off'}
          maxLength={idx === 0 ? LONGITUD : 1}
          aria-label={`Dígito ${idx + 1} del código de verificación`}
          value={digit}
          onChange={(e) => cambiar(idx, e.target.value)}
          onKeyDown={(e) => tecla(idx, e)}
          className="h-13 w-11 rounded-xl border border-slate-200 bg-white text-center font-mono text-xl font-bold text-slate-900 shadow-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      ))}
    </div>
  );
}
