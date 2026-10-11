import { Bookmark, Calculator, ChartColumn, HandCoins, Landmark, Users } from 'lucide-react';

/** Módulos de la navegación principal (orden = orden en pantalla). */
export const NAV_ITEMS = [
  { id: 'calculator', label: 'Calculadora', icon: Calculator },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'prestamos', label: 'Préstamos', icon: Landmark },
  { id: 'cobranza', label: 'Cobranza', icon: HandCoins },
  { id: 'reportes', label: 'Reportes', icon: ChartColumn },
  { id: 'saved', label: 'Cotizaciones', icon: Bookmark, countKey: 'history' },
];
