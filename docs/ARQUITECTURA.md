# Arquitectura de PRGARCÍA

## Estructura

- `src/App.jsx`: composición principal, sesión, calculadora y cotizaciones.
- `src/components/`: formularios, encabezados y vistas reutilizables.
- `src/context/`: autenticación y tema global.
- `src/hooks/`: estado compartido como la tasa BCV.
- `src/services/`: llamadas HTTP y caché del navegador.
- `src/utils/`: cálculo puro, validaciones y navegación de teclado.
- `src/features/`: destino para separar funcionalidades cuando crezcan.
- `api/`: funciones serverless; `api/_lib/` contiene utilidades solo de servidor.
- `server/`: API local con SQLite para desarrollo; no se despliega a Vercel.
- `tests/`: pruebas de Node `node:test`; `docs/`: acuerdos y documentación.

## Navegación y funcionalidades

La aplicación es una SPA con una ruta pública, `/`. `src/App.jsx` verifica la sesión: sin usuario muestra la bienvenida; con usuario muestra Calculadora o Cotizaciones mediante estado local. `Header.jsx` y `SidebarMobile.jsx` comparten esas vistas. Vercel sirve por separado las páginas estáticas públicas y la 404. No se usa una biblioteca de enrutamiento.

Al crecer, cada funcionalidad debe vivir en `src/features/<nombre>/` con su punto de entrada (`index.jsx`), componentes, hooks y servicios propios. Calculadora y Cotizaciones son los primeros candidatos para trasladarse allí. El punto de entrada debe exponer la vista y sus metadatos de navegación; la navegación central los registra sin mezclar la lógica de otros módulos. Las funcionalidades futuras, como Clientes o Pagos, se añaden solo al implementar un flujo real; no crear vistas de “próximamente”.

## Acceso a datos

- Las fórmulas y el cronograma viven en `src/utils/calculator.js` y no hacen llamadas de red.
- El navegador usa Supabase Auth y la clave publicable. RLS debe comprobar `user_id = auth.uid()` para cada tabla de usuario.
- El historial remoto está en `user_history`; las lecturas y escrituras se hacen desde `src/App.jsx`.
- Las funciones de `api/` usan clientes de servidor; `SUPABASE_SERVICE_ROLE_KEY` no se importa desde `src/`.
- El servidor de desarrollo persiste la tasa en SQLite. Esa base local no es almacenamiento de producción.
- Cada tabla nueva con datos de cuenta lleva `user_id`, activa RLS y tiene políticas y pruebas de aislamiento entre usuarios. Registrar SQL pendiente en `docs/CAMBIOS_SUPABASE.md`; no aplicarlo desde el cliente.

## Convenciones

- Añadir pruebas `node:test` junto al comportamiento que cubren; `npm test`, `npm run lint` y `npm run build` antes de confirmar.
- Mantener errores, carga y estados vacíos explícitos y en español.
- Asociar etiquetas a campos, conservar foco visible y comprobar contraste en ambos temas.
- Mantener secretos en funciones de servidor; todo lo compilado para el navegador es público.# Arquitectura de PRGARCÍA

## Estructura actual

- `src/App.jsx`: estado principal, acceso autenticado, pestañas internas e historial de cotizaciones.
- `src/components/`: formularios y vistas React; `src/context/` contiene autenticación y tema.
- `src/utils/calculator.js`: interés simple, conversiones y cronograma, sin acceso a red o base de datos.
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

Antes de confirmar cambios: `npm test`, `npm run lint` y `npm run build`. Mantener las fórmulas puras y cubrir fechas, conversiones, redondeo y errores en pruebas. Los formularios deben asociar etiquetas, conservar foco visible y anunciar estados de carga/error. Las funciones destructivas y cualquier secreto permanecen en el servidor.