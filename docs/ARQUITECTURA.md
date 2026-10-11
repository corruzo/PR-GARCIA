# Arquitectura de PRGARCÍA

## Estructura actual

- `src/App.jsx`: estado principal, acceso autenticado, pestañas internas e historial de cotizaciones.
- `src/components/`: formularios y vistas React; `src/context/` contiene autenticación y tema.
- `shared/finance/`: núcleo financiero puro en centavos enteros (`money.js`, `dates.js`, `schedule.js`), compartido por cliente y servidor.
- `src/utils/calculator.js`: adaptador de la calculadora sobre `shared/finance/`, sin acceso a red o base de datos.
- `src/services/`: clientes HTTP y caché local de tasa.
- `src/hooks/`: estado compartido de tasa BCV y preferencias.
- `api/`: funciones serverless de Vercel; `api/_lib/` contiene clientes de servidor.
- `server/`: API de desarrollo y persistencia SQLite local; no se usa en Vercel.
- `tests/`: pruebas de Node `node:test`; `docs/`: decisiones y SQL pendiente de ejecución.

## Navegación y módulos

La app usa React en una sola ruta pública (`/`). Sin sesión muestra la bienvenida; con sesión, `App.jsx` presenta las vistas internas Calculadora y Cotizaciones mediante estado. `Header.jsx` y `SidebarMobile.jsx` comparten ese estado. No hay React Router instalado.

Convención para extraer un módulo: crear `src/features/<modulo>/` con `index.js` (componente público), `components/`, `hooks/` y `services/`. La navegación debe referenciar el descriptor exportado por esa carpeta; no mezclar datos o llamadas de un módulo dentro de otro. Los módulos nuevos deben aparecer solo cuando implementen un flujo real; no añadir pantallas de “próximamente”. La migración desde las vistas actuales se hará gradualmente, conservando las rutas públicas existentes.

## Acceso a datos

- La calculadora importa funciones puras de `src/utils/calculator.js`.
- El navegador usa Supabase Auth y consultas a `user_history` mediante la clave publicable; RLS limita las cotizaciones a `auth.uid()`.
- Las funciones de `api/` acceden a Supabase desde servidor. La clave `SUPABASE_SERVICE_ROLE_KEY` nunca debe pasar a `src/`.
- El servidor local usa SQLite en `server/` para la tasa BCV. No es un reemplazo de Supabase en producción.
- Cada tabla nueva con datos de cuenta debe tener `user_id` vinculado a `auth.uid()`, RLS para cada operación y pruebas de acceso entre usuarios. Registrar el SQL en `docs/CAMBIOS_SUPABASE.md`; no aplicarlo desde el cliente de código.

## Calidad

Antes de confirmar cambios: `npm test`, `npm run lint` y `npm run build`. Mantener las fórmulas puras y cubrir fechas, conversiones, redondeo y errores en pruebas. Los montos se suman y guardan siempre como enteros de centavos; el redondeo es mitad al par y se aplica una sola vez por operación. Los formularios deben asociar etiquetas, conservar foco visible y anunciar estados de carga/error. Las funciones destructivas y cualquier secreto permanecen en el servidor.