import { PageHeader } from '../cartera/ui';
import { NuevoPrestamoForm } from './NuevoPrestamoForm';
import { PrestamoDetalle } from './PrestamoDetalle';
import { PrestamosLista } from './PrestamosLista';

/** Préstamos: lista (#/prestamos), nuevo (#/prestamos/nuevo) y detalle (#/prestamos/<id>). */
export function PrestamosView({ route, navigate, prefill, onPrefillUsed }) {
  if (route.id === 'nuevo') {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Nuevo préstamo" subtitle="Los datos se validan y se guardan en el servidor." />
        <NuevoPrestamoForm
          clienteId={route.params.cliente}
          prefill={prefill}
          onCreated={(id) => { onPrefillUsed?.(); navigate('prestamos', id); }}
          onCancel={() => { onPrefillUsed?.(); window.history.back(); }}
        />
      </div>
    );
  }
  if (route.id) return <PrestamoDetalle id={route.id} navigate={navigate} />;
  return <PrestamosLista navigate={navigate} />;
}
