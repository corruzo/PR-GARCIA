import { ClienteDetalle } from './ClienteDetalle';
import { ClientesLista } from './ClientesLista';

/** Clientes: lista (#/clientes), alta rápida (#/clientes/nuevo) y ficha (#/clientes/<id>). */
export function ClientesView({ route, navigate }) {
  if (route.id && route.id !== 'nuevo') return <ClienteDetalle id={route.id} navigate={navigate} />;
  return <ClientesLista creating={route.id === 'nuevo'} navigate={navigate} />;
}
