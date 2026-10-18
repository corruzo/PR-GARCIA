import { toDisplayDate } from '../../../shared/finance/dates.js';
import { SITUACION } from '../cartera/helpers';

const MAX_CELDAS = 60;

// Colores de estado (fijos, iguales en modo claro y oscuro). Siempre van con
// su texto en la leyenda y en la tabla: el color nunca es el único indicio.
const ESTADOS = {
  pagada: { clase: 'bg-[#0ca30c]', texto: 'Pagadas' },
  vencida: { clase: 'bg-[#d03b3b]', texto: 'Vencidas' },
  proxima: { clase: 'bg-[#fab219]', texto: 'Vencen pronto' },
  pendiente: { clase: 'bg-slate-300 dark:bg-slate-600', texto: 'Pendientes' },
};

function grupo(situacion) {
  if (situacion === 'pagada') return 'pagada';
  if (situacion === 'vencida') return 'vencida';
  if (situacion === 'vence_hoy' || situacion === 'por_vencer') return 'proxima';
  return 'pendiente';
}

/** Una celda por cuota, en orden: el avance del préstamo de un vistazo. */
export function LineaCuotas({ cuotas, conteo, abierto }) {
  const visibles = cuotas.filter((c) => c.situacion !== 'anulada');
  if (visibles.length === 0) return null;
  const nombre = abierto ? 'período' : 'cuota';
  return (
    <div className="mb-4">
      {visibles.length <= MAX_CELDAS && (
        <div className="flex gap-0.5" role="img"
          aria-label={`${conteo.pagada} pagadas, ${conteo.vencida} vencidas, ${conteo.proxima} por vencer y ${conteo.pendiente} pendientes`}>
          {visibles.map((c) => (
            <span key={c.id} className={`h-3 min-w-1 flex-1 rounded ${ESTADOS[grupo(c.situacion)].clase}`}
              title={`${nombre[0].toUpperCase()}${nombre.slice(1)} ${c.numero} · ${toDisplayDate(c.fecha_vencimiento)} · ${(SITUACION[c.situacion] ?? SITUACION.al_dia).label}`} />
          ))}
        </div>
      )}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {Object.entries(ESTADOS).filter(([k]) => conteo[k] > 0).map(([k, e]) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${e.clase}`} aria-hidden="true" />
            {e.texto}: <strong className="text-[#222222] dark:text-white">{conteo[k]}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
