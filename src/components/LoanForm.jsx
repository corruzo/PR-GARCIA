import { UserRound, DollarSign, Calendar, Percent, CheckCircle2 } from 'lucide-react';
import { BCVField } from './BCVField';

const MODALIDADES = [
  { value: 'diaria',   label: 'Diaria' },
  { value: 'semanal',  label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual', label: 'Mensual' },
];

const FRECUENCIAS = [
  { value: 'diario',    label: 'Diario' },
  { value: 'semanal',   label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual',   label: 'Mensual' },
];

export function LoanForm({ values, onChange }) {
  const set = (key) => (e) => {
    let val = e?.target ? e.target.value : e;
    if (typeof val === 'string') {
      val = val.replace(',', '.');
    }
    onChange(key, val);
  };

  const hasCapital = parseFloat(values.monto) > 0;
  const hasCondiciones = hasCapital && parseFloat(values.tasa) > 0;
  const hasFechas = hasCondiciones && values.fechaInicio && values.fechaFin && new Date(values.fechaFin) >= new Date(values.fechaInicio);

  return (
    <div className="space-y-6">
      
      {/* ── PASO 1: CAPITAL ── */}
      <div className={`rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 ${
        hasCapital ? 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 ring-1 ring-brand-500/20'
      }`}>
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center">
            <DollarSign size={16} className={hasCapital ? "text-brand-600 mr-2" : "text-gray-400 mr-2"} />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Capital</span>
          </div>
          {hasCapital && <CheckCircle2 size={16} className="text-gain-500" />}
        </div>
        
        <div className="p-3 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <button
              type="button"
              onClick={() => onChange('moneda', 'USD')}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                values.moneda === 'USD' ? 'bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              $ USD
            </button>
            <button
              type="button"
              onClick={() => onChange('moneda', 'VES')}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${
                values.moneda === 'VES' ? 'bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              Bs VES
            </button>
          </div>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50">
          <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Monto</span>
          <div className="flex items-center gap-1 group">
            <span className="text-gray-400 font-medium group-focus-within:text-gray-600 dark:group-focus-within:text-gray-300 transition-colors">{values.moneda === 'USD' ? '$' : 'Bs.'}</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={values.monto}
                onChange={set('monto')}
                className="w-24 text-right bg-transparent text-lg font-bold focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 peer"
              />
              <span className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700 peer-focus:bg-gray-500 dark:peer-focus:bg-gray-400 transition-colors duration-150" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3">
          <BCVField value={values.tasaBCV} onChange={(v) => onChange('tasaBCV', v)} />
        </div>
      </div>

      {/* ── PASO 2: CONDICIONES ── */}
      {hasCapital && (
        <div className={`rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 animate-fade-in ${
          hasCondiciones ? 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 ring-1 ring-brand-500/20'
        }`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center">
              <Percent size={16} className={hasCondiciones ? "text-brand-600 mr-2" : "text-gray-400 mr-2"} />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Interés</span>
            </div>
            {hasCondiciones && <CheckCircle2 size={16} className="text-gain-500" />}
          </div>
          
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Tasa de interés</span>
            <div className="flex items-center gap-1 group">
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={values.tasa}
                  onChange={set('tasa')}
                  className="w-16 text-right bg-transparent text-lg font-bold focus:outline-none text-brand-600 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 peer"
                />
                <span className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700 peer-focus:bg-gray-500 dark:peer-focus:bg-gray-400 transition-colors duration-150" />
              </div>
              <span className="text-gray-400 font-medium">%</span>
            </div>
          </div>
          
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Modalidad</span>
            <div className="relative">
              <select
                value={values.modalidadTasa}
                onChange={set('modalidadTasa')}
                className="bg-transparent text-sm font-medium text-right focus:outline-none text-gray-900 dark:text-white cursor-pointer pr-1 peer appearance-none"
                dir="rtl"
              >
                {MODALIDADES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <span className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700 peer-focus:bg-gray-500 dark:peer-focus:bg-gray-400 transition-colors duration-150" />
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 3: PLAZO Y COBRO ── */}
      {hasCondiciones && (
        <div className={`rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 animate-fade-in ${
          hasFechas ? 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 ring-1 ring-brand-500/20'
        }`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center">
              <Calendar size={16} className={hasFechas ? "text-brand-600 mr-2" : "text-gray-400 mr-2"} />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Plazos</span>
            </div>
            {hasFechas && <CheckCircle2 size={16} className="text-gain-500" />}
          </div>
          
          <div className="p-3 border-b border-gray-100 dark:border-gray-700/50">
            <p className="text-gray-600 dark:text-gray-400 text-xs font-medium mb-2 px-1 uppercase tracking-wider">Frecuencia de Cuotas</p>
            <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-lg">
              {FRECUENCIAS.map(f => (
                 <button
                   key={f.value}
                   type="button"
                   onClick={() => onChange('frecuenciaPago', f.value)}
                   className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                     values.frecuenciaPago === f.value ? 'bg-white dark:bg-[#2c2c2e] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500'
                   }`}
                 >
                   {f.label}
                 </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Fecha de emisión</span>
            <div className="relative">
              <input
                type="date"
                value={values.fechaInicio}
                onChange={set('fechaInicio')}
                className="bg-transparent text-sm font-medium text-right focus:outline-none text-gray-900 dark:text-white peer"
              />
              <span className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700 peer-focus:bg-gray-500 dark:peer-focus:bg-gray-400 transition-colors duration-150" />
            </div>
          </div>
          
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Fecha de vencimiento</span>
            <div className="relative">
              <input
                type="date"
                value={values.fechaFin}
                onChange={set('fechaFin')}
                min={values.fechaInicio}
                className="bg-transparent text-sm font-medium text-right focus:outline-none text-gray-900 dark:text-white peer"
              />
              <span className="absolute bottom-0 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700 peer-focus:bg-gray-500 dark:peer-focus:bg-gray-400 transition-colors duration-150" />
            </div>
          </div>
        </div>
      )}

      {/* ── PASO 4: CLIENTE ── */}
      {hasFechas && (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/60 transition-all duration-300 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center">
              <UserRound size={16} className="text-gray-400 mr-2" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Cliente</span>
            </div>
          </div>
          <div className="px-4 py-3 relative">
            <input
              type="text"
              placeholder="Nombre completo del deudor"
              value={values.nombreCliente}
              onChange={set('nombreCliente')}
              className="w-full bg-transparent text-base focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 font-medium pb-1 peer"
            />
            <span className="absolute bottom-3 left-4 right-4 h-px bg-gray-200 dark:bg-gray-700 peer-focus:bg-gray-500 dark:peer-focus:bg-gray-400 transition-colors duration-150" />
          </div>
        </div>
      )}

    </div>
  );
}
