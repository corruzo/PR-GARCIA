# Uso de Supabase

Inventario de todo lo que la app y la API leen o escriben en Supabase. La estructura completa (tablas,
funciones, políticas y permisos) está en `supabase/esquema/esquema_completo.sql`.

## Dónde se accede

| Capa | Archivo | Clave |
| --- | --- | --- |
| Navegador (cartera) | `src/features/cartera/api.js` — **único** punto de acceso a datos de la interfaz | Clave publicable + sesión del usuario (RLS) |
| Navegador (sesión) | `src/context/AuthContext.jsx` | Clave publicable |
| Servidor | `api/bcv.js`, `api/bcv/latest.js` (vía `api/_lib/db.js`) | `SUPABASE_SERVICE_ROLE_KEY` (solo en Vercel o `.env.local`; nunca en `src/`) |

Regla: ningún componente llama a `supabase.from(...)` o `supabase.rpc(...)` directamente; todo pasa por
`src/features/cartera/api.js`, que además traduce los errores a mensajes para la persona.

## Datos de la cartera (navegador, con RLS por `auth.uid()`)

| Objeto | Operación | Notas |
| --- | --- | --- |
| `clientes` | select, insert, update, delete | Solo las columnas de la ficha (id, user_id y fechas los pone la base). No se borra si tiene préstamos. |
| `v_prestamos_resumen`, `v_cuotas_estado`, `pagos` (+ `aplicaciones_pago`) | select | Vistas con `security_invoker`: respetan RLS. |
| `v_cartera_antiguedad`, `v_cobranza_mensual`, `v_libro_mayor`, `auditoria` | select | Reportes. |
| `tasa_bcv` | select (`estado = 'ok'`) | Tasa BCV de referencia; pública de solo lectura. |
| `emitir_prestamo`, `anular_prestamo` | rpc | Validan términos, tasa (±20 % de la BCV o `p_confirmar_tasa`), límite de crédito y cliente activo. |
| `registrar_pago`, `anular_pago`, `anular_pagos_desde` | rpc | Pagos en orden cronológico; préstamo en USD solo recibe intereses y mora en Bs. |
| `monto_cancelacion`, `reporte_diferencial_cambiario`, `sincronizar_prestamos_abiertos` | rpc | Consultas y generación de períodos de préstamos abiertos. |

Préstamos, cuotas, pagos, asientos y auditoría **no** se escriben directamente: solo a través de las funciones
anteriores (`SECURITY DEFINER`, `search_path` vacío). Asientos, aplicaciones, pagos y auditoría no se pueden
modificar ni borrar.

`user_history` (cotizaciones de la versión anterior) ya no se usa: solo admite leer y borrar lo propio.

## Tasa BCV (servidor)

| Archivo | Operación |
| --- | --- |
| `api/bcv.js` | Lee la última tasa (oficial y cualquiera), consulta el BCV/proveedores y guarda la nueva con estado `ok` (oficial) o `referencial`. |
| `api/bcv/latest.js` | Devuelve la última tasa oficial guardada (o la referencial si no hay oficial). |

En desarrollo, `server/index.js` sirve estas mismas funciones.

## Autenticación (`src/context/AuthContext.jsx`)

`getSession`, `onAuthStateChange`, `signInWithPassword`, `signUp` (con `full_name`), `signInWithOtp`
(recuperación, `shouldCreateUser: false`), `verifyOtp` (registro y recuperación), `updateUser`
(contraseña previa verificación de la actual; nombre), `signInWithOAuth` (Google/Apple, vuelve al dominio
actual) y `signOut` (borra además la caché sin conexión).
