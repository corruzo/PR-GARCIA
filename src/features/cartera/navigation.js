import { Calculator, ChartColumn, HandCoins, Landmark, Users } from 'lucide-react';

/**
 * Módulos de la navegación principal (orden = orden en pantalla).
 * `mobile: true` = aparece en la barra inferior del teléfono (máximo 5).
 */
export const NAV_ITEMS = [
  { id: 'calculator', label: 'Calculadora', shortLabel: 'Calcular', icon: Calculator, mobile: true },
  { id: 'clientes', label: 'Clientes', icon: Users, mobile: true },
  { id: 'prestamos', label: 'Préstamos', icon: Landmark, mobile: true },
  { id: 'cobranza', label: 'Cobranza', shortLabel: 'Cobrar', icon: HandCoins, mobile: true },
  { id: 'reportes', label: 'Reportes', icon: ChartColumn, mobile: true },
];
