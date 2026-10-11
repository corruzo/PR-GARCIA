/** Logotipo PRGARCÍA: símbolo + nombre en vinotinto (texto real, nítido y accesible). */
export function BrandLogo({ inverse = false, size = 34, showName = true, tagline = '' }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/logo-mark.svg" alt="" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />
      {showName && (
        <span className="leading-none">
          <span className={`block text-xl font-extrabold tracking-tight ${inverse ? 'text-white' : 'text-brand-700 dark:text-white'}`}>PRGARCÍA</span>
          {tagline && <span className="mt-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">{tagline}</span>}
        </span>
      )}
    </span>
  );
}
