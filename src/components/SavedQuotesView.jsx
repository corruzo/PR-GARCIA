import { useState } from 'react';
import { Bookmark, Search, Trash2, ExternalLink, Send, Calendar, DollarSign, Sparkles } from 'lucide-react';
import { formatearMoneda } from '../utils/calculator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function SavedQuotesView({ items = [], onOpen, onDelete, onClear }) {
  const [search, setSearch] = useState('');

  const filteredItems = items.filter((item) => {
    const q = search.toLowerCase();
    const nombre = (item.values?.nombreCliente || '').toLowerCase();
    const monto = (item.values?.monto || '').toString();
    return nombre.includes(q) || monto.includes(q);
  });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Encabezado del Apartado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
              <Bookmark size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Mis Cotizaciones Guardadas</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Historial completo de propuestas presupuestadas</p>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
          >
            <Trash2 size={14} /> Vaciar historial ({items.length})
          </button>
        )}
      </div>

      {/* Buscador */}
      {items.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por cliente o monto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-10"
          />
        </div>
      )}

      {/* Grid de Cotizaciones */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const { values, resultado, createdAt } = item;
            const cliente = values?.nombreCliente?.trim() || 'Cliente Sin Nombre';
            const moneda = values?.moneda || 'USD';
            const monto = parseFloat(values?.monto || 0);
            const total = resultado?.totalPagar || monto;
            const interes = resultado?.interes || 0;

            const fechaStr = createdAt
              ? format(new Date(createdAt), "dd/MM/yyyy · HH:mm", { locale: es })
              : 'Fecha no registrada';

            return (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md hover:border-brand-500/50 transition-all duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white block">
                        {cliente}
                      </span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} /> {fechaStr}
                      </span>
                    </div>
                    <span
                      className={`history-currency ${
                        moneda === 'USD' ? 'history-currency-usd' : 'history-currency-ves'
                      }`}
                    >
                      {moneda}
                    </span>
                  </div>

                  {/* Cifras clave */}
                  <div className="grid grid-cols-2 gap-2 my-3">
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950/50">
                      <span className="text-[10px] uppercase font-semibold text-gray-400 block">Capital</span>
                      <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                        {formatearMoneda(monto, moneda)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30">
                      <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 block">Total a Cobrar</span>
                      <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {formatearMoneda(total, moneda)}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                    <p>• <strong>Interés:</strong> {values?.tasa}% ({values?.modalidadTasa}) = {formatearMoneda(interes, moneda)}</p>
                    <p>• <strong>Plazo:</strong> {resultado?.diasTotales || 0} días ({resultado?.numeroCuotas || 1} cuotas {values?.frecuenciaPago})</p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 pt-4 mt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => onOpen?.(item)}
                    className="flex-1 flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
                  >
                    <ExternalLink size={14} /> Cargar en simulador
                  </button>

                  <button
                    type="button"
                    onClick={() => onDelete?.(item.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-600 hover:border-red-300 dark:hover:border-red-900 transition-colors"
                    title="Eliminar de mi lista"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-800 bg-white/50 dark:bg-gray-900/40 p-6">
          <Bookmark size={40} className="text-brand-esmeralda/50 dark:text-brand-menta/50 mb-3" />
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
            {search ? 'No se encontraron cotizaciones coincidentes' : 'No tienes cotizaciones guardadas aún'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mt-1">
            {search ? 'Prueba con otros términos de búsqueda.' : 'Guarda las presupuestaciones que realices en el simulador para consultarlas cuando lo necesites.'}
          </p>
        </div>
      )}
    </div>
  );
}
