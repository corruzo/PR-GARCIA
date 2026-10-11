/** Logotipo PRGARCÍA: emblema + nombre (texto real, accesible y nítido). */
export function BrandLogo({ inverse = false, size = 40, tagline = 'Préstamos y cartera' }) {
  return (
    <span className="flex items-center gap-3">
      <img src="/logo-mark.svg" alt="" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />
      <span className="leading-none">
        <span className={`block text-[17px] font-bold tracking-[0.12em] ${inverse ? 'text-white' : 'text-brand-900 dark:text-white'}`}>PRGARCÍA</span>
        {tagline && (
          <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] ${inverse ? 'text-oro-300' : 'text-oro-700 dark:text-oro-300'}`}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
